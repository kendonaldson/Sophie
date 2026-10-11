import type Phaser from 'phaser';
import type { LevelDefinition, PlatformDefinition } from '../levels/types';
import type { Machinery } from '../machinery/Machinery';
import type { FactoryCamera } from './FactoryCamera';

/** Platforms and glowing mouths match their real collision edges. Background
 * equipment stays darker so suspended, playable surfaces read at a glance. */
export class FactoryArt {
  private readonly backdrop: Phaser.GameObjects.Graphics;
  private readonly moving: Phaser.GameObjects.Graphics;
  constructor(
    scene: Phaser.Scene,
    private readonly level: LevelDefinition,
    private readonly machinery: Machinery,
  ) {
    this.backdrop = scene.add.graphics().setDepth(-30);
    this.moving = scene.add.graphics().setDepth(2);
    const g = scene.add.graphics().setDepth(0);
    for (const p of level.platforms) this.platform(g, p);
    for (const oven of level.factory!.ovens) {
      const { x, y, width: w, height: h } = oven;
      g.fillStyle(0x1c1620).fillRect(x - 14, y - 77, w + 28, h + 93);
      g.fillStyle(0x83503b).fillRect(x - 10, y - 73, w + 20, h + 85);
      for (let row = y - 71; row < y + h + 10; row += 16) {
        g.fillStyle(0x4b3330).fillRect(x - 10, row + 14, w + 20, 2);
        for (
          let col = x - 9 + (Math.floor(row / 16) % 2) * 16;
          col < x + w + 10;
          col += 32
        )
          g.fillRect(col, row, 2, 14);
      }
      g.fillStyle(0x333a3c).fillRect(x + w / 2 - 17, y - 160, 34, 82);
      g.fillStyle(0x72766b).fillRect(x + w / 2 - 22, y - 165, 44, 6);
      g.fillStyle(0xf1b36b).fillRect(x - 4, y - 4, w + 8, h + 8);
      g.fillStyle(0x462027).fillRect(x, y, w, h);
      g.fillStyle(0xe4753c).fillRect(x + 3, y + h - 9, w - 6, 6);
      for (let px = x + 6; px < x + w; px += 18)
        g.fillStyle(0xffd786).fillRect(px, y + h - 13, 7, 8);
      g.fillStyle(0x283b3b).fillRect(x - 8, y - 56, w + 16, 29);
      scene.add
        .text(x + w / 2, y - 51, 'HOT', {
          fontFamily: 'monospace',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#ffe0a0',
        })
        .setOrigin(0.5, 0)
        .setDepth(1);
    }
    const exit = level.exit;
    g.fillStyle(0x91bcb0).fillRect(
      exit.x - 9,
      exit.y - 10,
      exit.width + 18,
      exit.height + 10,
    );
    g.fillStyle(0x193337).fillRect(exit.x, exit.y, exit.width, exit.height);
    g.fillStyle(0xe3cea1).fillRect(exit.x + 8, exit.y + 8, exit.width - 16, 8);
    g.fillStyle(0x5f9b8a).fillRect(
      exit.x - 9,
      exit.y - 39,
      exit.width + 18,
      23,
    );
    for (const [label, x, y, color] of [
      ["SHELLY'S / FRESH PIZZA", 54, 795, '#efd8a4'],
      ['01  /  THE PRODUCTION LINE', 680, 842, '#c3be99'],
      ['QUALITY CONTROL', 4320, 801, '#e5ca94'],
      ['02  /  THE DINNER RUSH', 4930, 805, '#b8d1b4'],
      ['DELIVERY EXIT  →', exit.x - 6, exit.y - 36, '#f3e7c6'],
    ] as const)
      scene.add
        .text(x, y, label, {
          fontFamily: 'monospace',
          fontSize: '13px',
          fontStyle: 'bold',
          color,
        })
        .setDepth(1);
    // A flour sack and tiled prep edge mark the stationary midpoint refuge.
    g.fillStyle(0xe3d7b1).fillRect(5030, 923, 34, 37);
    g.fillStyle(0xa28c65)
      .fillRect(5033, 927, 28, 4)
      .fillRect(5041, 940, 12, 12);
  }
  private platform(g: Phaser.GameObjects.Graphics, p: PlatformDefinition) {
    const { x, y, width: w, height: h } = p;
    if (p.style === 'factory-hood') {
      g.fillStyle(0x384347).fillRect(x, y, w, h);
      g.fillStyle(0x7b8d85).fillRect(x - 10, y + h - 18, w + 20, 18);
      g.fillStyle(0xc8c7aa).fillRect(x - 10, y + h - 4, w + 20, 4);
      for (let px = x + 12; px < x + w; px += 20)
        g.fillStyle(0x202e34).fillRect(px, h - 50, 8, 23);
      return;
    }
    if (p.style === 'crate') {
      g.fillStyle(0xb98b5c).fillRect(x, y, w, h);
      g.fillStyle(0xead0a2).fillRect(x, y, w, 4);
      g.lineStyle(3, 0x6c5441).lineBetween(x + 3, y + 5, x + w - 3, y + h - 3);
      return;
    }
    const prep = p.style === 'prep';
    g.fillStyle(0x161c24).fillRect(x - 3, y, w + 6, h + 5);
    g.fillStyle(prep ? 0x637975 : 0x496366).fillRect(x, y, w, h);
    g.fillStyle(prep ? 0xe8ddbe : 0xd5bc84).fillRect(x, y, w, 4);
    g.fillStyle(0x28373c).fillRect(x, y + h - 6, w, 6);
    for (let px = x + 8; px < x + w; px += 38) {
      g.fillStyle(prep ? 0x9da790 : 0x222c32).fillRect(px, y + 7, 22, 11);
      if (prep) g.fillStyle(0xd4d5b9).fillRect(px - 2, y, 2, 4);
    }
    for (const px of [x + 22, x + w - 22]) {
      g.lineStyle(3, 0x627470, 0.65).lineBetween(px, y - 210, px, y - 2);
      for (let py = y - 208; py < y; py += 14)
        g.fillStyle(0x8b8b75, 0.7).fillRect(px - 3, py, 6, 4);
    }
  }
  update(view: FactoryCamera, elapsed: number) {
    const g = this.backdrop;
    const left = Math.floor(view.x),
      top = Math.floor(view.y),
      w = view.width,
      h = view.height;
    g.clear()
      .fillStyle(0x291e27)
      .fillRect(left - 20, top - 20, w + 40, h + 40);
    g.fillStyle(0x3c3031).fillRect(left, top, w, h * 0.62);
    for (
      let x = left - ((left * 0.23) % 240) - 240;
      x < left + w + 240;
      x += 240
    ) {
      g.fillStyle(0x48413b).fillRect(Math.round(x), top, 12, h);
      for (
        let row = top - ((top * 0.18) % 96) - 96;
        row < top + h * 0.63;
        row += 96
      ) {
        g.fillStyle(0x635746, 0.24).fillRect(
          Math.round(x + 22),
          Math.round(row + 4),
          206,
          1,
        );
        g.fillStyle(0x645544, 0.17).fillRect(
          Math.round(x + 100),
          Math.round(row + 4),
          1,
          90,
        );
      }
      g.fillStyle(0xe0ac65, 0.065).fillTriangle(
        x + 80,
        top + 22,
        x - 20,
        top + 260,
        x + 210,
        top + 260,
      );
      g.fillStyle(0x9e8f67).fillRect(Math.round(x + 68), top + 20, 30, 5);
      const my = top + h * 0.53;
      g.fillStyle(0x4b4440).fillRect(
        Math.round(x + 38),
        Math.round(my),
        156,
        76,
      );
      g.fillStyle(0x76553e).fillRect(
        Math.round(x + 53),
        Math.round(my + 18),
        126,
        36,
      );
      g.fillStyle(0xb47542, 0.5).fillRect(
        Math.round(x + 59),
        Math.round(my + 46),
        114,
        5,
      );
      g.fillStyle(0x22202a).fillRect(
        Math.round(x + 47),
        Math.round(my + 78),
        141,
        40,
      );
    }
    const m = this.moving;
    m.clear();
    for (const belt of this.level.conveyors ?? []) {
      const p = this.level.platforms.find((p) => p.id === belt.platformId)!;
      const direction = Math.sign(belt.speed);
      const phase =
        ((((this.machinery.elapsed * belt.speed) / 1000) % 26) + 26) % 26;
      for (let x = p.x + 7 + phase; x < p.x + p.width - 12; x += 26)
        m.lineStyle(2, belt.speed > 0 ? 0xf5d08a : 0x93c3bc)
          .lineBetween(
            Math.round(x),
            p.y + 7,
            Math.round(x + direction * 6),
            p.y + 12,
          )
          .lineBetween(
            Math.round(x + direction * 6),
            p.y + 12,
            Math.round(x),
            p.y + 17,
          );
    }
    for (const tray of this.machinery.surfaces) {
      const x = Math.round(tray.x),
        y = Math.round(tray.y);
      m.fillStyle(0xa5b8ad).fillRect(x, y, tray.width, 5);
      m.fillStyle(0x566e6c).fillRect(x + 4, y + 5, tray.width - 8, 9);
      m.fillStyle(0xe4b666).fillEllipse(
        x + tray.width / 2,
        y + 2,
        tray.width - 24,
        8,
      );
      m.fillStyle(0xb85038);
      for (let px = x + 28; px < x + tray.width - 18; px += 26)
        m.fillRect(px, y, 6, 3);
    }
    for (const oven of this.level.factory!.ovens) {
      const pulse = 0.2 + Math.sin(elapsed / 160) * 0.06;
      m.fillStyle(0xffa33f, pulse).fillRect(
        oven.x,
        oven.y,
        oven.width,
        oven.height,
      );
      for (let i = 0; i < 3; i++) {
        const x = oven.x + ((i + 0.5) * oven.width) / 3;
        const rise = (elapsed / 28 + i * 11) % 38;
        m.fillStyle(0xffd398, 0.25 * (1 - rise / 38)).fillRect(
          Math.round(x + Math.sin(elapsed / 180 + i) * 3),
          Math.round(oven.y - rise),
          2,
          8,
        );
      }
    }
  }
}
