"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  cancelCameraZoom: () => void;
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
  const [highlightStep, setHighlightStep] = useState({ current: 0, total: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const abort = new AbortController();
    let graph: Graph | null = null;
    let cancelCameraZoom: (() => void) | null = null;
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
        enableZoom: true,
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
      type CameraGoal = {
        distance: number;
        target: [number, number, number];
      };

      let goal: CameraGoal | null = null;
      let frameId: number | null = null;
      let lastFrameTime = 0;
      let lastWheelTime = 0;

      const stopZoom = () => {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
        goal = null;
        lastFrameTime = 0;
      };
      cancelCameraZoom = stopZoom;

      const animateZoom = (now: number) => {
        frameId = null;
        const camera = instance.getCameraState();
        const destination = goal;
        if (abort.signal.aborted || !camera || !destination) {
          stopZoom();
          return;
        }

        const dt = lastFrameTime ? Math.min(now - lastFrameTime, 50) : 16;
        lastFrameTime = now;
        const alpha = 1 - Math.exp(-Math.max(dt, 0) / 85);
        const distance =
          camera.distance + (destination.distance - camera.distance) * alpha;
        const target: [number, number, number] = [
          camera.target[0] + (destination.target[0] - camera.target[0]) * alpha,
          camera.target[1] + (destination.target[1] - camera.target[1]) * alpha,
          camera.target[2] + (destination.target[2] - camera.target[2]) * alpha,
        ];

        instance.setCameraState({ distance, target }, 0);

        const distanceError =
          Math.abs(destination.distance - distance) /
          Math.max(destination.distance, Number.MIN_VALUE);
        const targetError = Math.hypot(
          destination.target[0] - target[0],
          destination.target[1] - target[1],
          destination.target[2] - target[2],
        );

        if (distanceError < 0.0001 && targetError < 0.00001) {
          instance.setCameraState(destination, 0);
          goal = null;
          lastFrameTime = 0;
          return;
        }

        if (now - lastWheelTime > 1200) {
          stopZoom();
          return;
        }

        frameId = requestAnimationFrame(animateZoom);
      };

      const handleWheel = (event: WheelEvent) => {
        const camera = instance.getCameraState();
        if (
          !camera ||
          !Number.isFinite(camera.distance) ||
          camera.distance <= 0
        )
          return;

        const canvas = host.querySelector("canvas") ?? host;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const pointer: [number, number] = [
          event.clientX - rect.left,
          event.clientY - rect.top,
        ];
        const point = instance.screenToSpacePosition(pointer, {
          dimensions: 3,
        });
        if (!point || !point.every(Number.isFinite)) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        const delta =
          event.deltaY *
          (event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? rect.height
              : 1);
        const factor = Math.exp(Math.max(-120, Math.min(120, delta)) * 0.0018);

        const desired: CameraGoal = goal ?? {
          distance: camera.distance,
          target: [...camera.target],
        };
        const nextDistance = desired.distance * factor;
        if (!Number.isFinite(nextDistance) || nextDistance <= 0) return;

        const scale = desired.distance / camera.distance;
        const ratio = nextDistance / desired.distance;
        const target: [number, number, number] = [
          desired.target[0] +
            (point[0] - camera.target[0]) * scale * (1 - ratio),
          desired.target[1] +
            (point[1] - camera.target[1]) * scale * (1 - ratio),
          desired.target[2] +
            (point[2] - camera.target[2]) * scale * (1 - ratio),
        ];
        if (!target.every(Number.isFinite)) return;

        goal = { distance: nextDistance, target };
        lastWheelTime = performance.now();
        if (frameId === null) frameId = requestAnimationFrame(animateZoom);
      };

      // Hand camera control to dragging before the graph handles the press.
      host.addEventListener("pointerdown", stopZoom, {
        capture: true,
        signal: abort.signal,
      });
      host.addEventListener("wheel", handleWheel, {
        passive: false,
        capture: true,
        signal: abort.signal,
      });
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
        cancelCameraZoom: stopZoom,
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
      cancelCameraZoom?.();
      controls.current = null;
      void graph?.destroy();
    };
  }, [data]);

  const clearHighlights = useCallback(() => {
    controls.current?.graph.unselectAllPoints();
    controls.current?.highlight([]);
    controls.current?.setTour();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearHighlights();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearHighlights]);

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
    </main>
  );
}
