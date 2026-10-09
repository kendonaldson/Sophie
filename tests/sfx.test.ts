import { describe, expect, it, vi } from 'vitest';
import { Sfx } from '../src/game/audio/Sfx';
import {
  clampVolume,
  dialoguePitch,
  sfxConfig,
} from '../src/game/audio/config';
import { DialogueReveal } from '../src/ui/DialogueReveal';
import { PlayerController } from '../src/game/player/PlayerController';
import { physics } from '../src/game/config/physics';
import { noInput } from '../src/game/input/Input';

class Parameter {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  setValueCurveAtTime = vi.fn();
}
class Node {
  gain = new Parameter();
  frequency = new Parameter();
  Q = new Parameter();
  threshold = new Parameter();
  knee = new Parameter();
  ratio = new Parameter();
  attack = new Parameter();
  release = new Parameter();
  type = '';
  buffer?: AudioBuffer;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
class Context {
  state = 'running';
  currentTime = 0;
  sampleRate = 48000;
  destination = new Node();
  gains: Node[] = [];
  sources: Node[] = [];
  filters: Node[] = [];
  limiter = new Node();
  createGain = () => {
    const node = new Node();
    this.gains.push(node);
    return node;
  };
  createDynamicsCompressor = () => this.limiter;
  createOscillator = () => this.source();
  createBufferSource = () => this.source();
  createBiquadFilter = () => {
    const node = new Node();
    this.filters.push(node);
    return node;
  };
  createBuffer = vi.fn((_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  }));
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  source() {
    const node = new Node();
    this.sources.push(node);
    return node;
  }
  finish() {
    this.sources.forEach((source) => source.onended?.());
  }
}
const setup = (config = structuredClone(sfxConfig)) => {
  const context = new Context();
  const factory = vi.fn(() => context as unknown as AudioContext);
  const sfx = new Sfx(config, factory, () => 0.5);
  return { sfx, context, factory };
};

