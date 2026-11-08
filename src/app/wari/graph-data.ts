import { positionColor } from "@/lib/position-color";
import { Table, tableFromIPC, vectorFromArray, Utf8 } from "apache-arrow";
import type { ConnectionData } from "./components/Connections";
import { mapLandmarks } from "./map-landmarks";

export type ConnectionDetail = {
  title: string;
  kind: "Game similarity" | "Recommendation" | "Blend";
  description: string;
  similarity?: number;
  games: { appid: number; name: string; weight?: number; minutes?: number }[];
  matches?: { appid: number; name: string; similarity: number }[];
};
export type GraphSelection = {
  title: string;
  roles: string[];
  appid?: string;
  description?: string;
  connections: ConnectionDetail[];
};

export function prepareGraph(
  coordinates: ArrayBuffer,
  data: ConnectionData | null,
) {
  const table = tableFromIPC(coordinates);
  const ids: string[] = [];
  const x: number[] = [],
    y: number[] = [],
    z: number[] = [];
  for (let i = 0; i < table.numRows; i++) {
    ids.push(String(table.getChild("appid")!.get(i)));
    x.push(Number(table.getChild("x")!.get(i)));
    y.push(Number(table.getChild("y")!.get(i)));
    z.push(Number(table.getChild("z")!.get(i)));
  }
  const indices = new Map(ids.map((id, index) => [id, index]));
  // Highlights and recommendations use the full map coordinates.
  // API projections are fitted to a different set of games and cannot be mixed in.
  const labels = ids.map(() => "");
  const colors: string[] = ids.map((_, index) => positionColor(x[index], y[index], z[index]));
  const sizes: number[] = ids.map(() => 3);
  const sources: number[] = [],
    targets: number[] = [],
    linkColors: string[] = [];
  const widths: number[] = [],
    styles: number[] = [];
  const missing = new Set<string>();
  const nodeDetails = new Map<number, GraphSelection>();
  const linkDetails: ConnectionDetail[] = [];
  const sourceGames = new Map(data?.basedOn.map((game) => [game.appid, game]));
  const names = new Map(data?.basedOn.map((game) => [game.appid, game.name]));

  function highlight(
    id: number,
    name: string,
    role: string,
    label: string,
    color: string,
    size: number,
  ) {
    const index = indices.get(String(id));
    if (index === undefined) {
      missing.add(name);
      return;
    }
    const existing = nodeDetails.get(index);
    if (existing) {
      if (!existing.roles.includes(role)) existing.roles.push(role);
    } else
      nodeDetails.set(index, {
        title: name,
        roles: [role],
        appid: String(id),
        connections: [],
      });
    // Retain the source label when a game has several roles.
    if (!labels[index] || !names.has(id)) labels[index] = label;
    if (size >= sizes[index]) {
      colors[index] = color;
      sizes[index] = size;
    }
  }
  function marker(
    id: string,
    label: string,
    position: number[],
    detail: ConnectionDetail,
  ) {
    const index = ids.length;
    ids.push(id);
    x.push(position[0]);
    y.push(position[1]);
    z.push(position[2]);
    labels.push(label);
    colors.push("#66c0f4");
    sizes.push(8);
    indices.set(id, index);
    nodeDetails.set(index, {
      title: detail.title,
      roles: ["Blend position"],
      connections: [detail],
    });
    return index;
  }
  function edge(
    source: number,
    target: number,
    color: string,
    width: number,
    style: number,
    detail: ConnectionDetail,
  ) {
    if (source === target) return;
    sources.push(source);
    targets.push(target);
    linkColors.push(color);
    widths.push(width);
    styles.push(style);
    linkDetails.push(detail);
    const related = new Set([
      source,
      target,
      ...detail.games.flatMap((game) => {
        const index = indices.get(String(game.appid));
        return index === undefined ? [] : [index];
      }),
    ]);
    for (const index of related) {
      const selection = nodeDetails.get(index);
      if (selection && !selection.connections.includes(detail))
        selection.connections.push(detail);
    }
  }

  if (data) {
    data.basedOn.forEach((game) =>
      highlight(
        game.appid,
        game.name,
        `Most played · ${(game.minutes / 60).toFixed(1)} hours`,
        `${game.name} · ${(game.minutes / 60).toFixed(1)}h`,
        "#66c0f4",
        18,
      ),
    );
    data.picks.forEach((game) =>
      highlight(
        game.appId,
        game.name,
        "Overall recommendation",
        game.name,
        "#a4d007",
        14,
      ),
    );
    data.connections.groups.forEach((group) => {
      group.matches.forEach((game, i) =>
        highlight(
          game.appid,
          game.name,
          `${group.appids.map((id) => names.get(id)).join(" + ")} recommendation #${i + 1}`,
          game.name,
          i === 0 ? "#a4d007" : "#8f98a0",
          i === 0 ? 16 : 12,
        ),
      );
    });
    // These are the direct A–B, A–C and B–C edges, never routed through blends.
    for (const pair of data.connections.pairs) {
      const a = indices.get(String(pair.source.appid));
      const b = indices.get(String(pair.target.appid));
      if (a === undefined || b === undefined) continue;
      const detail: ConnectionDetail = {
        title: `${pair.source.name} / ${pair.target.name}`,
        kind: "Game similarity",
        description:
          "Direct cosine similarity between your two most played games.",
        similarity: pair.similarity,
        games: [pair.source, pair.target],
      };
      edge(a, b, "#66c0f4", 2, 0, detail);
    }
    for (const group of data.connections.groups) {
      const members = group.appids.map((id) => indices.get(String(id)));
      if (members.some((index) => index === undefined)) continue;
      const position = [x, y, z].map((axis) =>
        members.reduce<number>(
          (sum, index, i) => sum + axis[index!] * group.weights[i],
          0,
        ),
      );
      const title = group.appids.length > 3
        ? `${group.appids.length} selected games`
        : group.appids.map((id) => names.get(id)).join(" + ");
      const games = group.appids.map((id, i) => {
        const game = sourceGames.get(id)!;
        return {
          appid: id,
          name: game.name,
          minutes: game.minutes,
          weight: group.weights[i],
        };
      });
      const blendDetail: ConnectionDetail = {
        title: `${title} blend`,
        kind: "Blend",
        description: data.connections.weighted
          ? "Playtime-weighted blend of the selected games."
          : "Equal blend of the selected games.",
        games,
        matches: group.matches,
      };
      const blendLabel = games.length > 3
        ? `Blend of ${games.length} games`
        : games.map((game) => `${game.name} ${(game.weight * 100).toFixed(0)}%`).join(" / ");
      const blend = marker(
        `blend:${group.appids.join(":")}`,
        blendLabel,
        position,
        blendDetail,
      );
      // No source-to-blend spokes: those overlapped the direct pair edges.
      const best = group.matches[0];
      const target = best && indices.get(String(best.appid));
      if (target !== undefined) {
        edge(blend, target, "#a4d007", 1.5, 1, {
          title: `${title} / ${best.name}`,
          kind: "Recommendation",
          description: `Recommendation #1 for this ${data.connections.weighted ? "playtime-weighted" : "equal"} blend.`,
          similarity: best.similarity,
          games,
          matches: [best],
        });
      }
    }
  }
  for (const landmark of mapLandmarks) {
    highlight(landmark.appid, landmark.name, landmark.label,
      `${landmark.label} · ${landmark.name}`, landmark.color, 20);
    const index = indices.get(String(landmark.appid));
    if (index !== undefined) {
      // Keep statistical labels visible even if the game is also a recommendation.
      labels[index] = `${landmark.label} · ${landmark.name}`;
      nodeDetails.get(index)!.description = landmark.description;
    }
  }
  const strings = (values: string[]) => vectorFromArray(values, new Utf8());
  const numbers = (values: number[]) =>
    vectorFromArray(Float32Array.from(values));
  return {
    points: new Table({
      appid: strings(ids),
      index: vectorFromArray(Uint32Array.from(ids.keys())),
      x: numbers(x),
      y: numbers(y),
      z: numbers(z),
      label: strings(labels),
      color: strings(colors),
      size: numbers(sizes),
    }),
    links: sources.length
      ? new Table({
          sourceId: strings(sources.map((index) => ids[index])),
          targetId: strings(targets.map((index) => ids[index])),
          source: vectorFromArray(Uint32Array.from(sources)),
          target: vectorFromArray(Uint32Array.from(targets)),
          color: strings(linkColors),
          width: numbers(widths),
          style: numbers(styles),
        })
      : undefined,
    sizes,
    missing: [...missing],
    labelIds: [...nodeDetails.keys()].map((index) => ids[index]),
    nodeDetails,
    linkDetails,
  };
}
