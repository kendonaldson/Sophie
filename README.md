# Sophie — Attic Escape

A playable browser platformer about a dachshund escaping an attic and crossing the rooftops to a quiet factory. The controls aim for the precision and forgiveness of Celeste, with a less demanding introductory route: run, jump, directional dash, high jump, dash-jump, then an airborne treat chain. No enemies, combat, wall jumps, lives, scoring, or Level 2.

## Run

Use Node 20.19+ (Node 22 should be 22.12+) or Node 24.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. The game begins immediately. Click Resume if switching windows paused it. Production: `npm run build`, then `npm run preview`. Serve `dist/` over HTTP rather than opening `index.html` as a local file. There are no runtime services or external art/font requests.

## Controls

| Input         | Action                                                |
| ------------- | ----------------------------------------------------- |
| ← / →         | Run and steer in the air                              |
| Z / Space     | Jump; release early for a shorter jump                |
| X             | Dash in the direction held on the arrow keys          |
| ↑ / ↓         | Aim dash vertically; combine with ← / → for diagonals |
| Esc / Pause   | Pause or resume                                       |
| R / Try again | Return to the current safe roof                       |

Without an arrow direction, dash follows the last horizontal facing direction. All eight directions have the same dash speed. For the long jump, dash horizontally on the ground, then press and hold jump within the 190 ms combo window for full distance. For the high jump, jump first, then dash up or diagonally up and steer onto the roof. There are no wall jumps or wall sliding. Desktop keeps keyboard controls only. Identified phones/tablets show an eight-direction touch pad and Z/X buttons in landscape; portrait pauses simulation behind a rotate-device overlay. Drag the pad to aim diagonally, and hold Z for a full jump while another finger presses X. A physical keyboard still works on mobile. Touchscreen laptops keep the desktop presentation. The small capability policy lives in `src/ui/mobile/capabilities.ts`; pointer input composes with keyboard input through `CombinedInput`. There is no user-facing touch toggle. Gamepad support is not included.

## Structure and tuning

- `src/game/config/physics.ts`: strongly typed run, air control, gravity, jump cut, coyote/buffer timers, dash duration, momentum, body insets, corner/edge correction, recharge, and transition settings. Speeds use world pixels/second; timers use milliseconds.
- `src/game/player/PlayerController.ts`: Phaser-independent movement rules and the small Grounded / Airborne / Dashing state model. Dash availability and timers remain separate in `DashController.ts`.
- `src/game/player/Player.ts`: thin Arcade Physics adapter, inset body, collision assistance, respawn reset, and animation selection. `CollisionAssist.ts` is independently testable.
- `src/game/input/Input.ts`: keyboard edges and held keys interpreted as player intent. Short button presses are queued until a simulation tick. Blur clears held inputs.
- `src/game/levels/atticEscape.ts`: all terrain, treats, safe anchors, tutorial sections, opening placement, and the exit for Level 1. `types.ts` validates the definition before loading.
- `src/game/levels/LevelLoader.ts` and `Checkpoints.ts`: generic loading and checkpoint progress. `DogTreat.ts` owns collectible presentation and contact tests.
- `src/game/audio/LevelMusic.ts`: streams the level's optional music asset, handles browser audio activation, and owns playback and cleanup.
- `src/game/scenes/GameScene.ts`: composition and the fixed 120 Hz simulation loop; it connects the independent rules to Arcade collision and the UI. Rendering can run at a different rate. Long browser stalls are capped and window blur pauses the game.
- `src/game/rendering/`: replaceable procedural environment art, trail/dust effects, viewport sizing, and a direction-aware follow camera. Camera movement never changes physics.
- `src/ui/Hud.ts` and `src/style.css`: native-resolution bones, recharge feedback, contextual hints, pause controls, and ending text.

Run acceleration reaches full speed in about 100 ms. Air control returns on the first simulation tick after a dash ends. Dash-jumps retain the full horizontal dash speed, with a gentle 30 px/s² overspeed drag for roughly 320 pixels of held-jump travel. Same-direction overspeed decays slowly enough to preserve the dash-jump impulse; reversing uses ordinary air acceleration immediately. The body is 30×25 pixels within each 64×64 frame, excluding most of the nose, tail, and ears. Ceiling correction is limited to five pixels; landing-edge correction to three.

## Dash resources and retries

Sophie starts with **one charge**, holds at most **two**, and spends one per dash. A treat always disappears and grants exactly one charge, capped at two. It works in the air, including during an active dash. The next dash may start as soon as the current dash ends.