describe('procedural SFX lifecycle and safety', () => {
  it('creates no context from effects, then reuses one across all effects and gestures', () => {
    const { sfx, context, factory } = setup();
    sfx.jump();
    sfx.dash();
    sfx.dialogueBoop('sophie', 'a');
    expect(factory).not.toHaveBeenCalled();
    sfx.unlockFromGesture();
    sfx.jump();
    sfx.dash();
    sfx.dialogueBoop('jimmy', 'b');
    sfx.unlockFromGesture();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(context.sources).toHaveLength(4);
    sfx.destroy();
    sfx.destroy();
    sfx.jump();
    sfx.unlockFromGesture();
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(
      context.sources.every((node) => node.disconnect.mock.calls.length === 1),
    ).toBe(true);
    expect(
      context.gains.every((node) => node.disconnect.mock.calls.length === 1),
    ).toBe(true);
    expect(context.filters[0]!.disconnect).toHaveBeenCalledOnce();
    expect(context.limiter.disconnect).toHaveBeenCalledOnce();
  });
  it('resumes after gestures, safely retries rejection, and drops suspended sounds', async () => {
    const { sfx, context } = setup();
    context.state = 'suspended';
    context.resume.mockRejectedValueOnce(new Error('denied'));
    sfx.unlockFromGesture();
    sfx.unlockFromGesture();
    sfx.jump();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.sources).toHaveLength(0);
    await Promise.resolve();
    sfx.unlockFromGesture();
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.sources).toHaveLength(0);
    sfx.jump();
    expect(context.sources).toHaveLength(1);
    context.state = 'interrupted';
    sfx.unlockFromGesture();
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(3);
  });
  it('handles unsupported audio, constructor errors, graph errors, and synthesis failures', () => {
    for (const create of [
      () => undefined,
      () => {
        throw new Error('unavailable');
      },
    ]) {
      const sfx = new Sfx(sfxConfig, create);
      expect(() => {
        sfx.unlockFromGesture();
        sfx.jump();
        sfx.dash();
        sfx.dialogueBoop('sophie', 'a');
        sfx.destroy();
      }).not.toThrow();
    }
    const broken = setup();
    broken.context.limiter.connect.mockImplementation(() => {
      throw new Error('graph');
    });
    expect(() => broken.sfx.unlockFromGesture()).not.toThrow();
    expect(broken.context.close).toHaveBeenCalledOnce();
    expect(broken.context.gains[0]!.disconnect).toHaveBeenCalledOnce();
    const { sfx, context } = setup();
    context.createOscillator = () => {
      const source = context.source();
      source.start.mockImplementation(() => {
        throw new Error('start');
      });
      return source;
    };
    sfx.unlockFromGesture();
    expect(() => sfx.jump()).not.toThrow();
    expect(context.sources[0]!.disconnect).toHaveBeenCalledOnce();
    expect(context.gains[1]!.disconnect).toHaveBeenCalledOnce();
  });
  it('ends, disconnects, and bounds overlapping voices; dash reuses its noise buffer', () => {
    const config = structuredClone(sfxConfig);
    config.maxVoices = 2;
    const { sfx, context } = setup(config);
    sfx.unlockFromGesture();
    sfx.jump();
    sfx.dash();
    sfx.jump();
    expect(context.sources).toHaveLength(3);
    expect(context.sources[0]!.stop).toHaveBeenCalledWith(0.11);
    expect(context.sources[1]!.stop).toHaveBeenCalledWith(0.14);
    expect(context.sources[2]!.stop).toHaveBeenCalledWith(0.14);
    expect(context.sources[0]!.type).toBe('square');
    expect(context.sources[0]!.frequency.setValueAtTime).toHaveBeenCalledWith(
      220,
      0,
    );
    expect(
      context.sources[0]!.frequency.exponentialRampToValueAtTime,
    ).toHaveBeenCalledWith(520, 0.11);
    expect(context.filters[0]!.type).toBe('bandpass');
    context.finish();
    expect(context.sources.every((node) => node.onended === null)).toBe(true);
    expect(
      context.sources.every((node) => node.disconnect.mock.calls.length === 1),
    ).toBe(true);
    sfx.dash();
    expect(context.createBuffer).toHaveBeenCalledOnce();
    expect(context.sources).toHaveLength(5);
  });
  it('clamps volume, mutes active sounds, keeps music independent, and reuses audio on re-enable', () => {
    const config = structuredClone(sfxConfig);
    config.masterVolume = 9;
    config.jump.volume = 2;
    config.dash.volume = -1;
    const { sfx, context, factory } = setup(config);
    sfx.unlockFromGesture();
    sfx.jump();
    sfx.dash();
    expect(context.gains[0]!.gain.setValueAtTime).toHaveBeenLastCalledWith(
      1,
      0,
    );
    expect(context.gains[1]!.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1,
      0.003,
    );
    expect(context.sources).toHaveLength(1);
    sfx.setMuted(true);
    sfx.jump();
    expect(context.sources[0]!.disconnect).toHaveBeenCalledOnce();
    expect(context.sources).toHaveLength(1);
    sfx.setMuted(false);
    sfx.setMasterVolume(-3);
    sfx.jump();
    expect(context.gains[0]!.gain.setValueAtTime).toHaveBeenLastCalledWith(
      0,
      0,
    );
    sfx.setMasterVolume(0.3);
    sfx.setEffectVolume('jump', NaN);
    sfx.jump();
    expect(context.sources).toHaveLength(1);
    sfx.setEffectVolume('jump', 0.2);
    sfx.setEnabled(false);
    sfx.jump();
    sfx.setEnabled(true);
    sfx.unlockFromGesture();
    sfx.jump();
    expect(context.sources).toHaveLength(2);
    expect(factory).toHaveBeenCalledOnce();
    expect([NaN, Infinity, -Infinity, -1, 0.5, 2].map(clampVolume)).toEqual([
      0, 0, 0, 0, 0.5, 1,
    ]);
  });
  it('shares a bounded spring voice, accelerates its sweep to the launch peak, and cleans up independently', () => {
    const { sfx, context, factory } = setup();
    const c = sfxConfig.jimmySuperJump;
    sfx.jimmySuperJumpAnticipation();
    sfx.jimmySuperJump();
    expect(factory).not.toHaveBeenCalled();
    sfx.unlockFromGesture();
    sfx.jimmySuperJumpAnticipation();
    const spring = context.sources[0]!;
    expect(spring.type).toBe(c.anticipationWaveform);
    expect(spring.frequency.setValueAtTime).toHaveBeenCalledWith(
      c.anticipationStartFrequency,
      0,
    );
    expect(spring.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      c.anticipationEndFrequency,
      c.anticipationMs / 1000,
    );
    context.currentTime = c.anticipationMs / 1000;
    sfx.jimmySuperJump();
    const launch = context.sources[1]!;
    const [curve, at, duration] = launch.frequency.setValueCurveAtTime.mock
      .calls[0]! as [Float32Array, number, number];
    expect(launch.type).toBe(c.waveform);
    expect(at).toBe(context.currentTime);
    expect(duration).toBeCloseTo(c.launchMs / 1000);
    expect(curve[0]).toBe(c.startFrequency);
    expect(curve[64]).toBe(c.endFrequency);
    expect(curve[32]! - curve[0]!).toBeLessThan(curve[64]! - curve[32]!);
    expect(context.gains[2]!.gain.setValueAtTime).toHaveBeenCalledWith(
      c.volume,
      at + c.launchMs / 1000,
    );
    expect(launch.stop).toHaveBeenCalledWith(
      at + (c.launchMs + c.releaseMs) / 1000,
    );
    sfx.jump();
    sfx.stopDialogue();
    expect(launch.disconnect).not.toHaveBeenCalled();
    sfx.stopJimmySuperJump();
    expect(launch.disconnect).toHaveBeenCalledOnce();
    expect(context.sources[2]!.disconnect).not.toHaveBeenCalled();
    context.finish();
    expect(
      context.sources.every((n) => n.disconnect.mock.calls.length === 1),
    ).toBe(true);
    sfx.setEnabled(false);
    sfx.jimmySuperJumpAnticipation();
    sfx.jimmySuperJump();
    expect(context.sources).toHaveLength(3);
  });
});

