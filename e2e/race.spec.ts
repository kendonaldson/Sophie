import { devices, expect, test, type Page } from '@playwright/test';
import { raceHome } from '../src/game/levels/raceHome';

const state = (page: Page) => page.evaluate(() => window.__sophie!.snapshot());
async function open(page: Page, opening = false) {
  await page.goto('/?test&level=race-home#debug');
  await page.waitForFunction(
    () => window.__sophie?.snapshot().levelId === 'race-home',
  );
  await page.evaluate((opening) => {
    const a = window.__sophie!;
    a.manual(true);
    a.loadLevel('race-home');
    if (!opening) a.advance(1000);
  }, opening);
}

test('the short bus opening restores control without a race deadline', async ({
  page,
}) => {
  const errors: string[] = [],
    assets: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(response.url());
    if (response.url().includes('/assets/')) assets.push(response.url());
  });
  await open(page, true);
  const opening = await page.evaluate(() => {
    const a = window.__sophie!;
    const initial = a.advance(1);
    const lines: string[] = [];
    let s = initial,
      frames = 0;
    for (; frames < 900 && s.race!.scripted; frames++) {
      const line = s.race!.line?.text;
      if (line && lines.at(-1) !== line) lines.push(line);
      s = a.advance(1, { moveX: 1, jumpPressed: true, dashPressed: true });
      if (s.x !== initial.x)
        throw new Error(
          `Input escaped the opening: frame ${frames}, x ${initial.x} -> ${s.x}, phase ${s.race!.phase}`,
        );
    }
    const released = a.advance(40, { moveX: 1 });
    a.advance(7200);
    return { initial, lines, frames, released, rested: a.snapshot() };
  });
  expect(opening.lines).toEqual([
    'The kids are going home from school!',
    "Let's take a shortcut.\nWe'll get back in time.",
  ]);
  expect(opening.frames).toBeLessThan(840);
  expect(opening.released.race!.scripted).toBe(false);
  expect(opening.released.x).toBeGreaterThan(opening.initial.x + 30);
  expect(opening.rested.respawning).toBe(false);
  expect(opening.rested.ending).toBe(false);
  expect(opening.rested.checkpoint).toBe('spawn');
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  await expect(page.locator('.dialogue')).toBeHidden();
  expect(assets.some((url) => url.endsWith('/sparrow.png'))).toBe(true);
  expect(assets.some((url) => url.endsWith('/rat-atlas.png'))).toBe(true);
  expect(errors).toEqual([]);
});

test('every checkpoint resets hazard and machinery cycles and supports an immediate jump', async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate((checkpoints) => {
    const a = window.__sophie!;
    return checkpoints.map((checkpoint) => {
      a.checkpoint(checkpoint.id);
      const initial = a.advance(1);
      const jumped = a.advance(1, { jumpPressed: true, jumpHeld: true });
      a.advance(120);
      a.checkpoint(checkpoint.id);
      const reset = a.advance(1);
      return { checkpoint, initial, jumped, reset };
    });
  }, raceHome.checkpoints);
  for (const { checkpoint, initial, jumped, reset } of results) {
    expect(initial.race!.scripted, checkpoint.id).toBe(false);
    expect(initial.grounded, checkpoint.id).toBe(true);
    expect(jumped.vy, checkpoint.id).toBeLessThan(0);
    expect(jumped.respawning, checkpoint.id).toBe(false);
    expect(reset).toMatchObject({
      x: checkpoint.spawn.x,
      y: checkpoint.spawn.y,
      charges: 1,
      respawning: false,
      race: { scripted: false, pizza: { active: false } },
    });
    expect(reset.race!.birds).toEqual(initial.race!.birds);
    expect(reset.race!.rats).toEqual(initial.race!.rats);
    expect(reset.race!.steam).toEqual(initial.race!.steam);
    expect(reset.machinery).toEqual(initial.machinery);
    expect(reset.jimmy!.enabled).toBe(true);
    expect(Math.abs(reset.jimmy!.x - reset.x)).toBeLessThan(100);
  }
});

