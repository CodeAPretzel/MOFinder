function toRecipeParams(recipe: Partial<SynthesisRecipe>): URLSearchParams {
	const params = new URLSearchParams();

	for (const [key, value] of Object.entries(recipe)) {
		if (value == null || value === "") continue;
		params.set(key, String(value));
	}

	return params;
}

async function getJson<T>(url: string, label: string): Promise<T> {
	const res = await fetch(url, { headers: { Accept: "application/json" } });
	const data = (await res.json()) as T & { error?: string };

	if (!res.ok) {
		throw new Error(data.error ?? `Failed to load ${label} (${res.status})`);
	}

	return data;
}

export function fetchPredictionOptions(): Promise<AiPredictionOptions> {
	return getJson<AiPredictionOptions>("/api/ai-prediction/options", "prediction options");
}

export function fetchPrediction(recipe: SynthesisRecipe): Promise<SynthesisPrediction> {
	return getJson<SynthesisPrediction>(
		`/api/ai-prediction?${toRecipeParams(recipe).toString()}`,
		"prediction"
	);
}

export async function fetchTopRecipes(
	fixed: Partial<SynthesisRecipe>,
	limit?: number
): Promise<SynthesisPrediction[]> {
	const params = toRecipeParams(fixed);
	if (limit) params.set("limit", String(limit));

	const { data } = await getJson<{ data: SynthesisPrediction[] }>(
		`/api/ai-prediction/top?${params.toString()}`,
		"top recipes"
	);

	return data;
}
