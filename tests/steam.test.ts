import { describe, expect, it, vi } from 'vitest';
import {
  steamCycleMs,
  steamState,
  validateSteamDefinition,
  type SteamDefinition,
} from '../src/game/steam/SteamCycle';
import { SteamField } from '../src/game/steam/SteamField';

const vent: SteamDefinition = {
  id: 'furnace',
  x: 300,
  width: 160,
  floorY: 400,
  height: 220,
  clearMs: 2000,
  warningMs: 600,
  hissMs: 200,
  activeMs: 900,
  dissipateMs: 400,
};
const visible = { x: 0, y: 0, width: 640, height: 420 };
const player = { x: 360, y: 300, width: 30, height: 25 };
const audio = () => ({ steamHiss: vi.fn(), steamBurst: vi.fn() });

describe('deterministic furnace steam', () => {
  it('provides a full visual warning and hiss before becoming dangerous, then dissipates harmlessly', () => {
    const checkpoints = [
      [0, 'clear', false],
      [1999, 'clear', false],
      [2000, 'warning', false],
      [2599, 'warning', false],
      [2600, 'hiss', false],
      [2799, 'hiss', false],
      [2800, 'active', true],
      [3699, 'active', true],
      [3700, 'dissipating', false],
      [4099, 'dissipating', false],
      [4100, 'clear', false],
    ] as const;
    for (const [elapsed, phase, active] of checkpoints) {
      expect(steamState(vent, elapsed)).toMatchObject({ phase, active });
      expect(steamState(vent, elapsed + steamCycleMs(vent) * 50)).toEqual(
        steamState(vent, elapsed),
      );
    }
    expect(steamState(vent, 2300)).toMatchObject({
      progress: 0.5,
      pressure: 0.325,
    });
    expect(steamState(vent, 2700).pressure).toBeCloseTo(0.825);
    expect(steamState(vent, 3900)).toMatchObject({
      progress: 0.5,
      pressure: 0.5,
    });
  });

  it('only collides inside the active plume, without expanding into the adjacent safe floor', () => {
    const field = new SteamField([vent]);
    field.step(2700);
    expect(field.collide(player)).toBe(false);
    field.step(100);
    expect(field.collide(player)).toBe(true);
    for (const body of [
      { ...player, x: 270 },
      { ...player, x: 460 },
      { ...player, y: 155 },
      { ...player, y: 400 },
    ])
      expect(field.collide(body)).toBe(false);
    expect(field.collide({ ...player, x: 271 })).toBe(true);
    expect(field.collide({ ...player, y: 156 })).toBe(true);
    field.step(900);
    expect(field.collide(player)).toBe(false);
  });

  it('keeps the same cycle across time partitions and restores offsets exactly on retry', () => {
    const definitions = [
      vent,
      { ...vent, id: 'next-gap', x: 900, phaseMs: 350 },
    ];
    const coarse = new SteamField(definitions);
    const fine = new SteamField(definitions);
    const initial = coarse.snapshot();
    coarse.step(7400);
    for (let i = 0; i < 740; i++) fine.step(10);
    expect(fine.snapshot()).toEqual(coarse.snapshot());
    expect(coarse.snapshot().map((state) => state.phase)).toEqual([
      'active',
      'active',
    ]);
    coarse.reset();
    expect(coarse.elapsed).toBe(0);
    expect(coarse.snapshot()).toEqual(initial);
    expect(coarse.collide(player)).toBe(false);
    coarse.step(2800);
    expect(coarse.collide(player)).toBe(true);
  });

  it('sounds once at each audible hiss and eruption, with no late sound when entering view', () => {
    const sfx = audio();
    const field = new SteamField([vent], sfx);
    const elsewhere = { ...visible, x: 1000 };
    field.step(2600, elsewhere);
    field.step(100, visible);
    expect(sfx.steamHiss).not.toHaveBeenCalled();
    field.step(100, visible);
    expect(sfx.steamBurst).toHaveBeenCalledOnce();
    field.step(50, visible);
    expect(sfx.steamBurst).toHaveBeenCalledOnce();
    field.reset();
    field.step(2600, visible);
    expect(sfx.steamHiss).toHaveBeenCalledOnce();
    field.step(200, visible);
    expect(sfx.steamBurst).toHaveBeenCalledTimes(2);
    field.step(0, visible);
    expect(sfx.steamBurst).toHaveBeenCalledTimes(2);
  });

  it('does not replay obsolete sounds after a long frame or reset, and ignores invalid elapsed time', () => {
    const sfx = audio();
    const field = new SteamField([vent], sfx);
    field.step(steamCycleMs(vent) * 20 + 2100, visible);
    expect(sfx.steamHiss).not.toHaveBeenCalled();
    expect(sfx.steamBurst).not.toHaveBeenCalled();
    const state = field.snapshot();
    for (const ms of [NaN, Infinity, -100]) field.step(ms, visible);
    expect(field.snapshot()).toEqual(state);
    field.reset();
    expect(sfx.steamBurst).not.toHaveBeenCalled();
  });

  it('rejects invalid geometry and missing phase durations before gameplay', () => {
    for (const invalid of [
      { width: 0 },
      { height: -1 },
      { x: NaN },
      { phaseMs: Infinity },
      { warningMs: 0 },
      { hissMs: -1 },
      { activeMs: Infinity },
    ])
      expect(() => validateSteamDefinition({ ...vent, ...invalid })).toThrow(
        'Invalid steam hazard',
      );
    expect(() => new SteamField([{ ...vent, floorY: NaN }])).toThrow(
      'Invalid steam hazard',
    );
  });
});
