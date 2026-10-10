import type Phaser from 'phaser';
import sheet from './sheet.json';

export const shellyAppearance = {
  ...sheet,
  animations: {
    walk: { frames: [0, 1, 2, 3, 4, 5, 6], frameRate: 10 },
    idle: { frames: [7], frameRate: 1 },
    talk: { frames: [8, 9, 10, 9], frameRate: 7 },
    scold: { frames: [11], frameRate: 1 },
    crossed: { frames: [12], frameRate: 1 },
    determined: { frames: [13], frameRate: 1 },
    surprised: { frames: [14], frameRate: 1 },
  },
} as const;
export type ShellyPose = keyof typeof shellyAppearance.animations;

export function createShellyAnimations(scene: Phaser.Scene) {
  for (const [pose, animation] of Object.entries(shellyAppearance.animations)) {
    const key = `shelly-${pose}`;
    if (!scene.anims.exists(key))
      scene.anims.create({
        key,
        frames: animation.frames.map((frame) => ({ key: sheet.key, frame })),
        frameRate: animation.frameRate,
        repeat: -1,
      });
  }
}
