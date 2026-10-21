import type Phaser from 'phaser';
import { WorldArt } from '../rendering/WorldArt';

type Graphics = Phaser.GameObjects.Graphics;
const rect = (
  g: Graphics,
  color: number,
  x: number,
  y: number,
  width: number,
  height: number,
) => g.fillStyle(color).fillRect(x, y, width, height);

export interface EpilogueBus {
  x: number;
  visible: boolean;
  doorOpen: boolean;
}

/** Two fixed, dog-height sets. People are represented only by off-screen audio. */
export class EpilogueArt {
  private readonly exterior: Graphics;
  private readonly bedroom: Graphics;
  private readonly bus: Graphics;
  private doorOpen?: boolean;

  constructor(scene: Phaser.Scene) {
    this.exterior = scene.add.graphics().setName('Home exterior').setDepth(0);
    this.bedroom = scene.add.graphics().setName('Bedroom').setDepth(0);
    this.bus = scene.add.graphics().setName('School bus').setDepth(2);
    this.drawExterior();
    this.drawBedroom();
    this.bedroom.setVisible(false);
    this.bus.setVisible(false);
  }

  private drawExterior() {
    const g = this.exterior;
    const bands = [0xa6b9ae, 0xbac5b3, 0xcbd0b9, 0xdad7bc, 0xe6dcc2];
    bands.forEach((color, index) => rect(g, color, 0, index * 58, 640, 59));
    // The afternoon palette and dormer are the same ones seen on the way out.
    for (let y = -22; y <= 22; y += 2) {
      const half = Math.round(Math.sqrt(22 * 22 - y * y));
      rect(g, 0xf6e6b8, 534 - half, 89 + y, half * 2, 2);
    }
    for (const [x, y, width] of [
      [44, 70, 96],
      [377, 40, 78],
    ]) {
      rect(g, 0xe4dec2, x!, y!, width!, 4);
      rect(g, 0xe4dec2, x! + 12, y! - 4, width! - 34, 4);
    }
    for (const [x, y, width] of [
      [-35, 164, 159],
      [510, 155, 159],
    ]) {
      rect(g, 0x9cac98, x!, y!, width!, 124);
      rect(g, 0x7e9185, x! - 5, y!, width! + 10, 12);
      for (let wx = x! + 18; wx < x! + width! - 20; wx += 42)
        for (let wy = y! + 26; wy < 265; wy += 42) {
          rect(g, 0x748c83, wx, wy, 18, 25);
          rect(g, 0xc4c4a4, wx + 4, wy + 4, 10, 17);
        }
    }
    rect(g, 0x7d946f, 0, 270, 640, 18);
    WorldArt.drawRoof(
      g,
      { id: 'home', x: 154, y: 124, width: 332, height: 154, style: 'home' },
      0,
    );
    WorldArt.drawAttic(g, 208, 124);
    // Closed front door and ordinary steps; no person appears in the opening.
    rect(g, 0xc4b297, 292, 205, 57, 73);
    rect(g, 0xe5d2ab, 297, 202, 48, 76);
    rect(g, 0x455d56, 302, 208, 38, 70);
    rect(g, 0x6c7e67, 306, 212, 30, 62);
    rect(g, 0x96aa96, 312, 216, 18, 19);
    rect(g, 0x42594f, 311, 242, 20, 27);
    rect(g, 0xe8c386, 330, 244, 3, 4);
    rect(g, 0xd7c6a2, 289, 276, 64, 6);
    rect(g, 0x9c9b81, 284, 282, 74, 6);
    rect(g, 0x617260, 348, 214, 6, 14);
    rect(g, 0xf0d69d, 349, 216, 4, 8);
    for (const x of [125, 498]) {
      rect(g, 0x6a7e60, x, 251, 28, 23);
      rect(g, 0x87986e, x - 8, 253, 42, 15);
      rect(g, 0x9daa7c, x + 4, 248, 19, 9);
    }
    // Tree and fence frame the house without obscuring the familiar attic.
    rect(g, 0x7f8061, 69, 194, 10, 85);
    rect(g, 0x889c72, 40, 149, 68, 54);
    rect(g, 0x9dac7d, 52, 137, 45, 28);
    rect(g, 0x7d936b, 34, 169, 82, 24);
    for (let x = 10; x < 640; x += 19) {
      if (x > 140 && x < 500) continue;
      rect(g, 0xc2c2a1, x, 257, 5, 27);
      rect(g, 0xd5d0ae, x + 1, 255, 3, 3);
    }
    rect(g, 0xb0b89a, 0, 266, 140, 4);
    rect(g, 0xb0b89a, 512, 266, 128, 4);
    rect(g, 0xb8b89c, 0, 288, 640, 12);
    rect(g, 0xd7d0ad, 0, 288, 640, 3);
    rect(g, 0x4e6260, 0, 300, 640, 60);
    rect(g, 0x718079, 0, 300, 640, 3);
    for (let x = 16; x < 640; x += 112) rect(g, 0xc2b995, x, 342, 51, 3);
  }

