import { positionColor } from "@/lib/position-color";
import coordinates from "../../../../coordinates_umap_xyz.json";
import { Table, tableToIPC, vectorFromArray, Utf8 } from "apache-arrow";

// Pre-index on the server and send Arrow directly to Cosmograph. This avoids
// parsing 150k JSON objects and running the Data Kit in the browser.
export const dynamic = "force-static";

export function GET() {
  const count = coordinates.length;
  const ids = new Array<string>(count);
  const colors = new Array<string>(count);
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
  return new Response(new Uint8Array(payload), {
    headers: { "Content-Type": "application/vnd.apache.arrow.stream" },
  });
}
