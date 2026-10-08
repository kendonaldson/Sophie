import type Phaser from 'phaser';
import {
  birdPosition,
  birdTuning as t,
  type BirdDefinition,
} from './BirdMotion';
import { birdAppearance as a } from './appearance';
import { overlaps, type Rect } from '../player/CollisionAssist';
export class BirdFlock {
  elapsed = 0;
  private readonly birds;
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
    }));
    this.step(0);
  }
  step(ms: number) {
    this.elapsed += ms;
    for (const b of this.birds) {
      b.state = birdPosition(b.definition, this.elapsed);
      const frames = b.state.direction === 1 ? a.right : a.left;
      b.sprite
        .setPosition(Math.round(b.state.x), Math.round(b.state.y))
        .setFlipX(false)
        .setFrame(
          b.hit
            ? a.squawk
            : frames[Math.floor(this.elapsed / t.frameMs) % frames.length]!,
        );
      if (b.hit) b.sprite.setFlipX(b.state.direction === 1);
    }
  }
  collide(body: Rect) {
    const b = this.birds.find((b) =>
      overlaps(body, {
        x: b.state.x - t.bodyWidth / 2,
        y: b.state.y - t.bodyHeight / 2,
        width: t.bodyWidth,
        height: t.bodyHeight,
      }),
    );
    if (!b) return false;
    b.hit = true;
    this.step(0);
    return true;
  }
  reset() {
    this.elapsed = 0;
    for (const b of this.birds) b.hit = false;
    this.step(0);
  }
  snapshot() {
    return this.birds.map((b) => ({
      id: b.definition.id,
      ...b.state,
      frame: Number(b.sprite.frame.name),
      hit: b.hit,
    }));
  }
  destroy() {
    this.birds.forEach((b) => b.sprite.destroy());
  }
}
