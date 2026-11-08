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
    <main className="page-container">
      <h1 className="page-heading">Steam Profile Lookup</h1>

      <SteamSearchForm />

      {!username ? (
        <div className="profile-empty-state" aria-hidden="true" />
      ) : !userData ? (
        <div className="status-card" role="status">
          <h2 className="section-heading" style={{ marginTop: 0 }}>Profile Not Found</h2>
          <p className="text-muted">
            Could not find a public Steam user with &quot;{username}&quot;. Ensure the profile and game details are public.
          </p>
        </div>
      ) : (
        <div>
          <div className="surface-card profile-card">
            <Image
              src={userData.avatarUrl}
              alt={userData.username}
              width={80}
              height={80}
              className="profile-avatar"
            />
            <div>
              <h2 className="profile-name">{userData.username}</h2>
              <p className="text-muted">Steam ID: {userData.steamId}</p>
            </div>
          </div>

          <h3 className="section-heading">Most Played Games</h3>
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
          {userData.mostPlayedGames.length > 0 && <Recommendations key={userData.steamId} steamId={userData.steamId} />}
        </div>
      )}
    </main>
  );
}
