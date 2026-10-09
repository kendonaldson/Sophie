import type { BalloonRun } from '../balloons/BalloonRun';
import type { RooftopDirector } from '../story/RooftopDirector';
import type { rooftopGeometry, balloonPositions } from '../story/RooftopArt';
import type { CombinedSuperJump } from '../superJump/CombinedSuperJump';
import type { PlayerIntent } from '../input/Input';
import type { PlayerPhysicsConfig } from '../config/physics';
import type { InterludeDirector } from '../story/InterludeDirector';
import type { SkyscraperRun } from '../skyscraper/SkyscraperRun';
export interface StoryTestApi {
  snapshot(): {
    storyId: string;
    environment?: 'night' | 'day';
    geometry?: typeof rooftopGeometry;
    balloons: ReturnType<typeof balloonPositions>;
    combinedJump?: ReturnType<CombinedSuperJump['snapshot']>;
    phase: InterludeDirector['phase'] | RooftopDirector['phase'];
    index: number;
    line: InterludeDirector['line'] | RooftopDirector['line'];
    canAdvance: boolean;
    fade: number;
    paused: boolean;
    actors: InterludeDirector['actors'] | RooftopDirector['actors'];
    animations: { sophie?: string; jimmy?: string };
    characters: string[];
  };
  manual(enabled: boolean): void;
  tick(ms: number): ReturnType<StoryTestApi['snapshot']>;
}
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
  chase?: {
    x: number;
    speed: number;
    enabled: boolean;
    boundary: number;
    phase: string;
    line?: string;
    nextCall: number;
    attempts: number;
    combinedJump?: ReturnType<CombinedSuperJump['snapshot']>;
  };
  characters: string[];
  climb?: ReturnType<SkyscraperRun['snapshot']>;
  balloons?: ReturnType<BalloonRun['snapshot']>;
  intro: boolean;
  finale?: string;
  finaleComplete: boolean;
}
export interface GameTestApi {
  snapshot(): GameSnapshot;
  manual(enabled: boolean): void;
  advance(frames: number, intent?: Partial<PlayerIntent>): GameSnapshot;
  restart(): void;
  loadLevel(
    id: 'attic-escape' | 'warehouse' | 'the-chase' | 'skyscraper' | 'balloons',
  ): void;
  chaseSection(x: number): void;
  checkpoint(id: string): void;
  platform(id: string): void;
  finaleEnabled(enabled: boolean): void;
  place(point: { x: number; y: number }, companion?: boolean): void;
}
declare global {
  interface Window {
    __sophie?: GameTestApi;
    __sophieStory?: StoryTestApi;
  }
}
