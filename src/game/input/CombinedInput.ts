import type { InputSource, PlayerIntent } from './Input';
/** Mobile does not replace the keyboard. Both sources contribute button edges. */
export class CombinedInput implements InputSource {
  constructor(
    private readonly keyboard: InputSource,
    private readonly touch: InputSource,
  ) {}
  sample(): PlayerIntent {
    const keyboard = this.keyboard.sample(),
      touch = this.touch.sample();
    const touchAiming = touch.moveX !== 0 || touch.aimY !== 0;
    return {
      moveX: touchAiming ? touch.moveX : keyboard.moveX,
      aimY: touchAiming ? touch.aimY : keyboard.aimY,
      jumpHeld: keyboard.jumpHeld || touch.jumpHeld,
      jumpPressed: keyboard.jumpPressed || touch.jumpPressed,
      dashPressed: keyboard.dashPressed || touch.dashPressed,
    };
  }
  clear() {
    this.keyboard.clear();
    this.touch.clear();
  }
  destroy() {
    this.keyboard.destroy();
    this.touch.destroy();
  }
}