it('plays a short shared bird chirp, cleans up, and respects unavailable or disabled audio', () => {
  const { sfx, context, factory } = setup();
  const c = sfxConfig.birdSquawk;
  sfx.birdSquawk();
  expect(factory).not.toHaveBeenCalled();
  sfx.unlockFromGesture();
  sfx.birdSquawk();
  const tone = context.sources[0]!;
  expect(tone.type).toBe(c.waveform);
  expect(tone.frequency.setValueAtTime).toHaveBeenCalledWith(
    c.startFrequency,
    0,
  );
  expect(tone.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
    c.peakFrequency,
    (c.durationMs / 1000) * c.turnAt,
  );
  expect(tone.stop).toHaveBeenCalledWith(c.durationMs / 1000);
  context.finish();
  expect(tone.disconnect).toHaveBeenCalledOnce();
  sfx.setEnabled(false);
  sfx.birdSquawk();
  expect(context.sources).toHaveLength(1);
  expect(factory).toHaveBeenCalledOnce();
});

it('plays a short high rat chirp and soft filtered steam using the shared audio lifecycle', () => {
  const { sfx, context, factory } = setup();
  sfx.ratSqueak();
  sfx.steamHiss();
  sfx.steamBurst();
  expect(factory).not.toHaveBeenCalled();
  sfx.unlockFromGesture();
  sfx.ratSqueak();
  const rat = context.sources[0]!;
  const c = sfxConfig.ratSqueak;
  expect(c.durationMs).toBeGreaterThanOrEqual(60);
  expect(c.durationMs).toBeLessThanOrEqual(120);
  expect(rat.type).toBe('square');
  expect(rat.frequency.setValueAtTime).toHaveBeenCalledWith(
    c.startFrequency,
    0,
  );
  expect(rat.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
    c.peakFrequency,
    (c.durationMs * c.turnAt) / 1000,
  );
  expect(rat.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
    c.endFrequency,
    c.durationMs / 1000,
  );
  expect(rat.stop).toHaveBeenCalledWith(c.durationMs / 1000);
  sfx.steamHiss();
  sfx.steamBurst();
  sfx.dash();
  expect(context.createBuffer).toHaveBeenCalledOnce();
  expect(context.sources[1]!.buffer).toBe(context.sources[2]!.buffer);
  for (const [index, config] of [
    sfxConfig.steamHiss,
    sfxConfig.steamBurst,
  ].entries()) {
    expect(context.filters[index]!.type).toBe('bandpass');
    expect(
      context.filters[index]!.frequency.setValueAtTime,
    ).toHaveBeenCalledWith(config.filterStartFrequency, 0);
    expect(
      context.filters[index]!.frequency.exponentialRampToValueAtTime,
    ).toHaveBeenCalledWith(config.filterEndFrequency, config.durationMs / 1000);
    expect(context.sources[index + 1]!.stop).toHaveBeenCalledWith(
      config.durationMs / 1000,
    );
  }
  context.finish();
  expect(
    context.sources.every((node) => node.disconnect.mock.calls.length === 1),
  ).toBe(true);
  expect(
    context.filters.every((node) => node.disconnect.mock.calls.length === 1),
  ).toBe(true);
  sfx.setMuted(true);
  sfx.ratSqueak();
  sfx.steamHiss();
  sfx.steamBurst();
  expect(context.sources).toHaveLength(5);
  sfx.setMuted(false);
  sfx.setEffectVolume('steamBurst', 0);
  sfx.steamBurst();
  expect(context.sources).toHaveLength(5);
  sfx.setEnabled(false);
  sfx.ratSqueak();
  sfx.steamHiss();
  expect(context.sources).toHaveLength(5);
  expect(factory).toHaveBeenCalledOnce();
});

