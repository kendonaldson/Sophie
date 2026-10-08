# AGENTS.md

## Project

This repository contains a browser-based 2D pixel-art platformer starring Sophie, a dachshund.

The game should feel polished, responsive, charming, and mechanically precise. New work should preserve the existing gameplay feel and architecture rather than treating each feature as an isolated prototype.

Before making substantial changes:

1. Inspect the existing implementation.
2. Understand the relevant abstractions and tests.
3. Reuse existing systems where appropriate.
4. Avoid redesigning unrelated code.
5. Prefer the smallest clean implementation that fits the established architecture.

Explicit task instructions from the user take precedence over this file.

---

## Technology

The expected stack is:

- TypeScript
- Phaser 3
- Phaser Arcade Physics
- Vite
- Vitest
- Playwright
- ESLint
- Prettier
- strict TypeScript

Do not introduce major frameworks or dependencies without a concrete need.

The game is a static web application and should remain deployable through GitHub Pages.

---

## Architecture Philosophy

Phaser runs the game, but Phaser should not become the architecture.

Keep gameplay concepts in small, understandable TypeScript modules where practical.

Separate concerns such as:

- physical input
- logical player intent
- movement simulation
- dash state
- jump state
- collision assistance
- collectibles
- animation selection
- checkpoints
- companions
- moving platforms
- level definitions
- camera behavior
- rendering
- UI

Avoid giant Phaser Scene classes.

Prefer:

- composition over inheritance
- explicit state ownership
- deterministic timing
- pure functions where useful
- declarative data
- reusable gameplay primitives
- centralized configuration

Avoid:

- global mutable state
- scattered magic numbers
- duplicated gameplay constants
- deep inheritance hierarchies
- speculative abstraction
- unnecessary ECS architecture
- feature-specific hacks inside generic player code
- rendering code that owns gameplay rules

Do not refactor working systems merely for stylistic preference.

---

## Gameplay Feel

Movement quality is a primary feature of the game.

Controls should feel responsive, forgiving, predictable, and expressive, similar in philosophy to high-quality precision platformers.

Do not attempt to reproduce another game's exact physics.

Preserve techniques such as:

- acceleration and deceleration
- air control
- variable jump height
- jump buffering
- coyote time
- maximum fall speed
- forgiving collision bodies
- corner correction
- frame-rate-independent motion
- responsive dash exit behavior

The player should feel that a failed jump was their mistake, not a collision-box technicality.

Near misses at platform corners should receive reasonable correction rather than unnecessarily killing momentum.

Do not make collision assistance so strong that the game visibly plays itself.

---

## Movement Vocabulary

The game's movement mechanics intentionally combine.

### Basic movement

Sophie can:

- move left and right
- jump
- aim using directional input
- dash in eight directions

Keyboard controls:

- Arrow keys: movement and dash direction
- Z: jump
- Space: alternate jump
- X: dash

### Long jump

Dash followed quickly by jump is an intentional long-jump mechanic.

A dash-jump should preserve enough horizontal momentum to produce substantially greater range than a normal jump.

### High jump

Jump followed by an upward or upward-diagonal dash is an intentional high-jump technique.

### Air control after dash

A dash is a short movement action, not a long loss-of-control state.

After an airborne dash ends, normal air control should return quickly.

For example:

1. jump
2. dash right
3. dash ends
4. continue holding right
5. steer toward the landing platform

Preserve this behavior.

### No wall mechanics

Do not add wall jumping or wall sliding unless explicitly requested.

---

## Dash Economy

Sophie can hold at most two dash charges.

Initial state:

    dashCharges = 1

Maximum:

    maxDashCharges = 2

Using a dash consumes one charge.

### Ground recovery

Dash recovery happens only after Sophie has continuously touched valid ground for 500 ms.

Ground recovery guarantees at least one dash:

    dashCharges = max(dashCharges, 1)

Therefore:

    0 charges + 500 ms grounded -> 1
    1 charge + 500 ms grounded -> 1
    2 charges + 500 ms grounded -> 2

Leaving the ground before 500 ms resets the ground-recovery timer.

There is no passive airborne recharge.

Ground recovery must never generate the second bonus charge.

### Dog treats

Collecting a dog treat adds one charge:

    dashCharges = min(2, dashCharges + 1)

Therefore:

    0 + treat -> 1
    1 + treat -> 2
    2 + treat -> 2

Treats can be collected in midair.

This makes sequences such as:

    dash -> treat -> dash

an intentional core mechanic.

Do not change these rules unless explicitly requested.

---

## Gameplay Configuration

