/** Explicitly measured cells in the supplied 1536×1024 presentation sheet.
 * The printed row labels do not reliably describe the right-hand poses.
 * Keep source intact. Remove only connected neutral background, trim, then
 * nearest-neighbor sample at one consistent scale and align paws to y=58.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const source = PNG.sync.read(readFileSync('public/assets/sophie-source.png'));
if (source.width !== 1536 || source.height !== 1024)
  throw new Error('Source layout changed; remeasure crops before generating.');
const columns = [806, 899, 989, 1077, 1165, 1253, 1341, 1429, 1515];
const rows = [
  { name: 'idle', top: 129, bottom: 205 },
  { name: 'walk', top: 477, bottom: 550 },
  { name: 'run', top: 559, bottom: 631 },
  { name: 'jump', top: 729, bottom: 816 },
];
const atlas = new PNG({ width: 512, height: 256 });
for (const [rowIndex, row] of rows.entries()) {
  for (let frame = 0; frame < 8; frame++) {
    const x0 = columns[frame],
      w = columns[frame + 1] - x0 - 4,
      h = row.bottom - row.top;
    const removed = new Uint8Array(w * h),
      queue = [];
    const isBackground = (x, y) => {
      const i = ((y + row.top) * source.width + x + x0) * 4;
      const rgb = Array.from(source.data.subarray(i, i + 3));
      return (
        Math.max(...rgb) - Math.min(...rgb) < 7 &&
        Math.max(...rgb) >= 15 &&
        Math.max(...rgb) <= 35
      );
    };
    const add = (x, y) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return;
      const k = y * w + x;
      if (!removed[k] && isBackground(x, y)) {
        removed[k] = 1;
        queue.push([x, y]);
      }
    };
    for (let x = 0; x < w; x++) {
      add(x, 0);
      add(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      add(0, y);
      add(w - 1, y);
    }
    for (let q = 0; q < queue.length; q++) {
      const [x, y] = queue[q];
      add(x - 1, y);
      add(x + 1, y);
      add(x, y - 1);
      add(x, y + 1);
    }
    let left = w,
      right = 0,
      top = h,
      bottom = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (!removed[y * w + x]) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
    const scale = 0.68,
      dw = Math.ceil((right - left + 1) * scale),
      dh = Math.ceil((bottom - top + 1) * scale);
    const dx = Math.floor((64 - dw) / 2),
      dy = 58 - dh;
    for (let y = 0; y < dh; y++)
      for (let x = 0; x < dw; x++) {
        const sx = left + Math.floor(x / scale),
          sy = top + Math.floor(y / scale);
        if (removed[sy * w + sx]) continue;
        const si = ((row.top + sy) * source.width + x0 + sx) * 4;
        const di =
          ((rowIndex * 64 + dy + y) * atlas.width + frame * 64 + dx + x) * 4;
        source.data.copy(atlas.data, di, si, si + 3);
        atlas.data[di + 3] = 255;
      }
  }
}
writeFileSync('public/assets/sophie.png', PNG.sync.write(atlas));
console.log(
  'Prepared 32 side-view poses in a transparent 8 × 4 atlas (64 × 64 frames).',
);
