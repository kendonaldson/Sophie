import type Phaser from 'phaser';
import type { PlayerController } from './PlayerController';
export const frames = { idle: 0, walk: 8, run: 16, jump: 24 } as const;
export const jimmySitFrame = 32;
export function createAnimations(scene: Phaser.Scene, texture = 'sophie') {
  for (const [name, start] of Object.entries(frames)) {
    if (name === 'jump') continue;
    const key = texture === 'sophie' ? name : `${texture}-${name}`;
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(texture, {
        start,
        end: start + 7,
      }),
      frameRate: name === 'idle' ? 5 : name === 'walk' ? 10 : 14,
      repeat: -1,
    });
  }
  if (texture === 'jimmy' && !scene.anims.exists('jimmy-sit'))
    scene.anims.create({
      key: 'jimmy-sit',
      frames: scene.anims.generateFrameNumbers(texture, {
        start: jimmySitFrame,
        end: jimmySitFrame + 7,
      }),
      frameRate: 3,
      repeat: -1,
    });
}
export function animatePlayer(
  sprite: Phaser.GameObjects.Sprite,
  controller: PlayerController,
  vx: number,
  vy: number,
  grounded: boolean,
  texture = 'sophie',
) {
  sprite.setFlipX(controller.facing < 0);
  if (!grounded) {
    sprite.anims.stop();
    sprite.setFrame(frames.jump + (vy < -80 ? 2 : vy > 60 ? 5 : 3));
  } else
    sprite.play(
      `${texture === 'sophie' ? '' : `${texture}-`}${Math.abs(vx) < 8 ? 'idle' : Math.abs(vx) < 110 ? 'walk' : 'run'}`,
      true,
    );
  // Dash is a composited effect. No invented dash frame or separate animation.
}
