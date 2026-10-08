import { noInput, type PlayerIntent } from '../input/Input';
/** Simulation timestamps, not render frames. Button edges are consumed exactly once. */
export class InputHistory {
  private entries: { time: number; input: PlayerIntent }[] = [];
  private time = 0;
  private held: Pick<PlayerIntent, 'moveX' | 'aimY' | 'jumpHeld'> = noInput();
  constructor(readonly delayMs = 300) {}
  step(ms: number, input: PlayerIntent): PlayerIntent {
    this.entries.push({ time: this.time, input: { ...input } });
    const target = this.time - this.delayMs;
    const result: PlayerIntent = { ...noInput(), ...this.held };
    while (this.entries.length && this.entries[0]!.time <= target + 1e-6) {
      const next = this.entries.shift()!.input;
      result.moveX = next.moveX;
      result.aimY = next.aimY;
      result.jumpHeld = next.jumpHeld;
      result.jumpPressed ||= next.jumpPressed;
      result.dashPressed ||= next.dashPressed;
      if (next.jumpPressed && next.jumpSource)
        result.jumpSource = next.jumpSource;
      if (next.dashPressed && next.dashSource)
        result.dashSource = next.dashSource;
      this.held = {
        moveX: next.moveX,
        aimY: next.aimY,
        jumpHeld: next.jumpHeld,
      };
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
