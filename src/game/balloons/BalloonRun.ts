import type Phaser from 'phaser';
import type { LevelDefinition } from '../levels/types';
import type { Player } from '../player/Player';
import type { Jimmy } from '../companion/Jimmy';
import type { Machinery } from '../machinery/Machinery';
import type { Checkpoints } from '../levels/Checkpoints';
import type { DogTreat } from '../entities/DogTreat';
import type { Hud } from '../../ui/Hud';
import type { SfxOutput } from '../audio/Sfx';
import { SpeechBubble } from '../../ui/SpeechBubble';
import { BirdFlock } from '../birds/BirdFlock';
import { BalloonCamera } from './BalloonCamera';
import { PizzaFinale } from './PizzaFinale';
import { balloonTuning as t } from './config';
import { standingOn } from '../machinery/PlatformMotion';
/** Balloon progression, repeatable challenges and the rooftop payoff. No movement rules. */
export class BalloonRun {
  readonly birds: BirdFlock;
  readonly view: BalloonCamera;
  finale?: PizzaFinale;
  private readonly root = document.createElement('div');
  private readonly bubble: SpeechBubble;
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
    this.background = scene.game.config.backgroundColor.clone();
    scene.game.config.backgroundColor.setTo(170, 207, 213);
    this.birds = new BirdFlock(scene, level.balloons!.birds);
    this.view = new BalloonCamera(scene, level);
    this.root.className = 'balloon-ui';
    const host = document.querySelector<HTMLElement>('.game-shell')!;
    host.append(this.root);
    this.bubble = new SpeechBubble(host, this.root, sfx);
    this.sophie.respawn(level.playerSpawn);
    this.jimmy.actor.respawn(level.companionSpawn!);
    this.jimmy.enabled = true;
    this.view.reset(sophie.feet);
  }
  get fallBoundary() {
    return Math.min(this.level.fallY, this.checkpoints.spawn.y + t.fallMargin);
  }
  afterStep(ms: number) {
    this.birds.step(ms);
    if (this.birds.collide(this.sophie.body)) {
      this.sfx.birdSquawk();
      return true;
    }
    this.jimmy.afterStep(ms, this.sophie, this.checkpoints.spawn);
    const moving = this.machinery.surfaces.find((s) =>
      standingOn(this.sophie.body, s, this.sophie.body.velocity.y),
    );
    if (
      moving &&
      (this.jimmy.actor.feet.y > moving.y + 160 ||
        Math.abs(this.jimmy.actor.feet.x - this.sophie.feet.x) >
          t.companionSeparation)
    ) {
      this.jimmy.reconcile({ x: this.sophie.feet.x, y: moving.y });
      this.jimmy.recoveries++;
    }
    const d = this.level.balloons!.destination;
    if (
      this.sophie.grounded &&
      this.sophie.feet.x >= d.landingX &&
      Math.abs(this.sophie.feet.y - d.sophie.y) < 1
    ) {
      if (
        !this.jimmy.actor.grounded ||
        this.jimmy.actor.feet.x < d.landingX - 32 ||
        Math.abs(this.jimmy.actor.feet.x - this.sophie.feet.x) >
          t.companionSeparation
      )
        this.jimmy.reconcile(this.sophie.feet);
      this.finale = new PizzaFinale(d, {
        sophie: this.sophie.feet,
        jimmy: this.jimmy.actor.feet,
      });
      this.jimmy.history.reset();
      this.jimmy.effects.clear();
      document.querySelector('#app')!.classList.add('balloon-finale');
    }
    return this.sophie.feet.y > this.fallBoundary;
  }
  stepFinale(ms: number) {
    const f = this.finale!;
    f.tick(ms);
    for (const [name, actor] of [
      ['sophie', this.sophie],
      ['jimmy', this.jimmy.actor],
    ] as const) {
      const pose = f.actors[name];
      actor.place(pose);
      actor.sprite
        .setVisible(pose.visible)
        .setAlpha(pose.alpha)
        .setFlipX(false)
        .setScale(1)
        .play(`${name === 'jimmy' ? 'jimmy-' : ''}${pose.pose}`, true);
    }
    this.hud.setFade(f.fade);
    return f.state.phase === 'complete';
  }
  reset() {
    this.finale = undefined;
    document.querySelector('#app')!.classList.remove('balloon-finale');
    this.sophie.respawn(this.checkpoints.spawn);
    this.jimmy.reconcile(this.checkpoints.spawn);
    this.jimmy.enabled = true;
    this.sophie.sprite.setVisible(true);
    this.jimmy.actor.sprite.setVisible(true);
    this.birds.reset();
    this.machinery.resetMotion();
    const challenges = this.level.balloons!.challenges;
    const index = challenges.findIndex(
      (c) => c.checkpoint === this.checkpoints.id,
    );
    const reset = new Set(
      challenges.slice(Math.max(0, index)).flatMap((c) => c.treats),
    );
    for (const treat of this.treats)
      if (reset.has(treat.definition.id)) treat.restore();
    this.bubble.show();
    this.view.reset(this.sophie.feet);
    this.hud.setFade(0);
  }
  present(ms: number) {
    this.view.update(ms, this.sophie.feet, Boolean(this.finale));
    this.bubble.show(this.finale?.line);
    if (!this.finale?.line) return;
    const camera = this.scene.cameras.main,
      canvas = this.scene.game.canvas.getBoundingClientRect(),
      host = document.querySelector('.game-shell')!.getBoundingClientRect();
    const scale = canvas.width / this.scene.scale.width;
    this.bubble.anchor(
      canvas.left -
        host.left +
        (camera.x + (this.sophie.feet.x - this.view.x) * camera.zoom) * scale,
      canvas.top -
        host.top +
        (camera.y + (this.sophie.feet.y - 54 - this.view.y) * camera.zoom) *
          scale,
    );
    this.bubble.revealText(ms);
  }
  snapshot() {
    return {
      phase: this.finale?.state.phase ?? 'balloons',
      line: this.finale?.line?.text,
      scentMs: this.finale?.scentMs ?? 0,
      actors: this.finale?.actors,
      animations: {
        sophie: this.sophie.sprite.anims.currentAnim?.key,
        jimmy: this.jimmy.actor.sprite.anims.currentAnim?.key,
      },
      birds: this.birds.snapshot(),
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
    this.bubble.destroy();
    this.root.remove();
    document.querySelector('#app')!.classList.remove('balloon-finale');
    const b = this.background;
    this.scene.game.config.backgroundColor.setTo(
      b.red,
      b.green,
      b.blue,
      b.alpha,
    );
    this.scene.cameras.main
      ?.setViewport(0, 0, this.scene.scale.width, this.scene.scale.height)
      .setZoom(1);
  }
}
