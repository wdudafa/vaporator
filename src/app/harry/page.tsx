import { getMostPlayedGameIds } from "../harry/sharedlib/most-played";

export default async function Home() {
  const steamId = "76561198400563010";
  const jsonResponse = await getMostPlayedGameIds(steamId, 5);

  return (
    <main className="p-8 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">Most Played Game IDs</h1>
      <pre className="p-4 bg-gray-900 text-green-400 rounded-lg overflow-x-auto font-mono text-sm">
        {JSON.stringify(JSON.parse(jsonResponse), null, 2)}
      </pre>
    </main>
  );
}