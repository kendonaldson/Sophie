import type Phaser from 'phaser';
import type { LevelDefinition, Point } from '../levels/types';
import { balloonTuning as t } from './config';
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
/** Player-paced tracking with a wider final shot that shows both bones and the sign. */
export class BalloonCamera {
  x = 0;
  y = 0;
  width = t.viewWidth as number;
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDefinition,
  ) {}
  get height() {
    return (this.width * t.viewHeight) / t.viewWidth;
  }
  reset(point: Point) {
    this.update(0, point, false, true);
  }
  update(ms: number, point: Point, ending = false, snap = false) {
    const final = this.level.checkpoints.at(-1)!;
    const wide = !ending && point.x >= final.area.x - 80;
    const width = wide ? t.finalViewWidth : t.viewWidth;
    const x = wide
      ? final.spawn.x - t.finalLeftInset
      : point.x - width / 2 + t.lookAhead;
    const height = (width * t.viewHeight) / t.viewWidth;
    const y =
      (wide ? final.spawn.y + t.finalFeetOffset : point.y) -
      height * t.feetRatio;
    const response = snap ? 1 : 1 - Math.exp((-t.cameraResponse * ms) / 1000);
    this.width += (width - this.width) * response;
    this.x += (clamp(x, 0, this.level.width - width) - this.x) * response;
    this.y += (clamp(y, 0, this.level.height - height) - this.y) * response;
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
      .setBackgroundColor(0xaacfd5);
  }
}
