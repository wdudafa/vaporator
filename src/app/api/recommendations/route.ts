import { NextRequest, NextResponse } from "next/server";
import { getSteamUserData } from "../../harry/lib/steam";

type SelectedGame = { appid: number; name: string; minutes: number };

async function recommend(games: SelectedGame[], weighted: boolean, extra: Record<string, unknown> = {}) {
  try {
    const apiUrl = process.env.GAMES_API_URL || "http://127.0.0.1:8000";
    const response = await fetch(`${apiUrl}/connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appids: games.map(game => game.appid), minutes: games.map(game => game.minutes), weighted }),
      signal: AbortSignal.timeout(60000),
    });
    const connections = await response.json();
    if (!response.ok) {
      const missing = connections.detail?.missing_appids;
      const error = Array.isArray(missing)
        ? `These games have no embeddings yet: ${missing.join(", ")}. Remove them and try again.`
        : `Connections unavailable: ${JSON.stringify(connections.detail ?? response.status)}`;
      return NextResponse.json({ error }, { status: response.status === 404 || response.status === 422 ? 422 : 502 });
    }
    const matches: { appid: number; name: string; similarity: number }[] =
      connections.groups.find((group: { appids: number[] }) => group.appids.length === games.length)?.matches ?? [];
    const picks = await Promise.all(matches.map(async game => {
      const details = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.appid}&cc=gb&l=english`, {
        next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000),
      }).then(r => r.ok ? r.json() : null).catch(() => null);
      const info = details?.[game.appid]?.data;
      return {
        appId: game.appid, name: game.name, similarity: game.similarity,
        image: info?.header_image, description: info?.short_description,
        tags: info?.genres?.map((genre: { description: string }) => genre.description),
        price: info?.is_free ? "Free" : info?.price_overview?.final_formatted || "See store",
        storeUrl: `https://store.steampowered.com/app/${game.appid}/`,
        reason: `Based on ${games.map(game => game.name).join(", ")}.`,
      };
    }));
    return NextResponse.json({ ...extra, connections, picks,
      basedOn: games.map(game => ({ ...game, hours: Math.round(game.minutes / 60) })) });
  } catch {
    return NextResponse.json({ error: "Unable to reach the game API. Please try again." }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");
  if (!username) return NextResponse.json({ error: "Enter a username." }, { status: 400 });
  try {
    const user = await getSteamUserData(username);
    if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (!user.mostPlayedGames.length) return NextResponse.json({ error: "private" }, { status: 422 });
    const game = (item: { appid: number; name: string; playtime_forever: number }) =>
      ({ appid: item.appid, name: item.name, minutes: item.playtime_forever });
    return recommend(user.mostPlayedGames.slice(0, 3).map(game), request.nextUrl.searchParams.get("weighted") === "true", {
      profile: { name: user.username, avatar: user.avatarUrl },
      availableGames: user.ownedGames.map(game),
    });
  } catch {
    return NextResponse.json({ error: "Steam profile lookup failed. You can still search for games below." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || !Array.isArray(body.games) || !body.games.length ||
      (body.weighted !== undefined && typeof body.weighted !== "boolean") ||
      !body.games.every((game: SelectedGame) => game && Number.isSafeInteger(game.appid) && game.appid > 0 &&
        typeof game.name === "string" && game.name.trim() && typeof game.minutes === "number" && Number.isFinite(game.minutes) && game.minutes >= 0)) {
    return NextResponse.json({ error: "Select at least one game with a valid app ID and playtime." }, { status: 422 });
  }
  if (new Set(body.games.map((game: SelectedGame) => game.appid)).size !== body.games.length) {
    return NextResponse.json({ error: "Select each game only once." }, { status: 422 });
  }
  return recommend(body.games, body.weighted ?? false);
}
