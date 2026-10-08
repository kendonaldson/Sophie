export interface PlayerIntent {
  moveX: -1 | 0 | 1;
  aimY: -1 | 0 | 1;
  jumpPressed: boolean;
  jumpHeld: boolean;
  dashPressed: boolean;
}
export const noInput = (): PlayerIntent => ({
  moveX: 0,
  aimY: 0,
  jumpPressed: false,
  jumpHeld: false,
  dashPressed: false,
});
export interface InputSource {
  sample(): PlayerIntent;
  clear(): void;
  destroy(): void;
}
export class KeyboardInput implements InputSource {
  private held = new Set<string>();
  private jumpQueued = false;
  private dashQueued = false;
  private readonly gameKeys = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'KeyZ',
    'Space',
    'KeyX',
  ]);
  constructor() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.clear);
  }
  private onDown = (event: KeyboardEvent) => {
    if (
      !this.gameKeys.has(event.code) ||
      (event.target instanceof HTMLElement &&
        event.target.closest('button, input'))
    )
      return;
    event.preventDefault();
    if (!this.held.has(event.code)) {
      if (event.code === 'KeyZ' || event.code === 'Space')
        this.jumpQueued = true;
      if (event.code === 'KeyX') this.dashQueued = true;
    }
    this.held.add(event.code);
  };
  private onUp = (event: KeyboardEvent) => {
    this.held.delete(event.code);
  };
  sample(): PlayerIntent {
    const intent: PlayerIntent = {
      moveX: (Number(this.held.has('ArrowRight')) -
        Number(this.held.has('ArrowLeft'))) as -1 | 0 | 1,
      aimY: (Number(this.held.has('ArrowDown')) -
        Number(this.held.has('ArrowUp'))) as -1 | 0 | 1,
      jumpHeld: this.held.has('KeyZ') || this.held.has('Space'),
      jumpPressed: this.jumpQueued,
      dashPressed: this.dashQueued,
    };
    this.jumpQueued = false;
    this.dashQueued = false;
    return intent;
  }
  clear = () => {
    this.held.clear();
    this.jumpQueued = false;
    this.dashQueued = false;
  };
  destroy() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.clear);
  }
}
