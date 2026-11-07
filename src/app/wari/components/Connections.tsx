"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

export type ConnectionData = {
  basedOn: { appid: number; name: string; minutes: number; hours: number }[];
  picks: { appId: number; name: string; similarity: number }[];
  connections: {
    weighted: boolean;
    layout?: { appid: number; x: number; y: number; z: number }[];
    pairs: { source: { appid: number; name: string }; target: { appid: number; name: string }; similarity: number }[];
    groups: { appids: number[]; weights: number[]; matches: { appid: number; name: string; similarity: number }[] }[];
  };
};

const subscribeToLocation = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};
const getUsername = () => new URLSearchParams(window.location.search).get("username");

export default function Connections({ onData }: { onData: (data: ConnectionData) => void }) {
  const [data, setData] = useState<ConnectionData | null>(null);
  const [weighted, setWeighted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const username = useSyncExternalStore(subscribeToLocation, getUsername, () => null);
  useEffect(() => {
    if (!username) return;
    const controller = new AbortController();
    async function load() {
      const key = `recommendations:${username}:${weighted}`;
      let result: ConnectionData;
      const stored = sessionStorage.getItem(key);
      const cached = stored ? JSON.parse(stored) : null;
      if (cached?.connections?.layout) result = cached;
      else {
        const response = await fetch(`/api/recommendations?username=${encodeURIComponent(username!)}&weighted=${weighted}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load connections");
        result = body;
        sessionStorage.setItem(key, JSON.stringify(result));
      }
      if (!controller.signal.aborted) { setData(result); onData(result); setLoading(false); }
    }
    void load().catch(cause => { if (!controller.signal.aborted) { setError(cause.message); setLoading(false); } });
    return () => controller.abort();
  }, [username, weighted, onData]);

  if (!username) return null;
  return <section aria-label="Your game connections" style={{ position: "absolute", top: 52, left: 12, width: 290, maxWidth: "calc(100vw - 24px)", maxHeight: "50vh", overflow: "auto", background: "#101a2bf2", borderRadius: 8, padding: 16 }}>
    <Link href="/harry/" className="underline">← Steam profile</Link>
    <h1 className="text-xl font-bold my-2">Your game connections</h1>
    <p style={{ color: "#79e2d1" }}>Game similarity</p>
    <p style={{ color: "#f472b6" }}>Closest recommendations</p>
    <p style={{ color: "#fbbf24" }}>Other recommendations</p>
    {data && <ul className="my-3 text-sm space-y-1">{data.basedOn.map(game => <li key={game.appid}>
      {game.name} · {(game.minutes / 60).toFixed(1)}h
    </li>)}</ul>}
    <label className="block my-3"><input type="checkbox" checked={weighted} onChange={event => { setLoading(true); setError(""); setWeighted(event.target.checked); }} /> Weight by playtime</label>
    {loading && <p role="status">Finding connections…</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
