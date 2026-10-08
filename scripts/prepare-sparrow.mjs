/** Measured regions and body anchors from the supplied 1448 × 1086 sheet.
 * Preserve the original; crop labels away, retain alpha, and sample nearest pixels.
 * The body anchors keep wing poses from bobbing the collision center. */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const source = PNG.sync.read(readFileSync('public/assets/sparrow-sprite.png'));
if (source.width !== 1448 || source.height !== 1086)
  throw new Error(
    'Remeasure the sparrow sheet before changing its source layout.',
  );
const frames = [
  { name: 'right-up', box: [220, 52, 270, 288], anchor: [382, 252] },
  { name: 'right-mid', box: [525, 110, 276, 230], anchor: [684, 252] },
  { name: 'right-down', box: [830, 138, 278, 206], anchor: [985, 245] },
  { name: 'right-glide', box: [1148, 138, 295, 200], anchor: [1320, 248] },
  { name: 'left-up', box: [203, 411, 282, 281], anchor: [295, 598] },
  { name: 'left-mid', box: [513, 464, 277, 228], anchor: [610, 610] },
  { name: 'left-down', box: [827, 488, 286, 207], anchor: [935, 600] },
  { name: 'left-glide', box: [1133, 486, 300, 205], anchor: [1235, 596] },
  { name: 'squawk-open', box: [215, 803, 277, 203], anchor: [355, 924] },
  { name: 'squawk-closed', box: [508, 805, 227, 201], anchor: [610, 924] },
];
const scale = 0.14,
  size = 64,
  atlas = new PNG({ width: size * 5, height: size * 2 });
for (const [index, f] of frames.entries()) {
  const [x0, y0, w, h] = f.box;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const sx = Math.round(f.anchor[0] + (x - 32) / scale),
        sy = Math.round(f.anchor[1] + (y - 32) / scale);
      if (sx < x0 || sx >= x0 + w || sy < y0 || sy >= y0 + h) continue;
      const si = (sy * source.width + sx) * 4,
        di =
          ((Math.floor(index / 5) * size + y) * atlas.width +
            (index % 5) * size +
            x) *
          4;
      source.data.copy(atlas.data, di, si, si + 4);
    }
}
writeFileSync('public/assets/sparrow.png', PNG.sync.write(atlas));
console.log(
  'Prepared 8 flight poses and 2 squawk poses, anchored at the body center.',
);
