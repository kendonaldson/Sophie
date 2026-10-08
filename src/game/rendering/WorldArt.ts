import Phaser from 'phaser';
import type { LevelDefinition, PlatformDefinition } from '../levels/types';
const colors = {
  ink: 0x293e44,
  roof: 0x455557,
  roofLight: 0x65716a,
  gold: 0xe8c386,
};
const rect = (
  g: Phaser.GameObjects.Graphics,
  color: number,
  x: number,
  y: number,
  w: number,
  h: number,
) => g.fillStyle(color).fillRect(Math.round(x), Math.round(y), w, h);
export class WorldArt {
  private sky: Phaser.GameObjects.Graphics;
  private far: Phaser.GameObjects.Graphics;
  private near: Phaser.GameObjects.Graphics;
  private size = '';
  constructor(scene: Phaser.Scene, level: LevelDefinition) {
    this.sky = scene.add.graphics().setScrollFactor(0).setDepth(-30);
    this.far = scene.add.graphics().setScrollFactor(0).setDepth(-20);
    this.near = scene.add.graphics().setScrollFactor(0).setDepth(-10);
    const g = scene.add.graphics().setDepth(0);
    level.platforms.forEach((p, i) => this.building(g, p, i));
    if (level.atticOpening)
      this.attic(g, level.atticOpening.x, level.atticOpening.y);
    this.door(g, level.exit.x, level.exit.y);
    // Decorative chimneys and vents sit behind the walkable roof silhouette.
  }
  update(width: number, height: number, scrollX: number) {
    const size = `${width}:${height}`;
    if (size !== this.size) {
      this.size = size;
      const g = this.sky;
      g.clear();
      const bands = [
        0xa6b9ae, 0xbac5b3, 0xcbd0b9, 0xdad7bc, 0xe6dcc2, 0xebd7bb,
      ];
      bands.forEach((c, i) =>
        rect(
          g,
          c,
          0,
          Math.floor((i * height) / 6),
          width,
          Math.ceil(height / 6) + 1,
        ),
      );
      const sunX = Math.round(width * 0.72),
        sunY = Math.round(height * 0.28);
      for (let y = -27; y <= 27; y += 2) {
        const half = Math.round(Math.sqrt(27 * 27 - y * y));
        rect(g, 0xf6e6b8, sunX - half, sunY + y, half * 2, 2);
      }
      [
        [0.13, 0.23, 88],
        [0.52, 0.14, 68],
        [0.87, 0.38, 104],
      ].forEach(([x, y, w]) => {
        rect(
          g,
          0xe4dec2,
          Math.round(width * x!),
          Math.round(height * y!),
          w!,
          3,
        );
        rect(
          g,
          0xe4dec2,
          Math.round(width * x!) + 10,
          Math.round(height * y!) - 3,
          w! - 29,
          3,
        );
      });
      // Two distant birds, drawn as stepped silhouettes.
      for (let i = 0; i < 3; i++) {
        const x = width * 0.38 + i * 13,
          y = height * 0.22 + (i % 2) * 5;
        rect(g, 0x718985, x, y, 3, 1);
        rect(g, 0x718985, x + 3, y + 1, 2, 1);
        rect(g, 0x718985, x + 5, y, 3, 1);
      }
    }
    this.drawSkyline(
      this.far,
      width,
      height,
      scrollX * 0.12,
      0x95aaa2,
      height * 0.67,
      29,
    );
    this.drawSkyline(
      this.near,
      width,
      height,
      scrollX * 0.25,
      0x788f89,
      height * 0.83,
      57,
    );
  }
  private drawSkyline(
    g: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    offset: number,
    color: number,
    baseline: number,
    seed: number,
  ) {
    g.clear();
    const unit = 97,
      start = Math.floor(offset / unit);
    for (let i = start; i < start + Math.ceil(width / unit) + 2; i++) {
      const hash = ((i + 13) * 47 + seed) % 101,
        x = Math.floor(i * unit - offset),
        h = 35 + hash * 0.55,
        w = 65 + (hash % 24),
        y = Math.round(baseline - h);
      rect(g, color, x, y, w, height - y);
      rect(g, color, x + 8, y - 6, w - 16, 6);
      rect(g, color, x + w - 16, y - 18, 6, 18);
      if (i % 3 === 0) {
        rect(g, color, x + 14, y - 23, 1, 23);
        rect(g, color, x + 8, y - 20, 14, 1);
      }
      g.fillStyle(0xe0cba1, 0.18);
      for (let wy = y + 16; wy < height; wy += 24)
        for (let wx = x + 10; wx < x + w - 8; wx += 18)
          g.fillRect(wx, wy, 5, 8);
    }
  }
  private building(
    g: Phaser.GameObjects.Graphics,
    p: PlatformDefinition,
    index: number,
  ) {
    const { x, y, width: w, height: h } = p;
    const wall =
      p.style === 'warehouse'
        ? 0x627d7a
        : p.style === 'brick'
          ? 0xa17b69
          : [0xc4b297, 0xb2b6a0, 0xc7a78d][index % 3]!;
    rect(g, wall, x, y + 12, w, h - 12);
    rect(g, 0x263e45, x, y, w, 7);
    rect(g, 0x89968a, x, y, w, 2);
    rect(g, colors.roof, x, y + 7, w, 18);
    rect(g, colors.roofLight, x + 2, y + 8, w - 4, 2);
    for (let tx = x + 8; tx < x + w; tx += 18) {
      rect(g, 0x586566, tx, y + 13, 13, 1);
      rect(g, 0x394d52, tx + 4, y + 19, 12, 1);
    }
    rect(g, 0x384f54, x, y + 25, w, 4);
    rect(g, 0x283e46, x + 4, y + 29, 5, h - 29);
    rect(g, 0x284049, x + w - 8, y + 29, 5, h - 29);
    if (p.style === 'warehouse') {
      for (let bx = x + 18; bx < x + w - 20; bx += 18)
        rect(g, 0x536f70, bx, y + 35, 2, h - 35);
      for (let wx = x + 30; wx < x + w - 35; wx += 66)
        this.window(g, wx, y + 63, 36, 46, true);
      this.vent(g, x + 72, y, 40);
      this.vent(g, x + 186, y, 28);
      rect(g, 0x536968, x + 250, y - 120, 23, 120);
      rect(g, 0x344d53, x + 247, y - 124, 29, 7);
      rect(g, 0x9aa99c, x + 253, y - 111, 4, 108);
    } else {
      for (let wy = y + 48; wy < y + h; wy += 70)
        for (let wx = x + 29; wx < x + w - 25; wx += 64)
          this.window(g, wx, wy, 22, 32, index % 2 === 0);
      if (p.style === 'brick')
        for (let by = y + 34; by < y + h; by += 14)
          for (
            let bx = x + 13 + (Math.floor(by / 14) % 2) * 12;
            bx < x + w - 10;
            bx += 27
          ) {
            g.fillStyle(0x765e58, 0.25).fillRect(bx, by, 20, 1);
          }
      if (index > 0 && w > 180) this.chimney(g, x + w - 72, y);
      if (index === 3 || index === 6) {
        rect(g, 0x586457, x + 30, y - 10, 20, 10);
        rect(g, 0x899775, x + 28, y - 17, 24, 9);
        rect(g, 0xabc095, x + 33, y - 20, 15, 5);
      }
    }
    // Tiny directional route markers retain the same pixel vocabulary as the roofs.
    if (index === 3 || index === 4 || index === 5 || index === 6) {
      const sx = x + 70;
      rect(g, 0x465b58, sx, y - 31, 2, 31);
      rect(g, 0xe6c688, sx - 12, y - 32, 28, 15);
      rect(g, 0x56635a, sx - 5, y - 26, 13, 2);
      rect(g, 0x56635a, sx + 6, y - 29, 2, 2);
      rect(g, 0x56635a, sx + 8, y - 27, 2, 4);
      rect(g, 0x56635a, sx + 6, y - 23, 2, 2);
    }
  }
  private window(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    lit: boolean,
  ) {
    rect(g, 0x647068, x - 3, y - 3, w + 6, h + 6);
    rect(g, colors.ink, x, y, w, h);
    rect(g, lit ? 0xd7be87 : 0x829991, x + 3, y + 3, w - 6, h - 6);
    rect(g, 0x4e605e, x + w / 2 - 1, y + 2, 2, h - 4);
    rect(g, 0x4e605e, x + 2, y + h * 0.5, w - 4, 2);
    rect(g, 0xd0c3a4, x - 4, y + h + 2, w + 8, 3);
  }
  private chimney(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    rect(g, 0x8d7467, x, y - 37, 25, 37);
    rect(g, 0x655e56, x - 3, y - 41, 31, 6);
    for (let row = 0; row < 4; row++) {
      rect(g, 0x6c645a, x + 2, y - 31 + row * 8, 21, 1);
      rect(g, 0xb29b80, x + 4 + (row % 2) * 10, y - 29 + row * 8, 1, 6);
    }
  }
  private vent(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
  ) {
    rect(g, 0x8c9d8f, x, y - 18, w, 18);
    rect(g, 0xb9bea4, x - 3, y - 21, w + 6, 4);
    for (let i = 4; i < w - 3; i += 5) rect(g, 0x4b696b, x + i, y - 13, 2, 9);
  }
  private attic(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    rect(g, 0x9c917b, x, y - 66, 72, 66);
    g.fillStyle(0x455557).fillPoints(
      [
        { x: x - 10, y: y - 66 },
        { x: x + 36, y: y - 97 },
        { x: x + 82, y: y - 66 },
      ],
      true,
    );
    rect(g, 0x718077, x - 10, y - 67, 92, 4);
    rect(g, 0xddd0ab, x + 20, y - 60, 33, 50);
    rect(g, 0x283e43, x + 24, y - 56, 25, 43);
    rect(g, 0x6d7160, x + 27, y - 51, 19, 5);
    rect(g, 0xeac38a, x + 33, y - 47, 11, 34);
    rect(g, 0x526863, x + 9, y - 55, 11, 44);
    rect(g, 0x81927d, x + 9, y - 55, 3, 44);
    rect(g, 0x536660, x + 53, y - 54, 13, 45);
    rect(g, 0x85957d, x + 63, y - 54, 3, 45);
    rect(g, 0xd4c59f, x + 16, y - 10, 43, 5);
    rect(g, 0x293e44, x - 4, y - 3, 81, 3);
  }
  private door(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    rect(g, 0x435d60, x - 18, y - 16, 83, 88);
    rect(g, 0x263f46, x - 24, y - 21, 95, 7);
    rect(g, 0x9ba794, x - 5, y - 3, 58, 75);
    rect(g, 0x172f38, x, y, 48, 72);
    rect(g, 0xd3b17e, x + 7, y + 6, 32, 66);
    rect(g, 0x8a775c, x + 12, y + 6, 27, 66);
    rect(g, 0x283f45, x + 18, y + 6, 21, 66);
    rect(g, 0xe7c789, x + 20, y + 30, 2, 3);
    rect(g, 0xd9c49a, x + 7, y - 14, 32, 7);
    rect(g, 0x7d8d7d, x + 11, y - 12, 24, 2);
    rect(g, 0xf0d396, x - 13, y + 14, 4, 8);
    rect(g, 0x263f46, x - 14, y + 11, 6, 3);
  }
}
