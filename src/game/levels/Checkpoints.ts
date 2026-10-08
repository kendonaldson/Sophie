import type { LevelDefinition, Point } from './types';
export class Checkpoints {
  private index = -1;
  constructor(private readonly level: LevelDefinition) {}
  get id() {
    return this.index < 0 ? 'spawn' : this.level.checkpoints[this.index]!.id;
  }
  get spawn(): Point {
    return {
      ...(this.index < 0
        ? this.level.playerSpawn
        : this.level.checkpoints[this.index]!.spawn),
    };
  }
  update(feet: Point, grounded: boolean) {
    if (!grounded) return false;
    for (let i = this.level.checkpoints.length - 1; i > this.index; i--) {
      const cp = this.level.checkpoints[i]!,
        a = cp.area;
      if (
        feet.x >= a.x &&
        feet.x <= a.x + a.width &&
        feet.y >= a.y &&
        feet.y <= a.y + a.height
      ) {
        this.index = i;
        return true;
      }
    }
    return false;
  }
  reset() {
    this.index = -1;
  }
}
