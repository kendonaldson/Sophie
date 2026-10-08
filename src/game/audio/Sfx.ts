import {
  clampVolume,
  dialoguePitch,
  isBoopCharacter,
  sfxConfig,
  type DialogueSpeaker,
  type SfxConfig,
} from './config';

export interface SfxOutput {
  jump(): void;
  dash(): void;
  jimmySuperJumpAnticipation(): void;
  jimmySuperJump(): void;
  stopJimmySuperJump(): void;
  dialogueBoop(speaker: DialogueSpeaker, character: string): void;
  stopDialogue(): void;
}
type Effect = 'jump' | 'dash' | 'dialogue' | 'jimmySuperJump';
export type JimmySuperJumpOutput = Pick<
  SfxOutput,
  'jimmySuperJumpAnticipation' | 'jimmySuperJump'
>;
interface Voice {
  effect: Effect;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
}
const browserContext = () => {
  if (typeof window === 'undefined') return undefined;
  const Constructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  return Constructor ? new Constructor() : undefined;
};
const bounded = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;

/** App-owned: no context until a trusted gesture, no queued effects on resume. */
export class Sfx implements SfxOutput {
  private context?: AudioContext;
  private master?: GainNode;
  private limiter?: DynamicsCompressorNode;
  private noise?: AudioBuffer;
  private readonly voices = new Set<Voice>();
  private enabled = true;
  private muted = false;
  private destroyed = false;
  private resuming = false;
  private initialized = false;
  private lastBoopAt = -Infinity;
  private unbind?: () => void;
  private readonly volumes: Record<Effect, number>;
  private masterVolume: number;

