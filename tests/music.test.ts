import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LevelMusic } from '../src/game/audio/LevelMusic';

class FakeAudio extends EventTarget {
  preload = '';
  loop = false;
  volume = 1;
  hidden = false;
  src = '';
  paused = true;
  ended = false;
  currentTime = 0;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  load = vi.fn(() => {
    this.currentTime = 0;
    this.ended = false;
  });
  remove = vi.fn();
  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
  }
  finish() {
    this.paused = true;
    this.ended = true;
    this.dispatchEvent(new Event('ended'));
  }
}

let audio: FakeAudio;
let host: HTMLElement;
let browser: EventTarget;
let page: EventTarget & { hidden: boolean };
let music: LevelMusic | undefined;
beforeEach(() => {
  audio = new FakeAudio();
  host = { append: vi.fn() } as unknown as HTMLElement;
  browser = new EventTarget();
  page = Object.assign(new EventTarget(), {
    hidden: false,
    createElement: vi.fn(() => audio),
  });
  vi.stubGlobal('window', browser);
  vi.stubGlobal('document', page);
});
afterEach(() => {
  music?.destroy();
  music = undefined;
  vi.unstubAllGlobals();
});
const gesture = () => browser.dispatchEvent(new Event('pointerup'));

it('keeps ordinary level music looping and preserves its position on pause and track reselection', () => {
  music = new LevelMusic(host, 'assets/audio/level.mp3');
  expect(audio.loop).toBe(true);
  expect(audio.volume).toBe(0.5);
  expect(audio.play).not.toHaveBeenCalled();
  gesture();
  expect(audio.paused).toBe(false);
  audio.currentTime = 12;
  music.setActive(false);
  expect(audio.paused).toBe(true);
  music.setTrack('assets/audio/level.mp3');
  music.setActive(true);
  expect(audio.currentTime).toBe(12);
  expect(audio.load).toHaveBeenCalledOnce();
  expect(audio.paused).toBe(false);
});

it('can hand an activated element to a non-looping scene without requiring another gesture', () => {
  music = new LevelMusic(host, 'assets/audio/level.mp3');
  gesture();
  music.configure({ loop: false, volume: 0.3 });
  music.setTrack('assets/audio/ending.mp3');
  expect(audio.loop).toBe(false);
  expect(audio.volume).toBe(0.3);
  expect(audio.paused).toBe(false);
  expect(audio.play).toHaveBeenCalledTimes(2);
  expect(host.append).toHaveBeenCalledOnce();

  audio.currentTime = 17;
  music.configure({ volume: 0.2 });
  music.setTrack('assets/audio/ending.mp3');
  expect(audio.currentTime).toBe(17);
  expect(audio.load).toHaveBeenCalledTimes(2);
  expect(audio.play).toHaveBeenCalledTimes(2);
});

it('leaves silence after a one-shot track ends, including later gestures, mix updates and resume', () => {
  music = new LevelMusic(host, 'assets/audio/ending.mp3', { loop: false });
  gesture();
  audio.currentTime = 20;
  audio.finish();
  gesture();
  music.setVolume(0.25);
  music.setActive(false);
  music.setActive(true);
  page.hidden = true;
  page.dispatchEvent(new Event('visibilitychange'));
  page.hidden = false;
  page.dispatchEvent(new Event('visibilitychange'));
  music.setTrack('assets/audio/ending.mp3');
  expect(audio.loop).toBe(false);
  expect(audio.play).toHaveBeenCalledOnce();
  expect(audio.paused).toBe(true);
  expect(audio.currentTime).toBe(20);
});

it('fades smoothly to exactly zero with the scene clock, freezing through pause and hidden tabs', () => {
  music = new LevelMusic(host, 'assets/audio/ending.mp3', {
    loop: false,
    volume: 0.3,
  });
  gesture();
  music.fadeOut(3000);
  music.step(1000);
  expect(audio.volume).toBeCloseTo(0.2);
  expect(audio.paused).toBe(false);
  music.setActive(false);
  music.step(1000);
  expect(audio.volume).toBeCloseTo(0.2);
  music.setActive(true);
  page.hidden = true;
  music.step(1000);
  expect(audio.volume).toBeCloseTo(0.2);
  page.hidden = false;
  music.step(1000);
  expect(audio.volume).toBeCloseTo(0.1);
  music.step(1000);
  expect(audio.volume).toBe(0);
  expect(audio.paused).toBe(true);
  gesture();
  expect(audio.paused).toBe(true);
});

it('supports a shared visual/audio fade envelope without restarting playback', () => {
  music = new LevelMusic(host, 'assets/audio/ending.mp3', {
    loop: false,
    volume: 0.3,
  });
  gesture();
  audio.currentTime = 32;
  for (const opacity of [0, 0.25, 0.5, 0.75, 1]) {
    music.setVolume(0.3 * (1 - opacity));
    expect(audio.volume).toBeCloseTo(0.3 * (1 - opacity));
  }
  expect(audio.volume).toBe(0);
  expect(audio.paused).toBe(true);
  expect(audio.currentTime).toBe(32);
  expect(audio.play).toHaveBeenCalledOnce();
});

it('stays silent with no supplied soundtrack and removes its listeners on cleanup', () => {
  music = new LevelMusic(host, undefined, { loop: false, volume: 0.3 });
  gesture();
  music.setVolume(0.15);
  music.setActive(true);
  expect(audio.src).toBe('');
  expect(audio.loop).toBe(false);
  expect(audio.play).not.toHaveBeenCalled();
  music.destroy();
  gesture();
  expect(audio.play).not.toHaveBeenCalled();
  expect(audio.remove).toHaveBeenCalledOnce();
  music = undefined;
});
