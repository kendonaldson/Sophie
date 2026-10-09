import type Phaser from 'phaser';
import { overlaps, type Rect } from '../player/CollisionAssist';
import { ratAppearance as a } from './appearance';
import {
  ratBody,
  ratPosition,
  ratTuning as t,
  type RatDefinition,
} from './RatMotion';

/** Presentation and collision queries share one deterministic patrol clock. */
export class RatPack {
  elapsed = 0;
  private readonly rats;

  constructor(scene: Phaser.Scene, definitions: readonly RatDefinition[]) {
    this.rats = definitions.map((definition) => ({
      definition,
      sprite: scene.add
        .sprite(0, 0, a.key)
        .setOrigin(a.anchorX / a.frameSize, a.footY / a.frameSize)
        .setDisplaySize(t.drawSize, t.drawSize)
        .setDepth(12)
        .setName(definition.id),
      state: ratPosition(definition, 0),
    }));
    this.step(0);
  }

  step(ms: number) {
    this.elapsed += ms;
    const frame =
      a.frames[Math.floor(this.elapsed / t.frameMs) % a.frames.length]!;
    for (const rat of this.rats) {
      rat.state = ratPosition(rat.definition, this.elapsed);
      rat.sprite
        .setPosition(Math.round(rat.state.x), Math.round(rat.state.y))
        .setFlipX(rat.state.direction === -1)
        .setFrame(frame);
    }
  }

  /** The level queries Sophie only; companions never become failure sources. */
  collide(body: Rect) {
    return this.rats.some((rat) => overlaps(body, ratBody(rat.state)));
  }

  reset() {
    this.elapsed = 0;
    this.step(0);
  }

  snapshot() {
    return this.rats.map((rat) => ({
      id: rat.definition.id,
      ...rat.state,
      frame: Number(rat.sprite.frame.name),
    }));
  }

  destroy() {
    this.rats.forEach((rat) => rat.sprite.destroy());
  }
}
