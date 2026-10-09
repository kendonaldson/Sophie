import type Phaser from 'phaser';
import type { LevelDefinition, Point } from '../levels/types';
import { tunnelTuning as t } from './config';
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
/** Normal player-paced tracking; widen early enough to preview the treat chain. */
export class TunnelCamera {
  x = 0;
  y = 0;
  width: number = t.viewWidth;
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
  update(ms: number, point: Point, exiting = false, snap = false) {
    const major = this.level.maintenance!.majorView;
    const wide = !exiting && point.x >= major.fromX && point.x < major.toX;
    const width = wide ? major.width : t.viewWidth;
    const x = wide
      ? Math.max(major.left, point.x - width / 2 + t.lookAhead)
      : point.x - width / 2 + t.lookAhead;
    const height = (width * t.viewHeight) / t.viewWidth;
    const response = snap ? 1 : 1 - Math.exp((-t.cameraResponse * ms) / 1000);
    this.width += (width - this.width) * response;
    this.x += (clamp(x, 0, this.level.width - width) - this.x) * response;
    // Keep the flat floor composed consistently while Sophie jumps.
    this.y +=
      (clamp(
        this.level.playerSpawn.y - height * t.feetRatio,
        0,
        this.level.height - height,
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
      .setBackgroundColor(0x242b30);
  }
}
