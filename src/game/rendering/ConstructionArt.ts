import type Phaser from 'phaser';
import type { Rect } from '../player/CollisionAssist';
export function drawScaffoldPlatform(g: Phaser.GameObjects.Graphics, p: Rect) {
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
export function drawConstructionLift(m: Phaser.GameObjects.Graphics, s: Rect) {
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
