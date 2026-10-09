import type { Point } from '../levels/types';
import type { SpeechLine } from '../../ui/SpeechBubble';
import { chaseTuning as t, type ChaseDefinition } from './config';
import { sfxConfig } from '../audio/config';
import type { JimmySuperJumpOutput } from '../audio/Sfx';
import {
  superJumpAppearance as jump,
  superJumpY,
  type SuperJumpPose,
} from '../superJump/appearance';
const launchStart =
  t.settleMs + t.gotchaMs + t.quietMs + t.homeMs + t.lookMs + t.crouchMs;
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
    private readonly sfx?: JimmySuperJumpOutput,
  ) {}
  tick(ms: number) {
    const previous = this.elapsed;
    this.elapsed += ms;
    const anticipation = launchStart - sfxConfig.jimmySuperJump.anticipationMs;
    if (previous < anticipation && this.elapsed >= anticipation)
      this.sfx?.jimmySuperJumpAnticipation();
    if (previous < launchStart && this.elapsed >= launchStart)
      this.sfx?.jimmySuperJump();
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
  get combinedJump(): SuperJumpPose | undefined {
    const { phase, progress } = this.state;
    if (phase === 'crouch' && progress >= jump.handoffAt)
      return {
        phase: 'anticipation',
        progress: (progress - jump.handoffAt) / (1 - jump.handoffAt),
        x: this.def.sophie.x,
        y: this.def.feetY,
      };
    if (phase === 'launch')
      return {
        phase,
        progress,
        x: this.def.sophie.x + progress * 8,
        y: superJumpY(this.def.feetY, this.top, progress),
      };
    return undefined;
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
      const align = phase === 'launch' ? 1 : Math.min(1, p / jump.handoffAt);
      actors.jimmy.x += (actors.sophie.x - actors.jimmy.x) * align;
      actors.sophie.y -= jump.sophieFeetOffset * align;
      if (phase === 'launch') {
        const y = superJumpY(this.def.feetY, this.top, p);
        actors.sophie.y = y - jump.sophieFeetOffset;
        actors.jimmy.y = y;
        actors.sophie.x += p * 8;
        actors.jimmy.x += p * 8;
      }
    } else if (['empty', 'punchline', 'fade', 'complete'].includes(phase)) {
      actors.sophie.y =
        superJumpY(this.def.feetY, this.top, 1) - jump.sophieFeetOffset;
      actors.jimmy.y = superJumpY(this.def.feetY, this.top, 1);
      actors.sophie.x += 8;
      actors.jimmy.x = actors.sophie.x;
    }
    return actors;
  }
}
