import type Phaser from 'phaser';
import type { LevelDefinition, Point } from '../levels/types';
import { raceTuning as t, type RaceMode } from './config';

const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));

/** Section framing follows the dogs; no camera position can advance gameplay. */
export class RaceCamera {
  x = 0;
  y = 0;
  width: number = t.viewWidth;
  mode: RaceMode = 'street';
  private floorY = 0;
  private readonly originalBackground: Phaser.Display.Color;
  private readonly rendererConfig: { backgroundColor: Phaser.Display.Color };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDefinition,
  ) {
    // Fitted widescreen framing leaves touch-control margins on wide phones.
    this.rendererConfig = scene.game.renderer.config as {
      backgroundColor: Phaser.Display.Color;
    };
    this.originalBackground = this.rendererConfig.backgroundColor;
    this.rendererConfig.backgroundColor = this.originalBackground
      .clone()
      .setTo(27, 48, 53);
  }

  get height() {
    return (this.width * t.viewHeight) / t.viewWidth;
  }

  reset(point: Point) {
    this.floorY = point.y;
    this.update(0, point, true, false, true);
  }

  update(
    ms: number,
    point: Point,
    grounded = true,
    scripted = false,
    snap = false,
  ) {
    const d = this.level.race!;
    const band =
      d.bands.find((b) => point.x >= b.fromX && point.x < b.toX) ??
      d.bands.at(-1)!;
    this.mode = band.mode;
    if (grounded || scripted || point.y > this.floorY + 130)
      this.floorY = point.y;
    const approachingHome =
      point.x >= d.destination.triggerX - t.homeRevealDistance;
    const superJump =
      scripted &&
      point.x >= Math.min(d.superJump.triggerX, d.superJump.staging.x) &&
      point.x < d.superJump.landing.x;
    const width = approachingHome
      ? t.homeViewWidth
      : superJump
        ? t.superJumpViewWidth
        : (band.viewWidth ?? t.viewWidth);
    const response = snap ? 1 : 1 - Math.exp((-t.cameraResponse * ms) / 1000);
    this.width += (width - this.width) * response;
    const vertical =
      scripted || this.mode === 'construction' || this.mode === 'balloons';
    const feetY = vertical ? point.y : Math.min(this.floorY, point.y + 140);
    const targetX = approachingHome
      ? Math.min(
          point.x - this.width * 0.3,
          d.destination.attic.x - this.width * 0.82,
        )
      : point.x - this.width / 2 + t.lookAhead;
    const targetY = feetY - this.height * 0.68;
    this.x +=
      (clamp(targetX, 0, this.level.width - this.width) - this.x) * response;
    this.y +=
      (clamp(targetY, 0, this.level.height - this.height) - this.y) * response;
    const fit = Math.min(
      this.scene.scale.width / t.viewWidth,
      this.scene.scale.height / t.viewHeight,
    );
    this.scene.cameras.main
      .setViewport(
        (this.scene.scale.width - t.viewWidth * fit) / 2,
        (this.scene.scale.height - t.viewHeight * fit) / 2,
        t.viewWidth * fit,
        t.viewHeight * fit,
      )
      .setZoom((t.viewWidth * fit) / this.width)
      .setRoundPixels(true)
      .centerOn(
        Math.round(this.x) + this.width / 2,
        Math.round(this.y) + this.height / 2,
      )
      .setBackgroundColor(0xaac9c5);
  }

  destroy() {
    this.rendererConfig.backgroundColor = this.originalBackground;
    this.scene.cameras.main
      ?.setViewport(0, 0, this.scene.scale.width, this.scene.scale.height)
      .setZoom(1);
  }
}
