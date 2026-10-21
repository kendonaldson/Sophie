import type { LevelDefinition, Point } from '../levels/types';
import { overlaps } from '../player/CollisionAssist';
import { validateSteamDefinition, steamState } from '../steam/SteamCycle';
import { birdTuning } from '../birds/BirdMotion';
import { ratTuning } from '../rats/RatMotion';

export function validateRace(
  level: LevelDefinition,
  safe: (point: Point) => boolean,
  fail: (reason: string) => never,
) {
  const race = level.race!;
  if (
    !level.companionSpawn ||
    !safe(level.companionSpawn) ||
    race.bands[0]?.fromX !== 0 ||
    race.bands.at(-1)?.toX !== level.width ||
    race.bands.some(
      (band, index) =>
        ![band.fromX, band.toX, band.floorY, band.fallY].every(
          Number.isFinite,
        ) ||
        band.fromX >= band.toX ||
        band.fallY <= band.floorY ||
        band.fallY > level.fallY ||
        (index > 0 && band.fromX !== race.bands[index - 1]!.toX),
    )
  )
    fail('race camera bands must cover a safe continuous route');
  if (level.checkpoints.length < 6)
    fail('race route needs a safe anchor for each major section');
  for (const cp of level.checkpoints) {
    const body = {
      x: cp.spawn.x - 32,
      y: cp.spawn.y - 64,
      width: 64,
      height: 64,
    };
    if (
      level.conveyors?.some((belt) =>
        level.platforms.some(
          (p) => p.id === belt.platformId && overlaps(p, cp.area),
        ),
      ) ||
      race.birds.some((bird) =>
        overlaps(body, {
          x: bird.left - birdTuning.bodyWidth / 2,
          y: bird.baseY - bird.amplitude - birdTuning.bodyHeight / 2,
          width: bird.right - bird.left + birdTuning.bodyWidth,
          height: 2 * bird.amplitude + birdTuning.bodyHeight,
        }),
      ) ||
      race.rats.some((rat) =>
        overlaps(body, {
          x: rat.left - ratTuning.bodyWidth / 2,
          y: rat.floorY - ratTuning.bodyHeight,
          width: rat.right - rat.left + ratTuning.bodyWidth,
          height: ratTuning.bodyHeight,
        }),
      ) ||
      race.steam.some((steam) => overlaps(body, steamState(steam, 0).bounds))
    )
      fail(`race checkpoint ${cp.id} must be clear of full hazard patrols`);
  }
  for (const [index, cp] of level.checkpoints.entries())
    if (index > 0 && cp.spawn.x <= level.checkpoints[index - 1]!.spawn.x)
      fail('race checkpoints must follow the route home');
  for (const bird of race.birds)
    if (
      ![
        bird.left,
        bird.right,
        bird.baseY,
        bird.speed,
        bird.amplitude,
        bird.offset,
      ].every(Number.isFinite) ||
      bird.left >= bird.right ||
      bird.speed <= 0 ||
      bird.amplitude < 0
    )
      fail('invalid race sparrow');
  for (const rat of race.rats)
    if (
      ![rat.left, rat.right, rat.floorY, rat.speed, rat.offset].every(
        Number.isFinite,
      ) ||
      rat.left >= rat.right ||
      rat.speed <= 0
    )
      fail('invalid race rat');
  for (const steam of race.steam) {
    validateSteamDefinition(steam);
    if (steamState(steam, 0).phase !== 'clear')
      fail('race steam must restart in its clear phase');
  }
  if (
    race.pizzas.length < 4 ||
    race.pizzas.length > 5 ||
    race.pizzas.some((pizza) => ![pizza.x, pizza.y].every(Number.isFinite))
  )
    fail('race uses four or five deliberate pizza opportunities');
  const checkpointIds = ['spawn', ...level.checkpoints.map((cp) => cp.id)];
  if (
    race.challenges.length !== checkpointIds.length ||
    race.challenges.some(
      (challenge, index) => challenge.checkpoint !== checkpointIds[index],
    )
  )
    fail('race challenges must match checkpoint order');
  for (const [kind, ids] of [
    ['treats', level.treats.map((treat) => treat.id)],
    ['pizzas', race.pizzas.map((pizza) => pizza.id)],
  ] as const) {
    const mapped = race.challenges.flatMap((challenge) => challenge[kind]);
    if (
      mapped.length !== ids.length ||
      new Set(mapped).size !== mapped.length ||
      ids.some((id) => !mapped.includes(id))
    )
      fail(`race challenges must restore every ${kind} pickup exactly once`);
  }
  const jump = race.superJump;
  const landingCheckpoint = level.checkpoints.find(
    (cp) => cp.id === jump.checkpointId,
  );
  if (
    !safe(jump.staging) ||
    !safe(jump.landing) ||
    !safe(jump.jimmyLanding) ||
    jump.triggerX <= jump.staging.x ||
    jump.triggerX >= jump.runwayEnd ||
    jump.landing.x - jump.runwayEnd < 1500 ||
    !landingCheckpoint ||
    landingCheckpoint.spawn.x !== jump.landing.x ||
    landingCheckpoint.spawn.y !== jump.landing.y ||
    race.pizzas.some(
      (pizza) => pizza.x > jump.runwayEnd && pizza.x < jump.landing.x,
    )
  )
    fail('race Jimmy jump must span an empty gap to a safe balloon checkpoint');
  const destination = race.destination;
  if (
    !safe(destination.sophie) ||
    !safe(destination.jimmy) ||
    !safe(destination.attic) ||
    destination.triggerX > destination.sophie.x ||
    destination.attic.x <= destination.sophie.x + 200 ||
    destination.attic.x > level.width ||
    race.rats.some((rat) => rat.right >= destination.triggerX) ||
    race.birds.some((bird) => bird.right >= destination.triggerX)
  )
    fail(
      'race attic approach must be safe and remain playable after gathering',
    );
  const crowns = [
    ...level.platforms.filter((p) => p.style === 'balloon'),
    ...(level.movingPlatforms ?? []).filter((p) => p.collision === 'top-only'),
  ];
  if (
    crowns.some(
      (p) => p.height !== 8 || p.collision !== 'top-only' || p.width < 160,
    ) ||
    race.variants.length !== crowns.length ||
    crowns.some(
      (p) =>
        race.variants.filter((variant) => variant.platformId === p.id)
          .length !== 1,
    )
  )
    fail('race balloons need broad one-way crowns and matching artwork');
}
