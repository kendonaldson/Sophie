type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void | Promise<void>;
};
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => void | Promise<void>;
};

/** One app-owned browser capability; scene changes leave fullscreen intact. */
export class FullscreenControl {
  private readonly events = new AbortController();
  private readonly document: FullscreenDocument;
  private pending = false;
  constructor(
    private readonly root: FullscreenElement,
    private readonly button: HTMLButtonElement,
    private readonly status: HTMLElement,
  ) {
    this.document = root.ownerDocument;
    const options = { signal: this.events.signal };
    button.addEventListener('click', this.toggle, options);
    this.document.addEventListener('fullscreenchange', this.sync, options);
    this.document.addEventListener(
      'webkitfullscreenchange',
      this.sync,
      options,
    );
    this.sync();
  }
  private get active() {
    return (
      (this.document.fullscreenElement ??
        this.document.webkitFullscreenElement) === this.root
    );
  }
  private get supported() {
    return typeof this.root.requestFullscreen === 'function'
      ? this.document.fullscreenEnabled !== false
      : Boolean(this.root.webkitRequestFullscreen) &&
          this.document.webkitFullscreenEnabled !== false;
  }
  private sync = () => {
    this.root.classList.toggle('is-fullscreen', this.active);
    this.button.textContent = this.active ? 'Exit Full Screen' : 'Full Screen';
    this.button.disabled = this.pending || !this.supported;
    if (!this.supported)
      this.status.textContent = 'Full screen isn’t available in this browser.';
  };
  private toggle = async () => {
    if (this.pending || !this.supported) return;
    this.pending = true;
    this.status.textContent = '';
    this.sync();
    try {
      // Invoke directly in the click gesture so mobile user activation is retained.
      if (this.active) {
        if (typeof this.document.exitFullscreen === 'function')
          await this.document.exitFullscreen();
        else await this.document.webkitExitFullscreen?.();
      } else if (typeof this.root.requestFullscreen === 'function') {
        await this.root.requestFullscreen({ navigationUI: 'hide' });
      } else await this.root.webkitRequestFullscreen?.();
    } catch {
      this.status.textContent =
        'Full screen couldn’t change. You can continue playing here.';
    } finally {
      this.pending = false;
      this.sync();
    }
  };
  destroy() {
    this.events.abort();
    this.root.classList.remove('is-fullscreen');
  }
}
