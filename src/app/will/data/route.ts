import coordinates from "../../../../coords_rand.json";

// Static binary payload: x/y/z float32 triples, little endian, 12 bytes/node.
// Importing here also makes Next include the dataset in production deployments.
export const dynamic = "force-static";

export function GET() {
  const buffer = new ArrayBuffer(coordinates.length * 12);
  const view = new DataView(buffer);
  coordinates.forEach((node, index) => {
    for (const [axis, value] of [node.x, node.y, node.z].entries()) {
      if (!Number.isFinite(value)) throw new Error(`Invalid coordinate at ${index}`);
      view.setFloat32(index * 12 + axis * 4, value, true);
    }
  });
  return new Response(buffer, {
    headers: { "Content-Type": "application/octet-stream" },
  });
}
