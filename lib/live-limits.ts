// Limits for live model requests, kept in memory per Next.js process.
// Two checks: a token bucket per client IP (so one visitor can't hog the
// model) and a cap on how many live requests can wait on the model at once.

type Bucket = { tokens: number; updated: number };

// Oldest IPs are dropped past this many, so the map can't grow without limit
const MAX_TRACKED_CLIENTS = 5000;
const IN_FLIGHT_RETRY_AFTER_S = 10;

type LimitState = { buckets: Map<string, Bucket>; inFlight: number };

// Kept on globalThis so dev-mode reloads don't reset the counts
function state(): LimitState {
	const cache = globalThis as any;
	if (!cache.__aiLiveLimits) {
		cache.__aiLiveLimits = { buckets: new Map(), inFlight: 0 } satisfies LimitState;
	}
	return cache.__aiLiveLimits;
}

// nginx sits in front of the site, so the route never sees the visitor's own
// address. X-Real-IP is only used when `trustProxy` is on, which means nginx
// overwrites it from the connection (proxy_set_header X-Real-IP $remote_addr,
// see model-server/deploy/nginx-ai-prediction.conf.example). Otherwise it is
// whatever the browser sent, and a fake one would get a fresh bucket on every
// request. X-Forwarded-For is never used: its first hop is browser-controlled
// too. Without a trusted address everyone shares one bucket, so the limit
// becomes a site-wide one.
export function clientKey(req: Request, trustProxy: boolean): string {
	if (!trustProxy) return "shared";
	const ip = req.headers.get("x-real-ip")?.trim();
	return ip ? ip.slice(0, 64) : "shared";
}

// Take one token from the client's bucket. The bucket holds `perMin` tokens
// and refills at `perMin` per minute, so short bursts are fine.
export function takeRateToken(key: string, perMin: number): { ok: true } | { ok: false; retryAfter: number } {
	if (perMin <= 0) return { ok: true };

	const { buckets } = state();
	const now = Date.now();
	const refillPerMs = perMin / 60_000;

	const bucket = buckets.get(key) ?? { tokens: perMin, updated: now };
	bucket.tokens = Math.min(perMin, bucket.tokens + (now - bucket.updated) * refillPerMs);
	bucket.updated = now;

	// Re-insert so the Map's order is least recently seen first
	buckets.delete(key);
	buckets.set(key, bucket);
	while (buckets.size > MAX_TRACKED_CLIENTS) {
		buckets.delete(buckets.keys().next().value!);
	}

	if (bucket.tokens >= 1) {
		bucket.tokens -= 1;
		return { ok: true };
	}

	return { ok: false, retryAfter: Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerMs / 1000)) };
}

// Give back a token taken by takeRateToken, for a request that never reached
// the model (for example because the model was busy)
export function refundRateToken(key: string, perMin: number): void {
	if (perMin <= 0) return;
	const bucket = state().buckets.get(key);
	if (bucket) bucket.tokens = Math.min(perMin, bucket.tokens + 1);
}

// Reserve a slot for one live call. Returns { release } on success, or
// { retryAfter } when this process already has `max` calls waiting on the model.
export function acquireLiveSlot(max: number): { release: () => void } | { retryAfter: number } {
	const s = state();
	if (s.inFlight >= max) return { retryAfter: IN_FLIGHT_RETRY_AFTER_S };

	s.inFlight += 1;
	let released = false;
	return {
		release: () => {
			if (released) return;
			released = true;
			s.inFlight -= 1;
		},
	};
}

export function liveSlotsFull(max: number): boolean {
	return state().inFlight >= max;
}
