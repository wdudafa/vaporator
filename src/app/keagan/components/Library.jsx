import { useEffect, useState } from 'react';
import Ledger from './Ledger';
import PickCard from './PickCard';

export default function Library({ username, onReset }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/recommendations?username=${encodeURIComponent(username)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || 'unavailable');
        setData(body);
      })
      .catch((e) => setError(e.message));
  }, [username, attempt]);

  const retry = () => setAttempt((n) => n + 1);
  const picks = data?.picks ?? [];
  const pick = picks[index];
  const profile = data?.profile;

  return (
    <div className="page page--library">
      <header className="topbar">
        <span className="topbar__mark">vaporator</span>
        <div className="account">
          {profile?.avatar && <img className="account__avatar" src={profile.avatar} alt="" />}
          <span className="account__name">{profile?.name ?? username}</span>
          <button className="text-button" onClick={onReset}>
            Try another username
          </button>
        </div>
      </header>

      <main className="library">
        {!data && !error && (
          <p className="library__status">Reading {username}’s library and picking a game…</p>
        )}

        {error === 'not_found' && (
          <section className="library__empty">
            <h1>We couldn’t find a Steam profile called “{username}”.</h1>
            <p>
              Use the name at the end of your profile link, steamcommunity.com/id/yourname. Your
              display name only works if it’s the same.
            </p>
            <button className="primary-button" onClick={onReset}>
              Try another username
            </button>
          </section>
        )}

        {error === 'private' && (
          <section className="library__empty">
            <h1>{username}’s library is private, so there’s nothing to read yet.</h1>
            <p>
              On Steam, open your profile, choose Edit Profile, then Privacy Settings, and set both
              My profile and Game details to Public. Then check again.
            </p>
            <div className="actions">
              <button className="primary-button" onClick={retry}>
                Check again
              </button>
              <button className="ghost-button" onClick={onReset}>
                Try another username
              </button>
            </div>
          </section>
        )}

        {error && error !== 'not_found' && error !== 'private' && (
          <section className="library__empty">
            <h1>We could not get that library from Steam.</h1>
            <p>The Steam API may be down or busy. Wait a minute and try again.</p>
            <button className="primary-button" onClick={retry}>
              Try again
            </button>
          </section>
        )}

        {data && !pick && (
          <section className="library__empty">
            <h1>Not enough playtime to go on yet.</h1>
            <p>Play a few games for an hour or two, then come back for a recommendation.</p>
            <button className="primary-button" onClick={onReset}>
              Try another username
            </button>
          </section>
        )}

        {pick && (
          <>
            <div className="library__side">
              <h1 className="verdict">Try {pick.name} next.</h1>
              <p className="library__reason">{pick.reason}</p>

              <div className="actions">
                {pick.storeUrl && (
                  <a className="primary-button" href={pick.storeUrl} target="_blank" rel="noreferrer">
                    View on Steam
                  </a>
                )}
                {picks.length > 1 && (
                  <button
                    className="ghost-button"
                    onClick={() => setIndex((i) => (i + 1) % picks.length)}
                  >
                    Show another pick
                  </button>
                )}
              </div>

              <p className="library__count">
                Pick {index + 1} of {picks.length}, based on the {data.libraryCount} games in this
                library.
              </p>
            </div>

            <div className="library__main">
              <PickCard key={pick.appId} pick={pick} fresh />
              <Ledger title="Based on the most played" rows={data.basedOn} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}