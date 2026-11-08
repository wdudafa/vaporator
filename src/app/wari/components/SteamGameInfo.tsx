"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type SteamGame = {
  name: string;
  header_image?: string;
  short_description?: string;
  developers?: string[];
  publishers?: string[];
  genres?: { description: string }[];
  categories?: { description: string }[];
  release_date?: { coming_soon?: boolean; date?: string };
  price_overview?: {
    final_formatted?: string;
    initial_formatted?: string;
    discount_percent?: number;
  };
  is_free?: boolean;
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
  metacritic?: { score: number; url?: string };
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; game: SteamGame };

/**
 * Steam lists dozens of technical "categories". Only these answer questions a
 * player actually has ("Can I play it with friends? With a controller?").
 * Keys are Steam's labels; values are the plain-language wording we show.
 */
const FRIENDLY_FEATURES: Record<string, string> = {
  "Single-player": "Single-player",
  "Multi-player": "Multiplayer",
  "Online PvP": "Online versus",
  "Online Co-op": "Online co-op",
  "Co-op": "Co-op",
  "LAN Co-op": "Local network co-op",
  "Shared/Split Screen": "Split-screen",
  "Remote Play Together": "Remote Play Together",
  "Full controller support": "Full controller support",
  "Partial Controller Support": "Partial controller support",
  "Steam Achievements": "Achievements",
  "Steam Cloud": "Cloud saves",
  "Steam Workshop": "Mods (Workshop)",
  "VR Supported": "VR supported",
  "VR Only": "VR only",
};

const PLATFORM_LABELS: Record<string, string> = {
  windows: "Windows",
  mac: "Mac",
  linux: "Linux",
};

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function formatReleaseDate(release?: SteamGame["release_date"]): string | null {
  if (!release?.date) return release?.coming_soon ? "Not announced yet" : null;
  if (release.coming_soon) return `Coming ${release.date}`;

  const parsed = new Date(release.date.replace(",", ""));
  if (Number.isNaN(parsed.getTime())) return `Released ${release.date}`;
  return `Released ${parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`;
}

function describeScore(score: number): string {
  if (score >= 90) return "Universal acclaim";
  if (score >= 75) return "Generally favorable";
  if (score >= 50) return "Mixed reviews";
  return "Generally unfavorable";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-3">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function SteamGameInfo({ appid }: { appid: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    setExpanded(false);
    fetch(`/api/steam/${encodeURIComponent(appid)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Steam game info is unavailable.");
        const body = await response.json();
        const entry = body?.[appid];
        if (!entry?.success || !entry.data)
          throw new Error("No Steam store details found for this game.");
        const game: SteamGame = entry.data;

        if (game.short_description)
          game.short_description =
            new DOMParser().parseFromString(game.short_description, "text/html")
              .body.textContent ?? "";
        if (!controller.signal.aborted) setState({ status: "ready", game });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ status: "error", message: error.message });
      });
    return () => controller.abort();
  }, [appid]);

  const storeLink = (
    <a
      className="steam-store-link"
      href={`https://store.steampowered.com/app/${appid}/`}
      target="_blank"
      rel="noreferrer"
    >
      View on Steam
    </a>
  );

  if (state.status === "loading")
    return (
      <p role="status" className="text-muted">
        Loading Steam info…
      </p>
    );

  if (state.status === "error")
    return (
      <div>
        <p className="text-muted">{state.message}</p>
        {storeLink}
      </div>
    );

  const { game } = state;

  const discount = game.price_overview?.discount_percent ?? 0;
  let price: React.ReactNode;
  if (game.is_free) {
    price = "Free to play";
  } else if (game.price_overview?.final_formatted) {
    price =
      discount > 0 ? (
        <>
          <span className="font-semibold">
            {game.price_overview.final_formatted}
          </span>{" "}
          <span className="text-muted line-through">
            {game.price_overview.initial_formatted}
          </span>{" "}
          <span className="font-medium">({discount}% off)</span>
        </>
      ) : (
        game.price_overview.final_formatted
      );
  } else if (game.release_date?.coming_soon) {
    price = "Price not announced";
  } else {
    price = "Check the Steam store for pricing";
  }

  const release = formatReleaseDate(game.release_date);

  const developers = game.developers ?? [];
  const publishers = game.publishers ?? [];
  const sameMaker =
    developers.length > 0 &&
    developers.join("|") === publishers.join("|");

  const platforms = Object.entries(game.platforms ?? {})
    .filter(([, available]) => available)
    .map(([platform]) => PLATFORM_LABELS[platform])
    .filter(Boolean);

  const features = (game.categories ?? [])
    .map((category) => FRIENDLY_FEATURES[category.description])
    .filter((label): label is string => Boolean(label));

  const description = game.short_description ?? "";
  const isLongDescription = description.length > 220;

  return (
    <section aria-label="Steam game info" className="steam-game-info space-y-4">
      {game.header_image && (
        <Image
          src={game.header_image}
          alt={`${game.name} cover`}
          width={460}
          height={215}
          unoptimized
          className="game-info-image h-auto w-full rounded"
        />
      )}

      <div className="space-y-1">
        <h3 className="text-base font-semibold">{game.name}</h3>
        {(developers.length > 0 || release) && (
          <p className="text-muted text-sm">
            {developers.length > 0 && `By ${formatList(developers)}`}
            {developers.length > 0 && release && " · "}
            {release}
          </p>
        )}
      </div>

      {description && (
        <div>
          <p
            className={`game-description ${
              isLongDescription && !expanded ? "line-clamp-3" : ""
            }`}
          >
            {description}
          </p>
          {isLongDescription && (
            <button
              type="button"
              className="text-sm underline"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}

      {game.genres?.length ? (
        <ul className="game-genres flex flex-wrap gap-2" aria-label="Genres">
          {game.genres.map((genre) => (
            <li
              key={genre.description}
              className="rounded-full border px-2.5 py-0.5 text-sm"
            >
              {genre.description}
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="space-y-2 text-sm">
        <Row label="Price">{price}</Row>

        {platforms.length > 0 && (
          <Row label="Plays on">{formatList(platforms)}</Row>
        )}

        {features.length > 0 && (
          <Row label="Features">{features.join(", ")}</Row>
        )}

        {game.metacritic && (
          <Row label="Critic score">
            {game.metacritic.score} out of 100 ·{" "}
            {describeScore(game.metacritic.score)}
            {game.metacritic.url && (
              <>
                {" "}
                <a
                  href={game.metacritic.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Read reviews on Metacritic
                </a>
              </>
            )}
          </Row>
        )}

        {publishers.length > 0 && !sameMaker && (
          <Row label="Published by">{formatList(publishers)}</Row>
        )}
      </dl>

      {storeLink}
    </section>
  );
}