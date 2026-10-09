import { drawSkyscraperCity } from './SkyscraperCity';
import { drawScaffoldPlatform, drawConstructionLift } from './ConstructionArt';
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
    // Keep the summit crane over the landing, on the right of the final lift.
    const summit = level.platforms.find((p) => p.id === 'summit-floor')!;
    const craneX = summit.x + 60,
      beamY = summit.y - 228,
      beamLeft = summit.x - 30,
      beamRight = summit.x + summit.width - 20;
    structure
      .fillStyle(0x526b70)
      .fillRect(craneX, beamY + 3, 9, summit.y - beamY - 3)
      .fillRect(beamLeft, beamY, beamRight - beamLeft, 8);
    structure
      .lineStyle(3, 0x526b70)
      .lineBetween(beamLeft, beamY, craneX + 4, beamY - 52)
      .lineBetween(craneX + 4, beamY - 52, beamRight, beamY)
      .lineBetween(beamRight - 35, beamY + 8, beamRight - 35, beamY + 108);
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
    drawScaffoldPlatform(g, p);
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
    drawSkyscraperCity(this.city, viewX, viewY, t.viewWidth, t.viewHeight);
    this.moving.clear();
    for (const s of this.machinery.surfaces) {
      if (this.level.movingPlatforms?.some((p) => p.id === s.id))
        this.cargo(this.moving, s.x, s.y + s.dip, s.width, s.height);
      else {
        drawConstructionLift(this.moving, s);
      }
    }
  }
}
