"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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
    let dispose = () => {};

    async function start() {
      const response = await fetch("/will/data", { signal: abort.signal });
      if (!response.ok) throw new Error("Could not load coordinates.");
      const buffer = await response.arrayBuffer();
      if (abort.signal.aborted) return;
      if (buffer.byteLength % 12 !== 0) throw new Error("Invalid coordinate data.");
      const positions = new Float32Array(buffer.byteLength / 4);
      const view = new DataView(buffer);
      for (let i = 0; i < positions.length; i++) {
        positions[i] = view.getFloat32(i * 4, true);
      }

      const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor("#080d18");
      renderer.domElement.setAttribute("aria-label", "Interactive 3D coordinate cloud. Drag to orbit, scroll to zoom, right-drag to pan.");
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "none";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, 1, 0.001, 1000);
      const controls = new OrbitControls(camera, renderer.domElement);
      // Render only when the camera or viewport changes; no permanent animation loop.
      const render = () => renderer.render(scene, camera);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.computeBoundingBox();
      const center = new THREE.Vector3();
      const extent = new THREE.Vector3();
      geometry.boundingBox.getCenter(center);
      geometry.boundingBox.getSize(extent);
      if (!positions.length) center.set(0, 0, 0);
      const span = Math.max(extent.x, extent.y, extent.z, 0.001);
      // Center on the origin to keep orbiting stable for large coordinate offsets.
      geometry.translate(-center.x, -center.y, -center.z);
      geometry.computeBoundingSphere();

      const colors = new Float32Array(positions.length);
      const color = new THREE.Color();
      for (let i = 0; i < positions.length; i += 3) {
        const t = extent.z > 0 ? (positions[i + 2] + extent.z / 2) / extent.z : 0.5;
        color.setHSL(0.48 + t * 0.2, 0.75, 0.62);
        color.toArray(colors, i);
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true });
      scene.add(new THREE.Points(geometry, material));

      const reset = () => {
        const fov = THREE.MathUtils.degToRad(camera.fov);
        const tanY = Math.tan(fov / 2);
        const tanX = tanY * camera.aspect;
        const direction = new THREE.Vector3(0.7, 0.45, 1).normalize();
        const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
        const up = new THREE.Vector3().crossVectors(direction, right);
        const point = new THREE.Vector3();
        // Fit the actual projected points, rather than a mostly empty bounding
        // sphere. Leave 8% around the cloud while keeping every node in frame.
        let distance = span * 0.01;
        for (let i = 0; i < positions.length; i += 3) {
          point.fromArray(positions, i);
          const depth = point.dot(direction);
          distance = Math.max(distance,
            depth + Math.abs(point.dot(right)) / (tanX * 0.92),
            depth + Math.abs(point.dot(up)) / (tanY * 0.92));
        }
        camera.near = span / 10000;
        camera.far = distance + span * 100;
        camera.position.copy(direction).multiplyScalar(distance);
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.minDistance = span * 0.005;
        controls.maxDistance = distance * 20;
        controls.update();
        render();
      };
      const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        renderer.setSize(Math.max(width, 1), Math.max(height, 1));
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
        // Keep the fitted framing when the window changes size, but preserve
        // the user's camera after they start exploring.
        if (!hasInteracted) reset();
        render();
      };
      let hasInteracted = false;
      const markInteracted = () => { hasInteracted = true; };
      controls.addEventListener("start", markInteracted);
      controls.addEventListener("change", render);
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      reset();
      resetRef.current = reset;
      sizeRef.current = (value) => { material.size = value; render(); };
      const contextLost = (event) => {
        event.preventDefault();
        setError(true);
        setStatus("Graphics context lost. Reload to restore the view.");
      };
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      setStatus(`${(positions.length / 3).toLocaleString()} nodes`);
      dispose = () => {
        observer.disconnect();
        controls.removeEventListener("start", markInteracted);
        controls.removeEventListener("change", render);
        controls.dispose();
        geometry.dispose();
        material.dispose();
        renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        renderer.dispose();
        renderer.domElement.remove();
        resetRef.current = null;
        sizeRef.current = null;
      };
    }

    start().catch((cause) => {
      if (abort.signal.aborted) return;
      dispose();
      setError(true);
      setStatus(cause instanceof Error ? cause.message : "Unable to start the 3D viewer.");
    });
    return () => { abort.abort(); dispose(); };
  }, []);

  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#080d18", color: "#e6efff" }}>
      <div style={{ position: "absolute", inset: 0 }} ref={hostRef} />
      <div role={error ? "alert" : "status"} style={{ ...overlay, top: 12, left: 12, pointerEvents: "none", color: error ? "#ffadad" : "#79e2d1" }}>
        {status}
      </div>
      <footer style={{ ...overlay, bottom: 12, left: 12, right: 12, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p style={{ margin: 0, color: "#9eafc5" }}>Drag to orbit · Scroll to zoom · Right-drag to pan</p>
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
