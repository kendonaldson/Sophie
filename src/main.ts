import Phaser from 'phaser';
import './style.css';
import { Hud } from './ui/Hud';
import { GameScene } from './game/scenes/GameScene';
import { viewportSize, watchViewport } from './game/rendering/Viewport';
const hud = new Hud(document.querySelector<HTMLElement>('#app')!);
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
  scene: [new GameScene(hud)],
  banner: false,
});
const unwatch = watchViewport(game, container);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    unwatch();
    game.destroy(true);
  });
