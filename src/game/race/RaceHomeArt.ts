import type Phaser from 'phaser';
import type { LevelDefinition, PlatformDefinition } from '../levels/types';
import type { Machinery } from '../machinery/Machinery';
import type { Rect } from '../player/CollisionAssist';
import type { SteamField } from '../steam/SteamField';
import { drawBalloonEnvelope } from '../balloons/BalloonArt';
import { marqueeAppearance } from '../balloons/config';
import { WorldArt } from '../rendering/WorldArt';
import {
  drawConstructionLift,
  drawScaffoldPlatform,
} from '../rendering/ConstructionArt';
import {
  floor,
  gauge,
  grate,
  pipe,
  puff,
  tunnelPalette,
  valve,
} from '../maintenance/artPrimitives';

type Graphics = Phaser.GameObjects.Graphics;
type SteamSnapshot = ReturnType<SteamField['snapshot']>;
const rect = (
  g: Graphics,
  color: number,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 1,
) =>
  g
    .fillStyle(color, alpha)
    .fillRect(
      Math.round(x),
      Math.round(y),
      Math.round(width),
      Math.round(height),
    );

/** Familiar environments share their original surface art and collision silhouettes. */
export class RaceHomeArt {
  private readonly backdrop: Graphics;
  private readonly structures: Graphics;
  private readonly terrain: Graphics;
  private readonly moving: Graphics;
  private readonly vapor: Graphics;
  private readonly bus: Graphics;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly balloons: {
    surface: Rect;
    art: Graphics;
    height: number;
  }[] = [];
  private busState = { visible: false, x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDefinition,
    private readonly machinery: Machinery,
  ) {
    this.backdrop = scene.add.graphics().setDepth(-40);
    this.structures = scene.add.graphics().setDepth(-9);
    this.bus = scene.add.graphics().setDepth(-7).setName('School bus');
    this.terrain = scene.add.graphics().setDepth(0);
    this.moving = scene.add.graphics().setDepth(1);
    this.vapor = scene.add.graphics().setDepth(8);
    this.objects.push(
      this.backdrop,
      this.structures,
      this.bus,
      this.terrain,
      this.moving,
      this.vapor,
    );
    for (const [index, platform] of level.platforms.entries())
      this.platform(platform, index);
    for (const variant of level.race!.variants) {
      const surface =
        level.platforms.find((p) => p.id === variant.platformId) ??
        machinery.surfaces.find((s) => s.id === variant.platformId)!;
      const art = scene.add.graphics().setDepth(-1);
      const height = drawBalloonEnvelope(art, surface.width, variant);
      this.balloons.push({ surface, art, height });
      this.objects.push(art);
    }
    this.restaurant();
    this.construction();
    this.tunnelFixtures();
    const attic = level.race!.destination.attic;
    WorldArt.drawAttic(this.terrain, attic.x - 36, attic.y);
    // The original open shutters and warm doorway are the destination marker.
    rect(this.structures, 0xf3d59e, attic.x - 25, attic.y - 56, 51, 50, 0.14);
  }

