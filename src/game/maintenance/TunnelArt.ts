import type Phaser from 'phaser';
import type { LevelDefinition } from '../levels/types';
import type { Rect } from '../player/CollisionAssist';
import type { SteamField } from '../steam/SteamField';
import {
  floor,
  gauge,
  grate,
  pipe,
  puff,
  tunnelPalette as p,
  valve,
} from './artPrimitives';

type SteamSnapshot = ReturnType<SteamField['snapshot']>;

/** Art reads hazard state; geometry and the steam clock remain gameplay-owned. */
export class TunnelArt {
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly structures: Phaser.GameObjects.Graphics;
  private readonly machinery: Phaser.GameObjects.Graphics;
  private readonly steam: Phaser.GameObjects.Graphics;
  private readonly hatchFront: Phaser.GameObjects.Graphics;
  private readonly signs: Phaser.GameObjects.Text[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDefinition,
  ) {
    this.background = scene.add.graphics().setDepth(-35);
    this.structures = scene.add.graphics().setDepth(-2);
    this.machinery = scene.add.graphics().setDepth(-1);
    this.steam = scene.add.graphics().setDepth(8);
    this.hatchFront = scene.add.graphics().setDepth(16);
    for (const platform of level.platforms)
      if (platform.style === 'pipe') pipe(this.structures, platform);
      else floor(this.structures, platform);
    this.fixtures();
  }

  private sign(text: string, x: number, y: number, warning = false) {
    const sign = this.scene.add
      .text(x, y, text, {
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: warning ? '#ffe1a3' : '#c5d4be',
        backgroundColor: warning ? '#6c4738' : '#293e43',
        padding: { x: 7, y: 5 },
        align: 'center',
        lineSpacing: 1,
      })
      .setDepth(-1);
    this.signs.push(sign);
  }

