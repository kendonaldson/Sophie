import { expect, test, type Page } from '@playwright/test';
import { maintenance } from '../src/game/levels/maintenance';
async function open(page: Page) {
  await page.goto('/?test&level=maintenance-tunnels');
  await page.waitForFunction(
    () => window.__sophie?.snapshot().levelId === 'maintenance-tunnels',
  );
  await page.evaluate(() => window.__sophie!.manual(true));
}

test('safe checkpoints lead immediately into readable pipe and separate rat patrol phrases', async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate(() => {
    const a = window.__sophie!,
      results = [];
    for (const route of [
      { cp: 'tunnel-entry', target: 1120, pipes: [650, 860] },
      { cp: 'rat-introduction', target: 1890, pipes: [1380] },
      { cp: 'pipe-rat-combination', target: 3670, pipes: [2670, 3170] },
      { cp: 'fast-rats', target: 5610, pipes: [4550, 5070, 5500] },
      { cp: 'maintenance-run', target: 7720, pipes: [6930, 7470] },
    ])
      for (const distance of [48, 54, 60]) {
        a.loadLevel('maintenance-tunnels');
        a.checkpoint(route.cp);
        let s = a.snapshot();
        let jumps = 0;
        // Keep running, using only visible pipe/rat positions to choose normal hops.
        for (let i = 0; i < 1500 && s.x < route.target; i++) {
          const pipe = route.pipes.some(
            (x) => x - s.x < distance && x - s.x > 0,
          );
          const rat = s.maintenance!.rats.some(
            (r) => r.x - s.x > 0 && r.x - s.x < (r.direction === -1 ? 80 : 42),
          );
          const jump = s.grounded && (pipe || rat);
          if (jump) jumps++;
          s = a.advance(1, { moveX: 1, jumpHeld: true, jumpPressed: jump });
          if (s.respawning) break;
        }
        results.push({
          cp: route.cp,
          distance,
          passed: s.x >= route.target && !s.respawning,
          jumps,
          pipes: route.pipes.length,
          treats: s.treats,
        });
      }
    return results;
  });
  for (const r of results) {
    expect(r.passed, JSON.stringify(r)).toBe(true);
    expect(r.jumps).toBeGreaterThanOrEqual(r.pipes);
    expect(r.treats).toEqual([]);
  }
});

test('all ordinary furnace gaps allow immediate jump-dash retries across keyboard and touch timing windows', async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate(() => {
    const a = window.__sophie!,
      results = [];
    for (const r of [
      { cp: 'first-furnace', edge: 2075, target: 2300 },
      { cp: 'short-furnace', edge: 7925, target: 8120 },
      { cp: 'last-furnace', edge: 8545, target: 8770 },
    ])
      for (const dashSource of [undefined, 'touch'] as const)
        for (const wait of [24, 30, 36]) {
          a.loadLevel('maintenance-tunnels');
          a.checkpoint(r.cp);
          let s = a.snapshot();
          for (let i = 0; i < 200 && s.x < r.edge; i++)
            s = a.advance(1, { moveX: 1 });
          a.advance(wait, { moveX: 1, jumpPressed: true, jumpHeld: true });
          a.advance(24, {
            moveX: 1,
            aimY: -1,
            dashPressed: true,
            jumpHeld: true,
            dashSource,
          });
          for (let i = 0; i < 160; i++) {
            s = a.advance(1, { moveX: 1, jumpHeld: true });
            if (s.respawning || (s.grounded && s.x > r.target - 11)) break;
          }
          results.push({
            cp: r.cp,
            dashSource,
            wait,
            passed: !s.respawning && s.grounded && s.x > r.target - 11,
            charges: s.charges,
          });
        }
    return results;
  });
  for (const r of results) {
    expect(r.passed, JSON.stringify(r)).toBe(true);
    expect(r.charges).toBe(0);
  }
});

test('the wider furnace needs long-jump momentum and has no treat dependency or retry wait', async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate(() => {
    const a = window.__sophie!,
      results = [];
    for (const dashSource of [undefined, 'touch'] as const)
      for (const edge of [3830, 3850, 3870])
        for (const wait of [3, 6, 9, 12]) {
          a.loadLevel('maintenance-tunnels');
          a.checkpoint('long-furnace');
          let s = a.snapshot();
          for (let i = 0; i < 200 && s.x < edge; i++)
            s = a.advance(1, { moveX: 1 });
          a.advance(wait, { moveX: 1, dashPressed: true, dashSource });
          a.advance(1, { moveX: 1, jumpPressed: true, jumpHeld: true });
          for (let i = 0; i < 160; i++) {
            s = a.advance(1, { moveX: 1, jumpHeld: true });
            if (s.respawning || (s.grounded && s.x > 4174)) break;
          }
          results.push({
            edge,
            wait,
            dashSource,
            passed: !s.respawning && s.grounded && s.x > 4174,
            treats: s.treats,
          });
        }
    a.loadLevel('maintenance-tunnels');
    a.checkpoint('long-furnace');
    let s = a.snapshot();
    for (let i = 0; i < 200 && s.x < 3885; i++) s = a.advance(1, { moveX: 1 });
    a.advance(1, { moveX: 1, jumpPressed: true, jumpHeld: true });
    for (let i = 0; i < 180 && !s.respawning; i++)
      s = a.advance(1, { moveX: 1, jumpHeld: true });
    return { results, normalJumpFails: s.respawning };
  });
  expect(results.normalJumpFails).toBe(true);
  for (const r of results.results) {
    expect(r.passed, JSON.stringify(r)).toBe(true);
    expect(r.treats).toEqual([]);
  }
});