  private platform(p: PlatformDefinition, index: number) {
    const g = this.terrain;
    if (p.style === 'balloon') return;
    if (p.style === 'car') {
      this.car(p);
    } else if (p.style === 'street') {
      rect(g, 0x66716d, p.x, p.y, p.width, p.height);
      rect(g, 0xe3d5b5, p.x, p.y, p.width, 5);
      rect(g, 0xadb2a0, p.x, p.y + 5, p.width, 13);
      for (let x = p.x + 25; x < p.x + p.width; x += 78)
        rect(g, 0x8e988d, x, p.y + 5, 2, 13);
      for (let x = p.x + 45; x < p.x + p.width; x += 110)
        rect(g, 0xc5c2a1, x, p.y + 72, 42, 4);
    } else if (p.style === 'maintenance') {
      floor(g, p);
    } else if (p.style === 'barrier') {
      rect(g, 0x665448, p.x, p.y, p.width, p.height);
      for (let x = p.x; x < p.x + p.width; x += 12)
        rect(
          g,
          (x - p.x) % 24 ? 0xe7b575 : 0x655b4b,
          x,
          p.y,
          Math.min(12, p.x + p.width - x),
          16,
        );
      rect(g, 0xf3d39a, p.x, p.y, p.width, 3);
    } else if (p.style === 'pipe') {
      pipe(g, p);
    } else if (p.style === 'brick' && p.height <= 60) {
      rect(g, 0x99796a, p.x + 4, p.y + 5, p.width - 8, p.height - 5);
      rect(g, 0x675c55, p.x, p.y, p.width, 6);
      rect(g, 0xc3aa87, p.x, p.y, p.width, 2);
      for (let row = 0; row < Math.ceil(p.height / 9); row++) {
        rect(g, 0x725f57, p.x + 4, p.y + 11 + row * 9, p.width - 8, 1);
        for (let x = p.x + 14 + (row % 2) * 10; x < p.x + p.width - 4; x += 20)
          rect(g, 0xba9b7d, x, p.y + 6 + row * 9, 1, 5);
      }
    } else if (p.style === 'catwalk' || p.style === 'conveyor') {
      drawScaffoldPlatform(g, p);
      if (p.style === 'conveyor')
        for (let x = p.x + 14; x < p.x + p.width - 10; x += 38) {
          rect(g, 0x314c54, x, p.y + 4, 18, 3);
          rect(g, 0x314c54, x + 14, p.y + 1, 4, 9);
        }
    } else if (
      p.style === 'steel' &&
      this.level.race!.bands.some(
        (band) =>
          band.mode === 'rooftops' && p.x >= band.fromX && p.x < band.toX,
      )
    ) {
      rect(g, 0x637c7b, p.x, p.y, p.width, p.height);
      rect(g, 0xbec6ac, p.x, p.y, p.width, 4);
      for (let x = p.x + 7; x < p.x + p.width - 5; x += 9)
        rect(g, 0x3f5b60, x, p.y + 12, 4, p.height - 18);
    } else if (p.style === 'crate' || p.style === 'steel') {
      this.cargo(g, p);
    } else {
      WorldArt.drawRoof(g, p, index);
    }
  }

  private car(p: Rect) {
    const g = this.terrain;
    rect(g, 0x2e5158, p.x, p.y, p.width, p.height - 5);
    rect(g, 0x6da1a0, p.x + 3, p.y + 3, p.width - 6, p.height - 14);
    rect(g, 0xc9d8bd, p.x + 2, p.y, p.width - 4, 4);
    for (const fraction of [0.23, 0.43, 0.63]) {
      const x = p.x + p.width * fraction;
      rect(g, 0x315865, x, p.y + 10, p.width * 0.17, 17);
      rect(g, 0xa7cecc, x + 3, p.y + 11, p.width * 0.13, 4);
      rect(g, 0x4f787b, x + 4, p.y + 32, 13, 2);
    }
    rect(g, 0x82b1a5, p.x + 14, p.y + 10, p.width * 0.14, 3);
    rect(g, 0x82b1a5, p.x + p.width * 0.83, p.y + 10, p.width * 0.12, 3);
    for (const x of [p.x + 43, p.x + p.width - 43]) {
      rect(g, 0x2b3c41, x - 14, p.y + p.height - 18, 28, 24);
      rect(g, 0x98a49b, x - 6, p.y + p.height - 13, 12, 12);
      rect(g, 0x465b5e, x - 2, p.y + p.height - 9, 4, 4);
    }
    rect(g, 0xf6d791, p.x + p.width - 9, p.y + 29, 7, 9);
    rect(g, 0xd98f73, p.x + 2, p.y + 29, 5, 9);
    rect(g, 0xced3bc, p.x - 2, p.y + p.height - 10, p.width + 4, 5);
  }

