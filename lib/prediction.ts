import {
	AI_PREDICTION_CHOICES,
	AI_PREDICTION_FIELDS,
	AI_PREDICTION_NUMERIC_RANGES,
	AI_PREDICTION_TEXT_FIELDS,
	AI_PREDICTION_TEXT_MAX_LENGTH,
} from "@/constants";

// Plain decimal numbers only ("1e3", "0x10" and "Infinity" are rejected)
const DECIMAL_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
// Control and invisible formatting characters (the model server rejects them too)
const CONTROL_RE = /[\p{Cc}\p{Cf}]/u;

export function isNumericField(key: AiPredictionField): key is AiPredictionNumericField {
	return key in AI_PREDICTION_NUMERIC_RANGES;
}

export function isTextField(key: AiPredictionField): key is AiPredictionTextField {
	return (AI_PREDICTION_TEXT_FIELDS as AiPredictionField[]).includes(key);
}

function fieldLabel(key: AiPredictionField): string {
	return AI_PREDICTION_FIELDS.find((f) => f.key === key)!.label;
}

// Check one typed name (metal precursor, linker): spaces tidied, length and characters checked.
// Used by the API and by the popup's inline messages, so both say the same thing.
export function checkTextValue(
	key: AiPredictionTextField,
	raw: string
): { value: string | null; error: string | null } {
	const label = fieldLabel(key);
	const text = raw.replace(/\s+/g, " ").trim();

	if (!text) {
		return { value: null, error: `Enter the ${label.toLowerCase()}` };
	}
	if (text.length > AI_PREDICTION_TEXT_MAX_LENGTH) {
		return { value: null, error: `${label} must be at most ${AI_PREDICTION_TEXT_MAX_LENGTH} characters` };
	}
	if (CONTROL_RE.test(text)) {
		return { value: null, error: `${label} contains characters that are not allowed` };
	}

	return { value: text, error: null };
}

// Check one typed number: round to 2 decimals, then check the range
export function checkNumericValue(
	key: AiPredictionNumericField,
	raw: string
): { value: number | null; error: string | null } {
	const label = fieldLabel(key);
	const { min, max } = AI_PREDICTION_NUMERIC_RANGES[key];
	const text = raw.trim();

	if (!text) {
		return { value: null, error: `Enter the ${label.toLowerCase()}` };
	}

	const parsed = Number(text);
	if (!DECIMAL_RE.test(text) || !Number.isFinite(parsed)) {
		return { value: null, error: `${label} must be a number` };
	}

	const value = Math.round(parsed * 100) / 100;
	if (value < min || value > max) {
		return {
			value: null,
			error: `${label} must be between ${formatPredictionValue(key, min)} and ${formatPredictionValue(key, max)}`,
		};
	}

	return { value, error: null };
}

// Read recipe fields from query params. Missing fields are left out; bad values produce an error.
export function parseRecipeParams(params: URLSearchParams): { recipe: Partial<SynthesisRecipe>; error: string | null } {
	const recipe: Partial<SynthesisRecipe> = {};

	for (const { key, label } of AI_PREDICTION_FIELDS) {
		const raw = params.get(key) ?? "";
		if (!raw.trim()) continue;

		if (isNumericField(key)) {
			const { value, error } = checkNumericValue(key, raw);
			if (error) return { recipe, error: `${error}: ${raw.trim()}` };
			recipe[key] = value!;
		} else if (isTextField(key)) {
			const { value, error } = checkTextValue(key, raw);
			if (error) return { recipe, error };
			recipe[key] = value!;
		} else {
			const value = raw.trim();
			if (!AI_PREDICTION_CHOICES[key as AiPredictionChoiceField].includes(value)) {
				return { recipe, error: `Unsupported ${label.toLowerCase()}: ${value}` };
			}
			recipe[key as AiPredictionChoiceField] = value;
		}
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
