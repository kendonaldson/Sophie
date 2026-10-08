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
  jimmy?: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    state: string;
    enabled: boolean;
    recoveries: number;
    intent: PlayerIntent;
  };
  machinery?: { id: string; x: number; y: number; vx: number; vy: number }[];
  gates?: { id: string; open: boolean }[];
  elevator?: string;
  intro: boolean;
  finale?: string;
  finaleComplete: boolean;
}
export interface GameTestApi {
  snapshot(): GameSnapshot;
  manual(enabled: boolean): void;
  advance(frames: number, intent?: Partial<PlayerIntent>): GameSnapshot;
  restart(): void;
  loadLevel(id: 'attic-escape' | 'warehouse'): void;
  checkpoint(id: string): void;
  platform(id: string): void;
  finaleEnabled(enabled: boolean): void;
  place(point: { x: number; y: number }, companion?: boolean): void;
}
declare global {
  interface Window {
    __sophie?: GameTestApi;
  }
}
