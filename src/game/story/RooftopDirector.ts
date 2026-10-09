import { interlude2 as c, rooftopLines, rooftopNightLines } from './interlude2';
import { sfxConfig } from '../audio/config';
import type { JimmySuperJumpOutput } from '../audio/Sfx';
import {
  superJumpAppearance as jump,
  superJumpY,
  type SuperJumpPose,
} from '../superJump/appearance';
export type RooftopPhase =
  | 'arrival'
  | 'step-off'
  | 'dialogue'
  | 'pause'
  | 'return'
  | 'sleep'
  | 'night-fade'
  | 'overnight'
  | 'morning-fade'
  | 'morning-sleep'
  | 'edge-walk'
  | 'join'
  | 'ready'
  | 'crouch'
  | 'launch'
  | 'empty'
  | 'fade'
  | 'complete';
export type RooftopPose = 'idle' | 'sit' | 'walk' | 'sleep' | 'jump';
const durations = {
  arrival: c.arrivalMs,
  'step-off': c.stepOffMs,
  return: c.returnMs,
  sleep: c.sleepHoldMs,
  'night-fade': c.nightFadeMs,
  overnight: c.overnightMs,
  'morning-fade': c.morningFadeMs,
  'morning-sleep': c.morningSleepMs,
  'edge-walk': c.edgeWalkMs,
  join: c.joinMs,
  ready: c.readyMs,
  crouch: c.crouchMs,
  launch: c.launchMs,
  empty: c.emptyMs,
  fade: c.endingFadeMs,
} as const;
const lerp = (a: number, b: number, p: number) =>
  a + (b - a) * Math.max(0, Math.min(1, p));
/** This rooftop's fixed choreography. Dialogue waits for input; movement and
 * overnight transitions use elapsed time, with no gameplay controller changes. */
