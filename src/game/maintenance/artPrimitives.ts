import type Phaser from 'phaser';
import type { Rect } from '../player/CollisionAssist';

type Graphics = Phaser.GameObjects.Graphics;
export const tunnelPalette = {
  wall: 0x303d43,
  panel: 0x3c4c50,
  seam: 0x26353a,
  steel: 0x60777a,
  steelLight: 0xa0b4a9,
  copper: 0xb77a51,
  copperLight: 0xe4b17b,
  cream: 0xf3dba4,
  orange: 0xee9d54,
  green: 0xa5d58d,
  red: 0xe87d63,
} as const;

export function grate(g: Graphics, r: Rect) {
  g.fillStyle(tunnelPalette.seam).fillRect(r.x, r.y, r.width, r.height);
  g.fillStyle(0x708783).fillRect(r.x, r.y, r.width, 3);
  for (let y = r.y + 7; y < r.y + r.height - 3; y += 7)
    g.fillStyle(0x475e60).fillRect(r.x + 4, y, r.width - 8, 2);
  for (const x of [r.x + 3, r.x + r.width - 5])
    for (const y of [r.y + 3, r.y + r.height - 5])
      g.fillStyle(0x9aad9f).fillRect(x, y, 2, 2);
}

export function floor(g: Graphics, r: Rect) {
  const { x, y, width: w, height: h } = r;
  g.fillStyle(0x35474b).fillRect(x, y, w, h);
  g.fillStyle(0x52696b).fillRect(x, y + 8, w, 22);
  g.fillStyle(0xc5c6a4).fillRect(x, y, w, 4);
  g.fillStyle(0x849a8d).fillRect(x, y + 4, w, 4);
  g.fillStyle(0x23373d).fillRect(x, y + 28, w, 6);
  for (let px = x + 10; px < x + w - 5; px += 32) {
    g.fillStyle(0xb1b69c).fillRect(px, y + 13, 3, 3);
    g.fillStyle(0x31484d).fillRect(px + 7, y + 10, 14, 7);
  }
  for (let px = x + 28; px < x + w - 70; px += 138) {
    grate(g, { x: px, y: y + 63, width: 88, height: 52 });
    g.fillStyle(0x2b3f45).fillRect(px + 39, y + 118, 10, h - 118);
    g.fillStyle(0x4b6162).fillRect(px + 40, y + 118, 3, h - 118);
  }
  // Bright vertical end caps distinguish solid landings from furnace openings.
  for (const px of [x, x + w - 7]) {
    g.fillStyle(0x82958a).fillRect(px, y + 4, 7, 88);
    for (let py = y + 12; py < y + 87; py += 18)
      g.fillStyle(0xd7b975).fillRect(px, py, 7, 8);
  }
}

export function pipe(g: Graphics, r: Rect) {
  const { x, y, width: w, height: h } = r;
  g.fillStyle(0x603f36).fillRect(x, y, w, h);
  g.fillStyle(tunnelPalette.copper).fillRect(x + 3, y + 4, w - 6, h - 4);
  g.fillStyle(tunnelPalette.copperLight).fillRect(x + 6, y + 6, 5, h - 6);
  g.fillStyle(0x976042).fillRect(x + w - 9, y + 6, 5, h - 6);
  // The cap follows the exact collision width and top of this low obstacle.
  g.fillStyle(0xdda370).fillRect(x, y, w, 7);
  g.fillStyle(0xffd696).fillRect(x + 2, y, w - 4, 3);
  g.fillStyle(0x845444).fillRect(x, y + h - 5, w, 5);
  for (const px of [x + 3, x + w - 6])
    g.fillStyle(0xe3bb82).fillRect(px, y + h - 4, 3, 3);
}

export function valve(g: Graphics, x: number, y: number, turn: number) {
  g.fillStyle(0x593e35).fillRect(x - 10, y - 10, 20, 20);
  g.fillStyle(0xc98354)
    .fillRect(x - 10, y - 8, 20, 16)
    .fillRect(x - 8, y - 10, 16, 20);
  g.fillStyle(0x59493d).fillRect(x - 6, y - 6, 12, 12);
  for (let i = 0; i < 4; i++) {
    const angle = turn + (i * Math.PI) / 2;
    g.fillStyle(0xe9b27a).fillRect(
      Math.round(x + Math.cos(angle) * 5) - 2,
      Math.round(y + Math.sin(angle) * 5) - 2,
      4,
      4,
    );
  }
  g.fillStyle(0xf5d79c).fillRect(x - 2, y - 2, 4, 4);
}

export function gauge(g: Graphics, x: number, y: number, pressure: number) {
  g.fillStyle(0x243237).fillRect(x - 15, y - 14, 30, 28);
  g.fillStyle(0xa6b4a0).fillRect(x - 13, y - 12, 26, 24);
  g.fillStyle(0xe3d7ac).fillRect(x - 10, y - 9, 20, 18);
  g.fillStyle(0x8db481).fillRect(x - 8, y - 7, 5, 3);
  g.fillStyle(0xe9a860).fillRect(x - 2, y - 8, 5, 3);
  g.fillStyle(0xc76c50).fillRect(x + 5, y - 5, 3, 4);
  const angle = Math.PI * (1.17 + pressure * 0.66);
  const endX = Math.round(x + Math.cos(angle) * 8);
  const endY = Math.round(y + 4 + Math.sin(angle) * 9);
  g.lineStyle(2, 0x41484a).lineBetween(x, y + 4, endX, endY);
  g.fillStyle(0x41484a).fillRect(x - 1, y + 3, 3, 3);
}

/** Stepped silhouettes keep steam crisp at the same scale as the world. */
export function puff(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  alpha: number,
) {
  const left = Math.round(x - width / 2),
    top = Math.round(y);
  g.fillStyle(0xf7eaca, alpha)
    .fillRect(left + 4, top, width - 8, 5)
    .fillRect(left, top + 5, width, 8)
    .fillRect(left + 3, top + 13, width - 6, 5);
}
