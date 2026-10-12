import { test, expect, devices, type Page } from '@playwright/test';
import { pizzaFactory } from '../src/game/levels/pizzaFactory';

async function open(page: Page) {
  await page.goto('/?test&level=pizza-factory');
  await page.waitForFunction(() => Boolean(window.__sophie));
  await page.evaluate(() => {
    const a = window.__sophie!;
    a.manual(true);
    a.loadLevel('pizza-factory');
    a.advance(2000);
  });
}

async function approachRoll(page: Page, powered = true, distance = 190) {
  return page.evaluate(
    ({ powered, distance }) => {
      const a = window.__sophie!;
      a.place({ x: powered ? 2020 : 2210, y: 980 });
      const pickup = a.advance(1);
      if (powered) a.advance(55, { moveX: 1 });
      let s = a.snapshot();
      for (let n = 0; n < 600; n++) {
        if (
          s.respawning ||
          (s.factory!.roll.phase === 'roll' &&
            s.factory!.roll.x - s.x < distance)
        )
          break;
        s = a.advance(1);
      }
      return { pickup, ready: s };
    },
    { powered, distance },
  );
}

test('an upward diagonal pizza dash catches a grazing roll between physics samples', async ({
  page,
}) => {
  await open(page);
  const { ready } = await approachRoll(page, true, 82);
  expect(ready.respawning).toBe(false);
  const hit = await page.evaluate(() => {
    const a = window.__sophie!;
    let s = a.advance(1, { moveX: 1, aimY: -1, dashPressed: true });
    for (
      let n = 0;
      n < 12 && s.factory!.roll.phase !== 'deflected' && !s.respawning;
      n++
    )
      s = a.advance(1);
    return s;
  });
  expect(hit.respawning).toBe(false);
  expect(hit.y).toBeLessThan(ready.y);
  expect(hit.factory!.roll.phase).toBe('deflected');
  expect(hit.charges).toBe(0);
});

for (const mobile of [false, true])
  test.describe(
    mobile ? 'touch pizza counter' : 'keyboard pizza counter',
    () => {
      if (mobile)
        test.use({
          viewport: { width: 844, height: 390 },
          hasTouch: true,
          isMobile: true,
          userAgent: devices['iPhone 13'].userAgent,
        });

      test('the early conveyor teaches a paid pizza dash that bats the roll away and resets cleanly', async ({
        page,
      }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await open(page);
        const { pickup, ready } = await approachRoll(page);
        expect(pickup.factory!.pizza.active).toBe(true);
        expect(pickup.charges).toBe(1);
        expect(pickup.factory!.phase).toBe('chase');
        expect(ready.respawning).toBe(false);
        expect(ready.factory!.pizza.active).toBe(true);
        expect(ready.factory!.roll.phase).toBe('roll');
        await expect(page.locator('#pizza-rush')).toBeVisible();

        if (mobile) {
          const pad = (await page.locator('.touch-pad').boundingBox())!;
          const dash = (await page
            .getByRole('button', { name: 'Dash', exact: true })
            .boundingBox())!;
          const touch = await page.context().newCDPSession(page);
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [
              { id: 1, x: pad.x + pad.width * 0.8, y: pad.y + pad.height / 2 },
              {
                id: 2,
                x: dash.x + dash.width / 2,
                y: dash.y + dash.height / 2,
              },
            ],
          });
          await page.evaluate(() => window.__sophie!.advanceInput(1));
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [],
          });
          await touch.detach();
        } else {
          await page.keyboard.down('ArrowRight');
          await page.keyboard.press('KeyX');
          await page.evaluate(() => window.__sophie!.advanceInput(1));
          await page.keyboard.up('ArrowRight');
        }
        const hit = await page.evaluate(() => {
          const a = window.__sophie!;
          let s = a.snapshot();
          for (
            let n = 0;
            n < 40 && s.factory!.roll.phase !== 'deflected' && !s.respawning;
            n++
          )
            s = a.advanceInput(1);
          return s;
        });
        expect(hit.respawning).toBe(false);
        expect(hit.factory!.roll.phase).toBe('deflected');
        expect(hit.factory!.roll.direction).toBe(1);
        expect(hit.factory!.pizza.superDash).toBe(true);
        expect(hit.charges).toBe(0);
        expect(hit.factory!.midpointResolved).toBe(false);
        expect(hit.factory!.finalResolved).toBe(false);
        expect(hit.checkpoint).toBe('spawn');

        await page.getByRole('button', { name: 'Pause game' }).click();
        const frozen = await page.evaluate(() => window.__sophie!.advance(120));
        expect(frozen.factory!.roll).toEqual(hit.factory!.roll);
        await page
          .getByRole('button', { name: 'Continue', exact: true })
          .click();
        if (mobile) {
          await page.setViewportSize({ width: 390, height: 844 });
          await expect(
            page.getByText('Rotate your device to play', { exact: true }),
          ).toBeVisible();
          const portrait = await page.evaluate(() =>
            window.__sophie!.advance(120),
          );
          expect(portrait.factory!.roll).toEqual(hit.factory!.roll);
          await page.setViewportSize({ width: 844, height: 390 });
          await expect(page.locator('.touch-controls')).toBeVisible();
        }
        const nearlyReady = await page.evaluate(() => {
          const a = window.__sophie!;
          let s = a.snapshot();
          for (
            let n = 0;
            n < 30 && s.rechargeMs < 250 - 1000 / 120 - 0.001;
            n++
          )
            s = a.advance(1);
          return s;
        });
        expect(nearlyReady.grounded).toBe(true);
        expect(nearlyReady.factory!.pizza.active).toBe(true);
        expect(nearlyReady.charges).toBe(0);
        expect(nearlyReady.rechargeMs).toBeCloseTo(250 - 1000 / 120);
        await expect
          .poll(() =>
            page
              .locator('[data-bone="0"]')
              .evaluate((bone) =>
                parseFloat(
                  (bone as HTMLElement).style.getPropertyValue('--fill'),
                ),
              ),
          )
          .toBeGreaterThan(95);
        const refilled = await page.evaluate(() => window.__sophie!.advance(1));
        expect(refilled.rechargeMs).toBeCloseTo(250);
        expect(refilled.charges).toBe(1);
        await expect(page.locator('[data-bone="0"]')).toHaveClass(/available/);
        const flying = await page.evaluate(() => window.__sophie!.advance(15));
        expect(flying.factory!.roll.x).toBeGreaterThan(hit.factory!.roll.x);
        expect(flying.factory!.roll.y).toBeLessThan(hit.factory!.roll.y);
        expect(flying.respawning).toBe(false);
        const recovered = await page.evaluate(() =>
          window.__sophie!.advance(105),
        );
        expect(recovered.respawning).toBe(false);
        expect(recovered.grounded).toBe(true);
        expect(recovered.charges).toBe(1);
        expect(recovered.factory!.roll.phase).toBe('hidden');
        expect(recovered.factory!.roll.cooldown).toBeGreaterThan(0);
        await page.keyboard.press('KeyR');
        const reset = await page.evaluate(() => window.__sophie!.advance(40));
        expect(reset.factory!.pizza.active).toBe(false);
        expect(reset.factory!.roll.phase).toBe('hidden');
        expect(reset.factory!.roll.cooldown).toBeGreaterThan(0);
        expect(
          reset.factory!.pizza.pickups.find(
            (p) => p.id === 'conveyor-intro-pizza',
          )!.available,
        ).toBe(true);
        expect(errors).toEqual([]);
      });
    },
  );

