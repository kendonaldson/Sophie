import type { LevelDefinition, Point } from '../levels/types';
export function validateSkyscraper(
  level: LevelDefinition,
  safe: (p: Point) => boolean,
  fail: (reason: string) => never,
) {
  const s = level.skyscraper!;
  const positive = (n: number) => Number.isFinite(n) && n > 0;
  if (
    !level.companionSpawn ||
    !safe(level.companionSpawn) ||
    !safe(s.arrival.sophie) ||
    !safe(s.arrival.jimmy) ||
    s.sections.length !== 3 ||
    s.lifts.length !== 3 ||
    s.challenges.length !== level.checkpoints.length
  )
    fail('invalid skyscraper structure');
  for (const [i, section] of s.sections.entries())
    if (
      !positive(section.bottom) ||
      section.bottom > level.fallY ||
      section.direction !== (i === 1 ? -1 : 1) ||
      (i && section.bottom >= s.sections[i - 1]!.bottom)
    )
      fail('invalid skyscraper section');
  for (const [i, challenge] of s.challenges.entries())
    if (
      challenge.checkpoint !== level.checkpoints[i]!.id ||
      !s.sections[challenge.section] ||
      (i && challenge.section < s.challenges[i - 1]!.section) ||
      challenge.treats.some((id) => !level.treats.some((t) => t.id === id))
    )
      fail('invalid skyscraper challenge');
  const treats = s.challenges.flatMap((c) => c.treats);
  if (
    new Set(treats).size !== level.treats.length ||
    treats.length !== level.treats.length
  )
    fail('skyscraper treats must belong to one challenge');
  for (const lift of s.lifts)
    if (
      ![lift.width, lift.rideMs, lift.bottomY, lift.topY].every(positive) ||
      !Number.isFinite(lift.x) ||
      lift.topY >= lift.bottomY ||
      lift.x < 0 ||
      lift.x + lift.width > level.width ||
      (lift.destination &&
        !s.challenges.some((c) => c.checkpoint === lift.destination))
    )
      fail('invalid construction lift');
  for (const b of s.birds)
    if (
      ![b.speed, b.frequency].every(positive) ||
      ![b.left, b.right, b.baseY, b.amplitude, b.phase, b.offset].every(
        Number.isFinite,
      ) ||
      b.left < 0 ||
      b.right > level.width ||
      b.right <= b.left ||
      b.amplitude < 0 ||
      b.baseY - b.amplitude < 0 ||
      b.baseY + b.amplitude > level.fallY ||
      ![-1, 1].includes(b.direction)
    )
      fail('invalid bird');
}
