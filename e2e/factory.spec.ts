import { test, expect, devices, type Page } from '@playwright/test';
import { factoryTuning as tuning } from '../src/game/factory/config';
import { factoryDialogue } from '../src/game/factory/FactoryStory';
import { pizzaFactory } from '../src/game/levels/pizzaFactory';
import type { SpeechLine } from '../src/ui/SpeechBubble';

const state = (page: Page) => page.evaluate(() => window.__sophie!.snapshot());
async function expectSeparatePowerHud(page: Page) {
  const bones = (await page.locator('#dash-hud').boundingBox())!;
  const pizza = (await page.locator('#pizza-rush').boundingBox())!;
  expect(pizza.y).toBeGreaterThanOrEqual(bones.y + bones.height + 4);
}
async function open(page: Page, opening = false) {
  await page.goto('/?test&level=pizza-factory#debug');
  await page.waitForFunction(
    () => window.__sophie?.snapshot().levelId === 'pizza-factory',
  );
  await page.evaluate((opening) => {
    const a = window.__sophie!;
    a.manual(true);
    a.loadLevel('pizza-factory');
    if (!opening) a.advance(2000);
  }, opening);
}
async function midpoint(page: Page) {
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.place({ x: 4380, y: 960 });
    a.advance(1300);
  });
  expect((await state(page)).factory!.phase).toBe('midpoint');
}
async function pickup(page: Page) {
  return page.evaluate(() => {
    const a = window.__sophie!;
    a.place({ x: 4580, y: 960 });
    let s = a.advance(1, { moveX: 1, dashPressed: true });
    for (let n = 0; n < 30 && !s.factory!.pizza.active; n++)
      s = a.advance(1, { moveX: 1 });
    return s;
  });
}
test('opens safely with supplied art, gives the quick exchange, then releases keyboard control', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const assets: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(r.url());
    if (r.url().endsWith('-atlas.png')) assets.push(r.url());
  });
  await open(page, true);
  const lines = await page.evaluate(() => {
    const a = window.__sophie!,
      lines: SpeechLine[] = [];
    for (let n = 0; n < 2000 && a.snapshot().factory!.scripted; n++) {
      const s = a.advance(1, {
        moveX: 1,
        dashPressed: true,
        jumpPressed: true,
      });
      const line = s.factory!.line;
      const previous = lines.at(-1);
      if (
        line &&
        (previous?.text !== line.text || previous.speaker !== line.speaker)
      )
        lines.push(line);
      if (s.x !== 180) throw new Error('Input escaped the opening dialogue');
    }
    return lines;
  });
  expect(lines).toEqual(factoryDialogue.opening);
  expect(lines.map((line) => line.speaker)).toEqual([
    'shelly',
    'sophie',
    'jimmy',
    'shelly',
  ]);
  expect((await state(page)).factory!.phase).toBe('chase');
  await page.evaluate(() => window.__sophie!.advance(40, { moveX: 1 }));
  expect((await state(page)).x).toBeGreaterThan(220);
  expect(assets.some((a) => a.endsWith('/pizza-dash-atlas.png'))).toBe(true);
  expect(assets.some((a) => a.endsWith('/rotating-pizza-atlas.png'))).toBe(
    true,
  );
  await expect(page.locator('audio')).toHaveAttribute(
    'src',
    '/assets/audio/pizza-dash.mp3',
  );
  await expect(page.locator('audio')).toHaveJSProperty('loop', true);
  await expect(page.locator('audio')).toHaveJSProperty('paused', true);
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  await expect(page.locator('#pizza-rush')).toBeHidden();
  expect(errors).toEqual([]);
});

