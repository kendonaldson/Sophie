import type Phaser from 'phaser';
import type { LevelDefinition, PlatformDefinition } from '../levels/types';
/** Quiet silhouettes behind bright, consistently edged collision surfaces. */
export class ChaseArt {
  constructor(scene: Phaser.Scene, level: LevelDefinition) {
    const bg = scene.add.graphics().setDepth(-30);
    bg.fillStyle(0x243d48).fillRect(0, 0, level.width, level.height);
    bg.fillStyle(0x304852).fillRect(0, 265, level.width, 240);
    for (let x = 30; x < level.width; x += 173) {
      bg.fillStyle(0x72827d).fillRect(x, 142 + (x % 71), 2, 2);
      const h = 60 + (x % 91);
      bg.fillStyle(0x2b414b).fillRect(x, 335 - h, 126, h);
      for (let wy = 346 - h; wy < 325; wy += 22)
        bg.fillStyle(0x536567).fillRect(x + 20, wy, 6, 9);
    }
    const back = scene.add.graphics().setDepth(-10);
    for (let x = 60; x < 2780; x += 310) {
      const y = 292 + (x % 23);
      back.fillStyle(0x475d59).fillRect(x, y, 170, 125);
      back
        .fillStyle(0x344c50)
        .fillTriangle(x - 12, y, x + 84, y - 57, x + 181, y);
      back.fillStyle(0x617369).fillRect(x + 5, y + 4, 160, 4);
      back.fillStyle(0x283f47).fillRect(x + 68, y + 58, 34, 67);
      for (const wx of [x + 20, x + 121]) {
        back.fillStyle(0xc5ac78).fillRect(wx, y + 29, 28, 32);
        back
          .fillStyle(0x566b65)
          .fillRect(wx + 12, y + 29, 3, 32)
          .fillRect(wx, y + 43, 28, 3);
      }
      back.fillStyle(0x374d4c).fillRect(x + 238, y - 1, 10, 125);
      for (let n = 0; n < 3; n++)
        back
          .fillStyle(n === 2 ? 0x506b58 : 0x3d5b51)
          .fillRect(x + 205 - n * 7, y - 35 + n * 17, 78 + n * 9, 40);
      if (x < 1750) {
        back.fillStyle(0x7a826e).fillRect(x + 195, 327, 4, 91);
        back.fillStyle(0xddc48a).fillRect(x + 184, 325, 21, 5);
        back
          .fillStyle(0xffd891, 0.055)
          .fillTriangle(x + 194, 325, x + 135, 420, x + 253, 420);
      }
    }
    for (let x = 2910; x < 6500; x += 245) {
      back
        .fillStyle(0x41575a)
        .fillRect(x, 337, 4, 87)
        .fillRect(x + 200, 337, 4, 87);
      back.lineStyle(1, 0x496164).strokeRect(x, 343, 204, 65);
      for (let dx = 0; dx < 190; dx += 20)
        back.lineBetween(x + dx, 343, x + dx + 45, 407);
      if (x % 2) {
        back.fillStyle(0x667569).fillCircle(x + 68, 396, 21);
        back.fillStyle(0x263f46).fillCircle(x + 68, 396, 12);
      } else {
        back
          .fillStyle(0x657165)
          .fillRect(x + 45, 383, 107, 8)
          .fillRect(x + 55, 394, 107, 8)
          .fillRect(x + 43, 405, 107, 8);
      }
    }
    // Cranes and unfinished floors stay behind the route; no pursuer entity.
    for (const x of [3840, 6100, 6670]) {
      back
        .fillStyle(0x5b6b62)
        .fillRect(x, 190, 9, 230)
        .fillRect(x - 75, 188, 278, 7);
      back
        .lineStyle(2, 0x5b6b62)
        .lineBetween(x - 75, 188, x + 5, 161)
        .lineBetween(x + 5, 161, x + 200, 188)
        .lineBetween(x + 184, 195, x + 184, 271);
      back.fillStyle(0x718074).fillRect(x + 173, 271, 25, 5);
    }
    for (let x = 6430; x < 7200; x += 112) {
      back.fillStyle(0x3b5259).fillRect(x, 0, 12, 420);
      for (let y = 68; y < 420; y += 78) {
        back.fillStyle(0x536a6d).fillRect(x, y, 112, 8);
        back.lineStyle(3, 0x415c61).lineBetween(x + 12, y, x + 111, y - 70);
      }
    }
    const terrain = scene.add.graphics().setDepth(1);
    for (const p of level.platforms) this.platform(terrain, p);
    const signs = scene.add.graphics().setDepth(2);
    for (const [x, y] of [
      [1620, 420],
      [2180, 420],
      [2550, 406],
      [3220, 350],
      [4525, 420],
      [5850, 344],
      [6220, 365],
    ]) {
      signs.fillStyle(0x665e50).fillRect(x!, y! - 71, 4, 71);
      signs.fillStyle(0xefb866).fillRect(x! - 22, y! - 84, 48, 33);
      signs
        .fillStyle(0x334950)
        .fillRect(x! - 12, y! - 69, 21, 5)
        .fillTriangle(x! + 5, y! - 75, x! + 17, y! - 67, x! + 5, y! - 59);
    }
    for (const x of [1740, 2160, 2700, 3260, 3950, 5860]) {
      signs.fillStyle(0xe49459).fillTriangle(x, 420, x + 9, 399, x + 18, 420);
      signs.fillStyle(0xf3d9a4).fillRect(x + 4, 411, 10, 4);
      signs.fillStyle(0x233c45).fillRect(x - 3, 420, 24, 4);
    }
    for (const [label, x, y] of [
      ['UNDER\nCONSTRUCTION', 1725, 306],
      ['THIS WAY? →', 3020, 273],
      ['OVER THE TOP ↗', 4240, 290],
      ['NO THROUGH ROAD', 6470, 307],
    ] as const)
      scene.add
        .text(x, y, label, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#f7d99c',
          backgroundColor: '#354b50',
          padding: { x: 6, y: 5 },
        })
        .setDepth(0);
    // Preview the climbing arc without adding another collectible type.
    for (const [x, y] of [
      [4505, 347],
      [4470, 347],
      [4540, 274],
      [4625, 203],
    ])
      signs.fillStyle(0xf7df99, 0.45).fillRect(x!, y!, 3, 3);
  }
  private platform(g: Phaser.GameObjects.Graphics, p: PlatformDefinition) {
    const { x, y, width: w, height: h, style } = p;
    if (style === 'hydrant') {
      g.fillStyle(0x943e42).fillRect(x, y, w, h);
      g.fillStyle(0xe28b6f)
        .fillRect(x, y, w, 4)
        .fillRect(x + 6, y + 7, 4, h - 10);
      g.fillStyle(0xeba17d).fillRect(x - 4, y + 10, w + 8, 7);
    } else if (style === 'mailbox') {
      g.fillStyle(0x87ada5).fillRect(x, y, w, 20);
      g.fillStyle(0xc5d8b8).fillRect(x, y, w, 3);
      g.fillStyle(0x526c68).fillRect(x, y + 20, w, h - 20);
      g.fillStyle(0xe8b277).fillRect(x + w - 5, y - 7, 3, 17);
    } else if (style === 'bush') {
      g.fillStyle(0x749b64).fillRect(x, y, w, h);
      g.fillStyle(0xa6bd78).fillRect(x, y, w, 3);
      for (let dx = 7; dx < w; dx += 14)
        g.fillStyle(0x567e58).fillRect(x + dx, y + 10, 9, 9);
    } else if (style === 'barrier') {
      g.fillStyle(0xefb579).fillRect(x, y, w, h);
      for (let dx = 6; dx < w - 7; dx += 18)
        g.fillStyle(0xb65e42).fillRect(x + dx, y + 4, 9, 16);
      g.fillStyle(0xf8dfb0).fillRect(x, y, w, 3);
    } else if (style === 'engine') {
      g.fillStyle(0xe1aa4f).fillRect(x, y, w, h);
      g.fillStyle(0xffd97c).fillRect(x, y, w, 5);
      for (let dx = 12; dx < w - 12; dx += 12)
        g.fillStyle(0x746449).fillRect(x + dx, y + 16, 5, 30);
      g.fillStyle(0x283f46).fillRect(x - 5, y + h - 42, w + 5, 42);
      for (let dx = 1; dx < w; dx += 26)
        g.fillStyle(0x71837f).fillRect(x + dx, y + h - 33, 18, 23);
      g.lineStyle(9, 0x8d9582).lineBetween(
        x + 48,
        y + 62,
        x + w + 22,
        y + h - 24,
      );
      g.fillStyle(0xc1bda0).fillPoints(
        [
          { x: x + w + 12, y: y + 36 },
          { x: x + w + 26, y: y + 36 },
          { x: x + w + 37, y: y + h },
          { x: x + w + 7, y: y + h },
        ],
        true,
      );
    } else if (style === 'bulldozer') {
      g.fillStyle(0xc99443).fillRect(x, y, w, h);
      g.fillStyle(0xffdc80).fillRect(x - 5, y, w + 10, 7);
      g.fillStyle(0xeeb755).fillRect(x + 8, y + 8, w - 16, h - 20);
      g.fillStyle(0x3f6066).fillRect(x + 24, y + 20, w - 48, 83);
      g.fillStyle(0x84a4a0).fillRect(x + 29, y + 25, w - 58, 5);
      g.fillStyle(0xcc943d).fillRect(x + 70, y + 18, 7, 87);
      g.fillStyle(0x8f733d).fillRect(x + 30, y + 118, w - 60, 7);
      for (let dx = 25; dx < w - 20; dx += 16)
        g.fillStyle(0x786444).fillRect(x + dx, y + 143, 7, 25);
      g.fillStyle(0x2d4248).fillRect(x - 23, y + h - 46, w + 46, 46);
      for (let dx = -18; dx < w + 16; dx += 28) {
        g.fillStyle(0x82908a).fillRect(x + dx, y + h - 36, 21, 25);
        g.fillStyle(0x435b5a).fillRect(x + dx + 5, y + h - 30, 11, 12);
      }
    } else {
      const crate = style === 'crate';
      g.fillStyle(
        crate ? 0x9d7956 : style === 'street' ? 0x586267 : 0x5e7778,
      ).fillRect(x, y, w, h);
      g.fillStyle(
        crate ? 0xe2bc80 : style === 'street' ? 0xc6c5a9 : 0xccd7bb,
      ).fillRect(x, y, w, 4);
      g.fillStyle(0x293f47).fillRect(x, y + h - 5, w, 5);
      if (crate) {
        for (let dx = 9; dx < w - 5; dx += 21)
          g.fillStyle(0x765c46).fillRect(x + dx, y + 6, 3, h - 12);
        g.fillStyle(0xc6a071).fillRect(x + 4, y + h - 10, w - 8, 5);
      } else if (style === 'street') {
        for (let dx = 28; dx < w - 20; dx += 70)
          g.fillStyle(0xa9aa92).fillRect(x + dx, y + 23, 26, 3);
        // Bright lips make pits visible at speed.
        g.fillStyle(0xf0bd77)
          .fillRect(x, y, 9, 9)
          .fillRect(x + w - 9, y, 9, 9);
      } else {
        for (let dx = 14; dx < w; dx += 54)
          g.fillStyle(0x374f55).fillRect(x + dx, y + h, 7, 135);
      }
    }
  }
  update() {
    /* Static world art is clipped by the forced-scroll camera. */
  }
}
