import type { Rect } from '../player/CollisionAssist';
export interface Point {
  x: number;
  y: number;
}
export interface PlatformDefinition extends Rect {
  id: string;
  style: 'home' | 'brick' | 'warehouse';
}
export interface TreatDefinition extends Point {
  id: string;
}
export interface CheckpointDefinition {
  id: string;
  area: Rect;
  spawn: Point;
}
export interface TutorialDefinition {
  title: string;
  steps: string[];
}
export interface SectionDefinition {
  fromX: number;
  title: string;
  hint: string;
  tutorial?: TutorialDefinition;
}
export interface LevelDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  fallY: number;
  playerSpawn: Point;
  atticOpening?: Point;
  platforms: PlatformDefinition[];
  treats: TreatDefinition[];
  checkpoints: CheckpointDefinition[];
  sections: SectionDefinition[];
  exit: Rect;
}
export function validateLevel(level: LevelDefinition): void {
  const fail = (reason: string): never => {
    throw new Error(`Invalid level "${level.id}": ${reason}`);
  };
  const pointValid = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y);
  const rectValid = (r: Rect) =>
    pointValid(r) &&
    Number.isFinite(r.width) &&
    Number.isFinite(r.height) &&
    r.width > 0 &&
    r.height > 0;
  if (
    !level.id ||
    !level.name ||
    !Number.isFinite(level.width) ||
    !Number.isFinite(level.height) ||
    level.width <= 0 ||
    level.height <= 0 ||
    !Number.isFinite(level.fallY) ||
    level.fallY > level.height
  )
    fail('invalid bounds');
  if (
    !pointValid(level.playerSpawn) ||
    !rectValid(level.exit) ||
    !level.platforms.length
  )
    fail('missing spawn, exit, or terrain');
  const ids = [...level.platforms, ...level.treats, ...level.checkpoints].map(
    (x) => x.id,
  );
  if (new Set(ids).size !== ids.length || ids.some((id) => !id))
    fail('entity IDs must be unique');
  for (const p of level.platforms)
    if (!rectValid(p) || p.x < 0 || p.x + p.width > level.width)
      fail(`platform ${p.id} is invalid`);
  const safe = (p: Point) =>
    level.platforms.some(
      (s) =>
        Math.abs(s.y - p.y) < 1 && p.x >= s.x + 32 && p.x <= s.x + s.width - 32,
    );
  if (!safe(level.playerSpawn)) fail('spawn must stand on safe terrain');
  for (const cp of level.checkpoints)
    if (
      !rectValid(cp.area) ||
      !pointValid(cp.spawn) ||
      !safe(cp.spawn) ||
      cp.spawn.x < cp.area.x ||
      cp.spawn.x > cp.area.x + cp.area.width ||
      cp.spawn.y < cp.area.y ||
      cp.spawn.y > cp.area.y + cp.area.height
    )
      fail(`unsafe checkpoint ${cp.id}`);
  for (const t of level.treats)
    if (
      !pointValid(t) ||
      t.x < 0 ||
      t.x > level.width ||
      t.y < 0 ||
      t.y >= level.fallY
    )
      fail(`invalid treat ${t.id}`);
  for (let i = 0; i < level.sections.length; i++)
    if (
      !Number.isFinite(level.sections[i]!.fromX) ||
      (i > 0 && level.sections[i]!.fromX <= level.sections[i - 1]!.fromX)
    )
      fail('sections must be ordered');
}
