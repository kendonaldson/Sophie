import type { SfxOutput } from '../audio/Sfx';
import { epilogue as c, epilogueBeats } from './epilogue';

export interface EpilogueActor {
  x: number;
  y: number;
  pose: 'idle' | 'sit' | 'walk';
  flipX: boolean;
  visible: boolean;
}
type BeatId = (typeof epilogueBeats)[number]['id'];
const beatIndex = (id: BeatId) =>
  epilogueBeats.findIndex((beat) => beat.id === id);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Dog-only, elapsed-time choreography; the fixed camera never joins the reunion. */
export class EpilogueDirector {
  private current = 0;
  private elapsed = 0;
  constructor(private readonly sfx?: Pick<SfxOutput, 'homeSound'>) {}
  get beat() {
    return epilogueBeats[this.current];
  }
  get phase() {
    return this.beat?.phase ?? 'complete';
  }
  get index() {
    return this.beat && 'lineIndex' in this.beat ? this.beat.lineIndex : -1;
  }
  get line() {
    return this.beat && 'line' in this.beat ? this.beat.line : undefined;
  }
  get progress() {
    return this.beat ? Math.min(1, this.elapsed / this.beat.durationMs) : 1;
  }
  get environment(): 'exterior' | 'bedroom' {
    return this.current < beatIndex('bedroom') ? 'exterior' : 'bedroom';
  }
  get fade() {
    if (this.beat?.id === 'establish' || this.beat?.id === 'bedroom')
      return Math.max(0, 1 - this.elapsed / c.fadeInMs);
    if (this.phase === 'transition' || this.phase === 'fade')
      return this.progress;
    return this.phase === 'complete' ? 1 : 0;
  }
  get musicVolume() {
    if (this.phase === 'complete') return 0;
    const final = this.current >= beatIndex('line-6');
    const volume = final ? c.punchlineVolume : c.musicVolume;
    return this.phase === 'fade' ? volume * (1 - this.progress) : volume;
  }
  get bus() {
    const id = this.beat?.id;
    let x: number = c.busStopX;
    if (id === 'bus-arrive')
      x = lerp(c.busEntryX, c.busStopX, 1 - (1 - this.progress) ** 2);
    else if (id === 'bus-depart')
      x = lerp(c.busStopX, c.busExitX, this.progress ** 2);
    return {
      x,
      visible:
        this.current >= beatIndex('bus-arrive') &&
        this.current <= beatIndex('bus-depart'),
      doorOpen: id === 'bus-door',
    };
  }
  get actors() {
    const leaving = this.beat?.id === 'leave';
    const gone = this.current > beatIndex('leave');
    const turn = this.current >= beatIndex('turn');
    const actor = (name: 'sophie' | 'jimmy'): EpilogueActor => {
      const start = name === 'sophie' ? c.sophieX : c.jimmyX;
      const x = gone
        ? c.exitX
        : leaving
          ? Math.min(c.exitX, start + (c.walkSpeed * this.elapsed) / 1000)
          : start;
      return {
        x,
        y: c.feetY,
        pose: leaving
          ? 'walk'
          : name === 'jimmy' && this.current < beatIndex('line-1')
            ? 'sit'
            : 'idle',
        flipX: !turn && name === 'sophie',
        visible: this.environment === 'bedroom' && !gone && x < c.exitX,
      };
    };
    return { sophie: actor('sophie'), jimmy: actor('jimmy') };
  }
  tick(ms: number) {
    let remaining = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    while (this.beat && remaining > 0) {
      const step = Math.min(remaining, this.beat.durationMs - this.elapsed);
      this.elapsed += step;
      remaining -= step;
      if (this.elapsed + 1e-6 >= this.beat.durationMs) {
        this.current++;
        this.elapsed = 0;
        switch (this.beat?.id) {
          case 'bus-stop':
            this.sfx?.homeSound('bus-brake');
            break;
          case 'bus-door':
            this.sfx?.homeSound('bus-door');
            break;
          case 'line-0':
            this.sfx?.homeSound('front-door');
            break;
          case 'reunion':
            this.sfx?.homeSound('reunion');
            break;
        }
      }
    }
  }
}
