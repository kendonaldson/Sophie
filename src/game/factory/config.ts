import type { Point } from '../levels/types';
import type { Rect } from '../player/CollisionAssist';
import type { PizzaDefinition } from '../pizza/PizzaPickup';

export interface RollZone {
  id: string;
  fromX: number;
  toX: number;
  left: number;
  right: number;
}
export interface Confrontation {
  id: 'midpoint' | 'final';
  triggerX: number;
  staging: Point;
  shelly: Point;
  pizza: PizzaDefinition;
}
export interface FactoryDefinition {
  ovens: (Rect & { id: string })[];
  rollZones: RollZone[];
  pizzas: PizzaDefinition[];
  midpoint: Confrontation;
  final: Confrontation;
  checkpointId: string;
  finalCheckpointId: string;
  exitX: number;
}
export const factoryTuning = {
  ovenFireInsetX: 6,
  ovenFireInsetTop: 8,
  conveyorWith: 90,
  conveyorAgainst: -65,
  conveyorOven: 75,
  conveyorFast: 110,
  conveyorLaunch: 120,
  traySpeed: 55,
  rollAppearMs: 250,
  rollAlignMs: 450,
  rollTelegraphMs: 750,
  rollSpeed: 520,
  rollCooldownMs: 6200,
  rollGraceMs: 2400,
  rollTrailMs: 190,
  rollWidth: 36,
  rollHeight: 30,
  rollDeflectMs: 900,
  rollDeflectFadeMs: 250,
  rollDeflectSpeed: 420,
  rollDeflectLift: 430,
  rollDeflectGravity: 780,
  rollDeflectTurns: 3,
  blockerWidth: 44,
  blockerHeight: 76,
  recoilSpeed: 110,
  midpointSpinMs: 1000,
  finalSpinMs: 1500,
  escapeMs: 2400,
  emptyMs: 500,
  fadeMs: 850,
  entryFadeMs: 300,
  viewWidth: 1000,
  viewHeight: 562.5,
  finalViewWidth: 1320,
  lookAhead: 220,
  cameraResponse: 7,
  fallMargin: 290,
} as const;
