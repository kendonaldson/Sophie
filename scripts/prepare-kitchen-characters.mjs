/** Measured poses, shared paw anchors, nearest-neighbor sampling. These supplied
 * presentation sheets already have alpha mattes, but retain faint background
 * haze. Threshold alpha to keep crisp silhouettes and exclude labels per crop.
 * Shelly's sheet says "8" walk frames; it actually contains seven. */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

for (const name of ['shelly', 'pizza']) {
  const meta = JSON.parse(readFileSync(`src/game/${name}/sheet.json`, 'utf8'));
  const source = PNG.sync.read(readFileSync(`public/assets/${meta.source}`));
  if (source.width !== meta.sourceWidth || source.height !== meta.sourceHeight)
    throw new Error(`Remeasure ${meta.source} before preparing its atlas.`);
  const atlas = new PNG({
    width: meta.frameWidth * meta.frames.length,
    height: meta.frameHeight,
  });
  for (const [index, frame] of meta.frames.entries()) {
    const [left, top, width, height] = frame.box;
    for (let y = 0; y < meta.frameHeight; y++)
      for (let x = 0; x < meta.frameWidth; x++) {
        const sx = Math.round(
          frame.anchor[0] + (x - meta.anchorX) / meta.scale,
        );
        const sy = Math.round(
          frame.anchor[1] + (y - meta.anchorY) / meta.scale,
        );
        if (sx < left || sx >= left + width || sy < top || sy >= top + height)
          continue;
        const si = (sy * source.width + sx) * 4;
        if (source.data[si + 3] < meta.alphaThreshold) continue;
        const di = (y * atlas.width + index * meta.frameWidth + x) * 4;
        source.data.copy(atlas.data, di, si, si + 3);
        atlas.data[di + 3] = 255;
      }
  }
  writeFileSync(`public/${meta.asset}`, PNG.sync.write(atlas));
  console.log(
    `Prepared ${meta.frames.length} ${name} poses; source unchanged.`,
  );
}
