import { RooftopDirector } from '../story/RooftopDirector';
import { KitchenDirector } from '../story/KitchenDirector';
import { KitchenStage } from '../story/KitchenStage';
import { kitchenGeometry } from '../story/KitchenArt';
import { interlude3 } from '../story/interlude3';
import {
  RooftopArt,
  rooftopGeometry,
  balloonPositions,
} from '../story/RooftopArt';
import { interlude2 } from '../story/interlude2';
import { CombinedSuperJump } from '../superJump/CombinedSuperJump';
import Phaser from 'phaser';
import type { Hud } from '../../ui/Hud';
import { StoryDialogue } from '../../ui/StoryDialogue';
import {
  DebugLevelSelector,
  type DebugSettings,
} from '../../ui/DebugLevelSelector';
import { DialogueInput } from '../input/DialogueInput';
import { createAnimations } from '../player/animations';
import { Effects } from '../rendering/Effects';
import { drawInterludeExterior } from '../story/InterludeArt';
import { InterludeDirector } from '../story/InterludeDirector';
import { interlude1 as c } from '../story/interlude1';
import { interludeFrame } from '../story/framing';
import {
  sceneDestinations,
  storyScenes,
  storySceneKey,
  type StoryId,
} from './destinations';
import type { StoryTestApi } from './TestApi';
import type { SfxOutput } from '../audio/Sfx';

