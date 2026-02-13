import mysql, { Pool } from "mysql2/promise";
import { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import {
	FILTER_DEFS,
	PARSE_BOOL,
	PARSE_NUMBER,
} from "@/lib/utils";

export const runtime = "nodejs";

// ---- MySQL pool (reused across requests) ----
const pool: Pool =
	(globalThis as any).__mofPool ??
	mysql.createPool({
		host: process.env.MYSQL_HOST,
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PASSWORD,
		database: process.env.MYSQL_DATABASE,
		port: Number(process.env.MYSQL_PORT),
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0,
	});

(globalThis as any).__mofPool = pool;

// Build a BOOLEAN MODE fulltext query like: "+foo* +bar*"
function toBooleanFulltext(q: string): string {
	const terms = q
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.map((t) => t.replace(/[+\-<>()~*"@]/g, "")) // strip boolean operators/special chars
		.filter(Boolean);

	if (!terms.length) return "";
	return terms.map((t) => `+${t}*`).join(" ");
}

// Used for 'metal' filter in 'metal_1' column
function metalRegex(symbol: string): string {
	// roughly: (^|[^A-Za-z])Fe([^a-z]|$)
	// MySQL REGEXP uses ICU in 8.0; this should work.
	const safe = symbol.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
	return `(^|[^A-Za-z])${safe}([^a-z]|$)`;
}

function buildWhere(p: URLSearchParams): { whereSql: string; params: any[] } {
	const clauses: string[] = [];
	const params: any[] = [];

	// special: doi exact
	const doiParam = p.get("doi");
	if (doiParam) {
		const want = decodeURIComponent(doiParam);
		clauses.push("doi = ?");
		params.push(want);
	}

	// special: searchQuery (FULLTEXT)
	const q = (p.get(FILTER_DEFS.searchQuery.param) ?? "").trim();
	if (q) {
		const bq = toBooleanFulltext(q);
		if (bq) {
			clauses.push(
				`MATCH(mof_name, metal_1, metal_1_abbr, linker_1, linker_1_abbr) AGAINST (? IN BOOLEAN MODE)`
			);
			params.push(bq);
		}
	}

	for (const def of Object.values(FILTER_DEFS)) {
		if (def.kind === "search") continue;

		const raw = p.get(def.param);

		if (def.kind === "boolean") {
			const want = PARSE_BOOL(raw);
			if (want && def.field) {
				clauses.push(`${def.field} = 1`);
			}
		}

		if (def.kind === "stringEq") {
			if (!raw) continue;

			// special: metal filter (symbol inside metal_1 precursor string)
			if (def.param === FILTER_DEFS.metal.param) {
				clauses.push(`metal_1 REGEXP ?`);
				params.push(metalRegex(raw));
			} else if (def.field) {
				clauses.push(`${def.field} = ?`);
				params.push(raw);
			}
		}

		if (def.kind === "numberMin") {
			const min = PARSE_NUMBER(raw);
			if (min != null && def.field) {
				clauses.push(`${def.field} >= ?`);
				params.push(min);
			}
		}

		if (def.kind === "numberMax") {
			const max = PARSE_NUMBER(raw);
			if (max != null && def.field) {
				clauses.push(`${def.field} <= ?`);
				params.push(max);
			}
		}
	}

	const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
	return { whereSql, params };
}

export async function GET(req: Request) {
	try {
		const url = new URL(req.url);

		const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
		const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") ?? "9")));
		const offset = (page - 1) * pageSize;

		const { whereSql, params } = buildWhere(url.searchParams);

		// total count
		const [countRows] = await pool.query<RowDataPacket[]>(
			`SELECT COUNT(*) AS total FROM mof_entry ${whereSql}`,
			params
		);
		const total = Number(countRows?.[0]?.total ?? 0);

		// data page
		const selectCols = `
			id, doi, mof_name, mof_description,
			metal_1, metal_1_abbr, linker_1, linker_1_abbr,
			topology_code, solvent_main,
			temperature_c, time_h, yield_percent,
			bet_surface_area_m2g, pore_diameter_A, tga_decomposition_temp_c,
			water_stable, air_stable,
			crystal_morphology, crystal_form,
			status, synthesis_procedure, activation_procedure
		`;

		const [data] = await pool.query<RowDataPacket[]>(
			`SELECT ${selectCols}
			 FROM mof_entry
			 ${whereSql}
			 ORDER BY id DESC
			 LIMIT ? OFFSET ?`,
			[...params, pageSize, offset]
		);

		return NextResponse.json(
			{ total, page, pageSize, data },
			{
				headers: {
					"Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400",
				},
			}
		);
	} catch (err: any) {
		return NextResponse.json(
			{ error: "Failed to serve MOF dataset", detail: err?.message ?? String(err) },
			{ status: 500 }
		);
	}
}
