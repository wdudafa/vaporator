const STEAM_API_KEY = process.env.STEAM_API_KEY;

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
}

export interface SteamUserData {
  steamId: string;
  username: string;
  avatarUrl: string;
  mostPlayedGames: SteamGame[];
}

export async function getSteamUserData(identifier: string): Promise<SteamUserData | null> {
  if (!STEAM_API_KEY) {
    throw new Error("Steam API key is not configured in environment variables.");
  }

  let steamId = identifier;

  if (!/^\d{17}$/.test(identifier)) {
    const vanityRes = await fetch(
      `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(identifier)}`,
      { next: { revalidate: 3600 } }
    );
    const vanityData = await vanityRes.json();
    
    if (vanityData.response?.success === 1) {
      steamId = vanityData.response.steamid;
    } else {
      return null;
    }
  }

  const summaryRes = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamId}`,
    { next: { revalidate: 60 } }
  );
  const summaryData = await summaryRes.json();
  const player = summaryData.response?.players?.[0];

  if (!player) {
    return null;
  }

  const gamesRes = await fetch(
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`,
    { next: { revalidate: 300 } }
  );
  const gamesData = await gamesRes.json();
  const games: SteamGame[] = gamesData.response?.games || [];

  const mostPlayedGames = games
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, 5);

  return {
    steamId,
    username: player.personaname,
    avatarUrl: player.avatarfull,
    mostPlayedGames,
  };
}