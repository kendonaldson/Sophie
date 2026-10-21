import Phaser from 'phaser';
import type { Hud } from '../../ui/Hud';
import { StoryDialogue } from '../../ui/StoryDialogue';
import {
  DebugLevelSelector,
  type DebugSettings,
} from '../../ui/DebugLevelSelector';
import '../../ui/epilogue.css';
import { LevelMusic } from '../audio/LevelMusic';
import type { SfxOutput } from '../audio/Sfx';
import { createAnimations } from '../player/animations';
import type { ProgressStore } from '../progress/ProgressStore';
import { EpilogueArt } from '../story/EpilogueArt';
import { EpilogueDirector } from '../story/EpilogueDirector';
import { epilogue as c } from '../story/epilogue';
import { interludeFrame } from '../story/framing';
import { sceneDestinations, storySceneKey } from './destinations';
import type { StoryTestApi } from './TestApi';

/** Final story scene: two fixed shots, only two dog sprites, no gameplay input. */
export class EpilogueScene extends Phaser.Scene {
  private director = new EpilogueDirector();
  private art!: EpilogueArt;
  private sophie!: Phaser.GameObjects.Sprite;
  private jimmy!: Phaser.GameObjects.Sprite;
  private dialogue!: StoryDialogue;
  private music?: LevelMusic;
  private endTitle!: HTMLElement;
  private paused = false;
  private orientationBlocked = false;
  private manual = false;
  private progressSaved = false;

  constructor(
    private readonly hud: Hud,
    private readonly sfx: SfxOutput,
    private readonly debugSettings: DebugSettings,
    private readonly progress: ProgressStore,
  ) {
    super('Epilogue');
  }

  init(data: { music?: LevelMusic } = {}) {
    this.music = data.music;
    this.paused = this.orientationBlocked = this.manual = false;
  }

  create() {
    this.director = new EpilogueDirector(this.sfx);
    this.progressSaved = this.progress.saveStory(c.id);
    const app = document.querySelector<HTMLElement>('#app')!;
    const shell = document.querySelector<HTMLElement>('.game-shell')!;
    const previousBackground = this.game.config.backgroundColor.clone();
    this.game.config.backgroundColor.setTo(0, 0, 0);
    app.classList.add('epilogue-mode');
    this.hud.showPause(false);
    this.hud.showDialogue();
    this.hud.updatePizzaRush(0);
    document.querySelector('.chapter > span:last-child')!.textContent =
      'Epilogue · Home, just in time';
    document.querySelector('.chapter-number')!.textContent = 'EPILOGUE';
    document.querySelector('#hint')!.textContent = '';
    this.art = new EpilogueArt(this);
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

    // Retain the gesture-activated media element from gameplay on mobile.
    // Shot changes never touch the track or restart its playback position.
    this.music ??= new LevelMusic(shell);
    this.music.setActive(false);
    this.music.configure({ loop: c.musicLoop, volume: c.musicVolume });
    this.music.setTrack(c.music);
    this.music.restart();
    this.dialogue = new StoryDialogue(
      shell,
      () => {},
      (blocked) => {
        this.orientationBlocked = blocked;
        this.syncAudio();
      },
      this.sfx,
    );
    this.endTitle = document.createElement('div');
    this.endTitle.className = 'epilogue-end';
    this.endTitle.textContent = 'THE END';
    this.endTitle.setAttribute('role', 'status');
    this.endTitle.hidden = true;
    shell.append(this.endTitle);
    const restart = () => {
      const music = this.music;
      this.music = undefined;
      this.scene.restart({ music });
    };
    const selector = new DebugLevelSelector(
      app,
      sceneDestinations,
      c,
      (destination) => {
        if (destination.id === c.id) restart();
        else {
          const story = storySceneKey(destination.id);
          if (story) this.scene.start(story);
          else this.scene.start('Game', { levelId: destination.id });
        }
      },
      this.debugSettings,
    );
    const unbindHud = this.hud.bind(
      this.togglePause,
      restart,
      this.togglePause,
      () => this.scene.start('Game', { levelId: 'attic-escape' }),
    );
    window.addEventListener('keydown', this.command);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    this.scale.on('resize', this.frame);
    this.frame();
    this.present();
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('test'))
      this.installTestApi();
    const cleanup = () => {
      this.events.off('shutdown', cleanup);
      this.events.off('destroy', cleanup);
      unbindHud();
      selector.destroy();
      this.music?.destroy();
      this.music = undefined;
      this.sfx.stopHome();
      this.dialogue.destroy();
      this.art.destroy();
      this.endTitle.remove();
      this.scale.off('resize', this.frame);
      window.removeEventListener('keydown', this.command);
      window.removeEventListener('blur', this.blur);
      document.removeEventListener('visibilitychange', this.visibility);
      app.classList.remove('epilogue-mode', 'epilogue-complete');
      app.style.removeProperty('--ending-fade');
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
      .setBackgroundColor(0x000000);
  };
  private syncAudio() {
    const blocked = this.paused || this.orientationBlocked;
    this.music?.setActive(!blocked);
    if (blocked) {
      this.sfx.stopDialogue();
      this.sfx.stopHome();
    }
  }
  private togglePause = () => {
    if (this.director.phase === 'complete') return;
    this.paused = !this.paused;
    this.hud.showPause(this.paused);
    this.syncAudio();
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
    if (!this.paused && !this.manual) this.togglePause();
  };
  private visibility = () => {
    if (document.hidden) this.blur();
  };

