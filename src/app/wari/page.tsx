"use client";
import { useEffect, useState } from "react";
import {
  Cosmograph,
  CosmographProvider,
  prepareCosmographData,
} from "@cosmograph/react";
import type { CosmographConfig } from "@cosmograph/react";

const numberOfPoints = 150000;
const rawPoints = Array.from({ length: numberOfPoints }, (_, i) => ({
  id: String(i),
}));

const rawLinks: any[] = [];
// const rawLinks = Array.from({ length: numberOfPoints }, (_, i) => ({
//   source: String(i),
//   target: String((i + 1) % numberOfPoints),
// }));

export default function Home() {
  const [config, setConfig] = useState<CosmographConfig>({});

  // Create a config to map your data into Cosmograph's internal format
  const dataConfig = {
    points: {
      pointIdBy: "id",
    },
    links: {
      linkSourceBy: "source",
      linkTargetsBy: ["target"],
    },
  };

  const loadData = async (): Promise<void> => {
    // Prepare data and config for Cosmograph
    const result = await prepareCosmographData(dataConfig, rawPoints, rawLinks);

    if (result) {
      // Update Cosmograph config with prepared output
      const { points, links, cosmographConfig } = result;
      setConfig({
        points,
        links,
        ...cosmographConfig,
        spaceDimensions: 3,
        pointDefaultSize: 10,
        pointSphereShading: true,
        enableZoom: true,
      });
    }
  };

  // Load data when component is mounted
  useEffect(() => {
    loadData();
  }, []);

  return (
    <CosmographProvider>
      <div className="h-screen w-full">
        <Cosmograph {...config} style={{ height: "100%", width: "100%" }} />
      </div>
    </CosmographProvider>
  );
}
