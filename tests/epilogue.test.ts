import { expect, it, vi } from 'vitest';
import { EpilogueDirector } from '../src/game/story/EpilogueDirector';
import {
  epilogue,
  epilogueBeats,
  epilogueLines,
} from '../src/game/story/epilogue';

type BeatId = (typeof epilogueBeats)[number]['id'];
function at(id: BeatId) {
  const index = epilogueBeats.findIndex((beat) => beat.id === id);
  return epilogueBeats
    .slice(0, index)
    .reduce((sum, beat) => sum + beat.durationMs, 0);
}
const duration = (id: BeatId) =>
  epilogueBeats.find((beat) => beat.id === id)!.durationMs;
const total = epilogueBeats.reduce((sum, beat) => sum + beat.durationMs, 0);
function sceneAt(id: BeatId) {
  const director = new EpilogueDirector();
  director.tick(at(id));
  return director;
}

it('establishes the home, slows the bus to a stationary stop, opens its door, and drives away before entering', () => {
  const homeSound = vi.fn();
  const scene = new EpilogueDirector({ homeSound });
  expect(scene.environment).toBe('exterior');
  expect(scene.bus.visible).toBe(false);
  expect(scene.line).toBeUndefined();
  scene.tick(at('bus-arrive'));
  expect(scene.bus).toEqual({
    x: epilogue.busEntryX,
    visible: true,
    doorOpen: false,
  });
  const arrival = duration('bus-arrive');
  scene.tick(arrival / 2);
  const halfwayX = scene.bus.x;
  scene.tick(arrival / 2);
  expect(halfwayX - epilogue.busEntryX).toBeGreaterThan(
    epilogue.busStopX - halfwayX,
  );
  expect(scene.bus.x).toBe(epilogue.busStopX);
  expect(homeSound).toHaveBeenLastCalledWith('bus-brake');
  scene.tick(duration('bus-stop'));
  expect(scene.bus.doorOpen).toBe(true);
  expect(homeSound).toHaveBeenLastCalledWith('bus-door');
  scene.tick(duration('bus-door') / 2);
  expect(scene.bus.x).toBe(epilogue.busStopX);
  scene.tick(duration('bus-door') / 2);
  expect(scene.bus.doorOpen).toBe(false);
  scene.tick(duration('bus-close'));
  expect(scene.bus.x).toBe(epilogue.busStopX);
  scene.tick(duration('bus-depart') / 2);
  expect(scene.bus.x).toBeGreaterThan(epilogue.busStopX);
  expect(scene.bus.x).toBeLessThan(epilogue.busExitX);
  scene.tick(duration('bus-depart') / 2);
  expect(scene.bus.visible).toBe(false);
  expect(scene.environment).toBe('exterior');
  scene.tick(duration('exterior-hold') + duration('inside-transition'));
  expect(scene.environment).toBe('bedroom');
  expect(scene.actors.sophie).toMatchObject({ pose: 'idle', visible: true });
  expect(scene.actors.jimmy).toMatchObject({ pose: 'sit', visible: true });
  expect(scene.line).toBeUndefined();
});

it('uses only the two dogs and their existing idle, sit and walk poses throughout the story', () => {
  for (const beat of epilogueBeats) {
    const scene = sceneAt(beat.id);
    scene.tick(beat.durationMs / 2);
    expect(Object.keys(scene.actors)).toEqual(['sophie', 'jimmy']);
    for (const [name, actor] of Object.entries(scene.actors)) {
      expect(
        name === 'sophie' ? ['idle', 'walk'] : ['idle', 'sit', 'walk'],
      ).toContain(actor.pose);
      expect(actor.y).toBe(epilogue.feetY);
      if (scene.environment === 'exterior') expect(actor.visible).toBe(false);
    }
  }
});

it('lets Jimmy stand when Paul calls, then turns both dogs toward the exit before they walk together', () => {
  const scene = sceneAt('line-0');
  expect(scene.line).toEqual({ speaker: 'lizzy', text: "I'm home!" });
  expect(scene.actors.jimmy.pose).toBe('sit');
  scene.tick(at('line-1') - at('line-0'));
  expect(scene.line).toEqual({ speaker: 'paul', text: 'Jimmy?' });
  expect(scene.actors.jimmy.pose).toBe('idle');
  scene.tick(at('line-3') - at('line-1'));
  expect(scene.line?.speaker).toBe('iris');
  expect(scene.actors.sophie.flipX).toBe(true);
  scene.tick(at('turn') - at('line-3'));
  for (const actor of Object.values(scene.actors)) {
    expect(actor.flipX).toBe(false);
    expect(actor.pose).toBe('idle');
  }
  scene.tick(at('leave') - at('turn'));
  const before = scene.actors;
  expect(before.sophie.pose).toBe('walk');
  expect(before.jimmy.pose).toBe('walk');
  scene.tick(1000);
  expect(scene.actors.sophie.x - before.sophie.x).toBe(epilogue.walkSpeed);
  expect(scene.actors.jimmy.x - before.jimmy.x).toBe(epilogue.walkSpeed);
  expect(scene.actors.sophie.x - scene.actors.jimmy.x).toBe(
    before.sophie.x - before.jimmy.x,
  );
  scene.tick(duration('leave') - 1000);
  expect(scene.environment).toBe('bedroom');
  for (const actor of Object.values(scene.actors)) {
    expect(actor.visible).toBe(false);
    expect(actor.x).toBeGreaterThan(epilogue.width);
  }
});

