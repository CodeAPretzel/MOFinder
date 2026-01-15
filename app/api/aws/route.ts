import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { FILTER_DEFS } from "@/lib/utils";

export const runtime = "nodejs";

const s3 = new S3Client({ region: process.env.AWS_REGION });

// cache TTL (time to live)
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedData: any[] | null = null;
let cachedAt = 0;

const parseNumber = (v: string | null): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const parseBool = (v: string | null): boolean => {
  return v === "true" || v === "1" || v === "yes";
}

const matchesFilters = (m: MofEntry, p: URLSearchParams): boolean => {
  // special: search
  const q = (p.get(FILTER_DEFS.searchQuery.param) ?? "").trim().toLowerCase();
  if (q) {
    const ok =
      m.mof_name.toLowerCase().includes(q) ||
      m.metal_1.toLowerCase().includes(q) ||
      m.metal_1_abbr.toLowerCase().includes(q) ||
      m.linker_1.toLowerCase().includes(q) ||
      m.linker_1_abbr.toLowerCase().includes(q);
    if (!ok) return false;
  }

  for (const def of Object.values(FILTER_DEFS)) {
    if (def.kind === "search") continue;

    const raw = p.get(def.param);

    if (def.kind === "boolean") {
      const want = parseBool(raw);
      if (want && !(m as any)[def.field!]) return false;
    }

    if (def.kind === "stringEq") {
      if (raw && String((m as any)[def.field!]) !== raw) return false;
    }

    if (def.kind === "numberMin") {
      const min = parseNumber(raw);
      if (min != null && Number((m as any)[def.field!] ?? 0) < min) return false;
    }

    if (def.kind === "numberMax") {
      const max = parseNumber(raw);
      if (max != null && Number((m as any)[def.field!] ?? 0) > max) return false;
    }
  }

  return true;
}

async function streamToString(stream: any): Promise<string> {
  if (stream?.transformToString) return await stream.transformToString();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf-8");
}

async function loadAllMofs(): Promise<any[]> {
  const now = Date.now();
  if (cachedData && now - cachedAt < CACHE_TTL_MS) return cachedData;

  const Bucket = process.env.NEXT_PUBLIC_MOF_BUCKET!;
  const Key = process.env.NEXT_PUBLIC_MOF_KEY!;

  const obj = await s3.send(new GetObjectCommand({ Bucket, Key }));
  const jsonText = await streamToString(obj.Body);
  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed)) throw new Error("MOF JSON is not an array");
  cachedData = parsed;
  cachedAt = now;
  return parsed;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") ?? "9")));

    const all = await loadAllMofs();

    // Basic pagination
    const filtered = all.filter((m) => matchesFilters(m as MofEntry, url.searchParams))
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);

    return NextResponse.json(
      { total, page, pageSize, data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to serve MOF dataset", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