Game-feel values belong in centralized, strongly typed configuration.

Examples include:

- run speed
- acceleration
- deceleration
- air acceleration
- gravity
- maximum fall speed
- jump velocity
- jump-cut behavior
- coyote time
- jump buffer
- dash speed
- dash duration
- dash exit momentum
- dash-jump window
- dash-jump momentum retention
- grounded dash recharge
- collision body inset
- corner correction
- camera look-ahead
- companion follow delay

Do not scatter these values throughout implementation code.

Someone tuning the game should be able to change the feel substantially without rewriting movement logic.

---

## Timing

Prefer elapsed-time-driven systems rather than wall-clock dependencies.

Gameplay behavior must not depend on a specific frame rate.

Avoid logic whose behavior changes materially between 60 Hz, 120 Hz, and other reasonable refresh rates.

Timers such as:

- coyote time
- jump buffer
- dash duration
- dash recharge
- companion delay
- moving-platform cycles

should be deterministic and testable.

---

## Player State

Keep player state understandable.

A reasonable high-level model is:

- Grounded
- Airborne
- Dashing

Keep orthogonal state separate, such as:

- dash charges
- coyote timer
- jump buffer
- recharge timer
- checkpoint state

Do not create combinatorial state names such as:

    AirborneWithoutDashAfterCoyoteTime

---

## Input Architecture

Gameplay code should consume normalized logical input rather than directly querying keyboards, touch controls, or future gamepads.

Conceptually:

    KeyboardInput
           \
            -> InputManager -> PlayerInput -> PlayerController
           /
    TouchInput

A logical input model might contain:

    left
    right
    up
    down
    jumpPressed
    jumpHeld
    dashPressed

Exact implementation may vary.

Do not maintain separate mobile and desktop movement implementations.

---

## Mobile Controls

Mobile uses explicit on-screen controls, not swipe gestures and not the operating system's software keyboard.

In landscape mobile mode:

Lower left:

- Up
- Down
- Left
- Right

Lower right:

- Z / Jump
- X / Dash

Multitouch is mandatory.

The player must be able to hold directional controls while independently pressing Jump or Dash.

Examples that must work:

    Right + Jump
    Right + Dash
    Up + Dash
    Up + Right + Dash

Touch controls map to exactly the same logical input used by keyboard controls.

Touch controls are mobile-only.

Do not show them on desktop merely because a computer has touch capability.

Portrait mobile mode may display a simple:

    Rotate your device to play

message.

Touch UI is native-resolution UI, not part of the pixel-art game world.

---

## Rendering

The game world and application UI have intentionally different rendering requirements.

### World

The world uses a deliberate low-resolution pixel-art aesthetic.

Sophie uses approximately 64x64 sprite frames.

Use:

- nearest-neighbor filtering
- no texture smoothing
- crisp pixel scaling
- integer-aligned presentation where practical
- a logical viewport around 640x360 unless existing code establishes otherwise

Avoid subpixel shimmer.

Physics must not depend on physical display resolution.

Do not describe the visual style internally as "64-bit." It is pixel art using 64x64 character sprites.

### UI

UI renders independently at native browser/display resolution.

This includes:

- HUD
- dialogue
- menus
- touch controls
- level-complete text
- accessibility/settings UI

UI should remain crisp regardless of the game's logical rendering resolution.

Prefer DOM/CSS for native-resolution overlays where that fits cleanly.

---

## HUD

Dash availability uses two small dog-bone indicators.

The first represents normal dash capacity.

The second represents treat-granted bonus capacity.

Suggested presentation:

- filled bone: charge available
- outlined/dim bone: unavailable
- subtle recharge indication for the first charge while grounded
- brief pop/animation when a treat grants a charge

Do not replace this with a numeric counter without explicit direction.

---

## Art Direction

The game is cute, readable pixel art.

Prioritize:

1. gameplay readability
2. visual personality
3. atmosphere
4. detail

Missing art may be represented with intentionally simple placeholder pixel art.

Placeholder assets should still be coherent and charming rather than programmer rectangles where reasonable.

Do not download arbitrary third-party art.

Keep collision surfaces visually understandable.

Background detail must never make playable geometry difficult to read.

---

## Assets

Inspect supplied sprite sheets rather than guessing frame coordinates.

Centralize sprite frame and animation metadata.

Do not scatter unexplained crop coordinates through gameplay code.

If an asset requires preprocessing:

- create explicit atlas metadata, or
- create a repeatable preprocessing script

Preserve source assets.

---

## Sophie

Sophie is the player-controlled dachshund.

