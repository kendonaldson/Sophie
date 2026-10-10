import { maintenance } from '../levels/maintenance';
import { TunnelRun } from '../maintenance/TunnelRun';
import { TunnelArt } from '../maintenance/TunnelArt';
import { tunnelTuning } from '../maintenance/config';
import { ratAppearance } from '../rats/appearance';
import { balloons } from '../levels/balloons';
import { BalloonRun } from '../balloons/BalloonRun';
import { BalloonArt } from '../balloons/BalloonArt';
import { balloonTuning, marqueeAppearance } from '../balloons/config';
import { superJumpAppearance } from '../superJump/appearance';
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
import {
  DebugLevelSelector,
  type DebugSettings,
} from '../../ui/DebugLevelSelector';
import { LevelMusic } from '../audio/LevelMusic';
import type { SfxOutput } from '../audio/Sfx';
import { Player } from '../player/Player';
import { createAnimations } from '../player/animations';
import { overlaps } from '../player/CollisionAssist';
import { atticEscape } from '../levels/atticEscape';
import { warehouse } from '../levels/warehouse';
import { chase } from '../levels/chase';
import { skyscraper } from '../levels/skyscraper';
import { SkyscraperRun } from '../skyscraper/SkyscraperRun';
import { climbTuning } from '../skyscraper/config';
import { SkyscraperArt } from '../rendering/SkyscraperArt';
import { birdAppearance } from '../birds/appearance';
import { ChaseRun } from '../chase/ChaseRun';
import { chaseTuning } from '../chase/config';
import { ChaseArt } from '../rendering/ChaseArt';
import { Checkpoints } from '../levels/Checkpoints';
import { loadLevel } from '../levels/LevelLoader';
import { createTreatTexture, type DogTreat } from '../entities/DogTreat';
import { WorldArt } from '../rendering/WorldArt';
import { WarehouseArt } from '../rendering/WarehouseArt';
import { Effects } from '../rendering/Effects';
import { Machinery } from '../machinery/Machinery';
import { Jimmy } from '../companion/Jimmy';
import { jimmyAppearance } from '../companion/config';
import { FinalSling, shouldStartSling } from '../events/FinalSling';
import type { Hud } from '../../ui/Hud';
import type { LevelDefinition } from '../levels/types';
import type { GameTestApi } from './TestApi';
import { sceneDestinations } from './destinations';
const playableLevel = (id: string) =>
  id === maintenance.id
    ? maintenance
    : id === balloons.id
      ? balloons
      : id === skyscraper.id
        ? skyscraper
        : id === chase.id
          ? chase
          : id === warehouse.id
            ? warehouse
            : atticEscape;
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputSource!: InputSource;
  private orientationBlocked = false;
  private music?: LevelMusic;
  private debugSelector?: DebugLevelSelector;
  private checkpoints!: Checkpoints;
  private treats: DogTreat[] = [];
  private art!:
    WorldArt | WarehouseArt | ChaseArt | SkyscraperArt | BalloonArt | TunnelArt;
  private tunnel?: TunnelRun;
  private sky?: BalloonRun;
  private climb?: SkyscraperRun;
  private chase?: ChaseRun;
  private chaseAttempts = 0;
  private effects!: Effects;
  private machinery?: Machinery;
  private jimmy?: Jimmy;
  private sling?: FinalSling;
  private finaleComplete = false;
  private colliders: Phaser.Physics.Arcade.Collider[] = [];
  private terrain?: Phaser.Physics.Arcade.StaticGroup;
  private accumulator = 0;
  private elapsed = 0;
  private respawnRemaining = 0;
  private endingMs = 0;
  private ending = false;
  private paused = false;
  private manual = false;
  private introMs = 0;
  private fadeInMs = 0;
  private exitWalkMs = 0;
  private followCamera!: FollowCamera;
  private debugFinaleEnabled = true;
  private leavingScene = false;
  private testEntryApplied = false;
  constructor(
    private readonly hud: Hud,
    private readonly sfx: SfxOutput,
    private readonly debugSettings: DebugSettings,
    private level: LevelDefinition = atticEscape,
  ) {
    super('Game');
  }
  init(data: { levelId?: string } = {}) {
    if (data.levelId) this.level = playableLevel(data.levelId);
    this.manual = false;
    this.leavingScene = false;
    this.debugFinaleEnabled = true;
  }
  preload() {
    this.load.spritesheet(
      ratAppearance.key,
      import.meta.env.BASE_URL + ratAppearance.asset,
      {
        frameWidth: ratAppearance.frameSize,
        frameHeight: ratAppearance.frameSize,
      },
    );
    this.load.image(
      marqueeAppearance.key,
      import.meta.env.BASE_URL + marqueeAppearance.asset,
    );
    this.load.spritesheet(
      superJumpAppearance.key,
      import.meta.env.BASE_URL + superJumpAppearance.asset,
      {
        frameWidth: superJumpAppearance.frameWidth,
        frameHeight: superJumpAppearance.frameHeight,
      },
    );
    this.load.spritesheet(
      birdAppearance.key,
      import.meta.env.BASE_URL + birdAppearance.asset,
      {
        frameWidth: birdAppearance.frameSize,
        frameHeight: birdAppearance.frameSize,
      },
    );
    this.load.spritesheet(
      'sophie',
      import.meta.env.BASE_URL + 'assets/sophie.png',
      { frameWidth: 64, frameHeight: 64 },
    );
    this.load.spritesheet(
      jimmyAppearance.key,
      import.meta.env.BASE_URL + jimmyAppearance.asset,
      { frameWidth: 64, frameHeight: 64 },
    );
  }
  create() {
    this.textures
      .get(ratAppearance.key)
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get(birdAppearance.key)
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const key of ['sophie', jimmyAppearance.key]) {
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      createAnimations(this, key);
    }
    createTreatTexture(this);
    this.textures.get('treat').setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.physics.disableUpdate();
    this.physics.world.fixedStep = false;
    const shell = document.querySelector<HTMLElement>('.game-shell')!;
    this.music = new LevelMusic(shell, this.level.music);
    this.inputSource = new CombinedInput(
      new KeyboardInput(),
      new TouchControls(shell, (mode) => {
        this.orientationBlocked = mode === 'mobile-portrait';
        if (this.orientationBlocked) this.sfx.stopJimmySuperJump();
        this.syncMusic();
        this.accumulator = 0;
        this.clearInput();
      }),
    );
    this.buildLevel(
      this.level,
      Boolean(this.level.balloons || this.level.maintenance),
    );
    this.debugSelector = new DebugLevelSelector(
      document.querySelector<HTMLElement>('#app')!,
      sceneDestinations,
      this.level,
      (level) =>
        level.id === 'interlude-1' || level.id === 'interlude-2'
          ? this.startInterlude(
              level.id === 'interlude-2' ? 'Interlude2' : 'Interlude1',
            )
          : this.buildLevel(playableLevel(level.id)),
      this.debugSettings,
    );
    const unbindHud = this.hud.bind(
      () => this.togglePause(),
      () => this.restart(),
      () => (this.ending ? this.buildLevel(atticEscape) : this.togglePause()),
    );
    window.addEventListener('keydown', this.onCommand);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    const cleanup = () => {
      this.events.off('shutdown', cleanup);
      this.events.off('destroy', cleanup);
      this.music?.destroy();
      this.sfx.stopJimmySuperJump();
      this.hud.showDialogue();
      unbindHud();
      this.debugSelector?.destroy();
      this.inputSource.destroy();
      window.removeEventListener('keydown', this.onCommand);
      window.removeEventListener('blur', this.onBlur);
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.effects?.clear();
      this.chase?.destroy();
      this.chase = undefined;
      this.tunnel?.destroy();
      this.tunnel = undefined;
      this.sky?.destroy();
      this.sky = undefined;
      this.climb?.destroy();
      this.climb = undefined;
      this.jimmy?.effects.clear();
      this.colliders = [];
      this.terrain = undefined;
      this.machinery = undefined;
      this.jimmy = undefined;
      delete window.__sophie;
    };
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
    if (
      import.meta.env.DEV &&
      new URLSearchParams(location.search).has('test')
    ) {
      this.installTestApi();
      if (
        !this.testEntryApplied &&
        new URLSearchParams(location.search).has('level')
      )
        this.buildLevel(
          playableLevel(new URLSearchParams(location.search).get('level')!),
        );
      this.testEntryApplied = true;
    }
  }
  private buildLevel(level: LevelDefinition, fade = false) {
    this.sfx.stopJimmySuperJump();
    this.chase?.destroy();
    this.chase = undefined;
    this.tunnel?.destroy();
    this.tunnel = undefined;
    this.sky?.destroy();
    this.sky = undefined;
    this.climb?.destroy();
    this.climb = undefined;
    this.colliders.forEach((c) => c.destroy());
    this.colliders = [];
    this.terrain?.destroy(true);
    this.machinery?.group.destroy(true);
    this.effects?.clear();
    this.jimmy?.effects.clear();
    this.children.removeAll(true);
    this.level = level;
    this.checkpoints = new Checkpoints(level);
    this.chaseAttempts = 0;
    this.sling = undefined;
    this.finaleComplete = false;
    this.ending = false;
    this.paused = false;
    this.endingMs = 0;
    this.respawnRemaining = 0;
    this.elapsed = 0;
    this.accumulator = 0;
    this.exitWalkMs = 0;
    this.introMs = level.theme === 'warehouse' ? 3400 : 0;
    this.fadeInMs = fade
      ? level.maintenance
        ? tunnelTuning.entryFadeMs
        : level.balloons
          ? balloonTuning.entryFadeMs
          : level.skyscraper
            ? climbTuning.entryFadeMs
            : simulation.endingFadeMs
      : 0;
    this.physics.world.setBounds(
      0,
      0,
      level.width,
      level.height,
      true,
      true,
      false,
      false,
    );
    const loaded = loadLevel(this, level);
    this.terrain = loaded.terrain;
    this.treats = loaded.treats;
    this.machinery =
      level.theme === 'warehouse' || level.skyscraper || level.balloons
        ? new Machinery(this, level)
        : undefined;
    const solids = this.machinery?.solids ?? level.platforms;
    this.player = new Player(
      this,
      level.playerSpawn,
      solids,
      physics,
      'sophie',
      this.sfx,
    );
    this.jimmy = level.companionSpawn
      ? new Jimmy(this, level, solids)
      : undefined;
    for (const actor of this.actors) {
      this.colliders.push(
        this.physics.add.collider(actor.sprite, loaded.terrain),
      );
      if (this.machinery)
        this.colliders.push(
          this.physics.add.collider(actor.sprite, this.machinery.group),
        );
    }
    this.art = level.maintenance
      ? new TunnelArt(this, level)
      : level.balloons
        ? new BalloonArt(this, level, this.machinery!)
        : level.skyscraper
          ? new SkyscraperArt(this, level, this.machinery!)
          : level.chase
            ? new ChaseArt(this, level)
            : this.machinery
              ? new WarehouseArt(this, level, this.machinery)
              : new WorldArt(this, level);
    this.effects = new Effects(this);
    this.followCamera = new FollowCamera(this.cameras.main, level);
    this.followCamera.snap(this.player);
    this.clearInput();
    if (level.chase)
      this.chase = new ChaseRun(
        this,
        level,
        this.player,
        this.jimmy!,
        this.hud,
        this.sfx,
      );
    if (level.skyscraper)
      this.climb = new SkyscraperRun(
        this,
        level,
        this.player,
        this.jimmy!,
        this.machinery!,
        this.checkpoints,
        this.treats,
        this.hud,
        this.sfx,
      );
    if (level.balloons)
      this.sky = new BalloonRun(
        this,
        level,
        this.player,
        this.jimmy!,
        this.machinery!,
        this.checkpoints,
        this.treats,
        this.hud,
        this.sfx,
      );
    if (level.maintenance)
      this.tunnel = new TunnelRun(
        this,
        level,
        this.player,
        this.jimmy!,
        this.checkpoints,
        this.treats,
        this.hud,
        this.sfx,
      );
    this.hud.showPause(false);
    this.hud.setFade(fade ? 1 : 0);
    this.hud.setLevel(level);
    this.debugSelector?.setLevel(level);
    this.music?.setVolume(0.5);
    this.music?.setTrack(level.music);
    this.syncMusic();
  }
  private get actors() {
    return this.jimmy ? [this.player, this.jimmy.actor] : [this.player];
  }
  private onCommand = (event: KeyboardEvent) => {
    if (
      event.repeat ||
      (event.target instanceof HTMLElement &&
        event.target.closest('input, select'))
    )
      return;
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
  private syncMusic() {
    this.music?.setActive(
      !this.paused && !this.orientationBlocked && !this.ending,
    );
  }
  private clearInput() {
    this.inputSource?.clear();
    this.player?.controller.clearBufferedInput();
    this.jimmy?.actor.controller.clearBufferedInput();
    this.jimmy?.history.reset();
  }
  private togglePause() {
    if (this.ending) return;
    this.paused = !this.paused;
    if (this.paused) this.sfx.stopJimmySuperJump();
    this.syncMusic();
    this.clearInput();
    this.accumulator = 0;
    this.hud.showPause(this.paused);
    for (const actor of this.actors)
      if (this.paused) actor.sprite.anims.pause();
      else actor.sprite.anims.resume();
  }
  private restart() {
    this.buildLevel(this.level);
    this.music?.restart();
  }
  private beginRespawn() {
    if (
      this.ending ||
      this.respawnRemaining ||
      (this.sling && !this.sling.done) ||
      this.chase?.finale ||
      this.climb?.scripted ||
      this.sky?.finale ||
      this.tunnel?.exit
    )
      return;
    this.paused = false;
    this.syncMusic();
    this.hud.showPause(false);
    this.respawnRemaining = simulation.respawnMs;
    this.clearInput();
  }
  private resetPlayer() {
    if (this.tunnel) {
      this.tunnel.reset();
      this.effects.clear();
      this.accumulator = 0;
      this.clearInput();
      return;
    }
    if (this.sky) {
      this.sky.reset();
      this.effects.clear();
      this.accumulator = 0;
      this.clearInput();
      return;
    }
    if (this.climb) {
      this.climb.reset();
      this.effects.clear();
      this.accumulator = 0;
      this.clearInput();
      return;
    }
    if (this.chase) {
      this.chaseAttempts++;
      // Retry the earned safe anchor without discarding checkpoint progress.
      this.clearInput();
      this.chase.reset(this.checkpoints.spawn);
      this.treats.forEach((t) => t.restore());
      this.effects.clear();
      this.accumulator = 0;
      return;
    }
    const spawn = this.checkpoints.spawn;
    this.machinery?.reset(spawn);
    this.player.respawn(spawn);
    this.jimmy?.reconcile(spawn);
    if (this.jimmy) this.jimmy.enabled = !this.introMs;
    this.hud.showDialogue();
    this.effects.clear();
    this.sling = undefined;
    this.finaleComplete =
      !!this.level.finale && spawn.x >= this.level.finale.landing.x;
    this.treats
      .filter((t) => t.definition.x >= spawn.x)
      .forEach((t) => t.restore());
    this.accumulator = 0;
    this.followCamera.snap(this.player);
    this.music?.setVolume(0.5);
  }
  private step(ms: number, intent: PlayerIntent) {
    if (this.paused || this.orientationBlocked || this.leavingScene) return;
    this.music?.step(ms);
    this.elapsed += ms;
    for (const treat of this.treats) treat.step(ms);
    if (this.fadeInMs > 0) {
      this.fadeInMs = Math.max(0, this.fadeInMs - ms);
      this.hud.setFade(
        this.fadeInMs /
          (this.tunnel
            ? tunnelTuning.entryFadeMs
            : this.sky
              ? balloonTuning.entryFadeMs
              : this.climb
                ? climbTuning.entryFadeMs
                : simulation.endingFadeMs),
      );
      return;
    }
    if (this.ending) {
      if (this.level.chase || this.climb || this.sky || this.tunnel) return;
      this.endingMs += ms;
      this.hud.setFade(Math.min(1, this.endingMs / simulation.endingFadeMs));
      if (this.endingMs >= simulation.endingFadeMs) {
        if (this.level.nextLevel === 'warehouse')
          this.buildLevel(warehouse, true);
        else this.startInterlude();
      }
      return;
    }
    if (this.respawnRemaining > 0) {
      this.respawnRemaining = Math.max(0, this.respawnRemaining - ms);
      this.hud.setFade(
        Math.sin((this.respawnRemaining / simulation.respawnMs) * Math.PI) *
          0.8,
      );
      if (!this.respawnRemaining) {
        this.resetPlayer();
        this.hud.setFade(0);
      }
      return;
    }
    if (this.tunnel?.exit) {
      if (this.tunnel.stepExit(ms)) {
        this.ending = true;
        this.syncMusic();
        this.hud.showEnding();
      }
      return;
    }
    if (this.sky?.finale) {
      if (this.sky.stepFinale(ms)) this.buildLevel(maintenance, true);
      return;
    }
    if (this.chase?.finale) {
      if (this.chase.stepFinale(ms)) {
        this.buildLevel(skyscraper, true);
        return;
      }
      if (this.chase.finale.state.phase === 'empty') this.effects.clear();
      else this.effects.update(ms, this.player.sprite, false);
      return;
    }
    const climbPhase = this.climb?.ride?.phase;
    if (this.climb?.stepScript(ms)) {
      if (climbPhase !== 'fade' && this.climb.ride?.phase === 'fade')
        this.music?.fadeOut(climbTuning.endingFadeMs);
      this.clearInput();
      if (this.climb.complete) {
        this.startInterlude('Interlude2');
      }
      return;
    }
    if (this.chase) intent = this.chase.intent(ms, intent);
    if (this.exitWalkMs > 0) {
      this.exitWalkMs = Math.max(0, this.exitWalkMs - ms);
      const door = this.level.exit;
      const target = door.x + 25;
      this.player.place({
        x: Math.min(target, this.player.feet.x + ms * 0.15),
        y: door.y + door.height,
      });
      if (this.jimmy)
        this.jimmy.actor.place({
          x: Math.min(target - 4, this.jimmy.actor.feet.x + ms * 0.25),
          y: door.y + door.height,
        });
      this.player.sprite.play('walk', true);
      this.jimmy?.actor.sprite.play('jimmy-walk', true);
      this.player.sprite.setAlpha(Math.min(1, this.exitWalkMs / 200));
      this.jimmy?.actor.sprite.setAlpha(Math.min(1, this.exitWalkMs / 150));
      if (!this.exitWalkMs) {
        if (this.art instanceof WarehouseArt) this.art.doorClosed = true;
        this.finishLevel();
      }
      return;
    }
    if (this.sling && !this.sling.done) {
      this.sling.step(ms);
      if (this.sling.done) {
        this.finaleComplete = true;
        this.jimmy?.history.reset();
        this.clearInput();
        this.checkpoints.update(this.player.feet, true);
      }
      return;
    }
    if (this.introMs > 0) {
      this.introMs = Math.max(0, this.introMs - ms);
      this.hud.showDialogue(
        this.introMs > 1700
          ? 'Things get a lot harder from here.'
          : 'Want me to come with you?',
      );
      if (!this.introMs) {
        this.hud.showDialogue();
        this.jimmy!.enabled = true;
        this.clearInput();
      }
      intent = noInput();
    }
    const elevatorBefore = this.machinery?.elevatorState;
    this.machinery?.step(ms, this.actors);
    const elevator = this.machinery?.elevatorSurface;
    const riding =
      this.machinery &&
      ['closing', 'riding', 'opening'].includes(this.machinery.elevatorState);
    if (riding && elevator && this.jimmy) {
      if (elevatorBefore === 'waiting') {
        this.jimmy.history.reset();
      }
      // He walks into the open left door during closing. Only a stranded
      // follower is reconciled once the cage obscures the entrance.
      if (
        elevatorBefore === 'closing' &&
        this.machinery!.elevatorState === 'riding'
      ) {
        if (
          this.jimmy.actor.feet.x < elevator.x + 20 ||
          Math.abs(this.jimmy.actor.feet.y - elevator.y) > 8
        )
          this.jimmy.reconcile({ x: elevator.x + 110, y: elevator.y });
        this.jimmy.enabled = false;
      }
      intent = { ...noInput(), moveX: intent.moveX };
      this.music?.setVolume(0.2);
      this.hud.showDialogue(
        this.machinery!.elevatorState === 'riding'
          ? 'UPPER WAREHOUSE'
          : 'FREIGHT LIFT',
        '↑',
      );
    } else if (
      elevatorBefore === 'opening' &&
      this.machinery?.elevatorState === 'arrived'
    ) {
      this.hud.showDialogue('Upper floor', 'DING');
      this.jimmy!.enabled = true;
      this.jimmy!.history.reset();
      this.music?.setVolume(0.5);
    } else if (
      !this.introMs &&
      this.machinery?.elevatorState === 'arrived' &&
      this.player.feet.x >
        this.level.elevator!.x + this.level.elevator!.width + 35
    )
      this.hud.showDialogue();
    const wasGrounded = this.player.grounded;
    const movement = this.player.beforeStep(
      ms,
      intent,
      this.debugSelector?.infiniteDash,
    );
    this.machinery?.transferJump(this.player, movement.jumped);
    if (movement.jumped)
      this.effects.dust(this.player.feet.x, this.player.feet.y);
    if (this.jimmy) {
      const mirror = this.jimmy.beforeStep(
        ms,
        intent,
        this.machinery?.elevatorState === 'closing'
          ? elevator!.x + 75
          : this.introMs > 0 && this.introMs < 1700
            ? this.level.playerSpawn.x - 15
            : undefined,
      );
      this.machinery?.transferJump(this.jimmy.actor, mirror.jumped);
      if (mirror.jumped)
        this.jimmy.effects.dust(
          this.jimmy.actor.feet.x,
          this.jimmy.actor.feet.y,
        );
    }
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
      // Deliberately only Sophie: Jimmy cannot consume or mutate this economy.
      if (treat.touches(this.player.body)) {
        treat.collect();
        this.player.controller.dash.collectTreat();
        this.effects.dust(treat.definition.x, treat.definition.y, 0xffdfa4, 12);
        this.hud.treatPop(this.player.controller.dash.charges);
      }
    }
    this.checkpoints.update(this.player.feet, this.player.grounded);
    if (!riding && !this.chase && !this.climb && !this.sky && !this.tunnel)
      this.jimmy?.afterStep(
        ms,
        this.player,
        this.checkpoints.spawn,
        this.machinery?.waitingAtGate(this.jimmy.actor),
      );
    if (this.tunnel) {
      if (this.tunnel.afterStep(ms)) this.beginRespawn();
      if (this.tunnel.exit) {
        this.clearInput();
        this.effects.clear();
      }
    }
    if (this.sky) {
      if (this.sky.afterStep(ms)) this.beginRespawn();
      if (this.sky.finale) {
        this.clearInput();
        this.effects.clear();
        this.music?.setVolume(0.25);
      }
    }
    if (this.climb) {
      if (this.climb.afterStep(ms)) this.beginRespawn();
      if (this.climb.scripted) this.clearInput();
    }
    if (this.chase) {
      if (this.chase.afterStep(ms)) this.beginRespawn();
      if (this.chase.finale) {
        this.clearInput();
        this.music?.fadeOut(chaseTuning.musicFadeMs);
        this.syncMusic();
      }
    }
    const fallY =
      this.level.theme === 'warehouse'
        ? Math.min(this.level.fallY, this.checkpoints.spawn.y + 260)
        : this.level.fallY;
    if (!this.climb && !this.sky && !this.tunnel && this.player.feet.y > fallY)
      this.beginRespawn();
    const finale = this.level.finale;
    if (
      finale &&
      this.jimmy &&
      !this.finaleComplete &&
      this.debugFinaleEnabled &&
      shouldStartSling(
        finale,
        this.player.feet,
        this.player.grounded,
        this.player.body.velocity.y,
      )
    ) {
      this.clearInput();
      this.sling = new FinalSling(
        finale,
        this.player,
        this.jimmy.actor,
        this.sfx,
      );
    }
    if (
      !this.chase &&
      !this.climb &&
      !this.sky &&
      !this.tunnel &&
      overlaps(this.player.body, this.level.exit)
    ) {
      this.clearInput();
      if (this.jimmy && this.finaleComplete) this.exitWalkMs = 750;
      else if (!this.jimmy) this.finishLevel();
    }
  }
  private finishLevel() {
    this.ending = true;
    this.endingMs = 0;
    this.hud.showDialogue();
    this.player.body.setVelocity(0, 0);
    this.clearInput();
    this.syncMusic();
  }
  private startInterlude(scene = 'Interlude1') {
    if (this.leavingScene) return;
    this.leavingScene = true;
    this.clearInput();
    this.scene.start(scene);
  }
  update(_time: number, delta: number) {
    if (this.leavingScene) return;
    if (!this.paused && !this.orientationBlocked)
      this.hud.revealDialogue(Math.min(delta, simulation.maxFrameMs));
    if (!this.manual && !this.paused && !this.orientationBlocked) {
      this.accumulator += Math.min(delta, simulation.maxFrameMs);
      while (this.accumulator >= simulation.stepMs) {
        this.accumulator -= simulation.stepMs;
        this.step(simulation.stepMs, this.inputSource.sample());
        if (this.leavingScene) return;
      }
    }
    if (
      (!this.sling || this.sling.done) &&
      !this.exitWalkMs &&
      !this.chase?.finale &&
      !this.climb?.scripted &&
      !this.sky?.finale &&
      !this.tunnel?.exit
    ) {
      this.player.render();
      this.jimmy?.actor.render();
    }
    if (this.tunnel)
      this.tunnel.present(
        this.paused || this.orientationBlocked
          ? 0
          : Math.min(delta, simulation.maxFrameMs),
      );
    else if (this.sky)
      this.sky.present(
        this.paused || this.orientationBlocked
          ? 0
          : Math.min(delta, simulation.maxFrameMs),
      );
    else if (this.chase) {
      this.chase.present();
      if (!this.paused && !this.orientationBlocked)
        this.chase.revealText(Math.min(delta, simulation.maxFrameMs));
    } else if (this.climb)
      this.climb.present(
        this.paused || this.orientationBlocked
          ? 0
          : Math.min(delta, simulation.maxFrameMs),
      );
    else
      this.followCamera.update(
        Math.min(delta, simulation.maxFrameMs),
        this.player,
      );
    const c = this.cameras.main;
    if (this.art instanceof TunnelArt)
      this.art.update(
        this.tunnel!.view,
        this.elapsed,
        this.tunnel!.steam.snapshot(),
      );
    else if (this.art instanceof BalloonArt)
      this.art.update(
        this.sky!.view,
        this.elapsed,
        this.sky!.finale?.scentMs ?? 0,
      );
    else if (this.art instanceof SkyscraperArt)
      this.art.update(this.climb!.view.x, this.climb!.view.y);
    else if (this.art instanceof WarehouseArt)
      this.art.update(c.width, c.height, c.scrollX, c.scrollY, c.zoom);
    else if (this.art instanceof ChaseArt) this.art.update();
    else this.art.update(c.width, c.height, c.scrollX);
    const section = this.climb
      ? { ...this.climb.section, tutorial: undefined }
      : ([...this.level.sections]
          .reverse()
          .find((s) => s.fromX <= this.player.feet.x) ??
        this.level.sections[0]!);
    const dash = this.player.controller.dash;
    this.hud.update(
      this.debugSelector?.infiniteDash ? physics.maxDashCharges : dash.charges,
      dash.rechargeProgress,
      this.player.grounded,
      section.title,
      section.hint,
      section.tutorial,
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
        jimmy: this.jimmy
          ? {
              ...this.jimmy.actor.feet,
              vx: this.jimmy.actor.body.velocity.x,
              vy: this.jimmy.actor.body.velocity.y,
              state: this.jimmy.actor.controller.state,
              enabled: this.jimmy.enabled,
              recoveries: this.jimmy.recoveries,
              intent: { ...this.jimmy.lastIntent },
            }
          : undefined,
        machinery: this.machinery?.snapshot(),
        elevator: this.machinery?.elevatorState,
        gates: this.machinery?.gates.map((g) => ({
          id: g.definition.id,
          open: g.open,
        })),
        chase: this.chase
          ? { ...this.chase.snapshot(), attempts: this.chaseAttempts }
          : undefined,
        climb: this.climb?.snapshot(),
        balloons: this.sky?.snapshot(),
        maintenance: this.tunnel?.snapshot(),
        characters: this.children.list
          .filter(
            (c) =>
              c instanceof Phaser.GameObjects.Sprite &&
              c.texture.key !== superJumpAppearance.key,
          )
          .map((c) => c.name || (c as Phaser.GameObjects.Sprite).texture.key),
        intro: this.introMs > 0 || Boolean(this.climb?.arrivalMs),
        finale: this.sling?.phase,
        finaleComplete: this.finaleComplete,
      }),
      manual: (enabled) => {
        this.manual = enabled;
        this.accumulator = 0;
        this.clearInput();
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
      advanceInput: (frames) => {
        for (let i = 0; i < frames; i++)
          this.step(simulation.stepMs, this.inputSource.sample());
        return api.snapshot();
      },
      restart: () => this.restart(),
      loadLevel: (id) => this.buildLevel(playableLevel(id)),
      chaseSection: (x) => {
        if (!this.chase) throw new Error('Not in the chase');
        const platform = [...this.level.platforms]
          .reverse()
          .find((p) => x >= p.x + 16 && x <= p.x + p.width - 16);
        if (!platform) throw new Error('No safe chase platform');
        this.player.respawn({ x, y: platform.y });
        this.jimmy!.reconcile(this.player.feet);
        this.chase.scroll.x = Math.max(
          0,
          x - this.level.chase!.scroll.lookAhead,
        );
      },
      checkpoint: (id) => {
        this.introMs = 0;
        this.hud.showDialogue();
        this.checkpoints.restore(id);
        this.resetPlayer();
        if (this.jimmy) this.jimmy.enabled = true;
      },
      platform: (id) => {
        const p = this.machinery?.surfaces.find((p) => p.id === id);
        if (!p) throw new Error('Unknown platform ' + id);
        this.introMs = 0;
        this.hud.showDialogue();
        this.player.respawn({ x: p.x + p.width / 2, y: p.y });
        this.jimmy?.reconcile(this.player.feet);
      },
      finaleEnabled: (enabled) => {
        this.debugFinaleEnabled = enabled;
      },
      place: (point, companion = false) => {
        (companion ? this.jimmy!.actor : this.player).respawn(point);
      },
    };
    window.__sophie = api;
  }
}
