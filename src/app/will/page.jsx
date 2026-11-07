"use client";

import { useEffect, useRef, useState } from "react";

// Keep the viewer layout independent of the app's custom CSS loader.
const overlay = {
  position: "absolute", zIndex: 1, padding: "8px 12px",
  borderRadius: 6, background: "#101a2bd9", fontSize: 12, lineHeight: "18px",
};

export default function WillPage() {
  const hostRef = useRef(null);
  const resetRef = useRef(null);
  const sizeRef = useRef(null);
  const [status, setStatus] = useState("Loading coordinates…");
  const [error, setError] = useState(false);
  const [size, setSize] = useState(3);

  useEffect(() => {
    const host = hostRef.current;
    const abort = new AbortController();
    let graph;
    const fail = (cause) => {
      if (abort.signal.aborted) return;
      setError(true);
      setStatus(cause instanceof Error ? cause.message : "Unable to start Cosmograph.");
    };

    async function start() {
      // Load only in the browser: Cosmograph needs WebGL and web workers.
      const [{ Cosmograph }, response] = await Promise.all([
        import("@cosmograph/cosmograph"),
        fetch("/will/data", { signal: abort.signal }),
      ]);
      if (!response.ok) throw new Error("Could not load coordinates.");
      const points = await response.arrayBuffer();
      if (abort.signal.aborted) return;
      setStatus("Preparing points…");
      const config = {
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
        pointSphereShading: true,
        pointDepthFade: 0.15,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        showLabels: false,
        showHoveredPointLabel: false,
        fitViewOnInit: true,
        fitViewDelay: 0,
        fitViewDuration: 0,
        fitViewPadding: 0.06,
        onGraphRebuilt: ({ pointsCount }) => {
          if (abort.signal.aborted) return;
          setError(false);
          setStatus(`${pointsCount.toLocaleString()} nodes · Cosmograph`);
        },
        onGraphRebuildError: fail,
      };
      graph = new Cosmograph(host, config);
      resetRef.current = () => graph.fitView(250, 0.06);
      // Scaling sizes updates the renderer without rebuilding the dataset.
      sizeRef.current = (value) => {
        graph.setConfig({ ...config, pointSizeScale: value / 3 }).catch(fail);
      };
    }

    start().catch(fail);
    return () => {
      abort.abort();
      resetRef.current = null;
      sizeRef.current = null;
      if (graph) void graph.destroy();
    };
  }, []);

  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#080d18", color: "#e6efff" }}>
      <div style={{ position: "absolute", inset: 0 }} ref={hostRef} />
      <div role={error ? "alert" : "status"} style={{ ...overlay, top: 12, left: 12, pointerEvents: "none", color: error ? "#ffadad" : "#79e2d1" }}>
        {status}
      </div>
      <footer style={{ ...overlay, bottom: 12, left: 12, right: 12, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p style={{ margin: 0, color: "#9eafc5" }}>Drag to orbit · Scroll to zoom · Shift-drag to pan</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label htmlFor="point-size">Point size</label>
          <input style={{ width: 90, accentColor: "#79e2d1" }} id="point-size" type="range" min="1" max="8" step="0.5" value={size} onChange={(event) => {
            const value = Number(event.target.value);
            setSize(value);
            sizeRef.current?.(value);
          }} />
          <button style={{ cursor: "pointer", border: "1px solid #405570", borderRadius: 6, padding: "6px 10px", background: "#1a2a40", color: "#e6efff" }} type="button" onClick={() => resetRef.current?.()}>Reset view</button>
        </div>
      </footer>
    </main>
  );
}
