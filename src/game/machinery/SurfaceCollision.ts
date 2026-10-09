import type Phaser from 'phaser';
import type { Rect } from '../player/CollisionAssist';

/** Use Arcade's one-way face checks for both static and moving thin crowns. */
export function configureSurfaceCollision(
  body: Phaser.Physics.Arcade.StaticBody,
  surface: Rect,
) {
  if (surface.collision !== 'top-only') return;
  body.checkCollision.up = true;
  body.checkCollision.down = false;
  body.checkCollision.left = false;
  body.checkCollision.right = false;
}
