import { NextResponse } from "next/server";
import { getPredictionOptions, predictRecipe } from "@/lib/actions/prediction.actions";
import { missingFields, parseRecipeParams } from "@/lib/prediction";
import { AI_PREDICTION_FIELDS } from "@/constants";

export const runtime = "nodejs";

// Score one full recipe: every field in AI_PREDICTION_FIELDS is required
export async function GET(req: Request) {
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
