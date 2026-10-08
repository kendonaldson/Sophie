import Phaser from 'phaser';
import { platformPosition, standingOn } from './PlatformMotion';
import type { LevelDefinition, Point } from '../levels/types';
import type { Rect } from '../player/CollisionAssist';
import { overlaps } from '../player/CollisionAssist';
import type { Player } from '../player/Player';
interface Surface extends Rect {
  id: string;
  zone: Phaser.GameObjects.Zone;
  velocity: Point;
  dip: number;
}
/** Kinematic solids advance once per fixed simulation step, before actors integrate. */
export class Machinery {
  readonly group: Phaser.Physics.Arcade.StaticGroup;
  readonly surfaces: Surface[] = [];
  readonly solids: Rect[];
  elapsed = 0;
  elevatorState: 'waiting' | 'closing' | 'riding' | 'opening' | 'arrived' =
    'waiting';
  elevatorMs = 0;
  readonly gates: {
    definition: NonNullable<LevelDefinition['shutters']>[number];
    zone: Phaser.GameObjects.Zone;
    open: boolean;
  }[] = [];
  private support = new Map<Player, Point>();
  private elevator?: Surface;
  private cabinLeft?: Phaser.GameObjects.Zone;
  private cabinRight?: Phaser.GameObjects.Zone;
  constructor(
    private readonly scene: Phaser.Scene,
    readonly level: LevelDefinition,
  ) {
    this.group = scene.physics.add.staticGroup();
    this.solids = [...level.platforms];
    for (const p of level.movingPlatforms ?? [])
      this.surfaces.push(
        this.makeSurface(p.id, platformPosition(p, 0), p.width, p.height),
      );
    for (const lift of level.skyscraper?.lifts ?? [])
      this.surfaces.push(
        this.makeSurface(
          lift.id,
          { x: lift.x, y: lift.bottomY },
          lift.width,
          20,
        ),
      );
    if (level.elevator) {
      const e = level.elevator;
      this.elevator = this.makeSurface(
        e.id,
        { x: e.x, y: e.bottomY },
        e.width,
        24,
      );
      this.surfaces.push(this.elevator);
      this.cabinLeft = this.makeZone(e.x - 12, e.bottomY - 160, 12, 160);
      this.cabinRight = this.makeZone(e.x + e.width, e.bottomY - 160, 12, 160);
      (this.cabinLeft.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      (this.cabinRight.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    }
    for (const g of level.shutters ?? [])
      this.gates.push({
        definition: g,
        zone: this.makeZone(g.x, g.y, g.width, g.height),
        open: false,
      });
  }
  private makeZone(x: number, y: number, w: number, h: number) {
    const zone = this.scene.add.zone(x + w / 2, y + h / 2, w, h);
    this.scene.physics.add.existing(zone, true);
    this.group.add(zone);
    return zone;
  }
  private makeSurface(
    id: string,
    at: Point,
    width: number,
    height: number,
  ): Surface {
    const s = {
      id,
      ...at,
      width,
      height,
      zone: this.makeZone(at.x, at.y, width, height),
      velocity: { x: 0, y: 0 },
      dip: 0,
    };
    this.solids.push(s);
    return s;
  }
  private move(s: Surface, at: Point, ms: number, actors: Player[]) {
    const riders = actors.filter((a) =>
      standingOn(a.body, s, a.body.velocity.y),
    );
    const dx = at.x - s.x,
      dy = at.y - s.y;
    // Zero elapsed time denotes a reset, not a physical sweep or launch impulse.
    s.velocity =
      ms > 0 ? { x: (dx * 1000) / ms, y: (dy * 1000) / ms } : { x: 0, y: 0 };
    for (const a of riders) {
      a.translate(dx, dy);
      this.support.set(a, s.velocity);
    }
    s.x = at.x;
    s.y = at.y;
    s.zone.setPosition(s.x + s.width / 2, s.y + s.height / 2);
    (s.zone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    // A purely visual weight dip: never changes collision geometry.
    if (!ms) s.dip = 0;
    else
      s.dip +=
        ((riders.length > 1 ? 3 : riders.length ? 1 : 0) - s.dip) *
        Math.min(1, ms / 100);
  }
  step(ms: number, actors: Player[]) {
    this.elapsed += ms;
    this.support.clear();
    for (const def of this.level.movingPlatforms ?? [])
      this.move(
        this.surfaces.find((s) => s.id === def.id)!,
        platformPosition(def, this.elapsed),
        ms,
        actors,
      );
    for (const belt of this.level.conveyors ?? []) {
      const p = this.level.platforms.find((p) => p.id === belt.platformId)!;
      for (const actor of actors)
        if (standingOn(actor.body, p, actor.body.velocity.y)) {
          actor.translate((belt.speed * ms) / 1000, 0);
          this.support.set(actor, { x: belt.speed, y: 0 });
        }
    }
    for (const gate of this.gates) {
      const g = gate.definition;
      const scheduledOpen =
        (this.elapsed + (g.phaseMs ?? 0)) % g.periodMs < g.openMs;
      // Loading-door safety sensor: never close a solid through either dog.
      gate.open = scheduledOpen || actors.some((a) => overlaps(a.body, g));
      (gate.zone.body as Phaser.Physics.Arcade.StaticBody).enable = !gate.open;
    }
    if (this.elevator && this.level.elevator) this.stepElevator(ms, actors);
  }
  private stepElevator(ms: number, actors: Player[]) {
    const e = this.level.elevator!,
      s = this.elevator!,
      sophie = actors[0]!;
    if (
      this.elevatorState === 'waiting' &&
      standingOn(sophie.body, s, sophie.body.velocity.y) &&
      sophie.feet.x > e.x + 60
    ) {
      this.elevatorState = 'closing';
      this.elevatorMs = 0;
    }
    if (this.elevatorState === 'waiting' || this.elevatorState === 'arrived')
      return;
    this.elevatorMs += ms;
    if (this.elevatorState === 'closing' && this.elevatorMs >= 900) {
      this.elevatorState = 'riding';
      this.elevatorMs = 0;
    }
    if (this.elevatorState === 'riding' && this.elevatorMs >= e.rideMs) {
      this.elevatorState = 'opening';
      this.elevatorMs = 0;
    }
    if (this.elevatorState === 'opening' && this.elevatorMs >= 900)
      this.elevatorState = 'arrived';
    const t =
      this.elevatorState === 'closing'
        ? 0
        : this.elevatorState === 'riding'
          ? Math.min(1, this.elevatorMs / e.rideMs)
          : 1;
    const smooth = t * t * (3 - 2 * t);
    this.move(
      s,
      { x: e.x, y: e.bottomY + (e.topY - e.bottomY) * smooth },
      ms,
      actors,
    );
    for (const [zone, x] of [
      [this.cabinLeft!, e.x - 6],
      [this.cabinRight!, e.x + e.width + 6],
    ] as const) {
      zone.setPosition(x, s.y - 80);
      const body = zone.body as Phaser.Physics.Arcade.StaticBody;
      body.updateFromGameObject();
      body.enable =
        this.elevatorState !== 'arrived' &&
        !(zone === this.cabinLeft && this.elevatorState === 'closing');
    }
  }
  transferJump(actor: Player, jumped: boolean) {
    const velocity = this.support.get(actor);
    if (jumped && velocity)
      actor.body.setVelocity(
        actor.body.velocity.x + velocity.x,
        actor.body.velocity.y + velocity.y,
      );
  }
  moveConstructionLift(id: string, y: number, ms: number, actors: Player[]) {
    const surface = this.surfaces.find((s) => s.id === id);
    if (!surface) throw new Error(`Unknown lift ${id}`);
    this.move(surface, { x: surface.x, y }, ms, actors);
  }
  resetMotion() {
    this.elapsed = 0;
    this.support.clear();
    for (const def of this.level.movingPlatforms ?? [])
      this.move(
        this.surfaces.find((s) => s.id === def.id)!,
        platformPosition(def, 0),
        0,
        [],
      );
  }
  get elevatorSurface() {
    return this.elevator;
  }
  waitingAtGate(actor: Player) {
    const gate = this.gates.find(
      (g) =>
        !g.open &&
        actor.body.right >= g.definition.x - 3 &&
        actor.body.x < g.definition.x &&
        actor.body.bottom > g.definition.y,
    );
    return gate ? gate.definition.x + gate.definition.width + 20 : undefined;
  }
  reset(point: Point) {
    if (!this.elevator || !this.level.elevator) return;
    const e = this.level.elevator;
    this.elevatorState = point.x >= e.x + e.width ? 'arrived' : 'waiting';
    this.elevatorMs = 0;
    this.move(
      this.elevator,
      { x: e.x, y: this.elevatorState === 'arrived' ? e.topY : e.bottomY },
      1,
      [],
    );
    (this.cabinLeft!.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    (this.cabinRight!.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }
  snapshot() {
    return this.surfaces.map(({ id, x, y, velocity }) => ({
      id,
      x,
      y,
      vx: velocity.x,
      vy: velocity.y,
    }));
  }
}
