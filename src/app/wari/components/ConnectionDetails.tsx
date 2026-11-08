"use client";

import SteamGameInfo from "./SteamGameInfo";
import type { GraphSelection } from "../graph-data";

export default function ConnectionDetails({
  selection,
  onClose,
}: {
  selection: GraphSelection;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="Selected connection details"
      className="graph-panel graph-details"
    >
      <button
        onClick={onClose}
        className="button button-secondary float-right"
        aria-label="Close connection details"
      >
        Close
      </button>
      <h2 className="text-lg font-semibold pr-14">{selection.title}</h2>
      {selection.roles.map((role) => (
        <p key={role} className="connection-role">
          {role}
        </p>
      ))}
      {selection.appid && (
        <SteamGameInfo key={selection.appid} appid={selection.appid} />
      )}
      {selection.connections.length === 0 && (
        <p>No recommendation connections for this game.</p>
      )}
      {selection.connections.map((detail, i) => (
        <section
          key={i}
          className="connection-detail"
        >
          <p className="connection-detail-kind">{detail.kind}</p>
          <h3>{detail.title}</h3>
          <p>{detail.description}</p>
          {detail.similarity !== undefined && (
            <p className="connection-score">
              Cosine similarity: {detail.similarity.toFixed(4)}
            </p>
          )}
          <ul className="my-2 space-y-1">
            {detail.games.map((game) => (
              <li key={game.appid}>
                {game.name}
                {game.weight !== undefined && (
                  <strong> · {(game.weight * 100).toFixed(1)}% of blend</strong>
                )}
                {game.minutes !== undefined && (
                  <span className="text-muted">
                    {" "}
                    · {(game.minutes / 60).toFixed(1)}h played
                  </span>
                )}
              </li>
            ))}
          </ul>
          {detail.matches?.length ? (
            <>
              <p className="text-muted">Recommended games</p>
              <ul>
                {detail.matches.map((match) => (
                  <li key={match.appid} className="mt-1">
                    <a
                      className="connection-game-link"
                      href={`https://store.steampowered.com/app/${match.appid}/`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {match.name}
                    </a>{" "}
                    · {match.similarity.toFixed(4)}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ))}
    </aside>
  );
}
