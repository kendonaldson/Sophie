import type { Point, CheckpointDefinition } from '../levels/types';
import type { Rect } from '../player/CollisionAssist';
import type { RatDefinition } from '../rats/RatMotion';
import type { SteamDefinition } from '../steam/SteamCycle';
export interface MaintenanceDefinition {
  rats: RatDefinition[];
  steam: SteamDefinition[];
  challenges: { checkpoint: string; treats: string[] }[];
  majorView: { fromX: number; toX: number; left: number; width: number };
  destination: {
    triggerX: number;
    sophie: Point;
    jimmy: Point;
    hatch: Rect;
  };
}
export const tunnelTuning = {
  viewWidth: 960,
  viewHeight: 540,
  lookAhead: 220,
  feetRatio: 0.65,
  cameraResponse: 7,
  fallMargin: 280,
  entryFadeMs: 280,
  gatherMs: 800,
  exitHoldMs: 450,
  walkSpeed: 105,
  followDelayMs: 260,
  emptyMs: 600,
  fadeMs: 850,
} as const;
export const safeAnchor = (id: string, x: number): CheckpointDefinition => ({
  id,
  spawn: { x, y: 500 },
  area: { x: x - 44, y: 492, width: 88, height: 16 },
});