test('the balloon-chain bonus treat and dash charge restore immediately with its checkpoint', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('race-balloon-chain');
    a.place({ x: 7700, y: 967 });
    const collected = a.advance(1);
    const spent = a.advance(1, { moveX: 1, dashPressed: true });
    a.checkpoint('race-balloon-chain');
    const retry = a.advance(1);
    a.place({ x: 7700, y: 967 });
    const recollected = a.advance(1);
    return { collected, spent, retry, recollected };
  });
  expect(result.collected.treats).toContain('race-balloon-chain-one');
  expect(result.collected.charges).toBe(2);
  expect(result.spent.charges).toBe(1);
  expect(result.retry.treats).not.toContain('race-balloon-chain-one');
  expect(result.retry).toMatchObject({
    x: 7470,
    y: 1050,
    grounded: true,
    charges: 1,
    respawning: false,
  });
  expect(result.recollected.charges).toBe(2);
});

test('ordinary Sophie resets on bird and rat contact while Jimmy cannot trigger either hazard', async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate(() => {
    const a = window.__sophie!;
    return (['birds', 'rats'] as const).map((kind) => {
      a.loadLevel('race-home');
      // Establish the section before sampling its patrol: entering a new
      // checkpoint intentionally resets creature positions for a fair retry.
      a.checkpoint(kind === 'birds' ? 'race-scaffold' : 'race-tunnel-entry');
      const creature = a.snapshot().race![kind][0]!;
      const feet = {
        x: creature.x,
        y: creature.y + (kind === 'birds' ? 12 : 0),
      };
      a.place(feet, true);
      const jimmy = a.advance(1);
      const moved = jimmy.race![kind][0]!;
      a.place({ x: moved.x, y: moved.y + (kind === 'birds' ? 12 : 0) });
      const sophie = a.advance(1);
      const retry = a.advance(30);
      return { kind, jimmy, sophie, retry };
    });
  });
  for (const result of results) {
    expect(result.jimmy.respawning, result.kind).toBe(false);
    expect(result.sophie.respawning, result.kind).toBe(true);
    expect(result.sophie.race![result.kind][0]!.scattered).toBe(false);
    expect(result.retry.respawning, result.kind).toBe(false);
    expect(result.retry.race!.scripted, result.kind).toBe(false);
    expect(result.retry.charges, result.kind).toBe(1);
  }
});

test('Pizza Rush scatters construction birds during a long jump and restores the slice on retry', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('race-construction-span');
    let s = a.advance(1),
      collected = false;
    for (let n = 0; n < 500 && s.x < 3620 && !s.respawning; n++) {
      s = a.advance(1, { moveX: 1 });
      collected ||= s.race!.pizza.active;
    }
    a.advance(6, { moveX: 1, dashPressed: true });
    s = a.advance(1, { moveX: 1, jumpPressed: true, jumpHeld: true });
    let scatteredDuringJump = false;
    for (let n = 0; n < 180 && !s.respawning && s.x < 4240; n++) {
      s = a.advance(1, { moveX: 1, jumpHeld: true });
      scatteredDuringJump ||=
        s.race!.birds.some((bird) => bird.scattered) && s.state !== 'Dashing';
    }
    const crossed = s;
    for (let n = 0; n < 180 && s.x < 4460 && !s.respawning; n++)
      s = a.advance(1, { moveX: 1 });
    const landedCheckpoint = s;
    a.checkpoint('race-construction-span');
    return {
      collected,
      scatteredDuringJump,
      crossed,
      landedCheckpoint,
      retry: a.snapshot(),
    };
  });
  expect(result.collected).toBe(true);
  expect(result.scatteredDuringJump).toBe(true);
  expect(result.crossed.respawning).toBe(false);
  expect(result.crossed.x).toBeGreaterThan(4070);
  expect(result.crossed.race!.pizza.active).toBe(true);
  expect(result.landedCheckpoint.checkpoint).toBe('race-jimmy-launch');
  expect(result.landedCheckpoint.race!.pizza.active).toBe(true);
  expect(result.landedCheckpoint.race!.pizza.remainingMs).toBeGreaterThan(0);
  expect(result.landedCheckpoint.race!.pizza.remainingMs).toBeLessThan(
    result.crossed.race!.pizza.remainingMs,
  );
  expect(result.retry.race!.pizza.active).toBe(false);
  expect(result.retry.race!.birds.every((bird) => !bird.scattered)).toBe(true);
  expect(
    result.retry.race!.pizza.pickups.find(
      (pizza) => pizza.id === 'race-construction-pizza',
    )!.available,
  ).toBe(true);
});

