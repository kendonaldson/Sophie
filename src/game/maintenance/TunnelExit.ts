import type { Point } from '../levels/types';
import { tunnelTuning as t, type MaintenanceDefinition } from './config';

export type TunnelExitPhase =
  'gather' | 'hold' | 'walk' | 'empty' | 'fade' | 'complete';

export interface TunnelExitPose extends Point {
  pose: 'walk' | 'idle';
  alpha: number;
  visible: boolean;
  flipX: boolean;
}

/** The final safe floor hosts a short walk-out; normal movement owns the level. */
export class TunnelExit {
  elapsed = 0;
  private readonly from: { sophie: Point; jimmy: Point };

  constructor(
    readonly destination: MaintenanceDefinition['destination'],
    from: { sophie: Point; jimmy: Point },
  ) {
    const start = (name: 'sophie' | 'jimmy'): Point => {
      const stage = destination[name];
      const reach = (t.walkSpeed * t.gatherMs) / 1000;
      // Recovery may hand over a distant/airborne Jimmy. Gather only on this
      // safe floor, within a distance that can be walked during the hold.
      return {
        x: Math.max(stage.x - reach, Math.min(stage.x + reach, from[name].x)),
        y: stage.y,
      };
    };
    this.from = { sophie: start('sophie'), jimmy: start('jimmy') };
  }

  tick(ms: number) {
    this.elapsed += Math.max(0, ms);
  }

  private get insideX() {
    return this.destination.hatch.x + 72;
  }

  get walkMs() {
    const duration = (name: 'sophie' | 'jimmy') =>
      (Math.max(0, this.insideX - this.destination[name].x) / t.walkSpeed) *
      1000;
    return Math.max(duration('sophie'), duration('jimmy') + t.followDelayMs);
  }

  get state(): { phase: TunnelExitPhase; progress: number; ms: number } {
    let ms = this.elapsed;
    const phases = [
      ['gather', t.gatherMs],
      ['hold', t.exitHoldMs],
      ['walk', this.walkMs],
      ['empty', t.emptyMs],
      ['fade', t.fadeMs],
    ] as const;
    for (const [phase, duration] of phases) {
      if (ms < duration) return { phase, progress: ms / duration, ms };
      ms -= duration;
    }
    return { phase: 'complete', progress: 1, ms };
  }

  get fade() {
    const { phase, progress } = this.state;
    return phase === 'complete' ? 1 : phase === 'fade' ? progress : 0;
  }

  get actors(): { sophie: TunnelExitPose; jimmy: TunnelExitPose } {
    const { phase, progress, ms } = this.state;
    const actor = (name: 'sophie' | 'jimmy'): TunnelExitPose => {
      const stage = this.destination[name];
      let x = stage.x,
        pose: 'walk' | 'idle' = 'idle',
        alpha = 1,
        flipX = false;
      if (phase === 'gather') {
        x = this.from[name].x + (stage.x - this.from[name].x) * progress;
        pose = Math.abs(stage.x - x) > 1 ? 'walk' : 'idle';
        flipX = this.from[name].x > stage.x;
      } else if (phase === 'walk') {
        const walkingMs = Math.max(
          0,
          ms - (name === 'jimmy' ? t.followDelayMs : 0),
        );
        x = Math.min(this.insideX, x + (walkingMs * t.walkSpeed) / 1000);
        pose = walkingMs > 0 && x < this.insideX ? 'walk' : 'idle';
        alpha = Math.max(0, Math.min(1, (this.insideX - x) / 24));
      } else if (['empty', 'fade', 'complete'].includes(phase)) {
        x = this.insideX;
        alpha = 0;
      }
      return { x, y: stage.y, pose, alpha, visible: alpha > 0, flipX };
    };
    return { sophie: actor('sophie'), jimmy: actor('jimmy') };
  }
}