test('belts carry both ways; only Sophie entering an oven resets, before or after the one safe checkpoint', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const a = window.__sophie!;
    a.place({ x: 740, y: 980 });
    const right = a.advance(60);
    a.place({ x: 1220, y: 940 });
    const left = a.advance(60);
    a.place({ x: 1840, y: 978 }, true);
    const jimmyOven = a.advance(1);
    a.place({ x: 1840, y: 978 });
    const sophieOven = a.advance(1);
    const firstReset = a.advance(30);
    a.checkpoint('factory-midpoint');
    a.place({ x: 6175, y: 998 });
    const secondOven = a.advance(1);
    const secondReset = a.advance(30);
    const moving = a.advance(30, { moveX: 1 });
    return {
      right,
      left,
      jimmyOven,
      sophieOven,
      firstReset,
      secondOven,
      secondReset,
      moving,
    };
  });
  expect(result.right.x).toBeCloseTo(740 + tuning.conveyorWith * 0.5);
  expect(result.left.x).toBeCloseTo(1220 + tuning.conveyorAgainst * 0.5);
  expect(result.jimmyOven.respawning).toBe(false);
  expect(result.sophieOven.respawning).toBe(true);
  expect(result.firstReset).toMatchObject({
    checkpoint: 'spawn',
    x: 180,
    y: 980,
    charges: 1,
  });
  expect(result.firstReset.factory!.pizza.active).toBe(false);
  expect(result.secondOven.respawning).toBe(true);
  expect(result.secondReset).toMatchObject({
    checkpoint: 'factory-midpoint',
    x: 4950,
    y: 960,
    charges: 1,
  });
  expect(result.secondReset.factory).toMatchObject({
    midpointResolved: true,
    finalResolved: false,
    phase: 'second-half',
  });
  expect(result.secondReset.factory!.pizza.pickups[0]!.completed).toBe(true);
  expect(result.secondReset.factory!.roll.phase).toBe('hidden');
  expect(result.moving.x).toBeGreaterThan(4970);
});

test('oven fire forgives top and side grazes during a jump-dash but burns on core contact', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate((oven) => {
    const a = window.__sophie!;
    const halfWidth = 32 - a.snapshot().physics.collisionInsetX;
    const height =
      64 -
      a.snapshot().physics.collisionInsetTop -
      a.snapshot().physics.collisionInsetBottom;
    const center = oven.x + oven.width / 2;
    const safePlacements = [
      { x: center, y: oven.y + 3 },
      { x: oven.x - halfWidth + 2, y: oven.y + 23 },
      { x: oven.x + oven.width + halfWidth - 2, y: oven.y + 23 },
      { x: center, y: oven.y - 12 },
    ].map((point) => {
      a.place(point);
      return a.advance(1);
    });

    // Jump from the first belt, then dash across the visible flame tips.
    a.place({ x: 1780, y: 980 });
    a.advance(1, { moveX: 1, jumpPressed: true, jumpHeld: true });
    const takeoff = a.advance(8, { moveX: 1, jumpHeld: true });
    let crossed = a.advance(1, {
      moveX: 1,
      dashPressed: true,
      jumpHeld: true,
    });
    let grazedFrames = 0;
    for (let n = 0; n < 100 && !crossed.respawning; n++) {
      if (
        crossed.x + halfWidth > oven.x &&
        crossed.x - halfWidth < oven.x + oven.width &&
        crossed.y > oven.y &&
        crossed.y - height < oven.y + oven.height
      )
        grazedFrames++;
      if (crossed.grounded && crossed.x - halfWidth > oven.x + oven.width)
        break;
      crossed = a.advance(1, { moveX: 1, jumpHeld: true });
    }

    a.place({ x: center, y: oven.y + 11 });
    const coreContact = a.advance(1);
    return { safePlacements, takeoff, crossed, grazedFrames, coreContact };
  }, pizzaFactory.factory!.ovens[0]!);

  for (const snapshot of result.safePlacements)
    expect(snapshot.respawning).toBe(false);
  expect(result.takeoff.y).toBeLessThan(980);
  expect(result.takeoff.grounded).toBe(false);
  expect(result.grazedFrames).toBeGreaterThan(10);
  expect(result.crossed.respawning).toBe(false);
  expect(result.crossed.x).toBeGreaterThan(1905);
  expect(result.crossed.grounded).toBe(true);
  expect(result.coreContact.respawning).toBe(true);
});

