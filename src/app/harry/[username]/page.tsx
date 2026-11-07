import { getSteamUserData } from "../lib/steam";
import Image from "next/image";

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function SteamProfilePage({ params }: PageProps) {
  const { username } = await params;
  const userData = await getSteamUserData(username);

  if (!userData) {
    return (
      <main className="p-8 max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-bold text-red-500">Profile Not Found</h1>
        <p className="mt-2 text-gray-600">
          Could not find a public Steam user with the identifier &quot;{username}&quot;. Check that the profile and game details are set to public.
        </p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Image 
          src={userData.avatarUrl} 
          alt={userData.username} 
          width={80} 
          height={80} 
          className="rounded-full"
        />
        <div>
          <h1 className="text-3xl font-bold">{userData.username}</h1>
          <p className="text-sm text-gray-500">Steam ID: {userData.steamId}</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">Most Played Games</h2>
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
    </main>
  );
}