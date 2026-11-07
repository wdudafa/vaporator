"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type {
  Cosmograph as CosmographInstance,
  CosmographConfig,
} from "@cosmograph/cosmograph";

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

  const [status, setStatus] = useState("Loading coordinates…");
  const [error, setError] = useState(false);
  const [size, setSize] = useState<number>(3);

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

          void graph
            .getPointIdsByIndices([index])
            .then((ids) => {
              const id = ids?.[0];
              if (id !== undefined) {
                console.log(id);
              }
            })
            .catch(fail);
        },

        onGraphRebuilt: ({ pointsCount }) => {
          if (abort.signal.aborted) return;

          setError(false);
          setStatus(`${pointsCount.toLocaleString()} nodes · Cosmograph`);
        },

        onGraphRebuildError: fail,
      };

      // Capture the instance so callbacks cannot reference
      // a possibly undefined graph.
      const instance: CosmographInstance = new Cosmograph(host, config);

      graph = instance;

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
