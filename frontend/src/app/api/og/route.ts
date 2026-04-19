import { NextRequest, NextResponse } from "next/server";
import { fetchOgData } from "@/lib/og";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ image: null, description: null });
  const data = await fetchOgData(url);
  return NextResponse.json(data);
}
