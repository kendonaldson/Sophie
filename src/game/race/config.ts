import type { BirdDefinition } from '../birds/BirdMotion';
import type { RatDefinition } from '../rats/RatMotion';
import type { SteamDefinition } from '../steam/SteamCycle';
import type { PizzaDefinition } from '../pizza/PizzaPickup';
import type { BalloonDefinition } from '../balloons/config';
import type { Point } from '../levels/types';

export type RaceMode =
  | 'street'
  | 'construction'
  | 'balloons'
  | 'rooftops'
  | 'maintenance'
  | 'neighborhood';

export interface RaceBand {
  id: string;
  fromX: number;
  toX: number;
  mode: RaceMode;
  floorY: number;
  fallY: number;
  viewWidth?: number;
}

export interface RaceDefinition {
  bands: RaceBand[];
  birds: BirdDefinition[];
  rats: RatDefinition[];
  steam: SteamDefinition[];
  pizzas: PizzaDefinition[];
  variants: BalloonDefinition['variants'];
  challenges: { checkpoint: string; treats: string[]; pizzas: string[] }[];
  superJump: {
    triggerX: number;
    runwayEnd: number;
    staging: Point;
    landing: Point;
    jimmyLanding: Point;
    checkpointId: string;
  };
  destination: {
    triggerX: number;
    sophie: Point;
    jimmy: Point;
    attic: Point;
  };
}

export const raceTuning = {
  viewWidth: 960,
  viewHeight: 540,
  cameraResponse: 7,
  lookAhead: 190,
  superJumpViewWidth: 1280,
  homeViewWidth: 1300,
  homeRevealDistance: 650,
  companionSeparation: 340,
  constructionFallMargin: 380,
  entryFadeMs: 280,
} as const;
