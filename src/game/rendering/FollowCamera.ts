import Phaser from 'phaser';
import { cameraConfig as c } from '../config/camera';
import type { Player } from '../player/Player';
import type { LevelDefinition } from '../levels/types';
/** Camera state is presentation-only; it never writes to the player or physics world. */
export class FollowCamera {
  private lookAhead = c.lookAhead as number;
  private x = 0;
  private y = 0;
  private finaleFrame = 0;
  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    private readonly level: LevelDefinition,
  ) {
    camera.setRoundPixels(true);
    camera.setZoom(1);
  }
  snap(player: Player) {
    this.finaleFrame = 0;
    this.camera.setZoom(1);
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
    const finale = this.level.finale;
    const frame = finale
      ? Phaser.Math.Clamp(
          (player.feet.x - finale.runwayEnd + 350) / 180,
          0,
          1,
        ) *
        Phaser.Math.Clamp((finale.landing.x + 100 - player.feet.x) / 100, 0, 1)
      : 0;
    this.finaleFrame += (frame - this.finaleFrame) * (1 - Math.exp(-ms / 300));
    this.apply();
  }
  private apply() {
    const f = this.level.finale;
    if (f && this.finaleFrame > 0.001) {
      // One final-room composition reveals the real exit across the gap.
      // Uniform presentation scaling only; bodies and native HUD never change.
      const left = f.runwayEnd - 500;
      const right = this.level.exit.x + this.level.exit.width + 65;
      const zoom =
        1 +
        (Math.min(1, this.camera.width / (right - left)) - 1) *
          this.finaleFrame;
      this.camera.setZoom(zoom);
      const x = (left + right) / 2 - this.camera.width / 2;
      const y =
        f.runwayY - this.camera.height / 2 - (this.camera.height * 0.16) / zoom;
      this.camera.setScroll(
        Math.round(this.x + (x - this.x) * this.finaleFrame),
        Math.round(this.y + (y - this.y) * this.finaleFrame),
      );
      return;
    }
    this.camera.setZoom(1);
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