test('the powered pipe burst scatters rats, but active steam still resets Sophie', async ({
  page,
}) => {
  await open(page);
  const pipes = raceHome.platforms.filter(
    (platform) =>
      platform.style === 'pipe' && platform.x > 15720 && platform.x < 17050,
  );
  const result = await page.evaluate((pipes) => {
    const a = window.__sophie!;
    a.checkpoint('race-tunnel-burst');
    // Align the existing predictable cycle before taking the slice. No hazard
    // or power state is bypassed: the pipe route reaches steam while it fires.
    a.advance(600);
    a.place({ x: 15720, y: 1450 });
    let s = a.advance(1);
    const pickup = s;
    let scattered = 0;
    for (let n = 0; n < 700 && !s.respawning; n++) {
      const pipe = pipes.find((pipe) => pipe.x > s.x);
      const jump = s.grounded && Boolean(pipe && pipe.x - s.x < 70);
      s = a.advance(1, { moveX: 1, jumpPressed: jump, jumpHeld: true });
      scattered = Math.max(
        scattered,
        s.race!.rats.filter((rat) => rat.scattered).length,
      );
    }
    const hit = s;
    return { pickup, scattered, hit, retry: a.advance(30) };
  }, pipes);
  expect(result.pickup.race!.pizza.active).toBe(true);
  expect(result.pickup.charges).toBe(1);
  expect(result.scattered).toBeGreaterThanOrEqual(2);
  expect(result.hit.respawning).toBe(true);
  expect(result.hit.race!.pizza.active).toBe(true);
  expect(result.hit.race!.steam.some((steam) => steam.active)).toBe(true);
  expect(result.hit.x).toBeGreaterThan(17020);
  expect(result.retry).toMatchObject({
    checkpoint: 'race-tunnel-burst',
    x: 15580,
    y: 1450,
    charges: 1,
    race: { scripted: false, pizza: { active: false } },
  });
  expect(result.retry.race!.rats.every((rat) => !rat.scattered)).toBe(true);
  expect(result.retry.race!.steam.every((steam) => !steam.active)).toBe(true);
});

test('Pizza Rush cannot save Sophie from falling off a balloon', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('race-balloon-burst');
    let s = a.advance(1),
      collected = false;
    for (let n = 0; n < 400 && !s.respawning; n++) {
      s = a.advance(1, { moveX: 1 });
      collected ||= s.race!.pizza.active;
    }
    return { collected, fallen: s, retry: a.advance(30) };
  });
  expect(result.collected).toBe(true);
  expect(result.fallen.race!.pizza.active).toBe(true);
  expect(result.fallen.respawning).toBe(true);
  expect(result.fallen.y).toBeGreaterThan(result.fallen.race!.fallBoundary);
  expect(result.retry).toMatchObject({
    checkpoint: 'race-balloon-burst',
    charges: 1,
    respawning: false,
  });
  expect(result.retry.race!.pizza.active).toBe(false);
});

test('Jimmy uses the combined super jump to land both dogs on the first stable crown', async ({
  page,
}) => {
  const animationWarnings: string[] = [];
  page.on('console', (message) => {
    if (
      ['warning', 'error'].includes(message.type()) &&
      /animation/i.test(message.text())
    )
      animationWarnings.push(message.text());
  });
  await open(page);
  const result = await page.evaluate((definition) => {
    const a = window.__sophie!;
    a.place({ x: definition.triggerX, y: definition.staging.y });
    let s = a.advance(1),
      sawCombined = false,
      hiddenWhileCombined = true;
    const frames: number[] = [];
    for (let n = 0; n < 500 && s.race!.scripted; n++) {
      s = a.advance(1, { moveX: -1, dashPressed: true, jumpPressed: true });
      const combined = s.race!.combinedJump;
      if (combined.visible) {
        sawCombined = true;
        hiddenWhileCombined &&=
          !s.race!.actors.sophie.visible && !s.race!.actors.jimmy.visible;
        if (!frames.includes(combined.frame)) frames.push(combined.frame);
      }
    }
    return { sawCombined, hiddenWhileCombined, frames, landed: s };
  }, raceHome.race!.superJump);
  expect(result.sawCombined).toBe(true);
  expect(result.hiddenWhileCombined).toBe(true);
  expect(result.frames.length).toBeGreaterThan(1);
  expect(result.landed.race!.combinedJump.texture).toBe(
    'sophie-jimmy-super-jump',
  );
  expect(result.landed.race!.combinedJump.visible).toBe(false);
  expect(result.landed.checkpoint).toBe(raceHome.race!.superJump.checkpointId);
  expect(result.landed.x).toBeCloseTo(raceHome.race!.superJump.landing.x);
  expect(result.landed.y).toBeCloseTo(raceHome.race!.superJump.landing.y);
  expect(result.landed.race!.scripted).toBe(false);
  expect(result.landed.race!.pizza.active).toBe(false);
  expect(result.landed.jimmy!.enabled).toBe(true);
  expect(animationWarnings).toEqual([]);
});

