import type { TutorialDefinition } from '../game/levels/types';
export const boneSvg = `<svg viewBox="0 0 28 16" aria-hidden="true" shape-rendering="crispEdges"><path d="M2 1h5v2h2v3h10V3h2V1h5v2h2v4h-2v2h2v4h-2v2h-5v-2h-2v-3H9v3H7v2H2v-2H0V9h2V7H0V3h2z" fill="currentColor"/></svg>`;
export class Hud {
  private readonly bones: HTMLElement[];
  private readonly hint: HTMLElement;
  private readonly section: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly overlayTitle: HTMLElement;
  private readonly overlayNote: HTMLElement;
  private readonly continueButton: HTMLButtonElement;
  private readonly fade: HTMLElement;
  private readonly tutorial: HTMLElement;
  private lastSection = '';
  private lastCharges = -1;
  constructor(root: HTMLElement) {
    root.innerHTML = `
      <header class="masthead"><a class="wordmark" href="./" aria-label="Sophie home">Sophie<span class="wordmark-dot">.</span></a><div class="chapter"><span class="eyebrow">A ROOFTOP ADVENTURE</span><span>Chapter 01 <i></i> Attic Escape</span></div><button id="pause" class="quiet-button" aria-label="Pause game"><span class="pause-icon" aria-hidden="true"></span><span class="button-label">Pause</span></button></header>
      <main><div class="game-shell"><div id="world" role="img" aria-label="Sophie, a dachshund, exploring neighborhood rooftops"></div>
      <div class="world-ui"><div class="location"><span class="location-dot"></span><span id="section">A little way out</span></div><div id="dash-hud" class="dash-hud" role="img" aria-label="1 of 2 dash charges available"><span class="eyebrow">DASH</span><div class="bones">${[0, 1].map((i) => `<span class="bone" data-bone="${i}"><span class="bone-empty">${boneSvg}</span><span class="bone-fill">${boneSvg}</span></span>`).join('')}</div></div></div>
      <section class="tutorial-card" aria-label="Traversal tutorial" aria-live="polite" hidden><h2></h2><ol></ol></section>
      <div class="vignette"></div><div id="fade"></div><div id="overlay" class="overlay" hidden><span class="eyebrow" id="overlay-note">TAKE YOUR TIME</span><h1 id="overlay-title">A little breather.</h1><button id="continue" class="primary-button">Keep exploring <span>→</span></button></div></div>
      <div class="below-world"><div class="hint-mark">✦</div><p id="hint">← → Move · Z / Space Jump</p><button id="retry" class="retry-button" title="Return to safe roof (R)">↺ <span>Try again</span></button></div></main>
      <footer><span>A little dog. A big way home.</span><div class="key-guide"><span><kbd>←</kbd><kbd>→</kbd> Move</span><span><kbd>Z</kbd> / <kbd>Space</kbd> Jump</span><span><kbd>X</kbd> Dash</span><span><kbd>Esc</kbd> Pause</span></div><span class="chapter-number">01 — 01</span></footer>
      <p class="keyboard-notice">Best played with a keyboard. Arrow keys · Z · X</p>`;
    this.bones = Array.from(root.querySelectorAll<HTMLElement>('.bone'));
    this.hint = root.querySelector('#hint')!;
    this.section = root.querySelector('#section')!;
    this.overlay = root.querySelector('#overlay')!;
    this.overlayTitle = root.querySelector('#overlay-title')!;
    this.overlayNote = root.querySelector('#overlay-note')!;
    this.continueButton = root.querySelector('#continue')!;
    this.fade = root.querySelector('#fade')!;
    this.tutorial = root.querySelector('.tutorial-card')!;
  }
  bind(onPause: () => void, onRetry: () => void, onContinue: () => void) {
    document.querySelector('#pause')!.addEventListener('click', () => {
      onPause();
      (document.activeElement as HTMLElement)?.blur();
    });
    document.querySelector('#retry')!.addEventListener('click', () => {
      onRetry();
      (document.activeElement as HTMLElement)?.blur();
    });
    this.continueButton.addEventListener('click', () => {
      onContinue();
      this.continueButton.blur();
    });
  }
  update(
    charges: number,
    recharge: number,
    grounded: boolean,
    title: string,
    hint: string,
    tutorial?: TutorialDefinition,
  ) {
    for (const [i, bone] of this.bones.entries()) {
      const filled = charges > i;
      bone.classList.toggle('available', filled);
      bone.style.setProperty(
        '--fill',
        `${filled ? 100 : i === 0 && charges === 0 && grounded ? recharge * 100 : 0}%`,
      );
    }
    if (charges !== this.lastCharges) {
      document
        .querySelector('#dash-hud')!
        .setAttribute('aria-label', `${charges} of 2 dash charges available`);
      this.lastCharges = charges;
    }
    if (title !== this.lastSection) {
      this.section.textContent = title;
      this.hint.textContent = hint;
      this.lastSection = title;
      this.tutorial.hidden = !tutorial;
      if (tutorial) {
        this.tutorial.querySelector('h2')!.textContent = tutorial.title;
        this.tutorial.querySelector('ol')!.replaceChildren(
          ...tutorial.steps.map((text) => {
            const step = document.createElement('li');
            step.textContent = text;
            return step;
          }),
        );
      }
    }
  }
  treatPop(charges: number) {
    const bone = this.bones[Math.max(0, charges - 1)];
    bone?.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.45)', filter: 'brightness(1.7)' },
        { transform: 'scale(1)' },
      ],
      { duration: 330, easing: 'ease-out' },
    );
  }
  setFade(opacity: number) {
    this.fade.style.opacity = String(opacity);
  }
  showPause(paused: boolean) {
    this.overlay.hidden = !paused;
    this.overlay.classList.remove('ending');
    this.overlayNote.textContent = 'TAKE YOUR TIME';
    this.overlayTitle.textContent = 'A little breather.';
    this.continueButton.innerHTML = 'Keep exploring <span>→</span>';
    document
      .querySelector('#pause')!
      .setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  }
  showEnding() {
    this.overlay.hidden = false;
    this.overlay.classList.add('ending');
    this.overlayNote.textContent = 'SOPHIE WILL BE BACK';
    this.overlayTitle.textContent = 'TO BE CONTINUED';
    this.continueButton.innerHTML = 'Play again <span>↺</span>';
  }
}
