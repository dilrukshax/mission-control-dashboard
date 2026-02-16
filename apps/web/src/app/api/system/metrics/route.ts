import { NextResponse } from "next/server";

const API_BASE = process.env.MC_API_BASE ?? "http://127.0.0.1:3001";
const API_KEY = process.env.MC_API_KEY;

export const dynamic = "force-dynamic";

export async function GET() {
  const headers: HeadersInit = API_KEY ? { "x-mc-key": API_KEY } : {};
  const res = await fetch(`${API_BASE}/api/system/metrics`, {
    cache: "no-store",
    headers,
  });

  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "application/json";

  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": contentType },
  });
}