Ground recovery takes **500 ms of continuous contact**. Leaving the ground resets it. Spending a dash starts a fresh recovery interval. Ground recovery ensures at least one charge; it never creates the second charge or removes an existing one. Airborne time never recharges. The DOM HUD has two bones, a collection pop, and progress on the first empty bone while grounded.

Invisible checkpoints advance only while grounded inside configured safe areas. They never use Sophie's arbitrary last position. A fall gives a brief 180 ms transition, moves Sophie to the current anchor, clears velocity and movement timers, and restores one charge. Treats ahead of that anchor return so a failed combo can always be retried. Earlier collected treats remain collected until a full replay.

## Level and traversal

The route runs left to right through progressively wider basic jumps, a dash crossing, a high roof, a long-jump gap, and the final warehouse crossing. Native-resolution tutorial cards at the high-jump and long-jump roofs explain the exact button order, holding jump for distance, and steering onto the landing. Their text lives in the level sections; they do not pause play and disappear after the challenge. The final hint teaches an upward-right dash to the suspended treat, a rightward second dash, then ordinary air steering. Press the second dash once the treat has been collected. Missing the treat leaves zero charges and ordinarily causes a fall. The factory access door disables movement, fades to black, and shows native-resolution **TO BE CONTINUED**. Play again resets the whole level.

To add a level, create another `LevelDefinition` in `src/game/levels/` and pass it to `new GameScene(hud, yourLevel)` in `src/main.ts`. Coordinates describe the physical world; platform `y` is the roof surface and spawn/checkpoint `y` is the paw/ground line. Keep anchors at least 32 pixels inside a stable roof and include their spawn in the trigger area. Order checkpoints and tutorial sections by progression; IDs must be unique across terrain, treats, and anchors. The attic opening is optional. A future Tiled adapter can produce this data without changing `PlayerController`.

## World resolution and UI

The world uses Phaser's Canvas renderer with explicit nearest-neighbor texture filtering, smoothing disabled after resizes, and rounded camera coordinates. A viewport near 640×360 expands to show additional world on suitable displays, capped at 960×540. Integer CSS scaling is used where it fits, with a uniform fractional fallback on small screens. Physics remains in world units at 120 Hz. The canvas is never stretched non-uniformly.

The HUD, controls, hints, pause panel, and ending are HTML/CSS siblings over or around the canvas. They remain at native browser resolution and do not scroll with the game camera. Small-screen layouts keep the bone HUD visible. Mobile landscape uses a compact presentation and touch controls; rotating never changes world geometry or physics.

## Sprite source and preparation

The supplied art is a **1536×1024 RGB presentation sheet**, not a uniform transparent 64×64 game atlas. It includes labels, a grid, subtly shaded opaque background, uneven cell widths, and row labels that do not consistently describe the right-hand poses.

The rename commit `175e4313cd2d66f844b44e4e5ae0bf1976ce8e31` replaced the image with a two-byte newline file. The intact PNG was recovered from the preceding upload commit `11ebb6003544eba3887ba16e913b177081d01587`, and matches the image supplied in chat. The broken file was removed from the repository root. Assets live in `public/assets/`:

- `sophie-source.png`: intact original sheet, retained for repeatable preparation.
- `sophie.png`: generated transparent 512×256 atlas, eight columns × four rows of 64×64 frames.

`scripts/prepare-sprites.mjs` contains all measured crop boundaries. It extracts the right-hand idle (source y 129–205), walk (477–550), run (559–631), and jump (729–816) rows, removes connected neutral background while preserving black outlines, and nearest-neighbor samples at a consistent scale with paws aligned to y=58. The eight source columns have pitches of roughly 87–93 pixels. The eight front-facing columns on the left and the sit, bark, and sleep rows are unused.

```sh
npm run assets
```

Idle, walk, and run use eight poses each. Jump uses selected airborne poses according to vertical velocity. **Dash is a trail/effect over Sophie's existing pose, not a separate drawn sprite.** The reference art has baked shading, variable pose proportions, and antialiased details, so this extraction is an approximation of an authored transparent atlas. For replacement artwork, update the central preparation metadata rather than scattering crop offsets through gameplay code.

