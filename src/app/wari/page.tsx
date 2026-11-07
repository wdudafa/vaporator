"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type {
  Cosmograph as CosmographInstance,
  CosmographConfig,
} from "@cosmograph/cosmograph";
import SideBar from "./components/SideBar";

const overlay: CSSProperties = {
  position: "absolute",
  zIndex: 1,
  padding: "8px 12px",
  borderRadius: 6,
  background: "#101a2bd9",
  fontSize: 12,
  lineHeight: "18px",
};

export default function Home() {
  const hostRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<(() => void) | null>(null);
  const sizeRef = useRef<((value: number) => void) | null>(null);
  const graphRef = useRef<CosmographInstance | null>(null);

  const [status, setStatus] = useState("Loading coordinates…");
  const [error, setError] = useState(false);
  const [size, setSize] = useState<number>(100);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeIdsInput, setNodeIdsInput] = useState("");
  const [selectionMessage, setSelectionMessage] = useState("");

  const handleHighlightSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    const graph = graphRef.current;
    if (graph === null) {
      setSelectionMessage("The graph is not ready yet.");
      return;
    }

    const ids = [...new Set(nodeIdsInput.split(/[,\s]+/).filter(Boolean))];
    if (ids.length === 0) {
      setSelectionMessage("Enter one or more node IDs.");
      return;
    }

    try {
      const indices = await graph.getPointIndicesByIds(ids);
      if (!indices?.length) {
        setSelectionMessage("No matching node IDs found.");
        return;
      }

      graph.selectPoints(indices, false, false);
      graph.fitViewByIndices(indices, 500, 0.15);

      const missingCount = ids.length - indices.length;
      setSelectionMessage(
        `${indices.length} node${indices.length === 1 ? "" : "s"} highlighted and fitted${
          missingCount > 0 ? `; ${missingCount} ID${missingCount === 1 ? "" : "s"} not found` : ""
        }.`,
      );
    } catch (cause: unknown) {
      setSelectionMessage(
        cause instanceof Error ? cause.message : "Unable to highlight nodes.",
      );
    }
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const abort = new AbortController();
    let graph: CosmographInstance | null = null;

    const fail = (cause: unknown): void => {
      if (abort.signal.aborted) return;

      setError(true);
      setStatus(
        cause instanceof Error ? cause.message : "Unable to start Cosmograph.",
      );
    };

    const start = async (): Promise<void> => {
      const [{ Cosmograph }, response] = await Promise.all([
        import("@cosmograph/cosmograph"),
        fetch("/will/data", {
          signal: abort.signal,
        }),
      ]);

      if (!response.ok) {
        throw new Error(`Could not load coordinates (${response.status}).`);
      }

      const points: ArrayBuffer = await response.arrayBuffer();

      if (abort.signal.aborted) return;

      setStatus("Preparing points…");

      const config: CosmographConfig = {
        points,
        pointIdBy: "appid",
        pointIndexBy: "index",
        pointXBy: "x",
        pointYBy: "y",
        pointZBy: "z",

        spaceDimensions: 3,
        enableSimulation: false,
        enableDrag: false,

        backgroundColor: "#080d18",

        pointColorBy: "z",
        pointColorStrategy: "continuous",
        pointColorPalette: ["#79e2d1", "#88baff", "#a69bff"],

        pointSizeStrategy: "single",
        pointDefaultSize: 3,
        pointSizeScale: 1,
        pointSphereShading: true,
        pointDepthFade: 0.15,

        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),

        showLabels: false,
        showHoveredPointLabel: false,

        fitViewOnInit: true,
        fitViewDelay: 0,
        fitViewDuration: 0,
        fitViewPadding: 0.06,

        onPointClick: (index) => {
          if (graph === null) return;

          graph.selectPoints([index], false, false);
          graph.fitViewByIndices([index], 500, 0.15);

          void graph
            .getPointIdsByIndices([index])
            .then((ids) => {
              const id = ids?.[0];
              if (id !== undefined) {
                const nodeId = String(id);
                setSelectedNodeId(nodeId);
                setNodeIdsInput(nodeId);
              }
            })
            .catch(fail);
        },

        onGraphRebuilt: ({ pointsCount }) => {
          if (abort.signal.aborted) return;

          setError(false);
          setStatus(`${pointsCount.toLocaleString()} nodes`);
        },

        onGraphRebuildError: fail,
      };

      // Capture the instance so callbacks cannot reference
      // a possibly undefined graph.
      const instance: CosmographInstance = new Cosmograph(host, config);

      graph = instance;
      graphRef.current = instance;

      resetRef.current = (): void => {
        if (abort.signal.aborted) return;
        instance.fitView(250, 0.06);
      };

      sizeRef.current = (value: number): void => {
        if (abort.signal.aborted) return;

        // Handles both synchronous and asynchronous
        // setConfig implementations.
        void (async (): Promise<void> => {
          try {
            await instance.setConfig({
              ...config,
              pointSizeScale: value / 3,
            });
          } catch (cause: unknown) {
            fail(cause);
          }
        })();
      };
    };

    void start().catch(fail);

    return () => {
      abort.abort();

      resetRef.current = null;
      sizeRef.current = null;
      graphRef.current = null;

      if (graph !== null) {
        void graph.destroy();
      }
    };
  }, []);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: "#080d18",
        color: "#e6efff",
      }}
    >
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />

      <div
        role={error ? "alert" : "status"}
        style={{
          ...overlay,
          top: 12,
          left: 12,
          pointerEvents: "none",
          color: error ? "#ffadad" : "#79e2d1",
        }}
      >
        {status}
      </div>

      
      <SideBar
  selectedNodeId={selectedNodeId}
  onClose={() => setSelectedNodeId(null)}
/>

      <footer
        style={{
          ...overlay,
          bottom: 12,
          left: 12,
          right: 12,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <p style={{ margin: 0, color: "#9eafc5" }}>
          Drag to orbit · Scroll to zoom · Shift-drag to pan
        </p>

        <form
          onSubmit={handleHighlightSubmit}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          <label htmlFor="node-ids">Node IDs</label>
          <input
            id="node-ids"
            type="text"
            value={nodeIdsInput}
            placeholder="One or more IDs, comma-separated"
            onChange={(event) => setNodeIdsInput(event.currentTarget.value)}
          />
          <button type="submit">Highlight &amp; fit</button>
          <button
            type="button"
            onClick={() => {
              graphRef.current?.unselectAllPoints();
              setSelectionMessage("Node highlights cleared.");
            }}
          >
            Clear highlights
          </button>
          {selectionMessage && <span role="status">{selectionMessage}</span>}
        </form>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <label htmlFor="point-size">Point size</label>

          <input
            id="point-size"
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={size}
            style={{
              width: 90,
              accentColor: "#79e2d1",
            }}
            onChange={(event) => {
              const value = Number(event.currentTarget.value);

              setSize(value);
              sizeRef.current?.(value);
            }}
          />

          <button
            type="button"
            style={{
              cursor: "pointer",
              border: "1px solid #405570",
              borderRadius: 6,
              padding: "6px 10px",
              background: "#1a2a40",
              color: "#e6efff",
            }}
            onClick={() => resetRef.current?.()}
          >
            Reset view
          </button>
        </div>
      </footer>
    </main>
  );
}
