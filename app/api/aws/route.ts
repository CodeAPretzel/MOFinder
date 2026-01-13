import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs"; // ensure Node runtime

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function streamToString(stream: any): Promise<string> {
  // AWS SDK v3 in Node provides transformToString on Body in many environments
  if (stream?.transformToString) return await stream.transformToString();
  // Fallback:
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf-8");
}

export async function GET() {
  const Bucket = process.env.MOF_BUCKET!;
  const Key = process.env.MOF_KEY!;

  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket, Key }));
    const jsonText = await streamToString(obj.Body);

    // Return with caching
    return new NextResponse(jsonText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // cache at CDN for 5 min, allow stale while revalidate
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to load MOF dataset from S3", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
