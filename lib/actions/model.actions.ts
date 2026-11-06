// Ask the live model server (model-server/ in this repo) to score one
// recipe. Server-only: the model server URL and API key never reach the browser.
//
// Settings (process.env, read on the server):
//   MODEL_SERVER_URL                   default http://127.0.0.1:8765
//   MODEL_SERVER_API_KEY               sent as "Authorization: Bearer <key>" when set
//   MODEL_SERVER_TIMEOUT_MS            default 55000 (below nginx's default proxy_read_timeout of 60 s)
//   AI_PREDICTION_LIVE_RATE_PER_MIN    live requests per client IP per minute, default 6 (0 = no limit)
//   AI_PREDICTION_TRUST_PROXY          "1" once nginx overwrites X-Real-IP with $remote_addr on
//                                      /api/ai-prediction. Until then the rate limit above is
//                                      shared by all visitors (see lib/live-limits.ts).
//   AI_PREDICTION_LIVE_MAX_IN_FLIGHT   live requests waiting on the model per Next.js process, default 2

export const DEFAULT_MODEL_LABEL = "GPT-oss-MOFinder (quantized)";
const HEALTH_TIMEOUT_MS = 2000;
const HEALTH_CACHE_MS = 10_000;
const DEFAULT_RETRY_AFTER_S = 30;
// Below nginx's default proxy_read_timeout (60 s), so an unset env never ends in nginx's 504 page
const DEFAULT_TIMEOUT_MS = 55_000;

function envNumber(name: string, fallback: number): number {
	const raw = process.env[name]?.trim();
	if (!raw) return fallback;
	const value = Number(raw);
	return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function getLiveSettings() {
	return {
		url: (process.env.MODEL_SERVER_URL?.trim() || "http://127.0.0.1:8765").replace(/\/+$/, ""),
		apiKey: process.env.MODEL_SERVER_API_KEY?.trim() || "",
		timeoutMs: envNumber("MODEL_SERVER_TIMEOUT_MS", DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
		ratePerMin: envNumber("AI_PREDICTION_LIVE_RATE_PER_MIN", 6),
		trustProxy: process.env.AI_PREDICTION_TRUST_PROXY?.trim() === "1",
		maxInFlight: Math.max(1, Math.floor(envNumber("AI_PREDICTION_LIVE_MAX_IN_FLIGHT", 2))),
	};
}

function authHeaders(apiKey: string): Record<string, string> {
	return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

export type LivePrediction = {
	pP: number;
	pred: "P" | "N";
	model: string;
	latencyMs: number;
	cached: boolean;
};

export type LiveFailure = {
	code: Exclude<AiPredictionErrorCode, "rate_limited">;
	// Seconds, only for "busy"
	retryAfter?: number;
	// For the server log only; not sent to the browser
	detail: string;
};

export type LiveResult = { ok: true; data: LivePrediction } | ({ ok: false } & LiveFailure);

// The model server's label. The mock backend (a wiring test, no model) says so
// even when MOFINDER_MODEL_MODEL_NAME hides it.
function modelLabel(data: any): string {
	let label = typeof data?.model === "string" && data.model ? data.model : DEFAULT_MODEL_LABEL;
	if (data?.backend === "mock") {
		if (!/mock|test/i.test(label)) label += " (test mode)";
	}
	return label;
}

function retryAfterSeconds(res: Response): number {
	const value = Number(res.headers.get("Retry-After"));
	return Number.isFinite(value) && value > 0 ? Math.ceil(value) : DEFAULT_RETRY_AFTER_S;
}

// Score one recipe with the live model. `signal` lets the caller give up early,
// but the model server keeps running a request it already has, so the API route
// doesn't pass one. The timeout comes from the settings.
export async function predictLive(recipe: SynthesisRecipe, signal?: AbortSignal): Promise<LiveResult> {
	const { url, apiKey, timeoutMs } = getLiveSettings();
	const controller = new AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeoutMs);
	const onAbort = () => controller.abort();
	signal?.addEventListener("abort", onAbort);

	// Exactly the 8 fields of the model server contract, in prompt order
	const body = {
		metal_precursor: recipe.metal_precursor,
		organic_linker: recipe.organic_linker,
		modulator: recipe.modulator || "none",
		solvent: recipe.solvent,
		metal_concentration_mM: recipe.metal_concentration_mM,
		M_L_ratio: recipe.M_L_ratio,
		temperature_C: recipe.temperature_C,
		time_h: recipe.time_h,
	};

	const started = Date.now();
	try {
		const res = await fetch(`${url}/predict`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders(apiKey) },
			body: JSON.stringify(body),
			signal: controller.signal,
			cache: "no-store",
		});
		const data = await res.json().catch(() => null);

		if (!res.ok) {
			const detail = `model server ${res.status} ${data?.error ?? ""}: ${data?.detail ?? ""}`;
			if (res.status === 503) return { ok: false, code: "busy", retryAfter: retryAfterSeconds(res), detail };
			if (res.status === 504) return { ok: false, code: "timeout", detail };
			if (res.status === 400) return { ok: false, code: "invalid", detail };
			// 401 means the site and the model server disagree on the API key
			if (res.status === 401) return { ok: false, code: "offline", detail };
			return { ok: false, code: "model_error", detail };
		}

		const pP = Number(data?.pP);
		if (!Number.isFinite(pP) || pP < 0 || pP > 1) {
			return { ok: false, code: "model_error", detail: "model server sent no valid pP" };
		}

		return {
			ok: true,
			data: {
				pP,
				pred: data.pred === "P" || data.pred === "N" ? data.pred : pP >= 0.5 ? "P" : "N",
				model: modelLabel(data),
				latencyMs: Date.now() - started,
				cached: data.cached === true,
			},
		};
	} catch (err: any) {
		if (timedOut) {
			return { ok: false, code: "timeout", detail: `no answer within ${timeoutMs} ms` };
		}
		// Connection refused, DNS failure, or the caller gave up
		return { ok: false, code: "offline", detail: err?.cause?.code ?? err?.message ?? String(err) };
	} finally {
		clearTimeout(timer);
		signal?.removeEventListener("abort", onAbort);
	}
}

type ModelHealth = {
	status: "ok" | "loading" | "error";
	model: string;
	queue: { in_flight: number; waiting: number; max_waiting: number };
};

async function loadHealth(): Promise<ModelHealth | null> {
	const { url, apiKey } = getLiveSettings();
	try {
		const res = await fetch(`${url}/health`, {
			headers: { Accept: "application/json", ...authHeaders(apiKey) },
			signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
			cache: "no-store",
		});
		if (!res.ok) return null;
		const data = await res.json();
		return typeof data?.status === "string" ? (data as ModelHealth) : null;
	} catch {
		return null;
	}
}

// Model server /health, cached for a few seconds so the status dot can't flood it
export function getModelHealth(): Promise<ModelHealth | null> {
	const cache = globalThis as any;
	const entry = cache.__modelHealth as { at: number; value: Promise<ModelHealth | null> } | undefined;

	if (entry && Date.now() - entry.at < HEALTH_CACHE_MS) {
		return entry.value;
	}

	const value = loadHealth();
	cache.__modelHealth = { at: Date.now(), value };
	return value;
}