test('balloon crowns remain one-way while their envelopes and sides stay non-solid', async ({
  page,
}) => {
  await open(page);
  const crown = raceHome.platforms.find(
    (platform) => platform.style === 'balloon',
  )!;
  const result = await page.evaluate(
    ({ crown, checkpoint }) => {
      const a = window.__sophie!;
      a.checkpoint(checkpoint);
      const x = crown.x + crown.width / 2;
      a.place({ x, y: crown.y + 40 });
      const rising = a.advance(20, { aimY: -1, dashPressed: true });
      const landed = a.advance(90);
      a.checkpoint(checkpoint);
      a.place({ x: crown.x - 15, y: crown.y + 24 });
      const side = a.advance(24, { moveX: 1, dashPressed: true });
      return { rising, landed, side };
    },
    { crown, checkpoint: raceHome.race!.superJump.checkpointId },
  );
  expect(result.rising.y).toBeLessThan(crown.y);
  expect(result.landed).toMatchObject({ grounded: true, y: crown.y });
  expect(result.side.x).toBeGreaterThan(crown.x + 50);
  expect(result.side.y).toBeGreaterThan(crown.y);
  expect(result.side.grounded).toBe(false);
});

test('the moving balloon carries Sophie on its crown without requiring repeated jumps', async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(() => {
    const a = window.__sophie!;
    a.checkpoint('race-balloon-entry');
    const surface = a
      .snapshot()
      .machinery!.find((platform) => platform.id === 'race-moving-balloon')!;
    a.place({ x: surface.x + 100, y: surface.y });
    const boarded = a.advance(1);
    const ridden = a.advance(360);
    const moved = ridden.machinery!.find(
      (platform) => platform.id === 'race-moving-balloon',
    )!;
    return { surface, boarded, ridden, moved };
  });
  expect(result.boarded.grounded).toBe(true);
  expect(result.ridden.respawning).toBe(false);
  expect(result.ridden.grounded).toBe(true);
  expect(result.moved.y).toBeLessThan(result.surface.y - 40);
  expect(result.ridden.y).toBeCloseTo(result.moved.y);
  expect(result.ridden.x).toBeCloseTo(result.moved.x + 100);
});

test('the visible attic stays playable until both dogs enter, then hands off to the epilogue', async ({
  page,
}) => {
  await open(page);
  const destination = raceHome.race!.destination;
  const approach = await page.evaluate((destination) => {
    const a = window.__sophie!;
    a.place(destination.sophie);
    return a.advance(1);
  }, destination);
  expect(approach.race!.finalApproach).toBe(true);
  expect(approach.race!.scripted).toBe(false);
  expect(approach.race!.actors.sophie.visible).toBe(true);
  expect(approach.race!.actors.jimmy.visible).toBe(true);
  await expect
    .poll(async () => {
      const camera = (await state(page)).race!.camera;
      return (
        destination.attic.x > camera.x &&
        destination.attic.x < camera.x + camera.width
      );
    })
    .toBe(true);
  const ending = await page.evaluate((destination) => {
    const a = window.__sophie!;
    // Isolate actual attic entry after the safe-roof approach has been earned.
    a.place({ x: destination.attic.x - 24, y: destination.attic.y });
    let s = a.advance(15, { moveX: 1 });
    const entered = s;
    const phases: string[] = [];
    let bothInsideBeforeFade = false;
    const dialogue: string[] = [];
    for (let n = 0; n < 600 && s.race!.phase !== 'attic-complete'; n++) {
      const r = s.race!;
      if (phases.at(-1) !== r.phase) phases.push(r.phase);
      if (r.phase === 'attic-empty')
        bothInsideBeforeFade ||=
          !r.actors.sophie.visible && !r.actors.jimmy.visible;
      if (r.line) dialogue.push(r.line.text);
      s = a.advance(1, { moveX: -1, jumpPressed: true, dashPressed: true });
    }
    return { entered, phases, bothInsideBeforeFade, dialogue, end: s };
  }, destination);
  expect(ending.entered.race!.scripted).toBe(true);
  expect(ending.phases).toEqual(['attic-enter', 'attic-empty', 'attic-fade']);
  expect(ending.bothInsideBeforeFade).toBe(true);
  expect(ending.dialogue).toEqual([]);
  expect(ending.end.race!.actors.sophie.visible).toBe(false);
  expect(ending.end.race!.actors.jimmy.visible).toBe(false);
  expect(ending.end.race!.phase).toBe('attic-complete');
  await page.waitForFunction(
    () => window.__sophieStory?.snapshot().storyId === 'epilogue',
  );
  await expect(
    page.getByRole('heading', { name: 'TO BE CONTINUED' }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.__sophie)).toBeUndefined();
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  await expect(page.locator('audio')).toHaveCount(1);
  await expect(page.locator('audio')).toHaveJSProperty('loop', false);
});

