export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function overlaps(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
/** Find the smallest sideways displacement that clears an upcoming ceiling corner. */
export function cornerCorrection(
  body: Rect,
  nextY: number,
  solids: readonly Rect[],
  pixels: number,
  preferredDirection = 1,
): number {
  const next = { ...body, y: nextY };
  const ceilings = solids.filter(
    (s) => body.y >= s.y + s.height - 0.1 && overlaps(next, s),
  );
  if (ceilings.length === 0) return 0;
  for (let distance = 1; distance <= pixels; distance++)
    for (const sign of [preferredDirection, -preferredDirection]) {
      const shifted = { ...next, x: body.x + distance * sign };
      if (
        !solids.some((s) => overlaps(shifted, s)) &&
        !solids.some((s) => overlaps({ ...body, x: shifted.x }, s))
      )
        return distance * sign;
    }
  return 0;
}
/** Only assists descending crossings, within a few pixels of an otherwise clear ledge. */
export function edgeCorrection(
  body: Rect,
  nextY: number,
  solids: readonly Rect[],
  pixels: number,
): number {
  for (const s of solids) {
    if (body.y + body.height > s.y + 0.1 || nextY + body.height < s.y) continue;
    const gapRight = s.x - (body.x + body.width),
      gapLeft = body.x - (s.x + s.width);
    const correction =
      gapRight >= 0 && gapRight <= pixels
        ? gapRight + 0.5
        : gapLeft >= 0 && gapLeft <= pixels
          ? -gapLeft - 0.5
          : 0;
    if (
      correction &&
      !solids.some((other) =>
        overlaps({ ...body, x: body.x + correction }, other),
      )
    )
      return correction;
  }
  return 0;
}
