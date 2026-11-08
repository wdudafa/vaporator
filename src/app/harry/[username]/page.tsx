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
      <main className="page-container">
        <section className="status-card" role="status">
          <h1 className="page-heading">Profile Not Found</h1>
          <p className="text-muted">
          Could not find a public Steam user with the identifier &quot;{username}&quot;. Check that the profile and game details are set to public.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-container">
      <div className="surface-card profile-card">
        <Image
          src={userData.avatarUrl}
          alt={userData.username}
          width={80}
          height={80}
          className="profile-avatar"
        />
        <div>
          <h1 className="profile-name">{userData.username}</h1>
          <p className="text-muted">Steam ID: {userData.steamId}</p>
        </div>
      </div>

      <h2 className="section-heading">Most Played Games</h2>
      {userData.mostPlayedGames.length === 0 ? (
        <p className="text-muted">No games found or game details are set to private.</p>
      ) : (
        <ul className="game-list">
          {userData.mostPlayedGames.map((game) => {
            const hoursPlayed = (game.playtime_forever / 60).toFixed(1);
            return (
              <li key={game.appid}>
                <strong>{game.name}</strong>
                <span>{hoursPlayed} hours</span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}