"use client";

import { useEffect, useRef, useState } from "react";

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
        backgroundColor: "#111b26",
        pointColorBy: "color",
        pointColorStrategy: "direct",
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
    <main className="graph-stage">
      <div data-graph-canvas ref={hostRef} />
      <div role={error ? "alert" : "status"} className="graph-panel graph-status" style={{ color: error ? "#f2a5a5" : "var(--accent)" }}>
        {status}
      </div>
      <footer className="graph-panel graph-controls">
        <p className="text-muted" style={{ margin: 0 }}>Drag to orbit · Scroll to zoom · Shift-drag to pan</p>
        <div className="graph-control-group">
          <label htmlFor="point-size">Point size</label>
          <input style={{ width: 90 }} className="accent-[#66c0f4]" id="point-size" type="range" min="1" max="8" step="0.5" value={size} onChange={(event) => {
            const value = Number(event.target.value);
            setSize(value);
            sizeRef.current?.(value);
          }} />
          <button className="button button-secondary" type="button" onClick={() => resetRef.current?.()}>Reset view</button>
        </div>
      </footer>
    </main>
  );
}
