import type Phaser from 'phaser';
import {
  createShellyAnimations,
  shellyAppearance,
  type ShellyPose,
} from '../shelly/appearance';
import { pizzaPickupAppearance } from '../pizza/dashAppearance';
import type { PizzaPickup } from '../pizza/PizzaPickup';
import type { ShellyRoll } from './ShellyRoll';
import type { ShellyBlocker } from './ShellyBlocker';
import type { FactoryStory } from './FactoryStory';
import type { FactoryDefinition } from './config';
import { factoryTuning as t } from './config';

export class FactoryCast {
  readonly shelly: Phaser.GameObjects.Sprite;
  private readonly warning: Phaser.GameObjects.Graphics;
  private readonly trail: Phaser.GameObjects.Graphics;
  private readonly slices: Phaser.GameObjects.Sprite[];
  private history: { x: number; y: number; life: number }[] = [];
  private elapsed = 0;
  constructor(
    scene: Phaser.Scene,
    private readonly definition: FactoryDefinition,
    pickups: PizzaPickup[],
  ) {
    createShellyAnimations(scene);
    this.shelly = scene.add
      .sprite(400, 980, shellyAppearance.key)
      .setDepth(10)
      .setName('Shelly');
    this.warning = scene.add.graphics().setDepth(3);
    this.trail = scene.add.graphics().setDepth(8);
    this.slices = pickups.map((p) =>
      scene.add
        .sprite(p.definition.x, p.definition.y, pizzaPickupAppearance.key)
        .setDepth(6),
    );
  }
  update(
    ms: number,
    story: FactoryStory,
    roll: ShellyRoll,
    mid: ShellyBlocker,
    final: ShellyBlocker,
    pickups: PizzaPickup[],
    playerX: number,
  ) {
    this.elapsed += ms;
    this.warning.clear();
    this.trail.clear();
    if (roll.phase === 'deflected') this.history = [];
    this.history = this.history
      .map((p) => ({ ...p, life: p.life - ms }))
      .filter((p) => p.life > 0);
    if (roll.phase === 'roll' && ms > 0)
      this.history.push({ x: roll.x, y: roll.feetY, life: t.rollTrailMs });
    for (const p of this.history)
      this.trail
        .fillStyle(0xa0db83, (p.life / t.rollTrailMs) * 0.3)
        .fillEllipse(Math.round(p.x), Math.round(p.y - 15), 32, 22);
    for (const [i, slice] of this.slices.entries()) {
      const pickup = pickups[i]!;
      slice
        .setVisible(pickup.available)
        .setFrame(
          Math.floor((this.elapsed * pizzaPickupAppearance.frameRate) / 1000) %
            8,
        );
      if (pickup.available) {
        const { x, y } = pickup.definition;
        this.warning
          .lineStyle(1, 0xffd986, 0.55 + Math.sin(this.elapsed / 190) * 0.2)
          .strokeCircle(x, y, 27);
        this.warning
          .fillStyle(0xffe6a9, 0.7)
          .fillRect(x - 38, y - 1, 5, 2)
          .fillRect(x + 33, y - 1, 5, 2);
      }
    }
    let visible = false,
      x = 0,
      y = 0,
      pose: ShellyPose = 'idle',
      flip = false,
      angle = 0,
      alpha = 1;
    if (story.phase === 'opening') {
      visible = true;
      x = 418;
      y = 980;
      flip = true;
      pose = story.line?.speaker === 'shelly' ? 'scold' : 'crossed';
    } else if (!['hidden', 'trail'].includes(roll.phase)) {
      visible = true;
      x = roll.x;
      y = roll.feetY;
      flip = roll.direction < 0;
      pose =
        roll.phase === 'deflected'
          ? 'dazed'
          : roll.phase === 'roll'
            ? 'roll'
            : roll.phase === 'charge'
              ? 'charge'
              : 'determined';
      if (roll.phase === 'deflected') {
        angle =
          (roll.elapsed / t.rollDeflectMs) *
          t.rollDeflectTurns *
          360 *
          roll.direction;
        alpha = Math.max(
          0,
          Math.min(1, (t.rollDeflectMs - roll.elapsed) / t.rollDeflectFadeMs),
        );
      }
      if (roll.phase === 'charge') {
        const lane = roll.lockedY!;
        for (let px = x - 900; px < x + 900; px += 24)
          this.warning
            .fillStyle(0xa6d799, 0.4)
            .fillRect(Math.round(px), lane - 18, 12, 2);
        this.warning
          .lineStyle(2, 0xd5edac, 0.7)
          .strokeCircle(x, lane - 20, 29 + Math.sin(this.elapsed / 70) * 2);
      }
    } else {
      const atFinal =
        playerX >= this.definition.final.triggerX ||
        story.phase.startsWith('final') ||
        ['outro', 'escape', 'empty', 'fade', 'complete'].includes(story.phase);
      const blocker = atFinal ? final : mid;
      const nearMid =
        playerX >= this.definition.midpoint.triggerX - 80 &&
        playerX < this.definition.midpoint.shelly.x + 620;
      if (atFinal || nearMid) {
        visible = true;
        x = blocker.position.x;
        y = blocker.position.y;
        flip = true;
        pose = blocker.resolved
          ? 'dazed'
          : atFinal
            ? 'peel'
            : story.line
              ? 'scold'
              : 'crossed';
        if (blocker.spinMs > 0) {
          pose = atFinal ? 'peel' : 'roll';
          const progress = 1 - blocker.spinMs / blocker.durationMs;
          angle = progress * 1080;
          y -= Math.sin(progress * Math.PI) * 24;
        }
      }
    }
    this.shelly
      .setOrigin(0.5, shellyAppearance.anchorY / shellyAppearance.frameHeight)
      .setVisible(visible)
      .setPosition(Math.round(x), Math.round(y))
      .setFlipX(flip)
      .setAngle(angle)
      .setAlpha(alpha);
    if (visible) {
      this.shelly.play(`shelly-${pose}`, true);
      if (ms === 0) this.shelly.anims.pause();
      else this.shelly.anims.resume();
      if (pose === 'roll' || roll.phase === 'deflected')
        this.shelly
          .setOrigin(
            0.5,
            (shellyAppearance.anchorY - 20) / shellyAppearance.frameHeight,
          )
          .setY(Math.round(y - 20));
    }
  }
  reset() {
    this.history = [];
    this.shelly.setAlpha(1);
    this.warning.clear();
    this.trail.clear();
  }
  destroy() {
    this.shelly.destroy();
    this.warning.destroy();
    this.trail.destroy();
    this.slices.forEach((s) => s.destroy());
  }
}
