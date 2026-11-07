"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Cosmograph as Graph, CosmographConfig } from "@cosmograph/cosmograph";
import Connections, { type ConnectionData } from "./components/Connections";
import ConnectionDetails from "./components/ConnectionDetails";
import { prepareGraph, type GraphSelection } from "./graph-data";

type Controls = { graph: Graph; highlight: (indices: number[]) => void; resize: (size: number) => void };
const panel = "absolute z-10 rounded-md bg-[#101a2bd9] px-3 py-2 text-xs leading-[18px]";

export default function Home() {
  const hostRef = useRef<HTMLDivElement>(null);
  const controls = useRef<Controls | null>(null);
  const size = useRef(3);
  const [data, setData] = useState<ConnectionData | null>(null);
  const [status, setStatus] = useState("Loading coordinates…");
  const [error, setError] = useState(false);
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [nodeIds, setNodeIds] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const abort = new AbortController();
    let graph: Graph | null = null;
    const fail = (cause: unknown) => {
      if (abort.signal.aborted) return;
      setError(true);
      setStatus(cause instanceof Error ? cause.message : "Unable to load the graph.");
    };

    async function start(host: HTMLDivElement) {
      const [{ Cosmograph }, response] = await Promise.all([
        import("@cosmograph/cosmograph"), fetch("/will/data", { signal: abort.signal }),
      ]);
      if (!response.ok) throw new Error(`Could not load coordinates (${response.status}).`);
      const points = await response.arrayBuffer();
      if (abort.signal.aborted) return;
      const prepared = prepareGraph(points, data);
      let highlighted = new Set<number>();
      const pointSize = (_value: unknown, index?: number) => Math.max(
        index === undefined ? 3 : prepared.sizes[index] ?? 3,
        index !== undefined && highlighted.has(index) ? 12 : 0,
      );
      setSelection(null);
      setMessage(prepared.missing.length ? `Missing map coordinates: ${prepared.missing.join(", ")}` : "");

      const config: CosmographConfig = {
        points: prepared.points, links: prepared.links,
        pointIdBy: "appid", pointIndexBy: "index",
        pointXBy: "x", pointYBy: "y", pointZBy: "z",
        pointColorBy: "color", pointColorStrategy: "direct",
        pointSizeBy: "size", pointSizeByFn: pointSize, pointSizeScale: size.current / 3,
        pointSphereShading: true, pointDepthFade: 0.15,
        linkSourceBy: "sourceId", linkTargetBy: "targetId",
        linkSourceIndexBy: "source", linkTargetIndexBy: "target",
        linkColorBy: "color", linkColorStrategy: "direct",
        linkWidthBy: "width", linkWidthByFn: Number, linkStyleBy: "style", linkDefaultArrows: false,
        spaceDimensions: 3, enableSimulation: false, enableDrag: false,
        backgroundColor: "#080d18", pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        pointLabelBy: "label", showLabels: true, showLabelsFor: prepared.labelIds,
        showHoveredPointLabel: true, showUnselectedPointLabels: true,
        pointLabelColor: "#e6efff", pointLabelFontSize: 12,
        fitViewOnInit: true, fitViewDelay: 0, fitViewDuration: 0, fitViewPadding: 0.06,
        onLinkClick: index => {
          const detail = prepared.linkDetails[index];
          if (detail) setSelection({ title: detail.title, roles: [detail.kind], connections: [detail] });
        },
        onLinkMouseOver: () => { host.style.cursor = "pointer"; },
        onLinkMouseOut: () => { host.style.cursor = "default"; },
        onPointClick: index => {
          const details = prepared.nodeDetails.get(index);
          if (details) return setSelection(details);
          const appid = String(prepared.points.getChild("appid")?.get(index));
          if (!/^\d+$/.test(appid)) return;
          graph?.selectPoints([index], false, false);
          controls.current?.highlight([index]);
          setSelection({ title: "Game details", appid, roles: [], connections: [] });
        },
        onGraphRebuilt: ({ pointsCount }) => {
          if (abort.signal.aborted) return;
          setError(false);
          setStatus(`${pointsCount.toLocaleString()} nodes · ${prepared.links?.numRows ?? 0} connections${data?.connections.layout ? " · 3D projection; cosine scores in details" : ""}`);
        },
        onGraphRebuildError: fail,
      };
      const instance = new Cosmograph(host, config);
      graph = instance;
      function update(patch: CosmographConfig) {
        if (abort.signal.aborted) return;
        Object.assign(config, patch);
        void instance.setConfig({ ...config }).catch(fail);
      }
      controls.current = {
        graph: instance,
        highlight: indices => {
          highlighted = new Set(indices);
          // A new accessor tells Cosmograph to recalculate sizes after selection.
          update({ pointSizeByFn: (value: unknown, index?: number) => pointSize(value, index) });
        },
        resize: value => update({ pointSizeScale: value / 3 }),
      };
    }
    void start(host).catch(fail);
    return () => { abort.abort(); controls.current = null; void graph?.destroy(); };
  }, [data]);

  async function highlight(event: FormEvent) {
    event.preventDefault();
    const current = controls.current;
    if (!current) return setMessage("The graph is not ready yet.");
    const ids = [...new Set(nodeIds.split(/[,\s]+/).filter(Boolean))];
    if (ids.length < 2) return setMessage("Enter two or more node IDs.");
    try {
      const indices = await current.graph.getPointIndicesByIds(ids);
      if (!indices?.length) return setMessage("No matching node IDs found.");
      current.graph.selectPoints(indices, false, false);
      current.highlight(indices);
      current.graph.fitViewByIndices(indices, 500, 0.15);
      setMessage(`${indices.length} nodes highlighted; ${ids.length - indices.length} IDs not found.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to highlight nodes.");
    }
  }

  return <main className="fixed inset-0 overflow-hidden bg-[#080d18] text-[#e6efff]">
    <div ref={hostRef} className="absolute inset-0" />
    <div role={error ? "alert" : "status"} className={`${panel} top-3 left-3 pointer-events-none`}
      style={{ color: error ? "#ffadad" : "#79e2d1" }}>{status}</div>
    <Connections onData={setData} />
    {selection && <ConnectionDetails selection={selection} onClose={() => setSelection(null)} />}
    <footer className={`${panel} bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-3`}>
      <p className="text-[#9eafc5]">Drag to orbit · Scroll to zoom · Shift-drag to pan</p>
      <form onSubmit={highlight} className="flex flex-wrap items-center gap-2">
        <label htmlFor="node-ids">Node IDs</label>
        <input id="node-ids" value={nodeIds} placeholder="IDs, comma-separated" onChange={event => setNodeIds(event.target.value)} />
        <button className="bg-green-900" type="submit">Highlight &amp; fit</button>
        <button className="bg-red-900" type="button" onClick={() => {
          controls.current?.graph.unselectAllPoints(); controls.current?.highlight([]); setMessage("Node highlights cleared.");
        }}>Clear highlights</button>
        {message && <span role="status">{message}</span>}
      </form>
      <div className="flex items-center gap-3">
        <label htmlFor="point-size">Point size</label>
        <input id="point-size" type="range" min={1} max={8} step={0.5} defaultValue={3} className="w-[90px] accent-[#79e2d1]"
          onChange={event => { size.current = Number(event.target.value); controls.current?.resize(size.current); }} />
        <button type="button" className="rounded-md border border-[#405570] bg-[#1a2a40] px-2.5 py-1.5"
          onClick={() => controls.current?.graph.fitView(250, 0.06)}>Reset view</button>
      </div>
    </footer>
  </main>;
}