## Verification

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:e2e
npm run build
# Or all of the above:
npm run check
```

The browser suite uses `/usr/bin/chromium` if present; otherwise install Playwright's browser with `npx playwright install chromium` (on Linux CI, `npx playwright install --with-deps chromium`).

Vitest covers charge bounds, every dash direction, treat refills, continuous-ground recharge, no airborne recovery, jump cut/buffering/coyote time, combo momentum and reach, post-dash air control, collision correction, safe anchors, invalid level data, and uniform viewport scaling.

Playwright checks real keyboard controls and pause, browser errors, a complete traversal from spawn to ending, failed combos and resource restoration, and matching physics at three viewport sizes. The complete traversal drives normal player intent through real Arcade Physics at fixed simulation steps; it does not teleport to challenges. The development-only `?test` hook exposes read-only snapshots and deterministic stepping, and is not installed in production. Tests assert gameplay state rather than brittle exact rendered coordinates.

All art beyond Sophie is simple procedural pixel art, intentionally easy to replace. This slice has no persistence or gamepad implementation.

## Music

Attic Escape loops the supplied **Rooftop Dash** track from `public/assets/audio/rooftop-dash.mp3`. Music starts on the first key press or completed tap/click, as required by browser autoplay policies. It streams through a single HTML audio element at 50% volume, so downloading/decoding the full track never blocks the level. Mobile devices may use their system media volume.

Pausing, switching away, or rotating a phone/tablet to portrait pauses the music. Resuming continues from the same position. Falls and checkpoint retries keep the track running; reaching the factory ending pauses it, and Play again starts it from the beginning. Scene shutdown or destruction releases playback and listeners. Audio load/playback failures leave the game playable. Set a level's optional `music` field to its path relative to `public/`; the URL respects the configured GitHub Pages base path. The uploaded MP3 is preserved as supplied, including any silence at its loop boundary.

## Deployment — GitHub Pages

Local development: `npm ci`, then `npm run dev`. Install a browser once with `npx playwright install chromium` (Linux CI uses `--with-deps`). `npm run check` runs type checking, ESLint, formatting, Vitest, gameplay browser tests, the production build, and production browser smoke tests. Individual browser commands are `npm run test:e2e` (development server) and `npm run test:production` (existing `dist/` served with Vite preview); Playwright starts/stops their servers automatically. `npm run build` alone creates the static `dist/` site. No production Node server, backend, or functions are required.

`.github/workflows/pages.yml` handles both pull requests to `main` and pushes to `main`:

1. **Validate and build:** check out, set up Node 24, `npm ci`, `npx playwright install --with-deps chromium`, then `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run test:e2e`, `npm run build`, and `npm run test:production`.
2. On a successful **push to main**, upload that exact `dist/` with the official Pages artifact action.
3. **Deploy GitHub Pages** explicitly depends on validation/build success. It configures Pages and deploys the uploaded artifact, without rebuilding. Only this job receives `pages: write` and `id-token: write`; the workflow otherwise has read-only repository access.

Pull requests run the same checks and build but never upload or deploy a Pages site. A failure blocks deployment. Concurrency cancels an older run on the same ref when a newer commit arrives; independent PRs do not cancel one another. Browser failure traces/screenshots are retained as a diagnostic artifact. `dist/` stays ignored; no deployment branch is used.

**One-time repository setup:** open **Settings → Pages → Build and deployment**, and choose **GitHub Actions** as the source. Actions must be enabled under **Settings → Actions → General** (normally the default). No personal access token or custom secret is needed. If the `github-pages` environment has required reviewers, GitHub will wait for that approval. Pages settings are managed by the repository owner; enable the Actions source before the first deployment.

After the changes reach `main`, watch **Actions → Validate and deploy Pages**. The deployment job, repository **Environments → github-pages**, and **Settings → Pages** show the final URL. The expected project-site pattern is `https://<owner>.github.io/<repository>/`, which is `https://kendonaldson.github.io/Sophie/` for this repository. A live URL is only established after a successful deployment.

The workflow sets `SITE_BASE_PATH` from the repository name (`/Sophie/` here), or from the optional repository **Actions variable** `PAGES_BASE_PATH`. `vite.config.ts` normalizes that single build-time setting; local builds default to `/`. Bundled JavaScript/CSS, the favicon, and Phaser asset URLs use Vite's base automatically. Generated graphics have no external URLs. The original source and prepared atlas live under `assets/` in the deployed site, rather than the root.

To reproduce the project-path deployment locally:

```sh
SITE_BASE_PATH=/Sophie/ npm run check
```

Production smoke tests inspect built HTML URLs, load original/generated PNGs under that path, exercise rendered keyboard input and the HUD, check browser errors, and verify sharp rendering after resize. Gameplay tests keep their managed development server at `/`; production tests run the real `dist/` build on a separate port and use no development debug API.

For a root-hosted custom domain later, set the repository Actions variable `PAGES_BASE_PATH` to `/`, configure the custom domain and DNS in GitHub Pages, and rebuild/deploy. The same `/` override also supports a `<owner>.github.io` user-site repository. No game code changes are necessary. The built artifact itself is always the deployment unit.
