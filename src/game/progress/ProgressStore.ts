import { sceneDestinations, storySceneKey } from '../scenes/destinations';

export interface SavedProgress {
  version: 1;
  destinationId: string;
  checkpointId?: string;
}

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem'>;
type HashEvents = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export const progressStorageKey = (basePath: string) =>
  `sophie:progress:v1:${basePath}`;

/** Only known chapters and authored safe anchors survive a page reload. */
export function parseProgress(raw: string | null): SavedProgress | undefined {
  if (!raw) return;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (record.version !== 1 || typeof record.destinationId !== 'string')
      return;
    const destination = sceneDestinations.find(
      (entry) => entry.id === record.destinationId,
    );
    if (!destination) return;
    if (storySceneKey(destination.id))
      return record.checkpointId === undefined
        ? { version: 1, destinationId: destination.id }
        : undefined;
    if (
      'checkpoints' in destination &&
      typeof record.checkpointId === 'string' &&
      (record.checkpointId === 'spawn' ||
        destination.checkpoints.some((cp) => cp.id === record.checkpointId))
    )
      return {
        version: 1,
        destinationId: destination.id,
        checkpointId: record.checkpointId,
      };
  } catch {
    // A stale or damaged save must never prevent the game from starting.
  }
}

export class ProgressStore {
  private debugSession = false;
  private lastWrite?: string;
  private failedWrite?: string;
  private retryAt = 0;
  private writable = false;
  private readonly key: string;

  constructor(
    basePath: string,
    private readonly storage: () => ProgressStorage = () => localStorage,
    private readonly hash: () => string = () => location.hash,
    private readonly events?: HashEvents,
    private readonly now: () => number = Date.now,
  ) {
    this.key = progressStorageKey(basePath);
    this.events ??= globalThis.window;
    this.checkDebug();
    this.events?.addEventListener('hashchange', this.checkDebug);
  }

  /** False until a save succeeds, and whenever browser storage rejects it. */
  get available() {
    return this.writable;
  }

  private checkDebug = () => {
    this.debugSession ||= this.hash() === '#debug';
  };

  read() {
    this.checkDebug();
    if (this.debugSession) return;
    try {
      return parseProgress(this.storage().getItem(this.key));
    } catch {
      this.writable = false;
      return;
    }
  }

  saveLevel(destinationId: string, checkpointId: string) {
    return this.write({ version: 1, destinationId, checkpointId });
  }

  saveStory(destinationId: string) {
    return this.write({ version: 1, destinationId });
  }

  private write(progress: SavedProgress) {
    this.checkDebug();
    if (this.debugSession) return false;
    const raw = JSON.stringify(progress);
    if (raw === this.lastWrite) {
      this.writable = true;
      return true;
    }
    if (raw === this.failedWrite && this.now() < this.retryAt) return false;
    if (!parseProgress(raw)) return false;
    try {
      this.storage().setItem(this.key, raw);
      this.lastWrite = raw;
      this.failedWrite = undefined;
      this.writable = true;
      return true;
    } catch {
      // Retry transient storage failures without attempting I/O every frame.
      this.failedWrite = raw;
      this.retryAt = this.now() + 1000;
      this.writable = false;
      return false;
    }
  }

  destroy() {
    this.events?.removeEventListener('hashchange', this.checkDebug);
  }
}
