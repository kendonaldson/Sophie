import type { Point } from '../levels/types';
import type { SpeechLine } from '../../ui/SpeechBubble';
import { balloonTuning as t, type BalloonDefinition } from './config';
const opening = [
  ['landing', t.landingHoldMs],
  ['scent', t.scentMs],
  ['smell', t.smellLineMs],
  ['beat', t.smellBeatMs],
  ['pizza', t.pizzaLineMs],
  ['go', t.goLineMs],
] as const;
export type PizzaPhase =
  (typeof opening)[number][0] | 'walk' | 'empty' | 'fade' | 'complete';
export class PizzaFinale {
  elapsed = 0;
  constructor(
    readonly destination: BalloonDefinition['destination'],
    private readonly from: { sophie: Point; jimmy: Point },
  ) {}
  tick(ms: number) {
    this.elapsed += Math.max(0, ms);
  }
  get walkMs() {
    const d = this.destination;
    return (
      (Math.max(d.vent.x + 72 - d.sophie.x, d.vent.x + 72 - d.jimmy.x) /
        t.walkSpeed) *
        1000 +
      t.followDelayMs
    );
  }
  get state(): { phase: PizzaPhase; progress: number; ms: number } {
    let ms = this.elapsed;
    const phases = [
      ...opening,
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
  get line(): SpeechLine | undefined {
    const text =
      this.state.phase === 'smell'
        ? 'Do you smell that!'
        : this.state.phase === 'pizza'
          ? "Pizza! It's pizza!"
          : this.state.phase === 'go'
            ? "Let's go!"
            : undefined;
    return text ? { speaker: 'sophie', text } : undefined;
  }
  get scentMs() {
    return Math.max(0, this.elapsed - t.landingHoldMs);
  }
  get fade() {
    return this.state.phase === 'complete'
      ? 1
      : this.state.phase === 'fade'
        ? this.state.progress
        : 0;
  }
  get actors() {
    const { phase, progress, ms } = this.state,
      d = this.destination;
    const actor = (name: 'sophie' | 'jimmy') => {
      let x = d[name].x,
        pose: 'walk' | 'idle' = 'idle',
        alpha = 1;
      if (phase === 'landing') {
        x = this.from[name].x + (x - this.from[name].x) * progress;
        pose = Math.abs(x - d[name].x) > 2 ? 'walk' : 'idle';
        if (name === 'jimmy') alpha = Math.min(1, ms / 160);
      }
      if (phase === 'walk') {
        const walking = Math.max(
          0,
          ms - (name === 'jimmy' ? t.followDelayMs : 0),
        );
        x = Math.min(d.vent.x + 72, x + (walking * t.walkSpeed) / 1000);
        pose = walking > 0 ? 'walk' : 'idle';
        alpha = Math.max(0, Math.min(1, (d.vent.x + 72 - x) / 24));
      }
      const visible =
        !['empty', 'fade', 'complete'].includes(phase) && alpha > 0;
      return { x, y: d.sophie.y, pose, alpha, visible };
    };
    return { sophie: actor('sophie'), jimmy: actor('jimmy') };
  }
}
