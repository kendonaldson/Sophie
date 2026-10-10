export type DialogueSpeaker = 'sophie' | 'jimmy' | 'offscreen';
export interface DialogueProfile {
  basePitch: number;
  variation: number;
  cadenceMs: number;
}
export interface NoiseSfxConfig {
  volume: number;
  durationMs: number;
  filterStartFrequency: number;
  filterEndFrequency: number;
  filterQ: number;
}
export interface SfxConfig {
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
  masterVolume: 0.42,
  maxVoices: 8,
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
      offscreen: { basePitch: 330, variation: 25, cadenceMs: 85 },
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