export class RooftopDirector {
  phase: RooftopPhase = 'arrival';
  index = -1;
  private time = 0;
  private phaseAt = 0;
  private morningAt?: number;
  constructor(private readonly sfx?: JimmySuperJumpOutput) {}
  get environment() {
    return this.morningAt === undefined ? ('night' as const) : ('day' as const);
  }
  get dayMs() {
    return this.morningAt === undefined ? 0 : this.time - this.morningAt;
  }
  get line() {
    return rooftopLines[this.index];
  }
  get canAdvance() {
    return (
      this.phase === 'dialogue' &&
      this.time - this.phaseAt + 1e-6 >= c.minimumLineMs
    );
  }
  get progress() {
    const duration =
      this.phase === 'pause'
        ? rooftopLines[this.index + 1]!.pauseBeforeMs!
        : this.phase === 'dialogue' || this.phase === 'complete'
          ? 1
          : durations[this.phase];
    return Math.min(1, (this.time - this.phaseAt) / duration);
  }
  get fade() {
    if (this.phase === 'arrival')
      return Math.max(0, 1 - this.time / c.fadeInMs);
    if (['night-fade', 'fade'].includes(this.phase)) return this.progress;
    if (['overnight', 'complete'].includes(this.phase)) return 1;
    if (this.phase === 'morning-fade') return 1 - this.progress;
    return 0;
  }
  get liftY() {
    return (
      c.feetY + (this.phase === 'arrival' ? 26 * (1 - this.progress) ** 2 : 0)
    );
  }
  advance() {
    if (!this.canAdvance) return;
    if (this.index === rooftopNightLines.length - 1)
      this.enter('return', this.time);
    else if (this.index === rooftopLines.length - 1)
      this.enter('join', this.time);
    else if (rooftopLines[this.index + 1]!.cue === 'edge')
      this.enter('edge-walk', this.time);
    else if (rooftopLines[this.index + 1]!.pauseBeforeMs)
      this.enter('pause', this.time);
    else this.nextLine(this.time);
  }
  tick(ms: number) {
    const previous = this.time;
    this.time += Math.max(0, ms);
    for (let transitions = 0; transitions < 20; transitions++) {
      if (this.phase === 'dialogue' || this.phase === 'complete') break;
      const duration =
        this.phase === 'pause'
          ? rooftopLines[this.index + 1]!.pauseBeforeMs!
          : durations[this.phase];
      if (this.phase === 'crouch') {
        const at =
          this.phaseAt + c.crouchMs - sfxConfig.jimmySuperJump.anticipationMs;
        if (previous < at && this.time >= at)
          this.sfx?.jimmySuperJumpAnticipation();
      }
      if (this.time + 1e-6 < this.phaseAt + duration) break;
      const at = this.phaseAt + duration;
      switch (this.phase) {
        case 'arrival':
          this.enter('step-off', at);
          break;
        case 'step-off':
        case 'pause':
        case 'edge-walk':
        case 'morning-sleep':
          this.nextLine(at);
          break;
        case 'return':
          this.enter('sleep', at);
          break;
        case 'sleep':
          this.enter('night-fade', at);
          break;
        case 'night-fade':
          this.enter('overnight', at);
          break;
        case 'overnight':
          this.morningAt = at;
          this.enter('morning-fade', at);
          break;
        case 'morning-fade':
          this.enter('morning-sleep', at);
          break;
        case 'join':
          this.enter('ready', at);
          break;
        case 'ready':
          this.enter('crouch', at);
          break;
        case 'crouch':
          this.enter('launch', at);
          this.sfx?.jimmySuperJump();
          break;
        case 'launch':
          this.enter('empty', at);
          break;
        case 'empty':
          this.enter('fade', at);
          break;
        case 'fade':
          this.enter('complete', at);
          break;
      }
    }
  }
  private enter(phase: RooftopPhase, at: number) {
    this.phase = phase;
    this.phaseAt = at;
  }
  private nextLine(at: number) {
    this.index++;
    this.enter('dialogue', at);
  }
  get combinedJump(): SuperJumpPose | undefined {
    if (this.phase === 'crouch' && this.progress >= jump.handoffAt)
      return {
        phase: 'anticipation',
        progress: (this.progress - jump.handoffAt) / (1 - jump.handoffAt),
        x: c.sophieEdgeX,
        y: c.feetY,
      };
    if (this.phase === 'launch')
      return {
        phase: 'launch',
        progress: this.progress,
        x: c.sophieEdgeX + this.progress * 40,
        y: superJumpY(c.feetY, 0, this.progress, c.spriteScale),
      };
    return undefined;
  }
  get actors() {
    const p = this.progress;
    let sx: number = c.sophieEdgeX,
      jx: number = c.jimmyRestX,
      sy: number = c.feetY,
      jy: number = c.feetY;
    let sp: RooftopPose = 'idle',
      jp: RooftopPose = 'sit';
    if (this.phase === 'arrival') {
      sx = c.sophieLiftX;
      jx = c.jimmyLiftX;
      sy = jy = this.liftY;
      jp = 'idle';
    } else if (this.phase === 'step-off') {
      sx = lerp(c.sophieLiftX, c.sophieEdgeX, p);
      const follow = Math.max(0, (p - 0.075) / 0.925);
      jx = lerp(c.jimmyLiftX, c.jimmyRestX, follow);
      sp = 'walk';
      jp = follow > 0 ? 'walk' : 'idle';
    } else if (this.phase === 'return') {
      sx = lerp(c.sophieEdgeX, c.sophieSleepX, p);
      sp = 'walk';
    } else if (
      [
        'sleep',
        'night-fade',
        'overnight',
        'morning-fade',
        'morning-sleep',
      ].includes(this.phase)
    ) {
      sx = c.sophieSleepX;
      sp = jp = 'sleep';
    } else if (this.environment === 'day') {
      const line = this.index - rooftopNightLines.length;
      sx = line >= 7 ? c.sophieEdgeX : c.sophieSleepX;
      jp = line < 2 ? 'sleep' : line < 9 ? 'sit' : 'idle';
      if (this.phase === 'edge-walk') {
        sx = lerp(c.sophieSleepX, c.sophieEdgeX, p);
        sp = 'walk';
      }
      if (this.phase === 'join') {
        jx = lerp(c.jimmyRestX, c.jimmyReadyX, p);
        jp = 'walk';
      }
      if (this.phase === 'ready') jx = c.jimmyReadyX;
      if (this.phase === 'crouch') {
        const align = Math.min(1, p / jump.handoffAt);
        jx = lerp(c.jimmyReadyX, c.sophieEdgeX, align);
        sy -= jump.sophieFeetOffset * c.spriteScale * align;
        sp = 'jump';
      }
    }
    const visible =
      !this.combinedJump &&
      !['launch', 'empty', 'fade', 'complete'].includes(this.phase);
    return {
      sophie: {
        x: sx,
        y: sy,
        pose: sp,
        flipX: this.phase === 'return',
        visible,
      },
      jimmy: { x: jx, y: jy, pose: jp, flipX: false, visible },
    };
  }
}
