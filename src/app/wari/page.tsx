"use client";
import { useEffect, useState } from "react";
import { NodeObject } from "react-force-graph-3d";

const colours = {
  1: "red",
  2: "blue",
  3: "green",
  4: "orange",
};

const nodeRelSize = 20;
const numberOfNodes = 15;
const colourValues = Object.values(colours);

const graphData: { nodes: NodeObject[]; links: [] } = {
  nodes: [],
  links: [],
};

for (let i = 0; i < numberOfNodes; i++) {
  graphData.nodes.push({
    id: String(i),
    color: colourValues[i % colourValues.length],
  });
}

export default function Home() {
  const [openSideBar, setOpenSidebar] = useState<String | null>(null);
  const [ForceGraph3D, setForceGraph3D] = useState<
    typeof import("react-force-graph-3d").default | null
  >(null);

  useEffect(() => {
    import("react-force-graph-3d").then((module) => {
      setForceGraph3D(() => module.default);
    });
  }, []);

  const highlightNodes = () => {
    console.log("highlighting blue nodes");
  };

  return (
    <main className="relative h-screen w-full">
      <aside
        aria-hidden={openSideBar === null}
        className={`absolute left-0 top-0 z-10 h-full w-72 bg-zinc-900 transition-transform duration-300 ease-in-out`}
      >
        <button
          className="bg-red-400"
          onClick={() => {
            highlightNodes();
          }}
        >
          Highlight the blue nodes
        </button>
      </aside>

      <aside
        aria-hidden={openSideBar === null}
        className={`absolute right-0 top-0 z-10 h-full w-72 bg-zinc-900 transition-transform duration-300 ease-in-out ${
          openSideBar === null
            ? "pointer-events-none translate-x-full"
            : "translate-x-0"
        }`}
      >
        <button onClick={() => setOpenSidebar(null)}>Close</button>
        {openSideBar !== null && <p>Node: {openSideBar}</p>}
      </aside>

      {ForceGraph3D && (
        <ForceGraph3D
          graphData={graphData}
          nodeAutoColorBy="id"
          nodeLabel="id"
          onNodeClick={(node) => {
            setOpenSidebar(String(node.id));
          }}
          enableNodeDrag
          backgroundColor="#080d18"
          nodeRelSize={nodeRelSize}
        />
      )}
    </main>
  );
}
