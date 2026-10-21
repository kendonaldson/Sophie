import type Phaser from 'phaser';
import { overlaps, type Rect } from '../player/CollisionAssist';
import { ratAppearance as a } from './appearance';
import {
  ratBody,
  ratPosition,
  ratTuning as t,
  type RatDefinition,
} from './RatMotion';
import {
  creatureScatterState,
  SmallCreatureContact,
  startCreatureScatter,
  type CreatureContactOptions,
  type CreatureScatter,
} from '../creatures/SmallCreatureContact';

/** Presentation and collision queries share one deterministic patrol clock. */
export class RatPack {
  elapsed = 0;
  private readonly rats;
  private readonly contact = new SmallCreatureContact('rat');

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
      scatter: undefined as CreatureScatter | undefined,
    }));
    this.step(0);
  }

  step(ms: number) {
    this.elapsed += Math.max(0, ms);
    const frame =
      a.frames[Math.floor(this.elapsed / t.frameMs) % a.frames.length]!;
    for (const rat of this.rats) {
      const scatter =
        rat.scatter && creatureScatterState('rat', rat.scatter, this.elapsed);
      rat.state =
        scatter?.position ?? ratPosition(rat.definition, this.elapsed);
      rat.sprite
        .setPosition(Math.round(rat.state.x), Math.round(rat.state.y))
        .setFlipX(rat.state.direction === -1)
        .setAlpha(scatter?.alpha ?? 1)
        .setVisible(scatter?.visible ?? true)
        .setFrame(frame);
    }
  }

  /** The level queries Sophie only; companions never become failure sources. */
  collide(body: Rect, options?: CreatureContactOptions) {
    const contacts = this.rats.filter(
      (rat) => !rat.scatter && overlaps(body, ratBody(rat.state)),
    );
    if (!contacts.length) return false;
    if (this.contact.resolve(options, this.elapsed) === 'reset') return true;
    for (const rat of contacts)
      rat.scatter = startCreatureScatter(
        rat.state,
        body,
        options!.facing,
        this.rats.indexOf(rat),
        this.elapsed,
      );
    this.step(0);
    return false;
  }

  reset() {
    this.elapsed = 0;
    this.contact.reset();
    for (const rat of this.rats) rat.scatter = undefined;
    this.step(0);
  }

  snapshot() {
    return this.rats.map((rat) => ({
      id: rat.definition.id,
      ...rat.state,
      frame: Number(rat.sprite.frame.name),
      scattered: Boolean(rat.scatter),
      scatterMs: rat.scatter
        ? creatureScatterState('rat', rat.scatter, this.elapsed).ms
        : 0,
      visible: rat.sprite.visible,
    }));
  }

  destroy() {
    this.rats.forEach((rat) => rat.sprite.destroy());
  }
}
