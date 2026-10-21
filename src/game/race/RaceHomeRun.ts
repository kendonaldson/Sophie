import type Phaser from 'phaser';
import type { LevelDefinition } from '../levels/types';
import type { Player } from '../player/Player';
import type { Jimmy } from '../companion/Jimmy';
import type { Machinery } from '../machinery/Machinery';
import type { Checkpoints } from '../levels/Checkpoints';
import type { DogTreat } from '../entities/DogTreat';
import type { Hud } from '../../ui/Hud';
import type { SfxOutput } from '../audio/Sfx';
import { BirdFlock } from '../birds/BirdFlock';
import { RatPack } from '../rats/RatPack';
import { SteamField } from '../steam/SteamField';
import { PizzaPickup } from '../pizza/PizzaPickup';
import { PizzaRushVisual } from '../pizza/PizzaRushVisual';
import { pizzaPickupAppearance } from '../pizza/dashAppearance';
import { CombinedSuperJump } from '../superJump/CombinedSuperJump';
import { RaceCamera } from './RaceCamera';
import {
  RaceOpening,
  RaceSuperJump,
  RaceAtticEntry,
  type RaceActors,
} from './RaceStory';
import { raceTuning as t } from './config';
import { standingOn } from '../machinery/PlatformMotion';
import { frames } from '../player/animations';

