import { NextRequest, NextResponse } from "next/server";
import { getSteamUserData } from "../../harry/lib/steam";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");
  if (!username) return NextResponse.json({ error: "Enter a username." }, { status: 400 });

  let stage = "Steam profile lookup";
  try {
    const user = await getSteamUserData(username);
    if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!user.mostPlayedGames.length) return NextResponse.json({ error: "private" }, { status: 422 });

    const games = user.mostPlayedGames.slice(0, 3);
    const apiUrl = (process.env.GAMES_API_URL || "http://127.0.0.1:8000");
    stage = `Game API at ${apiUrl}`;
    const response = await fetch(`${apiUrl}/similar?limit=3`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(games.map(game => game.appid)),
      //signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error("Game API failed", response.status, body);
      const missing = body.detail?.missing_appids;
      return NextResponse.json({ error: missing
        ? `Games missing from the similarity database: ${missing.join(", ")}.`
        : `Game API returned HTTP ${response.status}: ${JSON.stringify(body.detail ?? "Unknown error")}` }, { status: 502 });
    }
    const matches: { appid: number; name: string; similarity: number }[] = await response.json();
    const picks = await Promise.all(matches.map(async game => {
      const details = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.appid}&cc=gb&l=english`, {
        next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000),
      }).then(r => r.ok ? r.json() : null).catch(() => null);
      const info = details?.[game.appid]?.data;
      return {
        appId: game.appid, name: game.name, similarity: game.similarity,
        image: info?.header_image,
        description: info?.short_description,
        tags: info?.genres?.map((genre: { description: string }) => genre.description),
        price: info?.is_free ? "Free" : info?.price_overview?.final_formatted || "See store",
        storeUrl: `https://store.steampowered.com/app/${game.appid}/`,
        reason: `Based on ${games.map(game => game.name).join(", ")}.`,
      };
    }));
    return NextResponse.json({
      profile: { name: user.username, avatar: user.avatarUrl }, picks,
      basedOn: games.map(game => ({ name: game.name, hours: Math.round(game.playtime_forever / 60) })),
    });
  } catch (error) {
    console.error(`${stage} failed`, error);
    const cause = (error as { cause?: { code?: string } })?.cause?.code;
    return NextResponse.json({ error: `${stage} failed: ${cause || (error instanceof Error ? error.message : "Unknown error")}` }, { status: 503 });
  }
}
