export interface BirdDefinition {
  id: string;
  left: number;
  right: number;
  baseY: number;
  speed: number;
  amplitude: number;
  frequency: number;
  phase: number;
  direction: -1 | 1;
  offset: number;
}
/** Fixed-speed passes with a shallow deterministic wave; no target or random AI. */
export function birdPosition(bird: BirdDefinition, elapsedMs: number) {
  const width = bird.right - bird.left;
  const distance = bird.offset + (elapsedMs * bird.speed) / 1000;
  const cycle = ((distance % (width * 2)) + width * 2) % (width * 2);
  const forward = cycle < width;
  const progress = forward ? cycle : width * 2 - cycle;
  return {
    x: bird.direction === 1 ? bird.left + progress : bird.right - progress,
    y:
      bird.baseY +
      Math.sin((elapsedMs / 1000) * Math.PI * 2 * bird.frequency + bird.phase) *
        bird.amplitude,
    direction: (forward ? bird.direction : -bird.direction) as -1 | 1,
  };
}
export const birdTuning = {
  bodyWidth: 20,
  bodyHeight: 14,
  frameMs: 110,
  drawSize: 64,
} as const;
