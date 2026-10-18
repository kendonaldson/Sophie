import { requestOffline, waitForActive } from '../offline/client';
import type { OfflineReply } from '../offline/protocol';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function installOfflinePlay(root: HTMLElement): () => void {
  // Vite development builds and their test APIs must never enter a game cache.
  if (!import.meta.env.PROD) return () => {};
  const offline = new OfflinePlay(root);
  return () => offline.destroy();
}

class OfflinePlay {
  private readonly panel = document.createElement('details');
  private readonly summary: HTMLElement;
  private readonly status: HTMLElement;
  private readonly progress: HTMLProgressElement;
  private readonly download: HTMLButtonElement;
  private readonly update: HTMLButtonElement;
  private readonly install: HTMLButtonElement;
  private readonly events = new AbortController();
  private registration?: ServiceWorkerRegistration;
  private current?: OfflineReply;
  private waiting?: OfflineReply;
  private installPrompt?: InstallPrompt;
  private busy = false;
  private refreshing = false;
  private applying = false;
  private error = '';
  private disposed = false;

  constructor(root: HTMLElement) {
    this.panel.id = 'offline-panel';
    this.panel.className = 'offline-panel pause-only';
    this.panel.innerHTML = `<summary>Offline play <span id="offline-summary">Checking…</span></summary>
      <div class="offline-content"><p id="offline-status" role="status" aria-live="polite">Checking offline availability…</p>
      <progress id="offline-progress" aria-label="Offline download progress" hidden></progress>
      <div class="offline-actions"><button id="offline-download" class="menu-button" disabled>Download for offline play</button><button id="offline-update" class="menu-button" hidden>Restart to update</button><button id="offline-install" class="menu-button" hidden>Install Sophie</button></div>
      <p class="offline-help">Install from your browser menu using “Install app” or “Add to Home Screen”. Clearing site data removes downloads and saved progress.</p></div>`;
    root.querySelector('#overlay')!.append(this.panel);
    this.summary = this.panel.querySelector('#offline-summary')!;
    this.status = this.panel.querySelector('#offline-status')!;
    this.progress = this.panel.querySelector('#offline-progress')!;
    this.download = this.panel.querySelector('#offline-download')!;
    this.update = this.panel.querySelector('#offline-update')!;
    this.install = this.panel.querySelector('#offline-install')!;
    const options = { signal: this.events.signal };
    this.download.addEventListener(
      'click',
      () => void this.downloadGame(),
      options,
    );
    this.update.addEventListener(
      'click',
      () => void this.applyUpdate(),
      options,
    );
    this.install.addEventListener(
      'click',
      () => void this.installGame(),
      options,
    );
    window.addEventListener(
      'beforeinstallprompt',
      (event) => {
        event.preventDefault();
        this.installPrompt = event as InstallPrompt;
        this.install.hidden = false;
      },
      options,
    );
    window.addEventListener(
      'appinstalled',
      () => {
        this.installPrompt = undefined;
        this.install.hidden = true;
      },
      options,
    );
    if (
      !isSecureContext ||
      !('serviceWorker' in navigator) ||
      !('caches' in window)
    ) {
      this.summary.textContent = 'Unavailable';
      this.status.textContent =
        'Offline downloads aren’t available in this browser. You can still play while connected.';
      return;
    }
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        if (this.applying) location.reload();
        else void this.refresh();
      },
      options,
    );
    this.panel.addEventListener(
      'toggle',
      () => {
        if (this.panel.open) void this.refresh();
      },
      options,
    );
    window.addEventListener(
      'online',
      () => {
        void this.registration?.update().catch(() => {});
        void this.refresh();
      },
      options,
    );
    window.addEventListener('offline', () => void this.refresh(), options);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) void this.refresh();
      },
      options,
    );
    void this.register();
  }

  private async register() {
    this.busy = true;
    this.error = '';
    try {
      const base = import.meta.env.BASE_URL;
      this.registration = await navigator.serviceWorker.register(
        `${base}sw.js`,
        {
          scope: base,
          updateViaCache: 'none',
        },
      );
      const watch = () => {
        const worker = this.registration?.installing;
        worker?.addEventListener(
          'statechange',
          () => {
            if (worker.state === 'installed' || worker.state === 'activated')
              void this.refresh();
          },
          { signal: this.events.signal },
        );
      };
      this.registration.addEventListener('updatefound', watch, {
        signal: this.events.signal,
      });
      watch();
      await waitForActive(this.registration);
    } catch {
      this.error = 'Offline setup couldn’t start. Reconnect and try again.';
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  private async refresh() {
    if (this.disposed || this.busy || this.refreshing) return;
    this.refreshing = true;
    try {
      const active = this.registration?.active;
      const waiting = this.registration?.waiting;
      if (active)
        this.current = await requestOffline(active, { type: 'STATUS' });
      this.waiting = waiting
        ? await requestOffline(waiting, { type: 'STATUS' })
        : undefined;
    } catch {
      this.error = 'Couldn’t verify the download. Reconnect and try again.';
    } finally {
      this.refreshing = false;
      this.render();
    }
  }

  private render() {
    if (this.disposed) return;
    const ready = Boolean(this.current?.ready);
    this.summary.textContent = this.busy
      ? 'Downloading…'
      : ready
        ? 'Ready offline'
        : 'Not downloaded';
    this.panel.dataset.ready = String(ready);
    const latest = this.waiting ?? this.current;
    const size = latest
      ? ` (${(latest.totalBytes / 1000000).toFixed(1)} MB)`
      : '';
    this.status.textContent =
      this.error ||
      (this.waiting?.ready
        ? ready
          ? 'Ready offline. A new version is downloaded; restart when you’re ready.'
          : 'Download complete. Restart to use this version offline.'
        : ready
          ? 'All chapters and music are downloaded. You can close Sophie and reopen without internet.'
          : `Download all chapters, artwork, and music${size} to play without internet.`);
    this.download.hidden = Boolean(latest?.ready);
    this.download.disabled = this.busy;
    this.download.textContent = this.error
      ? 'Try download again'
      : this.waiting
        ? 'Download new version'
        : 'Download for offline play';
    this.update.hidden = !this.waiting?.ready;
    this.update.disabled = this.busy || this.applying;
    if (!this.busy) this.progress.hidden = true;
  }

  private async downloadGame() {
    if (this.busy) return;
    if (!this.registration?.active) {
      await this.register();
      if (!this.registration?.active) return;
    }
    const worker = this.registration.waiting ?? this.registration.active;
    this.busy = true;
    this.error = '';
    this.render();
    this.progress.hidden = false;
    this.progress.removeAttribute('value');
    // Browsers decide whether to grant persistence; a denial still permits caching.
    void navigator.storage?.persist?.().catch(() => false);
    try {
      await requestOffline(worker, { type: 'DOWNLOAD' }, (reply) => {
        this.progress.max = reply.totalBytes || reply.total;
        this.progress.value = reply.totalBytes
          ? reply.downloadedBytes
          : reply.completed;
        this.status.textContent = `Downloading ${reply.completed} of ${reply.total} files…`;
      });
    } catch (error) {
      this.error = `${error instanceof Error ? error.message : 'Download failed.'} Check your connection and available storage, then try again.`;
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  private async applyUpdate() {
    const waiting = this.registration?.waiting;
    if (!waiting || this.applying) return;
    this.applying = true;
    this.error = '';
    this.render();
    try {
      const active = this.registration?.active;
      const current = active
        ? await requestOffline(active, { type: 'STATUS' })
        : undefined;
      await requestOffline(waiting, {
        type: 'ACTIVATE',
        activeVersion: current?.version,
      });
    } catch (error) {
      this.applying = false;
      this.error =
        error instanceof Error
          ? error.message
          : 'Couldn’t apply the update. Please try again.';
      this.render();
    }
  }

  private async installGame() {
    const prompt = this.installPrompt;
    if (!prompt) return;
    this.installPrompt = undefined;
    this.install.hidden = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      this.status.textContent =
        'Use your browser menu to install Sophie or add it to your Home Screen.';
    }
  }

  destroy() {
    this.disposed = true;
    this.events.abort();
    this.panel.remove();
  }
}
