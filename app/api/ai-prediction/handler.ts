import { AI_PREDICTION_LIVE_MESSAGES } from "@/constants";

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

export function fetchPredictionConfig(): Promise<AiPredictionConfig> {
	return getJson<AiPredictionConfig>("/api/ai-prediction/config", "prediction settings");
}

export async function fetchPredictionStatus(): Promise<AiPredictionStatus> {
	const res = await fetch("/api/ai-prediction/status", { headers: { Accept: "application/json" }, cache: "no-store" });
	if (!res.ok) throw new Error(`Failed to load model status (${res.status})`);
	return res.json();
}

// For error pages that don't come from the site itself (nginx's own 429 from
// its rate limit, 502 when the site is down, 504 at proxy_read_timeout)
const STATUS_CODES: Record<number, AiPredictionErrorCode> = {
	400: "invalid",
	429: "rate_limited",
	502: "offline",
	503: "busy",
	504: "timeout",
};

export type LivePredictionResult =
	| { ok: true; data: SynthesisPrediction }
	| { ok: false; code: AiPredictionErrorCode; error: string; retryAfter?: number };

// Live model (Plan B). Never throws for model problems: the popup shows a
// message per error code instead. Aborting `signal` throws an AbortError.
export async function fetchLivePrediction(
	recipe: SynthesisRecipe,
	signal?: AbortSignal
): Promise<LivePredictionResult> {
	let res: Response;
	try {
		res = await fetch(`/api/ai-prediction?${toRecipeParams(recipe).toString()}`, {
			headers: { Accept: "application/json" },
			cache: "no-store",
			signal,
		});
	} catch (err: any) {
		if (err?.name === "AbortError") throw err;
		return { ok: false, code: "offline", error: "Could not reach the MOFinder server. Check your connection." };
	}

	const data = await res.json().catch(() => null);
	if (res.ok && data) {
		return { ok: true, data: data as SynthesisPrediction };
	}

	const retryAfter = Number(res.headers.get("Retry-After")) || undefined;
	const fallback = STATUS_CODES[res.status];
	return {
		ok: false,
		code: (data?.code as AiPredictionErrorCode) ?? fallback ?? "model_error",
		error:
			data?.error ?? (fallback ? AI_PREDICTION_LIVE_MESSAGES[fallback] : `Failed to load prediction (${res.status})`),
		retryAfter,
	};
}
