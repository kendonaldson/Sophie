import Phaser from 'phaser';
import { physics, simulation } from '../config/physics';
import { FollowCamera } from '../rendering/FollowCamera';
import {
  KeyboardInput,
  noInput,
  type PlayerIntent,
  type InputSource,
} from '../input/Input';
import { CombinedInput } from '../input/CombinedInput';
import { TouchControls } from '../../ui/mobile/TouchControls';
import { Player } from '../player/Player';
import { createAnimations } from '../player/animations';
import { overlaps } from '../player/CollisionAssist';
import { atticEscape } from '../levels/atticEscape';
import { Checkpoints } from '../levels/Checkpoints';
import { loadLevel } from '../levels/LevelLoader';
import { createTreatTexture, type DogTreat } from '../entities/DogTreat';
import { WorldArt } from '../rendering/WorldArt';
import { Effects } from '../rendering/Effects';
import type { Hud } from '../../ui/Hud';
import type { LevelDefinition } from '../levels/types';
import type { GameTestApi } from './TestApi';
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputSource!: InputSource;
  private orientationBlocked = false;
  private checkpoints: Checkpoints;
  private treats: DogTreat[] = [];
  private art!: WorldArt;
  private effects!: Effects;
  private accumulator = 0;
  private elapsed = 0;
  private respawnRemaining = 0;
  private endingMs = 0;
  private ending = false;
  private paused = false;
  private manual = false;
  private followCamera!: FollowCamera;
  private hud: Hud;
  constructor(
    hud: Hud,
    private readonly level: LevelDefinition = atticEscape,
  ) {
    super('Game');
    this.hud = hud;
    this.checkpoints = new Checkpoints(level);
  }
  preload() {
    this.load.spritesheet(
      'sophie',
      `${import.meta.env.BASE_URL}assets/sophie.png`,
      { frameWidth: 64, frameHeight: 64 },
    );
  }
  create() {
    this.textures.get('sophie').setFilter(Phaser.Textures.FilterMode.NEAREST);
    createAnimations(this);
    createTreatTexture(this);
    this.textures.get('treat').setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.physics.disableUpdate();
    this.physics.world.fixedStep = false;
    this.physics.world.setBounds(
      0,
      0,
      this.level.width,
      this.level.height,
      true,
      true,
      false,
      false,
    );
    const loaded = loadLevel(this, this.level);
    this.treats = loaded.treats;
    this.art = new WorldArt(this, this.level);
    this.effects = new Effects(this);
    this.player = new Player(
      this,
      this.level.playerSpawn,
      this.level.platforms,
    );
    this.physics.add.collider(this.player.sprite, loaded.terrain);
    this.inputSource = new CombinedInput(
      new KeyboardInput(),
      new TouchControls(document.querySelector('.game-shell')!, (mode) => {
        this.orientationBlocked = mode === 'mobile-portrait';
        this.accumulator = 0;
        this.inputSource?.clear();
      }),
    );
    this.followCamera = new FollowCamera(this.cameras.main, this.level);
    this.hud.bind(
      () => this.togglePause(),
      () => this.beginRespawn(),
      () => (this.ending ? this.restart() : this.togglePause()),
    );
    window.addEventListener('keydown', this.onCommand);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.once('shutdown', () => {
      this.inputSource.destroy();
      window.removeEventListener('keydown', this.onCommand);
      window.removeEventListener('blur', this.onBlur);
      document.removeEventListener('visibilitychange', this.onVisibility);
      delete window.__sophie;
    });
    this.followCamera.snap(this.player);
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('test'))
      this.installTestApi();
  }
  private onCommand = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      this.togglePause();
    }
    if (event.code === 'KeyR') this.beginRespawn();
  };
  private onBlur = () => {
    if (!this.manual && !this.ending && !this.paused) this.togglePause();
  };
  private onVisibility = () => {
    if (document.hidden) this.onBlur();
  };
  private togglePause() {
    if (this.ending) return;
    this.paused = !this.paused;
    this.inputSource.clear();
    this.accumulator = 0;
    this.hud.showPause(this.paused);
    if (this.paused) this.player.sprite.anims.pause();
    else this.player.sprite.anims.resume();
  }
  private restart() {
    this.ending = false;
    this.endingMs = 0;
    this.paused = false;
    this.checkpoints.reset();
    this.treats.forEach((t) => t.restore());
    this.hud.showPause(false);
    this.hud.setFade(0);
    this.resetPlayer();
  }
  private beginRespawn() {
    if (this.ending || this.respawnRemaining) return;
    this.paused = false;
    this.hud.showPause(false);
    this.respawnRemaining = simulation.respawnMs;
    this.inputSource.clear();
  }
  private resetPlayer() {
    const spawn = this.checkpoints.spawn;
    this.player.respawn(spawn);
    this.effects.clear();
    // Traversal resources ahead of this safe anchor return on every attempt.
    this.treats
      .filter((t) => t.definition.x >= spawn.x)
      .forEach((t) => t.restore());
    this.accumulator = 0;
    this.followCamera.snap(this.player);
  }
  private step(ms: number, intent: PlayerIntent) {
    if (this.paused || this.orientationBlocked) return;
    this.elapsed += ms;
    if (this.ending) {
      this.endingMs += ms;
      this.hud.setFade(Math.min(1, this.endingMs / simulation.endingFadeMs));
      if (this.endingMs >= simulation.endingFadeMs) this.hud.showEnding();
      return;
    }
    if (this.respawnRemaining > 0) {
      this.respawnRemaining = Math.max(0, this.respawnRemaining - ms);
      this.hud.setFade(
        Math.sin((this.respawnRemaining / simulation.respawnMs) * Math.PI) *
          0.8,
      );
      if (this.respawnRemaining === 0) {
        this.resetPlayer();
        this.hud.setFade(0);
      }
      return;
    }
    const wasGrounded = this.player.grounded;
    const movement = this.player.beforeStep(ms, intent);
    if (movement.jumped)
      this.effects.dust(this.player.feet.x, this.player.feet.y);
    this.physics.world.update(this.elapsed, ms);
    this.physics.world.postUpdate();
    if (!wasGrounded && this.player.grounded)
      this.effects.dust(this.player.feet.x, this.player.feet.y);
    this.effects.update(
      ms,
      this.player.sprite,
      this.player.controller.dash.active,
    );
    for (const treat of this.treats) {
      treat.update(this.elapsed);
      if (treat.touches(this.player.body)) {
        treat.collect();
        this.player.controller.dash.collectTreat();
        this.effects.dust(treat.definition.x, treat.definition.y, 0xffdfa4, 12);
        this.hud.treatPop(this.player.controller.dash.charges);
      }
    }
    this.checkpoints.update(this.player.feet, this.player.grounded);
    if (this.player.feet.y > this.level.fallY) this.beginRespawn();
    if (overlaps(this.player.body, this.level.exit)) {
      this.ending = true;
      this.player.body.setVelocity(0, 0);
      this.inputSource.clear();
    }
  }
  update(_time: number, delta: number) {
    if (!this.manual && !this.paused && !this.orientationBlocked) {
      this.accumulator += Math.min(delta, simulation.maxFrameMs);
      while (this.accumulator >= simulation.stepMs) {
        this.accumulator -= simulation.stepMs;
        this.step(simulation.stepMs, this.inputSource.sample());
      }
    }
    this.player.render();
    this.followCamera.update(
      Math.min(delta, simulation.maxFrameMs),
      this.player,
    );
    const c = this.cameras.main;
    this.art.update(c.width, c.height, c.scrollX);
    const section =
      [...this.level.sections]
        .reverse()
        .find((s) => s.fromX <= this.player.feet.x) ?? this.level.sections[0]!;
    const dash = this.player.controller.dash;
    this.hud.update(
      dash.charges,
      dash.rechargeProgress,
      this.player.grounded,
      section.title,
      section.hint,
    );
  }
  private installTestApi() {
    const api: GameTestApi = {
      snapshot: () => ({
        x: this.player.feet.x,
        y: this.player.feet.y,
        vx: this.player.body.velocity.x,
        vy: this.player.body.velocity.y,
        grounded: this.player.grounded,
        charges: this.player.controller.dash.charges,
        rechargeMs: this.player.controller.dash.groundedMs,
        state: this.player.controller.state,
        checkpoint: this.checkpoints.id,
        respawning: this.respawnRemaining > 0,
        ending: this.ending,
        paused: this.paused,
        treats: this.treats
          .filter((t) => t.collected)
          .map((t) => t.definition.id),
        physics: { ...physics },
        levelId: this.level.id,
        viewport: { width: this.scale.width, height: this.scale.height },
      }),
      manual: (enabled) => {
        this.manual = enabled;
        this.accumulator = 0;
        this.inputSource.clear();
      },
      advance: (frames, intent = {}) => {
        for (let i = 0; i < frames; i++)
          this.step(simulation.stepMs, {
            ...noInput(),
            ...intent,
            jumpPressed: i === 0 && Boolean(intent.jumpPressed),
            dashPressed: i === 0 && Boolean(intent.dashPressed),
          });
        return api.snapshot();
      },
      restart: () => this.restart(),
    };
    window.__sophie = api;
  }
}
