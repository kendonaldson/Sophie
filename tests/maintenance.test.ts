import { describe, expect, it } from 'vitest';
import { maintenance } from '../src/game/levels/maintenance';
import type { LevelDefinition } from '../src/game/levels/types';
import { validateMaintenance } from '../src/game/maintenance/validate';
import { SteamField } from '../src/game/steam/SteamField';

describe('maintenance tunnel data and safe checkpoints', () => {
  it('has stable hazard-free checkpoints and resets all steam to a clear starting window', () => {
    expect(() => validateMaintenance(maintenance)).not.toThrow();
    const steam = new SteamField(maintenance.maintenance!.steam);
    const initial = steam.snapshot();
    expect(initial.every((vent) => vent.phase === 'clear')).toBe(true);
    const first = maintenance.maintenance!.steam[0]!;
    steam.step(
      first.clearMs + first.warningMs + first.hissMs - (first.phaseMs ?? 0),
    );
    expect(steam.snapshot()[0]!.active).toBe(true);
    steam.reset();
    expect(steam.snapshot()).toEqual(initial);
  });

  const invalidCases: [string, (level: LevelDefinition) => void][] = [
    [
      'rat without a finite speed',
      (level) => {
        level.maintenance!.rats[0]!.speed = NaN;
      },
    ],
    [
      'rat walking over a furnace',
      (level) => {
        Object.assign(level.maintenance!.rats[0]!, { left: 2050, right: 2250 });
      },
    ],
    [
      'rat crossing a pipe',
      (level) => {
        Object.assign(level.maintenance!.rats[0]!, { left: 1350, right: 1550 });
      },
    ],
    [
      'checkpoint reached by a later rat patrol',
      (level) => {
        const left = level.checkpoints[1]!.spawn.x + 40;
        Object.assign(level.maintenance!.rats[0]!, {
          left,
          right: left + 40,
          offset: 40,
        });
      },
    ],
    [
      'checkpoint above a furnace',
      (level) => {
        level.checkpoints[2]!.spawn.x = 2190;
        level.checkpoints[2]!.area.x = 2146;
      },
    ],
    [
      'checkpoint on a pipe',
      (level) => {
        Object.assign(level.checkpoints[0]!, {
          spawn: { x: 667, y: 474 },
          area: { x: 656, y: 468, width: 22, height: 16 },
        });
      },
    ],
    [
      'reversed checkpoint progression',
      (level) => {
        level.checkpoints.reverse();
      },
    ],
    [
      'missing challenge',
      (level) => {
        level.maintenance!.challenges.pop();
      },
    ],
    [
      'challenge order mismatch',
      (level) => {
        level.maintenance!.challenges.reverse();
      },
    ],
    [
      'unassigned treat',
      (level) => {
        level.maintenance!.challenges[6]!.treats.pop();
      },
    ],
    [
      'duplicate treat ownership',
      (level) => {
        level.maintenance!.challenges[5]!.treats.push('furnace-chain-one');
      },
    ],
    [
      'treat assigned to an earlier challenge',
      (level) => {
        level.maintenance!.challenges[5]!.treats =
          level.maintenance!.challenges[6]!.treats;
        level.maintenance!.challenges[6]!.treats = [];
      },
    ],
    [
      'furnace without steam',
      (level) => {
        level.maintenance!.steam.pop();
      },
    ],
    [
      'steam missing its warning',
      (level) => {
        level.maintenance!.steam[0]!.warningMs = 0;
      },
    ],
    [
      'steam overlapping safe floor',
      (level) => {
        level.maintenance!.steam[0]!.x -= 10;
      },
    ],
    [
      'partially uncovered furnace',
      (level) => {
        level.maintenance!.steam[0]!.width -= 10;
      },
    ],
    [
      'unsafe exit actor',
      (level) => {
        level.maintenance!.destination.jimmy.x = 8700;
      },
    ],
    [
      'hatch beyond the floor',
      (level) => {
        level.maintenance!.destination.hatch.x = 9750;
      },
    ],
    [
      'rat at the scripted exit',
      (level) => {
        Object.assign(level.maintenance!.rats[0]!, { left: 9430, right: 9550 });
      },
    ],
  ];
  it.each(invalidCases)('rejects %s', (_name, mutate) => {
    const level = structuredClone(maintenance);
    mutate(level);
    expect(() => validateMaintenance(level)).toThrow();
  });

  it('allows multiple adjoining vents to cover a wide furnace', () => {
    const level = structuredClone(maintenance);
    const first = level.maintenance!.steam[0]!;
    const width = first.width / 2;
    first.width = width;
    level.maintenance!.steam.push({
      ...first,
      id: 'second-vent',
      x: first.x + width,
    });
    expect(() => validateMaintenance(level)).not.toThrow();
  });
});
