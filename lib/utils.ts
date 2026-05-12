export const PARSE_NUMBER = (v: string | null): number | null => {
	if (v == null || v === "") return null;

	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

export const PARSE_BOOL = (v: string | null): boolean => {
	if (!v) return false;
	const s = v.trim().toLowerCase();
	return s === "true" || s === "1" || s === "yes" || s === "on";
}

export async function STREAM_TO_STRING(stream: any): Promise<string> {
	if (stream?.transformToString) return await stream.transformToString();
	const chunks: Buffer[] = [];
	for await (const chunk of stream) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks).toString("utf-8");
}