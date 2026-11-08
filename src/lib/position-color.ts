/** A muted spatial RGB tint: X contributes red, Y green, Z blue. */
export function positionColor(x: number, y: number, z: number): string {
  const base = [82, 102, 121];
  const tint = 0.28;
  return "#" + [x, y, z].map((coordinate, axis) => {
    const value = Number.isFinite(coordinate) ? Math.max(0, Math.min(1, coordinate)) : 0.5;
    return Math.round(base[axis] * (1 - tint) + value * 255 * tint).toString(16).padStart(2, "0");
  }).join("");
}
