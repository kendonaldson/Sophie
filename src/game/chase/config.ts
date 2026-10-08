import type { ForcedScrollConfig } from '../rendering/ForcedScroll';
import type { Point } from '../levels/types';
import { sfxConfig } from '../audio/config';
export interface ChaseDefinition {
  scroll: ForcedScrollConfig;
  view: { width: number; height: number; top: number };
  deadEnd: { triggerX: number; feetY: number; sophie: Point; jimmy: Point };
  calls: readonly { fromX: number; text: string }[];
}
export const chaseTuning = {
  openingRunMs: 450,
  openingLineMs: 2300,
  callMs: 1300,
  callQuietMs: 4200,
  recoveryMargin: 82,
  recoveryFallMargin: 80,
  stuckDistance: 0.3,
  recoveryDelayMs: 300,
  recoveryFadeMs: 160,
  recoverySeparation: 185,
  stuckMs: 280,
  settleMs: 850,
  musicFadeMs: 650,
  gotchaMs: 1250,
  quietMs: 500,
  homeMs: 2100,
  lookMs: 650,
  crouchMs: 420,
  launchMs: sfxConfig.jimmySuperJump.launchMs,
  emptyMs: 650,
  punchlineMs: 2200,
  fadeMs: 750,
} as const;
