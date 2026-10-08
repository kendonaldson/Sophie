import type Phaser from 'phaser';
import type { LevelDefinition, PlatformDefinition } from '../levels/types';
import type { Machinery } from '../machinery/Machinery';
import { climbTuning as t } from '../skyscraper/config';
/** Bright, consistent landing edges over quiet angled rooftops and layered city light. */
export class SkyscraperArt {
  private readonly city;
  private readonly moving;
  constructor(
    scene: Phaser.Scene,
    private readonly level: LevelDefinition,
    private readonly machinery: Machinery,
  ) {
    this.city = scene.add.graphics().setDepth(-40);
    const structure = scene.add.graphics().setDepth(-8);
    // Farther steel is decorative: low contrast, thin, with no bright landing edge.
    for (let x = 180; x < level.width; x += 410) {
      structure.fillStyle(0x294451, 0.6).fillRect(x, 380, 12, 4000);
      for (let y = 630; y < 4390; y += 420) {
        structure
          .lineStyle(3, 0x365461, 0.6)
          .lineBetween(x, y, x + 320, y - 190);
        structure.fillStyle(0x3c5760, 0.5).fillRect(x, y, 320, 7);
      }
    }
    const terrain = scene.add.graphics().setDepth(1);
    for (const p of level.platforms) this.platform(terrain, p);
    for (const lift of level.skyscraper!.lifts) {
      structure
        .fillStyle(0x38535c)
        .fillRect(
          lift.x - 14,
          lift.topY - 110,
          8,
          lift.bottomY - lift.topY + 180,
        )
        .fillRect(
          lift.x + lift.width + 6,
          lift.topY - 110,
          8,
          lift.bottomY - lift.topY + 180,
        );
      for (let y = lift.topY - 90; y < lift.bottomY; y += 100)
        structure
          .lineStyle(2, 0x547079)
          .lineBetween(lift.x - 10, y, lift.x + lift.width + 10, y + 65);
    }
    for (const [x, y, direction] of [
      [290, 4205, 1],
      [2100, 3340, -1],
      [570, 2200, 1],
    ]) {
      terrain.fillStyle(0x344954).fillRect(x! - 25, y! - 16, 50, 30);
      terrain
        .lineStyle(3, 0xefc880)
        .lineBetween(x! - direction! * 13, y! + 6, x! + direction! * 13, y! - 6)
        .lineBetween(x! + direction! * 13, y! - 6, x! + direction! * 2, y! - 6)
        .lineBetween(
          x! + direction! * 13,
          y! - 6,
          x! + direction! * 13,
          y! + 5,
        );
    }
    // The crane silhouettes frame the summit without adding new traversal.
    structure
      .fillStyle(0x526b70)
      .fillRect(2160, 265, 9, 225)
      .fillRect(2070, 262, 440, 8);
    structure
      .lineStyle(3, 0x526b70)
      .lineBetween(2070, 262, 2164, 210)
      .lineBetween(2164, 210, 2510, 262)
      .lineBetween(2475, 270, 2475, 370);
    this.moving = scene.add.graphics().setDepth(2);
  }
  private platform(g: Phaser.GameObjects.Graphics, p: PlatformDefinition) {
    if (p.style === 'crate') {
      g.fillStyle(0x705645).fillRect(p.x, p.y, p.width, p.height);
      g.fillStyle(0x9e7d58).fillRect(
        p.x + 5,
        p.y + 4,
        p.width - 10,
        p.height - 8,
      );
      for (let x = p.x + 8; x < p.x + p.width; x += 23)
        g.fillStyle(0x7c624d).fillRect(x, p.y + 6, 2, p.height - 12);
      g.lineStyle(5, 0xb39266).lineBetween(
        p.x + 8,
        p.y + 10,
        p.x + p.width - 8,
        p.y + p.height - 10,
      );
      g.fillStyle(0xe1be83).fillRect(p.x, p.y, p.width, 4);
      return;
    }
    if (p.style === 'steel') {
      this.cargo(g, p.x, p.y, p.width, p.height);
      return;
    }
    g.fillStyle(0x47656c).fillRect(p.x, p.y + 5, p.width, p.height + 1);
    g.fillStyle(0xb79d71).fillRect(p.x, p.y, p.width, 7);
    g.fillStyle(0xe1c999).fillRect(p.x, p.y, p.width, 3);
    for (let x = p.x + 16; x < p.x + p.width; x += 33)
      g.fillStyle(0x776d59).fillRect(x, p.y + 3, 2, 4);
    for (const x of [p.x + 9, p.x + p.width - 13]) {
      g.fillStyle(0x516f76).fillRect(x, p.y + 12, 4, 83);
      g.fillStyle(0x9eb1a4).fillRect(x, p.y + 14, 4, 4);
    }
    g.lineStyle(2, 0x486770).lineBetween(
      p.x + 12,
      p.y + 70,
      p.x + p.width - 12,
      p.y + 23,
    );
    g.fillStyle(0xe4b96c)
      .fillRect(p.x, p.y + 3, 7, 11)
      .fillRect(p.x + p.width - 7, p.y + 3, 7, 11);
    // A small work light and safety mesh provide scale without hiding the edge.
    if (p.width >= 180) {
      g.lineStyle(1, 0x69817b, 0.35).strokeRect(
        p.x + 12,
        p.y + 22,
        p.width - 24,
        43,
      );
      for (let x = p.x + 16; x < p.x + p.width - 15; x += 16)
        g.lineBetween(x, p.y + 22, x, p.y + 65);
      g.fillStyle(0x4d6870).fillRect(p.x + 18, p.y - 56, 3, 55);
      g.fillStyle(0xf0d596).fillRect(p.x + 11, p.y - 58, 18, 4);
      g.fillStyle(0xf0d596, 0.05).fillTriangle(
        p.x + 20,
        p.y - 54,
        p.x - 8,
        p.y,
        p.x + 48,
        p.y,
      );
    }
  }
  private cargo(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    g.lineStyle(2, 0x859086)
      .lineBetween(x + 18, y - 210, x + 18, y)
      .lineBetween(x + w - 18, y - 210, x + w - 18, y);
    g.fillStyle(0x816b53).fillRect(x, y, w, h);
    g.fillStyle(0xa48960).fillRect(x + 5, y + 5, w - 10, h - 10);
    g.lineStyle(3, 0xc2a46f)
      .lineBetween(x + 8, y + 7, x + w - 8, y + h - 7)
      .lineBetween(x + w - 8, y + 7, x + 8, y + h - 7);
    g.fillStyle(0xe7cb92).fillRect(x, y, w, 4);
    g.fillStyle(0x45616a).fillRect(x - 4, y + h - 3, w + 8, 6);
  }
  update(viewX: number, viewY: number) {
    const g = this.city;
    g.clear().setPosition(Math.round(viewX), Math.round(viewY));
    const altitude = Math.max(
      0,
      Math.min(1, (4300 - viewY - t.viewHeight * 0.72) / 3800),
    );
    const width = t.viewWidth,
      height = t.viewHeight;
    for (const [i, color] of [0x172c3a, 0x1d3443, 0x243e4b, 0x2b4853].entries())
      g.fillStyle(color).fillRect(0, (i * height) / 4, width, height / 4 + 1);
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
      g.fillStyle(i % 3 ? 0x304b56 : 0x35515b).fillRect(
        x,
        horizon - h,
        38,
        h + 75,
      );
      for (let yy = horizon - h + 8; yy < horizon + 10; yy += 12)
        for (let xx = x + 6; xx < x + 31; xx += 11)
          if ((xx + yy + i) % 3 !== 0)
            g.fillStyle(0xbaa87b, 0.18 + altitude * 0.25).fillRect(
              xx,
              yy,
              2,
              3,
            );
    }
    // Oblique street grid compresses with altitude, revealing additional blocks.
    const scale = 1 - altitude * 0.55,
      cellW = 151 * scale,
      cellH = 106 * scale;
    g.fillStyle(0x223d48).fillRect(0, horizon + 28, width, height);
    for (let row = 0; row < Math.ceil(height / cellH) + 1; row++) {
      const y = Math.round(horizon + 25 + row * cellH);
      for (let col = -2; col < Math.ceil(width / cellW) + 1; col++) {
        const x = Math.round(
          col * cellW + row * 25 * scale - ((viewX * 0.11) % cellW),
        );
        const w = Math.round(102 * scale),
          d = Math.round(33 * scale),
          h = Math.round((24 + ((col * 13 + row * 21 + 120) % 36)) * scale);
        g.lineStyle(Math.max(2, 7 * scale), 0x3c5358).lineBetween(
          x - 20,
          y + 63 * scale,
          x + cellW,
          y + 42 * scale,
        );
        g.fillStyle(0x304851).fillRect(x, y - h, w, d + h);
        g.fillStyle(0x526768).fillPoints(
          [
            { x, y: y - h },
            { x: x + w, y: y - h - 15 * scale },
            { x: x + w, y: y + d - h - 15 * scale },
            { x, y: y + d - h },
          ],
          true,
        );
        g.fillStyle(0x687976, 0.7).fillRect(
          x + 12 * scale,
          y - h + 3 * scale,
          23 * scale,
          10 * scale,
        );
        g.fillStyle(0x809083, 0.45).fillRect(
          x + 54 * scale,
          y - h - 2 * scale,
          15 * scale,
          8 * scale,
        );
        for (let wx = x + 6; wx < x + w - 5; wx += 13 * scale)
          g.fillStyle(0xd7be83, 0.36 + altitude * 0.22).fillRect(
            Math.round(wx),
            Math.round(y + d - h + 4 * scale),
            Math.max(1, 3 * scale),
            Math.max(1, 3 * scale),
          );
        g.fillStyle(0xe4bd78, 0.65).fillRect(
          Math.round(x - 10 * scale),
          Math.round(y + 47 * scale),
          2,
          2,
        );
        if (row === 1 && col % 3 === 0) {
          g.fillStyle(0x41655d).fillRect(
            x - 17 * scale,
            y + 16 * scale,
            13 * scale,
            10 * scale,
          );
          g.fillStyle(0x527167).fillRect(
            x - 14 * scale,
            y + 10 * scale,
            8 * scale,
            10 * scale,
          );
        }
        if (row === 2 && col === 2) {
          g.fillStyle(0x6a6857).fillRect(
            x + 5 * scale,
            y + 11 * scale,
            80 * scale,
            24 * scale,
          );
          g.fillStyle(0xc29856)
            .fillRect(x + 11 * scale, y + 10 * scale, 13 * scale, 9 * scale)
            .fillRect(x + 47 * scale, y + 20 * scale, 19 * scale, 5 * scale);
          g.lineStyle(Math.max(1, 2 * scale), 0xaaa080)
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
    this.moving.clear();
    for (const s of this.machinery.surfaces) {
      if (this.level.movingPlatforms?.some((p) => p.id === s.id))
        this.cargo(this.moving, s.x, s.y + s.dip, s.width, s.height);
      else {
        const m = this.moving;
        m.lineStyle(2, 0xc3bb93)
          .lineBetween(s.x + 12, s.y - 600, s.x + 12, s.y)
          .lineBetween(s.x + s.width - 12, s.y - 600, s.x + s.width - 12, s.y);
        m.fillStyle(0x446069).fillRect(s.x, s.y, s.width, 20);
        m.fillStyle(0xe4bd78).fillRect(s.x, s.y, s.width, 5);
        m.lineStyle(3, 0xa78f66).strokeRect(s.x + 3, s.y - 72, s.width - 6, 72);
        for (let x = s.x + 7; x < s.x + s.width - 7; x += 21)
          m.fillStyle(0xc8aa70).fillRect(x, s.y + 9, 10, 7);
        m.lineStyle(2, 0x6e817a).lineBetween(
          s.x + 4,
          s.y - 32,
          s.x + s.width - 4,
          s.y - 32,
        );
      }
    }
  }
}
