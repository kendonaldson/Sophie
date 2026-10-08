import { describe, expect, it, vi } from 'vitest';
import {
  gameplayMode,
  type DeviceCapabilities,
} from '../src/ui/mobile/capabilities';
import { CombinedInput } from '../src/game/input/CombinedInput';
import { noInput, type PlayerIntent } from '../src/game/input/Input';
const desktop: DeviceCapabilities = {
  width: 1440,
  height: 900,
  maxTouchPoints: 0,
  coarsePointer: false,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  platform: 'Win32',
  mobileHint: false,
};
describe('mobile capability modes', () => {
  it('keeps ordinary desktops and touchscreen laptops on keyboard only', () => {
    expect(gameplayMode(desktop)).toBe('desktop');
    expect(
      gameplayMode({
        ...desktop,
        maxTouchPoints: 10,
        coarsePointer: true,
        width: 900,
        height: 700,
      }),
    ).toBe('desktop');
  });
  it('never shows rotate UI on a narrow desktop window', () =>
    expect(
      gameplayMode({ ...desktop, width: 390, height: 844, maxTouchPoints: 5 }),
    ).toBe('desktop'));
  it('requires touch even with a mobile user agent', () =>
    expect(
      gameplayMode({
        ...desktop,
        userAgent: 'iPhone',
        width: 844,
        height: 390,
      }),
    ).toBe('desktop'));
  it('detects landscape and portrait phones', () => {
    const phone = {
      ...desktop,
      userAgent: 'iPhone',
      maxTouchPoints: 5,
      coarsePointer: true,
    };
    expect(gameplayMode({ ...phone, width: 844, height: 390 })).toBe(
      'mobile-landscape',
    );
    expect(gameplayMode({ ...phone, width: 390, height: 844 })).toBe(
      'mobile-portrait',
    );
  });
  it('recognizes Android tablets and iPad desktop-mode Safari', () => {
    expect(
      gameplayMode({
        ...desktop,
        userAgent: 'Android tablet',
        maxTouchPoints: 5,
        width: 1180,
        height: 820,
      }),
    ).toBe('mobile-landscape');
    expect(
      gameplayMode({
        ...desktop,
        userAgent: 'Macintosh',
        platform: 'MacIntel',
        maxTouchPoints: 5,
        coarsePointer: true,
        width: 1024,
        height: 1366,
      }),
    ).toBe('mobile-portrait');
  });
  it('retains mobile controls with keyboard/mouse connected to an identified phone', () =>
    expect(
      gameplayMode({
        ...desktop,
        userAgent: 'Android Mobile',
        maxTouchPoints: 5,
        coarsePointer: false,
        width: 844,
        height: 390,
      }),
    ).toBe('mobile-landscape'));
});
const source = (input: Partial<PlayerIntent>) => ({
  sample: () => ({ ...noInput(), ...input }),
  clear: vi.fn(),
  destroy: vi.fn(),
});
describe('combined input', () => {
  it('retains keyboard input with idle touch controls', () => {
    const keys = source({
        moveX: 1,
        jumpHeld: true,
        jumpPressed: true,
        dashPressed: true,
      }),
      touch = source({});
    expect(new CombinedInput(keys, touch).sample()).toEqual(keys.sample());
  });
  it('supports simultaneous touch direction and keyboard actions', () => {
    const input = new CombinedInput(
      source({ jumpPressed: true, jumpHeld: true }),
      source({ moveX: 1, aimY: -1, dashPressed: true }),
    ).sample();
    expect(input).toEqual({
      moveX: 1,
      aimY: -1,
      jumpPressed: true,
      jumpHeld: true,
      dashPressed: true,
      dashSource: 'touch',
    });
  });
  it('marks touch jumps without changing an attached keyboard dash', () => {
    const input = new CombinedInput(
      source({ dashPressed: true }),
      source({ jumpPressed: true, jumpHeld: true }),
    ).sample();
    expect(input.jumpSource).toBe('touch');
    expect(input.dashSource).toBeUndefined();
  });
  it('clears and disposes both input sources', () => {
    const keys = source({}),
      touch = source({}),
      input = new CombinedInput(keys, touch);
    input.clear();
    input.destroy();
    for (const s of [keys, touch]) {
      expect(s.clear).toHaveBeenCalledOnce();
      expect(s.destroy).toHaveBeenCalledOnce();
    }
  });
});