it('holds the empty bedroom for the off-screen reunion and leaves only silence and fade after the final Iris line', () => {
  const homeSound = vi.fn();
  const scene = new EpilogueDirector({ homeSound });
  scene.tick(at('reunion'));
  expect(scene.environment).toBe('bedroom');
  expect(scene.line).toBeUndefined();
  expect(homeSound).toHaveBeenLastCalledWith('reunion');
  scene.tick(duration('reunion'));
  expect(scene.line).toEqual({
    speaker: 'iris',
    text: 'Why does Sophie smell like pizza?',
  });
  expect(scene.line).toEqual(epilogueLines.at(-1));
  const soundsAtPunchline = homeSound.mock.calls.length;
  scene.tick(duration('line-6'));
  expect(scene.beat?.id).toBe('silence');
  expect(scene.fade).toBe(0);
  for (let i = 0; i < 100; i++) {
    scene.tick(100);
    expect(scene.line).toBeUndefined();
    expect(scene.actors.sophie.visible).toBe(false);
    expect(scene.actors.jimmy.visible).toBe(false);
    expect(scene.environment).toBe('bedroom');
  }
  expect(scene.phase).toBe('complete');
  expect(scene.fade).toBe(1);
  expect(homeSound).toHaveBeenCalledTimes(soundsAtPunchline);
});

it('reserves the supplied non-looping soundtrack and shares its final fade envelope with the picture', () => {
  expect(epilogue.musicLoop).toBe(false);
  const scene = sceneAt('inside-transition');
  scene.tick(duration('inside-transition') / 2);
  expect(scene.fade).toBeCloseTo(0.5);
  expect(scene.musicVolume).toBe(epilogue.musicVolume);
  scene.tick(duration('inside-transition') / 2);
  expect(scene.environment).toBe('bedroom');
  expect(scene.musicVolume).toBe(epilogue.musicVolume);
  scene.tick(at('line-6') - at('bedroom'));
  expect(scene.musicVolume).toBeLessThan(epilogue.musicVolume);
  expect(scene.musicVolume).toBe(epilogue.punchlineVolume);
  scene.tick(duration('line-6') + duration('silence'));
  expect(scene.phase).toBe('fade');
  expect(scene.fade).toBe(0);
  for (let i = 1; i <= 4; i++) {
    scene.tick(epilogue.fadeOutMs / 4);
    expect(scene.fade).toBeCloseTo(i / 4);
    expect(scene.musicVolume).toBeCloseTo(
      epilogue.punchlineVolume * (1 - scene.fade),
    );
  }
  expect(scene.phase).toBe('complete');
  expect(scene.musicVolume).toBe(0);
});

it('keeps choreography and one-shot ambient cues consistent across small and large simulation ticks', () => {
  const oneShot = vi.fn();
  const partitioned = vi.fn();
  const large = new EpilogueDirector({ homeSound: oneShot });
  const small = new EpilogueDirector({ homeSound: partitioned });
  let previous = 0;
  for (const target of [
    10,
    at('bus-arrive') + 1500,
    at('bus-door') + 400,
    at('bedroom') + 300,
    at('line-2') + 100,
    at('leave') + 1800,
    at('line-6') + 500,
    at('fade') + 1200,
    total + 1000,
  ]) {
    large.tick(target - previous);
    for (let remaining = target - previous; remaining > 0;) {
      const step = Math.min(remaining, 17);
      small.tick(step);
      remaining -= step;
    }
    previous = target;
    expect(small.phase).toBe(large.phase);
    expect(small.line).toEqual(large.line);
    expect(small.fade).toBeCloseTo(large.fade);
    expect(small.bus.x).toBeCloseTo(large.bus.x);
    expect(small.bus.visible).toBe(large.bus.visible);
    expect(small.musicVolume).toBeCloseTo(large.musicVolume);
    for (const name of ['sophie', 'jimmy'] as const) {
      expect(small.actors[name].x).toBeCloseTo(large.actors[name].x);
      expect(small.actors[name].pose).toBe(large.actors[name].pose);
      expect(small.actors[name].visible).toBe(large.actors[name].visible);
    }
  }
  expect(oneShot.mock.calls).toEqual([
    ['bus-brake'],
    ['bus-door'],
    ['front-door'],
    ['reunion'],
  ]);
  expect(partitioned.mock.calls).toEqual(oneShot.mock.calls);
});
