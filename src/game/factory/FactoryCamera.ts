import type Phaser from 'phaser';
import type { LevelDefinition, Point } from '../levels/types';
import { factoryTuning as t } from './config';
const clamp = (v: number, low: number, high: number) =>
  Math.max(low, Math.min(high, v));

export class FactoryCamera {
  x = 0;
  y = 0;
  width: number = t.viewWidth;
  private floorY = 980;
  private readonly originalBackground: Phaser.Display.Color;
  private readonly rendererConfig: { backgroundColor: Phaser.Display.Color };
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDefinition,
  ) {
    // The fitted camera leaves side margins on wide phones. Match those to
    // the factory instead of exposing the game's pale rooftop clear color.
    this.rendererConfig = scene.game.renderer.config as {
      backgroundColor: Phaser.Display.Color;
    };
    this.originalBackground = this.rendererConfig.backgroundColor;
    this.rendererConfig.backgroundColor = this.originalBackground
      .clone()
      .setTo(38, 27, 34);
  }
  get height() {
    return (this.width * t.viewHeight) / t.viewWidth;
  }
  reset(point: Point) {
    this.floorY = point.y;
    this.update(0, point, true, true);
  }
  update(ms: number, point: Point, grounded: boolean, snap = false) {
    if (grounded || point.y > this.floorY + 130) this.floorY = point.y;
    const final = point.x >= this.level.factory!.final.triggerX - 100;
    const width = final ? t.finalViewWidth : t.viewWidth;
    const response = snap ? 1 : 1 - Math.exp((-t.cameraResponse * ms) / 1000);
    this.width += (width - this.width) * response;
    const targetX = final
      ? this.level.factory!.final.triggerX - 120
      : point.x - width / 2 + t.lookAhead;
    this.x += (clamp(targetX, 0, this.level.width - width) - this.x) * response;
    this.y +=
      (clamp(
        (final ? this.level.factory!.final.staging.y : this.floorY) -
          this.height * 0.68,
        0,
        this.level.height - this.height,
      ) -
        this.y) *
      response;
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
      .setBackgroundColor(0x261b22);
  }
  destroy() {
    this.rendererConfig.backgroundColor = this.originalBackground;
  }
}
