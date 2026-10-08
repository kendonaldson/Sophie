import Phaser from 'phaser';
import './style.css';
import { Hud } from './ui/Hud';
import { GameScene } from './game/scenes/GameScene';
import { InterludeScene } from './game/scenes/InterludeScene';
import { viewportSize, watchViewport } from './game/rendering/Viewport';
import { Sfx } from './game/audio/Sfx';
const sfx = new Sfx();
const debugSettings = { infiniteDash: false };
sfx.bindGestures();
const hud = new Hud(document.querySelector<HTMLElement>('#app')!, sfx);
const container = document.querySelector<HTMLElement>('#world')!;
const size = viewportSize(container.clientWidth, container.clientHeight);
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: container,
  width: size.width,
  height: size.height,
  backgroundColor: '#cbd0b9',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  render: { pixelArt: true, roundPixels: true, antialias: false },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
      fps: 120,
      fixedStep: false,
    },
  },
  scene: [
    new GameScene(hud, sfx, debugSettings),
    new InterludeScene(hud, sfx, debugSettings),
  ],
  // Music streams through LevelMusic; SFX own the only Web Audio context.
  audio: { noAudio: true },
  banner: false,
});
const unwatch = watchViewport(game, container);
game.events.once('destroy', () => sfx.destroy());
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    unwatch();
    game.destroy(true);
  });