  constructor(
    readonly config: Readonly<SfxConfig> = sfxConfig,
    private readonly createContext = browserContext,
    private readonly random = Math.random,
  ) {
    this.masterVolume = clampVolume(config.masterVolume);
    this.volumes = {
      jump: clampVolume(config.jump.volume),
      dash: clampVolume(config.dash.volume),
      dialogue: clampVolume(config.dialogue.volume),
      jimmySuperJump: clampVolume(config.jimmySuperJump.volume),
    };
  }
  bindGestures(target: Window = window) {
    this.unbind?.();
    const unlock = (event: Event) => {
      if (event.isTrusted) this.unlockFromGesture();
    };
    // Capture runs before gameplay handlers. Touch activation is guaranteed on
    // pointerup in Safari, even when the mobile control prevents default clicks.
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') unlock(event);
    };
    const visibility = () => {
      if (target.document.hidden) this.stopAll();
    };
    target.addEventListener('keydown', unlock, true);
    target.addEventListener('pointerdown', pointerDown, true);
    target.addEventListener('pointerup', unlock, true);
    target.addEventListener('blur', this.stopAll);
    target.document.addEventListener('visibilitychange', visibility);
    this.unbind = () => {
      target.removeEventListener('keydown', unlock, true);
      target.removeEventListener('pointerdown', pointerDown, true);
      target.removeEventListener('pointerup', unlock, true);
      target.removeEventListener('blur', this.stopAll);
      target.document.removeEventListener('visibilitychange', visibility);
    };
  }
  /** Only call synchronously from an actual user gesture (bindGestures does this). */
  unlockFromGesture() {
    if (this.destroyed || !this.enabled) return;
    try {
      if (!this.context) {
        this.context = this.createContext();
        if (!this.context) return;
        this.master = this.context.createGain();
        this.limiter = this.context.createDynamicsCompressor();
        this.limiter.threshold.value = -8;
        this.limiter.knee.value = 4;
        this.limiter.ratio.value = 12;
        this.limiter.attack.value = 0.002;
        this.limiter.release.value = 0.08;
        this.master.connect(this.limiter);
        this.limiter.connect(this.context.destination);
        this.syncVolume();
        this.initialized = true;
      }
      if (
        this.context.state !== 'running' &&
        this.context.state !== 'closed' &&
        !this.resuming
      ) {
        this.resuming = true;
        void this.context.resume().then(
          () => {
            this.resuming = false;
          },
          () => {
            this.resuming = false;
          },
        );
      }
    } catch {
      this.resuming = false;
      if (!this.initialized) this.destroy();
      // Unsupported/denied audio never affects input or scene creation.
    }
  }
  setMasterVolume(volume: number) {
    this.masterVolume = clampVolume(volume);
    this.syncVolume();
  }
  setEffectVolume(effect: Effect, volume: number) {
    this.volumes[effect] = clampVolume(volume);
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.stopAll();
    this.syncVolume();
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stopAll();
    this.syncVolume();
  }
  private syncVolume() {
    if (this.master && this.context)
      this.master.gain.setValueAtTime(
        this.enabled && !this.muted ? this.masterVolume : 0,
        this.context.currentTime,
      );
  }
  jump() {
    const c = this.config.jump;
    this.play('jump', c.durationMs, (context, voice, gain, at, end) => {
      this.tone(
        context,
        voice,
        gain,
        c.waveform,
        c.startFrequency,
        c.endFrequency,
        at,
        end,
      );
    });
  }
  dash() {
    const c = this.config.dash;
    this.play('dash', c.durationMs, (context, voice, gain, at, end) => {
      const amount = clampVolume(c.noiseAmount);
      const toneGain = context.createGain();
      voice.nodes.push(toneGain);
      toneGain.gain.value = 1 - amount;
      toneGain.connect(gain);
      this.tone(
        context,
        voice,
        toneGain,
        'triangle',
        c.startFrequency,
        c.endFrequency,
        at,
        end,
      );
      if (!this.noise) {
        this.noise = context.createBuffer(
          1,
          context.sampleRate / 2,
          context.sampleRate,
        );
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = this.random() * 2 - 1;
      }
      const noise = context.createBufferSource();
      voice.sources.push(noise);
      const filter = context.createBiquadFilter();
      const noiseGain = context.createGain();
      voice.nodes.push(filter, noiseGain);
      filter.type = 'bandpass';
      filter.Q.value = bounded(c.filterQ, 0.1, 4);
      this.sweep(
        filter.frequency,
        context,
        c.filterStartFrequency,
        c.filterEndFrequency,
        at,
        end,
      );
      noise.buffer = this.noise;
      noiseGain.gain.value = amount;
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(gain);
    });
  }
  jimmySuperJumpAnticipation() {
    const c = this.config.jimmySuperJump;
    this.play(
      'jimmySuperJump',
      c.anticipationMs,
      (context, voice, gain, at, end) => {
        this.tone(
          context,
          voice,
          gain,
          c.anticipationWaveform,
          c.anticipationStartFrequency,
          c.anticipationEndFrequency,
          at,
          end,
        );
      },
    );
  }
  /** The script calls this at takeoff; the bright peak matches its ascent duration. */
  jimmySuperJump() {
    const c = this.config.jimmySuperJump;
    this.play(
      'jimmySuperJump',
      c.launchMs + c.releaseMs,
      (context, voice, gain, at, end) => {
        const oscillator = context.createOscillator();
        voice.sources.push(oscillator);
        oscillator.type = c.waveform;
        const max = Math.min(12000, context.sampleRate / 2 - 1);
        const start = bounded(c.startFrequency, 20, max);
        const peak = bounded(c.endFrequency, 20, max);
        const curve = Float32Array.from(
          { length: 65 },
          (_, i) =>
            start + (peak - start) * (i / 64) ** bounded(c.sweepPower, 1, 5),
        );
        oscillator.frequency.setValueCurveAtTime(
          curve,
          at,
          end -
            at -
            Math.min(bounded(c.releaseMs, 1, 30) / 1000, (end - at) / 3),
        );
        oscillator.connect(gain);
      },
      c.releaseMs,
    );
  }
  stopJimmySuperJump() {
    for (const voice of this.voices)
      if (voice.effect === 'jimmySuperJump') this.release(voice);
  }
  dialogueBoop(speaker: DialogueSpeaker, character: string) {
    if (!isBoopCharacter(character)) return;
    const context = this.context;
    if (!context) return;
    const c = this.config.dialogue,
      profile = c.profiles[speaker];
    const cadence =
      bounded(Math.max(c.cadenceMs, profile.cadenceMs), 30, 1000) / 1000;
    if (context.currentTime - this.lastBoopAt < cadence) return;
    const pitch = dialoguePitch(profile, this.random());
    if (
      this.play('dialogue', c.durationMs, (context, voice, gain, at, end) => {
        this.tone(
          context,
          voice,
          gain,
          c.waveform,
          pitch,
          pitch * 0.94,
          at,
          end,
        );
      })
    )
      this.lastBoopAt = context.currentTime;
  }
  stopDialogue() {
    for (const voice of this.voices)
      if (voice.effect === 'dialogue') this.release(voice);
    // Preserve the cadence across rapid line changes; no burst when advancing.
  }
  private play(
    effect: Effect,
    durationMs: number,
    build: (
      context: AudioContext,
      voice: Voice,
      gain: GainNode,
      at: number,
      end: number,
    ) => void,
    releaseMs?: number,
  ): boolean {
    const context = this.context;
    if (
      !context ||
      context.state !== 'running' ||
      !this.master ||
      this.destroyed ||
      !this.enabled ||
      this.muted ||
      !this.masterVolume ||
      !this.volumes[effect] ||
      (typeof document !== 'undefined' && document.hidden) ||
      this.voices.size >= bounded(this.config.maxVoices, 1, 16)
    )
      return false;
    const voice: Voice = {
      effect,
      sources: [],
      nodes: [],
    };
    this.voices.add(voice);
    try {
      const at = context.currentTime,
        end = at + bounded(durationMs, 10, 300) / 1000;
      const gain = context.createGain();
      voice.nodes.push(gain);
      gain.connect(this.master);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(
        this.volumes[effect],
        at +
          Math.min(bounded(this.config.attackMs, 1, 10) / 1000, (end - at) / 3),
      );
      // Hold the spring launch until its bright peak, then release without a click.
      if (releaseMs !== undefined)
        gain.gain.setValueAtTime(
          this.volumes[effect],
          end - Math.min(bounded(releaseMs, 1, 30) / 1000, (end - at) / 3),
        );
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      gain.gain.setValueAtTime(0, end);
      build(context, voice, gain, at, end);
      let remaining = voice.sources.length;
      for (const source of voice.sources) {
        source.onended = () => {
          if (--remaining === 0) this.release(voice);
        };
        source.start(at);
        source.stop(end);
      }
      return true;
    } catch {
      this.release(voice);
      return false;
    }
  }
  private tone(
    context: AudioContext,
    voice: Voice,
    output: AudioNode,
    waveform: OscillatorType,
    start: number,
    end: number,
    at: number,
    until: number,
  ) {
    const oscillator = context.createOscillator();
    voice.sources.push(oscillator);
    oscillator.type = waveform;
    this.sweep(oscillator.frequency, context, start, end, at, until);
    oscillator.connect(output);
  }
  private sweep(
    parameter: AudioParam,
    context: AudioContext,
    start: number,
    end: number,
    at: number,
    until: number,
  ) {
    const max = Math.min(12000, context.sampleRate / 2 - 1);
    parameter.setValueAtTime(bounded(start, 20, max), at);
    parameter.exponentialRampToValueAtTime(bounded(end, 20, max), until);
  }
  private release(voice: Voice) {
    if (!this.voices.delete(voice)) return;
    for (const source of voice.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* Already ended or never started. */
      }
    }
    for (const node of [...voice.sources, ...voice.nodes]) node.disconnect();
  }
  private stopAll = () => {
    for (const voice of this.voices) this.release(voice);
  };
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unbind?.();
    this.stopAll();
    this.master?.disconnect();
    this.limiter?.disconnect();
    try {
      void this.context?.close().catch(() => {});
    } catch {
      /* Audio unavailable. */
    }
    this.noise = undefined;
  }
}
