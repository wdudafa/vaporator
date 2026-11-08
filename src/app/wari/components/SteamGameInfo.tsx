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
  price_overview?: { final_formatted?: string };
  is_free?: boolean;
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
  metacritic?: { score: number; url?: string };
};
type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; game: SteamGame };

export default function SteamGameInfo({ appid }: { appid: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
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
        // Steam descriptions may contain HTML; display their text safely.
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
  const platforms = Object.entries(game.platforms ?? {})
    .filter(([, available]) => available)
    .map(
      ([platform]) =>
        ({ windows: "Windows", mac: "macOS", linux: "Linux" })[platform],
    )
    .filter(Boolean);
  return (
    <section aria-label="Steam game info" className="steam-game-info">
      {game.header_image && (
        <Image
          src={game.header_image}
          alt={`${game.name} cover`}
          width={460}
          height={215}
          unoptimized
          className="game-info-image"
        />
      )}
      <h3 className="text-base font-semibold">{game.name}</h3>
      {game.short_description && (
        <p className="game-description">{game.short_description}</p>
      )}
      {game.genres?.length ? (
        <p className="game-genres">
          {game.genres.map((genre) => genre.description).join(" · ")}
        </p>
      ) : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
        <dt>Price</dt>
        <dd>
          {game.is_free
            ? "Free to play"
            : game.price_overview?.final_formatted || "See Steam store"}
        </dd>
        {game.developers?.length ? (
          <>
            <dt>Developer</dt>
            <dd>{game.developers.join(", ")}</dd>
          </>
        ) : null}
        {game.publishers?.length ? (
          <>
            <dt>Publisher</dt>
            <dd>{game.publishers.join(", ")}</dd>
          </>
        ) : null}
        {game.release_date?.date && (
          <>
            <dt>{game.release_date.coming_soon ? "Expected" : "Released"}</dt>
            <dd>{game.release_date.date}</dd>
          </>
        )}
        {platforms.length > 0 && (
          <>
            <dt>Platforms</dt>
            <dd>{platforms.join(" · ")}</dd>
          </>
        )}
        {game.metacritic && (
          <>
            <dt>Metacritic</dt>
            <dd>{game.metacritic.score}/100</dd>
          </>
        )}
      </dl>
      {game.categories?.length ? (
        <p className="text-muted">
          {game.categories.map((category) => category.description).join(" · ")}
        </p>
      ) : null}
      {storeLink}
    </section>
  );
}
