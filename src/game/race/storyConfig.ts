import { sfxConfig } from '../audio/config';

export const raceStoryTuning = {
  opening: {
    busMs: 350,
    jimmyMs: 2200,
    sophieMs: 2600,
    reactionMs: 200,
  },
  superJump: {
    gatherMs: 300,
    pauseMs: 160,
    crouchMs: 320,
    flightMs: 1400,
    riseMs: sfxConfig.jimmySuperJump.launchMs,
    arcHeight: 240,
    landMs: 180,
    gatherSpeed: 180,
  },
  attic: {
    walkSpeed: 160,
    followDelayMs: 220,
    settleMs: 200,
    // The visible attic opening spans -12 to +13 from its center marker.
    // Finish each dog's fade inside the doorway, before the right jamb.
    insideOffset: 12,
    fadeInsidePixels: 24,
    companionReach: 96,
    emptyMs: 300,
    fadeMs: 750,
  },
} as const;