test('the major gap supports two treats and three dashes across varied takeoffs without waiting', async ({
  page,
}) => {
  await open(page);
  const results = await page.evaluate(() => {
    const a = window.__sophie!,
      results = [];
    for (const dashSource of [undefined, 'touch'] as const)
      for (const edge of [5820, 5830, 5840])
        for (const wait of [26, 30, 34])
          for (const gap of [26, 30, 34]) {
            a.loadLevel('maintenance-tunnels');
            a.checkpoint('major-furnace');
            let s = a.snapshot();
            for (let i = 0; i < 200 && s.x < edge; i++)
              s = a.advance(1, { moveX: 1 });
            a.advance(wait, { moveX: 1, jumpPressed: true, jumpHeld: true });
            for (let i = 0; i < 3; i++)
              a.advance(gap, {
                moveX: 1,
                aimY: i === 0 ? -1 : 0,
                dashPressed: true,
                jumpHeld: true,
                dashSource,
              });
            for (let i = 0; i < 160; i++) {
              s = a.advance(1, { moveX: 1, jumpHeld: true });
              if (s.respawning || (s.grounded && s.x > 6209)) break;
            }
            results.push({
              edge,
              wait,
              gap,
              dashSource,
              passed: !s.respawning && s.grounded && s.x > 6209,
              bones: s.treats,
              charges: s.charges,
            });
          }
    return results;
  });
  for (const r of results) {
    expect(r.passed, JSON.stringify(r)).toBe(true);
    expect(r.bones).toEqual(maintenance.treats.map((t) => t.id));
    expect(r.charges).toBe(0);
  }
});

test('the major camera previews the landing rat and air steering chooses safe landing space', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => window.__sophie!.checkpoint('major-furnace'));
  const view = await page.evaluate(
    () => window.__sophie!.snapshot().maintenance!.camera,
  );
  const rat = maintenance.maintenance!.rats.find(
    (r) => r.id === 'landing-rat',
  )!;
  for (const item of maintenance.treats) {
    expect(item.x).toBeGreaterThan(view.x);
    expect(item.x).toBeLessThan(view.x + view.width);
    expect(item.y).toBeGreaterThan(view.y);
  }
  expect(rat.left).toBeGreaterThan(view.x);
  expect(rat.right).toBeLessThan(view.x + view.width);
  const results = await page.evaluate(() => {
    const a = window.__sophie!,
      results = [];
    for (const mode of ['short-chain', 'coast', 'brake'] as const) {
      a.loadLevel('maintenance-tunnels');
      a.checkpoint('major-furnace');
      let s = a.snapshot();
      for (let i = 0; i < 200 && s.x < 5840; i++)
        s = a.advance(1, { moveX: 1 });
      a.advance(34, { moveX: 1, jumpPressed: true, jumpHeld: true });
      for (let i = 0; i < (mode === 'short-chain' ? 2 : 3); i++)
        a.advance(34, {
          moveX: 1,
          aimY: i === 0 ? -1 : 0,
          dashPressed: true,
          jumpHeld: true,
        });
      for (let i = 0; i < 180; i++) {
        s = a.advance(1, {
          moveX: mode === 'brake' && s.x > 6210 ? -1 : 1,
          jumpHeld: true,
        });
        if (s.respawning || (s.grounded && s.x > 6209)) break;
      }
      results.push({
        mode,
        x: s.x,
        failed: s.respawning,
        grounded: s.grounded,
        ratX: s.maintenance!.rats.find((r) => r.id === 'landing-rat')!.x,
      });
    }
    return results;
  });
  expect(results[0]!.failed).toBe(true);
  for (const r of results.slice(1)) {
    expect(r.failed, JSON.stringify(r)).toBe(false);
    expect(r.grounded).toBe(true);
    expect(Math.abs(r.ratX - r.x)).toBeGreaterThan(27);
  }
  expect(results[1]!.x - results[2]!.x).toBeGreaterThan(20);
});