  private cargo(g: Graphics, p: Rect) {
    const { x, y, width: w, height: h } = p;
    if (h < 30) {
      drawScaffoldPlatform(g, p);
      return;
    }
    rect(g, 0x705645, x, y, w, h);
    rect(g, 0xa48960, x + 5, y + 4, w - 10, h - 8);
    for (let px = x + 12; px < x + w; px += 23)
      rect(g, 0x7c624d, px, y + 6, 2, h - 12);
    g.lineStyle(4, 0xc2a46f)
      .lineBetween(x + 8, y + 7, x + w - 8, y + h - 7)
      .lineBetween(x + w - 8, y + 7, x + 8, y + h - 7);
    rect(g, 0xe7cb92, x, y, w, 4);
    if (p.collision === 'top-only')
      for (const px of [x + 18, x + w - 18])
        rect(g, 0x859086, px, y - 190, 2, 190);
  }

  private restaurant() {
    const g = this.structures;
    const y = this.level.playerSpawn.y;
    // The bus has its own distant street, above the parked car's silhouette.
    rect(g, 0x849b91, 372, y - 62, 1018, 22);
    rect(g, 0xb9c4a7, 372, y - 62, 1018, 2);
    for (let x = 410; x < 1380; x += 170) rect(g, 0x8da394, x, y - 40, 12, 210);
    rect(g, 0xa87767, 22, y - 245, 350, 245);
    rect(g, 0x885d59, 22, y - 245, 350, 11);
    for (let row = 0; row < 15; row++)
      for (let x = 27 + (row % 2) * 22; x < 366; x += 46)
        rect(g, 0x8a625b, x, y - 229 + row * 15, 39, 1);
    rect(g, 0xe6ce9d, 47, y - 127, 104, 120);
    rect(g, 0x31474d, 54, y - 120, 90, 113);
    rect(g, 0x172f38, 67, y - 115, 62, 108);
    rect(g, 0xd8ba8b, 64, y - 113, 8, 109);
    rect(g, 0xe8c98c, 118, y - 57, 3, 7);
    rect(g, 0x31474d, 183, y - 121, 159, 86);
    for (let x = 190; x < 335; x += 36) {
      rect(g, 0xd9b482, x, y - 115, 28, 72);
      rect(g, 0x927767, x + 5, y - 81, 23, 38);
    }
    for (let x = 39; x < 357; x += 24)
      rect(g, (x - 39) % 48 ? 0xe9d9ac : 0xb85e55, x, y - 143, 24, 21);
    const sign = this.scene.add
      .image(56, y - 253, marqueeAppearance.key)
      .setOrigin(0)
      .setDisplaySize(282, 156)
      .setDepth(-8)
      .setName("Shelly's front door marquee");
    this.objects.push(sign);
    for (const x of [800, 1080]) {
      rect(g, 0x536667, x, y - 190, 6, 190);
      rect(g, 0x536667, x - 40, y - 190, 46, 5);
      rect(g, 0xf5dba2, x - 45, y - 184, 20, 5);
    }
    for (const x of [905, 995]) {
      rect(g, 0x594c43, x, y - 28, 56, 8);
      for (let dx = 0; dx < 56; dx += 14)
        rect(g, dx % 28 ? 0xe8b478 : 0x665a48, x + dx, y - 28, 14, 8);
      rect(g, 0x675b4d, x + 7, y - 20, 4, 20);
      rect(g, 0x675b4d, x + 45, y - 20, 4, 20);
    }
  }

  private construction() {
    const g = this.structures;
    const band = this.level.race!.bands.find((b) => b.mode === 'construction')!;
    const end = this.level.race!.superJump.runwayEnd;
    for (let x = band.fromX + 100; x < end; x += 390) {
      rect(g, 0x567277, x, 900, 10, this.level.height - 900, 0.5);
      for (let y = 1110; y < this.level.height; y += 250) {
        rect(g, 0x607d7d, x, y, 330, 6, 0.45);
        g.lineStyle(2, 0x6b8582, 0.4).lineBetween(x, y, x + 330, y - 160);
      }
    }
    const point = this.level.race!.superJump.staging;
    const mast = point.x - 100;
    rect(g, 0x6c7e72, mast, point.y - 280, 12, 280);
    rect(g, 0xb59b6b, mast - 80, point.y - 280, 410, 8);
    g.lineStyle(3, 0x788b7b)
      .lineBetween(mast - 80, point.y - 280, mast + 6, point.y - 325)
      .lineBetween(mast + 6, point.y - 325, mast + 330, point.y - 280)
      .lineBetween(mast + 302, point.y - 271, mast + 302, point.y - 170);
  }

