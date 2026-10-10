import type { SfxOutput } from '../audio/Sfx';
import { physics } from '../config/physics';
import { DashController } from '../player/DashController';
import { PizzaPower } from '../pizza/PizzaPower';
import type { ShellyPose } from '../shelly/appearance';
import { interlude3 as c, kitchenBeats } from './interlude3';

export type KitchenSfx = Pick<
  SfxOutput,
  'jump' | 'dash' | 'pizzaPower' | 'pizzaSpeed'
>;
export type KitchenPose = 'idle' | 'sit' | 'walk' | 'run' | 'jump';
export interface KitchenActor {
  x: number;
  y: number;
  pose: KitchenPose;
  flipX: boolean;
  visible: boolean;
}
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const dashEndX = c.dashX + (c.dashSpeed * c.dashMs) / 1000;

/** Fixed kitchen choreography. Timed boundaries also own one-shot effects, so
 * variable frame rates, manual test ticks and optional dialogue skips agree. */
export class KitchenDirector {
  readonly power = new PizzaPower();
  readonly dash = new DashController(physics);
  private beatIndex = 0;
  private elapsed = 0;
  private exitSound = false;
  pizzaTaken = false;
  constructor(private readonly sfx?: KitchenSfx) {}
  get beat() {
    return kitchenBeats[this.beatIndex];
  }
  get phase() {
    return this.beat?.phase ?? 'complete';
  }
  get index() {
    return this.beat && 'lineIndex' in this.beat ? this.beat.lineIndex : -1;
  }
  get line() {
    if (this.phase === 'escape' && this.elapsed > c.exitLineMs)
      return undefined;
    return this.beat && 'line' in this.beat ? this.beat.line : undefined;
  }
  get canAdvance() {
    return this.phase === 'dialogue' && this.elapsed >= c.minimumLineMs;
  }
  get progress() {
    return this.beat ? Math.min(1, this.elapsed / this.beat.durationMs) : 1;
  }
  get fade() {
    if (this.phase === 'arrival')
      return Math.max(0, 1 - this.elapsed / c.fadeInMs);
    if (this.phase === 'fade') return this.progress;
    return this.phase === 'complete' ? 1 : 0;
  }
  get superMoving() {
    return (
      this.phase === 'super-return' ||
      (this.phase === 'escape' &&
        this.elapsed >= c.exitDelayMs &&
        this.actors.sophie.visible)
    );
  }
  advance() {
    if (this.canAdvance) this.next();
  }
  tick(ms: number) {
    let remaining = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    while (this.beat && remaining > 0) {
      const step = Math.min(remaining, this.beat.durationMs - this.elapsed);
      this.elapsed += step;
      remaining -= step;
      this.dash.tick(step, false);
      if (
        this.phase === 'escape' &&
        !this.exitSound &&
        this.elapsed >= c.exitDelayMs
      ) {
        this.exitSound = true;
        this.sfx?.pizzaSpeed();
      }
      if (this.elapsed + 1e-6 >= this.beat.durationMs) this.next();
    }
  }
  private next() {
    this.beatIndex++;
    this.elapsed = 0;
    if (this.phase === 'hop') this.sfx?.jump();
    if (this.phase === 'dash' && this.dash.start(1, 0, 1)) this.sfx?.dash();
    if (this.phase === 'activation') {
      this.pizzaTaken = true;
      if (this.power.activate()) this.sfx?.pizzaPower();
    }
    if (this.phase === 'super-return') this.sfx?.pizzaSpeed();
    if (this.phase === 'complete') this.power.reset();
  }
  get actors() {
    const id = this.beat?.id,
      p = this.progress;
    const sophie: KitchenActor = {
      x: c.sophieX,
      y: c.feetY,
      pose: 'idle',
      flipX: false,
      visible: true,
    };
    const jimmy: KitchenActor = {
      x: c.jimmyX,
      y: c.feetY,
      pose: 'sit',
      flipX: false,
      visible: true,
    };
    const revealed =
      this.beatIndex >= kitchenBeats.findIndex((b) => b.id === 'reveal');
    const shelly = {
      x: c.shellyX as number,
      y: c.feetY,
      pose: 'idle' as ShellyPose,
      flipX: true,
      visible: revealed,
    };
    if (id === 'arrival') {
      sophie.x = lerp(c.hatchX, c.sophieX, p);
      sophie.pose = 'walk';
      const follow = Math.max(
        0,
        (this.elapsed - c.arrivalDelayMs) / (c.arrivalMs - c.arrivalDelayMs),
      );
      jimmy.x = lerp(c.hatchX - 25, c.jimmyX, follow);
      jimmy.pose = follow > 0 ? 'walk' : 'idle';
    }
    if (id === 'walk') {
      sophie.x = lerp(c.sophieX, c.walkToX, p);
      sophie.pose = 'walk';
    }
    if (id === 'run') {
      sophie.x = lerp(c.walkToX, c.approachX, p);
      sophie.pose = 'run';
    }
    if (revealed) sophie.x = c.approachX;
    if (id === 'reveal') {
      shelly.x = lerp(c.shellyEntryX, c.shellyX, p);
      shelly.pose = 'walk';
    } else if (this.line?.speaker === 'shelly') shelly.pose = 'talk';
    if (id === 'hop') {
      sophie.x = lerp(c.approachX, c.dashX, p);
      sophie.y = lerp(c.feetY, c.dashY, 1 - (1 - p) ** 2);
      sophie.pose = 'jump';
    } else if (id === 'dash') {
      sophie.x = c.dashX + (c.dashSpeed * this.elapsed) / 1000;
      sophie.y = c.dashY;
      sophie.pose = 'jump';
      shelly.pose = 'surprised';
    } else if (id === 'land') {
      sophie.x = lerp(dashEndX, c.pizzaX, p);
      sophie.y = lerp(c.dashY, c.pizzaY, p * p);
      sophie.pose = 'jump';
      shelly.pose = 'surprised';
      shelly.flipX = false;
    } else if (id === 'activation') {
      sophie.x = c.pizzaX;
      sophie.y = c.pizzaY;
      shelly.pose = 'surprised';
      shelly.flipX = false;
    } else if (id === 'return') {
      sophie.x = lerp(c.pizzaX, c.returnX, p);
      sophie.y = lerp(c.pizzaY, c.feetY, p);
      sophie.pose = 'run';
      sophie.flipX = true;
      shelly.pose = 'surprised';
    } else if (this.pizzaTaken) {
      sophie.x = c.returnX;
      sophie.flipX = true;
      shelly.pose = 'scold';
    }
    if (id === 'escape') {
      jimmy.x += (c.jimmySpeed * this.elapsed) / 1000;
      jimmy.pose = 'run';
      sophie.x +=
        (c.powerSpeed * Math.max(0, this.elapsed - c.exitDelayMs)) / 1000;
      sophie.flipX = false;
      sophie.pose = this.elapsed >= c.exitDelayMs ? 'run' : 'idle';
      shelly.flipX = sophie.x < shelly.x;
      shelly.pose = 'surprised';
    }
    if (['hold', 'fade', 'complete'].includes(this.phase)) {
      sophie.x = jimmy.x = c.exitX;
      shelly.pose = 'determined';
      shelly.flipX = false;
    }
    sophie.visible = sophie.x < c.exitX;
    jimmy.visible = jimmy.x < c.exitX;
    return { sophie, jimmy, shelly };
  }
}
