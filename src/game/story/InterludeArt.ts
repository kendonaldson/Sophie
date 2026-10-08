import type Phaser from 'phaser';
/** A fixed 640×360 exterior: two dogs are the only characters in the shot. */
export function drawInterludeExterior(scene: Phaser.Scene) {
  const g = scene.add.graphics().setDepth(0);
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    alpha = 1,
  ) =>
    g
      .fillStyle(color, alpha)
      .fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  rect(0, 0, 640, 360, 0x182e38);
  rect(0, 55, 640, 75, 0x213a43);
  rect(0, 130, 640, 145, 0x2a4147);
  // A small warm moon and a few restrained stars, beyond the trees.
  rect(540, 31, 15, 19, 0xe7d7a7);
  rect(536, 35, 23, 11, 0xe7d7a7);
  rect(537, 32, 10, 14, 0x213a43);
  for (const [x, y] of [
    [420, 29],
    [480, 68],
    [605, 55],
    [580, 99],
    [460, 17],
  ])
    rect(x!, y!, 2, 2, 0xa3b8b4);
  // Trees line the road; blocky foliage stays quieter than the foreground dogs.
  for (const [x, y, s] of [
    [436, 141, 1],
    [527, 134, 1.15],
    [614, 161, 0.9],
  ]) {
    rect(x! - 4, y! + 35, 9, 109, 0x293b39);
    rect(x! - 27 * s!, y!, 54 * s!, 73 * s!, 0x25453f);
    rect(x! - 40 * s!, y! + 19, 80 * s!, 40 * s!, 0x25453f);
    rect(x! - 25 * s!, y! - 7, 43 * s!, 16, 0x33584a);
    rect(x! - 35 * s!, y! + 20, 18, 9, 0x33584a);
    rect(x! + 14, y! + 60, 16, 7, 0x1d3937);
  }
  // The warehouse continues out of frame to the left. Its exit is behind Sophie.
  rect(0, 86, 397, 192, 0x4e5757);
  rect(0, 76, 407, 12, 0x727568);
  rect(0, 89, 397, 7, 0x35474a);
  rect(0, 227, 397, 51, 0x455351);
  for (let y = 104; y < 267; y += 17) {
    rect(0, y, 397, 1, 0x394b4d);
    for (let x = (y % 2) * 24; x < 397; x += 48) rect(x, y, 1, 17, 0x3e4e4e);
  }
  for (const x of [36, 118]) {
    rect(x, 119, 57, 54, 0x293d43);
    rect(x + 4, 123, 49, 45, 0xd5b277);
    rect(x + 4, 149, 49, 19, 0x8e8060);
    rect(x + 27, 121, 4, 49, 0x3d4b49);
    rect(x, 173, 61, 5, 0x83836b);
  }
  rect(217, 153, 66, 123, 0x263d42);
  rect(223, 158, 54, 116, 0x717768);
  rect(228, 164, 43, 106, 0x626d61);
  rect(232, 174, 35, 22, 0x344c50);
  rect(261, 220, 3, 8, 0xd6bb7c);
  rect(211, 274, 80, 5, 0xc6b78f);
  rect(311, 173, 53, 10, 0x78806b);
  rect(316, 176, 30, 3, 0xa9ac86);
  // Warm porch and street lamps use stepped pixels, never flashing or police colors.
  for (const [x, y] of [
    [247, 135],
    [491, 140],
  ]) {
    if (x === 491) {
      rect(x, y!, 4, 139, 0x8d8e70);
      rect(x - 15, y! - 5, 21, 4, 0x8d8e70);
    }
    rect(x! - 10, y!, 18, 5, 0xe9c88d);
    for (let n = 0; n < 6; n++)
      rect(x! - 14 - n * 6, y! + 5 + n * 20, 28 + n * 12, 20, 0xf0cf91, 0.045);
  }
  rect(0, 279, 640, 20, 0x777b69);
  rect(0, 283, 640, 2, 0x99977b);
  rect(0, 299, 640, 6, 0x313f43);
  rect(0, 305, 640, 55, 0x39464b);
  for (let x = 18; x < 640; x += 107) rect(x, 343, 49, 3, 0x969883);
  for (let x = 8; x < 640; x += 39) rect(x, 292, 1, 7, 0x5d6a5f);
  rect(94, 253, 34, 25, 0x6d6c52);
  rect(97, 257, 28, 3, 0x9a8c62);
  rect(100, 261, 3, 14, 0x8f825c);
  rect(119, 261, 3, 14, 0x8f825c);
  for (const x of [15, 144, 405, 564]) {
    rect(x, 275, 2, 7, 0x84916a);
    rect(x - 3, 277, 3, 2, 0x667e58);
    rect(x + 2, 272, 3, 4, 0x667e58);
  }
}