  private tunnelFixtures() {
    const g = this.structures;
    const band = this.level.race!.bands.find((b) => b.mode === 'maintenance')!;
    for (const x of [band.fromX, band.toX - 65]) {
      rect(g, 0x334b52, x - 22, band.floorY - 200, 44, 200);
      rect(g, 0x9da991, x - 24, band.floorY - 200, 48, 8);
      rect(g, 0x82988b, x - 17, band.floorY - 192, 5, 192);
    }
    for (const s of this.level.race!.steam) {
      rect(g, 0x322f2e, s.x, s.floorY + 24, s.width, 400);
      for (let i = 0; i < 4; i++)
        rect(
          g,
          [0x79513d, 0xa06742, 0xca8950, 0xdfaa68][i]!,
          s.x + 8,
          s.floorY + 120 + i * 12,
          s.width - 16,
          160 - i * 12,
        );
      for (let px = s.x + 10; px < s.x + s.width; px += 26)
        rect(g, 0x4e4e41, px, s.floorY + 110, 8, 170);
      rect(g, 0x9c6c4b, s.x - 42, s.floorY - 60, 9, 71);
      rect(g, 0xd6a371, s.x - 40, s.floorY - 60, 3, 71);
      rect(g, 0xa67a55, s.x - 42, s.floorY + 7, 45, 7);
    }
  }

  private sky(view: Rect) {
    const g = this.backdrop
      .clear()
      .setPosition(Math.round(view.x), Math.round(view.y));
    const residential =
      view.x >
      this.level.race!.bands.find((b) => b.mode === 'neighborhood')!.fromX -
        500;
    const colors = residential
      ? [0xa6b9ae, 0xcbd0b9, 0xe6dcc2, 0xebd7bb]
      : [0x96c2cd, 0xb6d4d1, 0xd3dfca, 0xe8dfc2];
    for (const [i, color] of colors.entries())
      rect(
        g,
        color,
        0,
        (i * view.height) / 4,
        view.width + 2,
        view.height / 4 + 2,
      );
    const sunX = Math.round(view.width * 0.76),
      sunY = Math.round(view.height * 0.2);
    for (let y = -26; y <= 26; y += 2) {
      const half = Math.round(Math.sqrt(26 * 26 - y * y));
      rect(g, 0xf8e8bd, sunX - half, sunY + y, half * 2, 2);
    }
    for (let i = -1; i < 7; i++) {
      const x = i * 240 - ((view.x * 0.06) % 240);
      const y = 45 + ((i * 67 + 500) % 130);
      rect(g, 0xf5efda, x + 16, y, 76, 8, 0.6);
      rect(g, 0xf5efda, x, y + 8, 120, 8, 0.6);
      rect(g, 0xf5efda, x - 18, y + 16, 151, 6, 0.6);
    }
    for (const [layer, factor] of [0.12, 0.23].entries()) {
      const unit = residential ? 112 : 84;
      const offset = view.x * factor;
      const start = Math.floor(offset / unit);
      for (
        let i = start - 1;
        i < start + Math.ceil(view.width / unit) + 2;
        i++
      ) {
        const x = i * unit - offset;
        const h = residential ? 35 + ((i * 17) % 38) : 48 + ((i * 37) % 120);
        const y = view.height * (layer ? 0.88 : 0.74) - h;
        const color = layer ? 0x849b8c : 0xa1b5a4;
        rect(g, color, x, y, unit - 12, view.height - y);
        if (residential) {
          g.fillStyle(color).fillTriangle(
            x - 6,
            y,
            x + (unit - 12) / 2,
            y - 25,
            x + unit - 6,
            y,
          );
          rect(g, color, x + unit - 35, y - 24, 8, 24);
        } else rect(g, color, x + 7, y - 7, unit - 26, 7);
        for (let wy = y + 15; wy < view.height; wy += 25)
          for (let wx = x + 12; wx < x + unit - 20; wx += 23)
            rect(g, 0xd5cfac, wx, wy, 6, 10, 0.45);
      }
    }
    if (residential)
      for (let x = -40 - ((view.x * 0.3) % 190); x < view.width; x += 190) {
        rect(g, 0x667f68, x + 23, view.height - 81, 7, 81);
        rect(g, 0x809570, x + 4, view.height - 113, 48, 46);
        rect(g, 0x93a67c, x + 11, view.height - 121, 33, 17);
      }
    this.tunnelBackdrop(view);
  }

