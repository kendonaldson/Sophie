# Sophie — Rooftops to the Skyscraper

A four-chapter browser platformer about Sophie and Jimmy’s increasingly chaotic adventure. Rooftops teach precision jumping and dashing; the warehouse combines machinery with companion traversal; Interlude 1 leads directly into a forced-scroll escape through a neighborhood and construction site. The Skyscraper continues the escape upward through scaffolds, lifts, and predictable birds. No combat, wall jumps, lives, or scoring.

## Run

Use Node 20.19+ (Node 22 should be 22.12+) or Node 24.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. The game begins immediately. Choose Continue if switching windows paused it. Production: `npm run build`, then `npm run preview`. Serve `dist/` over HTTP rather than opening `index.html` as a local file. There are no runtime services or external art/font requests.

## Controls

| Input       | Action                                                |
| ----------- | ----------------------------------------------------- |
| ← / →       | Run and steer in the air                              |
| Z / Space   | Jump; release early for a shorter jump                |
| X           | Dash in the direction held on the arrow keys          |
| ↑ / ↓       | Aim dash vertically; combine with ← / → for diagonals |
| Esc / Pause | Pause or resume                                       |
| R           | Return to the current safe checkpoint                 |

Without an arrow direction, dash follows the last horizontal facing direction. All eight directions have the same dash speed. For the long jump, dash horizontally on the ground, then press and hold jump within the 190 ms keyboard combo window (250 ms for a touch dash) for full distance. For the high jump, jump first, then dash up or diagonally up and steer onto the roof. There are no wall jumps or wall sliding. Desktop keeps keyboard controls only. Identified phones/tablets show a four-arrow touch pad and Z/X buttons in landscape; portrait pauses simulation behind a rotate-device overlay. The entire pad accepts all eight directions, including its unmarked diagonal areas. The four cardinal arrows highlight independently, so a diagonal lights both corresponding arrows. Drag the pad to aim diagonally, and hold Z for a full jump while another finger presses X. You can also slide a thumb between X and Z without lifting it; passing through the gap keeps the current action held. Touch jumps buffer for 180 ms before landing (keyboard: 120 ms), and an early touch dash waits up to 120 ms for the current dash to finish or a charge to become available, retaining the direction at the tap. Buffered actions expire, fire once, and clear on pause, rotation, or retry. Speeds, gravity, dash duration, and charge limits remain shared. A physical keyboard still works on mobile with its original timing. Touchscreen laptops keep the desktop presentation. The small capability policy lives in `src/ui/mobile/capabilities.ts`; pointer input composes with keyboard input through `CombinedInput`. There is no user-facing touch toggle. Gamepad support is not included.

The pause menu offers **Restart**, **Full Screen**, and **Continue**. Restart begins the current chapter again (or restarts Interlude 1); **R** remains the checkpoint retry shortcut. Full Screen requests browser fullscreen for the whole app, including the native HUD and mobile controls, and becomes **Exit Full Screen** while active. A compact header and hint strip give the game more room. Fullscreen changes leave the game paused until Continue is chosen. Unsupported browsers disable the option with an explanation; a rejected request leaves the menu usable. The fullscreen state follows browser events, including exits outside the menu. Normal page layout returns on exit. The old lower-right Try again button is removed.

## Debug level selector

