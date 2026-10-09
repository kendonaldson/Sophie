import { CombinedSuperJump } from '../superJump/CombinedSuperJump';
import type { SfxOutput } from '../audio/Sfx';
import type Phaser from 'phaser';
import type { Player } from '../player/Player';
import type { Jimmy } from '../companion/Jimmy';
import { noInput, type PlayerIntent } from '../input/Input';
import type { LevelDefinition, Point } from '../levels/types';
import type { Hud } from '../../ui/Hud';
import { SpeechBubble, type SpeechLine } from '../../ui/SpeechBubble';
import { ForcedScroll } from '../rendering/ForcedScroll';
import { ChaseFinale } from './ChaseFinale';
import { ChaseRecovery } from './ChaseRecovery';
import { chaseTuning as t } from './config';
import { physics } from '../config/physics';
export class ChaseRun {
  readonly scroll: ForcedScroll;
  finale?: ChaseFinale;
  private combined?: CombinedSuperJump;
  private elapsed = 0;
  private callUntil = t.openingLineMs as number;
  private nextCall = 0;
  private lastCallEnd = 0;
  private line?: SpeechLine;
  private readonly root = document.createElement('div');
  private readonly bubble: SpeechBubble;
  private readonly recovery: ChaseRecovery;
  private previousJimmyX: number;
  private stuckMs = 0;
  private recoveryFade = 0;
  private readonly def;
  private readonly previousBackground;
  private readonly edge: Phaser.GameObjects.Graphics;
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelDefinition,
    private readonly sophie: Player,
    private readonly jimmy: Jimmy,
    private readonly hud: Hud,
    private readonly sfx: SfxOutput,
  ) {
    this.def = level.chase!;
    this.recovery = new ChaseRecovery(level.fallY);
    this.previousBackground = scene.game.config.backgroundColor.clone();
    scene.game.config.backgroundColor.setTo(36, 61, 72);
    this.edge = scene.add.graphics().setDepth(20);
    this.scroll = new ForcedScroll(this.def.scroll);
    this.previousJimmyX = level.companionSpawn!.x;
    this.root.className = 'chase-ui';
    const host = document.querySelector<HTMLElement>('.game-shell')!;
    host.append(this.root);
    this.bubble = new SpeechBubble(host, this.root, sfx);
    document.querySelector('#app')!.classList.add('chase-mode');
    this.reset(level.playerSpawn);
  }
  reset(spawn: Point) {
    const opening = spawn.x === this.level.playerSpawn.x;
    this.elapsed = 0;
    this.callUntil = opening ? t.openingLineMs : 0;
    this.lastCallEnd = 0;
    // Calls from earlier streets must not pile up when retrying the bulldozer.
    this.nextCall = this.def.calls.filter(
      (call) => call.fromX < spawn.x,
    ).length;
    this.line = opening
      ? { speaker: 'sophie', text: "Run, Jimmy, or we'll be caught!" }
      : undefined;
    this.finale = undefined;
    this.combined?.show();
    this.scroll.reset(spawn.x);
    this.recovery.reset();
    this.stuckMs = 0;
    this.recoveryFade = 0;
    this.sophie.respawn(spawn);
    this.jimmy.reconcile(spawn);
    this.jimmy.enabled = true;
    this.jimmy.recoveries = 0;
    this.jimmy.lastIntent = noInput();
    this.jimmy.actor.respawn({
      x: spawn.x - (this.level.playerSpawn.x - this.level.companionSpawn!.x),
      y: spawn.y,
    });
    this.previousJimmyX = this.jimmy.actor.feet.x;
    // Both arrive running. Seed the pre-entry movement so Jimmy does not brake
    // while waiting for the first delayed sample from this scene.
    this.jimmy.history.step(this.jimmy.history.delayMs, {
      ...noInput(),
      moveX: 1,
    });
    for (const actor of [this.sophie, this.jimmy.actor]) {
      actor.body.setVelocityX(physics.maxRunSpeed);
      actor.sprite.setVisible(true);
      actor.sprite.anims.resume();
    }
    document.querySelector('#app')!.classList.remove('chase-finale');
    this.present();
  }
  intent(ms: number, input: PlayerIntent): PlayerIntent {
    this.elapsed += ms;
    return this.elapsed < t.openingRunMs && !input.moveX
      ? { ...input, moveX: 1 }
      : input;
  }
  afterStep(ms: number) {
    this.scroll.step(ms, this.sophie.feet.x);
    const s = {
      ...this.sophie.feet,
      vx: this.sophie.body.velocity.x,
      vy: this.sophie.body.velocity.y,
    };
    this.recovery.record(ms, s);
    if (this.scroll.overtaken(s.x)) return true;
    const j = this.jimmy.actor;
    this.stuckMs =
      this.jimmy.lastIntent.moveX &&
      Math.abs(j.feet.x - this.previousJimmyX) < t.stuckDistance
        ? this.stuckMs + ms
        : 0;
    this.previousJimmyX = j.feet.x;
    const lost =
      j.feet.x < this.scroll.boundary + t.recoveryMargin ||
      j.feet.y > this.level.fallY - t.recoveryFallMargin ||
      s.x - j.feet.x > t.recoverySeparation ||
      this.stuckMs > t.stuckMs;
    if (lost && !this.recoveryFade) {
      const target = this.recovery.target(this.scroll.boundary, s);
      if (target) {
        j.respawn(target);
        j.body.setVelocity(target.vx, target.vy);
        j.sprite.setAlpha(0);
        this.jimmy.recoveries++;
        this.stuckMs = 0;
        this.recoveryFade = t.recoveryFadeMs;
      }
    }
    this.recoveryFade = Math.max(0, this.recoveryFade - ms);
    j.sprite.setAlpha(1 - this.recoveryFade / t.recoveryFadeMs);
    this.jimmy.effects.update(ms, j.sprite, j.controller.dash.active);
    if (this.scroll.overtaken(j.feet.x)) {
      // A fade must not prevent a second recovery when a fast dash advances the
      // camera. Only an actually overtaken pair may reset the player's run.
      const target = this.recovery.target(this.scroll.boundary, s);
      if (!target) return true;
      j.place(target);
      j.body.setVelocity(target.vx, target.vy);
    }
    if (this.elapsed >= this.callUntil) this.line = undefined;
    const call = this.def.calls[this.nextCall];
    if (
      call &&
      s.x >= call.fromX &&
      !this.line &&
      this.elapsed >= this.lastCallEnd + t.callQuietMs
    ) {
      this.line = { speaker: 'offscreen', text: call.text };
      this.callUntil = this.elapsed + t.callMs;
      this.lastCallEnd = this.callUntil;
      this.nextCall++;
    }
    if (s.x >= this.def.deadEnd.triggerX && this.sophie.grounded) {
      this.scroll.stop();
      this.finale = new ChaseFinale(
        this.def.deadEnd,
        { sophie: this.sophie.feet, jimmy: j.feet },
        this.def.view.top,
        this.sfx,
      );
      this.jimmy.history.reset();
      this.line = undefined;
      document.querySelector('#app')!.classList.add('chase-finale');
    }
    return false;
  }
  stepFinale(ms: number) {
    const finale = this.finale!;
    finale.tick(ms);
    const { phase, progress } = finale.state;
    if (finale.combinedJump && !this.combined)
      this.combined = new CombinedSuperJump(this.scene);
    this.combined?.show(finale.combinedJump);
    const visible =
      !finale.combinedJump &&
      !['launch', 'empty', 'punchline', 'fade', 'complete'].includes(phase);
    for (const [name, actor] of [
      ['sophie', this.sophie],
      ['jimmy', this.jimmy.actor],
    ] as const) {
      actor.place(finale.actors[name]);
      actor.sprite
        .setVisible(visible)
        .setAlpha(1)
        .setScale(1)
        .setFlipX(
          ['gotcha', 'quiet', 'home'].includes(phase) ||
            (name === 'sophie' && phase === 'look'),
        );
      if (phase === 'crouch' || phase === 'launch') {
        actor.sprite.anims.stop();
        actor.sprite.setFrame(name === 'jimmy' ? 26 : 27);
      } else
        actor.sprite.play(
          `${name === 'jimmy' ? 'jimmy-' : ''}${phase === 'settle' && progress < 0.9 ? 'walk' : 'idle'}`,
          true,
        );
    }
    this.jimmy.effects.clear();
    this.hud.setFade(finale.fade);
    this.line = finale.line;
    return phase === 'complete';
  }
  present() {
    const { width, height, top } = this.def.view;
    const zoom = Math.min(
      this.scene.scale.width / width,
      this.scene.scale.height / height,
    );
    this.scene.cameras.main
      .setViewport(
        (this.scene.scale.width - width * zoom) / 2,
        (this.scene.scale.height - height * zoom) / 2,
        width * zoom,
        height * zoom,
      )
      .setZoom(zoom)
      .setRoundPixels(true)
      .centerOn(Math.round(this.scroll.x) + width / 2, top + height / 2)
      .setBackgroundColor(0x243d48);
    this.bubble.show(this.line);
    this.edge.clear();
    if (this.scroll.enabled)
      this.edge
        .fillStyle(0xf1bd7b, 0.22)
        .fillRect(Math.round(this.scroll.x), top, 3, height);
  }
  revealText(ms: number) {
    this.bubble.revealText(ms);
  }
  snapshot() {
    return {
      x: this.scroll.x,
      speed: this.scroll.speed,
      enabled: this.scroll.enabled,
      boundary: this.scroll.boundary,
      phase: this.finale?.state.phase ?? 'chase',
      line: this.line?.text,
      nextCall: this.nextCall,
      combinedJump: this.combined?.snapshot(),
    };
  }
  destroy() {
    this.combined?.destroy();
    this.bubble.destroy();
    this.root.remove();
    this.edge.destroy();
    const background = this.previousBackground;
    this.scene.game.config.backgroundColor.setTo(
      background.red,
      background.green,
      background.blue,
      background.alpha,
    );
    document
      .querySelector('#app')!
      .classList.remove('chase-mode', 'chase-finale');
    this.scene.cameras.main
      ?.setViewport(0, 0, this.scene.scale.width, this.scene.scale.height)
      .setZoom(1);
  }
}
