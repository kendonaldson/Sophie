import { climbTuning as t } from './config';
import type { Point } from '../levels/types';
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
/** Presentation only. Section ceilings on downward travel advance at lift landings. */
export class VerticalView {
  x = 0;
  y = 0;
  private lowerBound = Infinity;
  constructor(private readonly worldWidth: number) {}
  reset(point: Point, bottom: number, direction: number) {
    this.lowerBound = bottom;
    const target = this.target(point, direction);
    this.x = target.x;
    this.y = target.y;
  }
  step(ms: number, point: Point, bottom: number, direction: number) {
    this.lowerBound = Math.min(this.lowerBound, bottom);
    const target = this.target(point, direction),
      response = 1 - Math.exp((-t.cameraResponse * ms) / 1000);
    this.x += (target.x - this.x) * response;
    this.y += (target.y - this.y) * response;
  }
  private target(p: Point, direction: number) {
    return {
      x: clamp(
        p.x - t.viewWidth / 2 + direction * t.lookAhead,
        0,
        this.worldWidth - t.viewWidth,
      ),
      y: clamp(
        p.y - t.viewHeight * t.feetRatio,
        0,
        this.lowerBound - t.viewHeight,
      ),
    };
  }
}
