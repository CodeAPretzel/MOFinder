import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import {
  FILTER_DEFS,
  PARSE_BOOL,
  PARSE_NUMBER,
  STREAM_TO_STRING
} from "@/lib/utils";

export const runtime = "nodejs";

const s3 = new S3Client({ region: process.env.AWS_REGION });

// cache TTL (time to live)
const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedData: any[] | null = null;
let cachedAt = 0;

// Used for 'metal' filter in 'metal_1' JSON attribute
const containsMetalSymbol = (precursor: string, symbol: string): boolean => {
  if (!precursor || !symbol) return false;

  const re = new RegExp(`(^|[^A-Za-z])${symbol}([^a-z]|$)`);
  return re.test(precursor);
};

const matchesFilters = (m: MofEntry, p: URLSearchParams): boolean => {
  // special: doi
  const doiParam = p.get("doi");
  if (doiParam) {
    const want = decodeURIComponent(doiParam);
    const have = String((m as any).doi ?? "");
    if (!have || have !== want) return false;
    // (Optionally) return true here if you want doi to override all other filters
    // return true;
  }

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
      const want = PARSE_BOOL(raw);
      if (want && !(m as any)[def.field!]) return false;
    }

    if (def.kind === "stringEq") {
      if (!raw) continue;

      if (def.param === FILTER_DEFS.metal.param) {
        if (!containsMetalSymbol(m.metal_1 ?? "", raw)) return false;
      } else {
        if (String((m as any)[def.field!]) !== raw) return false;
      }
    }

    if (def.kind === "numberMin") {
      const min = PARSE_NUMBER(raw);
      if (min != null && Number((m as any)[def.field!] ?? 0) < min) return false;
    }

    if (def.kind === "numberMax") {
      const max = PARSE_NUMBER(raw);
      if (max != null && Number((m as any)[def.field!] ?? 0) > max) return false;
    }
  }

  return true;
}

async function loadAllMofs(): Promise<any[]> {
  const now = Date.now();
  if (cachedData && now - cachedAt < CACHE_TTL_MS) return cachedData;

  const Bucket = process.env.MOF_BUCKET!;
  const Key = process.env.MOF_KEY!;

  const obj = await s3.send(new GetObjectCommand({ Bucket, Key }));
  const jsonText = await STREAM_TO_STRING(obj.Body);
  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed)) throw new Error("MOF JSON is not an array");
  cachedData = parsed;
  cachedAt = now;
  return parsed;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const all = await loadAllMofs();

    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize") ?? "9")));

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