export class InterludeScene extends Phaser.Scene {
  private director: InterludeDirector | RooftopDirector | KitchenDirector =
    new InterludeDirector();
  private rooftop?: RooftopArt;
  private kitchen?: KitchenStage;
  private combined?: CombinedSuperJump;
  private sophie!: Phaser.GameObjects.Sprite;
  private jimmy!: Phaser.GameObjects.Sprite;
  private effects!: Effects[];
  private alertAccent!: Phaser.GameObjects.Graphics;
  private dialogue!: StoryDialogue;
  private inputSource!: DialogueInput;
  private paused = false;
  private orientationBlocked = false;
  private manual = false;
  private ended = false;
  constructor(
    private readonly hud: Hud,
    private readonly sfx: SfxOutput,
    private readonly debugSettings: DebugSettings,
    private readonly storyId: StoryId = 'interlude-1',
  ) {
    super(storyScenes[storyId]);
  }
  create() {
    // The fixed shot leaves side margins on wide phones; clear them to night too.
    const previousBackground = this.game.config.backgroundColor.clone();
    this.game.config.backgroundColor.setTo(24, 46, 56);
    const rooftop = this.storyId === 'interlude-2';
    const kitchen = this.storyId === 'interlude-3';
    if (kitchen) this.game.config.backgroundColor.setTo(244, 227, 189);
    this.director = kitchen
      ? new KitchenDirector(this.sfx)
      : rooftop
        ? new RooftopDirector(this.sfx)
        : new InterludeDirector();
    this.rooftop = undefined;
    this.kitchen = undefined;
    this.combined = undefined;
    this.paused = false;
    this.manual = false;
    this.ended = false;
    this.hud.showPause(false);
    this.hud.showDialogue();
    this.hud.setFade(1);
    document.querySelector('.chapter > span:last-child')!.textContent = kitchen
      ? 'Interlude 3 · Mission accomplished'
      : rooftop
        ? 'Interlude 2 · One balloon'
        : 'Interlude 1 · Outside the warehouse';
    document.querySelector('.chapter-number')!.textContent = kitchen
      ? 'INTERLUDE 3'
      : rooftop
        ? 'INTERLUDE 2'
        : 'INTERLUDE 1';
    document
      .querySelector('#world')!
      .setAttribute(
        'aria-label',
        kitchen
          ? "Sophie and Jimmy meet Shelly in the bright kitchen of Shelly's Pizza"
          : rooftop
            ? 'Sophie and Jimmy on the rooftop above the city'
            : 'Sophie and Jimmy talking beside the warehouse on a quiet nighttime road',
      );
    document.querySelector('#hint')!.textContent = kitchen
      ? 'The scene plays automatically · X to continue a line'
      : 'X · Continue the conversation';
    if (kitchen) this.kitchen = new KitchenStage(this);
    else if (rooftop) {
      this.rooftop = new RooftopArt(this);
      this.combined = new CombinedSuperJump(this, interlude2.spriteScale);
    } else drawInterludeExterior(this);
    for (const texture of ['sophie', 'jimmy']) {
      this.textures.get(texture).setFilter(Phaser.Textures.FilterMode.NEAREST);
      createAnimations(this, texture);
    }
    this.sophie = this.add
      .sprite(c.sophieX, c.feetY, 'sophie')
      .setName('Sophie');
    this.jimmy = this.add.sprite(c.jimmyX, c.feetY, 'jimmy').setName('Jimmy');
    for (const sprite of [this.sophie, this.jimmy])
      sprite
        .setOrigin(0.5, 58 / 64)
        .setScale(c.spriteScale)
        .setDepth(10);
    this.effects = [new Effects(this), new Effects(this)];
    this.alertAccent = this.add
      .graphics()
      .setDepth(11)
      .fillStyle(0xf5d694)
      .fillRect(c.sophieX + 8, c.feetY - 84, 3, 8)
      .fillRect(c.sophieX + 8, c.feetY - 73, 3, 3);
    const shell = document.querySelector<HTMLElement>('.game-shell')!;
    this.dialogue = new StoryDialogue(
      shell,
      this.advance,
      (blocked) => {
        this.orientationBlocked = blocked;
        if (blocked) {
          this.sfx.stopJimmySuperJump();
          this.sfx.stopPizza();
        }
        this.inputSource?.clear();
      },
      this.sfx,
    );
    this.inputSource = new DialogueInput(this.advance);
    const selector = new DebugLevelSelector(
      document.querySelector('#app')!,
      sceneDestinations,
      kitchen ? interlude3 : rooftop ? interlude2 : c,
      (destination) => {
        if (destination.id === this.storyId) this.scene.restart();
        else if (storySceneKey(destination.id))
          this.scene.start(storySceneKey(destination.id));
        else this.scene.start('Game', { levelId: destination.id });
      },
      this.debugSettings,
    );
    const unbindHud = this.hud.bind(
      this.togglePause,
      () => this.scene.restart(),
      () => {
        if (this.ended) this.scene.start('Game', { levelId: 'attic-escape' });
        else this.togglePause();
      },
    );
    window.addEventListener('keydown', this.command);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    this.scale.on('resize', this.frame);
    this.frame();
    this.present(0);
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('test'))
      this.installTestApi();
    const cleanup = () => {
      this.events.off('shutdown', cleanup);
      this.events.off('destroy', cleanup);
      unbindHud();
      this.sfx.stopJimmySuperJump();
      this.sfx.stopPizza();
      this.combined?.destroy();
      selector.destroy();
      this.dialogue.destroy();
      this.inputSource.destroy();
      this.effects.forEach((effect) => effect.clear());
      this.scale.off('resize', this.frame);
      window.removeEventListener('keydown', this.command);
      window.removeEventListener('blur', this.blur);
      document.removeEventListener('visibilitychange', this.visibility);
      this.hud.setFade(0);
      this.game.config.backgroundColor.setTo(
        previousBackground.red,
        previousBackground.green,
        previousBackground.blue,
        previousBackground.alpha,
      );
      delete window.__sophieStory;
    };
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
  }
  private frame = () => {
    const f = interludeFrame(this.scale.width, this.scale.height);
    this.cameras.main
      .setViewport(f.x, f.y, f.width, f.height)
      .setZoom(f.zoom)
      .centerOn(c.width / 2, c.height / 2)
      .setBackgroundColor(this.storyId === 'interlude-3' ? 0xf4e3bd : 0x182e38);
  };
  private advance = () => {
    if (this.paused || this.orientationBlocked) return;
    this.director.advance();
    this.present(0);
  };
  private togglePause = () => {
    if (this.ended) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.sfx.stopJimmySuperJump();
      this.sfx.stopPizza();
    }
    this.inputSource.clear();
    this.hud.showPause(this.paused);
  };
  private command = (event: KeyboardEvent) => {
    if (
      event.code !== 'Escape' ||
      event.repeat ||
      (event.target instanceof HTMLElement &&
        event.target.closest('input, select'))
    )
      return;
    event.preventDefault();
    this.togglePause();
  };
  private blur = () => {
    if (!this.paused && !this.ended) this.togglePause();
  };
  private visibility = () => {
    if (document.hidden) this.blur();
  };
  update(_time: number, delta: number) {
    const ms =
      !this.manual && !this.paused && !this.orientationBlocked
        ? Math.min(delta, 100)
        : 0;
    this.director.tick(ms);
    this.present(ms);
    if (!this.paused && !this.orientationBlocked)
      this.dialogue.revealText(Math.min(delta, 100));
  }
  private present(ms: number) {
    const actors = this.director.actors;
    const rooftop =
      this.director instanceof RooftopDirector ? this.director : undefined;
    const kitchen =
      this.director instanceof KitchenDirector ? this.director : undefined;
    if (kitchen)
      this.kitchen!.update(
        kitchen,
        this.sophie,
        ms,
        this.paused || this.orientationBlocked,
      );
    if (rooftop) {
      this.rooftop!.update(rooftop.environment, rooftop.liftY, rooftop.dayMs);
      this.combined!.show(rooftop.combinedJump);
      const day = rooftop.environment === 'day';
      this.cameras.main.setBackgroundColor(day ? 0x9bc9d3 : 0x182e38);
      this.game.config.backgroundColor.setTo(
        day ? 155 : 24,
        day ? 201 : 46,
        day ? 211 : 56,
      );
    }
    this.alertAccent.setVisible(
      this.director.phase === 'dialogue' &&
        Boolean(
          this.director.line &&
          'cue' in this.director.line &&
          this.director.line.cue === 'alert',
        ),
    );
    for (const [index, name] of (['sophie', 'jimmy'] as const).entries()) {
      const sprite = this[name],
        actor = actors[name];
      sprite
        .setPosition(Math.round(actor.x), Math.round(actor.y))
        .setFlipX(actor.flipX)
        .setVisible(!('visible' in actor) || actor.visible);
      if (name === 'sophie' && kitchen?.power.active) {
        // KitchenStage already selected the temporary power texture/animation.
      } else if (actor.pose === 'jump') {
        sprite.anims.stop();
        sprite.setFrame(name === 'jimmy' ? 26 : 27);
      } else
        sprite.play(`${name === 'sophie' ? '' : 'jimmy-'}${actor.pose}`, true);
      if (this.paused || this.orientationBlocked) sprite.anims.pause();
      else sprite.anims.resume();
      this.effects[index]!.update(
        ms,
        sprite,
        (this.director instanceof InterludeDirector && this.director.running) ||
          (name === 'sophie' &&
            Boolean(kitchen && (kitchen.dash.active || kitchen.superMoving))),
      );
    }
    this.hud.setFade(this.director.fade);
    const visible =
      this.director.phase === 'dialogue' || this.director.phase === 'escape';
    this.dialogue.show(
      visible ? this.director.line : undefined,
      this.director.canAdvance && !this.paused && !this.orientationBlocked,
      this.director.phase !== 'escape',
    );
    const speaker =
      kitchen?.line?.speaker === 'shelly'
        ? kitchen.actors.shelly
        : this.director.line?.speaker === 'jimmy'
          ? actors.jimmy
          : actors.sophie;
    const canvas = this.game.canvas.getBoundingClientRect();
    const shell = document
      .querySelector('.game-shell')!
      .getBoundingClientRect();
    const f = interludeFrame(this.scale.width, this.scale.height);
    const scale = canvas.width / this.scale.width;
    this.dialogue.anchor(
      canvas.left - shell.left + (f.x + speaker.x * f.zoom) * scale,
      canvas.top -
        shell.top +
        (f.y +
          (speaker.y - (kitchen?.line?.speaker === 'shelly' ? 102 : 74)) *
            f.zoom) *
          scale,
    );
    if (this.director.phase === 'complete' && !this.ended) {
      this.ended = true;
      this.inputSource.clear();
      if (kitchen) {
        this.sfx.stopPizza();
        this.hud.showEnding();
      } else if (rooftop) this.scene.start('Game', { levelId: 'balloons' });
      else this.scene.start('Game', { levelId: 'the-chase' });
    }
  }
  private installTestApi() {
    const api: StoryTestApi = {
      snapshot: () => ({
        storyId: this.storyId,
        environment:
          this.director instanceof RooftopDirector
            ? this.director.environment
            : undefined,
        geometry: this.rooftop ? rooftopGeometry : undefined,
        balloons:
          this.director instanceof RooftopDirector &&
          this.director.environment === 'day'
            ? balloonPositions(this.director.dayMs)
            : [],
        combinedJump: this.combined?.snapshot(),
        kitchen:
          this.director instanceof KitchenDirector
            ? {
                ...this.kitchen!.snapshot(this.director, this.sophie),
                geometry: kitchenGeometry,
              }
            : undefined,
        phase: this.director.phase,
        index: this.director.index,
        line: this.director.line,
        canAdvance: this.director.canAdvance,
        fade: this.director.fade,
        paused: this.paused,
        actors: this.director.actors,
        animations: {
          sophie: this.sophie.anims.currentAnim?.key,
          jimmy: this.jimmy.anims.currentAnim?.key,
        },
        characters: this.children.list
          .filter(
            (child) =>
              child === this.sophie ||
              child === this.jimmy ||
              child === this.kitchen?.shelly,
          )
          .map((child) => child.name),
      }),
      manual: (enabled) => {
        this.manual = enabled;
      },
      tick: (ms) => {
        const elapsed = !this.paused && !this.orientationBlocked ? ms : 0;
        this.director.tick(elapsed);
        this.present(elapsed);
        return api.snapshot();
      },
    };
    window.__sophieStory = api;
  }
}