Her visible sprite is not her literal collision rectangle.

Tail, ears, nose, and other decorative extremities should not cause frustrating collisions.

Use a smaller meaningful collision body around the torso/paw area.

---

## Jimmy

Jimmy is Sophie's white/cream cockapoo companion.

When present, Jimmy follows Sophie rather than being directly controlled.

His behavior should visually suggest:

    Sophie goes first
    Jimmy follows

Prefer delayed action/input following rather than copying Sophie's exact coordinates.

Jimmy may receive slightly more forgiving traversal behavior than Sophie.

Jimmy must never turn the game into an escort mission.

The player should not fail because Jimmy:

- missed a platform
- became stuck
- fell behind
- failed to time machinery

Recover him intelligently when necessary.

Jimmy should not:

- steal Sophie's treats
- alter Sophie's dash economy
- physically obstruct Sophie during ordinary gameplay
- require constant waiting

Keep companion logic separate from PlayerController.

Share lower-level movement primitives instead of duplicating the entire player implementation.

---

## Moving Platforms

Moving platforms are reusable game systems rather than level-specific scripts.

Support:

- horizontal movement
- vertical movement
- predictable cycles
- optional pauses
- velocity transfer
- jumping from moving platforms
- stable standing behavior

Avoid:

- jitter
- tunneling
- losing intended jump momentum
- characters sliding unpredictably through platforms

Platform movement should be declarative level data where practical.

---

## Levels

Levels should primarily be declarative.

Adding a conventional level should generally mean defining:

- geometry
- spawn
- moving platforms
- collectibles
- checkpoints
- triggers
- exits

rather than writing another giant custom Scene.

Keep PlayerController independent of specific level geometry.

Architecture should remain compatible with moving to Tiled or another map editor later without requiring player-movement rewrites.

---

## Level Design Philosophy

Levels teach mechanics through play.

Prefer:

    introduce -> practice -> combine -> test

over tutorial dialogs.

The player should usually encounter a mechanic safely before being asked to execute it under pressure.

Use visual composition to communicate intended routes.

Do not over-explain mechanics that can be demonstrated naturally.

Later challenges should combine previously learned mechanics rather than constantly introducing new abilities.

---

## Checkpoints and Failure

There are no lives.

Falling into a pit causes a fast retry.

Use invisible safe checkpoint anchors.

Do not respawn Sophie at her exact last coordinate.

Checkpoint positions should be:

- safely away from edges
- on stable terrain
- near the beginning of meaningful traversal sequences

Respawn should:

- be quick
- reset velocity
- clear inappropriate transient movement state
- restore appropriate baseline dash state
- reconcile companions appropriately

Avoid long death animations and loading interruptions.

---

## Camera

Camera movement should support platforming rather than draw attention to itself.

Prefer:

- smooth tracking
- modest horizontal look-ahead
- Sophie somewhat left of center while traveling right
- smooth vertical tracking when required

Avoid:

- constant hard centering
- excessive camera lag
- sudden snaps
- camera behavior that creates perceived input latency

Camera behavior must not affect physics.

---

## Scripted Moments

Level-specific cinematic events belong in isolated level-event/cutscene logic.

Do not contaminate generic movement systems with one-off scripted behavior.

It is acceptable for a scripted sequence to temporarily:

- disable player input
- control character motion
- guarantee a landing
- adjust camera behavior

provided normal control is restored cleanly afterward.

---

## Dialogue

Keep dialogue lightweight.

Do not build an elaborate conversation system for a few lines of text.

Dialogue should use native-resolution UI and remain separate from the pixel-art world camera.

Favor short lines and environmental storytelling.

---

## Testing

Gameplay behavior should be testable without requiring the entire Phaser scene wherever practical.

Use Vitest for deterministic gameplay logic.

Important systems should have tests covering relevant invariants and edge cases.

Examples:

### Movement

- coyote time
- jump buffering
- jump cut
- dash consumption
- dash availability
- dash-jump momentum
- air control after dash

### Dash economy

- initial charge = 1
- maximum = 2
- dash consumes charge
- no airborne recharge
- 500 ms continuously grounded restores at least 1
- leaving ground resets recharge timer
- ground recharge never creates charge 2
- treats add exactly 1 up to maximum 2

### Levels

- definitions load correctly
- invalid data fails clearly
- checkpoints work
- transitions work

### Companions

- delayed input is time-based
- Jimmy mirrors relevant actions
- respawn reconciles Jimmy
- Jimmy cannot consume Sophie collectibles
- Jimmy does not modify Sophie's dash state

