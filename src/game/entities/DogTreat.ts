import type Phaser from 'phaser';
import type { TreatDefinition } from '../levels/types';
import { treatConfig } from '../config/collectibles';
export function createTreatTexture(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0x785b3e)
    .fillRect(4, 5, 20, 6)
    .fillRect(1, 2, 7, 6)
    .fillRect(1, 8, 7, 6)
    .fillRect(20, 2, 7, 6)
    .fillRect(20, 8, 7, 6);
  g.fillStyle(0xf6d69b)
    .fillRect(5, 6, 18, 4)
    .fillRect(2, 3, 5, 4)
    .fillRect(2, 9, 5, 4)
    .fillRect(21, 3, 5, 4)
    .fillRect(21, 9, 5, 4);
  g.generateTexture('treat', 28, 16);
  g.destroy();
}
export class DogTreat {
  readonly sprite: Phaser.GameObjects.Image;
  readonly glow: Phaser.GameObjects.Arc;
  private respawnRemaining = 0;
  get collected() {
    return this.respawnRemaining > 0;
  }
  constructor(
    scene: Phaser.Scene,
    readonly definition: TreatDefinition,
  ) {
    this.glow = scene.add
      .circle(definition.x, definition.y, 22, 0xf7df99, 0.13)
      .setDepth(5);
    this.sprite = scene.add
      .image(definition.x, definition.y, 'treat')
      .setDepth(6);
  }
  collect() {
    if (this.collected) return;
    this.respawnRemaining = treatConfig.respawnMs;
    this.sprite.setVisible(false);
    this.glow.setVisible(false);
  }
  restore() {
    this.respawnRemaining = 0;
    this.sprite.setVisible(true);
    this.glow.setVisible(true);
  }
  step(ms: number) {
    if (!this.collected) return;
    this.respawnRemaining -= ms;
    // Ignore floating-point residue at the boundary across different time steps.
    if (this.respawnRemaining <= 1e-6) this.restore();
  }
  update(time: number) {
    this.sprite.y = this.definition.y + Math.round(Math.sin(time / 240) * 2);
    this.glow.setAlpha(0.1 + Math.sin(time / 190) * 0.035);
  }
  touches(body: { x: number; y: number; width: number; height: number }) {
    const nearestX = Math.max(
      body.x,
      Math.min(this.definition.x, body.x + body.width),
    );
    const nearestY = Math.max(
      body.y,
      Math.min(this.definition.y, body.y + body.height),
    );
    return (
      !this.collected &&
      Math.hypot(nearestX - this.definition.x, nearestY - this.definition.y) <=
        17
    );
  }
}