Append `#debug` to the game URL, including the deployed site: [Open debug selector](https://kendonaldson.github.io/Sophie/#debug). Choose **Attic Escape**, **The Warehouse**, **Interlude 1**, **The Chase**, or **The Skyscraper** in the header and press **Load**. Loading starts that chapter fresh with its initial checkpoints, collectibles, actors, machinery, and camera, and selects its looping background music. Load the same selection again to restart that chapter. Normal chapter transitions update the selection too.

The **Infinite dash** checkbox beside the picker lets Sophie dash repeatedly in the air without spending stored charges. Each dash keeps its normal speed, duration, direction controls, and sound. The bone HUD shows both charges available while enabled. The setting persists through retries, level loads, and scene transitions for this session; unchecking it restores ordinary dash limits using the stored charges. Removing `#debug` also switches it off, and adding the fragment again starts unchecked.

Adding or removing `#debug` while playing shows or removes the selector without restarting the game. It works with touch or keyboard and only appears for that exact URL fragment. It does not enable the development-only `window.__sophie` or `window.__sophieStory` test APIs.

## Structure and tuning

- `src/game/config/physics.ts`: strongly typed run, air control, gravity, jump cut, coyote/buffer timers, dash duration, momentum, body insets, corner/edge correction, recharge, and transition settings. Speeds use world pixels/second; timers use milliseconds.
- `src/game/player/PlayerController.ts`: Phaser-independent movement rules and the small Grounded / Airborne / Dashing state model. Dash availability and timers remain separate in `DashController.ts`.
- `src/game/player/Player.ts`: thin Arcade Physics adapter, inset body, collision assistance, respawn reset, and animation selection. `CollisionAssist.ts` is independently testable.
- `src/game/config/touch.ts`: central touch action timing windows; action origin flows through combined input and Jimmy’s delayed history.
- `src/game/input/Input.ts`: keyboard edges and held keys interpreted as player intent. Short button presses are queued until a simulation tick. Blur clears held inputs.
- `src/game/levels/atticEscape.ts`: all terrain, treats, safe anchors, tutorial sections, opening placement, and the exit for Level 1. `types.ts` validates the definition before loading.
- `src/game/levels/warehouse.ts`: warehouse terrain, moving pallets, conveyors, shutter, elevator, safe anchors, treats, and finale geometry.
- `src/game/companion/`: Jimmy’s own body/controller, deterministic delayed input history, independent dash support, and recovery policy.
- `src/game/machinery/`: reusable time-based platform motion, surface carry, jump velocity transfer, belts, shutters, and the freight elevator.
- `src/game/events/FinalSling.ts`: isolated final-area trigger and short guaranteed cooperative landing.
- `src/game/levels/LevelLoader.ts` and `Checkpoints.ts`: generic loading and checkpoint progress. `DogTreat.ts` owns collectible presentation and contact tests.
- `src/game/audio/LevelMusic.ts`: streams the level's optional music asset, handles browser audio activation, and owns playback and cleanup.
- `src/game/audio/Sfx.ts` and `config.ts`: app-owned procedural Web Audio effects and centralized sound/voice tuning. `src/ui/DialogueReveal.ts` shares the lightweight text reveal between dialogue overlays.
- `src/game/scenes/GameScene.ts`: composition and the fixed 120 Hz simulation loop; it connects the independent rules to Arcade collision and the UI. Rendering can run at a different rate. Long browser stalls are capped and window blur pauses the game.
- `src/game/rendering/`: replaceable procedural environment art, trail/dust effects, viewport sizing, and a direction-aware follow camera. Camera movement never changes physics.
- `src/ui/Hud.ts` and `src/style.css`: native-resolution bones, recharge feedback, contextual hints, pause controls, and ending text.

Run acceleration reaches full speed in about 100 ms. Air control returns on the first simulation tick after a dash ends. Dash-jumps retain the full horizontal dash speed, with a gentle 30 px/s² overspeed drag for roughly 320 pixels of held-jump travel. Same-direction overspeed decays slowly enough to preserve the dash-jump impulse; reversing uses ordinary air acceleration immediately. The body is 30×25 pixels within each 64×64 frame, excluding most of the nose, tail, and ears. Ceiling correction is limited to five pixels; landing-edge correction to three.

## Dash resources and retries

Sophie starts with **one charge**, holds at most **two**, and spends one per dash. A treat always disappears and grants exactly one charge, capped at two. It works in the air, including during an active dash. The next dash may start as soon as the current dash ends.

Ground recovery takes **500 ms of continuous contact**. Leaving the ground resets it. Spending a dash starts a fresh recovery interval. Ground recovery ensures at least one charge; it never creates the second charge or removes an existing one. Airborne time never recharges. The DOM HUD has two bones, a collection pop, and progress on the first empty bone while grounded.

Invisible checkpoints advance only while grounded inside configured safe areas. They never use Sophie's arbitrary last position. A fall gives a brief 180 ms transition, moves Sophie to the current anchor, clears velocity and movement timers, and restores one charge. Treats ahead of that anchor return so a failed combo can always be retried. Every collected bone also reappears in its original position after **3 seconds of active game time** in every level. Its timer pauses with the game and in mobile portrait; no death or retry is required. Returning bones grant no charge until Sophie touches them again, and Jimmy cannot collect them. The shared delay is `treatConfig.respawnMs` in `src/game/config/collectibles.ts`. Checkpoint restoration remains immediate and clears the old pickup timer.

## Levels and traversal

### Chapter 1: Attic Escape

The route runs left to right through progressively wider basic jumps, a dash crossing, a high roof, a long-jump gap, and the final crossing to the factory. Native-resolution tutorial cards at the high-jump, long-jump, and final roofs explain the exact button order, holding jump for distance, and steering onto the landing. Their text lives in the level sections; they do not pause play and disappear after the challenge.

The final rooftop gap is **353 pixels** wide, one third shorter than its previous 530 pixels, with the factory landing still 62 pixels below takeoff. Long-jump (→ + X, then hold Z / Space) and keep right and jump held to land directly. The bone now sits along the jump arc and provides an optional upward-right dash for earlier takeoffs; a precisely timed second dash is no longer required. The factory, its checkpoint, and its exit move together; the earlier challenges and global physics stay the same. The factory access door fades out Level 1 and fades into the warehouse. It no longer shows an ending. Level 2 leads into Interlude 1. The only **TO BE CONTINUED** appears after Level 3’s skyscraper finale; Play again returns to the rooftops.

### Chapter 2: The Warehouse

A safe loading room introduces Jimmy: “Things get a lot harder from here.” / “Want me to come with you?” A low crate leads into suspended pallets, forward/reverse belts, a rising cargo hoist and high jump, a timed loading shutter, combined horizontal/vertical freight, and an airborne bone refill onto a hanging pallet. A 6.5-second freight elevator ride provides a pause before the upper warehouse combines those mechanics again. Fourteen invisible checkpoints cover the meaningful sequences; retries remain quick.

Jimmy consumes a **300 ms** delayed stream of held movement and one-shot jump/dash actions. `companion/config.ts` controls that delay and his modest coyote/buffer/collision forgiveness. He uses his own `Player`, transform, animations, velocity, and physics body. Neither dog collides with the other. Jimmy grants himself a charge for a mirrored dash, never reads or changes Sophie's dash state, and never participates in collectible collision tests. The delay itself creates the trailing distance; a small 15-pixel reset offset avoids moving every takeoff too far behind its ledge.

Falls, excessive separation on safe ground, or prolonged obstruction recover Jimmy to a known static safe point behind Sophie with a brief fade. A closed shutter makes him wait and walk through the next opening. Sophie's retry reconciles both dogs immediately and clears pending history. This is forgiving following, not an escort failure condition. During elevator boarding he walks into the open entrance; a stranded follower is reconciled behind the cage when the ride starts. The doors close, both dogs ride upward, the music lowers to 20%, and a native “DING / Upper floor” cue accompanies arrival. Sophie can move inside the cage.

Moving surfaces use absolute simulation time and configurable endpoints, speed, pauses, and phase. Before each fixed physics step, the machinery system carries standing actors by the surface displacement and transfers surface velocity on takeoff. Conveyor displacement is applied only while supported. Shutter sensors prevent a door closing through either dog. The small weight dip when both dogs stand on a pallet changes art only. Their geometry, cycles, belts, elevator, and safe anchors all live in level data.

The final gap is **880 world pixels** wide. A unit test bounds travel conservatively using two dash charges, a full-speed dash-jump with the longer touch combo window, coyote time, a late below-edge recovery, body width, and collision forgiveness. There are no refills or moving surfaces in that gap. A short, uniform camera pullback in this room shows the actual exit across both shores, then smoothly returns to ordinary tracking; it never changes physics or the native-resolution HUD. The rest of the camera follows horizontally and vertically as before.

An ordinary failed final attempt triggers the isolated `FinalSling` event only while airborne beyond the runway and descending near its height. The sequence freezes for 400 ms, gives Jimmy 550 ms to catch Sophie, compresses for 150 ms, and launches both along 1.1-second arcs to validated safe landings. Input returns immediately. No sling ability is added to `PlayerController`. A safe final walk takes both dogs through the door, which closes before the fade into Interlude 1.

To add a level, create another `LevelDefinition` in `src/game/levels/` and pass it to `new GameScene(hud, sfx, debugSettings, yourLevel)` in `src/main.ts`. Coordinates describe the physical world; platform `y` is the roof surface and spawn/checkpoint `y` is the paw/ground line. Keep anchors at least 32 pixels inside a stable roof and include their spawn in the trigger area. Order checkpoints and tutorial sections by progression; IDs must be unique across terrain, treats, and anchors. The attic opening is optional. A future Tiled adapter can produce this data without changing `PlayerController`.

## Interlude 1 — A little fresh air

Progression is **Attic Escape → The Warehouse → Interlude 1 → TO BE CONTINUED**. There is no Level 3 or placeholder for it. `InterludeScene` is a separate Phaser scene; `GameScene` only hands off after the warehouse exit fade. It does not run player physics, consume dash charges, or reuse the warehouse follow camera.

- `src/game/story/interlude1.ts` holds the supplied dialogue and named staging/timing values. X or the native **Continue · X** button advances one line per press, with brief protected pauses. Movement and jump keys cannot move either dog.
- `InterludeDirector.ts` owns elapsed-time choreography independently of Phaser: Jimmy sits facing idle Sophie; she turns toward town, then back; the unseen voice brings Jimmy to standing and a small alert accent above Sophie; both walk cautiously, then run with rapid acceleration after the final line. If a reader lingers, the dogs stop safely inside the frame rather than walking off early.
- `InterludeArt.ts` draws a compact nighttime warehouse exterior, warm lamps, trees, and road. `framing.ts` uniformly fits a fixed 640×360 composition on resize. Both dogs use their actual sprites, at 1.5× scene scale; the existing dash ghosts inherit the sprite scale and origin.
- `src/ui/StoryDialogue.ts` renders native-resolution speech bubbles anchored above the current dog. The off-screen voice instead has a dark bubble at the left edge, a dashed border, an outward tail, and the label **A VOICE FROM OFF-SCREEN**. No human, silhouette, vehicle, flashing lights, or camera reveal is drawn.
- The final line automatically changes the pace after a 450 ms reaction beat. Both dogs accelerate together, clear the frame, leave 180 ms of empty road, then fade to black over 750 ms. The fade now hands straight into Level 3 with both dogs already running. It never shows an ending or another introduction pause.

Dialogue, pauses, exit speed/acceleration, character scale/positions, and fades are centralized in `interlude1.ts`. The short reading guard is 220 ms; longer thinking/interruption pauses live on their dialogue entries. Blur, pause, and mobile portrait freeze the scene. Scene shutdown removes dialogue, input, HUD bindings, debug UI, and effects; replay or debug selection restores ordinary keyboard/touch gameplay. `#debug` includes the interlude for quick testing. In development with `?test`, `window.__sophieStory` provides snapshots and deterministic stepping; production exposes neither test API.

Vitest covers poses/facing, dialogue waits, interruption and exit ordering, time partition independence, and uniform framing. Playwright covers the actual Level 2 handoff, all dialogue, distinct unseen voice, sit/idle/walk/run changes, ignored gameplay input, held-X behavior, mobile continuation/orientation, frame clearance before black, the direct chase transition, scene cleanup, and a complete production conversation at the Pages base path.

### Chapter 3: The Chase

**Level 1 → Level 2 → Interlude 1 → The Chase → The Skyscraper → TO BE CONTINUED.** Both dogs enter running; “Run, Jimmy, or we'll be caught!” appears while gameplay continues. The opening 450 ms carries rightward momentum while jump/dash input is already available. Ordinary keyboard and mobile movement remain unchanged.

`src/game/levels/chase.ts` defines a roughly 35–40 second continuous run:

1. Residential street: hydrant, mailbox, pothole, bushes, and a larger street break.
2. Roadworks: orange edge markers/signs, barricades, a temporary plate, and dash-assisted gaps.
3. Construction yard: ascending crates, a wide recovery pallet, and an upward dash to a construction deck.
4. Bulldozer: a tall solid cab, engine, treads and blade. Jump, dash up-right, collect a bone, dash again, collect the second bone, and dash a third time onto the cab. The two refills provide the additional dashes; Jimmy mirrors the chain with his own resource state. No special player boost is applied. The standard jump and a single dash cannot reach the roof.
5. Final sprint: closely spaced crates, potholes, a barrier, high freight, scaffold gaps, and an unfinished skyscraper wall.

`ForcedScroll.ts` maintains elapsed-time camera state independently of Phaser, Sophie, and display resolution. It starts at **134 world px/s**, ramps by **12 px/s²** toward **146**, **156**, then **172 px/s** at section thresholds. Running/dashing ahead can advance the camera to preserve **290 px** of space behind Sophie; it never scrolls backward. A thin amber edge marks the left side. Failure occurs at a **10 px boundary inset**. A fixed **640×360 world view**, uniformly fitted to each screen, keeps the available reaction distance consistent across devices. Camera configuration lives in the level’s `chase.scroll` and `chase.view` fields.

Landing on the safe runway before the bulldozer earns the **before-bulldozer** checkpoint. Falling, pressing **R**, or getting overtaken then returns Sophie to **(4200, 420)** in the existing **180 ms** retry interval, with room to run up to the bone/dash chain again. Both dogs resume running, Sophie starts with one dash, both bones return immediately, and companion input/recovery history clears. The camera resets **290 px** behind Sophie at the local **156 px/s** chase speed; earlier off-screen calls and the opening line do not replay. The checkpoint persists for the rest of the chapter. Failures before earning it still retry the opening. Pause-menu **Restart** and debug level loading start the chapter fresh and clear the checkpoint. Jimmy still follows delayed input. `ChaseRecovery.ts` stores a recent **300 ms** traversal trail only for repairs: a stranded follower fades to that recent trajectory, or alongside Sophie if the trail has already scrolled away. It preserves velocity and never touches her collectibles or dash state. An overtaken pair resets; Jimmy’s missed jump or collision cannot independently spoil a viable player run.

`ChaseRun.ts` composes camera state, sparse calls from behind, recovery, and the ending, leaving `PlayerController` and normal camera behavior unchanged. `SpeechBubble.ts` shares the interlude’s `DialogueReveal` text animation and procedural speaker boops alongside its native-resolution presentation, including the dark dashed off-screen bubble and outward tail. No pursuer, silhouette, human, vehicle, or police lighting exists. `ChaseArt.ts` draws replaceable procedural neighborhood/construction art with bright playable edges and quieter backgrounds.

Only grounding at the dead-end trigger starts `ChaseFinale.ts`. Scrolling and the failure boundary stop, music fades completely to silence over **650 ms**, both dogs settle, then the unseen voice says “Gotcha.” and “Okay, let's get you two home.” Jimmy turns toward Sophie, compresses beneath her, and launches both upward using the warehouse jump frames and dash ghosts. After both fully leave the top, an empty **650 ms** beat precedes “WHAT IN THE WORLD?!” for **2200 ms**, then a **750 ms** fade directly into Level 4. The dogs enter that chapter from below; the temporary Level 3 ending is gone. `chase/config.ts` centralizes dialogue, recovery, anticipation, launch and final-beat timings; finale coordinates live in level data. This never becomes a normal movement ability.

Tests cover camera independence/ramping/boundaries, deterministic finale timing, recovery choices, early-run resets and repeatable bulldozer checkpoint retries, real jump/dash input, 27 bulldozer timing/position combinations for each keyboard/touch timing mode, missing-dash failures, mobile rotation and controller lifecycle, interlude handoff, and the empty-frame/punchline/Level 4 handoff order. Development `?test&level=the-chase` starts the chapter; `window.__sophie.chaseSection(x)` stages a supported route point for focused tests, including the dead end. Production only has the requested `#debug` level selector. A full fixed-tick route was also traversed during development, without making CI depend on a perfect whole-level keypress recording.

The environment art is a coherent placeholder. Browser tests exercise touch presentation and existing multitouch behavior, but tactile difficulty on physical phones still benefits from playtesting.

### Chapter 4: The Skyscraper

`src/game/levels/skyscraper.ts` defines three switchbacks: right/up through low and high crates, gently moving hanging cargo and a one-bone chain; left/up through a two-bone chain, cargo and a straight-up bone ladder with a final up-left dash; then right/up through five predictable birds, ordinary/high jumps, cargo and a final two-bone chain. The two-bone routes use three ordinary dashes with midair refills. Wide resting surfaces keep grounded recovery useful. The first bird passes above a broad safe floor before birds overlap the jump routes.

`skyscraper/SkyscraperRun.ts` composes existing physics, machinery, Jimmy, checkpoints, birds and camera. Its 720 ms arrival continues the prior super-jump from below the viewport, following a 250 ms reveal. `ClimbProgress.ts` uses checkpoint order rather than horizontal position, so leftward and vertical progress work identically. Fourteen safe anchors reset Sophie/Jimmy, baseline resources, current/future challenge bones, cargo and birds within the existing 180 ms retry. Earlier bones keep their own three-second respawn timers. The lifts commit to the next section's checkpoint and lower camera boundary. A fall 240 pixels below a challenge anchor, or below the active section floor allowance, retries without exposing the old route.

`VerticalView.ts` follows at the player's pace with a uniform 720×440 view, 95-pixel directional look-ahead and smooth vertical tracking. Its lower bound only advances upward until retry/debug reset. `rendering/SkyscraperArt.ts` draws bright planks/crate tops, cable cargo, work lights, mesh and quiet steel over oblique streets and rooftops. Background scale shrinks to 45% with altitude, revealing more city lights, skyline, tiny yard details and stars. This is procedural pixel art, without external scenery assets.

Jimmy keeps the shared delayed-input follower and his own dash state. Recovery now understands travel direction; Level 4 also reconciles a companion stranded below the active floor or far behind a safe landing. Birds never inspect his body, and he cannot consume treats. `ConstructionLift.ts` stages both dogs aboard for 700 ms, then raises the first two lifts over 3/3.2 seconds. The final lift takes 8.5 seconds, with Jimmy sitting, then holds the summit city view for 2 seconds before a 900 ms fade and the sole **TO BE CONTINUED** screen. Touch controls hide during staging/rides and return for gameplay. Pause/portrait freeze simulation and music.

The supplied `public/assets/sparrow-sprite.png` is retained unchanged. `scripts/prepare-sparrow.mjs` measures its 1448×1086 cells and body anchors, crops labels away, preserves transparency and samples nearest pixels at one scale into `sparrow.png` (320×128; ten 64×64 frames). `birds/appearance.ts` owns right/left wing cycles and the brief squawk pose. The unused stunned poses remain in the original sheet. `BirdMotion.ts` provides constant-speed horizontal passes with endpoint reversals and a shallow sine wave, without randomness, chasing or targeting. Level data tunes ranges, initial direction, speed (46–56 px/s), phase/offset and wave (8 pixels, 0.32 Hz); `birdTuning` tunes the forgiving 20×14 body and 110 ms animation frame interval. Checkpoint retry restarts all patterns exactly.

Only Sophie contact requests the shared procedural `sfx.birdSquawk()`: a 120 ms square-wave two-part chirp (540 → 1180, then 680 → 920 Hz), at 20% effect gain under the existing master gain/voice limit. Pitch, duration, waveform and gain live in `audio/config.ts`; no new audio context or binary SFX is added. `skyscraper/config.ts` centralizes arrival, camera, companion separation, boarding, summit hold and fade tuning. Geometry, lift durations, challenges and bones remain declarative level data. Player movement and dash rules remain unchanged.

Vitest covers validation, ordered checkpoints, challenge bone resets, bird bounds/direction/replay, lift timing, section camera bounds and SFX synthesis/cleanup. Browser coverage exercises entry from below, real keyboard input, 72 chain/timing combinations across keyboard/touch modes, both lifts, companion immunity/recovery, bird collision/squawk/reset, mobile rotation, music looping/pause/retry, the summit fade/replay and production asset paths. Focused development probes also traverse every platform connection with real collision/physics. Load `?test&level=skyscraper` in development or choose **The Skyscraper** under production `#debug`. Physical-device touch feel and listening still benefit from human playtesting; the supplied track retains its original loop boundary.

## World resolution and UI

The world uses Phaser's Canvas renderer with explicit nearest-neighbor texture filtering, smoothing disabled after resizes, and rounded camera coordinates. A viewport near 640×360 expands to show additional world on suitable displays, capped at 960×540. Integer CSS scaling is used where it fits, with a uniform fractional fallback on small screens. Physics remains in world units at 120 Hz. The canvas is never stretched non-uniformly.

The HUD, controls, hints, pause panel, and ending are HTML/CSS siblings over or around the canvas. They remain at native browser resolution and do not scroll with the game camera. Small-screen layouts keep the bone HUD visible. Mobile landscape uses a compact presentation and touch controls; rotating never changes world geometry or physics.

## Sprite source and preparation

Sophie’s supplied art is a **1536×1024 RGB presentation sheet**, not a uniform transparent 64×64 game atlas. It includes labels, a grid, subtly shaded opaque background, uneven cell widths, and row labels that do not consistently describe the right-hand poses.

The rename commit `175e4313cd2d66f844b44e4e5ae0bf1976ce8e31` replaced the image with a two-byte newline file. The intact PNG was recovered from the preceding upload commit `11ebb6003544eba3887ba16e913b177081d01587`, and matches the image supplied in chat. The broken file was removed from the repository root. Assets live in `public/assets/`:

- `sophie-source.png`: intact original sheet, retained for repeatable preparation.
- `sophie.png`: generated transparent 512×256 atlas, eight columns × four rows of 64×64 frames.

`scripts/prepare-sprites.mjs` contains all measured crop boundaries. It extracts the right-hand idle (source y 129–205), walk (477–550), run (559–631), and jump (729–816) rows, removes connected neutral background while preserving black outlines, and nearest-neighbor samples at a consistent scale with paws aligned to y=58. The eight source columns have pitches of roughly 87–93 pixels. The eight front-facing columns on the left and the sit, bark, and sleep rows are unused.

```sh
npm run assets
```

Idle, walk, and run use eight poses each. Jump uses selected airborne poses according to vertical velocity. **Dash is a trail/effect over Sophie's existing pose, not a separate drawn sprite.** The reference art has baked shading, variable pose proportions, and antialiased details, so this extraction is an approximation of an authored transparent atlas. For replacement artwork, update the central preparation metadata rather than scattering crop offsets through gameplay code.

Jimmy’s supplied **1280×960 JPEG** is retained as `public/assets/jimmy-source.jpg`. `scripts/prepare-jimmy.mjs` extracts the side-facing idle, walk, run, and jump poses plus sitting poses into the 512×320 `jimmy.png`, using measured cells, connected-background removal, nearest-neighbor sampling, and the same 64×64/paw-line atlas contract. It runs alongside Sophie’s preparation under `npm run assets`. The sit row occupies frames 32–39 and provides the real `jimmy-sit` animation used in Interlude 1; the first four rows keep their original frame indices. Bark, sleep, and front-facing poses remain unused. His dash is also an effect over existing poses. JPEG edges make this an approximate extraction; replacing the sheet with authored transparent frames would improve consistency without changing gameplay.

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

Vitest covers charge bounds, every dash direction, treat refills, continuous-ground recharge, no airborne recovery, jump cut/buffering/coyote time, combo momentum and reach, post-dash air control, collision correction, safe anchors, invalid level data, and uniform viewport scaling. Warehouse tests add time-partitioned delayed actions, diagonal mirroring, history reset, deterministic platform cycles/support, level validation, the conservative impossible-gap bound, trigger guards, and guaranteed sling landings across different time steps.

Playwright checks real keyboard controls and pause, browser errors, a complete Level 1 traversal into Level 2, failed combos and resource restoration, and matching physics at three viewport sizes. Warehouse coverage checks the introduction and delayed follower, both actors riding/jumping from machinery, belts and shutter timing, isolated treat resources, recovery/retry, elevator timing and retry, normal-input pallet/hoist/treat-chain routes, the final event and ending, and replay back to Level 1. The development-only `?test` hook supplies snapshots, fixed stepping, level/checkpoint selection, and fixture placement; `?test&level=warehouse` is a convenient development entry. Production installs no test API and starts in Level 1; the `#debug` selector can load any chapter or Interlude 1 afterward. Route tests use safe checkpoint setup then real movement/collision through each challenge, avoiding a brittle perfect whole-warehouse keypress recording.

All environment art is simple procedural pixel art, intentionally easy to replace. This slice has no persistence or gamepad implementation.

## Procedural sound effects

Jump, dash, Jimmy’s scripted super-jump, and dialogue effects are synthesized at runtime with the Web Audio API; there are no effect assets or audio dependencies. `main.ts` owns one `Sfx` instance across levels and scenes. Phaser's unused audio manager is disabled so it does not create another context. A trusted key press, mouse pointer, or completed touch creates/resumes the context synchronously; synthetic events cannot unlock it. Suspended, unsupported, denied, muted, or disabled audio drops effects without blocking gameplay or replaying a backlog. Gesture listeners stay available for interrupted browser audio. App destruction/HMR closes the context and removes listeners; scene transitions reuse it.

- Jump: 110 ms square-wave “bweep,” sweeping 220 → 520 Hz with a 3 ms attack and short decay. Only Sophie's actual takeoff requests it, including buffered/coyote/long jumps.
- Dash: 140 ms bandpass-filtered noise burst mixed with a 640 → 150 Hz triangle sweep. Its filter falls from 1800 → 650 Hz; noise mix is 65%. Only an accepted dash requests it; a zero-charge attempt is silent. Jimmy's mirrored movement stays quiet.
- Jimmy’s scripted super-jump: a 60 ms triangle spring compression (180 → 125 Hz), then `sfx.jimmySuperJump()` starts a 220 ms square sweep (150 → 1000 Hz, power 2.5) at takeoff. Gain sustains through the bright peak and releases over 12 ms, for 292 ms of sound. `jimmySuperJumpAnticipation()` handles compression independently so the scripts share synthesis without scheduling across pauses. Ordinary Jimmy jumps never request it. In Level 2 the existing sling arc reaches its crest after 220 ms, then coasts to the same safe landing; in Level 3 both sprites clear the top at 220 ms. Pause, portrait, scene changes and debug loads cancel a playing spring without replaying it on resume.
- Dialogue: text reveals at 18 ms per character; 30 ms triangle boops skip whitespace/punctuation and play at most once per frame and once per voice cadence. Sophie uses 660 ± 45 Hz / 65 ms, Jimmy 440 ± 35 Hz / 75 ms, and the off-screen voice 330 ± 25 Hz / 85 ms. Advancing keeps the existing one-press behavior, cancels the old reveal/tone, and never waits for remaining text. Pausing/portrait stops reveal progression. Elevator signs remain instant and silent. Full lines are available to accessibility tools while the visual text reveals.

Tune `src/game/audio/config.ts`: master volume (42%), effect volumes (jump 28%, dash 25%, dialogue 16%, Jimmy spring 30%), waveform/pitch/duration, spring sweep power and release, attack, dash filter/noise mix, reveal speed, global cadence floor (65 ms), and character profiles. `setMasterVolume`, `setEffectVolume`, `setMuted`, and `setEnabled` provide internal controls; volumes clamp to 0–1, with non-finite inputs treated as zero. An eight-voice cap, master headroom, and compressor limit overlapping peaks. Sources stop at their envelope end and disconnect; the short noise buffer is reused. SFX gain is independent of `LevelMusic` volume.

Vitest tests movement requests, cadence/characters/profiles, reveal cancellation, volumes, unavailable/disabled audio, resume rejection, node cleanup, spring scheduling/curve/cleanup, scripted launch alignment, and voice bounds with a small fake audio graph. `e2e/sfx.spec.ts` probes real browser contexts and source scheduling without recording audio: trusted keyboard/touch activation, one context across scenes/retries, jump/dash counts, silent failed dashes, dialogue, suspended-context resume, unavailable Web Audio, and continued music playback. Sound quality and device-specific autoplay behavior still need listening on real hardware; on browsers that require touch release, an effect before activation may be silent rather than delayed.

## Music

Level 1 loops the supplied **Rooftop Dash** track from `public/assets/audio/rooftop-dash.mp3`. The warehouse loops **Factory Pulse** from `public/assets/audio/factory-pulse.mp3`. Level 3 loops **Pixel Dash** from `public/assets/audio/pixel-dash.mp3`. Level 4 loops **City Lights Above** from `public/assets/audio/city-lights-above.mp3`, including its lifts and summit pause; its 900 ms ending fade also fades the track to silence. Music starts on the first key press or completed tap/click, as required by browser autoplay policies. It streams through a single HTML audio element at 50% volume, so downloading/decoding the full track never blocks the level. Mobile devices may use their system media volume.

Pausing, switching away, or rotating a phone/tablet to portrait pauses the music. Resuming continues from the same position. Falls and checkpoint retries keep the track running; the chapter fade briefly pauses playback, then switches to Factory Pulse when the warehouse loads. Chapter changes reuse the same gesture-activated audio element and start the new track from the beginning. The elevator reduces volume to 20% and restores 50% on arrival or retry. Leaving Level 2 stops and releases its music. Interlude 1 has procedural dialogue boops but no soundtrack. At Level 3’s dead end, `LevelMusic.fadeOut` starts immediately when scrolling stops. Its elapsed-time fade reaches zero in `chaseTuning.musicFadeMs` (650 ms), before “Gotcha.” at 850 ms, and pauses playback. Pause/portrait also freeze the fade. Input gestures cannot restart a zero-volume track; loading/replaying a chapter restores normal volume. Only dialogue boops and Jimmy’s procedural spring launch remain in the finale, followed by 650 ms of empty scaffolding before the final joke. No speech recording is included. Play again returns to the first chapter and restarts Rooftop Dash. Scene shutdown or destruction releases playback and listeners. Audio load/playback failures leave the game playable. Set a level's optional `music` field to its path relative to `public/`; the URL respects the configured GitHub Pages base path. All four uploaded MP3s are preserved as supplied, including any silence at their loop boundaries.

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
