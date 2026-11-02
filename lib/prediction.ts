import { AI_PREDICTION_FIELDS } from "@/constants";

// Read recipe fields from query params and check each one against the allowed
// options. Missing fields are left out; unknown values produce an error.
export function parseRecipeParams(
	params: URLSearchParams,
	options: AiPredictionOptions
): { recipe: Partial<SynthesisRecipe>; error: string | null } {
	const recipe: Partial<SynthesisRecipe> = {};

	for (const { key, label, numeric } of AI_PREDICTION_FIELDS) {
		const raw = (params.get(key) ?? "").trim();
		if (!raw) continue;

		const allowed = options[key] as Array<string | number>;
		const value = numeric ? Number(raw) : raw;

		if (!allowed.includes(value)) {
			return { recipe, error: `Unsupported ${label.toLowerCase()}: ${raw}` };
		}

		(recipe as Record<string, unknown>)[key] = value;
	}

	return { recipe, error: null };
}

export function missingFields(recipe: Partial<SynthesisRecipe>, required: AiPredictionField[]): string[] {
	return required.filter((key) => recipe[key] == null);
}

export function formatPredictionValue(key: AiPredictionField, value: string | number): string {
	const field = AI_PREDICTION_FIELDS.find((f) => f.key === key);
	return field?.unit ? `${value} ${field.unit}` : String(value);
}
