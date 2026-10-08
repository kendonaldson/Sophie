import type Phaser from 'phaser';
import { cameraConfig as c } from '../config/camera';
export function viewportSize(width: number, height: number) {
  const scale = Math.max(
    1,
    Math.floor(Math.min(width / c.minWidth, height / 280)),
  );
  const logicalWidth = Math.min(
    c.maxWidth,
    Math.max(320, Math.floor(width / scale)),
  );
  const logicalHeight = Math.min(
    c.maxHeight,
    Math.max(260, Math.floor(height / scale)),
  );
  const cssScale = Math.min(
    scale,
    width / logicalWidth,
    height / logicalHeight,
  );
  return {
    width: logicalWidth,
    height: logicalHeight,
    cssWidth: logicalWidth * cssScale,
    cssHeight: logicalHeight * cssScale,
    scale: cssScale,
  };
}
export function watchViewport(game: Phaser.Game, container: HTMLElement) {
  const resize = () => {
    const size = viewportSize(container.clientWidth, container.clientHeight);
    game.scale.resize(size.width, size.height);
    // Assigning canvas dimensions resets native context state, including smoothing.
    const context = game.canvas.getContext('2d');
    if (context) context.imageSmoothingEnabled = false;
    game.canvas.style.width = `${size.cssWidth}px`;
    game.canvas.style.height = `${size.cssHeight}px`;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  return () => observer.disconnect();
}