Use Playwright for browser-level behavior such as:

- game startup
- console errors
- asset loading
- keyboard input
- mobile controls
- resizing
- level transitions
- production behavior

Avoid brittle pixel-perfect assertions unless specifically needed.

Do not make Playwright perform an entire difficult level using synthetic input merely to prove level completion.

Use focused integration hooks or test-only progression mechanisms where appropriate and keep them out of normal gameplay.

---

## Audio / Sound Design

Audio should reinforce the game's cute retro platformer identity.

Prefer lightweight procedural 8-bit sound effects for simple gameplay cues rather than adding binary audio assets unnecessarily.

### SFX Style

Effects should be:

- short
- responsive
- playful
- clearly readable over music
- retro / 8-bit inspired
- light rather than harsh or realistic

Avoid:

- realistic Foley
- cinematic impact sounds
- aggressive distortion
- excessive reverb
- loud or fatiguing effects

### Core Procedural Effects

Jump:
- short bouncy upward pitch sweep
- square or triangle-wave character
- cute "bweep / boing" feel
- roughly 80-140 ms

Dash:
- short synthetic swoosh
- filtered noise and/or pitched oscillator sweep
- crisp "fwip / shwoop" character
- roughly 100-180 ms
- only play when a dash actually succeeds

Dialogue:
- short 8-bit "boop" sounds as text is revealed
- do not sound on every space or punctuation mark
- rate-limit the cadence so dialogue does not become a buzz
- slight pitch variation between notes

Character dialogue should have subtly different sound profiles:

- Sophie: somewhat higher pitch
- Jimmy: somewhat lower pitch
- off-screen human speaker: lower/neutral, but not threatening

These are text sounds, not synthesized speech.

---

## CI and Deployment

GitHub Actions is the CI/CD mechanism.

On pull requests targeting `main`, run:

- TypeScript type checking
- linting
- formatting checks
- Vitest
- Playwright
- production build

Pull requests do not deploy production.

On pushes to `main`:

1. install dependencies using the repository lockfile
2. run all required validation
3. run Playwright
4. build production
5. upload the exact successful build artifact
6. deploy to GitHub Pages

Deployment must not occur if any required validation fails.

Do not use:

- `continue-on-error` for quality gates
- committed `dist/`
- unnecessary deployment branches
- Netlify
- Vercel
- Cloudflare
- Docker
- backend infrastructure

unless explicitly requested later.

The application must remain compatible with GitHub Pages subpath hosting.

Do not hardcode hosting URLs or repository names into gameplay code.

---

## Code Quality

Code should be understandable by another experienced engineer without needing to reconstruct hidden assumptions.

Favor descriptive names over comments explaining bad names.

Comments are valuable when explaining:

- non-obvious game-feel choices
- unusual collision behavior
- timing decisions
- intentional deviations from obvious physics
- level-specific scripted behavior

Do not narrate obvious code.

Avoid `any` except when unavoidable at library boundaries.

Do not suppress TypeScript errors instead of fixing them.

Do not disable lint rules simply to make a change pass unless there is a clear documented reason.

---

## Scope Discipline

Do not add unrelated systems because they might be useful someday.

Unless specifically requested, do not add:

- enemies
- combat
- lives
- scoring
- inventory
- wall jumps
- wall sliding
- procedural generation
- save-game infrastructure
- online systems
- elaborate menu systems
- dialogue engines
- cutscene engines
- ECS frameworks

Build what is currently needed cleanly.

---

## Working Process

For meaningful tasks:

1. Inspect the relevant existing code.
2. Understand current behavior.
3. Identify the smallest set of systems that should change.
4. Preserve public behavior not targeted by the task.
5. Implement the feature.
6. Add or update appropriate tests.
7. Run validation.
8. Fix failures before finishing.

Do not stop after scaffolding when the task requests a playable feature.

Do not merely document failures that can reasonably be fixed.

---

## Validation Before Completion

For substantial changes, run the relevant available checks:

    typecheck
    lint
    formatting
    Vitest
    Playwright
    production build

When gameplay is changed, also verify the actual behavior manually where possible.

Pay particular attention to regressions in:

- movement feel
- dash timing
- collision forgiveness
- sprite rendering
- asset paths
- mobile multitouch
- moving platforms
- checkpoints
- camera behavior
- level transitions

---

## Completion Report

When finishing a substantial task, provide a concise report containing:

- what changed
- important architectural decisions
- files/systems affected
- tests added or changed
- validation performed
- configurable values introduced
- remaining limitations or assumptions

Do not provide a long narrative if a compact technical summary will do.
