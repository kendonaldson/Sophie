import type Phaser from 'phaser';
import type { LevelDefinition, Point } from '../levels/types';
import type { Player } from '../player/Player';
import type { Jimmy } from '../companion/Jimmy';
import type { Machinery } from '../machinery/Machinery';
import type { Checkpoints } from '../levels/Checkpoints';
import type { DogTreat } from '../entities/DogTreat';
import type { Hud } from '../../ui/Hud';
import type { SfxOutput } from '../audio/Sfx';
import { overlaps } from '../player/CollisionAssist';
import { PizzaPickup } from '../pizza/PizzaPickup';
import { PizzaRushVisual } from '../pizza/PizzaRushVisual';
import { ShellyRoll } from './ShellyRoll';
import { ShellyBlocker } from './ShellyBlocker';
import { FactoryStory } from './FactoryStory';
import { FactoryCamera } from './FactoryCamera';
import { FactoryCast } from './FactoryCast';
import { ovenFireBounds } from './ovenFire';
import { factoryTuning as t } from './config';

/** Composes ordinary player/companion movement, reusable machinery and pizza,
 * two stationary encounters, and periodic lane rolls. No boss HP or combat. */
export class FactoryRun {
  readonly story = new FactoryStory();
  readonly roll = new ShellyRoll();
  readonly midpoint: ShellyBlocker;
  readonly final: ShellyBlocker;
  readonly pizzas: PizzaPickup[];
  readonly view: FactoryCamera;
  private readonly cast: FactoryCast;
  private readonly powerVisual: PizzaRushVisual;
  private lastLane = 980;
  private calls = new Set<number>();
  private callMs = 0;
  private escapeStart?: { sophie: Point; jimmy: Point };
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
    const d = level.factory!;
    this.midpoint = new ShellyBlocker(d.midpoint.shelly, t.midpointSpinMs);
    this.final = new ShellyBlocker(d.final.shelly, t.finalSpinMs);
    this.pizzas = [d.midpoint.pizza, d.final.pizza, ...d.pizzas].map(
      (p) => new PizzaPickup(p),
    );
    this.view = new FactoryCamera(scene, level);
    this.view.reset(sophie.feet);
    this.cast = new FactoryCast(scene, d, this.pizzas);
    this.powerVisual = new PizzaRushVisual(scene, sophie);
    this.jimmy.enabled = false;
    document.querySelector('#app')!.classList.add('factory-mode');
  }
  get scripted() {
    return this.story.scripted;
  }
  get complete() {
    return this.story.phase === 'complete';
  }
  get fallBoundary() {
    return Math.min(this.level.fallY, this.lastLane + t.fallMargin);
  }
  private stopActors() {
    this.sophie.controller.dash.cancel();
    this.sophie.controller.clearBufferedInput();
    this.sophie.body.setVelocity(0, 0);
    this.jimmy.actor.controller.dash.cancel();
    this.jimmy.actor.body.setVelocity(0, 0);
    this.jimmy.history.reset();
    this.jimmy.enabled = false;
    this.roll.reset();
    this.cast.reset();
    this.callMs = 0;
  }
  stepScript(ms: number) {
    if (!this.scripted) return false;
    const previous = this.story.phase;
    this.midpoint.tick(ms);
    this.final.tick(ms);
    this.story.tick(ms);
    const phase = this.story.phase,
      d = this.level.factory!;
    this.powerVisual.clear();
    if (phase === 'opening') {
      this.sophie.place(this.level.playerSpawn);
      this.jimmy.actor.place(this.level.companionSpawn!);
    } else if (phase === 'midpoint-dialogue' || phase === 'final-dialogue') {
      const point =
        phase === 'midpoint-dialogue' ? d.midpoint.staging : d.final.staging;
      this.sophie.place(point);
      this.jimmy.actor.place({ x: point.x - 60, y: point.y });
    } else if (phase === 'midpoint-spin') {
      this.walk(
        this.sophie,
        d.midpoint.shelly.x + 70,
        d.midpoint.shelly.y,
        180,
        ms,
      );
      this.walk(
        this.jimmy.actor,
        d.midpoint.shelly.x + 15,
        d.midpoint.shelly.y,
        180,
        ms,
      );
    } else if (phase === 'final-spin' || phase === 'outro') {
      this.walk(this.sophie, d.final.shelly.x + 120, d.final.shelly.y, 190, ms);
      this.walk(
        this.jimmy.actor,
        d.final.shelly.x + 55,
        d.final.shelly.y,
        180,
        ms,
      );
    } else if (phase === 'escape') {
      if (!this.escapeStart)
        this.escapeStart = {
          sophie: this.sophie.feet,
          jimmy: this.jimmy.actor.feet,
        };
      const fraction = Math.min(1, this.story.elapsed / t.escapeMs);
      for (const [name, actor] of [
        ['sophie', this.sophie],
        ['jimmy', this.jimmy.actor],
      ] as const) {
        const start = this.escapeStart[name];
        actor.place({
          x: start.x + (d.exitX - start.x) * fraction,
          y: d.final.shelly.y,
        });
        actor.sprite
          .play(name === 'jimmy' ? 'jimmy-walk' : 'walk', true)
          .setFlipX(false)
          .setAlpha(Math.min(1, (1 - fraction) * 8));
      }
    }
    const hidden = ['empty', 'fade', 'complete'].includes(phase);
    this.sophie.sprite.setVisible(!hidden);
    this.jimmy.actor.sprite.setVisible(!hidden);
    if (this.story.line) {
      this.sophie.sprite.play('idle', true).setFlipX(false);
      this.jimmy.actor.sprite.play('jimmy-idle', true).setFlipX(false);
    }
    this.hud.showDialogue(
      this.story.line?.text,
      this.story.line?.speaker.toUpperCase(),
    );
    this.hud.setFade(this.story.fade);
    if (previous !== phase && !this.scripted) {
      this.jimmy.enabled = true;
      this.jimmy.history.reset();
      this.sophie.controller.clearBufferedInput();
      this.hud.showDialogue();
    }
    return true;
  }
  private walk(actor: Player, x: number, y: number, speed: number, ms: number) {
    const before = actor.feet.x;
    actor.place({ x: Math.min(x, before + (speed * ms) / 1000), y });
    const prefix = actor === this.sophie ? '' : 'jimmy-';
    actor.sprite
      .setFlipX(false)
      .play(`${prefix}${before < x - 1 ? 'walk' : 'idle'}`, true);
  }
  afterStep(ms: number) {
    const d = this.level.factory!,
      body = this.sophie.body;
    if (this.sophie.grounded) this.lastLane = this.sophie.feet.y;
    if (
      this.sophie.feet.y > this.fallBoundary ||
      d.ovens.some((oven) => overlaps(body, ovenFireBounds(oven)))
    )
      return true;
    if (
      this.story.phase === 'chase' &&
      this.sophie.grounded &&
      this.sophie.feet.x >= d.midpoint.triggerX
    ) {
      this.story.midpoint();
      this.stopActors();
      this.jimmy.reconcile(d.midpoint.staging);
      this.jimmy.enabled = !this.scripted;
      return false;
    }
    if (
      this.midpoint.resolved &&
      !this.final.resolved &&
      this.story.phase === 'second-half' &&
      this.sophie.grounded &&
      this.sophie.feet.x >= d.final.triggerX
    ) {
      this.story.final();
      this.stopActors();
      this.jimmy.reconcile(d.final.staging);
      this.jimmy.enabled = !this.scripted;
      return false;
    }
    for (const pizza of this.pizzas) {
      pizza.tick(ms);
      if (
        pizza.collect(body, this.sophie.controller) &&
        this.sophie.controller.dash.active
      ) {
        const dash = this.sophie.controller.dash;
        const speed = this.sophie.controller.movementConfig.dashSpeed;
        body.setMaxVelocity(
          speed,
          Math.max(speed, this.sophie.controller.config.maxFallSpeed),
        );
        body.setVelocity(dash.direction.x * speed, dash.direction.y * speed);
      }
    }
    const swept = {
      x: Math.min(body.x, body.prev.x),
      y: body.y,
      width: body.width + Math.abs(body.x - body.prev.x),
      height: body.height,
    };
    for (const [index, blocker] of [this.midpoint, this.final].entries()) {
      const contact = blocker.contact(
        swept,
        Boolean(
          this.sophie.controller.pizzaRush?.active &&
          this.sophie.controller.dash.active,
        ),
      );
      if (contact === 'blocked') {
        this.sophie.translate(blocker.body.x - body.right - 0.1, 0);
        this.sophie.controller.dash.cancel();
        body.setVelocityX(-t.recoilSpeed);
      } else if (contact === 'spin') {
        this.sfx.shellySpin();
        this.pizzas[index]!.completed = true;
        this.story.enter(index === 0 ? 'midpoint-spin' : 'final-spin');
        this.stopActors();
        this.sophie.place({
          x: blocker.position.x + 28,
          y: blocker.position.y,
        });
        this.jimmy.reconcile({
          x: blocker.position.x - 70,
          y: blocker.position.y,
        });
        if (index === 1) this.sophie.controller.pizzaRush?.reset();
        return false;
      }
    }
    if (
      this.midpoint.resolved &&
      this.checkpoints.update(this.sophie.feet, this.sophie.grounded)
    ) {
      this.sophie.controller.pizzaRush?.reset();
      body.setVelocityX(
        Math.min(body.velocity.x, this.sophie.controller.config.maxRunSpeed),
      );
      this.roll.reset();
      this.cast.reset();
    }
    const sounds = this.roll.tick(ms, this.lastLane);
    for (const sound of sounds) {
      if (sound === 'charge') this.sfx.shellyRollCharge();
      else this.sfx.shellyRoll();
    }
    const { pizzaRush, dash } = this.sophie.controller;
    // A diagonal Super Dash can cross the shell between physics samples.
    // Sweep both axes for the counter, preserving ordinary jump-dodge bounds.
    const dashSweep = {
      ...swept,
      y: Math.min(body.y, body.prev.y),
      height: body.height + Math.abs(body.y - body.prev.y),
    };
    if (
      pizzaRush?.active &&
      dash.active &&
      this.roll.hits(dashSweep) &&
      this.roll.deflect(dash.direction)
    )
      this.sfx.shellySpin();
    else if (this.roll.hits(body)) return true;
    const zone = d.rollZones.find(
      (z) => this.sophie.feet.x >= z.fromX && this.sophie.feet.x <= z.toX,
    );
    if (zone && !['midpoint', 'final'].includes(this.story.phase)) {
      // Derive the encounter window from simulation coordinates, never the
      // smoothed presentation camera or device viewport.
      const windowLeft = this.sophie.feet.x - t.viewWidth / 2 + t.lookAhead;
      const left = Math.max(zone.left, windowLeft + 35),
        right = Math.min(zone.right, windowLeft + t.viewWidth - 40);
      if (right - left > 240) this.roll.start(left, right, this.lastLane);
    }
    // Only Sophie's body is tested against hazards/pickups. Jimmy can recover
    // behind her from a bad conveyor landing, just as in the earlier chapters.
    if (
      this.sophie.grounded &&
      d.ovens.some((o) => overlaps(this.jimmy.actor.body, ovenFireBounds(o)))
    )
      this.jimmy.reconcile(this.sophie.feet);
    this.jimmy.afterStep(ms, this.sophie, this.checkpoints.spawn);
    this.chaseCall(ms);
    return false;
  }
  private chaseCall(ms: number) {
    this.callMs = Math.max(0, this.callMs - ms);
    if (this.callMs) return;
    this.hud.showDialogue();
    if (!this.sophie.grounded || this.roll.phase !== 'hidden') return;
    for (const [x, text] of [
      [3480, 'Please ask before taking pizza!'],
      [9600, "Those slices aren't yours to take!"],
    ] as const) {
      if (
        this.sophie.feet.x >= x &&
        this.sophie.feet.x < x + 150 &&
        !this.calls.has(x)
      ) {
        this.calls.add(x);
        this.callMs = 1900;
        this.hud.showDialogue(text, 'SHELLY');
        break;
      }
    }
  }
  reset() {
    const afterMidpoint =
      this.checkpoints.id === this.level.factory!.checkpointId;
    this.story.reset(afterMidpoint);
    this.midpoint.reset(afterMidpoint);
    this.final.reset();
    for (const pizza of this.pizzas)
      pizza.reset(
        afterMidpoint &&
          pizza.definition.id === this.level.factory!.midpoint.pizza.id,
      );
    this.roll.reset();
    this.cast.reset();
    this.powerVisual.clear();
    this.sfx.stopFactory();
    this.hud.showDialogue();
    this.hud.updatePizzaRush(0);
    this.callMs = 0;
    this.escapeStart = undefined;
    this.machinery.resetMotion();
    this.sophie.respawn(this.checkpoints.spawn);
    this.jimmy.reconcile(this.checkpoints.spawn);
    this.sophie.sprite.setVisible(true).setAlpha(1);
    this.jimmy.actor.sprite.setVisible(true).setAlpha(1);
    this.jimmy.enabled = true;
    this.lastLane = this.checkpoints.spawn.y;
    for (const treat of this.treats)
      if (treat.definition.x >= this.checkpoints.spawn.x) treat.restore();
    this.view.reset(this.sophie.feet);
    this.hud.setFade(0);
  }
  present(ms: number) {
    this.view.update(
      ms,
      this.sophie.feet,
      this.sophie.grounded || this.scripted,
    );
    if (!this.scripted) this.powerVisual.update(ms);
    this.cast.update(
      ms,
      this.story,
      this.roll,
      this.midpoint,
      this.final,
      this.pizzas,
      this.sophie.feet.x,
    );
  }
  snapshot() {
    return {
      phase: this.story.phase,
      scripted: this.scripted,
      line: this.story.line,
      midpointResolved: this.midpoint.resolved,
      finalResolved: this.final.resolved,
      pizza: {
        active: this.sophie.controller.pizzaRush!.active,
        remainingMs: this.sophie.controller.pizzaRush!.remainingMs,
        durationMs: this.sophie.controller.pizzaRush!.durationMs,
        movement: { ...this.sophie.controller.movementConfig },
        superDash:
          this.sophie.controller.pizzaRush!.active &&
          this.sophie.controller.dash.active,
        sprite: this.powerVisual.sprite.visible
          ? this.powerVisual.sprite.texture.key
          : this.sophie.sprite.texture.key,
        pickups: this.pizzas.map((p) => ({
          ...p.definition,
          available: p.available,
          completed: p.completed,
          remainingMs: p.remainingMs,
        })),
      },
      roll: {
        phase: this.roll.phase,
        x: this.roll.x,
        y: this.roll.feetY,
        lockedY: this.roll.lockedY,
        cooldown: this.roll.cooldown,
        direction: this.roll.direction,
      },
      shelly: {
        x: this.cast.shelly.x,
        y: this.cast.shelly.y,
        animation: this.cast.shelly.anims.currentAnim?.key,
        spinMs: this.final.spinMs || this.midpoint.spinMs,
      },
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
    this.sophie.controller.pizzaRush?.reset();
    this.sfx.stopFactory();
    this.hud.showDialogue();
    this.hud.updatePizzaRush(0);
    this.powerVisual.destroy();
    this.cast.destroy();
    this.view.destroy();
    document.querySelector('#app')!.classList.remove('factory-mode');
    this.scene.cameras.main
      ?.setViewport(0, 0, this.scene.scale.width, this.scene.scale.height)
      .setZoom(1);
  }
}
