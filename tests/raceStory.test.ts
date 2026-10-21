import { describe, expect, it, vi } from 'vitest';
import {
  RaceAtticEntry,
  RaceOpening,
  RaceSuperJump,
  raceOpeningDialogue,
} from '../src/game/race/RaceStory';
import { raceStoryTuning as t } from '../src/game/race/storyConfig';
import { sfxConfig } from '../src/game/audio/config';
import { superJumpFrame } from '../src/game/superJump/appearance';
import type { RaceDefinition } from '../src/game/race/config';

const jumpDefinition: RaceDefinition['superJump'] = {
  triggerX: 4530,
  runwayEnd: 4610,
  staging: { x: 4510, y: 1340 },
  landing: { x: 6560, y: 1160 },
  jimmyLanding: { x: 6505, y: 1160 },
  checkpointId: 'race-balloon-entry',
};
const jumpFrom = {
  sophie: { x: 4530, y: 1340 },
  jimmy: { x: 4470, y: 1340 },
};
const launchAt =
  t.superJump.gatherMs + t.superJump.pauseMs + t.superJump.crouchMs;
const destination: RaceDefinition['destination'] = {
  triggerX: 20700,
  sophie: { x: 20770, y: 1290 },
  jimmy: { x: 20715, y: 1290 },
  attic: { x: 21240, y: 1230 },
};
const entryFrom = {
  sophie: { x: 21220, y: 1230 },
  jimmy: { x: 21160, y: 1230 },
};

describe('race-home opening', () => {
  it('shows only the brief bus exchange and releases control in under six seconds', () => {
    const opening = new RaceOpening();
    expect(opening.state.phase).toBe('bus');
    expect(opening.line).toBeUndefined();
    opening.tick(t.opening.busMs);
    expect(opening.line).toEqual({
      speaker: 'jimmy',
      text: 'The kids are going home from school!',
    });
    opening.tick(t.opening.jimmyMs);
    expect(opening.line).toEqual({
      speaker: 'sophie',
      text: "Let's take a shortcut.\nWe'll get back in time.",
    });
    opening.tick(t.opening.sophieMs);
    expect(opening.state.phase).toBe('reaction');
    expect(opening.line).toBeUndefined();
    opening.tick(t.opening.reactionMs);
    expect(opening.complete).toBe(true);
    expect(opening.elapsed).toBeLessThan(6000);
    opening.tick(600000);
    expect(opening.complete).toBe(true);
    expect(opening.line).toBeUndefined();
    expect(Object.keys(raceOpeningDialogue)).toEqual(['jimmy', 'sophie']);
  });
  it('keeps bus progress continuous across dialogue phases and holds it while paused', () => {
    const opening = new RaceOpening();
    let previous = opening.progress;
    expect(previous).toBe(0);
    for (let i = 0; i < 600; i++) {
      opening.tick(10);
      expect(opening.progress).toBeGreaterThanOrEqual(previous);
      expect(opening.progress - previous).toBeLessThan(0.01);
      previous = opening.progress;
      opening.tick(0);
      expect(opening.progress).toBe(previous);
    }
    expect(opening.progress).toBe(1);
  });
});

describe('race-home Jimmy transfer', () => {
  it('uses the combined anticipation and launch poses, aligning the crest with the established sound', () => {
    const sfx = {
      jimmySuperJumpAnticipation: vi.fn(),
      jimmySuperJump: vi.fn(),
    };
    const jump = new RaceSuperJump(jumpDefinition, jumpFrom, sfx);
    expect(jump.state.phase).toBe('gather');
    expect(jump.actors.sophie.flipX).toBe(true);
    jump.tick(t.superJump.gatherMs + t.superJump.pauseMs);
    expect(jump.state.phase).toBe('crouch');
    expect(jump.combinedJump).toBeUndefined();
    jump.tick(t.superJump.crouchMs - sfxConfig.jimmySuperJump.anticipationMs);
    expect(sfx.jimmySuperJumpAnticipation).toHaveBeenCalledOnce();
    expect(sfx.jimmySuperJump).not.toHaveBeenCalled();
    expect(jump.combinedJump!.phase).toBe('anticipation');
    expect(jump.actors.sophie.visible).toBe(false);
    expect(jump.actors.jimmy.visible).toBe(false);
    jump.tick(sfxConfig.jimmySuperJump.anticipationMs);
    expect(jump.state.phase).toBe('flight');
    expect(sfx.jimmySuperJump).toHaveBeenCalledOnce();
    expect(superJumpFrame(jump.combinedJump!)).toBe(3);
    jump.tick(t.superJump.riseMs);
    expect(superJumpFrame(jump.combinedJump!)).toBe(7);
    const crest = jump.combinedJump!;
    expect(crest.y).toBe(
      Math.min(jumpDefinition.staging.y, jumpDefinition.landing.y) -
        t.superJump.arcHeight,
    );
    expect(crest.x).toBeGreaterThan(jumpDefinition.runwayEnd);
    jump.tick(40);
    expect(jump.combinedJump!.y).toBeGreaterThan(crest.y);
    expect(jump.combinedJump!.x).toBeGreaterThan(crest.x);
    jump.tick(10000);
    expect(sfx.jimmySuperJumpAnticipation).toHaveBeenCalledOnce();
    expect(sfx.jimmySuperJump).toHaveBeenCalledOnce();
  });

  it('lands both dogs at the stable crown without depending on companion traversal', () => {
    const jump = new RaceSuperJump(jumpDefinition, {
      sophie: jumpFrom.sophie,
      jimmy: { x: 100, y: 2400 },
    });
    expect(jump.actors.jimmy.y).toBe(jumpDefinition.staging.y);
    expect(jump.actors.jimmy.x).toBeGreaterThan(jumpDefinition.staging.x - 110);
    jump.tick(launchAt + t.superJump.flightMs);
    expect(jump.state.phase).toBe('land');
    expect(jump.combinedJump).toBeUndefined();
    expect(jump.actors.sophie.visible).toBe(true);
    expect(jump.actors.jimmy.visible).toBe(true);
    jump.tick(t.superJump.landMs);
    expect(jump.complete).toBe(true);
    expect(jump.actors.sophie).toMatchObject({
      ...jumpDefinition.landing,
      pose: 'idle',
      visible: true,
    });
    expect(jump.actors.jimmy).toMatchObject({
      ...jumpDefinition.jimmyLanding,
      pose: 'idle',
      visible: true,
    });
  });

  it('is independent of frame partitions and emits the two cues only once', () => {
    const aSounds = {
      jimmySuperJumpAnticipation: vi.fn(),
      jimmySuperJump: vi.fn(),
    };
    const bSounds = {
      jimmySuperJumpAnticipation: vi.fn(),
      jimmySuperJump: vi.fn(),
    };
    const a = new RaceSuperJump(jumpDefinition, jumpFrom, aSounds);
    const b = new RaceSuperJump(jumpDefinition, jumpFrom, bSounds);
    a.tick(1600);
    for (let i = 0; i < 160; i++) b.tick(10);
    expect(b.state).toEqual(a.state);
    expect(b.actors).toEqual(a.actors);
    expect(b.combinedJump).toEqual(a.combinedJump);
    for (const sounds of [aSounds, bSounds]) {
      expect(sounds.jimmySuperJumpAnticipation).toHaveBeenCalledOnce();
      expect(sounds.jimmySuperJump).toHaveBeenCalledOnce();
    }
    b.tick(-300);
    b.tick(0);
    expect(b.state).toEqual(a.state);
  });
});

