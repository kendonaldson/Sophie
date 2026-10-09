import { physics } from '../config/physics';
import type { LevelDefinition, Point } from '../levels/types';
import { overlaps, type Rect } from '../player/CollisionAssist';
import { ratTuning } from '../rats/RatMotion';
import { steamState, validateSteamDefinition } from '../steam/SteamCycle';

/** Validate safe waiting areas against complete hazard envelopes, not one frame. */
export function validateMaintenance(level: LevelDefinition): void {
  const d = level.maintenance;
  if (!d) return;
  const fail = (reason: string): never => {
    throw new Error(`Invalid maintenance level "${level.id}": ${reason}`);
  };
  const bodyWidth = 64 - physics.collisionInsetX * 2;
  const bodyHeight =
    64 - physics.collisionInsetTop - physics.collisionInsetBottom;
  const finitePoint = (p: Point) =>
    Number.isFinite(p.x) && Number.isFinite(p.y);
  const finiteRect = (r: Rect) =>
    finitePoint(r) &&
    Number.isFinite(r.width) &&
    r.width > 0 &&
    Number.isFinite(r.height) &&
    r.height > 0;
  const body = (p: Point): Rect => ({
    x: p.x - bodyWidth / 2,
    y: p.y - bodyHeight,
    width: bodyWidth,
    height: bodyHeight,
  });
  const floors = level.platforms
    .filter((p) => p.style === 'maintenance')
    .sort((a, b) => a.x - b.x);
  if (!floors.length) fail('missing static maintenance floor');
  const supported = (area: Rect, feetY: number) =>
    floors.some(
      (floor) =>
        Math.abs(floor.y - feetY) < 1 &&
        area.x >= floor.x &&
        area.x + area.width <= floor.x + floor.width,
    );
  const ratEnvelopes = d.rats.map((rat) => {
    if (
      !rat.id ||
      ![rat.left, rat.right, rat.floorY, rat.speed, rat.offset].every(
        Number.isFinite,
      ) ||
      rat.left >= rat.right ||
      rat.speed <= 0 ||
      rat.offset < 0 ||
      ![-1, 1].includes(rat.direction)
    )
      fail(`invalid rat ${rat.id}`);
    const envelope = {
      x: rat.left - ratTuning.bodyWidth / 2,
      y: rat.floorY - ratTuning.bodyHeight,
      width: rat.right - rat.left + ratTuning.bodyWidth,
      height: ratTuning.bodyHeight,
    };
    if (
      !supported(envelope, rat.floorY) ||
      level.platforms.some((p) => overlaps(envelope, p))
    )
      fail(`rat ${rat.id} must patrol clear static floor`);
    return envelope;
  });
  const steamEnvelopes = d.steam.map((steam) => {
    validateSteamDefinition(steam);
    const bounds = steamState(steam, 0).bounds;
    if (
      bounds.x < 0 ||
      bounds.x + bounds.width > level.width ||
      bounds.y < 0 ||
      steam.floorY >= level.fallY
    )
      fail(`steam ${steam.id} is out of bounds`);
    return bounds;
  });
  const hazardIds = [...d.rats, ...d.steam].map((hazard) => hazard.id);
  if (new Set(hazardIds).size !== hazardIds.length)
    fail('hazard IDs must be unique');
  const hazards = [...ratEnvelopes, ...steamEnvelopes];
  const safe = (area: Rect, feetY: number) =>
    supported(area, feetY) &&
    !level.platforms.some((p) => overlaps(area, p)) &&
    !hazards.some((hazard) => overlaps(area, hazard));

  for (const actor of [level.playerSpawn, level.companionSpawn])
    if (!actor || !finitePoint(actor) || !safe(body(actor), actor.y))
      fail('unsafe entry actor');
  for (const [index, cp] of level.checkpoints.entries()) {
    if (
      !finitePoint(cp.spawn) ||
      !finiteRect(cp.area) ||
      cp.spawn.x < cp.area.x ||
      cp.spawn.x > cp.area.x + cp.area.width ||
      cp.spawn.y < cp.area.y ||
      cp.spawn.y > cp.area.y + cp.area.height ||
      (index > 0 && cp.spawn.x <= level.checkpoints[index - 1]!.spawn.x)
    )
      fail(`invalid checkpoint order or area ${cp.id}`);
    const runway = {
      x: cp.area.x - bodyWidth / 2,
      y: cp.spawn.y - bodyHeight,
      width: cp.area.width + bodyWidth,
      height: bodyHeight,
    };
    if (!safe(runway, cp.spawn.y)) fail(`unsafe checkpoint ${cp.id}`);
  }
  if (
    d.challenges.length !== level.checkpoints.length ||
    !d.challenges.length ||
    d.challenges.some(
      (challenge, index) =>
        challenge.checkpoint !== level.checkpoints[index]!.id,
    )
  )
    fail('challenges must follow checkpoint order');
  const treats = d.challenges.flatMap((challenge) => challenge.treats);
  if (
    treats.length !== level.treats.length ||
    new Set(treats).size !== treats.length ||
    treats.some((id) => !level.treats.some((treat) => treat.id === id))
  )
    fail('treats must belong to exactly one challenge');
  for (const [index, challenge] of d.challenges.entries())
    for (const id of challenge.treats) {
      const treat = level.treats.find((t) => t.id === id)!;
      if (
        treat.x <= level.checkpoints[index]!.spawn.x ||
        treat.x >= (level.checkpoints[index + 1]?.spawn.x ?? level.width)
      )
        fail(`treat ${id} is outside its challenge`);
    }

  const gaps: { x: number; right: number; upperY: number; lowerY: number }[] =
    [];
  for (let index = 1; index < floors.length; index++) {
    const left = floors[index - 1]!,
      right = floors[index]!;
    const edge = left.x + left.width;
    if (right.x < edge) fail('maintenance floors overlap');
    if (right.x > edge)
      gaps.push({
        x: edge,
        right: right.x,
        upperY: Math.min(left.y, right.y),
        lowerY: Math.max(left.y, right.y),
      });
  }
  const inGap = (steam: (typeof d.steam)[number], gap: (typeof gaps)[number]) =>
    steam.x >= gap.x &&
    steam.x + steam.width <= gap.right &&
    steam.floorY >= gap.upperY &&
    steam.floorY <= gap.lowerY;
  if (d.steam.some((steam) => !gaps.some((gap) => inGap(steam, gap))))
    fail('steam must stay inside a furnace gap');
  for (const gap of gaps) {
    let covered = gap.x;
    for (const steam of d.steam
      .filter((steam) => inGap(steam, gap))
      .sort((a, b) => a.x - b.x)) {
      if (steam.x > covered)
        fail('every furnace gap must have steam across its opening');
      covered = Math.max(covered, steam.x + steam.width);
    }
    if (covered < gap.right)
      fail('every furnace gap must have steam across its opening');
  }

  const { majorView: view, destination: exit } = d;
  if (
    ![view.fromX, view.toX, view.left, view.width].every(Number.isFinite) ||
    view.fromX < 0 ||
    view.fromX >= view.toX ||
    view.toX > level.width ||
    view.left < 0 ||
    view.width <= 0 ||
    view.left + view.width > level.width
  )
    fail('invalid major crossing view');
  if (
    !finiteRect(exit.hatch) ||
    !finitePoint(exit.sophie) ||
    !finitePoint(exit.jimmy) ||
    !Number.isFinite(exit.triggerX) ||
    exit.triggerX <= level.checkpoints.at(-1)!.spawn.x ||
    exit.triggerX >= exit.hatch.x ||
    exit.sophie.x >= exit.hatch.x ||
    exit.jimmy.x >= exit.hatch.x ||
    exit.sophie.y !== exit.jimmy.y ||
    exit.hatch.y + exit.hatch.height !== exit.sophie.y ||
    exit.hatch.width < bodyWidth ||
    exit.hatch.height < bodyHeight
  )
    fail('invalid maintenance exit');
  const exitLeft =
    Math.min(exit.triggerX, exit.sophie.x, exit.jimmy.x) - bodyWidth / 2;
  if (
    !safe(
      {
        x: exitLeft,
        y: exit.sophie.y - bodyHeight,
        width: exit.hatch.x + exit.hatch.width - exitLeft,
        height: bodyHeight,
      },
      exit.sophie.y,
    )
  )
    fail('exit actors and hatch require clear static floor');
}