/** Shared hazards and movement, composed into a checkpointed journey home. */
export class RaceHomeRun {
  readonly opening = new RaceOpening();
  readonly birds: BirdFlock;
  readonly rats: RatPack;
  readonly steam: SteamField;
  readonly pizzas: PizzaPickup[];
  readonly view: RaceCamera;
  private readonly powerVisual: PizzaRushVisual;
  private readonly combined: CombinedSuperJump;
  private readonly slices: Phaser.GameObjects.Sprite[];
  private jump?: RaceSuperJump;
  private entry?: RaceAtticEntry;
  private jumpDone = false;
  private finalApproach = false;
  private lastLane: number;
  private elapsed = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly level: LevelDefinition,
    private readonly sophie: Player,
    private readonly jimmy: Jimmy,
    private readonly machinery: Machinery,
    private readonly checkpoints: Checkpoints,
    private readonly treats: DogTreat[],
    private readonly hud: Hud,
    private readonly sfx: SfxOutput,
  ) {
    const d = level.race!;
    this.lastLane = level.playerSpawn.y;
    this.birds = new BirdFlock(scene, d.birds);
    this.rats = new RatPack(scene, d.rats);
    this.steam = new SteamField(d.steam, sfx);
    this.pizzas = d.pizzas.map((p) => new PizzaPickup(p));
    this.slices = this.pizzas.map((p) =>
      scene.add
        .sprite(p.definition.x, p.definition.y, pizzaPickupAppearance.key)
        .setDepth(6)
        .setName(p.definition.id),
    );
    this.powerVisual = new PizzaRushVisual(scene, sophie);
    this.combined = new CombinedSuperJump(scene);
    this.view = new RaceCamera(scene, level);
    this.view.reset(sophie.feet);
    this.jimmy.enabled = false;
  }
  get band() {
    return [...this.level.race!.bands]
      .reverse()
      .find((b) => this.sophie.feet.x >= b.fromX)!;
  }
  get fallBoundary() {
    return Math.min(
      this.band.fallY,
      this.band.mode === 'construction'
        ? this.lastLane + t.constructionFallMargin
        : this.level.fallY,
    );
  }
  get openingProgress() {
    return this.opening.progress;
  }
  get scripted() {
    return (
      !this.opening.complete ||
      Boolean(this.jump && !this.jump.complete) ||
      Boolean(this.entry)
    );
  }
  get complete() {
    return this.entry?.complete ?? false;
  }
  private stopActors() {
    this.sophie.controller.pizzaRush?.reset();
    this.powerVisual.clear();
    for (const actor of [this.sophie, this.jimmy.actor]) {
      actor.controller.dash.cancel();
      actor.controller.clearBufferedInput();
      actor.body.setVelocity(0, 0);
    }
    this.jimmy.history.reset();
    this.jimmy.effects.clear();
    this.jimmy.enabled = false;
  }
  stepScript(ms: number) {
    if (!this.scripted) return false;
    this.elapsed += ms;
    if (!this.opening.complete) {
      this.opening.tick(ms);
      this.sophie.place(this.level.playerSpawn);
      this.jimmy.actor.place(this.level.companionSpawn!);
      this.sophie.sprite.play('idle', true).setFlipX(false);
      this.jimmy.actor.sprite.play('jimmy-idle', true).setFlipX(false);
      this.hud.showDialogue(
        this.opening.line?.text,
        this.opening.line?.speaker.toUpperCase(),
      );
      if (this.opening.complete) this.jimmy.enabled = true;
    } else if (this.jump && !this.jump.complete) {
      this.jump.tick(ms);
      this.presentActors(this.jump.actors);
      this.combined.show(this.jump.combinedJump);
      if (this.jump.complete) {
        const d = this.level.race!.superJump;
        this.sophie.respawn(d.landing);
        this.jimmy.reconcile(d.jimmyLanding);
        this.sophie.sprite.setVisible(true).setAlpha(1);
        this.jimmy.actor.sprite.setVisible(true).setAlpha(1);
        this.combined.show();
        this.jumpDone = true;
        this.lastLane = d.landing.y;
        this.checkpoints.update(d.landing, true);
        this.resetCycles();
        this.jimmy.enabled = true;
      }
    } else if (this.entry) {
      this.entry.tick(ms);
      this.presentActors(this.entry.actors);
      this.hud.setFade(this.entry.fade);
    }
    return true;
  }
  private presentActors(actors: RaceActors) {
    for (const [name, actor] of [
      ['sophie', this.sophie],
      ['jimmy', this.jimmy.actor],
    ] as const) {
      const pose = actors[name];
      actor.place(pose);
      actor.sprite
        .setVisible(pose.visible)
        .setAlpha(pose.alpha)
        .setScale(1)
        .setFlipX(pose.flipX);
      if (pose.pose === 'jump') {
        actor.sprite.anims.stop();
        actor.sprite.setFrame(frames.jump + 3);
      } else
        actor.sprite.play(
          `${name === 'jimmy' ? 'jimmy-' : ''}${pose.pose}`,
          true,
        );
    }
  }
  private resetCycles() {
    this.birds.reset();
    this.rats.reset();
    this.steam.reset();
    this.machinery.resetMotion();
  }
  afterStep(ms: number) {
    this.elapsed += ms;
    const d = this.level.race!,
      body = this.sophie.body;
    if (this.sophie.grounded) this.lastLane = this.sophie.feet.y;
    this.birds.step(ms);
    this.rats.step(ms);
    this.steam.step(ms, this.view);
    // Environmental hazards never use Pizza Rush's creature contact policy.
    if (this.sophie.feet.y > this.fallBoundary || this.steam.collide(body))
      return true;
    if (this.checkpoints.update(this.sophie.feet, this.sophie.grounded)) {
      // Saving a landing must not cut a live eight-second Rush short. Power
      // ends through the controller's normal expiry, or is cleared on retry.
      this.resetCycles();
    }
    for (const pizza of this.pizzas) {
      pizza.tick(ms);
      if (
        pizza.collect(body, this.sophie.controller) &&
        this.sophie.controller.dash.active
      ) {
        const { dash } = this.sophie.controller;
        const speed = this.sophie.controller.movementConfig.dashSpeed;
        body.setMaxVelocity(
          speed,
          Math.max(speed, this.sophie.controller.config.maxFallSpeed),
        );
        body.setVelocity(dash.direction.x * speed, dash.direction.y * speed);
      }
    }
    const contact = {
      pizzaRush: Boolean(this.sophie.controller.pizzaRush?.active),
      facing: this.sophie.controller.facing,
      sfx: this.sfx,
    };
    if (this.birds.collide(body, contact)) {
      this.sfx.birdSquawk();
      return true;
    }
    if (this.rats.collide(body, contact)) {
      this.sfx.ratSqueak();
      return true;
    }
    this.jimmy.afterStep(ms, this.sophie, this.checkpoints.spawn);
    const moving = this.machinery.surfaces.find((surface) =>
      standingOn(body, surface, body.velocity.y),
    );
    if (
      moving &&
      (this.jimmy.actor.feet.y > moving.y + 150 ||
        Math.abs(this.sophie.feet.x - this.jimmy.actor.feet.x) >
          t.companionSeparation)
    ) {
      this.jimmy.reconcile(this.sophie.feet);
      this.jimmy.recoveries++;
    }
    if (
      !this.jumpDone &&
      this.sophie.grounded &&
      this.sophie.feet.x >= d.superJump.triggerX &&
      this.sophie.feet.x <= d.superJump.runwayEnd + 12 &&
      Math.abs(this.sophie.feet.y - d.superJump.staging.y) < 1
    ) {
      this.stopActors();
      this.jump = new RaceSuperJump(
        d.superJump,
        { sophie: this.sophie.feet, jimmy: this.jimmy.actor.feet },
        this.sfx,
      );
    }
    const destination = d.destination;
    if (
      !this.finalApproach &&
      this.sophie.grounded &&
      this.sophie.feet.x >= destination.triggerX &&
      this.sophie.feet.x < this.level.width
    ) {
      this.finalApproach = true;
      this.jimmy.reconcile(destination.jimmy);
    }
    if (
      this.finalApproach &&
      this.sophie.grounded &&
      this.sophie.feet.x >= destination.attic.x - 20 &&
      Math.abs(this.sophie.feet.y - destination.attic.y) < 1
    ) {
      this.stopActors();
      this.jimmy.reconcile(this.sophie.feet);
      this.entry = new RaceAtticEntry(destination, {
        sophie: this.sophie.feet,
        jimmy: this.jimmy.actor.feet,
      });
    }
    return false;
  }
  reset() {
    this.opening.tick(60000);
    this.jump = undefined;
    this.entry = undefined;
    this.finalApproach = false;
    const checkpointIndex = this.level.checkpoints.findIndex(
      (c) => c.id === this.checkpoints.id,
    );
    const balloonIndex = this.level.checkpoints.findIndex(
      (c) => c.id === this.level.race!.superJump.checkpointId,
    );
    this.jumpDone = checkpointIndex >= balloonIndex;
    this.resetCycles();
    const challenges = this.level.race!.challenges;
    const index = challenges.findIndex(
      (c) => c.checkpoint === this.checkpoints.id,
    );
    const remaining = challenges.slice(Math.max(0, index));
    const treats = new Set(remaining.flatMap((c) => c.treats));
    const pizzas = new Set(remaining.flatMap((c) => c.pizzas));
    for (const treat of this.treats)
      if (treats.has(treat.definition.id)) treat.restore();
    for (const pizza of this.pizzas)
      if (pizzas.has(pizza.definition.id)) pizza.reset();
    this.sophie.respawn(this.checkpoints.spawn);
    this.jimmy.reconcile(this.checkpoints.spawn);
    this.jimmy.enabled = true;
    this.sophie.sprite.setVisible(true).setAlpha(1).setScale(1);
    this.jimmy.actor.sprite.setVisible(true).setAlpha(1).setScale(1);
    this.powerVisual.clear();
    this.combined.show();
    this.sfx.stopJimmySuperJump();
    this.sfx.stopPizza();
    this.hud.showDialogue();
    this.hud.setFade(0);
    this.lastLane = this.checkpoints.spawn.y;
    this.view.reset(this.sophie.feet);
  }
  present(ms: number) {
    this.view.update(ms, this.sophie.feet, this.sophie.grounded, this.scripted);
    if (!this.scripted) this.powerVisual.update(ms);
    for (const [i, sprite] of this.slices.entries())
      sprite
        .setVisible(this.pizzas[i]!.available)
        .setFrame(
          Math.floor((this.elapsed * pizzaPickupAppearance.frameRate) / 1000) %
            8,
        );
  }
  snapshot() {
    const power = this.sophie.controller.pizzaRush!;
    return {
      phase: !this.opening.complete
        ? 'opening'
        : this.entry
          ? `attic-${this.entry.state.phase}`
          : this.jump && !this.jump.complete
            ? `jump-${this.jump.state.phase}`
            : 'race',
      scripted: this.scripted,
      line: this.opening.line,
      openingProgress: this.openingProgress,
      section: this.band.id,
      finalApproach: this.finalApproach,
      jumpDone: this.jumpDone,
      birds: this.birds.snapshot(),
      rats: this.rats.snapshot(),
      steam: this.steam.snapshot(),
      pizza: {
        active: power.active,
        remainingMs: power.remainingMs,
        movement: { ...this.sophie.controller.movementConfig },
        aura: { visible: this.powerVisual.aura.visible },
        pickups: this.pizzas.map((p) => ({
          ...p.definition,
          available: p.available,
          remainingMs: p.remainingMs,
        })),
      },
      combinedJump: this.combined.snapshot(),
      actors: {
        sophie: { ...this.sophie.feet, visible: this.sophie.sprite.visible },
        jimmy: {
          ...this.jimmy.actor.feet,
          visible: this.jimmy.actor.sprite.visible,
        },
      },
      camera: {
        x: this.view.x,
        y: this.view.y,
        width: this.view.width,
        height: this.view.height,
      },
      fallBoundary: this.fallBoundary,
    };
  }
  destroy() {
    this.birds.destroy();
    this.rats.destroy();
    this.powerVisual.destroy();
    this.combined.destroy();
    this.slices.forEach((s) => s.destroy());
    this.view.destroy();
    this.sfx.stopJimmySuperJump();
    this.sfx.stopPizza();
    this.hud.showDialogue();
  }
}