test('the first shell locks its lane, a normal jump avoids it, Jimmy is harmless, and Sophie collision resets', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const a = window.__sophie!;
    a.place({ x: 2210, y: 980 });
    let s = a.snapshot();
    for (let n = 0; n < 600 && s.factory!.roll.phase !== 'charge'; n++)
      s = a.advance(1);
    const locked = s.factory!.roll.lockedY;
    a.place({ x: s.x, y: 870 });
    const changedHeight = a.advance(10);
    a.place({ x: 2230, y: 980 });
    let jumped = false,
      failed = false;
    for (let n = 0; n < 400; n++) {
      s = a.snapshot();
      const roll = s.factory!.roll;
      const jump = !jumped && roll.phase === 'roll' && roll.x - s.x < 130;
      if (jump) jumped = true;
      s = a.advance(1, { jumpPressed: jump, jumpHeld: true });
      if (s.respawning) {
        failed = true;
        break;
      }
      if (jumped && s.factory!.roll.phase === 'hidden') break;
    }
    const avoided = s;
    a.place({ x: 2210, y: 980 });
    s = a.snapshot();
    for (let n = 0; n < 1400 && s.factory!.roll.phase !== 'roll'; n++)
      s = a.advance(1);
    let roll = s.factory!.roll;
    a.place({ x: roll.x, y: roll.y }, true);
    const jimmyHit = a.advance(1);
    roll = jimmyHit.factory!.roll;
    a.place({ x: roll.x, y: roll.y });
    const sophieHit = a.advance(1);
    return {
      locked,
      changedHeight,
      jumped,
      failed,
      avoided,
      jimmyHit,
      sophieHit,
    };
  });
  expect(result.locked).toBe(980);
  expect(result.changedHeight.factory!.roll.lockedY).toBe(980);
  expect(result.changedHeight.factory!.roll.y).toBe(980);
  expect(result.jumped).toBe(true);
  expect(result.failed).toBe(false);
  expect(result.avoided.respawning).toBe(false);
  expect(result.jimmyHit.respawning).toBe(false);
  expect(result.sophieHit.respawning).toBe(true);
});

test('midpoint blocks normal Sophie; a paid dash through pizza changes sprite and HUD, spins Shelly, and earns the checkpoint', async ({
  page,
}) => {
  await open(page);
  await midpoint(page);
  const blocked = await page.evaluate(() => {
    const a = window.__sophie!;
    a.place({ x: 4700, y: 960 });
    return a.advance(40, { moveX: 1 });
  });
  expect(blocked.factory!.midpointResolved).toBe(false);
  expect(blocked.x).toBeLessThan(4720);
  const above = await page.evaluate(() => {
    const a = window.__sophie!;
    a.place({ x: 4700, y: 960 });
    a.advance(25, { moveX: 1, jumpPressed: true, jumpHeld: true });
    a.advance(1, { moveX: 1, aimY: -1, dashPressed: true, jumpHeld: true });
    return a.advance(70, { moveX: 1, jumpHeld: true });
  });
  expect(above.factory!.midpointResolved).toBe(false);
  expect(above.x).toBeLessThan(4720);
  const power = await pickup(page);
  expect(power.charges).toBe(0);
  expect(power.factory!.pizza.superDash).toBe(true);
  expect(power.factory!.pizza.remainingMs).toBe(8000);
  expect(power.vx).toBe(1080);
  expect(power.jimmy!.vx).toBeLessThanOrEqual(180);
  await expect(page.locator('#pizza-rush')).toBeVisible();
  await expect(page.locator('#dash-hud')).toBeVisible();
  await expectSeparatePowerHud(page);
  await expect
    .poll(async () => (await state(page)).factory!.pizza.sprite)
    .toBe('pizza-dash');
  await expect
    .poll(async () => (await state(page)).factory!.pizza.aura.visible)
    .toBe(true);
  const hit = await page.evaluate(() => {
    const a = window.__sophie!;
    let s = a.snapshot();
    for (let n = 0; n < 100 && !s.factory!.midpointResolved; n++)
      s = a.advance(1, { moveX: 1 });
    return s;
  });
  expect(hit.factory).toMatchObject({
    phase: 'midpoint-spin',
    midpointResolved: true,
    pizza: { active: true },
  });
  expect(hit.charges).toBe(0);
  await expect
    .poll(async () => (await state(page)).factory!.pizza.aura.visible)
    .toBe(true);
  const checkpoint = await page.evaluate(() => {
    const a = window.__sophie!;
    a.advance(130);
    let s = a.snapshot();
    for (let n = 0; n < 300 && s.checkpoint === 'spawn'; n++)
      s = a.advance(1, { moveX: 1 });
    return s;
  });
  expect(checkpoint.checkpoint).toBe('factory-midpoint');
  expect(checkpoint.factory!.pizza.active).toBe(false);
  await expect
    .poll(async () => (await state(page)).factory!.pizza.aura.visible)
    .toBe(false);
  await expect(page.locator('#pizza-rush')).toBeHidden();
});

