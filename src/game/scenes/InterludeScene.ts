import Phaser from 'phaser';
import type { Hud } from '../../ui/Hud';
import { StoryDialogue } from '../../ui/StoryDialogue';
import { DebugLevelSelector } from '../../ui/DebugLevelSelector';
import { DialogueInput } from '../input/DialogueInput';
import { createAnimations } from '../player/animations';
import { Effects } from '../rendering/Effects';
import { drawInterludeExterior } from '../story/InterludeArt';
import { InterludeDirector } from '../story/InterludeDirector';
import { interlude1 as c } from '../story/interlude1';
import { interludeFrame } from '../story/framing';
import { sceneDestinations } from './destinations';
import type { StoryTestApi } from './TestApi';

export class InterludeScene extends Phaser.Scene {
  private director = new InterludeDirector();
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
  constructor(private readonly hud: Hud) {
    super('Interlude1');
  }
  create() {
    // The fixed shot leaves side margins on wide phones; clear them to night too.
    const previousBackground = this.game.config.backgroundColor.clone();
    this.game.config.backgroundColor.setTo(24, 46, 56);
    this.director = new InterludeDirector();
    this.paused = false;
    this.manual = false;
    this.ended = false;
    this.hud.showPause(false);
    this.hud.showDialogue();
    this.hud.setFade(1);
    document.querySelector('.chapter > span:last-child')!.textContent =
      'Interlude 1 · Outside the warehouse';
    document.querySelector('.chapter-number')!.textContent = 'INTERLUDE 1';
    document
      .querySelector('#world')!
      .setAttribute(
        'aria-label',
        'Sophie and Jimmy talking beside the warehouse on a quiet nighttime road',
      );
    document.querySelector('#hint')!.textContent =
      'X · Continue the conversation';
    drawInterludeExterior(this);
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
    this.dialogue = new StoryDialogue(shell, this.advance, (blocked) => {
      this.orientationBlocked = blocked;
      this.inputSource?.clear();
    });
    this.inputSource = new DialogueInput(this.advance);
    const selector = new DebugLevelSelector(
      document.querySelector('#app')!,
      sceneDestinations,
      c,
      (destination) => {
        if (destination.id === c.id) this.scene.restart();
        else this.scene.start('Game', { levelId: destination.id });
      },
    );
    const unbindHud = this.hud.bind(
      this.togglePause,
      () => {},
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
      .setBackgroundColor(0x182e38);
  };
  private advance = () => {
    if (this.paused || this.orientationBlocked) return;
    this.director.advance();
    this.present(0);
  };
  private togglePause = () => {
    if (this.ended) return;
    this.paused = !this.paused;
    this.inputSource.clear();
    this.hud.showPause(this.paused);
  };
  private command = (event: KeyboardEvent) => {
    if (
      event.code !== 'Escape' ||
      event.repeat ||
      (event.target instanceof HTMLElement && event.target.closest('select'))
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
  }
  private present(ms: number) {
    const actors = this.director.actors;
    this.alertAccent.setVisible(
      this.director.phase === 'dialogue' && this.director.line?.cue === 'alert',
    );
    for (const [index, name] of (['sophie', 'jimmy'] as const).entries()) {
      const sprite = this[name],
        actor = actors[name];
      sprite.setPosition(Math.round(actor.x), actor.y).setFlipX(actor.flipX);
      sprite.play(`${name === 'sophie' ? '' : 'jimmy-'}${actor.pose}`, true);
      if (this.paused || this.orientationBlocked) sprite.anims.pause();
      else sprite.anims.resume();
      this.effects[index]!.update(ms, sprite, this.director.running);
    }
    this.hud.setFade(this.director.fade);
    const visible =
      this.director.phase === 'dialogue' || this.director.phase === 'escape';
    this.dialogue.show(
      visible ? this.director.line : undefined,
      this.director.canAdvance && !this.paused && !this.orientationBlocked,
    );
    const speaker =
      this.director.line?.speaker === 'jimmy' ? actors.jimmy : actors.sophie;
    const canvas = this.game.canvas.getBoundingClientRect();
    const shell = document
      .querySelector('.game-shell')!
      .getBoundingClientRect();
    const f = interludeFrame(this.scale.width, this.scale.height);
    const scale = canvas.width / this.scale.width;
    this.dialogue.anchor(
      canvas.left - shell.left + (f.x + speaker.x * f.zoom) * scale,
      canvas.top - shell.top + (f.y + (speaker.y - 74) * f.zoom) * scale,
    );
    if (this.director.phase === 'complete' && !this.ended) {
      this.ended = true;
      this.inputSource.clear();
      this.scene.start('Game', { levelId: 'the-chase' });
    }
  }
  private installTestApi() {
    const api: StoryTestApi = {
      snapshot: () => ({
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
          .filter((child) => child instanceof Phaser.GameObjects.Sprite)
          .map((child) => child.name),
      }),
      manual: (enabled) => {
        this.manual = enabled;
      },
      tick: (ms) => {
        if (!this.paused && !this.orientationBlocked) this.director.tick(ms);
        this.present(0);
        return api.snapshot();
      },
    };
    window.__sophieStory = api;
  }
}