describe('dialogue reveal and character cadence', () => {
  it('skips spaces/punctuation, rate-limits across characters and speakers, and cancels only dialogue', () => {
    const { sfx, context } = setup();
    sfx.unlockFromGesture();
    sfx.jump();
    for (const char of [' ', '.', '!', '?', '\n', '—', "'"])
      sfx.dialogueBoop('sophie', char);
    expect(context.sources).toHaveLength(1);
    sfx.dialogueBoop('sophie', 'A');
    sfx.dialogueBoop('sophie', 'b');
    context.currentTime = 0.06;
    sfx.dialogueBoop('jimmy', 'c');
    expect(context.sources).toHaveLength(2);
    context.currentTime = 0.08;
    sfx.dialogueBoop('jimmy', 'é');
    expect(context.sources).toHaveLength(3);
    expect(context.sources[1]!.stop).toHaveBeenCalledWith(0.03);
    expect(context.sources[1]!.frequency.setValueAtTime).toHaveBeenCalledWith(
      660,
      0,
    );
    expect(context.sources[2]!.frequency.setValueAtTime).toHaveBeenCalledWith(
      440,
      0.08,
    );
    sfx.stopDialogue();
    expect(context.sources[0]!.disconnect).not.toHaveBeenCalled();
    expect(context.sources[1]!.disconnect).toHaveBeenCalledOnce();
    sfx.dialogueBoop('offscreen', 'a');
    expect(context.sources).toHaveLength(3);
    context.currentTime = 0.18;
    sfx.dialogueBoop('offscreen', 'a');
    expect(context.sources[3]!.frequency.setValueAtTime).toHaveBeenCalledWith(
      330,
      0.18,
    );
  });
  it('varies pitch within distinct data-driven voice ranges', () => {
    const { sophie, jimmy, offscreen } = sfxConfig.dialogue.profiles;
    expect(dialoguePitch(sophie, 0)).toBe(615);
    expect(dialoguePitch(sophie, 1)).toBe(705);
    expect(dialoguePitch(sophie, 0)).toBeGreaterThan(dialoguePitch(jimmy, 1));
    expect(dialoguePitch(jimmy, 0)).toBeGreaterThan(
      dialoguePitch(offscreen, 1),
    );
  });
  it('reveals at the configured pace, skips silent characters, never catches up with a sound backlog', () => {
    const output = { dialogueBoop: vi.fn(), stopDialogue: vi.fn() };
    const reveal = new DialogueReveal(output, 20);
    reveal.set('A .! B?abcdef', 'sophie');
    expect(reveal.tick(10)).toBe('');
    expect(reveal.tick(10)).toBe('A');
    expect(output.dialogueBoop).toHaveBeenCalledWith('sophie', 'A');
    reveal.tick(80);
    expect(output.dialogueBoop).toHaveBeenCalledTimes(1);
    expect(reveal.tick(5000)).toBe('A .! B?abcdef');
    expect(output.dialogueBoop).toHaveBeenCalledTimes(2);
    reveal.tick(10000);
    expect(output.dialogueBoop).toHaveBeenCalledTimes(2);
    reveal.set('Jimmy', 'jimmy');
    reveal.tick(20);
    expect(output.dialogueBoop).toHaveBeenLastCalledWith('jimmy', 'J');
    reveal.set();
    expect(reveal.tick(10000)).toBe('');
    expect(output.dialogueBoop).toHaveBeenCalledTimes(3);
    expect(output.stopDialogue).toHaveBeenCalledTimes(3);
  });
});

