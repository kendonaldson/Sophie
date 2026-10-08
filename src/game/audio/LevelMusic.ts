/** Stream one looping track without delaying scene creation or decoding it all up front. */
export class LevelMusic {
  private readonly audio: HTMLAudioElement;
  private active = true;
  private activated = false;
  private destroyed = false;

  constructor(host: HTMLElement, asset: string) {
    this.audio = document.createElement('audio');
    this.audio.src = `${import.meta.env.BASE_URL}${asset}`;
    this.audio.preload = 'metadata';
    this.audio.loop = true;
    this.audio.volume = 0.5;
    this.audio.hidden = true;
    host.append(this.audio);
    window.addEventListener('keydown', this.onGesture);
    // Touch pointerup is an activation gesture even when controls prevent default clicks.
    window.addEventListener('pointerup', this.onGesture);
    document.addEventListener('visibilitychange', this.sync);
  }

  setActive(active: boolean) {
    this.active = active;
    this.sync();
  }

  restart() {
    this.audio.currentTime = 0;
  }
  setVolume(volume: number) {
    this.audio.volume = volume;
  }

  private onGesture = () => {
    this.activated = true;
    this.sync();
  };

  private sync = () => {
    if (this.destroyed) return;
    if (!this.active || document.hidden) {
      this.audio.pause();
    } else if (this.activated && this.audio.paused) {
      // Call synchronously inside the gesture for mobile autoplay policies. Keep the
      // listeners so a denied/interrupted attempt can retry on the next interaction.
      void this.audio.play().then(
        () => {
          if (this.destroyed || !this.active || document.hidden)
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
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.audio.remove();
  }
}
