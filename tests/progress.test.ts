import { describe, expect, it, vi } from 'vitest';
import {
  parseProgress,
  ProgressStore,
  progressStorageKey,
} from '../src/game/progress/ProgressStore';

const checkpoint = {
  version: 1,
  destinationId: 'attic-escape',
  checkpointId: 'dash',
} as const;
const serialized = JSON.stringify(checkpoint);

function storage() {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
  };
}

describe('saved progress', () => {
  it('keeps only authored chapter/checkpoint IDs and restarts stories from their beginning', () => {
    expect(parseProgress(serialized)).toEqual(checkpoint);
    expect(
      parseProgress(JSON.stringify({ ...checkpoint, x: 9999, charges: 2 })),
    ).toEqual(checkpoint);
    expect(
      parseProgress(
        JSON.stringify({ version: 1, destinationId: 'interlude-3' }),
      ),
    ).toEqual({ version: 1, destinationId: 'interlude-3' });
    expect(
      parseProgress(JSON.stringify({ ...checkpoint, checkpointId: 'spawn' })),
    ).toEqual({ ...checkpoint, checkpointId: 'spawn' });
  });

  it.each([
    null,
    'broken JSON',
    'null',
    '42',
    '{}',
    JSON.stringify({ ...checkpoint, version: 2 }),
    JSON.stringify({ ...checkpoint, destinationId: 'deleted-chapter' }),
    JSON.stringify({ ...checkpoint, checkpointId: 'deleted-anchor' }),
    JSON.stringify({ ...checkpoint, checkpointId: 4 }),
    JSON.stringify({ version: 1, destinationId: 'attic-escape' }),
    JSON.stringify({ ...checkpoint, destinationId: 'interlude-1' }),
  ])('ignores unsupported or malformed saves: %s', (raw) => {
    expect(parseProgress(raw)).toBeUndefined();
  });

  it('scopes saves to the deployment path and writes only when progress changes', () => {
    const backing = storage();
    const first = new ProgressStore(
      '/Sophie/',
      () => backing,
      () => '',
    );
    expect(first.available).toBe(false);
    expect(first.saveLevel('attic-escape', 'dash')).toBe(true);
    expect(first.available).toBe(true);
    first.saveLevel('attic-escape', 'dash');
    expect(backing.setItem).toHaveBeenCalledTimes(1);
    expect(first.read()).toEqual(checkpoint);
    const second = new ProgressStore(
      '/preview/',
      () => backing,
      () => '',
    );
    expect(second.read()).toBeUndefined();
    expect(backing.getItem).toHaveBeenLastCalledWith(
      progressStorageKey('/preview/'),
    );
    expect(first.saveStory('interlude-1')).toBe(true);
    expect(first.read()).toEqual({ version: 1, destinationId: 'interlude-1' });
  });

  it('leaves normal progress intact throughout a debug session, including after the fragment is removed', () => {
    const backing = storage();
    let hash = '';
    const events = new EventTarget();
    const store = new ProgressStore(
      '/',
      () => backing,
      () => hash,
      events,
    );
    store.saveLevel('attic-escape', 'dash');
    hash = '#debug';
    events.dispatchEvent(new Event('hashchange'));
    expect(store.read()).toBeUndefined();
    expect(store.saveLevel('pizza-factory', 'factory-final')).toBe(false);
    hash = '';
    events.dispatchEvent(new Event('hashchange'));
    expect(store.saveStory('interlude-3')).toBe(false);
    expect(backing.getItem(progressStorageKey('/'))).toBe(serialized);
    store.destroy();
    expect(
      new ProgressStore(
        '/',
        () => backing,
        () => '',
      ).read(),
    ).toEqual(checkpoint);
  });

  it('does not load or write normal progress when the page opens in debug mode', () => {
    const backing = storage();
    backing.setItem(progressStorageKey('/'), serialized);
    const store = new ProgressStore(
      '/',
      () => backing,
      () => '#debug',
    );
    expect(store.read()).toBeUndefined();
    expect(store.saveLevel('warehouse', 'spawn')).toBe(false);
    expect(backing.getItem(progressStorageKey('/'))).toBe(serialized);
  });

  it('keeps playing when storage access is denied or the quota is exhausted', () => {
    const denied = new ProgressStore(
      '/',
      () => {
        throw new Error('Storage access denied');
      },
      () => '',
    );
    expect(denied.read()).toBeUndefined();
    expect(denied.saveLevel('attic-escape', 'dash')).toBe(false);
    expect(denied.available).toBe(false);
    const backing = storage();
    const store = new ProgressStore(
      '/',
      () => backing,
      () => '',
    );
    expect(store.saveLevel('attic-escape', 'dash')).toBe(true);
    backing.setItem.mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    expect(store.saveStory('interlude-1')).toBe(false);
    expect(store.available).toBe(false);
    expect(store.read()).toEqual(checkpoint);
  });

  it('retries a failed checkpoint after one second and deduplicates only successful saves', () => {
    const backing = storage();
    const write = backing.setItem.getMockImplementation()!;
    backing.setItem.mockImplementationOnce(() => {
      throw new Error('Storage temporarily unavailable');
    });
    let now = 0;
    const store = new ProgressStore(
      '/',
      () => backing,
      () => '',
      undefined,
      () => now,
    );
    expect(store.saveLevel('attic-escape', 'dash')).toBe(false);
    backing.setItem.mockImplementation(write);
    for (now = 0; now < 1000; now += 10)
      expect(store.saveLevel('attic-escape', 'dash')).toBe(false);
    expect(backing.setItem).toHaveBeenCalledTimes(1);
    expect(store.saveLevel('attic-escape', 'dash')).toBe(true);
    expect(store.available).toBe(true);
    expect(store.read()).toEqual(checkpoint);
    expect(backing.setItem).toHaveBeenCalledTimes(2);
    store.saveLevel('attic-escape', 'dash');
    expect(backing.setItem).toHaveBeenCalledTimes(2);
  });
});
