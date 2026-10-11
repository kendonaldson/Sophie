import type { Point } from '../levels/types';
import type { PlayerController } from '../player/PlayerController';
import type { Rect } from '../player/CollisionAssist';
import { pizzaRushConfig as c } from './config';

export interface PizzaDefinition extends Point {
  id: string;
  requiresDash?: boolean;
}
/** Sophie-only interaction. A missed confrontation can be tried again without
 * falling deliberately; a completed confrontation permanently retires its slice. */
export class PizzaPickup {
  remainingMs = 0;
  completed = false;
  constructor(readonly definition: PizzaDefinition) {}
  get available() {
    return !this.completed && this.remainingMs === 0;
  }
  tick(ms: number) {
    this.remainingMs = Math.max(0, this.remainingMs - ms);
  }
  collect(body: Rect, player: PlayerController) {
    const d = this.definition;
    if (!this.available || (d.requiresDash && !player.dash.active))
      return false;
    const x = Math.max(body.x, Math.min(d.x, body.x + body.width));
    const y = Math.max(body.y, Math.min(d.y, body.y + body.height));
    if (Math.hypot(x - d.x, y - d.y) > c.pickupRadius || !player.collectPizza())
      return false;
    this.remainingMs = c.pickupRespawnMs;
    return true;
  }
  reset(completed = false) {
    this.completed = completed;
    this.remainingMs = 0;
  }
}
