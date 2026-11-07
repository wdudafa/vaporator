"use client";
import { useState } from "react";
import ForceGraph3D from "react-force-graph-3d";

const colours = {
  1: "red",
  2: "blue",
  3: "green",
  4: "orange",
};

const colourValues = Object.values(colours);

const graphData = {
  nodes: [{ id: "A", color: "red" }],
  links: [],
};

for (let i = 0; i < 15; i++) {
  graphData.nodes.push({
    id: "",
    color: colourValues[i % colourValues.length],
  });
}

export default function Home() {
  const [openSideBar, setOpenSidebar] = useState()

  
  return (
    <ForceGraph3D
      graphData={graphData}
      nodeAutoColorBy="id"
      nodeLabel="id"
      onNodeClick={(node) => console.log(node)}
      enableNodeDrag
      backgroundColor="#080d18"
    />
  );
}
