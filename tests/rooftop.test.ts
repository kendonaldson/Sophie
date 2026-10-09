import { expect, it, vi } from 'vitest';
import { RooftopDirector } from '../src/game/story/RooftopDirector';
import { interlude2 as c, rooftopLines } from '../src/game/story/interlude2';
import { balloonPositions } from '../src/game/story/RooftopArt';
import {
  superJumpAppearance as jump,
  superJumpFrame,
  superJumpY,
} from '../src/game/superJump/appearance';
import { sfxConfig } from '../src/game/audio/config';

function next(d: RooftopDirector) {
  d.tick(c.minimumLineMs);
  d.advance();
  if (d.phase === 'pause') d.tick(rooftopLines[d.index + 1]!.pauseBeforeMs!);
  if (d.phase === 'edge-walk') d.tick(c.edgeWalkMs);
}
function morning(d: RooftopDirector) {
  d.tick(c.arrivalMs + c.stepOffMs);
  for (let i = 0; i < 11; i++) next(d);
  d.tick(
    c.returnMs +
      c.sleepHoldMs +
      c.nightFadeMs +
      c.overnightMs +
      c.morningFadeMs +
      c.morningSleepMs,
  );
}
it('walks off the lift, sleeps overnight, and wakes Sophie before Jimmy', () => {
  const d = new RooftopDirector();
  expect(d.actors.jimmy.y).toBe(d.liftY);
  d.tick(c.arrivalMs + c.stepOffMs / 2);
  expect(d.actors.sophie.pose).toBe('walk');
  expect(d.actors.jimmy.pose).toBe('walk');
  expect(d.actors.sophie.x).toBeGreaterThan(d.actors.jimmy.x);
  d.tick(c.stepOffMs / 2);
  expect(d.actors.sophie.pose).toBe('idle');
  expect(d.actors.jimmy.pose).toBe('sit');
  for (let i = 0; i < 11; i++) {
    expect(d.line).toEqual(rooftopLines[i]);
    next(d);
  }
  expect(d.actors.sophie.pose).toBe('walk');
  expect(d.actors.sophie.flipX).toBe(true);
  d.tick(c.returnMs);
  const sleepers = d.actors;
  expect(Object.values(sleepers).map((a) => a.pose)).toEqual([
    'sleep',
    'sleep',
  ]);
  d.tick(c.sleepHoldMs + c.nightFadeMs);
  expect(d.fade).toBe(1);
  d.tick(c.overnightMs);
  expect(d.environment).toBe('day');
  expect(d.actors).toEqual(sleepers);
  d.tick(c.morningFadeMs + c.morningSleepMs);
  expect(d.line?.text).toBe('Jimmy!');
  expect(d.actors.sophie.pose).toBe('idle');
  expect(d.actors.jimmy.pose).toBe('sleep');
  next(d);
  expect(d.line?.text).toBe('Jimmy!');
  expect(d.actors.jimmy.pose).toBe('sleep');
  next(d);
  expect(d.line?.text).toBe('What?');
  expect(d.actors.jimmy.pose).toBe('sit');
});
it('gates dialogue, stages the edge walk and join, then aligns the combined exit with the sound peak', () => {
  const sfx = { jimmySuperJumpAnticipation: vi.fn(), jimmySuperJump: vi.fn() };
  const d = new RooftopDirector(sfx);
  d.advance();
  expect(d.index).toBe(-1);
  morning(d);
  for (let i = 11; i < rooftopLines.length; i++) {
    expect(d.line).toEqual(rooftopLines[i]);
    if (i === 18) expect(d.actors.sophie.x).toBe(c.sophieEdgeX);
    if (i === 20) expect(d.actors.jimmy.pose).toBe('idle');
    next(d);
  }
  expect(d.phase).toBe('join');
  expect(d.actors.jimmy.pose).toBe('walk');
  d.tick(c.joinMs + c.readyMs + c.crouchMs * jump.handoffAt);
  expect(d.combinedJump?.phase).toBe('anticipation');
  expect(d.actors.sophie.visible).toBe(false);
  expect(d.actors.jimmy.visible).toBe(false);
  d.tick(
    c.crouchMs * (1 - jump.handoffAt) - sfxConfig.jimmySuperJump.anticipationMs,
  );
  expect(sfx.jimmySuperJumpAnticipation).toHaveBeenCalledOnce();
  expect(sfx.jimmySuperJump).not.toHaveBeenCalled();
  d.tick(sfxConfig.jimmySuperJump.anticipationMs);
  expect(sfx.jimmySuperJump).toHaveBeenCalledOnce();
  expect(superJumpFrame(d.combinedJump!)).toBe(3);
  d.tick(c.launchMs - 1);
  expect(superJumpFrame(d.combinedJump!)).toBe(7);
  expect(d.combinedJump!.y + jump.belowFeet * c.spriteScale).toBeGreaterThan(0);
  expect(
    superJumpY(c.feetY, 0, 1, c.spriteScale) + jump.belowFeet * c.spriteScale,
  ).toBeLessThan(0);
  d.tick(1);
  expect(d.phase).toBe('empty');
  expect(d.combinedJump).toBeUndefined();
  expect(d.fade).toBe(0);
  d.tick(c.emptyMs + c.endingFadeMs);
  expect(d.phase).toBe('complete');
  expect(d.fade).toBe(1);
  expect(sfx.jimmySuperJump).toHaveBeenCalledOnce();
});
it('keeps overnight, balloon motion, and the launch independent of time partitions', () => {
  const a = new RooftopDirector(),
    b = new RooftopDirector();
  morning(a);
  morning(b);
  for (let i = 11; i < rooftopLines.length; i++) {
    next(a);
    next(b);
  }
  a.tick(c.joinMs + c.readyMs + c.crouchMs + 150);
  for (let i = 0; i < 209; i++) b.tick(10);
  expect(b.phase).toBe(a.phase);
  expect(b.combinedJump).toEqual(a.combinedJump);
  const first = balloonPositions(0),
    later = balloonPositions(10000);
  expect(new Set(first.map((b) => b.scale)).size).toBe(4);
  later.forEach((b, i) => {
    expect(b.x - first[i]!.x).toBeGreaterThanOrEqual(10);
    expect(b.x - first[i]!.x).toBeLessThanOrEqual(26);
  });
});