  private drawBedroom() {
    const g = this.bedroom;
    rect(g, 0xeee0bc, 0, 0, 640, 360);
    rect(g, 0xf5e8ca, 0, 0, 640, 18);
    rect(g, 0xc3b58d, 0, 18, 640, 4);
    rect(g, 0xa0ae8c, 0, 198, 640, 61);
    rect(g, 0xb9c2a2, 0, 198, 640, 5);
    for (let x = 19; x < 640; x += 42) rect(g, 0x8f9e81, x, 207, 2, 46);
    rect(g, 0x7b7f66, 0, 255, 640, 7);
    rect(g, 0xc19c72, 0, 262, 640, 98);
    for (let y = 265; y < 360; y += 24) {
      rect(g, 0xa78966, 0, y + 22, 640, 2);
      for (let x = (y - 265) % 48 === 0 ? 0 : -60; x < 640; x += 120) {
        rect(g, 0xae8c64, x + 117, y, 2, 22);
        rect(g, 0xd1af82, x + 9, y + 4, 80, 2);
      }
    }
    // An empty window, soft curtains and evening light; no family photographs.
    rect(g, 0xb0a07a, 66, 52, 158, 128);
    rect(g, 0xf6ebcf, 72, 58, 146, 116);
    rect(g, 0xb9ccc0, 78, 64, 134, 104);
    rect(g, 0xe1dcc0, 78, 122, 134, 46);
    rect(g, 0x9ead91, 78, 143, 134, 25);
    rect(g, 0xe9dfbd, 142, 64, 5, 104);
    rect(g, 0xe9dfbd, 78, 111, 134, 5);
    rect(g, 0xd7c7a1, 61, 177, 168, 6);
    rect(g, 0x887c63, 52, 44, 188, 5);
    for (const x of [58, 204]) {
      rect(g, 0xc4b3a0, x, 49, 25, 139);
      rect(g, 0xe4d0b8, x + 4, 49, 8, 139);
      rect(g, 0xaf9f91, x + 18, 49, 3, 139);
    }
    g.fillStyle(0xf2dca0, 0.19).fillPoints(
      [
        { x: 83, y: 264 },
        { x: 193, y: 264 },
        { x: 354, y: 360 },
        { x: 203, y: 360 },
      ],
      true,
    );
    // A tidy bed and lamp, all behind the dogs' walking path.
    rect(g, 0x79684e, 28, 203, 9, 76);
    rect(g, 0xa48b62, 37, 217, 152, 59);
    rect(g, 0x79684e, 180, 221, 9, 58);
    rect(g, 0xe9ddba, 38, 217, 142, 17);
    rect(g, 0xf8efd9, 44, 215, 48, 14);
    rect(g, 0xa3b2a3, 96, 228, 84, 39);
    rect(g, 0xb7c4b2, 96, 228, 84, 7);
    rect(g, 0x8e9d90, 96, 257, 84, 5);
    rect(g, 0x74674f, 38, 269, 142, 5);
    rect(g, 0x9a805a, 203, 230, 39, 35);
    rect(g, 0xc4a77a, 199, 226, 47, 5);
    rect(g, 0xd7bd8b, 210, 235, 25, 11);
    rect(g, 0x837154, 220, 239, 5, 3);
    rect(g, 0xb89568, 219, 207, 4, 19);
    rect(g, 0xe9cf98, 207, 190, 29, 19);
    rect(g, 0xf5dfad, 211, 185, 21, 7);
    rect(g, 0xd1b57d, 207, 207, 29, 3);
    // A low woven rug keeps the empty bedroom composed after the dogs leave.
    rect(g, 0xa29578, 209, 274, 284, 41);
    rect(g, 0xc7bba0, 215, 277, 272, 35);
    rect(g, 0x9cab92, 223, 281, 256, 27);
    rect(g, 0xb6bea0, 232, 287, 238, 15);
    for (let x = 219; x < 490; x += 9) {
      rect(g, 0xd3c7ab, x, 272, 2, 3);
      rect(g, 0xd3c7ab, x, 315, 2, 3);
    }
    rect(g, 0x9d8460, 443, 137, 86, 7);
    rect(g, 0xb69e73, 448, 144, 4, 12);
    rect(g, 0xb69e73, 518, 144, 4, 12);
    for (const [x, color, height] of [
      [449, 0x889e91, 25],
      [461, 0xbd8c72, 29],
      [474, 0xc6b37e, 22],
    ]) {
      rect(g, color!, x!, 137 - height!, 10, height!);
      rect(g, 0xe7d6ad, x! + 2, 140 - height!, 6, 2);
    }
    rect(g, 0xbc9d75, 502, 123, 17, 14);
    rect(g, 0x80966c, 508, 106, 4, 18);
    rect(g, 0x9bad7a, 499, 111, 11, 7);
    rect(g, 0x81966a, 511, 104, 12, 8);
    // The exit reaches the edge of the shot; the camera never sees its hallway.
    rect(g, 0xc5b590, 574, 85, 66, 200);
    rect(g, 0xf4e4c3, 580, 91, 60, 194);
    rect(g, 0x807c67, 588, 99, 52, 185);
    rect(g, 0xaba58a, 594, 99, 46, 164);
    rect(g, 0xcbb48d, 588, 263, 52, 23);
    rect(g, 0xdac79e, 580, 284, 60, 4);
  }

