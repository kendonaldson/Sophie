import { overlaps, type Rect } from '../player/CollisionAssist';
import type { Point } from '../levels/types';
import { factoryTuning as t } from './config';

export class ShellyBlocker {
  resolved = false;
  spinMs = 0;
  constructor(
    readonly position: Point,
    readonly durationMs: number,
  ) {}
  get body(): Rect {
    return {
      x: this.position.x - t.blockerWidth / 2,
      y: this.position.y - t.blockerHeight,
      width: t.blockerWidth,
      height: t.blockerHeight,
    };
  }
  contact(body: Rect, superDash: boolean) {
    if (this.resolved || !overlaps(body, this.body)) return undefined;
    if (!superDash) return 'blocked';
    this.resolved = true;
    this.spinMs = this.durationMs;
    return 'spin';
  }
  tick(ms: number) {
    this.spinMs = Math.max(0, this.spinMs - ms);
  }
  reset(resolved = false) {
    this.resolved = resolved;
    this.spinMs = 0;
  }
}
