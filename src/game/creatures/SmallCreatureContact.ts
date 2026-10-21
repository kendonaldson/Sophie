import type { SfxOutput } from '../audio/Sfx';
import type { Rect } from '../player/CollisionAssist';

export type SmallCreatureKind = 'bird' | 'rat';
export interface CreatureContactOptions {
  pizzaRush: boolean;
  facing: -1 | 1;
  sfx?: Pick<SfxOutput, 'birdSquawk' | 'ratSqueak'>;
}
interface CreaturePosition {
  x: number;
  y: number;
  direction: -1 | 1;
}
export interface CreatureScatter {
  origin: CreaturePosition;
  startedMs: number;
  direction: -1 | 1;
  vertical: -1 | 1;
}

export const creatureScatterTuning = {
  bird: { durationMs: 900, fadeMs: 180, speed: 200, verticalSpeed: 210 },
  rat: { durationMs: 650, fadeMs: 150, speed: 380, verticalSpeed: 0 },
  soundGapMs: 90,
  squawkFrameMs: 100,
} as const;

/** Only bird/rat contacts use this policy; environmental hazards stay lethal. */
export class SmallCreatureContact {
  private lastSoundMs = -Infinity;

  constructor(private readonly kind: SmallCreatureKind) {}

  resolve(options: CreatureContactOptions | undefined, elapsedMs: number) {
    if (!options?.pizzaRush) return 'reset';
    // A flock can overlap Sophie in one step. Use one cue per burst, with
    // enough overlap between nearby contacts to sound like several creatures.
    if (elapsedMs - this.lastSoundMs >= creatureScatterTuning.soundGapMs) {
      if (this.kind === 'bird') options.sfx?.birdSquawk();
      else options.sfx?.ratSqueak();
      this.lastSoundMs = elapsedMs;
    }
    return 'scatter';
  }

  reset() {
    this.lastSoundMs = -Infinity;
  }
}

export function startCreatureScatter(
  origin: CreaturePosition,
  body: Rect,
  facing: -1 | 1,
  index: number,
  elapsedMs: number,
): CreatureScatter {
  const away = origin.x - (body.x + body.width / 2);
  return {
    origin: { ...origin },
    startedMs: elapsedMs,
    direction: away === 0 ? facing : away < 0 ? -1 : 1,
    vertical: index % 2 === 0 ? -1 : 1,
  };
}

/** Absolute elapsed time keeps scatter paths identical across frame sizes. */
export function creatureScatterState(
  kind: SmallCreatureKind,
  scatter: CreatureScatter,
  elapsedMs: number,
) {
  const c = creatureScatterTuning[kind];
  const ms = Math.min(c.durationMs, Math.max(0, elapsedMs - scatter.startedMs));
  const seconds = ms / 1000;
  return {
    position: {
      x: scatter.origin.x + scatter.direction * c.speed * seconds,
      y: scatter.origin.y + scatter.vertical * c.verticalSpeed * seconds,
      direction: scatter.direction,
    },
    ms,
    alpha: Math.min(1, (c.durationMs - ms) / c.fadeMs),
    visible: ms < c.durationMs,
  };
}
