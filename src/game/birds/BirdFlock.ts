import type Phaser from 'phaser';
import {
  birdPosition,
  birdTuning as t,
  type BirdDefinition,
} from './BirdMotion';
import { birdAppearance as a } from './appearance';
import { overlaps, type Rect } from '../player/CollisionAssist';
import {
  creatureScatterState,
  creatureScatterTuning,
  SmallCreatureContact,
  startCreatureScatter,
  type CreatureContactOptions,
  type CreatureScatter,
} from '../creatures/SmallCreatureContact';
export class BirdFlock {
  elapsed = 0;
  private readonly birds;
  private readonly contact = new SmallCreatureContact('bird');
  constructor(scene: Phaser.Scene, definitions: readonly BirdDefinition[]) {
    this.birds = definitions.map((definition) => ({
      definition,
      sprite: scene.add
        .sprite(0, 0, a.key)
        .setDisplaySize(t.drawSize, t.drawSize)
        .setDepth(12)
        .setName(definition.id),
      state: birdPosition(definition, 0),
      hit: false,
      scatter: undefined as CreatureScatter | undefined,
    }));
    this.step(0);
  }
  step(ms: number) {
    this.elapsed += Math.max(0, ms);
    for (const b of this.birds) {
      const scatter =
        b.scatter && creatureScatterState('bird', b.scatter, this.elapsed);
      b.state = scatter?.position ?? birdPosition(b.definition, this.elapsed);
      const frames = b.state.direction === 1 ? a.right : a.left;
      const squawking =
        b.hit ||
        (scatter !== undefined &&
          scatter.ms < creatureScatterTuning.squawkFrameMs);
      b.sprite
        .setPosition(Math.round(b.state.x), Math.round(b.state.y))
        .setFlipX(false)
        .setAlpha(scatter?.alpha ?? 1)
        .setVisible(scatter?.visible ?? true)
        .setFrame(
          squawking
            ? a.squawk
            : frames[Math.floor(this.elapsed / t.frameMs) % frames.length]!,
        );
      if (squawking) b.sprite.setFlipX(b.state.direction === 1);
    }
  }
  collide(body: Rect, options?: CreatureContactOptions) {
    const contacts = this.birds.filter(
      (b) =>
        !b.scatter &&
        overlaps(body, {
          x: b.state.x - t.bodyWidth / 2,
          y: b.state.y - t.bodyHeight / 2,
          width: t.bodyWidth,
          height: t.bodyHeight,
        }),
    );
    if (!contacts.length) return false;
    if (this.contact.resolve(options, this.elapsed) === 'reset') {
      contacts[0]!.hit = true;
      this.step(0);
      return true;
    }
    for (const b of contacts)
      b.scatter = startCreatureScatter(
        b.state,
        body,
        options!.facing,
        this.birds.indexOf(b),
        this.elapsed,
      );
    this.step(0);
    return false;
  }
  reset() {
    this.elapsed = 0;
    this.contact.reset();
    for (const b of this.birds) {
      b.hit = false;
      b.scatter = undefined;
    }
    this.step(0);
  }
  snapshot() {
    return this.birds.map((b) => ({
      id: b.definition.id,
      ...b.state,
      frame: Number(b.sprite.frame.name),
      hit: b.hit,
      scattered: Boolean(b.scatter),
      scatterMs: b.scatter
        ? creatureScatterState('bird', b.scatter, this.elapsed).ms
        : 0,
      visible: b.sprite.visible,
    }));
  }
  destroy() {
    this.birds.forEach((b) => b.sprite.destroy());
  }
}
