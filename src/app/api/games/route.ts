import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);
  try {
    const apiUrl = process.env.GAMES_API_URL || "http://127.0.0.1:8000";
    const response = await fetch(`${apiUrl}/games?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return NextResponse.json({ error: "Game search unavailable. Please try again." }, { status: 502 });
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ error: "Unable to reach game search." }, { status: 503 });
  }
}
