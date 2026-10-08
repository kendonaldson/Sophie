import type Phaser from 'phaser';
import type { LevelDefinition, PlatformDefinition } from '../levels/types';
import type { Machinery } from '../machinery/Machinery';
/** Repeated steel, timber, window and light motifs keep machinery readable. */
export class WarehouseArt {
  private backdrop: Phaser.GameObjects.Graphics;
  private moving: Phaser.GameObjects.Graphics;
  private door: Phaser.GameObjects.Graphics;
  doorClosed = false;
  constructor(
    scene: Phaser.Scene,
    private readonly level: LevelDefinition,
    private readonly machinery: Machinery,
  ) {
    this.backdrop = scene.add.graphics().setScrollFactor(0).setDepth(-30);
    const structures = scene.add.graphics().setDepth(0);
    for (const p of level.platforms) this.platform(structures, p);
    this.moving = scene.add.graphics().setDepth(2);
    this.door = scene.add.graphics().setDepth(3);
    for (const [text, x, y] of [
      ['LOADING 01', 55, 1220],
      ['FREIGHT ↑', 2170, 1110],
      ['UPPER STORES', 5770, 360],
      ['EXIT →', 9530, 250],
    ] as const)
      scene.add
        .text(x, y, text, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#d9bb78',
          backgroundColor: '#283d43',
          padding: { x: 6, y: 4 },
        })
        .setDepth(1);
  }
  private platform(g: Phaser.GameObjects.Graphics, p: PlatformDefinition) {
    const { x, y, width: w, height: h } = p;
    const box = p.style === 'crate';
    g.fillStyle(box ? 0x9a7957 : 0x3b545b).fillRect(x, y, w, h);
    g.fillStyle(box ? 0xe0b778 : 0xbac7af).fillRect(x, y, w, 3);
    g.fillStyle(0x1b2b33).fillRect(x, y + h - 5, w, 5);
    for (let px = x + 6; px < x + w - 6; px += box ? 16 : 30)
      g.fillStyle(box ? 0x5f4e3f : 0x788e87).fillRect(
        px,
        y + 6,
        box ? 3 : 4,
        box ? h - 10 : 3,
      );
    if (!box)
      for (let px = x + 16; px < x + w; px += 120) {
        g.fillStyle(0x263d47).fillRect(px, y + h, 9, 110);
        g.lineStyle(3, 0x314a54).lineBetween(px, y + 100, px + 70, y + h);
      }
  }
  update(
    width: number,
    height: number,
    scrollX: number,
    scrollY = 0,
    zoom = 1,
  ) {
    const g = this.backdrop;
    g.setScale(1 / zoom).setPosition(
      (width - width / zoom) / 2,
      (height - height / zoom) / 2,
    );
    g.clear();
    g.fillStyle(0x142730).fillRect(0, 0, width, height);
    const offsetX = Math.floor(scrollX * 0.2),
      offsetY = Math.floor(scrollY * 0.16);
    for (let x = (-offsetX % 240) - 240; x < width + 240; x += 240) {
      g.fillStyle(0x243d49).fillRect(x, 0, 12, height);
      for (let y = (-offsetY % 210) - 210; y < height + 210; y += 210) {
        g.fillStyle(0x355661).fillRect(x + 38, y + 22, 140, 84);
        g.fillStyle(0x759493, 0.45).fillRect(x + 42, y + 26, 132, 3);
        for (let wx = x + 68; wx < x + 178; wx += 34)
          g.fillStyle(0x1d333e).fillRect(wx, y + 22, 4, 84);
        g.fillStyle(0x1d333e).fillRect(x + 38, y + 62, 140, 4);
        g.fillStyle(0x1b3039).fillRect(x + 28, y + 137, 175, 60);
        g.fillStyle(0x314b50).fillRect(x + 34, y + 131, 166, 5);
        g.fillStyle(0xe6be72, 0.07).fillTriangle(
          x + 130,
          y + 8,
          x + 55,
          y + 190,
          x + 220,
          y + 190,
        );
        g.fillStyle(0xd2ad6c).fillRect(x + 120, y + 7, 25, 4);
      }
    }
    const m = this.moving;
    m.clear();
    for (const s of this.machinery.surfaces) {
      const y = Math.round(s.y + s.dip),
        x = Math.round(s.x);
      m.lineStyle(2, 0x637c7c)
        .lineBetween(x + 12, y - 190, x + 12, y)
        .lineBetween(x + s.width - 12, y - 190, x + s.width - 12, y);
      m.fillStyle(0x856b4c).fillRect(x, y, s.width, s.height);
      m.fillStyle(0xedc782).fillRect(x, y, s.width, 3);
      m.fillStyle(0x283f46).fillRect(x + 6, y + 8, s.width - 12, 5);
      for (let px = x + 4; px < x + s.width - 4; px += 20)
        m.fillStyle(0xc7a371).fillRect(px, y + 6, 3, 12);
    }
    for (const b of this.level.conveyors ?? []) {
      const p = this.level.platforms.find((p) => p.id === b.platformId)!;
      m.fillStyle(0xe1bd73).fillRect(p.x, p.y, p.width, 3);
      const phase =
        ((((this.machinery.elapsed / 1000) * b.speed) % 24) + 24) % 24;
      for (let x = p.x + phase; x < p.x + p.width - 10; x += 24)
        m.lineStyle(2, 0xdbc18a)
          .lineBetween(x, p.y + 8, x + Math.sign(b.speed) * 6, p.y + 12)
          .lineBetween(x + Math.sign(b.speed) * 6, p.y + 12, x, p.y + 16);
    }
    for (const gate of this.machinery.gates) {
      const d = gate.definition;
      m.fillStyle(0x253e46).fillRect(d.x - 10, d.y - 12, d.width + 20, 12);
      m.fillStyle(gate.open ? 0x9acb96 : 0xe4a568).fillRect(
        d.x - 4,
        d.y - 24,
        8,
        7,
      );
      const h = gate.open ? 12 : d.height;
      m.fillStyle(0x84968a).fillRect(d.x, d.y, d.width, h);
      for (let y = d.y + 5; y < d.y + h; y += 12)
        m.fillStyle(0x455f63).fillRect(d.x, y, d.width, 3);
    }
    const e = this.level.elevator,
      s = this.machinery.elevatorSurface;
    if (e && s) {
      m.lineStyle(3, 0x6d8380).strokeRect(e.x, s.y - 155, e.width, 155);
      m.fillStyle(0x314a52, 0.6).fillRect(e.x, s.y - 155, e.width, 155);
      for (let x = e.x + 12; x < e.x + e.width; x += 20)
        m.lineStyle(1, 0x748982).lineBetween(x, s.y - 151, x, s.y - 4);
      const closed = !['waiting', 'arrived'].includes(
        this.machinery.elevatorState,
      );
      if (closed)
        for (const x of [e.x + 4, e.x + e.width - 14])
          m.fillStyle(0xc4ae79).fillRect(x, s.y - 148, 10, 146);
      m.fillStyle(
        this.machinery.elevatorState === 'arrived' ? 0x98d9ac : 0xe4c78f,
      ).fillRect(e.x + e.width / 2 - 4, s.y - 167, 8, 8);
    }
    this.door.clear();
    const exit = this.level.exit;
    this.door
      .fillStyle(0xb2c5ad)
      .fillRect(exit.x - 6, exit.y - 7, exit.width + 12, exit.height + 7);
    this.door
      .fillStyle(this.doorClosed ? 0x4d6868 : 0xf0d198)
      .fillRect(exit.x, exit.y, exit.width, exit.height);
    this.door
      .fillStyle(0xe2c47f)
      .fillRect(exit.x - 3, exit.y - 18, exit.width + 6, 8);
  }
}
