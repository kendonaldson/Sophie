import type Phaser from 'phaser';
import type { LevelDefinition } from '../levels/types';
import type { Player } from '../player/Player';
import type { Jimmy } from '../companion/Jimmy';
import type { Checkpoints } from '../levels/Checkpoints';
import type { DogTreat } from '../entities/DogTreat';
import type { Hud } from '../../ui/Hud';
import type { SfxOutput } from '../audio/Sfx';
import { RatPack } from '../rats/RatPack';
import { SteamField } from '../steam/SteamField';
import { TunnelCamera } from './TunnelCamera';
import { TunnelExit } from './TunnelExit';
import { tunnelTuning as t } from './config';
/** Owns hazards and retry state; shared actors retain all movement rules. */
export class TunnelRun {
  readonly rats: RatPack;
  readonly steam: SteamField;
  readonly view: TunnelCamera;
  exit?: TunnelExit;
  private readonly background;
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDefinition,
    private readonly sophie: Player,
    private readonly jimmy: Jimmy,
    private readonly checkpoints: Checkpoints,
    private readonly treats: DogTreat[],
    private readonly hud: Hud,
    private readonly sfx: SfxOutput,
  ) {
    this.background = scene.game.config.backgroundColor.clone();
    scene.game.config.backgroundColor.setTo(36, 43, 48);
    this.rats = new RatPack(scene, level.maintenance!.rats);
    this.steam = new SteamField(level.maintenance!.steam, sfx);
    this.view = new TunnelCamera(scene, level);
    this.sophie.respawn(level.playerSpawn);
    this.jimmy.actor.respawn(level.companionSpawn!);
    this.jimmy.enabled = true;
    this.view.reset(sophie.feet);
  }
  get fallBoundary() {
    return Math.min(this.level.fallY, this.checkpoints.spawn.y + t.fallMargin);
  }
  afterStep(ms: number) {
    this.rats.step(ms);
    this.steam.step(ms, this.view);
    if (this.rats.collide(this.sophie.body)) {
      this.sfx.ratSqueak();
      return true;
    }
    if (this.steam.collide(this.sophie.body)) return true;
    this.jimmy.afterStep(ms, this.sophie, this.checkpoints.spawn);
    const d = this.level.maintenance!.destination;
    if (
      this.sophie.grounded &&
      this.sophie.feet.x >= d.triggerX &&
      Math.abs(this.sophie.feet.y - d.sophie.y) < 1
    ) {
      if (
        !this.jimmy.actor.grounded ||
        Math.abs(this.jimmy.actor.feet.x - d.jimmy.x) >
          (t.walkSpeed * t.gatherMs) / 1000
      )
        this.jimmy.reconcile(d.jimmy);
      this.exit = new TunnelExit(d, {
        sophie: this.sophie.feet,
        jimmy: this.jimmy.actor.feet,
      });
      this.jimmy.history.reset();
      this.jimmy.effects.clear();
      document.querySelector('#app')!.classList.add('tunnel-exit');
    }
    return this.sophie.feet.y > this.fallBoundary;
  }
  stepExit(ms: number) {
    const exit = this.exit!;
    exit.tick(ms);
    for (const [name, actor] of [
      ['sophie', this.sophie],
      ['jimmy', this.jimmy.actor],
    ] as const) {
      const pose = exit.actors[name];
      actor.place(pose);
      actor.sprite
        .setVisible(pose.visible)
        .setAlpha(pose.alpha)
        .setFlipX(pose.flipX)
        .setScale(1)
        .play(`${name === 'jimmy' ? 'jimmy-' : ''}${pose.pose}`, true);
    }
    this.hud.setFade(exit.fade);
    return exit.state.phase === 'complete';
  }
  reset() {
    this.exit = undefined;
    document.querySelector('#app')!.classList.remove('tunnel-exit');
    this.sophie.respawn(this.checkpoints.spawn);
    this.jimmy.reconcile(this.checkpoints.spawn);
    this.jimmy.enabled = true;
    this.sophie.sprite.setVisible(true);
    this.jimmy.actor.sprite.setVisible(true);
    this.rats.reset();
    this.steam.reset();
    const challenges = this.level.maintenance!.challenges;
    const index = challenges.findIndex(
      (c) => c.checkpoint === this.checkpoints.id,
    );
    const reset = new Set(
      challenges.slice(Math.max(0, index)).flatMap((c) => c.treats),
    );
    for (const treat of this.treats)
      if (reset.has(treat.definition.id)) treat.restore();
    this.view.reset(this.sophie.feet);
    this.hud.setFade(0);
  }
  present(ms: number) {
    this.view.update(ms, this.sophie.feet, Boolean(this.exit));
  }
  snapshot() {
    return {
      phase: this.exit?.state.phase ?? 'tunnels',
      actors: this.exit?.actors,
      animations: {
        sophie: this.sophie.sprite.anims.currentAnim?.key,
        jimmy: this.jimmy.actor.sprite.anims.currentAnim?.key,
      },
      rats: this.rats.snapshot(),
      steam: this.steam.snapshot(),
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
    this.rats.destroy();
    document.querySelector('#app')!.classList.remove('tunnel-exit');
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
