import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/actions/mysql.actions";
import { looksLikeSmiles, normalizeLinkerInput } from "@/lib/linker";
import { canonicalizeSmiles } from "@/lib/actions/smiles.actions";

export const runtime = "nodejs";

type LinkerResolveRow = RowDataPacket & {
	canonical_smiles_hash: string;
	canonical_smiles: string;
	display_name: string | null;
};

async function findByAlias(normalizedQuery: string): Promise<LinkerResolveRow | null> {
	const [rows] = await pool.query<LinkerResolveRow[]>(
		`
	  SELECT
		ll.canonical_smiles_hash,
		ll.canonical_smiles,
		ll.display_name
	  FROM linker_alias_lookup la
	  JOIN linker_lookup ll
		ON ll.canonical_smiles_hash = la.canonical_smiles_hash
	  WHERE la.alias_normalized = ?
	  ORDER BY
		CASE
		  WHEN LOWER(COALESCE(ll.display_name, '')) = ? THEN 0
		  ELSE 1
		END,
		CHAR_LENGTH(COALESCE(ll.display_name, '')),
		ll.display_name ASC
	  LIMIT 1
	`,
		[normalizedQuery, normalizedQuery]
	);

	return rows[0] ?? null;
}

async function findByCanonicalSmilesOrHash(
	canonicalSmiles: string,
	canonicalSmilesHash: string
): Promise<LinkerResolveRow | null> {
	const [rows] = await pool.query<LinkerResolveRow[]>(
		`
	  SELECT
		canonical_smiles_hash,
		canonical_smiles,
		display_name
	  FROM linker_lookup
	  WHERE canonical_smiles_hash = ?
		 OR canonical_smiles = ?
	  LIMIT 1
	`,
		[canonicalSmilesHash, canonicalSmiles]
	);

	return rows[0] ?? null;
}

async function loadAliases(canonicalSmilesHash: string | null): Promise<string[]> {
	if (!canonicalSmilesHash) return [];

	const [rows] = await pool.query<RowDataPacket[]>(
		`
	  SELECT DISTINCT alias_raw
	  FROM linker_alias_lookup
	  WHERE canonical_smiles_hash = ?
	  ORDER BY CHAR_LENGTH(alias_raw), alias_raw ASC
	  LIMIT 50
	`,
		[canonicalSmilesHash]
	);

	return rows
		.map((row) => (row.alias_raw == null ? null : String(row.alias_raw)))
		.filter((value): value is string => Boolean(value));
}

async function findSuggestions(
	normalizedQuery: string
): Promise<LinkerResolveResponse["suggestions"]> {
	if (!normalizedQuery) return [];

	const like = `%${normalizedQuery}%`;

	const [rows] = await pool.query<RowDataPacket[]>(
		`
	  SELECT
		ll.canonical_smiles_hash,
		ll.canonical_smiles,
		ll.display_name
	  FROM linker_alias_lookup la
	  JOIN linker_lookup ll
		ON ll.canonical_smiles_hash = la.canonical_smiles_hash
	  WHERE la.alias_normalized LIKE ?
		 OR LOWER(COALESCE(ll.display_name, '')) LIKE ?
	  GROUP BY
		ll.canonical_smiles_hash,
		ll.canonical_smiles,
		ll.display_name
	  ORDER BY
		CASE
		  WHEN LOWER(COALESCE(ll.display_name, '')) LIKE ? THEN 0
		  ELSE 1
		END,
		CHAR_LENGTH(COALESCE(ll.display_name, '')),
		ll.display_name ASC
	  LIMIT 5
	`,
		[like, like, `${normalizedQuery}%`]
	);

	return rows.map((row) => ({
		canonicalSmilesHash: String(row.canonical_smiles_hash),
		canonicalSmiles: String(row.canonical_smiles),
		displayName: row.display_name == null ? null : String(row.display_name),
	}));
}

export async function GET(req: Request) {
	try {
		const url = new URL(req.url);
		const query = (url.searchParams.get("q") ?? "").trim();

		if (!query) {
			return NextResponse.json(
				{ error: "Missing required query parameter: q" },
				{ status: 400 }
			);
		}

		const aliasQuery = normalizeLinkerInput(query);

		// 1) Try alias/name lookup first
		let matched: LinkerResolveRow | null = await findByAlias(aliasQuery);

		let inputMode: "alias" | "smiles" = "alias";
		let normalizedQuery = aliasQuery;
		let canonicalSmilesFromInput: string | null = null;
		let canonicalSmilesHashFromInput: string | null = null;
		let canonicalizationError: string | null = null;

		// 2) Only try SMILES if alias lookup missed
		if (!matched) {
			const smilesLike = looksLikeSmiles(query);

			if (smilesLike) {
				inputMode = "smiles";
				normalizedQuery = query.trim();

				const canonicalized = await canonicalizeSmiles(query);

				if (canonicalized.ok) {
					canonicalSmilesFromInput = canonicalized.canonicalSmiles;
					canonicalSmilesHashFromInput = canonicalized.canonicalSmilesHash;

					matched = await findByCanonicalSmilesOrHash(
						canonicalized.canonicalSmiles,
						canonicalized.canonicalSmilesHash
					);
				} else {
					canonicalizationError = canonicalized.error;
				}
			}
		}

		const aliases = await loadAliases(matched?.canonical_smiles_hash ?? null);

		const body: LinkerResolveResponse = {
			query,
			normalizedQuery,
			inputMode,
			matched: Boolean(matched),
			canonicalSmilesHash:
				matched?.canonical_smiles_hash ?? canonicalSmilesHashFromInput,
			canonicalSmiles:
				matched?.canonical_smiles ?? canonicalSmilesFromInput,
			displayName: matched?.display_name ?? null,
			aliases,
			suggestions: matched ? [] : await findSuggestions(aliasQuery),
			canonicalizationError,
		};

		return NextResponse.json(body, {
			headers: {
				"Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
			},
		});
	} catch (err: any) {
		return NextResponse.json(
			{ error: "Failed to resolve linker", detail: err?.message ?? String(err) },
			{ status: 500 }
		);
	}
}