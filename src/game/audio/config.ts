export type DialogueSpeaker = 'sophie' | 'jimmy' | 'offscreen';
export interface DialogueProfile {
  basePitch: number;
  variation: number;
  cadenceMs: number;
}
export interface SfxConfig {
  masterVolume: number;
  maxVoices: number;
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
};
export const clampVolume = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
export const isBoopCharacter = (character: string) =>
  /^[\p{L}\p{N}]$/u.test(character);
export const dialoguePitch = (profile: DialogueProfile, random: number) =>
  profile.basePitch + (clampVolume(random) * 2 - 1) * profile.variation;
