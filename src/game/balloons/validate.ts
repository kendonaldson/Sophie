import type { LevelDefinition, Point } from '../levels/types';
export function validateBalloons(
  level: LevelDefinition,
  safe: (p: Point) => boolean,
  fail: (reason: string) => never,
) {
  const b = level.balloons!;
  if (
    !level.companionSpawn ||
    !safe(level.companionSpawn) ||
    !safe(b.destination.sophie) ||
    !safe(b.destination.jimmy)
  )
    fail('unsafe balloon actors');
  if (
    b.challenges.length !== level.checkpoints.length ||
    b.challenges.some((c, i) => c.checkpoint !== level.checkpoints[i]!.id)
  )
    fail('invalid balloon challenges');
  const treats = b.challenges.flatMap((c) => c.treats);
  if (
    treats.length !== level.treats.length ||
    new Set(treats).size !== treats.length ||
    treats.some((id) => !level.treats.some((t) => t.id === id))
  )
    fail('balloon treats must belong to one challenge');
  const surfaces = [...level.platforms, ...(level.movingPlatforms ?? [])];
  const crowns = surfaces.filter((s) => s.collision === 'top-only');
  if (
    b.variants.length !== crowns.length ||
    new Set(b.variants.map((v) => v.platformId)).size !== crowns.length ||
    crowns.some((s) => s.height > 12) ||
    b.variants.some(
      (v) =>
        !surfaces.some(
          (s) => s.id === v.platformId && s.collision === 'top-only',
        ) ||
        !Number.isInteger(v.palette) ||
        v.palette < 0 ||
        v.palette > 5,
    )
  )
    fail('invalid balloon crown');
  const roof = level.platforms.find((p) => p.id === b.destination.roofId);
  if (
    !roof ||
    b.destination.landingX < roof.x + 32 ||
    b.destination.landingX > roof.x + roof.width - 32
  )
    fail('unsafe pizza landing');
  for (const bird of b.birds)
    if (
      ![
        bird.left,
        bird.right,
        bird.baseY,
        bird.speed,
        bird.amplitude,
        bird.frequency,
        bird.phase,
        bird.offset,
      ].every(Number.isFinite) ||
      bird.right <= bird.left ||
      bird.left < 0 ||
      bird.right > level.width ||
      bird.speed <= 0 ||
      bird.frequency <= 0 ||
      bird.amplitude < 0 ||
      ![-1, 1].includes(bird.direction)
    )
      fail('invalid balloon bird');
}
