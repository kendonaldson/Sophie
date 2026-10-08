import type Phaser from 'phaser';
import { Player } from '../player/Player';
import { InputHistory } from './InputHistory';
import { companionConfig as config, jimmyAppearance } from './config';
import { noInput, type PlayerIntent } from '../input/Input';
import type { LevelDefinition, Point } from '../levels/types';
import type { Rect } from '../player/CollisionAssist';
import { Effects } from '../rendering/Effects';
/** Own body/controller/history. No references to Sophie's dash state or collectibles. */
export class Jimmy {
  readonly actor: Player;
  readonly history = new InputHistory(config.followDelayMs);
  readonly effects: Effects;
  enabled = false;
  recoveries = 0;
  lastIntent = noInput();
  private safe: Point;
  private stuck = 0;
  private lastX = 0;
  private fade = 0;
  private gateExit?: number;
  constructor(
    scene: Phaser.Scene,
    private readonly level: LevelDefinition,
    solids: readonly Rect[],
  ) {
    this.safe = { ...level.companionSpawn! };
    this.actor = new Player(
      scene,
      this.safe,
      solids,
      config.physics,
      jimmyAppearance.key,
    );
    this.actor.sprite.setName('Jimmy').setDepth(9);
    this.effects = new Effects(scene);
  }
  beforeStep(ms: number, sophieInput: PlayerIntent, boardingX?: number) {
    const intent = this.enabled
      ? this.history.step(ms, sophieInput)
      : noInput();
    if (this.gateExit !== undefined) {
      if (this.actor.feet.x < this.gateExit) intent.moveX = 1;
      else this.gateExit = undefined;
    }
    if (boardingX !== undefined) {
      Object.assign(intent, noInput(), {
        moveX: this.actor.feet.x < boardingX ? 1 : 0,
      });
    }
    this.lastIntent = intent;
    // A mirrored dash always has its own charge; Jimmy never touches a DogTreat.
    if (intent.dashPressed)
      this.actor.controller.dash.charges = Math.max(
        1,
        this.actor.controller.dash.charges,
      );
    return this.actor.beforeStep(ms, intent);
  }
  afterStep(
    ms: number,
    sophie: Player,
    checkpoint: Point,
    gateExit?: number,
    direction: -1 | 1 = 1,
  ) {
    const waitingForGate = gateExit !== undefined;
    if (waitingForGate && this.lastIntent.moveX > 0) this.gateExit = gateExit;
    const stable = this.level.platforms.find(
      (p) =>
        Math.abs(sophie.feet.y - p.y) < 0.2 &&
        sophie.feet.x > p.x + (direction === 1 ? 85 : 32) &&
        sophie.feet.x < p.x + p.width - (direction === 1 ? 32 : 85),
    );
    if (sophie.grounded && stable)
      this.safe = { x: sophie.feet.x - direction * 15, y: stable.y };
    if (
      !waitingForGate &&
      this.lastIntent.moveX &&
      Math.abs(this.actor.feet.x - this.lastX) < 0.25 &&
      Math.abs(sophie.feet.x - this.actor.feet.x) > 100
    )
      this.stuck += ms;
    else this.stuck = 0;
    this.lastX = this.actor.feet.x;
    const lost =
      this.actor.feet.y > Math.min(this.level.fallY, checkpoint.y + 260) ||
      (!waitingForGate &&
        sophie.grounded &&
        Math.abs(sophie.feet.x - this.actor.feet.x) > config.maxSeparation) ||
      this.stuck > config.stuckMs;
    if (this.enabled && lost && !this.fade) {
      // Prefer a safe point behind Sophie, never an arbitrary midair coordinate.
      const target =
        (sophie.feet.x - this.safe.x) * direction >= 0
          ? this.safe
          : { x: checkpoint.x - direction * 40, y: checkpoint.y };
      this.actor.sprite.setAlpha(0);
      this.actor.respawn(target);
      this.history.reset();
      this.gateExit = undefined;
      this.stuck = 0;
      this.fade = config.recoveryFadeMs;
      this.recoveries++;
    }
    if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - ms);
      this.actor.sprite.setAlpha(1 - this.fade / config.recoveryFadeMs);
    }
    this.effects.update(
      ms,
      this.actor.sprite,
      this.actor.controller.dash.active,
    );
  }
  reconcile(point: Point, direction: -1 | 1 = 1) {
    // The time delay creates the walking separation. A large additional spawn
    // offset would make every recorded takeoff happen before its real ledge.
    this.safe = { x: Math.max(32, point.x - direction * 15), y: point.y };
    this.actor.respawn(this.safe);
    this.actor.sprite.setAlpha(1).setScale(1);
    this.history.reset();
    this.effects.clear();
    this.fade = 0;
    this.stuck = 0;
    this.gateExit = undefined;
  }
}
