import type Phaser from 'phaser';
import { drawSkyscraperCity } from '../rendering/SkyscraperCity';
import {
  drawScaffoldPlatform,
  drawConstructionLift,
} from '../rendering/ConstructionArt';
import { interlude2 as c } from './interlude2';
export const rooftopGeometry = {
  x: c.roofX,
  y: c.feetY,
  width: c.roofWidth,
  height: 20,
} as const;
const balloons = [
  { x: 515, y: 62, scale: 1, speed: 2.6, color: 0xd36c65, stripe: 0xf0bd79 },
  {
    x: 294,
    y: 100,
    scale: 0.65,
    speed: 1.7,
    color: 0x66989b,
    stripe: 0xe5db9c,
  },
  { x: 600, y: 129, scale: 0.5, speed: 1.2, color: 0x9787b6, stripe: 0xe4b29b },
  { x: 92, y: 69, scale: 0.4, speed: 1, color: 0xcc985e, stripe: 0xf2d49d },
] as const;
export function balloonPositions(ms: number) {
  return balloons.map((b) => ({
    ...b,
    x: ((b.x + (ms * b.speed) / 1000 + 50) % 740) - 50,
    y: b.y + Math.sin(ms / 3500 + b.x) * 2,
  }));
}
/** The Level 4 scaffold/lift and oblique city, reframed as a fixed rooftop shot. */
export class RooftopArt {
  private readonly city;
  private readonly structure;
  private readonly lift;
  private readonly sky;
  private environment?: 'night' | 'day';
  constructor(scene: Phaser.Scene) {
    this.city = scene.add.graphics().setDepth(-40);
    this.sky = scene.add.graphics().setDepth(-30);
    this.structure = scene.add.graphics().setDepth(0);
    this.lift = scene.add.graphics().setDepth(1);
  }
  update(environment: 'night' | 'day', liftY: number, dayMs: number) {
    if (this.environment !== environment) {
      this.environment = environment;
      drawSkyscraperCity(
        this.city,
        0,
        0,
        c.width,
        c.height,
        environment === 'day',
      );
      const g = this.structure.clear();
      // Unfinished framing remains in exactly the same coordinates overnight.
      g.fillStyle(environment === 'night' ? 0x38535c : 0x789393)
        .fillRect(64, 205, 8, 155)
        .fillRect(198, 205, 8, 155)
        .fillRect(190, 334, 366, 9);
      g.lineStyle(3, environment === 'night' ? 0x547079 : 0x94a69b)
        .lineBetween(194, 344, 290, 300)
        .lineBetween(435, 345, 548, 300);
      drawScaffoldPlatform(g, rooftopGeometry);
      g.fillStyle(0x526b70)
        .fillRect(218, 148, 5, 136)
        .fillRect(170, 146, 170, 5);
      g.lineStyle(2, 0x738a87)
        .lineBetween(170, 146, 221, 120)
        .lineBetween(221, 120, 340, 146);
      g.fillStyle(0x78684f).fillRect(218, 263, 24, 21);
      g.fillStyle(0xb19b71).fillRect(216, 262, 28, 3);
    }
    this.lift.clear();
    drawConstructionLift(this.lift, {
      x: c.liftX,
      y: liftY,
      width: c.liftWidth,
      height: 20,
    });
    const sky = this.sky.clear();
    if (environment === 'day')
      for (const b of balloonPositions(dayMs)) {
        // Stepped envelopes, suspension ropes and baskets; decorative only.
        const rect = (
          x: number,
          y: number,
          w: number,
          h: number,
          color: number,
        ) =>
          sky
            .fillStyle(color)
            .fillRect(
              Math.round(b.x + x * b.scale),
              Math.round(b.y + y * b.scale),
              Math.max(1, Math.round(w * b.scale)),
              Math.max(1, Math.round(h * b.scale)),
            );
        rect(-12, -25, 24, 5, b.color);
        rect(-19, -20, 38, 7, b.color);
        rect(-23, -13, 46, 22, b.color);
        rect(-19, 9, 38, 9, b.color);
        rect(-13, 18, 26, 7, b.color);
        rect(-7, 25, 14, 5, b.color);
        rect(-5, -25, 10, 50, b.stripe);
        rect(-12, -18, 4, 32, b.stripe);
        rect(-7, 30, 1, 11, 0x685850);
        rect(6, 30, 1, 11, 0x685850);
        rect(-8, 40, 16, 9, 0xa77751);
        rect(-8, 40, 16, 2, 0xe0bb7b);
      }
  }
}
