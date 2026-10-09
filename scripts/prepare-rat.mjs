/** Four measured right-facing run poses from the supplied transparent sheet.
 * Keep the torso centered and paws on a shared baseline; the tail and nose
 * remain visual detail. Left-facing motion mirrors these same supplied poses. */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const source = PNG.sync.read(readFileSync('public/assets/rat.png'));
if (source.width !== 2172 || source.height !== 724)
  throw new Error('Remeasure the rat sheet before changing its source layout.');

const frames = [
  { box: [8, 296, 508, 208], anchor: [330, 502] },
  { box: [554, 286, 508, 218], anchor: [875, 502] },
  { box: [1098, 286, 502, 231], anchor: [1420, 515] },
  { box: [1644, 297, 502, 216], anchor: [1960, 511] },
];
const size = 64,
  scale = 0.095,
  anchorX = 32,
  footY = 56,
  atlas = new PNG({ width: size * frames.length, height: size });

for (const [index, frame] of frames.entries()) {
  const [left, top, width, height] = frame.box;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const sx = Math.round(frame.anchor[0] + (x - anchorX) / scale),
        sy = Math.round(frame.anchor[1] + (y - footY) / scale);
      if (sx < left || sx >= left + width || sy < top || sy >= top + height)
        continue;
      const si = (sy * source.width + sx) * 4,
        di = (y * atlas.width + index * size + x) * 4;
      source.data.copy(atlas.data, di, si, si + 4);
    }
}

writeFileSync('public/assets/rat-atlas.png', PNG.sync.write(atlas));
console.log(
  'Prepared 4 rat run poses with a shared torso center and paw baseline.',
);
