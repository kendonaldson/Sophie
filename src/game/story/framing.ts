import { interlude1 as c } from './interlude1';
export function interludeFrame(width: number, height: number) {
  const zoom = Math.min(width / c.width, height / c.height);
  return {
    x: (width - c.width * zoom) / 2,
    y: (height - c.height * zoom) / 2,
    width: c.width * zoom,
    height: c.height * zoom,
    zoom,
  };
}
