import type Phaser from 'phaser';
import type { LevelDefinition, Point } from '../levels/types';
import type { Player } from '../player/Player';
import type { Jimmy } from '../companion/Jimmy';
import type { Machinery } from '../machinery/Machinery';
import { standingOn } from '../machinery/PlatformMotion';
import type { Checkpoints } from '../levels/Checkpoints';
import type { DogTreat } from '../entities/DogTreat';
import type { SfxOutput } from '../audio/Sfx';
import type { Hud } from '../../ui/Hud';
import { BirdFlock } from '../birds/BirdFlock';
import { ClimbProgress } from './ClimbProgress';
import { ConstructionLift } from './ConstructionLift';
import { VerticalView } from './VerticalView';
import { climbTuning as t } from './config';
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** Owns only the climb's progression and scripted staging; ordinary input/physics stay shared. */
export class SkyscraperRun {
  readonly progress: ClimbProgress;
  readonly birds: BirdFlock;
  readonly view: VerticalView;
  arrivalMs = t.arrivalMs as number;
  ride?: ConstructionLift;
  complete = false;
  private boarding?: { sophie: Point; jimmy: Point };
  private readonly def;
  private readonly background;
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDefinition,
    private readonly sophie: Player,
    private readonly jimmy: Jimmy,
    private readonly machinery: Machinery,
    private readonly checkpoints: Checkpoints,
    private readonly treats: DogTreat[],
    private readonly hud: Hud,
    private readonly sfx: SfxOutput,
  ) {
    this.def = level.skyscraper!;
    this.background = scene.game.config.backgroundColor.clone();
    scene.game.config.backgroundColor.setTo(23, 44, 58);
    this.progress = new ClimbProgress(this.def);
    this.birds = new BirdFlock(scene, this.def.birds);
    this.view = new VerticalView(level.width);
    this.view.reset(level.playerSpawn, this.progress.section.bottom, 1);
    this.jimmy.enabled = true;
    this.placeArrival();
    this.present(0);
  }
  get scripted() {
    return this.arrivalMs > 0 || Boolean(this.ride) || this.complete;
  }
  get fallBoundary() {
    return this.progress.fallBoundary(this.checkpoints.spawn.y);
  }
  private placeArrival() {
    const p = 1 - this.arrivalMs / t.arrivalMs;
    // A quick upward continuation with a small arc over the first scaffold lip.
    const height = t.arrivalRise * (1 - p) ** 2 - 100 * Math.sin(Math.PI * p);
    for (const [name, actor] of [
      ['sophie', this.sophie],
      ['jimmy', this.jimmy.actor],
    ] as const) {
      const target = this.def.arrival[name];
      actor.place({ x: target.x - 22 * (1 - p), y: target.y + height });
      actor.sprite.anims.stop();
      actor.sprite
        .setScale(1)
        .setFlipX(false)
        .setFrame(name === 'sophie' ? 27 : 26);
    }
  }
  stepScript(ms: number) {
    if (this.arrivalMs > 0) {
      this.arrivalMs = Math.max(0, this.arrivalMs - ms);
      this.placeArrival();
      if (!this.arrivalMs) {
        this.sophie.respawn(this.level.playerSpawn);
        this.jimmy.reconcile(this.level.playerSpawn);
        this.checkpoints.update(this.sophie.feet, true);
      }
      return true;
    }
    const ride = this.ride;
    if (!ride) return this.complete;
    ride.step(ms);
    const def = ride.definition,
      p = Math.min(1, ride.elapsed / t.boardingMs);
    this.machinery.moveConstructionLift(def.id, ride.y, ms, [
      this.sophie,
      this.jimmy.actor,
    ]);
    for (const [name, actor, fraction] of [
      ['sophie', this.sophie, 0.65],
      ['jimmy', this.jimmy.actor, 0.34],
    ] as const) {
      const from = this.boarding![name];
      actor.place({
        x: lerp(from.x, def.x + def.width * fraction, p),
        y: lerp(from.y, ride.y, p),
      });
      actor.sprite
        .setAlpha(1)
        .setScale(1)
        .setFlipX(this.progress.section.direction === -1);
      actor.sprite.play(
        `${name === 'jimmy' ? 'jimmy-' : ''}${ride.phase === 'boarding' ? 'walk' : name === 'jimmy' && !def.destination ? 'sit' : 'idle'}`,
        true,
      );
    }
    if (ride.phase === 'arrived') {
      this.machinery.moveConstructionLift(def.id, def.topY, 0, []);
      this.checkpoints.restore(def.destination!);
      this.progress.atCheckpoint(def.destination!);
      this.ride = undefined;
      this.jimmy.enabled = true;
      this.jimmy.history.reset();
      this.sophie.controller.clearBufferedInput();
      this.jimmy.actor.controller.clearBufferedInput();
    } else if (!def.destination) {
      this.hud.setFade(ride.fade);
      if (ride.phase === 'complete') this.complete = true;
    }
    return true;
  }
  afterStep(ms: number) {
    this.progress.atCheckpoint(this.checkpoints.id);
    this.birds.step(ms);
    if (
      this.progress.current.section === 2 &&
      this.birds.collide(this.sophie.body)
    ) {
      this.sfx.birdSquawk();
      return true;
    }
    const direction = this.progress.section.direction;
    this.jimmy.afterStep(
      ms,
      this.sophie,
      this.checkpoints.spawn,
      undefined,
      direction,
    );
    const j = this.jimmy.actor.feet,
      s = this.sophie.feet;
    if (
      j.y > this.fallBoundary ||
      (this.sophie.grounded &&
        (j.y - s.y > t.companionVerticalSeparation ||
          Math.abs(j.x - s.x) > t.companionSeparation))
    ) {
      this.jimmy.reconcile(
        this.sophie.grounded ? s : this.checkpoints.spawn,
        direction,
      );
      this.jimmy.recoveries++;
    }
    const def = this.def.lifts[this.progress.current.section]!;
    const surface = this.machinery.surfaces.find((s) => s.id === def.id)!;
    if (
      standingOn(this.sophie.body, surface, this.sophie.body.velocity.y) &&
      s.x > def.x + 32 &&
      s.x < def.x + def.width - 32 &&
      Math.abs(surface.y - def.bottomY) < 1
    ) {
      if (Math.abs(j.x - s.x) > 230 || Math.abs(j.y - s.y) > 90) {
        this.jimmy.reconcile({ x: def.x + 65, y: def.bottomY }, direction);
        this.jimmy.recoveries++;
      }
      this.boarding = { sophie: { ...s }, jimmy: { ...this.jimmy.actor.feet } };
      this.ride = new ConstructionLift(def);
      this.jimmy.history.reset();
    }
    return s.y > this.fallBoundary;
  }
  reset() {
    this.arrivalMs = 0;
    this.ride = undefined;
    this.complete = false;
    this.progress.atCheckpoint(this.checkpoints.id);
    this.sophie.respawn(this.checkpoints.spawn);
    this.jimmy.reconcile(
      this.checkpoints.spawn,
      this.progress.section.direction,
    );
    this.jimmy.enabled = true;
    this.machinery.resetMotion();
    this.birds.reset();
    const reset = this.progress.resetTreats;
    for (const treat of this.treats)
      if (reset.has(treat.definition.id)) treat.restore();
    for (const [index, lift] of this.def.lifts.entries())
      this.machinery.moveConstructionLift(
        lift.id,
        index < this.progress.current.section ? lift.topY : lift.bottomY,
        0,
        [],
      );
    this.view.reset(
      this.sophie.feet,
      this.progress.section.bottom,
      this.progress.section.direction,
    );
    this.hud.setFade(0);
    this.present(0);
  }
  present(ms: number) {
    const direction = this.ride ? 0 : this.progress.section.direction;
    if (!this.arrivalMs)
      this.view.step(
        ms,
        this.sophie.feet,
        this.progress.section.bottom,
        direction,
      );
    const zoom = Math.min(
      this.scene.scale.width / t.viewWidth,
      this.scene.scale.height / t.viewHeight,
    );
    this.scene.cameras.main
      .setViewport(
        (this.scene.scale.width - t.viewWidth * zoom) / 2,
        (this.scene.scale.height - t.viewHeight * zoom) / 2,
        t.viewWidth * zoom,
        t.viewHeight * zoom,
      )
      .setZoom(zoom)
      .setRoundPixels(true)
      .centerOn(
        Math.round(this.view.x) + t.viewWidth / 2,
        Math.round(this.view.y) + t.viewHeight / 2,
      )
      .setBackgroundColor(0x172c3a);
    document
      .querySelector('#app')!
      .classList.toggle('climb-scripted', this.scripted);
  }
  get section() {
    if (this.ride)
      return {
        title: this.ride.definition.destination
          ? 'Construction lift ↑'
          : 'Above the city',
        hint: this.ride.definition.destination
          ? 'The next scaffold is waiting.'
          : 'Two small dogs. A very big view.',
      };
    return this.progress.current;
  }
  snapshot() {
    return {
      section: this.progress.current.section,
      challenge: this.progress.current.checkpoint,
      phase: this.arrivalMs ? 'arrival' : (this.ride?.phase ?? 'climb'),
      lift: this.ride?.definition.id,
      fallBoundary: this.fallBoundary,
      camera: { x: this.view.x, y: this.view.y },
      birds: this.birds.snapshot(),
    };
  }
  destroy() {
    this.birds.destroy();
    document.querySelector('#app')!.classList.remove('climb-scripted');
    const b = this.background;
    this.scene.game.config.backgroundColor.setTo(
      b.red,
      b.green,
      b.blue,
      b.alpha,
    );
    this.scene.cameras.main
      .setViewport(0, 0, this.scene.scale.width, this.scene.scale.height)
      .setZoom(1);
  }
}