  private tunnelBackdrop(view: Rect) {
    const band = this.level.race!.bands.find((b) => b.mode === 'maintenance')!;
    if (view.x + view.width < band.fromX || view.x > band.toX) return;
    const g = this.backdrop;
    const left = Math.max(0, band.fromX - view.x);
    const right = Math.min(view.width, band.toX - view.x);
    rect(g, tunnelPalette.wall, left, 0, right - left, view.height + 2);
    const top = band.floorY - 260 - view.y;
    for (
      let x = Math.floor((view.x - band.fromX) / 240) * 240 + band.fromX;
      x < Math.min(band.toX, view.x + view.width);
      x += 240
    ) {
      const px = x - view.x;
      if (px < left - 240) continue;
      rect(
        g,
        0x3c4c50,
        Math.max(left, px + 8),
        top + 30,
        Math.min(224, right - Math.max(left, px + 8)),
        170,
      );
      rect(g, 0x26353a, Math.max(left, px), 0, 7, view.height + 2);
      if (px + 160 < right && px + 50 > left)
        grate(g, { x: px + 55, y: top + 60, width: 94, height: 52 });
      rect(g, 0xd4ab73, px + 187, top + 112, 18, 4);
    }
    rect(g, 0x4c6266, left, top - 12, right - left, 33);
    rect(g, 0x81938a, left, top - 12, right - left, 3);
    rect(g, 0x9a6b4c, left, top + 48, right - left, 9);
    rect(g, 0xd4a06a, left, top + 48, right - left, 3);
  }

  private schoolBus(view: Rect, elapsedMs: number, openingProgress: number) {
    const g = this.bus.clear();
    const d = this.level.race!;
    const center = view.x + view.width * 0.4;
    const band = d.bands.find((b) => center >= b.fromX && center < b.toX)!;
    const opening = band?.mode === 'street' && openingProgress < 1;
    const distant = band?.mode === 'construction' || band?.mode === 'rooftops';
    this.busState.visible = opening || distant;
    if (!this.busState.visible) return;
    const scale = opening ? 1 : 0.65;
    const progress = band
      ? Math.max(0, (center - band.fromX) / (band.toX - band.fromX))
      : 0;
    const x = opening
      ? 470 + openingProgress * 750
      : view.x +
        view.width * (0.35 + progress * 0.35) +
        Math.min(48, elapsedMs * 0.001);
    const y = opening
      ? this.level.playerSpawn.y - 70
      : view.y + view.height * 0.85;
    this.busState = { visible: true, x, y };
    g.setPosition(Math.round(x), Math.round(y)).setScale(scale);
    if (!opening) {
      const left = (view.x - x) / scale;
      rect(g, 0x7e9685, left, 7, view.width / scale, 12);
      rect(g, 0xa3b29a, left, 7, view.width / scale, 2);
      for (let px = left + 60; px < left + view.width / scale; px += 260)
        rect(g, 0x829988, px, 19, 16, view.height / scale);
    }
    rect(g, 0x5a4b32, 0, -40, 108, 36);
    rect(g, 0xe6ad47, 3, -38, 99, 32);
    rect(g, 0xf8d675, 7, -43, 80, 7);
    rect(g, 0xd99a39, 87, -26, 25, 20);
    rect(g, 0xf5cb65, 87, -26, 24, 4);
    for (let px = 10; px < 83; px += 15) {
      rect(g, 0x3e5a5f, px, -33, 11, 13);
      rect(g, 0x96c2bc, px + 1, -32, 9, 3);
    }
    rect(g, 0x3c5556, 88, -35, 9, 12);
    rect(g, 0x514836, 3, -17, 100, 3);
    rect(g, 0x514836, 3, -10, 100, 2);
    for (const px of [20, 91]) {
      rect(g, 0x283c42, px - 9, -10, 18, 16);
      rect(g, 0xa5ac98, px - 4, -6, 8, 8);
    }
    rect(g, 0xe97654, 5, -25, 5, 5);
    rect(g, 0xffe3a4, 108, -20, 5, 7);
    rect(g, 0x9ca89a, 106, -7, 8, 4);
  }

