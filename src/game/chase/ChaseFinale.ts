import type { Point } from '../levels/types';
import type { SpeechLine } from '../../ui/SpeechBubble';
import { chaseTuning as t, type ChaseDefinition } from './config';
const phases = [
  ['settle', t.settleMs],
  ['gotcha', t.gotchaMs],
  ['quiet', t.quietMs],
  ['home', t.homeMs],
  ['look', t.lookMs],
  ['crouch', t.crouchMs],
  ['launch', t.launchMs],
  ['empty', t.emptyMs],
  ['punchline', t.punchlineMs],
  ['fade', t.fadeMs],
] as const;
export type ChaseFinalePhase = (typeof phases)[number][0] | 'complete';
export class ChaseFinale {
  elapsed = 0;
  constructor(
    readonly def: ChaseDefinition['deadEnd'],
    private readonly from: { sophie: Point; jimmy: Point },
    private readonly top: number,
  ) {}
  tick(ms: number) {
    this.elapsed += ms;
  }
  get state(): { phase: ChaseFinalePhase; progress: number } {
    let time = this.elapsed;
    for (const [phase, duration] of phases) {
      if (time < duration) return { phase, progress: time / duration };
      time -= duration;
    }
    return { phase: 'complete', progress: 1 };
  }
  get line(): SpeechLine | undefined {
    const text =
      this.state.phase === 'gotcha'
        ? 'Gotcha.'
        : this.state.phase === 'home'
          ? "Okay, let's get you two home."
          : this.state.phase === 'punchline'
            ? 'WHAT IN THE WORLD?!'
            : undefined;
    return text ? { speaker: 'offscreen', text } : undefined;
  }
  get fade() {
    return this.state.phase === 'complete'
      ? 1
      : this.state.phase === 'fade'
        ? this.state.progress
        : 0;
  }
  get actors() {
    const { phase, progress: p } = this.state;
    const actors = {
      sophie: { ...this.def.sophie },
      jimmy: { ...this.def.jimmy },
    };
    if (phase === 'settle') {
      for (const name of ['sophie', 'jimmy'] as const) {
        const s = p * (2 - p);
        actors[name] = {
          x: this.from[name].x + (actors[name].x - this.from[name].x) * s,
          y: this.from[name].y + (actors[name].y - this.from[name].y) * s,
        };
      }
    } else if (phase === 'crouch' || phase === 'launch') {
      // Jimmy ducks under Sophie, recalling the warehouse catch/compression.
      actors.jimmy.x += 25 * (phase === 'crouch' ? p : 1);
      actors.sophie.y -= 12 * (phase === 'crouch' ? p : 1);
      if (phase === 'launch') {
        const lift = (this.def.feetY - this.top + 110) * p * p;
        actors.sophie.y -= lift;
        actors.jimmy.y -= lift;
        actors.sophie.x += p * 8;
        actors.jimmy.x += p * 8;
      }
    } else if (['empty', 'punchline', 'fade', 'complete'].includes(phase)) {
      actors.sophie.y = this.top - 110;
      actors.jimmy.y = this.top - 110;
    }
    return actors;
  }
}
