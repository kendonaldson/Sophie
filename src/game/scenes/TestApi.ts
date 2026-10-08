import type { PlayerIntent } from '../input/Input';
import type { PlayerPhysicsConfig } from '../config/physics';
export interface GameSnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  charges: number;
  rechargeMs: number;
  state: string;
  checkpoint: string;
  respawning: boolean;
  ending: boolean;
  paused: boolean;
  treats: string[];
  physics: PlayerPhysicsConfig;
  levelId: string;
  viewport: { width: number; height: number };
}
export interface GameTestApi {
  snapshot(): GameSnapshot;
  manual(enabled: boolean): void;
  advance(frames: number, intent?: Partial<PlayerIntent>): GameSnapshot;
  restart(): void;
}
declare global {
  interface Window {
    __sophie?: GameTestApi;
  }
}
