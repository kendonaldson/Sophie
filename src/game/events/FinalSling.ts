import type { FinaleDefinition, Point } from '../levels/types';
import type { Player } from '../player/Player';
export const slingTiming = {
  freezeMs: 400,
  catchMs: 550,
  contactMs: 150,
  flightMs: 1100,
} as const;
const catchStart = slingTiming.freezeMs;
const contactStart = catchStart + slingTiming.catchMs;
const flightStart = contactStart + slingTiming.contactMs;
export function shouldStartSling(
  def: FinaleDefinition,
  feet: Point,
  grounded: boolean,
  vy: number,
) {
  return (
    !grounded &&
    feet.x > def.runwayEnd + 8 &&
    feet.x < def.landing.x - 80 &&
    feet.y >= def.runwayY - 38 &&
    feet.y < def.runwayY + 170 &&
    vy > 25 &&
    (feet.x >= def.triggerX || feet.y > def.runwayY + 28)
  );
}
const mix = (a: Point, b: Point, t: number, lift = 0): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t - 4 * lift * t * (1 - t),
});
/** A one-time level event. Generic jumping/dashing never knows this exists. */
export class FinalSling {
  elapsed = 0;
  done = false;
  private readonly from: Point;
  private readonly jimmyFrom: Point;
  constructor(
    private readonly def: FinaleDefinition,
    private readonly sophie: Player,
    private readonly jimmy: Player,
  ) {
    this.from = { ...sophie.feet };
    this.jimmyFrom = { ...jimmy.feet };
  }
  get phase() {
    const t = this.elapsed;
    return this.done
      ? 'landed'
      : t < catchStart
        ? 'freeze'
        : t < contactStart
          ? 'catch'
          : t < flightStart
            ? 'contact'
            : 'sling';
  }
  step(ms: number) {
    if (this.done) return;
    this.elapsed += ms;
    const contact = { x: this.from.x - 23, y: this.from.y + 7 };
    this.sophie.sprite.anims.stop();
    this.jimmy.sprite.anims.stop();
    this.sophie.sprite.setFlipX(false).setFrame(27);
    this.jimmy.sprite.setFlipX(false).setFrame(26);
    if (this.phase === 'freeze') {
      this.sophie.place(this.from);
      this.jimmy.place(this.jimmyFrom);
    } else if (this.phase === 'catch') {
      this.sophie.place(this.from);
      this.jimmy.place(
        mix(
          this.jimmyFrom,
          contact,
          Math.min(1, (this.elapsed - catchStart) / slingTiming.catchMs),
          75,
        ),
      );
    } else if (this.phase === 'contact') {
      this.sophie.place(this.from);
      this.jimmy.place(contact);
      const compression = Math.sin(
        ((this.elapsed - contactStart) / slingTiming.contactMs) * Math.PI,
      );
      this.sophie.sprite.setScale(
        1 + compression * 0.15,
        1 - compression * 0.22,
      );
      this.jimmy.sprite.setScale(1 + compression * 0.2, 1 - compression * 0.25);
    } else {
      const t = Math.min(
        1,
        (this.elapsed - flightStart) / slingTiming.flightMs,
      );
      this.sophie.sprite.setScale(1);
      this.jimmy.sprite.setScale(1);
      this.sophie.place(mix(this.from, this.def.landing, t, 140));
      this.jimmy.place(mix(contact, this.def.jimmyLanding, t, 110));
      if (t >= 1) {
        this.sophie.respawn(this.def.landing);
        this.jimmy.respawn(this.def.jimmyLanding);
        this.done = true;
      }
    }
  }
}
