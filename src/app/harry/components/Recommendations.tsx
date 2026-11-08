"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Pick = {
  appId: number;
  name: string;
  image?: string;
  description?: string;
  tags?: string[];
  price: string;
  similarity: number;
  storeUrl: string;
};

export default function Recommendations({ steamId }: { steamId: string }) {
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/recommendations?username=${encodeURIComponent(steamId)}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load recommendations.");
        setPicks(data.picks);
        sessionStorage.setItem(`recommendations:${steamId}:false`, JSON.stringify(data));
      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [steamId, attempt]);

  return (
    <section className="recommendations" aria-labelledby="recommendations-title" aria-live="polite">
      <h3 id="recommendations-title" className="section-heading">Recommended for you</h3>
      <p className="text-muted">Based on your three most played games.</p>
      {!picks && !error && (
        <div className="recommendation-list" role="status" aria-label="Finding similar games">
          <div className="loading-skeleton" aria-hidden="true" />
        </div>
      )}
      {error && <div className="status-card recommendation-error" role="alert">
        <p>{error}</p>
        <button className="button button-secondary" onClick={() => { setPicks(null); setError(""); setAttempt(n => n + 1); }}>Try again</button>
      </div>}
      {picks?.length === 0 && <p>No recommendations found.</p>}
      {!!picks?.length && <Link
        href={`/wari/?username=${encodeURIComponent(steamId)}`}
        className="recommendation-link"
      >Visualize</Link>}
      <div className="recommendation-list">
        {picks?.map(game => (
          <article key={game.appId} className="recommendation-card">
            {game.image && (
              <Image
                src={game.image}
                alt={`${game.name} cover`}
                width={460}
                height={215}
                sizes="(max-width: 672px) calc(100vw - 64px), 608px"
                className="h-auto w-full"
              />
            )}
            <div className="recommendation-card-body">
              <div className="flex justify-between gap-4">
                <h4>{game.name}</h4>
                <span className="game-price shrink-0">{game.price}</span>
              </div>
              {game.description && <p>{game.description}</p>}
              {game.tags?.length ? <div className="game-tags">{game.tags.map(tag => <span key={tag}>{tag}</span>)}</div> : null}
              <p>Cosine similarity: {game.similarity.toFixed(3)}</p>
              <a href={game.storeUrl} target="_blank" rel="noreferrer" className="steam-store-link">View on Steam ↗</a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
