import type { Point } from '../levels/types';
import type { SpeechLine } from '../../ui/SpeechBubble';
import type { JimmySuperJumpOutput } from '../audio/Sfx';
import { sfxConfig } from '../audio/config';
import {
  superJumpAppearance,
  type SuperJumpPose,
} from '../superJump/appearance';
import type { RaceDefinition } from './config';
import { raceStoryTuning as t } from './storyConfig';

export interface RaceActorPose extends Point {
  pose: 'idle' | 'walk' | 'jump';
  alpha: number;
  visible: boolean;
  flipX: boolean;
}
export type RaceActors = { sophie: RaceActorPose; jimmy: RaceActorPose };
type ActorPositions = { sophie: Point; jimmy: Point };
const elapsedStep = (ms: number) => (Number.isFinite(ms) ? Math.max(0, ms) : 0);
const mix = (a: number, b: number, fraction: number) =>
  a + (b - a) * Math.max(0, Math.min(1, fraction));
const pose = (
  point: Point,
  animation: RaceActorPose['pose'] = 'idle',
): RaceActorPose => ({
  ...point,
  pose: animation,
  alpha: 1,
  visible: true,
  flipX: false,
});

export const raceOpeningDialogue = {
  jimmy: {
    speaker: 'jimmy',
    text: 'The kids are going home from school!',
  },
  sophie: {
    speaker: 'sophie',
    text: "Let's take a shortcut.\nWe'll get back in time.",
  },
} as const satisfies Record<string, SpeechLine>;

const openingPhases = [
  ['bus', t.opening.busMs],
  ['jimmy', t.opening.jimmyMs],
  ['sophie', t.opening.sophieMs],
  ['reaction', t.opening.reactionMs],
] as const;
type OpeningPhase = (typeof openingPhases)[number][0] | 'complete';

/** The bus is a visual cue. This sequence never creates a race deadline. */
export class RaceOpening {
  elapsed = 0;
  tick(ms: number) {
    this.elapsed += elapsedStep(ms);
  }
  get progress() {
    const duration = openingPhases.reduce((total, [, ms]) => total + ms, 0);
    return Math.min(1, this.elapsed / duration);
  }
  get state(): { phase: OpeningPhase; progress: number } {
    let ms = this.elapsed;
    for (const [phase, duration] of openingPhases) {
      if (ms < duration) return { phase, progress: ms / duration };
      ms -= duration;
    }
    return { phase: 'complete', progress: 1 };
  }
  get line(): SpeechLine | undefined {
    const phase = this.state.phase;
    return phase === 'jimmy' || phase === 'sophie'
      ? raceOpeningDialogue[phase]
      : undefined;
  }
  get complete() {
    return this.state.phase === 'complete';
  }
}

const jumpPhases = [
  ['gather', t.superJump.gatherMs],
  ['pause', t.superJump.pauseMs],
  ['crouch', t.superJump.crouchMs],
  ['flight', t.superJump.flightMs],
  ['land', t.superJump.landMs],
] as const;
export type RaceSuperJumpPhase = (typeof jumpPhases)[number][0] | 'complete';
const launchAt =
  t.superJump.gatherMs + t.superJump.pauseMs + t.superJump.crouchMs;

