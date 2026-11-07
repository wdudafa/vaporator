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