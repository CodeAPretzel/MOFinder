import { NextResponse } from "next/server";
import { getLiveSettings, getModelHealth } from "@/lib/actions/model.actions";
import { liveSlotsFull } from "@/lib/live-limits";

export const runtime = "nodejs";

// Whether the live model can take a request right now. Only the summary is
// sent; the model server's own health details stay on the server.
export async function GET() {
	const health = await getModelHealth();
	const queue = health?.queue;
	let live: AiPredictionLiveStatus = "online";

	if (health?.status !== "ok") {
		live = "offline";
	} else if (
		liveSlotsFull(getLiveSettings().maxInFlight) ||
		(queue && queue.max_waiting > 0 && queue.waiting >= queue.max_waiting)
	) {
		live = "busy";
	}

	const status: AiPredictionStatus = { live };

	return NextResponse.json(status, {
		headers: {
			"Cache-Control": "no-store",
		},
	});
}
