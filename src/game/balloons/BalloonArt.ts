import Phaser from 'phaser';
import type { LevelDefinition } from '../levels/types';
import type { Machinery } from '../machinery/Machinery';
import type { Rect } from '../player/CollisionAssist';
import { marqueeAppearance } from './config';
const palettes = [
  [0x98b775, 0x4f705c, 0xcbdca2, 0xf4e7bd],
  [0xcf7163, 0x8a494b, 0xf0aa80, 0xffe5b7],
  [0x73a5bc, 0x486781, 0xb9d8dc, 0xf6e9c3],
  [0xcf8b9b, 0x8b5c7d, 0xf3bfbe, 0xfbe7c8],
  [0xdda554, 0x976644, 0xffd98c, 0xffefc1],
  [0xa38bbc, 0x675882, 0xd1b8dc, 0xf2dfb1],
] as const;
type Variant = NonNullable<LevelDefinition['balloons']>['variants'][number];
/** Flat fabric crowns above tapered, non-solid envelopes. Everything below y=0 is decorative. */
function envelope(
  g: Phaser.GameObjects.Graphics,
  width: number,
  variant: Variant,
) {
  const [main, shade, light, cream] = palettes[variant.palette]!;
  const height = Math.round(width * 0.67 + 38);
  for (let y = 8; y < height; y += 4) {
    const p = (y - 8) / (height - 8),
      span =
        Math.round(
          (width * ((1 - p) ** 0.7 + Math.sin(p * Math.PI) * 0.23)) / 4,
        ) * 4;
    const left = Math.round((width - span) / 2);
    g.fillStyle(shade).fillRect(left - 3, y, span + 6, 4);
    for (let stripe = 0; stripe < 7; stripe++) {
      const sx = Math.round(left + (span * stripe) / 7),
        end = Math.round(left + (span * (stripe + 1)) / 7);
      g.fillStyle(stripe === 6 ? shade : stripe % 2 ? cream : main).fillRect(
        sx,
        y,
        end - sx,
        4,
      );
      if (stripe === 0 || stripe === 2)
        g.fillStyle(light, 0.45).fillRect(sx + 2, y, 2, 4);
    }
  }
  g.fillStyle(shade).fillRect(0, 0, width, 15);
  g.fillStyle(main).fillRect(2, 0, width - 4, 10);
  g.fillStyle(light)
    .fillRect(5, 0, width - 10, 3)
    .fillRect(9, 3, width - 18, 2);
  for (let x = 8; x < width - 5; x += 18)
    g.fillStyle(light, 0.4).fillRect(x, 7, 9, 2);
  for (let x = 7; x < width - 6; x += 24)
    g.fillStyle(shade).fillRect(x, 12, 14, 4);
  const motifY = height * 0.32;
  if (variant.pattern !== 'stripes')
    for (const x of [width * 0.28, width * 0.5, width * 0.72]) {
      const y = Math.round(motifY),
        cx = Math.round(x);
      g.fillStyle(light)
        .fillRect(cx - 2, y - 7, 4, 14)
        .fillRect(cx - 6, y - 2, 12, 4);
      if (variant.pattern === 'diamonds') g.fillRect(cx - 4, y - 4, 8, 8);
      else g.fillRect(cx - 8, y - 1, 16, 2).fillRect(cx - 1, y - 9, 2, 18);
    }
  g.fillStyle(shade).fillRect(width / 2 - 8, height - 2, 16, 6);
  g.fillStyle(light).fillRect(width / 2 - 5, height, 10, 2);
  return height;
}
export class BalloonArt {
  private readonly sky;
  private readonly ropes;
  private readonly scent;
  private readonly balloons: {
    variant: Variant;
    surface: Rect;
    envelope: Phaser.GameObjects.Graphics;
    height: number;
  }[] = [];
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDefinition,
    machinery: Machinery,
  ) {
    this.sky = scene.add.graphics().setDepth(-40);
    this.ropes = scene.add.graphics().setDepth(-2);
    for (const variant of level.balloons!.variants) {
      const surface =
        level.platforms.find((p) => p.id === variant.platformId) ??
        machinery.surfaces.find((p) => p.id === variant.platformId)!;
      const g = scene.add.graphics().setDepth(-1);
      const height = envelope(g, surface.width, variant);
      this.balloons.push({ variant, surface, envelope: g, height });
    }
    this.rooftop();
    this.scent = scene.add.graphics().setDepth(14);
  }
  private rooftop() {
    const d = this.level.balloons!.destination,
      roof = this.level.platforms.find((p) => p.id === d.roofId)!,
      g = this.scene.add.graphics().setDepth(1);
    g.fillStyle(0xae7868).fillRect(roof.x, roof.y, roof.width, roof.height);
    g.fillStyle(0x875e5b).fillRect(
      roof.x,
      roof.y + 20,
      roof.width,
      roof.height - 20,
    );
    for (let y = roof.y + 38; y < roof.y + roof.height; y += 28) {
      g.fillStyle(0x9e7265).fillRect(roof.x, y, roof.width, 2);
      for (
        let x = roof.x + ((y / 28) % 2) * 38;
        x < roof.x + roof.width;
        x += 76
      )
        g.fillRect(x, y - 25, 2, 25);
    }
    for (let x = roof.x + 36; x < roof.x + roof.width - 45; x += 92) {
      g.fillStyle(0x53666b).fillRect(x, roof.y + 68, 48, 64);
      g.fillStyle(0xc3d4ce)
        .fillRect(x + 5, roof.y + 73, 16, 48)
        .fillRect(x + 27, roof.y + 73, 16, 48);
      g.fillStyle(0xe4be8e).fillRect(x - 3, roof.y + 128, 54, 5);
    }
    g.fillStyle(0x445d64).fillRect(roof.x - 4, roof.y, roof.width + 8, 15);
    g.fillStyle(0xf4d3a0).fillRect(roof.x - 4, roof.y, roof.width + 8, 4);
    g.fillStyle(0x6c7c79)
      .fillRect(
        d.sign.x + 18,
        d.sign.y + d.sign.height - 3,
        7,
        roof.y - d.sign.y - d.sign.height + 4,
      )
      .fillRect(
        d.sign.x + d.sign.width - 25,
        d.sign.y + d.sign.height - 3,
        7,
        roof.y - d.sign.y - d.sign.height + 4,
      );
    this.scene.textures
      .get(marqueeAppearance.key)
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.scene.add
      .image(d.sign.x, d.sign.y, marqueeAppearance.key)
      .setOrigin(0)
      .setDisplaySize(d.sign.width, d.sign.height)
      .setDepth(2)
      .setName("Shelly's Pizza marquee");
    for (const x of [6570, 6650]) {
      g.fillStyle(0x809594).fillRect(x, roof.y - 26, 42, 26);
      g.fillStyle(0xbdc9b7).fillRect(x - 3, roof.y - 29, 48, 5);
      for (let dx = 6; dx < 39; dx += 7)
        g.fillStyle(0x536e74).fillRect(x + dx, roof.y - 20, 3, 15);
    }
    const v = d.vent;
    g.fillStyle(0x6d858b).fillRect(v.x, v.y, v.width, v.height);
    g.fillStyle(0xa5b9b2).fillRect(v.x + 8, v.y + 6, v.width - 16, 8);
    g.fillStyle(0x1d3b46).fillRect(v.x + 12, v.y + 34, 92, v.height - 34);
    g.fillStyle(0x152d39).fillRect(v.x + 28, v.y + 40, 70, v.height - 40);
    g.fillStyle(0xc3cab3)
      .fillRect(v.x + 7, v.y + 28, 103, 7)
      .fillRect(v.x + 7, v.y + 33, 5, v.height - 33);
    const front = this.scene.add.graphics().setDepth(16);
    front
      .fillStyle(0x819a9d)
      .fillRect(v.x + 104, v.y + 28, v.width - 104, v.height - 28);
    front.fillStyle(0xc3cab3).fillRect(v.x + 103, v.y + 28, 5, v.height - 28);
    for (let x = v.x + 18; x < v.x + v.width - 12; x += 18)
      g.fillStyle(0x526c75).fillRect(x, v.y + 20, 9, 3);
  }
  update(
    view: { x: number; y: number; width: number; height: number },
    ms: number,
    scentMs: number,
  ) {
    const { width: w, height: h } = view,
      g = this.sky.clear().setPosition(Math.round(view.x), Math.round(view.y));
    for (const [i, color] of [0x91bdcf, 0xabd2dc, 0xc3dfe0, 0xdbe8dc].entries())
      g.fillStyle(color).fillRect(0, (i * h) / 4, w, h / 4 + 1);
    for (let i = -1; i < 7; i++) {
      const x = Math.round(i * 243 - ((view.x * 0.08 - ms * 0.003) % 243)),
        y = 43 + ((i * 67 + 400) % 175) - view.y * 0.04;
      g.fillStyle(0xf5f2de, 0.55)
        .fillRect(x + 16, y, 80, 9)
        .fillRect(x, y + 9, 120, 9)
        .fillRect(x - 20, y + 18, 160, 7);
    }
    const horizon = h * 0.82;
    for (let i = -1; i < Math.ceil(w / 42) + 1; i++) {
      const x = Math.round(i * 42 - ((view.x * 0.035) % 42)),
        height = 18 + ((i * 29 + 400) % 37);
      g.fillStyle(i % 2 ? 0x91b6bc : 0xa1c1c2, 0.62).fillRect(
        x,
        horizon - height,
        35,
        h - horizon + height,
      );
      g.fillStyle(0xcfdbca, 0.5).fillRect(x + 4, horizon - height - 2, 27, 3);
      for (let yy = horizon - height + 9; yy < h; yy += 16)
        g.fillStyle(0xb9cfc9, 0.6)
          .fillRect(x + 7, yy, 3, 5)
          .fillRect(x + 22, yy, 3, 5);
    }
    const ropes = this.ropes.clear();
    for (const b of this.balloons) {
      b.envelope.setPosition(Math.round(b.surface.x), Math.round(b.surface.y));
      if (
        b.surface.x + b.surface.width < view.x - 40 ||
        b.surface.x > view.x + w + 40
      )
        continue;
      for (const [i, fraction] of [0.12, 0.35, 0.65, 0.88].entries()) {
        const x = b.surface.x + b.surface.width * fraction,
          top = b.surface.y + b.height * 0.45,
          bottom = b.surface.y + b.height + 22 + (i % 2) * 16;
        for (let y = top; y < bottom; y += 4) {
          const sway =
            (Math.sin(ms / 850 + i + b.surface.x) * 2 * (y - top)) /
            (bottom - top);
          ropes
            .fillStyle(0x6e6453)
            .fillRect(Math.round(x + sway), Math.round(y), 2, 4);
          if (y > bottom - 5)
            ropes
              .fillStyle(0xb49062)
              .fillRect(Math.round(x + sway) - 1, Math.round(y), 4, 5);
        }
      }
    }
    const scent = this.scent.clear(),
      d = this.level.balloons!.destination;
    if (scentMs > 0)
      for (let i = 0; i < 7; i++) {
        const p = ((scentMs + i * 320) % 2600) / 2600,
          x = d.vent.x + 40 - p * 480,
          y = d.sophie.y - 38 - p * 27 + Math.sin(p * 9 + i) * 5;
        scent
          .fillStyle(i % 2 ? 0xffe3a7 : 0xfff2ce, Math.sin(p * Math.PI) * 0.75)
          .fillRect(Math.round(x), Math.round(y), 9, 3)
          .fillRect(Math.round(x) - 4, Math.round(y) + 3, 6, 3)
          .fillRect(Math.round(x) + 7, Math.round(y) - 3, 5, 3);
      }
  }
}
