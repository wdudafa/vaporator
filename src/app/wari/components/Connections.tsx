"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

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

const subscribeToLocation = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};
const getUsername = () =>
  new URLSearchParams(window.location.search).get("username");

export default function Connections({
  onData,
}: {
  onData: (data: ConnectionData) => void;
}) {
  const [data, setData] = useState<ConnectionData | null>(null);
  const [weighted, setWeighted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const username = useSyncExternalStore(
    subscribeToLocation,
    getUsername,
    () => null,
  );
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
        const response = await fetch(
          `/api/recommendations?username=${encodeURIComponent(username!)}&weighted=${weighted}`,
          { signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Unable to load connections");
        result = body;
        sessionStorage.setItem(key, JSON.stringify(result));
      }
      if (!controller.signal.aborted) {
        setData(result);
        onData(result);
        setLoading(false);
      }
    }
    void load().catch((cause) => {
      if (!controller.signal.aborted) {
        setError(cause.message);
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [username, weighted, onData]);

  if (!username) return null;
  return (
    <section
      aria-label="Your game connections"
      className="graph-panel graph-overlay"
    >
      <Link href="/harry/" className="text-muted">
        ← Steam profile
      </Link>
      <h1 className="section-heading">Your game connections</h1>
      <p className="connection-key similarity-key">Game similarity</p>
      <p className="connection-key closest-key">Closest recommendations</p>
      <p className="connection-key other-key">Other recommendations</p>
      {data && (
        <ul className="connection-games">
          {data.basedOn.map((game) => (
            <li key={game.appid}>
              {game.name} · {(game.minutes / 60).toFixed(1)}h
            </li>
          ))}
        </ul>
      )}
      <label className="connection-weight">
        <input
          type="checkbox"
          checked={weighted}
          onChange={(event) => {
            setLoading(true);
            setError("");
            setWeighted(event.target.checked);
          }}
        />{" "}
        Weight by playtime
      </label>
      {loading && <p role="status">Finding connections…</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