describe('movement requests only real SFX events', () => {
  const ground = { vx: 0, vy: 0, grounded: true };
  const air = { ...ground, grounded: false };
  const jump = { ...noInput(), jumpPressed: true, jumpHeld: true };
  const dash = { ...noInput(), dashPressed: true, moveX: 1 as const };
  const output = () => ({ jump: vi.fn(), dash: vi.fn() });
  it('sounds once on jump start, never on held, buffered, expired, or failed input', () => {
    const sfx = output(),
      player = new PlayerController(physics, sfx);
    player.step(8, jump, air);
    expect(sfx.jump).not.toHaveBeenCalled();
    player.step(8, noInput(), ground);
    expect(sfx.jump).toHaveBeenCalledOnce();
    for (let i = 0; i < 30; i++)
      player.step(8, { ...noInput(), jumpHeld: true }, air);
    player.step(8, jump, air);
    player.step(200, noInput(), air);
    player.step(8, noInput(), ground);
    expect(sfx.jump).toHaveBeenCalledOnce();
    player.reset();
    player.step(8, jump, ground);
    expect(sfx.jump).toHaveBeenCalledTimes(2);
  });
  it('sounds once for successful dash, is silent during active dash or with zero charges', () => {
    const sfx = output(),
      player = new PlayerController(physics, sfx);
    player.step(8, dash, air);
    player.step(8, dash, air);
    expect(sfx.dash).toHaveBeenCalledOnce();
    player.step(200, noInput(), air);
    player.step(8, dash, air);
    expect(sfx.dash).toHaveBeenCalledOnce();
    player.dash.collectTreat();
    player.step(8, dash, air);
    expect(sfx.dash).toHaveBeenCalledTimes(2);
  });
  it('plays a buffered touch dash only when its charge becomes available', () => {
    const sfx = output(),
      player = new PlayerController(physics, sfx);
    player.dash.charges = 0;
    player.step(8, { ...dash, dashSource: 'touch' }, air);
    expect(sfx.dash).not.toHaveBeenCalled();
    player.dash.collectTreat();
    player.step(8, noInput(), air);
    player.step(8, noInput(), air);
    expect(sfx.dash).toHaveBeenCalledOnce();
  });
  it('disabled or unavailable audio preserves movement results and dash economy', () => {
    const { sfx, factory } = setup();
    sfx.setEnabled(false);
    sfx.unlockFromGesture();
    const player = new PlayerController(physics, sfx),
      silent = new PlayerController(physics);
    expect(player.step(8, jump, ground)).toEqual(silent.step(8, jump, ground));
    expect(player.step(8, dash, air)).toEqual(silent.step(8, dash, air));
    expect(player.dash.charges).toBe(0);
    expect(factory).not.toHaveBeenCalled();
  });
});
