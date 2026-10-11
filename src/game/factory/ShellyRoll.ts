import { overlaps, type Rect } from '../player/CollisionAssist';
import { approach } from '../player/PlayerController';
import { factoryTuning as t } from './config';

export type RollPhase =
  'hidden' | 'appear' | 'align' | 'charge' | 'roll' | 'trail' | 'deflected';
type RollSound = 'charge' | 'roll';
/** Fixed-time lane selection. Only align can read a new target height. */
export class ShellyRoll {
  phase: RollPhase = 'hidden';
  x = 0;
  feetY = 0;
  lockedY?: number;
  direction: -1 | 1 = -1;
  elapsed = 0;
  cooldown: number = t.rollGraceMs;
  count = 0;
  private left = 0;
  private right = 0;
  private sweeps: Rect[] = [];
  private deflectX = 0;
  private deflectY = 0;
  start(left: number, right: number, targetY: number) {
    if (this.phase !== 'hidden' || this.cooldown > 0) return false;
    this.left = left;
    this.right = right;
    this.direction = this.count++ % 2 === 0 ? -1 : 1;
    this.x = this.direction < 0 ? right : left;
    this.feetY = targetY - 90;
    this.lockedY = undefined;
    this.phase = 'appear';
    this.elapsed = 0;
    return true;
  }
  /** The caller has already confirmed a powered dash intersects this roll. */
  deflect(direction: { x: number; y: number }): boolean {
    // A step may have just ended the roll while retaining its damaging sweep.
    if (
      this.phase === 'deflected' ||
      (this.phase !== 'roll' && this.sweeps.length === 0)
    )
      return false;
    this.direction =
      direction.x > 0
        ? 1
        : direction.x < 0
          ? -1
          : this.direction === 1
            ? -1
            : 1;
    this.deflectX = this.x;
    this.deflectY = this.feetY;
    this.phase = 'deflected';
    this.elapsed = 0;
    this.lockedY = undefined;
    this.sweeps = [];
    return true;
  }
  tick(ms: number, targetY: number): RollSound[] {
    const sounds: RollSound[] = [];
    this.sweeps = [];
    let remaining = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    while (remaining > 0) {
      if (this.phase === 'hidden') {
        this.cooldown = Math.max(0, this.cooldown - remaining);
        break;
      }
      const duration =
        this.phase === 'appear'
          ? t.rollAppearMs
          : this.phase === 'align'
            ? t.rollAlignMs
            : this.phase === 'charge'
              ? t.rollTelegraphMs
              : this.phase === 'roll'
                ? ((this.right - this.left) * 1000) / t.rollSpeed
                : this.phase === 'deflected'
                  ? t.rollDeflectMs
                  : t.rollTrailMs;
      const step = Math.min(remaining, duration - this.elapsed);
      if (this.phase === 'align')
        this.feetY = approach(this.feetY, targetY, step * 0.9);
      if (this.phase === 'roll') {
        const from = this.x;
        this.x += (this.direction * t.rollSpeed * step) / 1000;
        this.sweeps.push({
          x: Math.min(from, this.x) - t.rollWidth / 2,
          y: this.feetY - t.rollHeight,
          width: Math.abs(this.x - from) + t.rollWidth,
          height: t.rollHeight,
        });
      }
      if (this.phase === 'deflected') {
        const seconds = (this.elapsed + step) / 1000;
        this.x = this.deflectX + this.direction * t.rollDeflectSpeed * seconds;
        this.feetY =
          this.deflectY -
          t.rollDeflectLift * seconds +
          (t.rollDeflectGravity * seconds ** 2) / 2;
      }
      this.elapsed += step;
      remaining -= step;
      if (this.elapsed + 1e-6 < duration) break;
      this.elapsed = 0;
      if (this.phase === 'appear') this.phase = 'align';
      else if (this.phase === 'align') {
        this.lockedY = this.feetY = targetY;
        this.phase = 'charge';
        sounds.push('charge');
      } else if (this.phase === 'charge') {
        this.phase = 'roll';
        sounds.push('roll');
      } else if (this.phase === 'roll') this.phase = 'trail';
      else {
        this.phase = 'hidden';
        this.cooldown = t.rollCooldownMs;
      }
    }
    return sounds;
  }
  get body(): Rect {
    return {
      x: this.x - t.rollWidth / 2,
      y: this.feetY - t.rollHeight,
      width: t.rollWidth,
      height: t.rollHeight,
    };
  }
  hits(body: Rect) {
    return (
      (this.phase === 'roll' && overlaps(body, this.body)) ||
      this.sweeps.some((s) => overlaps(body, s))
    );
  }
  reset() {
    this.phase = 'hidden';
    this.elapsed = 0;
    this.cooldown = t.rollGraceMs;
    this.lockedY = undefined;
    this.count = 0;
    this.sweeps = [];
    this.deflectX = this.deflectY = 0;
  }
}