  private steam(steam: SteamSnapshot, view: Rect, elapsedMs: number) {
    const g = this.moving,
      clouds = this.vapor.clear();
    for (const s of steam) {
      if (s.x + s.width < view.x - 50 || s.x > view.x + view.width + 60)
        continue;
      gauge(g, s.x - 38, s.floorY - 82, s.pressure);
      valve(g, s.x - 38, s.floorY - 33, s.pressure * Math.PI * 0.75);
      rect(
        g,
        s.phase === 'clear' ? tunnelPalette.green : tunnelPalette.red,
        s.x - 24,
        s.floorY - 53,
        7,
        7,
      );
      if (s.phase === 'clear') continue;
      const warning = s.phase === 'warning' || s.phase === 'hiss';
      const alpha = warning ? 0.35 : s.active ? 1 : 1 - s.progress;
      if (!warning)
        rect(
          clouds,
          0xf0dcc0,
          s.bounds.x,
          s.bounds.y,
          s.bounds.width,
          s.bounds.height,
          0.14 * alpha,
        );
      const columns = Math.max(3, Math.ceil(s.width / 35));
      for (let i = 0; i < columns; i++) {
        const x = s.x + ((i + 0.5) * s.width) / columns;
        const progress = (elapsedMs / 650 + i / columns) % 1;
        const height = warning ? 42 : s.height + 12;
        if (!warning)
          rect(
            clouds,
            0xf9e6c5,
            x - 5,
            s.bounds.y + 8,
            10,
            s.height + 13,
            0.18 * alpha,
          );
        puff(
          clouds,
          x,
          s.floorY + 12 - progress * height,
          18 + Math.floor(progress * 14),
          alpha * (0.65 - progress * 0.3),
        );
      }
    }
  }

  update(
    view: Rect,
    elapsedMs: number,
    steam: SteamSnapshot,
    openingProgress = 1,
  ) {
    this.sky(view);
    this.schoolBus(view, elapsedMs, openingProgress);
    const g = this.moving.clear();
    const balloonIds = new Set(
      this.level.race!.variants.map((v) => v.platformId),
    );
    for (const surface of this.machinery.surfaces) {
      if (balloonIds.has(surface.id)) continue;
      if (surface.id.includes('lift')) drawConstructionLift(g, surface);
      else {
        if (surface.id.includes('hanging'))
          for (const x of [surface.x + 18, surface.x + surface.width - 18])
            rect(g, 0x859086, x, surface.y - 190, 2, 190);
        this.cargo(g, surface);
      }
    }
    for (const b of this.balloons) {
      b.art.setPosition(Math.round(b.surface.x), Math.round(b.surface.y));
      if (
        b.surface.x + b.surface.width < view.x - 40 ||
        b.surface.x > view.x + view.width + 40
      )
        continue;
      for (const [i, fraction] of [0.12, 0.35, 0.65, 0.88].entries()) {
        const x = b.surface.x + b.surface.width * fraction;
        const top = b.surface.y + b.height * 0.45;
        const bottom = b.surface.y + b.height + 24 + (i % 2) * 13;
        for (let y = top; y < bottom; y += 4) {
          const sway =
            (Math.sin(elapsedMs / 850 + i) * 2 * (y - top)) / (bottom - top);
          rect(g, 0x6e6453, x + sway, y, 2, 4);
        }
        rect(g, 0xb49062, x - 1, bottom - 3, 4, 5);
      }
    }
    this.steam(steam, view, elapsedMs);
  }

  snapshot() {
    return {
      bus: { ...this.busState },
      attic: { ...this.level.race!.destination.attic },
    };
  }

  destroy() {
    for (const object of this.objects) object.destroy();
  }
}
