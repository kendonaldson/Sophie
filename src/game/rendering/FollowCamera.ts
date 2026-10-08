import Phaser from 'phaser';
import { cameraConfig as c } from '../config/camera';
import type { Player } from '../player/Player';
import type { LevelDefinition } from '../levels/types';
/** Camera state is presentation-only; it never writes to the player or physics world. */
export class FollowCamera {
  private lookAhead = c.lookAhead as number;
  private x = 0;
  private y = 0;
  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    private readonly level: LevelDefinition,
  ) {
    camera.setRoundPixels(true);
  }
  snap(player: Player) {
    this.lookAhead = c.lookAhead;
    this.x = player.sprite.x - this.camera.width * 0.5 + this.lookAhead;
    this.y = player.feet.y - this.camera.height * c.feetHeightRatio;
    this.apply();
  }
  update(ms: number, player: Player) {
    const smooth = 1 - Math.exp((-c.horizontalResponse * ms) / 1000);
    if (Math.abs(player.body.velocity.x) > 15)
      this.lookAhead +=
        (player.controller.facing * c.lookAhead - this.lookAhead) * smooth;
    this.x +=
      (player.sprite.x - this.camera.width * 0.5 + this.lookAhead - this.x) *
      smooth;
    this.y +=
      (player.feet.y - this.camera.height * c.feetHeightRatio - this.y) *
      (1 - Math.exp((-c.verticalResponse * ms) / 1000));
    this.apply();
  }
  private apply() {
    this.camera.setScroll(
      Math.round(
        Phaser.Math.Clamp(
          this.x,
          0,
          Math.max(0, this.level.width - this.camera.width),
        ),
      ),
      Math.round(
        Phaser.Math.Clamp(
          this.y,
          0,
          Math.max(0, this.level.height - this.camera.height),
        ),
      ),
    );
  }
}
