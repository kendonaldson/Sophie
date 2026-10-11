import type Phaser from 'phaser';
import type { Player } from '../player/Player';
import { pizzaDashAppearance as sheet, pizzaDashPose } from './dashAppearance';
import { pizzaRushConfig as c } from './config';

/** An overlay leaves the 64px body and its collision offsets entirely stable. */
export class PizzaRushVisual {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly trail: Phaser.GameObjects.Graphics;
  private elapsed = 0;
  constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
  ) {
    this.sprite = scene.add
      .sprite(0, 0, sheet.key)
      .setDepth(11)
      .setVisible(false)
      .setName('PizzaRush');
    this.trail = scene.add.graphics().setDepth(9);
  }
  update(ms: number) {
    this.elapsed += ms;
    const player = this.player,
      power = player.controller.pizzaRush;
    const active = Boolean(power?.active),
      dash = player.controller.dash;
    this.sprite.setVisible(active && dash.active);
    player.sprite.setVisible(!(active && dash.active));
    player.sprite.anims.timeScale = active ? c.runningAnimationRate : 1;
    this.trail.clear();
    if (!active) return;
    const b = player.body,
      direction = player.controller.facing;
    if (dash.active) {
      const pose = pizzaDashPose(dash.direction, this.elapsed);
      this.sprite
        .setPosition(Math.round(b.center.x), Math.round(b.center.y))
        .setFrame(pose.frame)
        .setFlipX(pose.flipX)
        .setAngle(pose.angle);
      for (let i = 1; i <= 5; i++)
        this.trail
          .fillStyle(0xffd27e, (6 - i) * 0.06)
          .fillRect(
            Math.round(b.center.x - dash.direction.x * i * 14) - 8,
            Math.round(b.center.y - dash.direction.y * i * 14),
            16,
            3,
          );
    } else if (Math.abs(b.velocity.x) > 80) {
      for (let i = 1; i <= 4; i++)
        this.trail
          .fillStyle(0xffda8d, (5 - i) * 0.045)
          .fillRect(
            Math.round(b.center.x - direction * (12 + i * 9)),
            Math.round(b.bottom - 4 + (i % 2)),
            8,
            2,
          );
    }
  }
  clear() {
    this.sprite.setVisible(false);
    this.trail.clear();
    this.player.sprite.setVisible(true);
    this.player.sprite.anims.timeScale = 1;
  }
  destroy() {
    this.clear();
    this.sprite.destroy();
    this.trail.destroy();
  }
}
