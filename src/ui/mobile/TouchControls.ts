import {
  noInput,
  type InputSource,
  type PlayerIntent,
} from '../../game/input/Input';
import { readGameplayMode, type GameplayMode } from './capabilities';
const padDirections = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;
/** Pointer capture keeps drag aiming and simultaneous movement/jump/dash reliable. */
export class TouchControls implements InputSource {
  private root: HTMLElement | null = null;
  private currentMode: GameplayMode = 'desktop';
  private directionPointer: number | null = null;
  private actions = new Map<number, 'jump' | 'dash'>();
  private intent = noInput();
  private pad: HTMLElement | null = null;
  private readonly pointerMedia = matchMedia('(pointer: coarse)');
  constructor(
    private readonly host: HTMLElement,
    private readonly onModeChange: (mode: GameplayMode) => void,
  ) {
    window.addEventListener('resize', this.refresh);
    window.addEventListener('blur', this.clear);
    this.pointerMedia.addEventListener('change', this.refresh);
    this.refresh();
  }
  private refresh = () => {
    const mode = readGameplayMode();
    if (mode === this.currentMode && (mode === 'desktop' || this.root)) return;
    this.clear();
    this.root?.remove();
    this.root = null;
    this.pad = null;
    this.currentMode = mode;
    const app = document.querySelector('#app')!;
    app.classList.toggle('mobile-landscape', mode === 'mobile-landscape');
    app.classList.toggle('mobile-portrait', mode === 'mobile-portrait');
    if (mode === 'mobile-portrait') {
      this.root = document.createElement('div');
      this.root.className = 'rotate-overlay';
      this.root.setAttribute('role', 'status');
      this.root.innerHTML =
        '<span class="rotate-symbol" aria-hidden="true">↻</span><h1>Rotate your device to play</h1><p>Landscape gives Sophie room to run.</p>';
      this.host.append(this.root);
    } else if (mode === 'mobile-landscape') this.mountController();
    this.onModeChange(mode);
  };
  private mountController() {
    this.root = document.createElement('div');
    this.root.className = 'touch-controls';
    this.root.setAttribute('aria-label', 'Touch controller');
    this.root.innerHTML = `
      <div class="touch-pad" role="group" aria-label="Movement and eight-direction dash aim">
        ${padDirections
          .map(
            ([x, y]) => `
          <span class="pad-direction" data-x="${x}" data-y="${y}" style="grid-area: ${y + 2} / ${x + 2}" aria-hidden="true">
            <svg viewBox="0 0 24 24" style="transform: rotate(${(Math.atan2(y, x) * 180) / Math.PI + 90}deg)"><path d="M12 20V4M5 11l7-7 7 7"/></svg>
          </span>`,
          )
          .join('')}
        <span class="pad-dot" aria-hidden="true"></span>
      </div>
      <div class="touch-actions"><button class="touch-button touch-jump" aria-label="Jump"><b>Z</b><span>JUMP</span></button><button class="touch-button touch-dash" aria-label="Dash"><b>X</b><span>DASH</span></button></div>`;
    this.host.append(this.root);
    this.pad = this.root.querySelector('.touch-pad');
    this.pad!.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (this.directionPointer !== null) return;
      this.directionPointer = event.pointerId;
      this.pad!.setPointerCapture(event.pointerId);
      this.aim(event);
    });
    this.pad!.addEventListener('pointermove', (event) => {
      if (event.pointerId === this.directionPointer) {
        event.preventDefault();
        this.aim(event);
      }
    });
    const stop = (event: PointerEvent) => {
      if (event.pointerId === this.directionPointer) {
        this.directionPointer = null;
        this.intent.moveX = 0;
        this.intent.aimY = 0;
        this.updatePad();
      }
    };
    for (const event of [
      'pointerup',
      'pointercancel',
      'lostpointercapture',
    ] as const)
      this.pad!.addEventListener(event, stop);
    this.bindActions(this.root.querySelector('.touch-actions')!);
  }
  private aim(event: PointerEvent) {
    const box = this.pad!.getBoundingClientRect(),
      dx = (event.clientX - box.x - box.width / 2) / (box.width / 2),
      dy = (event.clientY - box.y - box.height / 2) / (box.height / 2);
    const angle =
      (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4;
    const active = Math.hypot(dx, dy) > 0.2;
    this.intent.moveX = active
      ? (Math.round(Math.cos(angle)) as -1 | 0 | 1)
      : 0;
    this.intent.aimY = active ? (Math.round(Math.sin(angle)) as -1 | 0 | 1) : 0;
    this.updatePad();
  }
  private updatePad() {
    const { moveX, aimY } = this.intent;
    this.pad?.style.setProperty('--stick-x', `${moveX * 12}px`);
    this.pad?.style.setProperty('--stick-y', `${aimY * 12}px`);
    this.pad
      ?.querySelectorAll<HTMLElement>('.pad-direction')
      .forEach((arrow) => {
        arrow.classList.toggle(
          'active',
          Number(arrow.dataset.x) === moveX && Number(arrow.dataset.y) === aimY,
        );
      });
  }
  private bindActions(surface: HTMLElement) {
    const jump = surface.querySelector<HTMLButtonElement>('.touch-jump')!;
    const dash = surface.querySelector<HTMLButtonElement>('.touch-dash')!;
    const update = () => {
      const held = [...this.actions.values()];
      this.intent.jumpHeld = held.includes('jump');
      jump.classList.toggle('pressed', this.intent.jumpHeld);
      dash.classList.toggle('pressed', held.includes('dash'));
    };
    const activate = (id: number, kind: 'jump' | 'dash') => {
      if (this.actions.get(id) === kind) return;
      this.actions.set(id, kind);
      if (kind === 'jump') this.intent.jumpPressed = true;
      else this.intent.dashPressed = true;
      update();
    };
    surface.addEventListener('pointerdown', (event) => {
      const button = (event.target as HTMLElement).closest('button');
      if (button !== jump && button !== dash) return;
      event.preventDefault();
      surface.setPointerCapture(event.pointerId);
      activate(event.pointerId, button === jump ? 'jump' : 'dash');
    });
    surface.addEventListener('pointermove', (event) => {
      if (!this.actions.has(event.pointerId)) return;
      event.preventDefault();
      // Crossing into the other button activates it without lifting a thumb.
      // Keep the current action through the gap and outside the controls.
      for (const [button, kind] of [
        [jump, 'jump'],
        [dash, 'dash'],
      ] as const) {
        const box = button.getBoundingClientRect();
        if (
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom
        ) {
          activate(event.pointerId, kind);
          break;
        }
      }
    });
    const stop = (event: PointerEvent) => {
      this.actions.delete(event.pointerId);
      update();
    };
    for (const event of [
      'pointerup',
      'pointercancel',
      'lostpointercapture',
    ] as const)
      surface.addEventListener(event, stop);
  }
  sample(): PlayerIntent {
    const intent = { ...this.intent };
    this.intent.jumpPressed = false;
    this.intent.dashPressed = false;
    return intent;
  }
  clear = () => {
    this.intent = noInput();
    this.directionPointer = null;
    this.actions.clear();
    this.root
      ?.querySelectorAll('.pressed')
      .forEach((b) => b.classList.remove('pressed'));
    this.updatePad();
  };
  destroy() {
    window.removeEventListener('resize', this.refresh);
    window.removeEventListener('blur', this.clear);
    this.pointerMedia.removeEventListener('change', this.refresh);
    this.root?.remove();
    this.root = null;
    document
      .querySelector('#app')
      ?.classList.remove('mobile-landscape', 'mobile-portrait');
  }
}
