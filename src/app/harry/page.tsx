import { getSteamUserData } from "./lib/steam";
import SteamSearchForm from "./components/SteamSearchForm";
import Image from "next/image";
import Recommendations from "./components/Recommendations";

interface PageProps {
  searchParams: Promise<{ username?: string }>;
}

export default async function SteamProfilePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const username = params.username;

  const userData = username ? await getSteamUserData(username) : null;

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-6 text-center">Steam Profile Lookup</h1>
      
      <SteamSearchForm />

      {!username ? (
        <p className="text-center text-gray-500"></p>
      ) : !userData ? (
        <div className="text-center p-6 bg-red-50 dark:bg-red-950/30 rounded-lg">
          <h2 className="text-xl font-bold text-red-500">Profile Not Found</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Could not find a public Steam user with &quot;{username}&quot;. Ensure the profile and game details are public.
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg shadow-sm">
            <Image 
              src={userData.avatarUrl} 
              alt={userData.username} 
              width={80} 
              height={80} 
              className="rounded-full"
            />
            <div>
              <h2 className="text-2xl font-bold">{userData.username}</h2>
              <p className="text-sm text-gray-500">Steam ID: {userData.steamId}</p>
            </div>
          </div>

          <h3 className="text-xl font-semibold mb-4">Most Played Games</h3>
          {userData.mostPlayedGames.length === 0 ? (
            <p className="text-gray-500">No games found or game details are set to private.</p>
          ) : (
            <ul className="space-y-3">
              {userData.mostPlayedGames.map((game) => {
                const hoursPlayed = (game.playtime_forever / 60).toFixed(1);
                return (
                  <li key={game.appid} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm">
                    <span className="font-medium">{game.name}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{hoursPlayed} hours</span>
                  </li>
                );
              })}
            </ul>
          )}
          {userData.mostPlayedGames.length > 0 && <Recommendations key={userData.steamId} steamId={userData.steamId} />}
        </div>
      )}
    </main>
  );
}