/** Guaranteed transfer between chapters' movement vocabularies, never an ability. */
export class RaceSuperJump {
  elapsed = 0;
  private readonly from: ActorPositions;
  constructor(
    readonly def: RaceDefinition['superJump'],
    from: ActorPositions,
    private readonly sfx?: JimmySuperJumpOutput,
  ) {
    const reach = (t.superJump.gatherSpeed * t.superJump.gatherMs) / 1000;
    const bound = (point: Point, targetX: number): Point => ({
      x: Math.max(targetX - reach, Math.min(targetX + reach, point.x)),
      y: def.staging.y,
    });
    this.from = {
      sophie: bound(from.sophie, def.staging.x),
      jimmy: bound(from.jimmy, def.staging.x - 48),
    };
  }
  tick(ms: number) {
    const previous = this.elapsed;
    this.elapsed += elapsedStep(ms);
    const anticipationAt = launchAt - sfxConfig.jimmySuperJump.anticipationMs;
    if (previous < anticipationAt && this.elapsed >= anticipationAt)
      this.sfx?.jimmySuperJumpAnticipation();
    if (previous < launchAt && this.elapsed >= launchAt)
      this.sfx?.jimmySuperJump();
  }
  get state(): { phase: RaceSuperJumpPhase; progress: number; ms: number } {
    let ms = this.elapsed;
    for (const [phase, duration] of jumpPhases) {
      if (ms < duration) return { phase, progress: ms / duration, ms };
      ms -= duration;
    }
    return { phase: 'complete', progress: 1, ms };
  }
  private get flight(): Point {
    const ms = Math.min(t.superJump.flightMs, this.state.ms);
    const peak =
      Math.min(this.def.staging.y, this.def.landing.y) - t.superJump.arcHeight;
    // The established rising sound peaks at the crest. The longer descent
    // gives the camera and player time to read the stable landing crown.
    const rising = Math.min(1, ms / t.superJump.riseMs);
    const falling = Math.max(
      0,
      (ms - t.superJump.riseMs) / (t.superJump.flightMs - t.superJump.riseMs),
    );
    return {
      x: mix(this.def.staging.x, this.def.landing.x, ms / t.superJump.flightMs),
      y:
        ms <= t.superJump.riseMs
          ? mix(this.def.staging.y, peak, 1 - (1 - rising) ** 2)
          : mix(peak, this.def.landing.y, falling ** 2),
    };
  }
  get combinedJump(): SuperJumpPose | undefined {
    const { phase, progress, ms } = this.state;
    if (phase === 'crouch' && progress >= superJumpAppearance.handoffAt)
      return {
        phase: 'anticipation',
        progress:
          (progress - superJumpAppearance.handoffAt) /
          (1 - superJumpAppearance.handoffAt),
        ...this.def.staging,
      };
    if (phase === 'flight')
      return {
        phase: 'launch',
        progress: Math.min(1, ms / t.superJump.riseMs),
        ...this.flight,
      };
    return undefined;
  }
  get actors(): RaceActors {
    const { phase, progress } = this.state;
    const stage = this.def.staging;
    const sophie = pose(stage);
    const jimmy = pose({ x: stage.x - 48, y: stage.y });
    if (phase === 'gather') {
      for (const [name, actor] of [
        ['sophie', sophie],
        ['jimmy', jimmy],
      ] as const) {
        const targetX = actor.x;
        actor.x = mix(this.from[name].x, targetX, progress);
        actor.pose = Math.abs(actor.x - targetX) > 1 ? 'walk' : 'idle';
        actor.flipX = this.from[name].x > targetX;
      }
    } else if (phase === 'crouch') {
      const align = Math.min(1, progress / superJumpAppearance.handoffAt);
      jimmy.x = mix(stage.x - 48, stage.x, align);
      sophie.y -= superJumpAppearance.sophieFeetOffset * align;
    } else if (phase === 'flight') {
      Object.assign(jimmy, this.flight);
      Object.assign(sophie, this.flight);
      sophie.y -= superJumpAppearance.sophieFeetOffset;
      sophie.pose = jimmy.pose = 'jump';
    } else if (phase === 'land' || phase === 'complete') {
      const amount = phase === 'complete' ? 1 : progress;
      Object.assign(sophie, this.def.landing);
      sophie.y -= superJumpAppearance.sophieFeetOffset * (1 - amount);
      jimmy.x = mix(this.def.landing.x, this.def.jimmyLanding.x, amount);
      jimmy.y = mix(this.def.landing.y, this.def.jimmyLanding.y, amount);
      sophie.pose = jimmy.pose = amount < 1 ? 'jump' : 'idle';
    }
    if (this.combinedJump) sophie.visible = jimmy.visible = false;
    return { sophie, jimmy };
  }
  get complete() {
    return this.state.phase === 'complete';
  }
}

export type RaceAtticPhase = 'enter' | 'empty' | 'fade' | 'complete';

/** Stops at the attic threshold. The future reunion scene owns everything inside. */
export class RaceAtticEntry {
  elapsed = 0;
  private readonly from: ActorPositions;
  constructor(
    readonly destination: RaceDefinition['destination'],
    from: ActorPositions,
  ) {
    const attic = destination.attic;
    const sophieX = Math.max(
      attic.x - 48,
      Math.min(attic.x + 12, from.sophie.x),
    );
    this.from = {
      sophie: { x: sophieX, y: from.sophie.y },
      jimmy: {
        x: Math.max(
          sophieX - t.attic.companionReach,
          Math.min(sophieX - 32, from.jimmy.x),
        ),
        y: attic.y,
      },
    };
  }
  tick(ms: number) {
    this.elapsed += elapsedStep(ms);
  }
  get insideX() {
    return this.destination.attic.x + t.attic.insideOffset;
  }
  get walkMs() {
    return Math.max(
      ((this.insideX - this.from.sophie.x) / t.attic.walkSpeed) * 1000,
      ((this.insideX - this.from.jimmy.x) / t.attic.walkSpeed) * 1000 +
        t.attic.followDelayMs,
    );
  }
  get state(): { phase: RaceAtticPhase; progress: number; ms: number } {
    let ms = this.elapsed;
    const phases = [
      ['enter', this.walkMs],
      ['empty', t.attic.emptyMs],
      ['fade', t.attic.fadeMs],
    ] as const;
    for (const [phase, duration] of phases) {
      if (ms < duration) return { phase, progress: ms / duration, ms };
      ms -= duration;
    }
    return { phase: 'complete', progress: 1, ms };
  }
  get actors(): RaceActors {
    const { phase, ms } = this.state;
    const actor = (name: 'sophie' | 'jimmy'): RaceActorPose => {
      const from = this.from[name];
      const walkingMs = Math.max(
        0,
        ms - (name === 'jimmy' ? t.attic.followDelayMs : 0),
      );
      const x =
        phase === 'enter'
          ? Math.min(
              this.insideX,
              from.x + (walkingMs * t.attic.walkSpeed) / 1000,
            )
          : this.insideX;
      const alpha = Math.max(
        0,
        Math.min(1, (this.insideX - x) / t.attic.fadeInsidePixels),
      );
      return {
        x,
        y:
          phase === 'enter'
            ? mix(
                from.y,
                this.destination.attic.y,
                walkingMs / t.attic.settleMs,
              )
            : this.destination.attic.y,
        pose: phase === 'enter' && walkingMs > 0 && alpha > 0 ? 'walk' : 'idle',
        alpha,
        visible: alpha > 0,
        flipX: false,
      };
    };
    return { sophie: actor('sophie'), jimmy: actor('jimmy') };
  }
  get fade() {
    const { phase, progress } = this.state;
    return phase === 'complete' ? 1 : phase === 'fade' ? progress : 0;
  }
  get complete() {
    return this.state.phase === 'complete';
  }
}
