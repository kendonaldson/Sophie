import type { BirdDefinition } from '../birds/BirdMotion';
import type { Point, PlatformDefinition } from '../levels/types';
export interface BalloonDefinition {
  variants: {
    platformId: string;
    palette: number;
    pattern: 'stripes' | 'diamonds' | 'stars';
  }[];
  challenges: { checkpoint: string; treats: string[] }[];
  birds: BirdDefinition[];
  destination: {
    roofId: string;
    landingX: number;
    sophie: Point;
    jimmy: Point;
    sign: Point & { width: number; height: number };
    vent: Point & { width: number; height: number };
  };
}
export const balloonTuning = {
  viewWidth: 960,
  viewHeight: 540,
  lookAhead: 200,
  finalViewWidth: 1120,
  finalLeftInset: 183,
  finalFeetOffset: 75,
  feetRatio: 0.65,
  cameraResponse: 7,
  fallMargin: 300,
  companionSeparation: 340,
  entryFadeMs: 280,
  landingHoldMs: 1100,
  scentMs: 700,
  smellLineMs: 1600,
  smellBeatMs: 350,
  pizzaLineMs: 1450,
  goLineMs: 800,
  walkSpeed: 95,
  followDelayMs: 300,
  emptyMs: 700,
  fadeMs: 850,
} as const;
export const marqueeAppearance = {
  key: 'shellys-pizza',
  asset: 'assets/shelly_pizza_marquee.png',
  sourceWidth: 1536,
  sourceHeight: 1024,
} as const;
export const crown = (
  id: string,
  x: number,
  y: number,
  width: number,
): PlatformDefinition => ({
  id,
  x,
  y,
  width,
  height: 8,
  style: 'balloon',
  collision: 'top-only',
});