describe('race-home attic entry', () => {
  it('lets Sophie enter first, brings Jimmy inside, then fades with no reunion dialogue', () => {
    const entry = new RaceAtticEntry(destination, entryFrom);
    expect(entry.state.phase).toBe('enter');
    expect(entry.actors.sophie.visible).toBe(true);
    entry.tick(t.attic.followDelayMs - 1);
    expect(entry.actors.sophie.x).toBeGreaterThan(entryFrom.sophie.x);
    expect(entry.actors.jimmy.x).toBe(entryFrom.jimmy.x);
    entry.tick(2);
    expect(entry.actors.jimmy.x).toBeGreaterThan(entryFrom.jimmy.x);
    const sophieInsideMs =
      ((entry.insideX - entryFrom.sophie.x) / t.attic.walkSpeed) * 1000;
    entry.tick(Math.max(0, sophieInsideMs - entry.elapsed));
    expect(entry.actors.sophie.visible).toBe(false);
    expect(entry.actors.jimmy.visible).toBe(true);
    expect(entry.fade).toBe(0);
    entry.tick(entry.walkMs - entry.elapsed + 0.001);
    expect(entry.state.phase).toBe('empty');
    expect(Object.values(entry.actors).every((actor) => !actor.visible)).toBe(
      true,
    );
    expect(entry.fade).toBe(0);
    entry.tick(t.attic.emptyMs + t.attic.fadeMs / 2);
    expect(entry.state.phase).toBe('fade');
    expect(entry.fade).toBeCloseTo(0.5);
    entry.tick(t.attic.fadeMs / 2);
    expect(entry.complete).toBe(true);
    expect(entry.fade).toBe(1);
  });

  it('fades both dogs within the visible doorway and safely reconciles a distant Jimmy', () => {
    const entry = new RaceAtticEntry(destination, {
      sophie: entryFrom.sophie,
      jimmy: { x: 500, y: 4000 },
    });
    expect(entry.actors.jimmy.x).toBe(
      entryFrom.sophie.x - t.attic.companionReach,
    );
    expect(entry.actors.jimmy.y).toBe(destination.attic.y);
    // RaceHomeArt centers WorldArt's 25-pixel opening on this destination.
    const leftJamb = destination.attic.x - 12;
    const rightJamb = destination.attic.x + 13;
    const fadingDogs = new Set<string>();
    for (let ms = 0; ms < entry.walkMs; ms += 10) {
      for (const [name, actor] of Object.entries(entry.actors)) {
        expect(actor.x).toBeLessThan(rightJamb);
        if (actor.x <= leftJamb) expect(actor.alpha).toBe(1);
        if (actor.alpha < 1) expect(actor.x).toBeGreaterThan(leftJamb);
        if (actor.alpha > 0 && actor.alpha < 1) fadingDogs.add(name);
      }
      entry.tick(10);
    }
    expect([...fadingDogs].sort()).toEqual(['jimmy', 'sophie']);
    for (const actor of Object.values(entry.actors)) {
      expect(actor.visible).toBe(false);
      expect(actor.alpha).toBe(0);
      expect(actor.x).toBeGreaterThan(leftJamb);
      expect(actor.x).toBeLessThan(rightJamb);
    }
  });

  it('has deterministic pause/resume and completion regardless of tick partition', () => {
    const a = new RaceAtticEntry(destination, entryFrom);
    const b = new RaceAtticEntry(destination, entryFrom);
    a.tick(800);
    for (let i = 0; i < 80; i++) b.tick(10);
    expect(b.actors).toEqual(a.actors);
    const paused = b.actors;
    b.tick(0);
    b.tick(-1000);
    expect(b.actors).toEqual(paused);
    a.tick(10000);
    for (let i = 0; i < 100; i++) b.tick(100);
    expect(b.state).toEqual(a.state);
    expect(b.actors).toEqual(a.actors);
    expect(b.complete).toBe(true);
  });
});