test('long jumps, tray and vertical refills, and the earned finale tolerate varied keyboard and touch takeoffs', async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate(() => {
    const a = window.__sophie!;
    const results: {
      route: string;
      source: string;
      offset: number;
      wait: number;
      passed: boolean;
      collected: boolean;
    }[] = [];
    const routes = [
      {
        id: 'long',
        x: 7010,
        y: 960,
        waits: [4, 8, 12],
        target: 7420,
        landY: 1000,
        bone: '',
      },
      {
        id: 'chain',
        x: 8080,
        y: 940,
        waits: [24, 30, 36],
        target: 8380,
        landY: 1000,
        bone: 'factory-chain-bone',
      },
      {
        id: 'vertical',
        x: 9080,
        y: 875,
        waits: [20, 26, 32],
        target: 9230,
        landY: 750,
        bone: 'factory-upper-bone',
      },
      {
        id: 'final',
        x: 11534,
        y: 790,
        waits: [4, 8, 12],
        target: 12050,
        landY: 750,
        bone: 'factory-final-bone',
      },
    ];
    for (const source of ['keyboard', 'touch'] as const)
      for (const r of routes)
        for (const offset of [-10, 0, 10])
          for (const wait of r.waits) {
            a.checkpoint('factory-midpoint');
            a.place({ x: r.x - 50, y: r.y });
            let s = a.snapshot();
            if (r.id === 'final') {
              s = a.advance(1);
              for (let n = 0; n < 1600 && s.factory!.scripted; n++)
                s = a.advance(1);
              a.place({ x: r.x - 50, y: r.y });
              s = a.snapshot();
            }
            for (let n = 0; n < 160 && s.x < r.x + offset; n++)
              s = a.advance(1, { moveX: 1 });
            const input = {
              jumpSource: source === 'touch' ? 'touch' : undefined,
              dashSource: source === 'touch' ? 'touch' : undefined,
            } as const;
            if (r.id === 'long' || r.id === 'final') {
              a.advance(wait, { ...input, moveX: 1, dashPressed: true });
              s = a.advance(1, {
                ...input,
                moveX: 1,
                jumpPressed: true,
                jumpHeld: true,
              });
            } else {
              a.advance(wait, {
                ...input,
                moveX: 1,
                jumpPressed: true,
                jumpHeld: true,
              });
              s = a.advance(1, {
                ...input,
                moveX: r.id === 'vertical' ? 0 : 1,
                aimY: r.id === 'vertical' ? -1 : 0,
                dashPressed: true,
                jumpHeld: true,
              });
            }
            let collected = false,
              second = false;
            for (let n = 0; n < 300; n++) {
              collected ||= Boolean(r.bone && s.treats.includes(r.bone));
              const dash: boolean =
                collected &&
                !second &&
                s.state !== 'Dashing' &&
                (r.id !== 'final' || s.x >= 11805);
              second ||= dash;
              s = a.advance(1, {
                ...input,
                moveX: 1,
                jumpHeld: true,
                dashPressed: dash,
                aimY:
                  dash && (r.id === 'chain' || r.id === 'vertical') ? -1 : 0,
              });
              if (
                s.respawning ||
                s.factory!.finalResolved ||
                (s.grounded &&
                  s.x >= r.target - 14 &&
                  Math.abs(s.y - r.landY) < (r.id === 'chain' ? 45 : 1))
              )
                break;
            }
            results.push({
              route: r.id,
              source,
              offset,
              wait,
              collected,
              passed:
                !s.respawning &&
                (r.id === 'final'
                  ? s.factory!.finalResolved
                  : s.grounded &&
                    s.x >= r.target - 14 &&
                    Math.abs(s.y - r.landY) < (r.id === 'chain' ? 45 : 1)),
            });
          }
    return results;
  });
  expect(results).toHaveLength(72);
  expect(results.filter((r) => !r.passed)).toEqual([]);
  expect(results.filter((r) => r.route !== 'long' && !r.collected)).toEqual([]);
  expect(results.filter((r) => r.route === 'long' && r.collected)).toEqual([]);
});

