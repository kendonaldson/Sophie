import { describe, expect, it } from 'vitest';
import { InterludeDirector } from '../src/game/story/InterludeDirector';
import { interlude1 as c, interludeLines } from '../src/game/story/interlude1';
import { interludeFrame } from '../src/game/story/framing';
function reach(index: number) {
  const d = new InterludeDirector();
  d.tick(c.fadeInMs);
  while (d.index < index) {
    d.tick(c.minimumLineMs);
    d.advance();
    if (d.phase === 'pause')
      d.tick(interludeLines[d.index + 1]!.pauseBeforeMs!);
  }
  return d;
}
describe('Interlude 1 choreography', () => {
  it.each([60, 120, 144])(
    'accepts the exact reading deadline after fractional %i Hz timestamps',
    (hz) => {
      const d = new InterludeDirector();
      d.tick(c.fadeInMs + c.minimumLineMs + 1000 / hz);
      d.advance();
      expect(d.index).toBe(1);
      d.tick(c.minimumLineMs);
      expect(d.canAdvance).toBe(true);
      d.advance();
      expect(d.index).toBe(2);
    },
  );
  it('starts facing each other with Jimmy sitting, and waits for an explicit advance', () => {
    const d = reach(0);
    expect(d.actors.sophie).toMatchObject({ pose: 'idle', flipX: false });
    expect(d.actors.jimmy).toMatchObject({ pose: 'sit', flipX: true });
    d.advance();
    expect(d.index).toBe(0);
    d.tick(30000);
    expect(d.index).toBe(0);
    d.advance();
    expect(d.index).toBe(1);
  });
  it('turns Sophie toward town, then back to Jimmy', () => {
    expect(reach(5).actors.sophie.flipX).toBe(true);
    expect(reach(8).actors.sophie.flipX).toBe(true);
    expect(reach(9).actors.sophie.flipX).toBe(false);
  });
  it('keeps the thinking and interruption pauses even if advance is pressed again', () => {
    const d = reach(10);
    d.tick(c.minimumLineMs);
    d.advance();
    d.advance();
    d.tick(649);
    expect(d.phase).toBe('pause');
    expect(d.index).toBe(10);
    d.tick(1);
    expect(d.line?.text).toBe('Okay.');
  });
  it('stands both dogs on the unseen voice, walks cautiously, then accelerates out before fading', () => {
    const alert = reach(13);
    expect(alert.line?.speaker).toBe('offscreen');
    for (const dog of Object.values(alert.actors))
      expect(dog).toMatchObject({ pose: 'idle', flipX: false });
    const walk = reach(14);
    walk.tick(1000);
    expect(walk.actors.sophie.x).toBe(c.sophieX + c.walkSpeed);
    expect(walk.actors.jimmy.pose).toBe('walk');
    walk.tick(30000);
    expect(walk.actors.jimmy.x).toBeLessThan(c.width);
    expect(walk.actors.jimmy.pose).toBe('idle');
    const run = reach(17);
    const start = run.actors.sophie.x;
    run.tick(c.escapeReactionMs + 250);
    expect(run.actors.sophie.pose).toBe('run');
    expect(run.actors.jimmy.pose).toBe('run');
    expect(run.actors.sophie.x - start).toBeGreaterThan(80);
    while (run.phase === 'escape') run.tick(10);
    expect(run.phase).toBe('clear');
    expect(run.fade).toBe(0);
    for (const dog of Object.values(run.actors))
      expect(dog.x).toBeGreaterThanOrEqual(c.width + c.exitMargin);
    run.tick(c.clearFrameMs + c.fadeOutMs / 2);
    expect(run.phase).toBe('fade');
    expect(run.fade).toBeGreaterThanOrEqual(0.5);
    run.tick(c.fadeOutMs);
    expect(run.phase).toBe('complete');
    expect(run.fade).toBe(1);
  });
  it('has the same escape motion and ending across different time partitions', () => {
    const a = reach(17),
      b = reach(17);
    a.tick(700);
    for (let i = 0; i < 84; i++) b.tick(700 / 84);
    expect(b.actors.sophie.x).toBeCloseTo(a.actors.sophie.x, 8);
    a.tick(3000);
    for (let i = 0; i < 180; i++) b.tick(3000 / 180);
    expect(b.phase).toBe(a.phase);
    expect(b.actors).toEqual(a.actors);
  });
  it.each([
    [960, 540],
    [820, 290],
    [568, 260],
    [320, 540],
  ])(
    'keeps the whole composition inside a %i × %i viewport',
    (width, height) => {
      const f = interludeFrame(width, height);
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.width).toBeLessThanOrEqual(width);
      expect(f.y + f.height).toBeLessThanOrEqual(height);
      expect(f.width / f.height).toBeCloseTo(c.width / c.height);
    },
  );
});
