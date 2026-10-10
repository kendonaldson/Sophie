import Phaser from 'phaser';
import { createShellyAnimations, shellyAppearance } from '../shelly/appearance';
import { createPizzaAnimation, pizzaAppearance } from '../pizza/appearance';
import type { KitchenDirector } from './KitchenDirector';
import { KitchenArt } from './KitchenArt';
import { interlude3 as c } from './interlude3';

/** Rendering adapter: choreography owns the power, this only presents it. */
export class KitchenStage {
  readonly shelly: Phaser.GameObjects.Sprite;
  private readonly art;
  private readonly accents;
  constructor(scene: Phaser.Scene) {
    this.art = new KitchenArt(scene);
    for (const key of [shellyAppearance.key, pizzaAppearance.key])
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    createShellyAnimations(scene);
    createPizzaAnimation(scene);
    this.shelly = scene.add
      .sprite(c.shellyX, c.feetY, shellyAppearance.key)
      .setName('Shelly')
      .setOrigin(
        shellyAppearance.anchorX / shellyAppearance.frameWidth,
        shellyAppearance.anchorY / shellyAppearance.frameHeight,
      )
      .setScale(c.spriteScale)
      .setDepth(8);
    this.accents = scene.add.graphics().setDepth(11);
  }
  update(
    director: KitchenDirector,
    sophie: Phaser.GameObjects.Sprite,
    ms: number,
    blocked: boolean,
  ) {
    this.art.update(ms, director.pizzaTaken);
    const actor = director.actors.shelly;
    this.shelly
      .setPosition(Math.round(actor.x), Math.round(actor.y))
      .setVisible(actor.visible)
      .setFlipX(actor.flipX)
      .play(`shelly-${actor.pose}`, true);
    if (blocked) this.shelly.anims.pause();
    else this.shelly.anims.resume();
    const a = pizzaAppearance;
    if (director.power.active) {
      if (sophie.texture.key !== a.key) {
        sophie.anims.stop();
        sophie.setTexture(a.key, a.idleFrame);
      }
      // Phaser mirrors the frame about its center: mirror the body anchor too.
      sophie.setOrigin(
        director.actors.sophie.flipX
          ? 1 - a.anchorX / a.frameWidth
          : a.anchorX / a.frameWidth,
        a.anchorY / a.frameHeight,
      );
      if (director.superMoving) sophie.play(a.animation, true);
      else {
        sophie.anims.stop();
        sophie.setFrame(a.idleFrame);
      }
      if (blocked) sophie.anims.pause();
      else sophie.anims.resume();
    } else if (sophie.texture.key !== 'sophie') {
      sophie.anims.stop();
      sophie.setTexture('sophie');
      sophie.setOrigin(0.5, 58 / 64);
    }
    const g = this.accents.clear();
    if (director.phase === 'activation') {
      const radius = 16 + director.progress * 30;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const x = Math.round(c.pizzaX + Math.cos(angle) * radius);
        const y = Math.round(c.pizzaY - 25 + Math.sin(angle) * radius);
        g.fillStyle(i % 2 ? 0xffeeae : 0xfab84b, 1 - director.progress)
          .fillRect(x - 3, y, 7, 2)
          .fillRect(x, y - 3, 2, 7);
      }
    }
    if (director.superMoving) {
      const s = director.actors.sophie,
        direction = s.flipX ? 1 : -1;
      for (let i = 0; i < 4; i++)
        g.fillStyle(i % 2 ? 0xffd86c : 0xffa84e, 0.7 - i * 0.12).fillRect(
          Math.round(s.x + direction * (34 + i * 17)),
          Math.round(s.y - 12 - i * 7),
          direction * 22,
          2,
        );
    }
  }
  snapshot(director: KitchenDirector, sophie: Phaser.GameObjects.Sprite) {
    return {
      beat: director.beat?.id,
      pizzaTaken: director.pizzaTaken,
      powerActive: director.power.active,
      superMoving: director.superMoving,
      dashActive: director.dash.active,
      dashCharges: director.dash.charges,
      normalDashSpeed: c.dashSpeed,
      powerSpeed: c.powerSpeed,
      jimmySpeed: c.jimmySpeed,
      shelly: {
        ...director.actors.shelly,
        texture: this.shelly.texture.key,
        frame: this.shelly.frame.name,
        animation: this.shelly.anims.currentAnim?.key,
      },
      sophieTexture: sophie.texture.key,
      sophieFrame: sophie.frame.name,
    };
  }
}
