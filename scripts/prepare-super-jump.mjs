/** Eight measured combined poses. The last two overlap in X, so each has two
 * explicit regions. Anchoring Jimmy's paws removes the sheet's baked-in rise;
 * choreography supplies the launch motion, while the two dogs stay one sprite. */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const meta = JSON.parse(readFileSync('src/game/superJump/sheet.json', 'utf8'));
const source = PNG.sync.read(readFileSync(`public/assets/${meta.source}`));
const { width: w, height: h } = source;
if (w !== meta.sourceWidth || h !== meta.sourceHeight)
  throw new Error(
    'Remeasure the combined super-jump source before preparing it.',
  );
const removed = new Uint8Array(w * h),
  queue = [];
const add = (x, y) => {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const k = y * w + x,
    i = k * 4;
  if (removed[k]) return;
  const rgb = source.data.subarray(i, i + 3);
  const high = Math.max(...rgb),
    low = Math.min(...rgb);
  if (high - low <= 10 && high >= 10 && high <= 46) {
    removed[k] = 1;
    queue.push(k);
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
for (let i = 0; i < queue.length; i++) {
  const k = queue[i],
    x = k % w,
    y = Math.floor(k / w);
  add(x - 1, y);
  add(x + 1, y);
  add(x, y - 1);
  add(x, y + 1);
}
const atlas = new PNG({ width: meta.frameWidth * 8, height: meta.frameHeight });
for (const [frame, f] of meta.frames.entries()) {
  for (let y = 0; y < meta.frameHeight; y++)
    for (let x = 0; x < meta.frameWidth; x++) {
      const sx = Math.round(f.anchor[0] + (x - meta.anchorX) / meta.scale);
      const sy = Math.round(f.anchor[1] + (y - meta.anchorY) / meta.scale);
      if (
        !f.regions.some(
          ([left, top, width, height]) =>
            sx >= left && sx < left + width && sy >= top && sy < top + height,
        )
      )
        continue;
      if (removed[sy * w + sx]) continue;
      const si = (sy * w + sx) * 4,
        di = (y * atlas.width + frame * meta.frameWidth + x) * 4;
      source.data.copy(atlas.data, di, si, si + 3);
      atlas.data[di + 3] = 255;
    }
}
writeFileSync(`public/${meta.asset}`, PNG.sync.write(atlas));
console.log(
  'Prepared eight combined super-jump poses, 160×160, anchored at Jimmy’s paws.',
);