  private drawBus(open: boolean) {
    const g = this.bus.clear();
    rect(g, 0x5a4b32, -80, -57, 154, 51);
    rect(g, 0xe6ad47, -76, -54, 142, 46);
    rect(g, 0xf8d675, -70, -62, 113, 10);
    rect(g, 0xd99a39, 42, -37, 36, 29);
    rect(g, 0xf5cb65, 42, -37, 36, 5);
    for (let x = -66; x < 34; x += 21) {
      rect(g, 0x3e5a5f, x, -47, 16, 19);
      rect(g, 0x96c2bc, x + 2, -45, 12, 4);
    }
    rect(g, 0x3c5556, 44, -50, 14, 17);
    rect(g, 0x514836, -76, -24, 143, 4);
    rect(g, 0x514836, -76, -14, 143, 3);
    rect(g, 0x685637, 22, -48, 18, 40);
    if (open) {
      rect(g, 0x2d4545, 25, -44, 12, 33);
      rect(g, 0xc0ac77, 26, -14, 10, 3);
    } else {
      rect(g, 0xa9beb0, 25, -44, 5, 21);
      rect(g, 0xa9beb0, 32, -44, 5, 21);
      rect(g, 0xeac163, 25, -21, 12, 10);
      rect(g, 0x79633d, 30, -44, 2, 33);
    }
    for (const x of [-52, 49]) {
      rect(g, 0x283c42, x - 12, -14, 24, 22);
      rect(g, 0xa5ac98, x - 5, -8, 10, 10);
      rect(g, 0x6b7d75, x - 2, -5, 4, 4);
    }
    rect(g, 0xe97654, -74, -36, 7, 7);
    rect(g, 0xffe3a4, 74, -28, 7, 10);
    rect(g, 0x9ca89a, 72, -10, 12, 6);
  }

  update(environment: 'exterior' | 'bedroom', bus: EpilogueBus) {
    const exterior = environment === 'exterior';
    this.exterior.setVisible(exterior);
    this.bedroom.setVisible(!exterior);
    this.bus.setVisible(exterior && bus.visible);
    if (this.doorOpen !== bus.doorOpen) {
      this.doorOpen = bus.doorOpen;
      this.drawBus(bus.doorOpen);
    }
    this.bus.setPosition(Math.round(bus.x), 294);
  }

  destroy() {
    this.exterior.destroy();
    this.bedroom.destroy();
    this.bus.destroy();
  }
}
