export type DialogueSpeaker =
  'sophie' | 'jimmy' | 'shelly' | 'offscreen' | 'lizzy' | 'iris' | 'paul';
export type HomeSoundCue = 'bus-brake' | 'bus-door' | 'front-door' | 'reunion';
export interface DialogueProfile {
  basePitch: number;
  variation: number;
  cadenceMs: number;
  waveform?: OscillatorType;
  volume?: number;
}
export interface NoiseSfxConfig {
  volume: number;
  durationMs: number;
  filterStartFrequency: number;
  filterEndFrequency: number;
  filterQ: number;
}
export interface RetroPhraseConfig {
  volume: number;
  durationMs: number;
  pitches: readonly number[];
  waveform: OscillatorType;
}
export interface SfxConfig {
  home: Record<
    HomeSoundCue,
    NoiseSfxConfig | (RetroPhraseConfig & { pulses: number })
  >;
  masterVolume: number;
  maxVoices: number;
  birdSquawk: {
    volume: number;
    durationMs: number;
    startFrequency: number;
    peakFrequency: number;
    secondFrequency: number;
    endFrequency: number;
    turnAt: number;
    secondAt: number;
    waveform: OscillatorType;
  };
  ratSqueak: {
    volume: number;
    durationMs: number;
    startFrequency: number;
    peakFrequency: number;
    endFrequency: number;
    turnAt: number;
    waveform: OscillatorType;
  };
  steamHiss: NoiseSfxConfig;
  steamBurst: NoiseSfxConfig;
  pizzaPower: {
    volume: number;
    durationMs: number;
    pitches: readonly number[];
    waveform: OscillatorType;
  };
  pizzaSpeed: NoiseSfxConfig;
  shellyRollCharge: RetroPhraseConfig;
  shellyRoll: RetroPhraseConfig;
  shellySpin: RetroPhraseConfig;
  superPizzaDash: NoiseSfxConfig & {
    startFrequency: number;
    endFrequency: number;
  };
  attackMs: number;
  jump: {
    volume: number;
    durationMs: number;
    startFrequency: number;
    endFrequency: number;
    waveform: OscillatorType;
  };
  dash: {
    volume: number;
    durationMs: number;
    noiseAmount: number;
    startFrequency: number;
    endFrequency: number;
    filterStartFrequency: number;
    filterEndFrequency: number;
    filterQ: number;
  };
  jimmySuperJump: {
    volume: number;
    anticipationMs: number;
    anticipationStartFrequency: number;
    anticipationEndFrequency: number;
    anticipationWaveform: OscillatorType;
    launchMs: number;
    startFrequency: number;
    endFrequency: number;
    waveform: OscillatorType;
    sweepPower: number;
    releaseMs: number;
  };
  dialogue: {
    volume: number;
    durationMs: number;
    cadenceMs: number;
    revealMs: number;
    waveform: OscillatorType;
    profiles: Record<DialogueSpeaker, DialogueProfile>;
  };
}
export const sfxConfig: SfxConfig = {
  home: {
    'bus-brake': {
      volume: 0.12,
      durationMs: 240,
      filterStartFrequency: 1600,
      filterEndFrequency: 500,
      filterQ: 0.5,
    },
    'bus-door': {
      volume: 0.09,
      durationMs: 200,
      filterStartFrequency: 700,
      filterEndFrequency: 1100,
      filterQ: 0.5,
    },
    'front-door': {
      volume: 0.12,
      durationMs: 140,
      pitches: [160, 85],
      waveform: 'triangle',
      pulses: 1,
    },
    reunion: {
      volume: 0.14,
      durationMs: 280,
      pitches: [430, 250, 460, 270],
      waveform: 'triangle',
      pulses: 2,
    },
  },
  masterVolume: 0.42,
  maxVoices: 8,
  shellyRollCharge: {
    volume: 0.23,
    durationMs: 240,
    pitches: [165, 230, 165, 260, 180, 330],
    waveform: 'square',
  },
  shellyRoll: {
    volume: 0.18,
    durationMs: 220,
    pitches: [240, 360, 220, 330, 160],
    waveform: 'triangle',
  },
  shellySpin: {
    volume: 0.23,
    durationMs: 260,
    pitches: [160, 520, 360, 640, 280],
    waveform: 'triangle',
  },
  superPizzaDash: {
    volume: 0.3,
    durationMs: 180,
    startFrequency: 1560,
    endFrequency: 280,
    filterStartFrequency: 7200,
    filterEndFrequency: 1400,
    filterQ: 0.8,
  },
  pizzaPower: {
    volume: 0.25,
    durationMs: 300,
    pitches: [523.25, 659.25, 783.99, 1046.5, 1567.98],
    waveform: 'square',
  },
  pizzaSpeed: {
    volume: 0.12,
    durationMs: 105,
    filterStartFrequency: 3400,
    filterEndFrequency: 1100,
    filterQ: 0.55,
  },
  birdSquawk: {
    volume: 0.2,
    durationMs: 120,
    startFrequency: 540,
    peakFrequency: 1180,
    secondFrequency: 680,
    endFrequency: 920,
    turnAt: 0.35,
    secondAt: 0.55,
    waveform: 'square',
  },
  ratSqueak: {
    volume: 0.17,
    durationMs: 90,
    startFrequency: 1450,
    peakFrequency: 2100,
    endFrequency: 1050,
    turnAt: 0.38,
    waveform: 'square',
  },
  steamHiss: {
    volume: 0.13,
    durationMs: 160,
    filterStartFrequency: 2800,
    filterEndFrequency: 3800,
    filterQ: 0.5,
  },
  steamBurst: {
    volume: 0.19,
    durationMs: 230,
    filterStartFrequency: 1500,
    filterEndFrequency: 700,
    filterQ: 0.55,
  },
  attackMs: 3,
  jump: {
    volume: 0.28,
    durationMs: 110,
    startFrequency: 220,
    endFrequency: 520,
    waveform: 'square',
  },
  dash: {
    volume: 0.25,
    durationMs: 140,
    noiseAmount: 0.65,
    startFrequency: 640,
    endFrequency: 150,
    filterStartFrequency: 1800,
    filterEndFrequency: 650,
    filterQ: 0.65,
  },
  dialogue: {
    volume: 0.16,
    durationMs: 30,
    cadenceMs: 65,
    revealMs: 18,
    waveform: 'triangle',
    profiles: {
      sophie: { basePitch: 660, variation: 45, cadenceMs: 65 },
      jimmy: { basePitch: 440, variation: 35, cadenceMs: 75 },
      shelly: { basePitch: 540, variation: 30, cadenceMs: 72 },
      offscreen: { basePitch: 330, variation: 25, cadenceMs: 85 },
      lizzy: {
        basePitch: 750,
        variation: 90,
        cadenceMs: 65,
        waveform: 'square',
        volume: 0.72,
      },
      iris: {
        basePitch: 590,
        variation: 60,
        cadenceMs: 85,
        waveform: 'triangle',
        volume: 0.88,
      },
      paul: {
        basePitch: 285,
        variation: 30,
        cadenceMs: 105,
        waveform: 'triangle',
      },
    },
  },
  jimmySuperJump: {
    volume: 0.3,
    anticipationMs: 60,
    anticipationStartFrequency: 180,
    anticipationEndFrequency: 125,
    anticipationWaveform: 'triangle',
    launchMs: 220,
    startFrequency: 150,
    endFrequency: 1000,
    waveform: 'square',
    sweepPower: 2.5,
    releaseMs: 12,
  },
};
export const clampVolume = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
export const isBoopCharacter = (character: string) =>
  /^[\p{L}\p{N}]$/u.test(character);
export const dialoguePitch = (profile: DialogueProfile, random: number) =>
  profile.basePitch + (clampVolume(random) * 2 - 1) * profile.variation;
