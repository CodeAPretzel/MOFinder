import { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/actions/mysql.actions";
import { AI_PREDICTION_FIELDS, AI_PREDICTION_TOP_LIMIT } from "@/constants";

// Plan A: scores are precomputed for a fixed grid of recipes and stored in
// ai_synthesis_prediction. To serve the live model instead (Plan B), replace
// the bodies below; the API routes and the UI only depend on these signatures.

const TABLE = "ai_synthesis_prediction";

type PredictionRow = RowDataPacket & SynthesisRecipe & {
	pP: number;
	pred: "P" | "N";
	model_name: string;
};

function toPrediction(row: PredictionRow): SynthesisPrediction {
	return {
		recipe: {
			metal_precursor: String(row.metal_precursor),
			organic_linker: String(row.organic_linker),
			modulator: String(row.modulator),
			solvent: String(row.solvent),
			// DECIMAL columns come back from mysql2 as strings
			metal_concentration_mM: Number(row.metal_concentration_mM),
			M_L_ratio: Number(row.M_L_ratio),
			temperature_C: Number(row.temperature_C),
			time_h: Number(row.time_h),
		},
		score: Number(row.pP),
		pred: row.pred,
		model: String(row.model_name),
	};
}

const SELECT_COLS = `
	metal_precursor, organic_linker, modulator, solvent,
	metal_concentration_mM, M_L_ratio, temperature_C, time_h,
	pP, pred, model_name
`;

async function loadOptions(): Promise<AiPredictionOptions> {
	const options = {} as AiPredictionOptions;

	for (const { key, numeric } of AI_PREDICTION_FIELDS) {
		const [rows] = await pool.query<RowDataPacket[]>(
			`SELECT DISTINCT ${key} AS value FROM ${TABLE} ORDER BY ${key}`
		);
		const values = rows.map((row) => (numeric ? Number(row.value) : String(row.value)));

		// Show "none" first for the modulator
		if (key === "modulator") {
			values.sort((a, b) => (a === "none" ? -1 : b === "none" ? 1 : 0));
		}

		(options as Record<string, unknown>)[key] = values;
	}

	return options;
}

// The grid never changes between deploys, so query it once per server process
export function getPredictionOptions(): Promise<AiPredictionOptions> {
	const cache = globalThis as any;
	if (!cache.__aiPredictionOptions) {
		cache.__aiPredictionOptions = loadOptions().catch((err) => {
			cache.__aiPredictionOptions = undefined;
			throw err;
		});
	}
	return cache.__aiPredictionOptions;
}

export async function predictRecipe(recipe: SynthesisRecipe): Promise<SynthesisPrediction | null> {
	const keys = AI_PREDICTION_FIELDS.map((f) => f.key);

	const [rows] = await pool.query<PredictionRow[]>(
		`SELECT ${SELECT_COLS}
		 FROM ${TABLE}
		 WHERE ${keys.map((k) => `${k} = ?`).join(" AND ")}
		 LIMIT 1`,
		keys.map((k) => recipe[k])
	);

	return rows[0] ? toPrediction(rows[0]) : null;
}

// Best-scoring recipes for one metal + linker, optionally holding other conditions fixed
export async function topRecipes(
	fixed: Partial<SynthesisRecipe> & Pick<SynthesisRecipe, "metal_precursor" | "organic_linker">,
	limit = AI_PREDICTION_TOP_LIMIT
): Promise<SynthesisPrediction[]> {
	const clauses: string[] = [];
	const params: unknown[] = [];

	for (const { key } of AI_PREDICTION_FIELDS) {
		const value = fixed[key];
		if (value == null || value === "") continue;
		clauses.push(`${key} = ?`);
		params.push(value);
	}

	const [rows] = await pool.query<PredictionRow[]>(
		`SELECT ${SELECT_COLS}
		 FROM ${TABLE}
		 WHERE ${clauses.join(" AND ")}
		 ORDER BY pP DESC, id ASC
		 LIMIT ?`,
		[...params, limit]
	);

	return rows.map(toPrediction);
}
