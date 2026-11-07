import { getMostPlayedGameIds } from "../harry/sharedlib/most-played";

export default async function Home() {
  const steamId = "76561198400563010";
  const jsonResponse = await getMostPlayedGameIds(steamId, 5);

  return (
    <main>
      <h1>Most Played Game IDs</h1>
        {JSON.stringify(JSON.parse(jsonResponse), null, 2)}
    </main>
  );
}