test('powered running and an ordinary dash still require dodging the shell', async ({
  page,
}) => {
  for (const powered of [false, true]) {
    await open(page);
    const { ready } = await approachRoll(page, powered);
    expect(ready.factory!.pizza.active).toBe(powered);
    const hit = await page.evaluate((powered) => {
      const a = window.__sophie!;
      let s = a.advance(1, { moveX: 1, dashPressed: !powered });
      for (let n = 0; n < 120 && !s.respawning; n++)
        s = a.advance(1, { moveX: 1 });
      return s;
    }, powered);
    expect(hit.respawning).toBe(true);
    expect(hit.factory!.roll.phase).not.toBe('deflected');
  }
});

test('the late slice requires choosing a hop, and checkpoint retries restore it without reopening the guard', async ({
  page,
}) => {
  await open(page);
  const pizza = pizzaFactory.factory!.pizzas[1]!;
  const result = await page.evaluate((pizza) => {
    const a = window.__sophie!;
    a.checkpoint('factory-midpoint');
    a.place({ x: pizza.x, y: 775 });
    const below = a.advance(1);
    const hopped = a.advance(20, { jumpPressed: true, jumpHeld: true });
    a.checkpoint('factory-midpoint');
    return { below, hopped, reset: a.snapshot() };
  }, pizza);
  expect(result.below.factory!.pizza.active).toBe(false);
  expect(result.hopped.factory!.pizza.active).toBe(true);
  expect(result.hopped.charges).toBe(1);
  expect(result.reset.factory!.midpointResolved).toBe(true);
  expect(result.reset.factory!.pizza.active).toBe(false);
  const pickups = result.reset.factory!.pizza.pickups;
  expect(pickups.find((p) => p.id === pizza.id)!.available).toBe(true);
  expect(pickups.find((p) => p.id === 'midpoint-pizza')!.completed).toBe(true);
});

test('pizza dashing still burns on oven contact', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(() => {
    const a = window.__sophie!;
    a.place({ x: 2020, y: 980 });
    const powered = a.advance(1);
    let hit = a.advance(1, { moveX: -1, dashPressed: true });
    for (let n = 0; n < 60 && !hit.respawning; n++)
      hit = a.advance(1, { moveX: -1 });
    return { powered, hit };
  });
  expect(result.powered.factory!.pizza.active).toBe(true);
  expect(result.hit.factory!.pizza.superDash).toBe(true);
  expect(result.hit.respawning).toBe(true);
  const reset = await page.evaluate(() => window.__sophie!.advance(60));
  expect(reset.factory!.pizza.active).toBe(false);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__sophie!.snapshot().factory!.pizza.aura.visible,
      ),
    )
    .toBe(false);
});
