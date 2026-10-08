import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { DogTreat } from '../src/game/entities/DogTreat';
import { treatConfig } from '../src/game/config/collectibles';

// Exercise the real collectible with a small display adapter, without booting Phaser.
function display() {
  return {
    visible: true,
    setDepth() {
      return this;
    },
    setVisible(value: boolean) {
      this.visible = value;
      return this;
    },
  };
}
function createTreat() {
  const scene = {
    add: { circle: display, image: display },
  } as unknown as Phaser.Scene;
  return new DogTreat(scene, { id: 'bone', x: 100, y: 100 });
}
const body = { x: 90, y: 90, width: 20, height: 20 };
describe('renewable bones', () => {
  it('hides pickup and glow for three seconds, then restores both and allows collection again', () => {
    const treat = createTreat();
    expect(treat.touches(body)).toBe(true);
    treat.collect();
    expect(treat.collected).toBe(true);
    expect(treat.sprite.visible).toBe(false);
    expect(treat.glow.visible).toBe(false);
    expect(treat.touches(body)).toBe(false);
    treat.step(treatConfig.respawnMs - 1);
    expect(treat.collected).toBe(true);
    treat.step(1);
    expect(treat.collected).toBe(false);
    expect(treat.sprite.visible).toBe(true);
    expect(treat.glow.visible).toBe(true);
    expect(treat.touches(body)).toBe(true);
    treat.collect();
    treat.step(2999);
    expect(treat.collected).toBe(true);
    treat.step(1);
    expect(treat.collected).toBe(false);
  });
  it.each([30, 60, 120])(
    'returns after exactly three simulated seconds at %i Hz',
    (hz) => {
      const treat = createTreat();
      treat.collect();
      for (let i = 0; i < hz * 3 - 1; i++) treat.step(1000 / hz);
      expect(treat.collected).toBe(true);
      treat.step(1000 / hz);
      expect(treat.collected).toBe(false);
    },
  );
  it('keeps independent pickup timers and ignores duplicate collection requests', () => {
    const first = createTreat(),
      second = createTreat();
    first.collect();
    first.step(1500);
    first.collect();
    second.collect();
    first.step(1500);
    second.step(1500);
    expect(first.collected).toBe(false);
    expect(second.collected).toBe(true);
    second.step(1500);
    expect(second.collected).toBe(false);
  });
  it('checkpoint restoration cancels the old timer and the next pickup gets a full three seconds', () => {
    const treat = createTreat();
    treat.collect();
    treat.step(2900);
    treat.restore();
    expect(treat.touches(body)).toBe(true);
    expect(treat.sprite.visible).toBe(true);
    treat.collect();
    treat.step(100);
    expect(treat.collected).toBe(true);
    treat.step(2899);
    expect(treat.collected).toBe(true);
    treat.step(1);
    expect(treat.collected).toBe(false);
    treat.step(5000);
    expect(treat.touches(body)).toBe(true);
  });
});
