/** Measured side-view cells from Jimmy’s supplied JPEG. Connected neutral
 * background removal tolerates JPEG noise while retaining enclosed facial detail.
 * The printed row names are inconsistent; actual side poses determine these crops. */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
const source = jpeg.decode(readFileSync('public/assets/jimmy-source.jpg'));
if (source.width !== 1280 || source.height !== 960)
  throw new Error('Source layout changed; remeasure crops before generating.');
const columns = [705, 785, 856, 929, 997, 1066, 1134, 1202, 1267];
const rows = [
  { name: 'idle', top: 115, bottom: 184 },
  { name: 'walk', top: 425, bottom: 491 },
  { name: 'run', top: 497, bottom: 565 },
  { name: 'jump', top: 730, bottom: 800 },
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
        Math.max(...rgb) - Math.min(...rgb) < 24 &&
        Math.max(...rgb) >= 0 &&
        Math.max(...rgb) <= 78
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
    const scale = 0.78,
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
writeFileSync('public/assets/jimmy.png', PNG.sync.write(atlas));
console.log(
  'Prepared 32 side-view poses in a transparent 8 × 4 atlas (64 × 64 frames).',
);
