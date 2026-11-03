import { NextResponse } from "next/server";
import { getPredictionOptions, predictRecipe } from "@/lib/actions/prediction.actions";
import { getLiveSettings, getPredictionMode, predictLive } from "@/lib/actions/model.actions";
import { acquireLiveSlot, clientKey, refundRateToken, takeRateToken } from "@/lib/live-limits";
import { isOnGrid, missingFields, parseRecipeParams } from "@/lib/prediction";
import { AI_PREDICTION_FIELDS, AI_PREDICTION_LIVE_MESSAGES } from "@/constants";

export const runtime = "nodejs";

// Score one full recipe: every field in AI_PREDICTION_FIELDS is required
export async function GET(req: Request) {
	if (getPredictionMode() === "live") {
		return livePrediction(req);
	}

	try {
		const url = new URL(req.url);
		const options = await getPredictionOptions();
		const { recipe, error } = parseRecipeParams(url.searchParams, options);

		if (error) {
			return NextResponse.json({ error }, { status: 400 });
		}

		const missing = missingFields(recipe, AI_PREDICTION_FIELDS.map((f) => f.key));
		if (missing.length) {
			return NextResponse.json(
				{ error: `Missing required query parameters: ${missing.join(", ")}` },
				{ status: 400 }
			);
		}

		const prediction = await predictRecipe(recipe as SynthesisRecipe);
		if (!prediction) {
			return NextResponse.json({ error: "No prediction for this recipe" }, { status: 404 });
		}

		return NextResponse.json(prediction, {
			headers: {
				"Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
			},
		});
	} catch (err: any) {
		return NextResponse.json(
			{ error: "Failed to load prediction", detail: err?.message ?? String(err) },
			{ status: 500 }
		);
	}
}

// Live answers are never cached by nginx or the browser: the model server keeps
// its own result cache, and a cached copy would skip the rate limit and keep
// showing old scores after the model is swapped.
const NO_STORE = { "Cache-Control": "no-store" };

const LIVE_STATUS: Record<AiPredictionErrorCode, number> = {
	invalid: 400,
	rate_limited: 429,
	busy: 503,
	offline: 503,
	timeout: 504,
	model_error: 502,
};

function liveError(code: AiPredictionErrorCode, { error, retryAfter }: { error?: string; retryAfter?: number } = {}) {
	return NextResponse.json(
		{ error: error ?? AI_PREDICTION_LIVE_MESSAGES[code], code },
		{
			status: LIVE_STATUS[code],
			headers: retryAfter ? { ...NO_STORE, "Retry-After": String(retryAfter) } : NO_STORE,
		}
	);
}

// The precomputed score is only extra information, so a slow or failing
// database must not hold up or break the live answer
const PRECOMPUTED_LOOKUP_TIMEOUT_MS = 3000;

function precomputedScore(recipe: SynthesisRecipe): Promise<SynthesisPrediction | null> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), PRECOMPUTED_LOOKUP_TIMEOUT_MS);
	});
	const lookup = predictRecipe(recipe).catch((err) => {
		console.error("[ai-prediction] precomputed lookup failed:", err?.message ?? err);
		return null;
	});
	return Promise.race([lookup, timeout]).finally(() => clearTimeout(timer));
}

let warnedSharedBucket = false;

// Plan B: categorical fields still come from the grid, numbers can be typed
// within AI_PREDICTION_NUMERIC_RANGES. The precomputed score is looked up too
// when the recipe is on the grid, so the popup can show both.
async function livePrediction(req: Request) {
	let options: AiPredictionOptions;
	try {
		options = await getPredictionOptions();
	} catch (err: any) {
		console.error("[ai-prediction] options failed:", err?.message ?? err);
		return NextResponse.json(
			{ error: "Failed to load prediction options" },
			{ status: 500, headers: NO_STORE }
		);
	}

	const url = new URL(req.url);
	const { recipe, error } = parseRecipeParams(url.searchParams, options, { typedNumbers: true });

	if (error) {
		return liveError("invalid", { error });
	}

	const missing = missingFields(recipe, AI_PREDICTION_FIELDS.map((f) => f.key));
	if (missing.length) {
		return liveError("invalid", { error: `Missing required query parameters: ${missing.join(", ")}` });
	}

	const settings = getLiveSettings();
	if (!settings.trustProxy && settings.ratePerMin > 0 && !warnedSharedBucket) {
		warnedSharedBucket = true;
		console.warn(
			"[ai-prediction] AI_PREDICTION_TRUST_PROXY is not 1, so all visitors share one live rate-limit bucket"
		);
	}

	// Slot first, so a "busy" refusal doesn't use up the visitor's rate tokens
	const slot = acquireLiveSlot(settings.maxInFlight);
	if ("retryAfter" in slot) {
		return liveError("busy", { retryAfter: slot.retryAfter });
	}

	const key = clientKey(req, settings.trustProxy);
	const token = takeRateToken(key, settings.ratePerMin);
	if (!token.ok) {
		slot.release();
		return liveError("rate_limited", { retryAfter: token.retryAfter });
	}

	try {
		const full = recipe as SynthesisRecipe;

		// req.signal is not passed on: when the visitor cancels, the model server
		// keeps working on the request anyway, so the slot stays taken until the
		// model answers or the site's timeout fires. Cancel in the popup only stops
		// the browser waiting. The answer still lands in the model's result cache.
		const [live, precomputed] = await Promise.all([
			predictLive(full),
			isOnGrid(full, options) ? precomputedScore(full) : Promise.resolve(null),
		]);

		if (!live.ok) {
			console.error(`[ai-prediction] live model ${live.code}: ${live.detail}`);
			// The model refused it without running it, so it doesn't count
			if (live.code === "busy") refundRateToken(key, settings.ratePerMin);
			return liveError(live.code, { retryAfter: live.retryAfter });
		}

		const prediction: SynthesisPrediction = {
			recipe: full,
			score: live.data.pP,
			pred: live.data.pred,
			model: live.data.model,
			source: "live",
			latencyMs: live.data.latencyMs,
			cached: live.data.cached,
		};
		if (precomputed) prediction.precomputedScore = precomputed.score;

		return NextResponse.json(prediction, { headers: NO_STORE });
	} catch (err: any) {
		console.error("[ai-prediction] live prediction failed:", err?.message ?? err);
		return liveError("model_error");
	} finally {
		slot.release();
	}
}
