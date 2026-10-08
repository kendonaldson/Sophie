import type { BirdDefinition } from '../birds/BirdMotion';
import type { ElevatorDefinition, Point } from '../levels/types';
export interface ClimbChallenge {
  checkpoint: string;
  section: number;
  title: string;
  hint: string;
  treats: string[];
}
export interface ConstructionLiftDefinition extends ElevatorDefinition {
  destination?: string;
}
export interface SkyscraperDefinition {
  sections: { title: string; direction: -1 | 1; bottom: number }[];
  challenges: ClimbChallenge[];
  lifts: ConstructionLiftDefinition[];
  birds: BirdDefinition[];
  arrival: { sophie: Point; jimmy: Point };
}
export const climbTuning = {
  viewWidth: 720,
  viewHeight: 440,
  lookAhead: 95,
  feetRatio: 0.72,
  cameraResponse: 6,
  arrivalMs: 720,
  entryFadeMs: 250,
  arrivalRise: 260,
  fallMargin: 240,
  boardingMs: 700,
  roofHoldMs: 2000,
  endingFadeMs: 900,
  companionSeparation: 250,
  companionVerticalSeparation: 145,
} as const;
