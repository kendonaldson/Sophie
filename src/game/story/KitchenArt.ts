import type Phaser from 'phaser';
import { interlude3 as c } from './interlude3';

export const kitchenGeometry = {
  hatch: { x: 16, y: 180, width: 96, height: 110 },
  counter: { x: 404, y: c.pizzaY, width: 110, height: 54 },
  pizza: { x: c.pizzaX, y: c.pizzaY - 7 },
};

/** A bright, fixed kitchen set; only the pizza and oven light change. */
export class KitchenArt {
  private readonly pizza;
  private readonly warmth;
  private time = 0;
  constructor(scene: Phaser.Scene) {
    const g = scene.add.graphics().setDepth(0);
    const rect = (x: number, y: number, w: number, h: number, color: number) =>
      g.fillStyle(color).fillRect(x, y, w, h);
    rect(0, 0, 640, 360, 0xf4e3bd);
    rect(0, 0, 640, 18, 0x657b59);
    rect(0, 18, 640, 5, 0xc7b785);
    rect(0, 25, 640, 111, 0xf8edcf);
    // Cream backsplash, tomato-red tile stripe, soft green lower cupboards.
    for (let y = 136; y < 272; y += 24)
      for (let x = -24 + ((y / 24) % 2) * 24; x < 640; x += 48) {
        rect(x, y, 46, 22, y === 184 ? 0xc9654b : 0xe4d4ad);
        rect(x + 2, y + 2, 43, 18, y === 184 ? 0xdf8060 : 0xf4e9cb);
      }
    rect(0, 270, 640, 90, 0xc5aa83);
    for (let y = 286; y < 360; y += 30)
      for (let x = (((y - 286) / 30) % 2) * -40; x < 640; x += 80) {
        rect(x, y, 78, 28, 0xe2cfaa);
        rect(x + 2, y + 2, 74, 2, 0xf0debd);
      }
    rect(0, 271, 640, 5, 0x9e8061);
    // The same ribbed metal service opening the dogs just walked through.
    const hatch = kitchenGeometry.hatch;
    rect(
      hatch.x - 5,
      hatch.y - 5,
      hatch.width + 10,
      hatch.height + 4,
      0x8a9790,
    );
    rect(hatch.x, hatch.y, hatch.width, hatch.height, 0x394b4c);
    rect(
      hatch.x + 7,
      hatch.y + 8,
      hatch.width - 14,
      hatch.height - 12,
      0x283b3d,
    );
    for (let x = hatch.x + 12; x < hatch.x + hatch.width - 8; x += 16)
      rect(x, hatch.y + 12, 3, 90, 0x46544d);
    rect(hatch.x + 23, hatch.y + 47, 48, 4, 0xb67e40);
    rect(hatch.x + 39, hatch.y + 43, 18, 12, 0xf2c56c);
    rect(hatch.x - 7, 283, hatch.width + 14, 6, 0xafb5a0);
    // Open hatch door and handle stay behind the emerging actors.
    rect(114, 184, 17, 100, 0x667e76);
    rect(117, 188, 9, 90, 0x9eafa0);
    rect(123, 224, 4, 12, 0xd9d5b3);
    // Back prep counter: sauce, basil, cheese, bowls, towel and flour sacks.
    rect(150, 228, 174, 47, 0x789178);
    for (const x of [154, 210, 266]) {
      rect(x, 235, 50, 35, 0x94a88b);
      rect(x + 19, 241, 14, 3, 0x596f64);
    }
    rect(146, 221, 182, 8, 0xb2bdb1);
    rect(149, 221, 176, 3, 0xf1eee0);
    for (const [x, color] of [
      [171, 0xc6573b],
      [207, 0x80944a],
      [243, 0xe4bc5f],
    ]) {
      rect(x!, 203, 27, 16, 0x849991);
      rect(x! + 3, 205, 21, 6, color!);
      rect(x! + 1, 214, 25, 2, 0xd5dbcb);
    }
    rect(285, 217, 22, 22, 0xf4e7c5);
    rect(290, 217, 3, 23, 0xc96c54);
    rect(301, 217, 3, 23, 0xc96c54);
    // Shelf brackets, jars and stacked pizza boxes.
    for (const y of [87, 156]) {
      rect(143, y, 180, 7, 0x9c714d);
      rect(149, y + 7, 5, 11, 0xb69268);
      rect(307, y + 7, 5, 11, 0xb69268);
    }
    for (let i = 0; i < 4; i++) {
      const x = 151 + i * 31;
      rect(x, 60, 22, 26, 0xbc6746);
      rect(x + 3, 67, 16, 11, 0xf5e0ae);
      rect(x - 1, 58, 24, 4, 0x738953);
      rect(x + 9, 70, 5, 5, 0xba5742);
    }
    for (let i = 0; i < 3; i++) {
      rect(156 + i * 2, 146 - i * 9, 73, 8, 0xd9b58a);
      rect(158 + i * 2, 146 - i * 9, 69, 2, 0xf4d9ad);
      rect(182 + i * 2, 149 - i * 9, 20, 3, 0xbd6750);
    }
    for (const x of [255, 286]) {
      rect(x, 132, 22, 23, 0xd5b891);
      rect(x + 2, 136, 18, 17, 0xf3dfb6);
      rect(x + 6, 143, 10, 2, 0xb49572);
      rect(x + 5, 129, 12, 4, 0xbe9e78);
    }
    // Hanging utensils and striped awning above the oven.
    rect(343, 67, 111, 4, 0x827f6b);
    for (const [i, x] of [351, 377, 405, 434].entries()) {
      rect(x, 72, 3, 32, 0x82958d);
      rect(x - 4, 99, 11, i % 2 ? 14 : 10, 0xa2b0a3);
      rect(x - 2, 101, 7, 5, 0xc9d3bf);
    }
    rect(524, 34, 96, 116, 0xc75e48);
    rect(530, 42, 84, 97, 0xf7e7bf);
    for (let x = 530; x < 614; x += 24) rect(x, 42, 12, 97, 0xd67755);
    rect(513, 131, 118, 17, 0xa54636);
    rect(519, 148, 109, 91, 0xc98052);
    for (let y = 153; y < 232; y += 16)
      for (let x = 522 + (y % 3) * 6; x < 627; x += 32)
        rect(x, y, 29, 13, 0xd99561);
    rect(541, 174, 68, 54, 0x664535);
    rect(547, 165, 56, 10, 0x80513b);
    rect(551, 171, 48, 51, 0x733927);
    rect(545, 212, 60, 13, 0xeb8c3e);
    rect(552, 218, 49, 6, 0xffc96a);
    rect(514, 230, 120, 10, 0xad8e6e);
    rect(520, 240, 108, 35, 0x8f7156);
    // A low foreground prep island makes the pizza readable from the entrance.
    const table = kitchenGeometry.counter;
    rect(table.x + 3, table.y + 9, table.width - 6, 5, 0x85958a);
    rect(table.x + 9, table.y + 10, 6, table.height - 10, 0x809187);
    rect(
      table.x + table.width - 15,
      table.y + 10,
      6,
      table.height - 10,
      0x809187,
    );
    rect(table.x + 11, table.y + 43, table.width - 22, 5, 0xb3bca7);
    rect(table.x - 3, table.y, table.width + 6, 7, 0x8b9b91);
    rect(table.x - 3, table.y - 3, table.width + 6, 4, 0xe0d6b7);
    rect(table.x + 2, table.y - 5, table.width - 4, 3, 0xf9e9bd);
    // Two broad warm lights frame the food rather than a threatening spotlight.
    for (const x of [75, 461]) {
      rect(x, 23, 3, 21, 0x697b64);
      rect(x - 14, 44, 31, 5, 0x78905e);
      rect(x - 21, 49, 45, 9, 0x91a469);
      rect(x - 17, 58, 37, 4, 0xffdc87);
    }
    this.warmth = scene.add.graphics().setDepth(1);
    this.pizza = scene.add.graphics().setDepth(4);
    this.drawPizza(false);
  }
  private drawPizza(taken: boolean) {
    const g = this.pizza.clear(),
      { x, y } = kitchenGeometry.pizza;
    g.fillStyle(0x9b6950).fillRect(x - 32, y + 5, 64, 4);
    g.fillStyle(0xe8c091)
      .fillRect(x - 28, y - 4, 56, 9)
      .fillRect(x - 24, y - 8, 48, 16);
    g.fillStyle(0xd56c3b).fillRect(x - 24, y - 5, 48, 9);
    g.fillStyle(0xffd36d)
      .fillRect(x - 23, y - 4, 46, 7)
      .fillRect(x - 18, y - 6, 36, 11);
    for (const [dx, dy] of [
      [-15, -2],
      [-4, 2],
      [6, -3],
      [17, 1],
    ])
      g.fillStyle(0xbe4c36).fillRect(x + dx!, y + dy!, 5, 3);
    for (const dx of [-8, 13])
      g.fillStyle(0x6f944c).fillRect(x + dx, y - 2, 3, 2);
    if (taken)
      g.fillStyle(0x9b6950).fillTriangle(x, y, x + 28, y + 7, x + 13, y + 8);
  }
  update(ms: number, taken: boolean) {
    this.time += ms;
    this.drawPizza(taken);
    const g = this.warmth.clear();
    const lift = Math.floor(this.time / 180) % 3;
    g.fillStyle(0xffca6a, 0.22).fillRect(535, 210, 75, 26);
    for (let i = 0; i < 4; i++)
      g.fillStyle(i % 2 ? 0xffd57b : 0xf4a044).fillRect(
        551 + i * 12,
        215 - ((i + lift) % 3) * 3,
        6,
        9,
      );
  }
}