test.describe('Race Home on mobile', () => {
  const phone = devices['iPhone 13 landscape']!;
  test.use({
    viewport: phone.viewport,
    userAgent: phone.userAgent,
    deviceScaleFactor: phone.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  });
  test('supports touch and keyboard, freezes the whole challenge in portrait/pause, and clears it on restart', async ({
    page,
  }) => {
    await open(page);
    await expect(page.locator('.pad-direction')).toHaveCount(4);
    await expect(page.locator('.touch-controls')).toBeVisible();
    const pad = (await page.locator('.touch-pad').boundingBox())!;
    const jump = (await page
      .getByRole('button', { name: 'Jump', exact: true })
      .boundingBox())!;
    const session = await page.context().newCDPSession(page);
    const beforeJump = await state(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { id: 1, x: pad.x + pad.width * 0.85, y: pad.y + pad.height / 2 },
        { id: 2, x: jump.x + jump.width / 2, y: jump.y + jump.height / 2 },
      ],
    });
    const touchJump = await page.evaluate(() =>
      window.__sophie!.advanceInput(20),
    );
    expect(touchJump.x).toBeGreaterThan(beforeJump.x);
    expect(touchJump.y).toBeLessThan(beforeJump.y - 10);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.evaluate(() => {
      const a = window.__sophie!;
      a.checkpoint('race-construction-span');
      a.place({ x: 3400, y: 1420 });
      a.advance(1);
    });
    await expect(page.locator('#pizza-rush')).toBeVisible();
    await expect
      .poll(async () => (await state(page)).race!.pizza.aura.visible)
      .toBe(true);
    const before = await state(page);
    expect(before.race!.pizza.active).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.rotate-overlay')).toBeVisible();
    await expect(page.locator('.touch-controls')).toBeHidden();
    const portrait = await page.evaluate(() =>
      window.__sophie!.advance(600, { moveX: 1, dashPressed: true }),
    );
    expect(portrait.x).toBe(before.x);
    expect(portrait.race!.pizza.remainingMs).toBe(
      before.race!.pizza.remainingMs,
    );
    expect(portrait.race!.birds).toEqual(before.race!.birds);
    expect(portrait.race!.rats).toEqual(before.race!.rats);
    expect(portrait.race!.steam).toEqual(before.race!.steam);
    expect(portrait.machinery).toEqual(before.machinery);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.touch-controls')).toBeVisible();
    await page.getByRole('button', { name: 'Pause game' }).click();
    const paused = await page.evaluate(() => window.__sophie!.advance(600));
    expect(paused.race!.pizza.remainingMs).toBe(before.race!.pizza.remainingMs);
    expect(paused.race!.birds).toEqual(before.race!.birds);
    expect(paused.race!.rats).toEqual(before.race!.rats);
    expect(paused.race!.steam).toEqual(before.race!.steam);
    expect(paused.machinery).toEqual(before.machinery);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.keyboard.down('Space');
    const keyboardJump = await page.evaluate(() =>
      window.__sophie!.advanceInput(20),
    );
    await page.keyboard.up('Space');
    expect(keyboardJump.y).toBeLessThan(before.y - 10);
    await expect(page.locator('.touch-controls')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    expect(await state(page)).toMatchObject({
      checkpoint: 'spawn',
      race: { phase: 'opening', pizza: { active: false } },
    });
    await expect(page.locator('#pizza-rush')).toBeHidden();
    await page
      .getByRole('combobox', { name: 'Debug level' })
      .selectOption('warehouse');
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    expect((await state(page)).race).toBeUndefined();
    await expect(page.locator('.touch-controls')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
  });
});
