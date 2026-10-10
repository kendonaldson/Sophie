import type Phaser from 'phaser';
import sheet from './sheet.json';

export const pizzaAppearance = {
  ...sheet,
  idleFrame: 0,
  runFrames: [0, 1, 2, 4, 3],
  frameRate: 18,
  animation: 'pizza-speed',
} as const;

export function createPizzaAnimation(scene: Phaser.Scene) {
  const c = pizzaAppearance;
  if (!scene.anims.exists(c.animation))
    scene.anims.create({
      key: c.animation,
      frames: c.runFrames.map((frame) => ({ key: c.key, frame })),
      frameRate: c.frameRate,
      repeat: -1,
    });
}
