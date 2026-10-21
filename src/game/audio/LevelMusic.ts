export interface MusicOptions {
  loop?: boolean;
  volume?: number;
}

/** Stream a track without delaying scene creation or decoding it all up front.
 * The same instance can pass between scenes to retain mobile audio activation. */
export class LevelMusic {
  private readonly audio: HTMLAudioElement;
  private active = true;
  private activated = false;
  private destroyed = false;
  private finished = false;
  private asset?: string;
  private fade?: { from: number; duration: number; elapsed: number };

  constructor(host: HTMLElement, asset?: string, options: MusicOptions = {}) {
    this.audio = document.createElement('audio');
    this.audio.preload = 'metadata';
    this.audio.loop = options.loop ?? true;
    this.audio.volume = this.clampVolume(options.volume ?? 0.5);
    this.audio.hidden = true;
    host.append(this.audio);
    window.addEventListener('keydown', this.onGesture);
    // Touch pointerup is an activation gesture even when controls prevent default clicks.
    window.addEventListener('pointerup', this.onGesture);
    document.addEventListener('visibilitychange', this.sync);
    this.audio.addEventListener('ended', this.onEnded);
    this.setTrack(asset);
  }

  /** Change playback policy without reloading or restarting the current track. */
  configure(options: MusicOptions) {
    if (options.loop !== undefined) this.audio.loop = options.loop;
    if (options.volume !== undefined) this.setVolume(options.volume);
    else this.sync();
  }

  setTrack(asset?: string) {
    if (asset === this.asset) return;
    this.asset = asset;
    this.finished = false;
    this.fade = undefined;
    this.audio.pause();
    if (asset) this.audio.src = `${import.meta.env.BASE_URL}${asset}`;
    else this.audio.removeAttribute('src');
    // Reuse the gesture-activated element when chapters change. Checkpoint
    // retries and repeated selection of the same track preserve playback time.
    this.audio.load();
    this.sync();
  }

  setActive(active: boolean) {
    this.active = active;
    this.sync();
  }

  restart() {
    this.finished = false;
    this.audio.currentTime = 0;
    this.sync();
  }
  setVolume(volume: number) {
    this.fade = undefined;
    this.audio.volume = this.clampVolume(volume);
    this.sync();
  }
  /** Driven by the scene clock so pause/portrait also freeze the fade. */
  fadeOut(durationMs: number) {
    this.fade = {
      from: this.audio.volume,
      duration: Number.isFinite(durationMs) ? Math.max(1, durationMs) : 1,
      elapsed: 0,
    };
  }
  step(ms: number) {
    if (!this.fade || !this.active || document.hidden) return;
    this.fade.elapsed = Math.min(
      this.fade.duration,
      this.fade.elapsed + (Number.isFinite(ms) ? Math.max(0, ms) : 0),
    );
    this.audio.volume =
      this.fade.from * (1 - this.fade.elapsed / this.fade.duration);
    if (this.fade.elapsed === this.fade.duration) {
      this.fade = undefined;
      this.sync();
    }
  }

  private onGesture = () => {
    this.activated = true;
    this.sync();
  };

  private onEnded = () => {
    if (!this.audio.loop) this.finished = true;
  };

  private clampVolume(volume: number) {
    return Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
  }

  private sync = () => {
    if (this.destroyed) return;
    if (!this.active || document.hidden || this.audio.volume === 0) {
      this.audio.pause();
    } else if (
      this.asset &&
      this.activated &&
      this.audio.paused &&
      !this.finished &&
      (!this.audio.ended || this.audio.loop)
    ) {
      // Call synchronously inside the gesture for mobile autoplay policies. Keep the
      // listeners so a denied/interrupted attempt can retry on the next interaction.
      void this.audio.play().then(
        () => {
          if (
            this.destroyed ||
            !this.active ||
            document.hidden ||
            this.audio.volume === 0
          )
            this.audio.pause();
        },
        () => {
          // Missing audio or denied playback must never interrupt gameplay.
        },
      );
    }
  };

  destroy() {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onGesture);
    window.removeEventListener('pointerup', this.onGesture);
    document.removeEventListener('visibilitychange', this.sync);
    this.audio.removeEventListener('ended', this.onEnded);
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.audio.remove();
  }
}
