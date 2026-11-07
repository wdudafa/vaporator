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
    <section className="mt-10" aria-labelledby="recommendations-title" aria-live="polite">
      <h3 id="recommendations-title" className="text-xl font-semibold mb-2">Recommended for you</h3>
      <p className="text-sm text-gray-500 mb-4">Based on your three most played games.</p>
      {!picks && !error && <p className="text-gray-500">Finding similar games…</p>}
      {error && <div role="alert">
        <p>{error}</p>
        <button className="mt-2 text-blue-600 underline" onClick={() => { setPicks(null); setError(""); setAttempt(n => n + 1); }}>Try again</button>
      </div>}
      {picks?.length === 0 && <p>No recommendations found.</p>}
      {!!picks?.length && <Link
        href={`/wari/?username=${encodeURIComponent(steamId)}`}
        className="mb-6 inline-block rounded bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
      >Visualize</Link>}
      <div className="space-y-5">
        {picks?.map(game => (
          <article key={game.appId} className="overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-800 shadow-sm">
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
            <div className="p-4 space-y-3">
              <div className="flex justify-between gap-4">
                <h4 className="text-lg font-semibold">{game.name}</h4>
                <span className="shrink-0">{game.price}</span>
              </div>
              {game.description && <p className="text-sm text-gray-600 dark:text-gray-300">{game.description}</p>}
              {game.tags?.length ? <p className="text-sm text-gray-500">{game.tags.join(" · ")}</p> : null}
              <p className="text-sm text-gray-500">Cosine similarity: {game.similarity.toFixed(3)}</p>
              <a href={game.storeUrl} target="_blank" rel="noreferrer" className="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">View on Steam ↗</a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