  private fixtures() {
    const data = this.level.maintenance!,
      g = this.structures;
    // The roof inlet remains behind the entrance floor, leaving generous headroom.
    g.fillStyle(0x536a6c).fillRect(38, 190, 108, 308);
    g.fillStyle(0x8a9f94).fillRect(38, 190, 8, 308);
    g.fillStyle(0x23383f).fillRect(52, 412, 90, 85);
    g.fillStyle(0x7b938d).fillRect(46, 403, 104, 10);
    for (let y = 208; y < 390; y += 52) {
      g.fillStyle(0x354c52).fillRect(46, y, 96, 8);
      g.fillStyle(0xa0ad97).fillRect(46, y, 96, 2);
    }
    this.sign('ROOF ACCESS', 39, 364);
    this.sign('SHELLY’S\nOVEN SERVICES →', 300, 326);
    for (const checkpoint of this.level.checkpoints) {
      const x = checkpoint.spawn.x - 56,
        y = checkpoint.spawn.y - 66;
      g.fillStyle(0x253c41).fillRect(x - 5, y - 5, 25, 39);
      g.fillStyle(0x718b80).fillRect(x - 3, y - 3, 21, 3);
      g.fillStyle(p.green).fillRect(x + 3, y + 5, 9, 6);
      g.fillStyle(0x516e63).fillRect(x + 3, y + 20, 9, 4);
      g.fillStyle(p.green, 0.07).fillRect(x - 13, y - 10, 41, 33);
    }
    // Small inset route markers expose deterministic patrol endpoints without
    // adding anything that resembles another colliding obstacle.
    for (const rat of data.rats) {
      g.fillStyle(0x957e5a).fillRect(
        rat.left - 9,
        rat.floorY + 19,
        rat.right - rat.left + 18,
        2,
      );
      for (const x of [rat.left, rat.right])
        g.fillStyle(0xe4bd7c).fillRect(x - 3, rat.floorY + 16, 6, 6);
    }
    for (const furnace of data.steam) {
      const x = furnace.x,
        y = furnace.floorY,
        w = furnace.width;
      g.fillStyle(0x362d2b).fillRect(x, y + 23, w, this.level.height - y);
      for (let i = 0; i < 5; i++)
        g.fillStyle(
          [0x7b4632, 0xa25532, 0xc76f39, 0xe68f4b, 0xf3b866][i]!,
        ).fillRect(x + 8, y + 132 + i * 9, w - 16, 125 - i * 9);
      g.fillStyle(0x714b3b).fillRect(x + 6, y + 103, w - 12, 9);
      g.fillStyle(0xc38754).fillRect(x + 6, y + 103, w - 12, 3);
      for (let px = x + 15; px < x + w - 7; px += 24) {
        g.fillStyle(0x493c32).fillRect(px, y + 110, 8, 175);
        g.fillStyle(0x9a6542).fillRect(px, y + 110, 2, 175);
      }
      g.fillStyle(0x995f41).fillRect(x - 45, y - 56, 9, 68);
      g.fillStyle(0xdba270).fillRect(x - 45, y - 56, 3, 68);
      g.fillStyle(0x76513e).fillRect(x - 45, y + 9, 55, 7);
      this.sign('DANGER\nFURNACE', x - 142, y - 121, true);
      for (const edge of [x - 10, x + w])
        g.fillStyle(0xf3c177).fillRect(edge, y, 10, 5);
    }
    const hatch = data.destination.hatch;
    g.fillStyle(0x20373d).fillRect(
      hatch.x - 9,
      hatch.y - 9,
      hatch.width + 18,
      hatch.height + 9,
    );
    g.fillStyle(0x8c9d91).fillRect(
      hatch.x - 5,
      hatch.y - 5,
      hatch.width + 10,
      9,
    );
    g.fillStyle(0x203039).fillRect(
      hatch.x,
      hatch.y + 4,
      hatch.width,
      hatch.height - 4,
    );
    g.fillStyle(0x15282f).fillRect(
      hatch.x + 26,
      hatch.y + 11,
      hatch.width - 26,
      hatch.height - 11,
    );
    for (let x = hatch.x + 11; x < hatch.x + hatch.width; x += 18)
      g.fillStyle(0x415858).fillRect(x, hatch.y + 4, 3, 10);
    this.sign('SERVICE EXIT →', hatch.x - 7, hatch.y - 46);
    g.fillStyle(p.green).fillRect(hatch.x + 53, hatch.y - 16, 19, 6);
    this.hatchFront
      .fillStyle(0x657f7b)
      .fillRect(hatch.x + hatch.width - 19, hatch.y, 25, hatch.height);
    this.hatchFront
      .fillStyle(0xa7b69d)
      .fillRect(hatch.x + hatch.width - 19, hatch.y, 4, hatch.height);
  }

  private backdrop(view: Rect) {
    const g = this.background.clear(),
      left = Math.floor(view.x),
      top = Math.floor(view.y);
    g.fillStyle(p.wall).fillRect(left, top, view.width + 2, view.height + 2);
    g.fillStyle(0x384346).fillRect(left, 390, view.width + 2, 190);
    const offset = Math.floor(view.x * 0.13);
    for (
      let i = Math.floor((view.x - offset) / 240) - 1;
      i < Math.ceil((view.x + view.width - offset) / 240) + 1;
      i++
    ) {
      const x = i * 240 + offset;
      g.fillStyle(p.panel).fillRect(x + 8, 205, 224, 178);
      g.fillStyle(0x53615f).fillRect(x + 8, 205, 224, 3);
      g.fillStyle(p.seam).fillRect(x, top, 7, view.height + 2);
      for (const y of [212, 369])
        for (const px of [x + 15, x + 221])
          g.fillStyle(0x71817a).fillRect(px, y, 3, 3);
      grate(g, { x: x + 58, y: 243, width: 94, height: 53 });
      g.fillStyle(0x273a3f).fillRect(x + 33, 352, 150, 9);
      g.fillStyle(0x75624e).fillRect(x + 34, 352, 148, 3);
      g.fillStyle(0xc49867).fillRect(x + 186, 321, 18, 4);
      g.fillStyle(0xc49867, 0.045).fillTriangle(
        x + 194,
        325,
        x + 135,
        442,
        x + 253,
        442,
      );
    }
    // Oversized overhead ducts and warm service pipes imply a roomy machine hall.
    g.fillStyle(0x4c6266).fillRect(left, 153, view.width + 2, 36);
    g.fillStyle(0x80938a).fillRect(left, 153, view.width + 2, 3);
    g.fillStyle(0x243b42).fillRect(left, 186, view.width + 2, 6);
    g.fillStyle(0x9a6b4c).fillRect(left, 217, view.width + 2, 10);
    g.fillStyle(0xc69362).fillRect(left, 217, view.width + 2, 3);
    for (
      let x = Math.floor(view.x / 196) * 196;
      x < view.x + view.width;
      x += 196
    ) {
      g.fillStyle(0x293f46).fillRect(x, 151, 9, 42);
      g.fillStyle(0x8b9b8e).fillRect(x, 151, 9, 3);
      g.fillStyle(0x705340).fillRect(x + 94, 214, 7, 16);
    }
  }

