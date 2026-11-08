import { readFile, writeFile } from "node:fs/promises";
import { positionColor } from "../src/lib/position-color.ts";
import { Table, tableToIPC, vectorFromArray, Utf8 } from "apache-arrow";

const coordinates = JSON.parse(await readFile(new URL("../coordinates/coordinates_umap_xyz.json", import.meta.url), "utf8"));

const count = coordinates.length;
const ids = new Array(count);
const colors = new Array(count);
const index = new Uint32Array(count);
const x = new Float32Array(count);
const y = new Float32Array(count);
const z = new Float32Array(count);
coordinates.forEach((node, index) => {
  for (const value of [node.x, node.y, node.z]) {
    if (!Number.isFinite(value)) throw new Error(`Invalid coordinate at ${index}`);
  }
  ids[index] = String(node.appid);
  colors[index] = positionColor(node.x, node.y, node.z);
  x[index] = node.x;
  y[index] = node.y;
  z[index] = node.z;
});
for (let i = 0; i < count; i++) index[i] = i;
const table = new Table({ appid: vectorFromArray(ids, new Utf8()), color: vectorFromArray(colors, new Utf8()), index: vectorFromArray(index), x: vectorFromArray(x), y: vectorFromArray(y), z: vectorFromArray(z) });
const payload = tableToIPC(table, "stream");
await writeFile(new URL("../public/graph.arrow", import.meta.url), payload);
console.log(`Generated graph.arrow (${count} games, ${payload.byteLength} bytes)`);
