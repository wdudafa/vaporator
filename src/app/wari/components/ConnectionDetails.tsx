"use client";

import SteamGameInfo from "./SteamGameInfo";
import type { GraphSelection } from "../graph-data";

function toPercent(similarity: number): number {
  return Math.round(Math.min(1, Math.max(0, similarity)) * 100);
}

function matchLabel(percent: number): string {
  if (percent >= 85) return "Excellent match";
  if (percent >= 70) return "Strong match";
  if (percent >= 50) return "Decent match";
  return "Loose match";
}

function formatInfluence(weight: number): string {
  const percent = Math.round(weight * 100);
  return percent < 1 ? "Under 1% influence" : `${percent}% influence`;
}

function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min played`;
  const hours = minutes / 60;
  return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)} hours played`;
}

function humanizeKind(kind: string): string {
  const text = kind.replace(/[_-]+/g, " ").trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function MatchMeter({ similarity }: { similarity: number }) {
  const percent = toPercent(similarity);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{percent}% match</span>
        <span className="text-muted text-sm">{matchLabel(percent)}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${percent}% match`}
        className="h-2 w-full overflow-hidden rounded-full border"
      >
        <div className="h-full bg-current" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

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
      className="graph-panel graph-details max-h-full min-w-0 overflow-y-auto overflow-x-hidden break-words"
    >
      <button
        onClick={onClose}
        className="button button-secondary float-right"
        aria-label="Close connection details"
      >
        Close
      </button>

      <h2 className="text-lg font-semibold pr-14 break-words">
        {selection.title}
      </h2>

      {selection.roles.length > 0 && (
        <ul className="my-2 flex flex-wrap gap-2" aria-label="Roles">
          {selection.roles.map((role) => (
            <li
              key={role}
              className="connection-role rounded-full border px-2.5 py-0.5 text-sm"
            >
              {role}
            </li>
          ))}
        </ul>
      )}

      {selection.appid && (
        <SteamGameInfo key={selection.appid} appid={selection.appid} />
      )}

      {selection.connections.length === 0 && (
        <p className="text-muted">
          This game isn’t linked to any recommendations yet.
        </p>
      )}

      {selection.connections.map((detail, i) => (
        <section
          key={`${detail.kind}-${i}`}
          className="connection-detail mt-4 space-y-3"
        >
          <div>
            <p className="connection-detail-kind text-muted text-sm">
              {humanizeKind(detail.kind)}
            </p>
            <h3 className="font-semibold break-words">{detail.title}</h3>
          </div>

          {detail.description && <p>{detail.description}</p>}

          {detail.similarity !== undefined && (
            <div className="connection-score">
              <MatchMeter similarity={detail.similarity} />
            </div>
          )}

          {detail.games.length > 0 && (
            <div>
              <p className="text-sm font-medium">Based on these games</p>
              <ul className="my-1 space-y-1">
                {detail.games.map((game) => (
                  <li key={game.appid}>
                    <span>{game.name}</span>
                    {(game.weight !== undefined ||
                      game.minutes !== undefined) && (
                      <span className="text-muted block text-sm">
                        {[
                          game.weight !== undefined &&
                            formatInfluence(game.weight),
                          game.minutes !== undefined &&
                            formatPlaytime(game.minutes),
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail.matches?.length ? (
            <div>
              <p className="text-sm font-medium">Recommended games</p>
              <ul className="mt-1 space-y-2">
                {detail.matches.map((match) => {
                  const percent = toPercent(match.similarity);
                  return (
                    <li
                      key={match.appid}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <a
                        className="connection-game-link min-w-0 break-words"
                        href={`https://store.steampowered.com/app/${match.appid}/`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {match.name}
                      </a>
                      <span
                        className="shrink-0 whitespace-nowrap text-sm font-semibold"
                        title={matchLabel(percent)}
                      >
                        {percent}% match
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>
      ))}
    </aside>
  );
}