test('the final pizza and Shelly reaction lead to both dogs exiting, then the sole TO BE CONTINUED', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('factory-midpoint');
    a.place({ x: 11260, y: 790 });
    a.advance(1600);
  });
  expect((await state(page)).factory!.phase).toBe('final');
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toHaveCount(0);
  const result = await page.evaluate(() => {
    const a = window.__sophie!;
    // Isolate the final pickup/contact; route coverage exercises the earned
    // dash-jump and treat trajectory separately, without automating the level.
    a.place({ x: 11870, y: 743 });
    a.advance(1, { moveX: 1, dashPressed: true });
    let s = a.snapshot(),
      converted = false;
    for (let n = 0; n < 100 && !s.factory!.finalResolved; n++) {
      s = a.advance(1, { moveX: 1 });
      converted ||= s.factory!.pizza.superDash;
    }
    const hit = s;
    a.advance(50);
    const reacting = a.snapshot();
    const phases: string[] = [];
    const lines: SpeechLine[] = [];
    for (let n = 0; n < 2500 && !s.ending; n++) {
      s = a.advance(1);
      if (phases.at(-1) !== s.factory!.phase) phases.push(s.factory!.phase);
      const line = s.factory!.line;
      const previous = lines.at(-1);
      if (
        s.factory!.phase === 'outro' &&
        line &&
        (previous?.text !== line.text || previous.speaker !== line.speaker)
      )
        lines.push(line);
    }
    return { converted, hit, reacting, phases, lines, end: s };
  });
  expect(result.converted).toBe(true);
  expect(result.hit.factory!.phase).toBe('final-spin');
  expect(result.reacting.factory!.shelly.spinMs).toBeGreaterThan(500);
  expect(result.phases).toEqual([
    'final-spin',
    'outro',
    'escape',
    'empty',
    'fade',
    'complete',
  ]);
  expect(result.lines).toEqual(factoryDialogue.outro);
  expect(result.lines.map((line) => line.speaker)).toEqual([
    'shelly',
    'sophie',
    'jimmy',
  ]);
  expect(result.end.factory!.actors.jimmy.visible).toBe(false);
  expect(result.end.factory!.actors.sophie.visible).toBe(false);
  expect(result.end.factory!.pizza.active).toBe(false);
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toBeVisible();
  await expect(page.locator('#fade')).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Play again' }).click();
  await page.waitForFunction(
    () => window.__sophie?.snapshot().levelId === 'attic-escape',
  );
  await expect(page.locator('#app')).not.toHaveClass(/factory-mode/);
  await expect(page.locator('#pizza-rush')).toBeHidden();
});

test.describe('mobile pizza factory', () => {
  const phone = devices['iPhone 13 landscape']!;
  test.use({
    viewport: phone.viewport,
    userAgent: phone.userAgent,
    deviceScaleFactor: phone.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  });
  test('keeps the touch UI available, freezes power in portrait/pause, and cleans up on Restart and chapter changes', async ({
    page,
  }) => {
    await open(page);
    await midpoint(page);
    await pickup(page);
    await expect(page.locator('.touch-controls')).toBeVisible();
    await expect(page.locator('#pizza-rush')).toBeVisible();
    await expect
      .poll(async () => (await state(page)).factory!.pizza.aura.visible)
      .toBe(true);
    await expectSeparatePowerHud(page);
    const before = await state(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByText('Rotate your device to play', { exact: true }),
    ).toBeVisible();
    const portrait = await page.evaluate(() => window.__sophie!.advance(600));
    expect(portrait.factory!.pizza.remainingMs).toBe(
      before.factory!.pizza.remainingMs,
    );
    expect(portrait.x).toBe(before.x);
    expect(portrait.factory!.pizza.aura.visible).toBe(true);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.getByRole('button', { name: 'Pause game' }).click();
    const paused = await page.evaluate(() => window.__sophie!.advance(600));
    expect(paused.factory!.pizza.remainingMs).toBe(
      before.factory!.pizza.remainingMs,
    );
    expect(paused.factory!.pizza.aura.visible).toBe(true);
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    expect((await state(page)).factory).toMatchObject({
      phase: 'opening',
      midpointResolved: false,
    });
    await expect(page.locator('#pizza-rush')).toBeHidden();
    expect((await state(page)).factory!.pizza.aura.visible).toBe(false);
    await page
      .getByRole('combobox', { name: 'Debug level' })
      .selectOption('warehouse');
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await expect(page.locator('#app')).not.toHaveClass(/factory-mode/);
    expect((await state(page)).factory).toBeUndefined();
  });
});
