import { noInput, type PlayerIntent } from '../input/Input';
/** Simulation timestamps, not render frames. Button edges are consumed exactly once. */
export class InputHistory {
  private entries: { time: number; input: PlayerIntent }[] = [];
  private time = 0;
  private held = noInput();
  constructor(readonly delayMs = 300) {}
  step(ms: number, input: PlayerIntent): PlayerIntent {
    this.entries.push({ time: this.time, input: { ...input } });
    const target = this.time - this.delayMs;
    const result = { ...this.held, jumpPressed: false, dashPressed: false };
    while (this.entries.length && this.entries[0]!.time <= target + 1e-6) {
      const next = this.entries.shift()!.input;
      result.moveX = next.moveX;
      result.aimY = next.aimY;
      result.jumpHeld = next.jumpHeld;
      result.jumpPressed ||= next.jumpPressed;
      result.dashPressed ||= next.dashPressed;
      this.held = { ...next, jumpPressed: false, dashPressed: false };
    }
    this.time += ms;
    return result;
  }
  reset() {
    this.entries = [];
    this.time = 0;
    this.held = noInput();
  }
}
