/** Native UI, separate from the two dog-bone dash charges. */
export class PizzaRushHud {
  readonly element = document.createElement('div');
  private readonly fill: HTMLElement;
  constructor(parent: HTMLElement) {
    const e = this.element;
    e.id = 'pizza-rush';
    e.className = 'pizza-rush-hud';
    e.hidden = true;
    e.setAttribute('role', 'progressbar');
    e.setAttribute('aria-label', 'Pizza Rush time remaining');
    e.setAttribute('aria-valuemin', '0');
    e.setAttribute('aria-valuemax', '100');
    e.innerHTML =
      '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M2 5L12 26 22 5Z" fill="#f5cc6c" stroke="#533d31" stroke-width="2"/><path d="M2 5Q12-1 22 5" fill="none" stroke="#bd8146" stroke-width="5"/><circle cx="9" cy="10" r="2" fill="#bf5940"/><circle cx="15" cy="12" r="2" fill="#bf5940"/><circle cx="12" cy="18" r="2" fill="#bf5940"/></svg><div><span>PIZZA RUSH</span><div class="pizza-rush-meter"><i></i></div></div>';
    this.fill = e.querySelector('i')!;
    parent.append(e);
  }
  update(fraction = 0) {
    const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    this.element.hidden = fraction <= 0;
    this.element.setAttribute('aria-valuenow', String(percent));
    this.fill.style.transform = `scaleX(${Math.max(0, fraction)})`;
  }
}
