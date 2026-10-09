import type Phaser from 'phaser';
/** Shared summit city: identical geometry, with daylight replacing the night palette. */
export function drawSkyscraperCity(
  g: Phaser.GameObjects.Graphics,
  viewX: number,
  viewY: number,
  width: number,
  height: number,
  daylight = false,
) {
  const tone = (night: number, day: number) => (daylight ? day : night);
  g.clear().setPosition(Math.round(viewX), Math.round(viewY));
  const altitude = Math.max(
    0,
    Math.min(1, (4300 - viewY - height * 0.72) / 3800),
  );
  for (const [i, color] of [
    tone(0x172c3a, 0x98c5cc),
    tone(0x1d3443, 0xafd1cf),
    tone(0x243e4b, 0xc5dbd0),
    tone(0x2b4853, 0xe0e3c9),
  ].entries())
    g.fillStyle(color).fillRect(0, (i * height) / 4, width, height / 4 + 1);
  if (!daylight)
    for (let i = 0; i < 34; i++)
      g.fillStyle(0xb5c4bc, 0.2 + altitude * 0.55).fillRect(
        (i * 127 + 19) % width,
        (i * 43 + 13) % 155,
        1 + (i % 4 === 0 ? 1 : 0),
        1,
      );
  const horizon = 130 + altitude * 45;
  for (let i = -1; i < 19; i++) {
    const x = Math.round(i * 47 - ((viewX * 0.025) % 47)),
      h = 24 + ((i * 37 + 200) % 75);
    g.fillStyle(
      i % 3 ? tone(0x304b56, 0x78999f) : tone(0x35515b, 0x87a4a5),
    ).fillRect(x, horizon - h, 38, h + 75);
    for (let yy = horizon - h + 8; yy < horizon + 10; yy += 12)
      for (let xx = x + 6; xx < x + 31; xx += 11)
        if ((xx + yy + i) % 3 !== 0)
          g.fillStyle(
            tone(0xbaa87b, 0xc0c9b2),
            0.18 + altitude * 0.25,
          ).fillRect(xx, yy, 2, 3);
  }
  // Oblique street grid compresses with altitude, revealing additional blocks.
  const scale = 1 - altitude * 0.55,
    cellW = 151 * scale,
    cellH = 106 * scale;
  g.fillStyle(tone(0x223d48, 0x77999d)).fillRect(
    0,
    horizon + 28,
    width,
    height,
  );
  for (let row = 0; row < Math.ceil(height / cellH) + 1; row++) {
    const y = Math.round(horizon + 25 + row * cellH);
    for (let col = -2; col < Math.ceil(width / cellW) + 1; col++) {
      const x = Math.round(
        col * cellW + row * 25 * scale - ((viewX * 0.11) % cellW),
      );
      const w = Math.round(102 * scale),
        d = Math.round(33 * scale),
        h = Math.round((24 + ((col * 13 + row * 21 + 120) % 36)) * scale);
      g.lineStyle(Math.max(2, 7 * scale), tone(0x3c5358, 0xb2c0b5)).lineBetween(
        x - 20,
        y + 63 * scale,
        x + cellW,
        y + 42 * scale,
      );
      g.fillStyle(tone(0x304851, 0x849e9e)).fillRect(x, y - h, w, d + h);
      g.fillStyle(tone(0x526768, 0xc1c9b4)).fillPoints(
        [
          { x, y: y - h },
          { x: x + w, y: y - h - 15 * scale },
          { x: x + w, y: y + d - h - 15 * scale },
          { x, y: y + d - h },
        ],
        true,
      );
      g.fillStyle(tone(0x687976, 0xd2d5be), 0.7).fillRect(
        x + 12 * scale,
        y - h + 3 * scale,
        23 * scale,
        10 * scale,
      );
      g.fillStyle(tone(0x809083, 0xa7b6a3), 0.45).fillRect(
        x + 54 * scale,
        y - h - 2 * scale,
        15 * scale,
        8 * scale,
      );
      for (let wx = x + 6; wx < x + w - 5; wx += 13 * scale)
        g.fillStyle(
          tone(0xd7be83, 0x829c99),
          daylight ? 0.25 : 0.36 + altitude * 0.22,
        ).fillRect(
          Math.round(wx),
          Math.round(y + d - h + 4 * scale),
          Math.max(1, 3 * scale),
          Math.max(1, 3 * scale),
        );
      g.fillStyle(tone(0xe4bd78, 0xcbb781), 0.65).fillRect(
        Math.round(x - 10 * scale),
        Math.round(y + 47 * scale),
        2,
        2,
      );
      if (row === 1 && col % 3 === 0) {
        g.fillStyle(tone(0x41655d, 0x739582)).fillRect(
          x - 17 * scale,
          y + 16 * scale,
          13 * scale,
          10 * scale,
        );
        g.fillStyle(tone(0x527167, 0x97b296)).fillRect(
          x - 14 * scale,
          y + 10 * scale,
          8 * scale,
          10 * scale,
        );
      }
      if (row === 2 && col === 2) {
        g.fillStyle(tone(0x6a6857, 0xa4987e)).fillRect(
          x + 5 * scale,
          y + 11 * scale,
          80 * scale,
          24 * scale,
        );
        g.fillStyle(tone(0xc29856, 0xdab578))
          .fillRect(x + 11 * scale, y + 10 * scale, 13 * scale, 9 * scale)
          .fillRect(x + 47 * scale, y + 20 * scale, 19 * scale, 5 * scale);
        g.lineStyle(Math.max(1, 2 * scale), tone(0xaaa080, 0xc1b898))
          .lineBetween(
            x + 67 * scale,
            y + 23 * scale,
            x + 67 * scale,
            y - 35 * scale,
          )
          .lineBetween(
            x + 38 * scale,
            y - 35 * scale,
            x + 90 * scale,
            y - 35 * scale,
          );
      }
    }
  }
}
