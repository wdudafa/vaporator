"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

const panel: CSSProperties = {
  position: "absolute",
  zIndex: 2,
  top: 64,
  right: 12,
  bottom: 76,
  width: "min(320px, calc(100vw - 24px))",
  boxSizing: "border-box",
  padding: 16,
  borderRadius: 6,
  background: "#101a2bd9",
  fontSize: 12,
  lineHeight: "18px",
};

type SideBarProps = {
  selectedNodeId: string | null;
  onClose: () => void;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; name: string; description: string }
  | { status: "error"; message: string };

export default function SideBar({ selectedNodeId, onClose }: SideBarProps) {
  const hidden = selectedNodeId === null;
  const [state, setState] = useState<FetchState>({ status: "idle" });

  useEffect(() => {
    if (selectedNodeId === null) return;

    const controller = new AbortController();
    setState({ status: "loading" });

    const url = `/api/steam/${encodeURIComponent(selectedNodeId)}`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((json) => {
        const entry = json?.[selectedNodeId];
        if (!entry?.success) {
          setState({ status: "error", message: "No details found for this app." });
          return;
        }
        setState({
          status: "success",
          name: entry.data.name,
          description: entry.data.short_description,
        });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setState({ status: "error", message: err.message });
      });

    return () => controller.abort();
  }, [selectedNodeId]);

  return (
    <aside
      className="node-details-panel"
      aria-label="Selected node"
      aria-hidden={hidden}
      inert={hidden}
      style={{
        ...panel,
        opacity: hidden ? 0 : 1,
        transform: hidden
          ? "translateX(calc(100% + 12px))"
          : "translateX(0)",
        visibility: hidden ? "hidden" : "visible",
        transition: hidden
          ? "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease, visibility 0s linear 220ms"
          : "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease, visibility 0s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>Node details</h2>
        <button
          type="button"
          aria-label="Close node details"
          style={{
            cursor: "pointer",
            borderRadius: 6,
            padding: "4px 8px",
            background: "#1a2a40",
            color: "#e6efff",
          }}
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <p style={{ margin: "20px 0 6px", color: "#9eafc5" }}>Node ID</p>
      <code style={{ overflowWrap: "anywhere", color: "#79e2d1" }}>
        {selectedNodeId ?? ""}
      </code>

      {state.status === "loading" && (
        <p style={{ margin: "20px 0 0", color: "#9eafc5" }}>Loading…</p>
      )}

      {state.status === "error" && (
        <p style={{ margin: "20px 0 0", color: "#ff8a8a" }}>{state.message}</p>
      )}

      {state.status === "success" && (
        <>
          <p style={{ margin: "20px 0 6px", color: "#9eafc5" }}>Name</p>
          <div style={{ color: "#e6efff" }}>{state.name}</div>

          <p style={{ margin: "20px 0 6px", color: "#9eafc5" }}>
            Short description
          </p>
          <p style={{ margin: 0, color: "#e6efff" }}>{state.description}</p>
        </>
      )}
    </aside>
  );
}