import { NextResponse } from "next/server";
import { getPredictionOptions } from "@/lib/actions/prediction.actions";

export const runtime = "nodejs";

export async function GET() {
	try {
		const options = await getPredictionOptions();

		return NextResponse.json(options, {
			headers: {
				"Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
			},
		});
	} catch (err: any) {
		return NextResponse.json(
			{ error: "Failed to load prediction options", detail: err?.message ?? String(err) },
			{ status: 500 }
		);
	}
}
