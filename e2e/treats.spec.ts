import { test, expect, devices, type Page } from '@playwright/test';
import { atticEscape } from '../src/game/levels/atticEscape';
import { warehouse } from '../src/game/levels/warehouse';
import { chase } from '../src/game/levels/chase';
import { skyscraper } from '../src/game/levels/skyscraper';

const chapters = [
  {
    id: 'attic-escape',
    checkpoint: 'dash',
    safe: { x: 1130, y: 500 },
    bone: atticEscape.treats[0]!,
  },
  {
    id: 'warehouse',
    checkpoint: 'treat-chain',
    safe: { x: 4220, y: 770 },
    bone: warehouse.treats[0]!,
  },
  {
    id: 'the-chase',
    checkpoint: undefined,
    safe: { x: 4430, y: 420 },
    bone: chase.treats[0]!,
  },
  {
    id: 'skyscraper',
    checkpoint: 'first-chain',
    safe: { x: 1550, y: 3940 },
    bone: skyscraper.treats.find((t) => t.id === 'first-chain-bone')!,
  },
] as const;
async function collect(page: Page, chapter: (typeof chapters)[number]) {
  await page.goto(`/?test&level=${chapter.id}`);
  await page.waitForFunction(
    (id) => window.__sophie?.snapshot().levelId === id,
    chapter.id,
  );
  return page.evaluate((c) => {
    const a = window.__sophie!;
    a.manual(true);
    if (c.checkpoint) a.checkpoint(c.checkpoint);
    else a.chaseSection(c.safe.x);
    a.place({ x: c.bone.x, y: c.bone.y + 12 });
    const picked = a.advance(1);
    // Stage on a safe platform without resetting the world or its collectibles.
    a.place(c.safe);
    return picked;
  }, chapter);
}
async function waitOnPlatform(page: Page, frames: number) {
  return page.evaluate((frames) => {
    const a = window.__sophie!;
    while (frames > 0) {
      // The chase camera is intentionally relentless. Keep the fixture ahead of
      // it while testing the same world clock, without replaying an entire route.
      if (a.snapshot().levelId === 'the-chase') a.chaseSection(4430);
      const count = Math.min(120, frames);
      a.advance(count);
      frames -= count;
    }
    return a.snapshot();
  }, frames);
}
for (const chapter of chapters)
  test(`${chapter.id}: bones return after three active seconds, pause safely, and can be collected again without dying`, async ({
    page,
  }) => {
    const picked = await collect(page, chapter);
    expect(picked.treats).toContain(chapter.bone.id);
    expect(picked.charges).toBe(2);
    const waiting = await waitOnPlatform(page, 240);
    expect(waiting.treats).toContain(chapter.bone.id);
    await page.keyboard.press('Escape');
    const paused = await page.evaluate(() => window.__sophie!.advance(600));
    expect(paused.paused).toBe(true);
    expect(paused.treats).toContain(chapter.bone.id);
    await page.keyboard.press('Escape');
    expect((await waitOnPlatform(page, 119)).treats).toContain(chapter.bone.id);
    const returned = await waitOnPlatform(page, 1);
    expect(returned.treats).not.toContain(chapter.bone.id);
    expect(returned.respawning).toBe(false);
    expect(returned.grounded).toBe(true);
    expect(returned.checkpoint).toBe(waiting.checkpoint);
    expect(returned.charges).toBe(1);
    if (returned.jimmy) {
      const ignored = await page.evaluate((bone) => {
        const a = window.__sophie!;
        a.place({ x: bone.x, y: bone.y + 12 }, true);
        return a.advance(1);
      }, chapter.bone);
      expect(ignored.treats).not.toContain(chapter.bone.id);
      expect(ignored.charges).toBe(1);
    }
    const again = await page.evaluate((bone) => {
      const a = window.__sophie!;
      a.place({ x: bone.x, y: bone.y + 12 });
      return a.advance(1);
    }, chapter.bone);
    expect(again.treats).toContain(chapter.bone.id);
    expect(again.charges).toBe(2);
    expect(again.respawning).toBe(false);
  });

test.describe('mobile bone respawn', () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 13'].userAgent,
  });
  test('portrait freezes the remaining delay and landscape resumes it', async ({
    page,
  }) => {
    const chapter = chapters[0];
    await collect(page, chapter);
    await waitOnPlatform(page, 240);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.rotate-overlay')).toBeVisible();
    const portrait = await page.evaluate(() => window.__sophie!.advance(600));
    expect(portrait.treats).toContain(chapter.bone.id);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.rotate-overlay')).toHaveCount(0);
    expect((await waitOnPlatform(page, 119)).treats).toContain(chapter.bone.id);
    expect((await waitOnPlatform(page, 1)).treats).not.toContain(
      chapter.bone.id,
    );
  });
});
