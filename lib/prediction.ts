import { AI_PREDICTION_FIELDS, AI_PREDICTION_NUMERIC_RANGES } from "@/constants";

// Plain decimal numbers only ("1e3", "0x10" and "Infinity" are rejected)
const DECIMAL_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

export function isNumericField(key: AiPredictionField): key is AiPredictionNumericField {
	return key in AI_PREDICTION_NUMERIC_RANGES;
}

// Check one typed number for the live model: round to 2 decimals, then check the range.
// Used by the API and by the popup's inline messages, so both say the same thing.
export function checkNumericValue(
	key: AiPredictionNumericField,
	raw: string
): { value: number | null; error: string | null } {
	const field = AI_PREDICTION_FIELDS.find((f) => f.key === key)!;
	const { min, max } = AI_PREDICTION_NUMERIC_RANGES[key];
	const text = raw.trim();

	if (!text) {
		return { value: null, error: `Enter a ${field.label.toLowerCase()}` };
	}

	const parsed = Number(text);
	if (!DECIMAL_RE.test(text) || !Number.isFinite(parsed)) {
		return { value: null, error: `${field.label} must be a number` };
	}

	const value = Math.round(parsed * 100) / 100;
	if (value < min || value > max) {
		return {
			value: null,
			error: `${field.label} must be between ${formatPredictionValue(key, min)} and ${formatPredictionValue(key, max)}`,
		};
	}

	return { value, error: null };
}

// Read recipe fields from query params and check each one against the allowed
// options. Missing fields are left out; unknown values produce an error.
// With typedNumbers (live model), numbers only have to be inside
// AI_PREDICTION_NUMERIC_RANGES instead of on the precomputed grid.
export function parseRecipeParams(
	params: URLSearchParams,
	options: AiPredictionOptions,
	{ typedNumbers = false }: { typedNumbers?: boolean } = {}
): { recipe: Partial<SynthesisRecipe>; error: string | null } {
	const recipe: Partial<SynthesisRecipe> = {};

	for (const { key, label, numeric } of AI_PREDICTION_FIELDS) {
		const raw = (params.get(key) ?? "").trim();
		if (!raw) continue;

		if (typedNumbers && isNumericField(key)) {
			const { value, error } = checkNumericValue(key, raw);
			if (error) {
				return { recipe, error: `${error}: ${raw}` };
			}
			recipe[key] = value!;
			continue;
		}

		const allowed = options[key] as Array<string | number>;
		const value = numeric ? Number(raw) : raw;

		if (!allowed.includes(value)) {
			return { recipe, error: `Unsupported ${label.toLowerCase()}: ${raw}` };
		}

		(recipe as Record<string, unknown>)[key] = value;
	}

	return { recipe, error: null };
}

// True when every number of the recipe is one of the precomputed grid values
export function isOnGrid(recipe: SynthesisRecipe, options: AiPredictionOptions): boolean {
	return AI_PREDICTION_FIELDS.every(({ key }) =>
		(options[key] as Array<string | number>).includes(recipe[key])
	);
}

export function missingFields(recipe: Partial<SynthesisRecipe>, required: AiPredictionField[]): string[] {
	return required.filter((key) => recipe[key] == null);
}

export function formatPredictionValue(key: AiPredictionField, value: string | number): string {
	const field = AI_PREDICTION_FIELDS.find((f) => f.key === key);
	return field?.unit ? `${value} ${field.unit}` : String(value);
}
