import { NextResponse } from "next/server";
import { DEFAULT_MODEL_LABEL, getLiveModelLabel, getPredictionMode } from "@/lib/actions/model.actions";
import { AI_PREDICTION_FULL_MODEL_URL, AI_PREDICTION_NUMERIC_RANGES } from "@/constants";

export const runtime = "nodejs";

// Tells the popup which mode the site runs in and which numbers it may type
export async function GET() {
	const mode = getPredictionMode();
	const label = mode === "live" ? await getLiveModelLabel() : DEFAULT_MODEL_LABEL;

	const config: AiPredictionConfig = {
		mode,
		numericRanges: AI_PREDICTION_NUMERIC_RANGES,
		liveModel: {
			label,
			quantized: true,
			fullModelUrl: AI_PREDICTION_FULL_MODEL_URL,
		},
	};

	return NextResponse.json(config, {
		headers: {
			"Cache-Control": "public, s-maxage=60",
		},
	});
}
