import type { Point } from '../levels/types';
import { chaseTuning as c } from './config';
export interface ChaseTrace extends Point {
  vx: number;
  vy: number;
}
/** Only used to repair a stranded follower. Ordinary traversal still replays delayed input. */
export class ChaseRecovery {
  constructor(private readonly fallY: number) {}
  private elapsed = 0;
  private samples: { time: number; point: ChaseTrace }[] = [];
  reset() {
    this.elapsed = 0;
    this.samples = [];
  }
  record(ms: number, point: ChaseTrace) {
    this.elapsed += ms;
    this.samples.push({ time: this.elapsed, point: { ...point } });
    while (
      this.samples.length > 1 &&
      this.samples[1]!.time <= this.elapsed - c.recoveryDelayMs
    )
      this.samples.shift();
  }
  target(boundary: number, sophie: ChaseTrace) {
    const delayed = this.samples[0]?.point;
    if (
      delayed &&
      delayed.x > boundary + c.recoveryMargin &&
      delayed.y < this.fallY - c.recoveryFallMargin
    )
      return { ...delayed };
    // If the camera catches their trail, recover alongside Sophie; never to a
    // stale checkpoint behind the camera. If both are overtaken, fail normally.
    return sophie.x > boundary + 1 ? { ...sophie } : undefined;
  }
}
