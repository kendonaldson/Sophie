import Phaser from 'phaser';
import { physics, type PlayerPhysicsConfig } from '../config/physics';
import { PlayerController } from './PlayerController';
import { cornerCorrection, edgeCorrection, type Rect } from './CollisionAssist';
import type { PlayerIntent } from '../input/Input';
import type { Point } from '../levels/types';
import { animatePlayer } from './animations';
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly controller: PlayerController;
  constructor(
    scene: Phaser.Scene,
    spawn: Point,
    private readonly solids: readonly Rect[],
    private readonly config: Readonly<PlayerPhysicsConfig> = physics,
    private readonly texture = 'sophie',
  ) {
    this.controller = new PlayerController(config);
    this.sprite = scene.physics.add
      .sprite(
        spawn.x,
        spawn.y - (32 - physics.collisionInsetBottom),
        texture,
        0,
      )
      .setDepth(10);
    this.body.setSize(
      64 - physics.collisionInsetX * 2,
      64 - physics.collisionInsetTop - physics.collisionInsetBottom,
      false,
    );
    this.body.setOffset(physics.collisionInsetX, physics.collisionInsetTop);
    this.body.setAllowGravity(false);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(
      physics.dashSpeed,
      Math.max(physics.dashSpeed, physics.maxFallSpeed),
    );
  }
  get body() {
    return this.sprite.body as Phaser.Physics.Arcade.Body;
  }
  get feet() {
    return { x: this.body.center.x, y: this.body.bottom };
  }
  get grounded() {
    return (
      this.body.velocity.y >= 0 &&
      (this.body.blocked.down ||
        this.solids.some(
          (s) =>
            Math.abs(this.body.bottom - s.y) < 0.2 &&
            this.body.right > s.x &&
            this.body.x < s.x + s.width,
        ))
    );
  }
  beforeStep(ms: number, input: PlayerIntent) {
    const b = this.body;
    const result = this.controller.step(ms, input, {
      vx: b.velocity.x,
      vy: b.velocity.y,
      grounded: this.grounded,
    });
    const bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
    const nextY = b.y + (result.vy * ms) / 1000;
    const correction =
      result.vy < 0
        ? cornerCorrection(
            bounds,
            nextY,
            this.solids,
            this.config.cornerCorrectionPixels,
            this.controller.facing,
          )
        : !result.grounded && result.vy > 0
          ? edgeCorrection(
              bounds,
              nextY,
              this.solids,
              this.config.edgeForgivenessPixels,
            )
          : 0;
    if (correction) {
      this.sprite.x += correction;
      b.updateFromGameObject();
    }
    b.setVelocity(result.vx, result.vy);
    return result;
  }
  render() {
    animatePlayer(
      this.sprite,
      this.controller,
      this.body.velocity.x,
      this.body.velocity.y,
      this.grounded,
      this.texture,
    );
  }
  respawn(spawn: Point) {
    this.controller.reset();
    this.place(spawn);
    this.sprite.clearTint();
  }
  place(feet: Point) {
    this.body.reset(feet.x, feet.y - (32 - physics.collisionInsetBottom));
    // Arcade reset() uses the sprite's top-left before applying body insets.
    // Synchronize immediately for scripted placement and the next fixed tick.
    this.body.updateFromGameObject();
    this.body.prev.copy(this.body.position);
    this.body.prevFrame.copy(this.body.position);
    this.body.setVelocity(0, 0);
    this.body.resetFlags();
  }
  translate(dx: number, dy: number) {
    this.sprite.x += dx;
    this.sprite.y += dy;
    this.body.updateFromGameObject();
  }
}
