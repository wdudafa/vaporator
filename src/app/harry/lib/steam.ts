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
}