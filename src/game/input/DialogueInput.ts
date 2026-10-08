/** X advances once per press; held keys and gameplay bindings cannot drive a story. */
export class DialogueInput {
  private held = false;
  constructor(private readonly advance: () => void) {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.clear);
  }
  private down = (event: KeyboardEvent) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('button, input, select')
    )
      return;
    if (
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(
        event.code,
      )
    )
      event.preventDefault();
    if (event.code !== 'KeyX') return;
    event.preventDefault();
    if (!this.held && !event.repeat) this.advance();
    this.held = true;
  };
  private up = (event: KeyboardEvent) => {
    if (event.code === 'KeyX') this.clear();
  };
  clear = () => {
    this.held = false;
  };
  destroy() {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.clear);
  }
}
