"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export type ConnectionData = {
  basedOn: { appid: number; name: string; minutes: number; hours: number }[];
  picks: { appId: number; name: string; similarity: number }[];
  connections: {
    weighted: boolean;
    layout?: { appid: number; x: number; y: number; z: number }[];
    pairs: {
      source: { appid: number; name: string };
      target: { appid: number; name: string };
      similarity: number;
    }[];
    groups: {
      appids: number[];
      weights: number[];
      matches: { appid: number; name: string; similarity: number }[];
    }[];
  };
};

type SelectedGame = { appid: number; name: string; minutes: number };
type SearchGame = { appid: number; name: string };

const subscribeToLocation = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};
const getUsername = () => new URLSearchParams(window.location.search).get("username");

export default function Connections({ onData }: { onData: (data: ConnectionData) => void }) {
  const [data, setData] = useState<ConnectionData | null>(null);
  const [selected, setSelected] = useState<SelectedGame[]>([]);
  const [library, setLibrary] = useState<SelectedGame[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchGame[]>([]);
  const [weighted, setWeighted] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileDone, setProfileDone] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const username = useSyncExternalStore(subscribeToLocation, getUsername, () => null);

  useEffect(() => {
    if (!username) return;
    const controller = new AbortController();
    pending.current?.abort();
    pending.current = controller;
    fetch(`/api/recommendations?username=${encodeURIComponent(username)}`, { signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load connections");
        if (controller.signal.aborted) return;
        setError("");
        setLibrary(body.availableGames ?? body.basedOn);
        setSelected(body.basedOn);
        setWeighted(false);
        setData(body);
        onData(body);
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setProfileDone(username); });
    return () => controller.abort();
  }, [username, onData]);

  useEffect(() => () => pending.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    const text = query.trim();
    if (text.length < 2) return () => controller.abort();
    const timer = setTimeout(() => {
      fetch(`/api/games?q=${encodeURIComponent(text)}`, { signal: controller.signal })
        .then(async response => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "Game search failed");
          if (!controller.signal.aborted) setResults(body);
        })
        .catch(cause => { if (!controller.signal.aborted) setSearchError(cause.message); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  function add(games: SearchGame[]) {
    setSelected(current => {
      const next = new Map(current.map(game => [game.appid, game]));
      for (const game of games) if (!next.has(game.appid)) {
        next.set(game.appid, library.find(owned => owned.appid === game.appid) ?? { ...game, minutes: 0 });
      }
      return [...next.values()];
    });
  }

  async function apply() {
    if (!selected.length) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ games: selected, weighted }), signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load connections");
      if (!controller.signal.aborted) { setData(body); onData(body); }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load connections");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }

  const busy = loading || Boolean(username && profileDone !== username);
  const matchingLibrary = library.filter(game => !query.trim() || game.name.toLowerCase().includes(query.trim().toLowerCase()) || String(game.appid) === query.trim());
  const selectedIds = new Set(selected.map(game => game.appid));
  const choices = [...new Map([...matchingLibrary, ...results].map(game => [game.appid, game])).values()].filter(game => !selectedIds.has(game.appid)).slice(0, 20);

  return (
    <section aria-label="Your game connections" className="graph-panel graph-overlay">
      <Link href="/harry/" className="text-muted">← Steam profile</Link>
      <h1 className="section-heading">Choose your games</h1>
      <label className="block text-sm" htmlFor="connection-game-search">Search games by name or app ID</label>
      <input id="connection-game-search" type="search" value={query} onChange={event => {
        setQuery(event.target.value);
        setResults([]);
        setSearchError("");
        setSearching(event.target.value.trim().length >= 2);
      }} placeholder="Search the game catalogue…" className="my-2 w-full rounded border p-2 text-sm" />
      {searching && <p role="status" className="text-sm">Searching…</p>}
      {searchError && <p role="alert" className="text-sm">{searchError}</p>}
      {choices.length > 0 && <ul className="connection-games max-h-40 overflow-auto" aria-label="Available games">
        {choices.map(game => <li key={game.appid} className="flex items-center justify-between gap-2">
          <span>{game.name}</span><button type="button" className="button button-secondary" onClick={() => add([game])} aria-label={`Add ${game.name}`}>Add</button>
        </li>)}
      </ul>}
      {!searching && !searchError && query.trim().length >= 2 && !choices.length && <p className="text-muted text-sm">No unselected games found.</p>}
      {matchingLibrary.length > 0 && <button type="button" className="button button-secondary text-sm" onClick={() => add(matchingLibrary)}>Add all {query.trim() ? "matching " : ""}library games ({matchingLibrary.length})</button>}
      <div className="my-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Selected ({selected.length})</h2>
        {selected.length > 0 && <button type="button" className="text-sm underline" onClick={() => setSelected([])}>Clear</button>}
      </div>
      <ul className="connection-games max-h-48 overflow-auto" aria-label="Selected games">
        {selected.map(game => <li key={game.appid} className="border-b pb-2">
          <div className="flex items-center justify-between gap-2"><span>{game.name}</span><button type="button" className="text-sm underline" aria-label={`Remove ${game.name}`} onClick={() => setSelected(current => current.filter(item => item.appid !== game.appid))}>Remove</button></div>
          {weighted && <label className="mt-1 flex items-center gap-2">Hours played<input type="number" min="0" step="0.1" value={Number((game.minutes / 60).toFixed(1))} className="w-20 rounded border p-1" onChange={event => {
            const hours = Number(event.target.value);
            if (Number.isFinite(hours) && hours >= 0) setSelected(current => current.map(item => item.appid === game.appid ? { ...item, minutes: hours * 60 } : item));
          }} /></label>}
        </li>)}
      </ul>
      <label className="connection-weight"><input type="checkbox" checked={weighted} onChange={event => setWeighted(event.target.checked)} />Weight by playtime</label>
      <button type="button" className="button" disabled={busy || selected.length === 0} onClick={() => void apply()}>{busy ? "Finding connections…" : "Show connections"}</button>
      {selected.length > 3 && <p className="text-muted mt-2 text-xs">All selected games contribute to one combined blend.</p>}
      {error && <p role="alert">{error}</p>}
      {data && <p className="text-muted mt-2 text-xs">Showing connections for {data.basedOn.length} games.</p>}
      <p className="connection-key similarity-key">Game similarity</p>
      <p className="connection-key closest-key">Closest recommendations</p>
      <p className="connection-key other-key">Other recommendations</p>
    </section>
  );
}
