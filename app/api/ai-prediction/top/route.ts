import { NextResponse } from "next/server";
import { getPredictionOptions, topRecipes } from "@/lib/actions/prediction.actions";
import { missingFields, parseRecipeParams } from "@/lib/prediction";
import { AI_PREDICTION_TOP_LIMIT } from "@/constants";

export const runtime = "nodejs";

// Best recipes for a metal + linker; any other recipe field narrows the list
export async function GET(req: Request) {
	try {
		const url = new URL(req.url);
		const options = await getPredictionOptions();
		const { recipe, error } = parseRecipeParams(url.searchParams, options);

		if (error) {
			return NextResponse.json({ error }, { status: 400 });
		}

		const missing = missingFields(recipe, ["metal_precursor", "organic_linker"]);
		if (missing.length) {
			return NextResponse.json(
				{ error: `Missing required query parameters: ${missing.join(", ")}` },
				{ status: 400 }
			);
		}

		const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? AI_PREDICTION_TOP_LIMIT) || AI_PREDICTION_TOP_LIMIT));

		const data = await topRecipes(
			recipe as Parameters<typeof topRecipes>[0],
			limit
		);

		return NextResponse.json(
			{ data },
			{
				headers: {
					"Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
				},
			}
		);
	} catch (err: any) {
		return NextResponse.json(
			{ error: "Failed to load top recipes", detail: err?.message ?? String(err) },
			{ status: 500 }
		);
	}
}
