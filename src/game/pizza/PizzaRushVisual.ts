import type Phaser from 'phaser';
import type { Player } from '../player/Player';
import { pizzaDashAppearance as sheet, pizzaDashPose } from './dashAppearance';
import { pizzaRushConfig as c } from './config';

/** An overlay leaves the 64px body and its collision offsets entirely stable. */
export class PizzaRushVisual {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly aura: Phaser.GameObjects.Graphics;
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
    this.aura = scene.add
      .graphics()
      .setDepth(9)
      .setVisible(false)
      .setName('PizzaRushAura');
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
    this.aura.clear().setVisible(active);
    if (!active) return;
    const b = player.body,
      direction = player.controller.facing;
    this.drawAura(
      b.center.x,
      b.center.y,
      dash.active ? 0 : c.aura.standingOffsetY,
    );
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
  private drawAura(x: number, y: number, offsetY: number) {
    const a = c.aura,
      step = a.pixelStep,
      pulse = (Math.sin((this.elapsed / a.pulseMs) * Math.PI * 2) + 1) / 2;
    this.aura.setPosition(Math.round(x), Math.round(y));
    // Quantized horizontal bands keep the halo crisp with the pixel artwork.
    // The transparent center stays behind Sophie and leaves hazards readable.
    for (let row = -a.halfHeight; row < a.halfHeight; row += step) {
      const fraction = (row + step / 2) / a.halfHeight,
        width =
          Math.round(
            (Math.sqrt(1 - fraction * fraction) * a.halfWidth) / step,
          ) * step;
      this.aura
        .fillStyle(a.color, a.fillAlpha + pulse * a.pulseAlpha)
        .fillRect(-width, row + offsetY, width * 2, step)
        .fillStyle(a.color, a.edgeAlpha + pulse * a.pulseAlpha)
        .fillRect(-width, row + offsetY, step, step)
        .fillRect(width - step, row + offsetY, step, step);
    }
    const shimmer = Math.floor(this.elapsed / a.shimmerStepMs);
    for (let i = 0; i < 3; i++) {
      const angle = ((shimmer + i * 8) / 24) * Math.PI * 2,
        sparkX = Math.round((Math.cos(angle) * a.halfWidth) / step) * step,
        sparkY = Math.round((Math.sin(angle) * a.halfHeight) / step) * step;
      this.aura
        .fillStyle(a.highlightColor, 0.65)
        .fillRect(sparkX - 1, sparkY - 1 + offsetY, step, step);
    }
  }
  clear() {
    this.sprite.setVisible(false);
    this.trail.clear();
    this.aura.clear().setVisible(false);
    this.player.sprite.setVisible(true);
    this.player.sprite.anims.timeScale = 1;
  }
  destroy() {
    this.clear();
    this.sprite.destroy();
    this.trail.destroy();
    this.aura.destroy();
  }
}
