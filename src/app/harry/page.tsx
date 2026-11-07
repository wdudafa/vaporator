import { getMostPlayedGameIds } from "../harry/sharedlib/most-played";

export default async function Home() {
  const steamId = "76561198400563010";
  const gameIds = await getMostPlayedGameIds(steamId, 5);

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Most Played Game IDs</h1>
      
      {gameIds.length === 0 ? (
        <p className="text-gray-500">
          No games found. Verify that the Steam ID is correct and that game details are set to public.
        </p>
      ) : (
        <ul className="space-y-2">
          {gameIds.map((id) => (
            <li 
              key={id} 
              className="p-3 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm"
            >
              AppID: {id}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}