  update(_time: number, delta: number) {
    if (!this.progressSaved) this.progressSaved = this.progress.saveStory(c.id);
    const blocked = this.paused || this.orientationBlocked;
    const ms = !this.manual && !blocked ? Math.min(delta, 100) : 0;
    this.director.tick(ms);
    this.present();
    if (!blocked) this.dialogue.revealText(Math.min(delta, 100));
  }

  private present() {
    const d = this.director;
    this.art.update(d.environment, d.bus);
    for (const name of ['sophie', 'jimmy'] as const) {
      const sprite = this[name],
        actor = d.actors[name];
      sprite
        .setPosition(Math.round(actor.x), Math.round(actor.y))
        .setFlipX(actor.flipX)
        .setVisible(actor.visible)
        .play(`${name === 'jimmy' ? 'jimmy-' : ''}${actor.pose}`, true);
      if (this.paused || this.orientationBlocked) sprite.anims.pause();
      else sprite.anims.resume();
    }
    this.dialogue.show(d.line, false, false);
    const speaker =
      d.line?.speaker === 'jimmy' ? d.actors.jimmy : d.actors.sophie;
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
    this.hud.setFade(d.fade);
    this.music?.setVolume(d.musicVolume);
    this.syncAudio();
    const complete = d.phase === 'complete';
    this.endTitle.hidden = !complete;
    const app = document.querySelector<HTMLElement>('#app')!;
    app.classList.toggle('epilogue-complete', complete);
    app.style.setProperty(
      '--ending-fade',
      String(d.phase === 'fade' || complete ? d.fade : 0),
    );
    document
      .querySelector('#world')!
      .setAttribute(
        'aria-label',
        complete
          ? 'The end'
          : d.environment === 'exterior'
            ? 'A school bus arrives outside Sophie and Jimmy’s home. No people are visible.'
            : d.actors.sophie.visible || d.actors.jimmy.visible
              ? 'Sophie and Jimmy resting in a cozy bedroom'
              : 'The empty bedroom. The family reunion happens off screen.',
      );
  }

  private installTestApi() {
    const api: StoryTestApi = {
      snapshot: () => ({
        storyId: c.id,
        balloons: [],
        phase: this.director.phase,
        index: this.director.index,
        line: this.director.line,
        canAdvance: false,
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
        epilogue: {
          environment: this.director.environment,
          beat: this.director.beat?.id ?? 'complete',
          bus: this.director.bus,
          camera: {
            scrollX: this.cameras.main.scrollX,
            scrollY: this.cameras.main.scrollY,
            zoom: this.cameras.main.zoom,
          },
          music: {
            asset: c.music,
            loop: c.musicLoop,
            volume: this.director.musicVolume,
          },
          theEnd: !this.endTitle.hidden,
        },
      }),
      manual: (enabled) => {
        this.manual = enabled;
      },
      tick: (ms) => {
        if (!this.paused && !this.orientationBlocked) this.director.tick(ms);
        this.present();
        return api.snapshot();
      },
    };
    window.__sophieStory = api;
  }
}
