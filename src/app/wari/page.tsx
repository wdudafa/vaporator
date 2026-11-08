"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  Cosmograph as Graph,
  CosmographConfig,
} from "@cosmograph/cosmograph";
import Connections, { type ConnectionData } from "./components/Connections";
import ConnectionDetails from "./components/ConnectionDetails";
import { prepareGraph, type GraphSelection } from "./graph-data";

type Controls = {
  graph: Graph;
  highlight: (indices: number[]) => void;
  resize: (size: number) => void;
  nextHighlight: () => void;
  setTour: (indices?: number[]) => void;
};
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
  const [highlightStep, setHighlightStep] = useState({ current: 0, total: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const abort = new AbortController();
    let graph: Graph | null = null;
    const fail = (cause: unknown) => {
      if (abort.signal.aborted) return;
      setError(true);
      setStatus(
        cause instanceof Error ? cause.message : "Unable to load the graph.",
      );
    };

    async function start(host: HTMLDivElement) {
      const [{ Cosmograph }, response] = await Promise.all([
        import("@cosmograph/cosmograph"),
        fetch("/will/data", { signal: abort.signal }),
      ]);
      if (!response.ok)
        throw new Error(`Could not load coordinates (${response.status}).`);
      const points = await response.arrayBuffer();
      if (abort.signal.aborted) return;
      const prepared = prepareGraph(points, data);
      let highlighted = new Set<number>();
      const defaultTour = [...prepared.nodeDetails.keys()];
      let tour = defaultTour;
      let tourCursor = -1;
      setHighlightStep({ current: 0, total: tour.length });
      const pointSize = (_value: unknown, index?: number) =>
        Math.max(
          index === undefined ? 3 : (prepared.sizes[index] ?? 3),
          index !== undefined && highlighted.has(index) ? 12 : 0,
        );
      setSelection(null);
      setMessage(
        prepared.missing.length
          ? `Missing map coordinates: ${prepared.missing.join(", ")}`
          : "",
      );

      const config: CosmographConfig = {
        points: prepared.points,
        links: prepared.links,
        pointIdBy: "appid",
        pointIndexBy: "index",
        pointXBy: "x",
        pointYBy: "y",
        pointZBy: "z",
        pointColorBy: "color",
        pointColorStrategy: "direct",
        pointSizeBy: "size",
        pointSizeByFn: pointSize,
        pointSizeScale: size.current / 3,
        pointSphereShading: true,
        pointDepthFade: 0.15,
        linkSourceBy: "sourceId",
        linkTargetBy: "targetId",
        linkSourceIndexBy: "source",
        linkTargetIndexBy: "target",
        linkColorBy: "color",
        linkColorStrategy: "direct",
        linkWidthBy: "width",
        linkWidthByFn: Number,
        linkStyleBy: "style",
        linkDefaultArrows: false,
        spaceDimensions: 3,
        enableSimulation: false,
        enableDrag: false,
        backgroundColor: "#111b26",
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        pointLabelBy: "label",
        showLabels: true,
        showLabelsFor: prepared.labelIds,
        showHoveredPointLabel: true,
        showUnselectedPointLabels: true,
        pointLabelColor: "#c7d5e0",
        pointLabelFontSize: 12,
        fitViewOnInit: true,
        fitViewDelay: 0,
        fitViewDuration: 0,
        fitViewPadding: 0.06,
        onLinkClick: (index) => {
          const detail = prepared.linkDetails[index];
          if (detail)
            setSelection({
              title: detail.title,
              roles: [detail.kind],
              connections: [detail],
            });
        },
        onLinkMouseOver: () => {
          host.style.cursor = "pointer";
        },
        onLinkMouseOut: () => {
          host.style.cursor = "default";
        },
        onPointClick: (index) => {
          const details = prepared.nodeDetails.get(index);
          if (details) return setSelection(details);
          const appid = String(prepared.points.getChild("appid")?.get(index));
          if (!/^\d+$/.test(appid)) return;
          graph?.selectPoints([index], false, false);
          controls.current?.highlight([index]);
          setSelection({
            title: "Game details",
            appid,
            roles: [],
            connections: [],
          });
        },
        onGraphRebuilt: ({ pointsCount }) => {
          if (abort.signal.aborted) return;
          setError(false);
          setStatus(
            `${pointsCount.toLocaleString()} nodes · ${prepared.links?.numRows ?? 0} connections`,
          );
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
        highlight: (indices) => {
          highlighted = new Set(indices);
          // A new accessor tells Cosmograph to recalculate sizes after selection.
          update({
            pointSizeByFn: (value: unknown, index?: number) =>
              pointSize(value, index),
          });
        },
        resize: (value) => update({ pointSizeScale: value / 3 }),
        setTour: (indices) => {
          tour = indices ? [...new Set(indices)] : defaultTour;
          tourCursor = -1;
          setHighlightStep({ current: 0, total: tour.length });
        },
        nextHighlight: () => {
          if (!tour.length || abort.signal.aborted) return;
          tourCursor = (tourCursor + 1) % tour.length;
          const index = tour[tourCursor];
          const details = prepared.nodeDetails.get(index);
          instance.selectPoints([index], false, false);
          controls.current?.highlight([index]);
          // Keep the current zoom and orientation while moving to the next node.
          const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 600;
          instance.zoomToPoint(index, duration, 1);
          setSelection(details ?? {
            title: "Game details",
            appid: String(prepared.points.getChild("appid")?.get(index)),
            roles: [], connections: [],
          });
          setHighlightStep({ current: tourCursor + 1, total: tour.length });
        },
      };
    }
    void start(host).catch(fail);
    return () => {
      abort.abort();
      controls.current = null;
      void graph?.destroy();
    };
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
      current.setTour(indices);
      current.graph.fitViewByIndices(indices, 500, 0.15);
      setMessage(
        `${indices.length} nodes highlighted; ${ids.length - indices.length} IDs not found.`,
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Unable to highlight nodes.",
      );
    }
  }

  const clearHighlights = () => {
    controls.current?.graph.unselectAllPoints();
    controls.current?.highlight([]);
    controls.current?.setTour();
    setMessage("Node highlights cleared.");
  };

  return (
    <main className="graph-stage">
      <div ref={hostRef} data-graph-canvas />
      <div
        role={error ? "alert" : "status"}
        className="graph-panel graph-status"
        style={{ color: error ? "#f2a5a5" : "var(--accent)" }}
      >
        {status}
      </div>
      <div className="graph-panel graph-highlight-tour" aria-label="Highlight navigation">
        <button type="button" className="button button-secondary"
          disabled={highlightStep.total === 0}
          onClick={() => controls.current?.nextHighlight()}>
          Next highlight →
        </button>
        <span role="status" aria-live="polite">{highlightStep.current} / {highlightStep.total}</span>
      </div>
      <Connections onData={setData} />
      {selection && (
        <ConnectionDetails
          selection={selection}
          onClose={() => {
            setSelection(null);
            clearHighlights();
          }}
        />
      )}
      <footer className="graph-panel graph-controls">
        <form onSubmit={highlight} className="graph-control-group">
          <label htmlFor="node-ids">Node IDs</label>
          <input
            id="node-ids"
            value={nodeIds}
            placeholder="IDs, comma-separated"
            onChange={(event) => setNodeIds(event.target.value)}
          />
          <button className="button button-primary" type="submit">
            Highlight &amp; fit
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              clearHighlights();
            }}
          >
            Clear highlights
          </button>
          {message && <span role="status">{message}</span>}
        </form>
        <div className="graph-control-group">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => controls.current?.graph.fitView(250, 0.06)}
          >
            Reset view
          </button>
        </div>
      </footer>
    </main>
  );
}
