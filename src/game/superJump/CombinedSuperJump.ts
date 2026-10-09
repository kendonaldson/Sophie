import Phaser from 'phaser';
import {
  superJumpAppearance as a,
  superJumpFrame,
  type SuperJumpPose,
} from './appearance';
/** One visual for the pair, shared by the chase and rooftop story. No gameplay physics. */
export class CombinedSuperJump {
  readonly sprite: Phaser.GameObjects.Sprite;
  constructor(scene: Phaser.Scene, scale = 1) {
    scene.textures.get(a.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.sprite = scene.add
      .sprite(0, 0, a.key)
      .setName('Sophie + Jimmy super-jump')
      .setOrigin(a.anchorX / a.frameWidth, a.anchorY / a.frameHeight)
      .setScale(scale)
      .setDepth(12)
      .setVisible(false);
  }
  show(pose?: SuperJumpPose) {
    this.sprite.setVisible(Boolean(pose));
    if (pose)
      this.sprite
        .setPosition(Math.round(pose.x), Math.round(pose.y))
        .setFrame(superJumpFrame(pose));
  }
  snapshot() {
    return {
      visible: this.sprite.visible,
      texture: this.sprite.texture.key,
      frame: Number(this.sprite.frame.name),
      x: this.sprite.x,
      y: this.sprite.y,
      bottom: this.sprite.getBounds().bottom,
    };
  }
  destroy() {
    this.sprite.destroy();
  }
}
