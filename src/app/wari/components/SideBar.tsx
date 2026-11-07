"use client";

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

export default function SideBar({ selectedNodeId, onClose }: SideBarProps) {
  const hidden = selectedNodeId === null;

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
    </aside>
  );
}