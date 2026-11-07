"use client";

import SteamGameInfo from "./SteamGameInfo";
import type { GraphSelection } from "../graph-data";

export default function ConnectionDetails({ selection, onClose }: { selection: GraphSelection; onClose: () => void }) {
  return <aside aria-label="Selected connection details" style={{ position: "absolute", zIndex: 3, top: 52, right: 12,
    width: 350, maxWidth: "calc(100vw - 24px)", maxHeight: "calc(100vh - 170px)", overflow: "auto",
    background: "#101a2bf5", border: "1px solid #405570", borderRadius: 8, padding: 18 }}>
    <button onClick={onClose} className="float-right rounded bg-slate-700 px-2 py-1" aria-label="Close connection details">Close</button>
    <h2 className="text-lg font-semibold pr-14">{selection.title}</h2>
    {selection.roles.map(role => <p key={role} className="text-sm text-teal-300 mt-2">{role}</p>)}
    {selection.appid && <SteamGameInfo key={selection.appid} appid={selection.appid} />}
    {selection.connections.length === 0 && <p>No recommendation connections for this game.</p>}
    {selection.connections.map((detail, i) => <section key={i} className="border-t border-slate-600 mt-3 pt-3 text-sm">
      <p className="text-xs uppercase text-slate-400">{detail.kind}</p>
      <h3 className="font-semibold mt-1">{detail.title}</h3>
      <p className="text-slate-300 my-2">{detail.description}</p>
      {detail.similarity !== undefined && <p className="text-lg text-teal-300">Cosine similarity: {detail.similarity.toFixed(4)}</p>}
      <ul className="my-2 space-y-1">{detail.games.map(game => <li key={game.appid}>
        {game.name}{game.weight !== undefined && <strong> · {(game.weight * 100).toFixed(1)}% of blend</strong>}
        {game.minutes !== undefined && <span className="text-slate-400"> · {(game.minutes / 60).toFixed(1)}h played</span>}
      </li>)}</ul>
      {detail.matches?.length ? <><p className="text-slate-400">Recommended games</p><ul>{detail.matches.map(match => <li key={match.appid} className="mt-1">
        <a className="text-pink-300 underline" href={`https://store.steampowered.com/app/${match.appid}/`} target="_blank" rel="noreferrer">{match.name}</a> · {match.similarity.toFixed(4)}
      </li>)}</ul></> : null}
    </section>)}
  </aside>;
}
