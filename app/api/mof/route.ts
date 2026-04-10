import { RowDataPacket } from "mysql2/promise";
import { NextResponse } from "next/server";
import { pool } from "@/lib/actions/mysql.actions";
import {
	FILTER_DEFINITIONS,
	LINKER_SMILES_HASH_PARAM,
	PARSE_BOOL,
	PARSE_NUMBER,
} from "@/lib/utils";

export const runtime = "nodejs";

// Build a BOOLEAN MODE fulltext query like: "+foo* +bar*"
function toBooleanFulltext(q: string): string {
	const terms = q
		.toLowerCase()
		.match(/[a-z0-9]+/g) ?? [];

	return terms.length ?
		terms.map((t) => `+${t}*`).join(" ")
		: "";
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

	// Linker-smiles-hash query
	const linkerSmilesHash = (p.get(LINKER_SMILES_HASH_PARAM) ?? "").trim();
	if (linkerSmilesHash) {
		clauses.push(`EXISTS (
		  SELECT 1
			FROM mof_linkers ml
		   WHERE ml.mof_id = mof_entry.id
			 AND ml.canonical_smiles_hash = ?
		)`);
		params.push(linkerSmilesHash);
	}

	// special: searchQuery (FULLTEXT)
	const q = (p.get(FILTER_DEFINITIONS.searchQuery.param) ?? "").trim();
	if (q) {
		const bq = toBooleanFulltext(q);
		const orParts: string[] = [];

		if (bq) {
			orParts.push(
				`MATCH(mof_name, metal_1, metal_1_abbr, linker_1, linker_1_abbr) AGAINST (? IN BOOLEAN MODE)`
			);
			params.push(bq);
		}

		// fallback for identifier-like searches
		orParts.push(`LOWER(mof_name) LIKE ?`);
		params.push(`%${q.toLowerCase()}%`);

		orParts.push(`LOWER(linker_1_abbr) LIKE ?`);
		params.push(`%${q.toLowerCase()}%`);

		clauses.push(`(${orParts.join(" OR ")})`);
	}

	for (const def of Object.values(FILTER_DEFINITIONS)) {
		if (def.kind === "search") continue;

		const raw = p.get(def.param);

		if (def.kind === "boolean") {
			const want = PARSE_BOOL(raw);
			if (want && def.field) {
				clauses.push(`${def.field} = 1`);
			}
			continue;
		}

		if (def.kind === "stringEq") {
			if (!raw) continue;

			// special: metal filter (symbol inside metal_1 precursor string)
			if (def.param === FILTER_DEFINITIONS.metal.param) {
				clauses.push(`metal_1 REGEXP ?`);
				params.push(metalRegex(raw));
			} else {
				clauses.push(`${def.field} = ?`);
				params.push(raw);
			}
			continue;
		}

		if (def.kind === "numberMin") {
			const min = PARSE_NUMBER(raw);
			if (min != null && min !== 0) {
				clauses.push(`${def.field} >= ?`);
				params.push(min);
			}
			continue;
		}

		if (def.kind === "numberMax") {
			const max = PARSE_NUMBER(raw);
			if (max != null && max !== 0) {
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
