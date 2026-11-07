const STEAM_API_KEY = process.env.STEAM_API_KEY;

export async function getMostPlayedGameIds(steamId: string, limit: number = 5): Promise<string> {
  if (!STEAM_API_KEY) {
    throw new Error("Steam API key is not configured in environment variables.");
  }

  const gamesRes = await fetch(
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`,
    { next: { revalidate: 300 } }
  );

  if (!gamesRes.ok) {
    return JSON.stringify({ steamId, gameIds: [] });
  }

  const gamesData = await gamesRes.json();
  const games = gamesData.response?.games || [];

  const gameIds: number[] = games
    .sort((a: any, b: any) => b.playtime_forever - a.playtime_forever)
    .slice(0, limit)
    .map((game: any) => game.appid);

  return JSON.stringify({ steamId, gameIds });
}