  update(view: Rect, elapsedMs: number, steam: SteamSnapshot) {
    this.backdrop(view);
    const g = this.machinery.clear(),
      clouds = this.steam.clear();
    for (const s of steam) {
      if (s.x + s.width < view.x - 40 || s.x > view.x + view.width + 150)
        continue;
      const { x, width: w, floorY: y } = s;
      const warning = s.phase === 'warning' || s.phase === 'hiss';
      const bright = s.active || warning;
      gauge(g, x - 40, y - 79, s.pressure);
      valve(g, x - 41, y - 30, s.pressure * Math.PI * 0.75);
      g.fillStyle(bright ? p.red : p.green).fillRect(x - 25, y - 51, 7, 7);
      g.fillStyle(p.orange, 0.06 + s.pressure * 0.12).fillRect(
        x + 3,
        y + 7,
        w - 6,
        160,
      );
      for (let px = x + 13; px < x + w - 7; px += 29) {
        g.fillStyle(0x496063).fillRect(px - 4, y + 25, 19, 10);
        g.fillStyle(bright ? 0xffd795 : 0xb8926a).fillRect(
          px - 2,
          y + 25,
          15,
          3,
        );
        g.fillStyle(0x2b3d3f).fillRect(px + 2, y + 27, 7, 4);
      }
      if (s.phase === 'clear') continue;
      if (warning) {
        const count = s.phase === 'hiss' ? 6 : 3;
        for (let i = 0; i < count; i++) {
          const progress = (elapsedMs / 650 + i / count) % 1;
          puff(
            clouds,
            x + ((i + 0.5) * w) / count,
            y + 17 - progress * 44,
            14 + Math.floor(progress * 12),
            (1 - progress) * (s.phase === 'hiss' ? 0.65 : 0.38),
          );
        }
        continue;
      }
      const fade = s.active ? 1 : 1 - s.progress;
      // A continuous low-opacity curtain communicates the full collision area;
      // brighter narrow jets leave the dogs and treat route easy to read.
      clouds
        .fillStyle(0xf0dcc0, 0.14 * fade)
        .fillRect(s.bounds.x, s.bounds.y, s.bounds.width, s.bounds.height);
      const columns = Math.max(4, Math.ceil(w / 36));
      for (let i = 0; i < columns; i++) {
        const cx = x + ((i + 0.5) * w) / columns;
        const ripple = Math.sin(elapsedMs / 110 + i * 2) * 3;
        clouds
          .fillStyle(0xf9e6c5, 0.19 * fade)
          .fillRect(
            Math.round(cx - 6 + ripple),
            s.bounds.y + 8,
            12,
            s.height + 13,
          );
        for (let j = 0; j < 3; j++) {
          const progress = (elapsedMs / 570 + j / 3 + i / 7) % 1;
          puff(
            clouds,
            cx + ripple,
            y + 12 - progress * (s.height + 12),
            16 + Math.floor(progress * 15),
            (0.5 - progress * 0.17) * fade,
          );
        }
      }
    }
  }

  destroy() {
    for (const item of [
      this.background,
      this.structures,
      this.machinery,
      this.steam,
      this.hatchFront,
      ...this.signs,
    ])
      item.destroy();
  }
}
