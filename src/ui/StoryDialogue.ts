import { readGameplayMode } from './mobile/capabilities';
import type { StoryLine } from '../game/story/interlude1';
import type { SfxOutput } from '../game/audio/Sfx';
import { DialogueReveal } from './DialogueReveal';
export class StoryDialogue {
  private readonly root = document.createElement('div');
  private readonly bubble = document.createElement('section');
  private readonly label = document.createElement('strong');
  private readonly text = document.createElement('p');
  private readonly next = document.createElement('button');
  private readonly media = matchMedia('(pointer: coarse)');
  private rotate?: HTMLElement;
  private line?: StoryLine;
  private readonly reveal: DialogueReveal;
  constructor(
    private readonly host: HTMLElement,
    onAdvance: () => void,
    private readonly onOrientation: (blocked: boolean) => void,
    sfx: SfxOutput,
  ) {
    this.reveal = new DialogueReveal(sfx);
    this.root.className = 'story-ui';
    this.bubble.className = 'story-bubble';
    this.bubble.setAttribute('role', 'status');
    this.bubble.setAttribute('aria-live', 'polite');
    this.bubble.setAttribute('aria-atomic', 'true');
    this.bubble.append(this.label, this.text);
    this.text.setAttribute('aria-hidden', 'true');
    this.next.className = 'story-next';
    this.next.type = 'button';
    this.next.textContent = 'Continue · X';
    this.next.addEventListener('click', () => {
      onAdvance();
      this.next.blur();
    });
    this.root.append(this.bubble, this.next);
    host.append(this.root);
    document.querySelector('#app')!.classList.add('story-mode');
    window.addEventListener('resize', this.refresh);
    this.media.addEventListener('change', this.refresh);
    this.refresh();
  }
  private refresh = () => {
    const mode = readGameplayMode();
    const app = document.querySelector('#app')!;
    app.classList.toggle('mobile-landscape', mode === 'mobile-landscape');
    app.classList.toggle('mobile-portrait', mode === 'mobile-portrait');
    this.rotate?.remove();
    this.rotate = undefined;
    if (mode === 'mobile-portrait') {
      this.rotate = document.createElement('div');
      this.rotate.className = 'rotate-overlay';
      this.rotate.innerHTML =
        '<span class="rotate-symbol" aria-hidden="true">↻</span><h1>Rotate your device to play</h1><p>Landscape gives Sophie room to run.</p>';
      this.host.append(this.rotate);
    }
    this.onOrientation(mode === 'mobile-portrait');
  };
  show(line: StoryLine | undefined, canAdvance: boolean) {
    this.bubble.hidden = !line;
    this.next.hidden = !line || line.cue === 'escape';
    this.next.disabled = !canAdvance;
    if (line === this.line) return;
    this.line = line;
    this.reveal.set(line?.text, line?.speaker);
    this.text.textContent = '';
    if (!line) return;
    this.bubble.setAttribute('aria-label', `${line.speaker}: ${line.text}`);
    this.bubble.dataset.speaker = line.speaker;
    this.label.textContent =
      line.speaker === 'offscreen'
        ? 'A VOICE FROM OFF-SCREEN'
        : line.speaker.toUpperCase();
  }
  revealText(ms: number) {
    if (this.line) this.text.textContent = this.reveal.tick(ms);
  }
  anchor(x: number, headY: number) {
    if (this.line?.speaker === 'offscreen') {
      this.bubble.style.left = '18px';
      this.bubble.style.bottom = 'auto';
      this.bubble.style.top = '18%';
      return;
    }
    const left = Math.max(
      12,
      Math.min(
        this.host.clientWidth - this.bubble.offsetWidth - 12,
        x - this.bubble.offsetWidth / 2,
      ),
    );
    this.bubble.style.left = `${left}px`;
    this.bubble.style.top = 'auto';
    this.bubble.style.bottom = `${this.host.clientHeight - headY + 12}px`;
    this.bubble.style.setProperty(
      '--tail-x',
      `${Math.max(16, Math.min(this.bubble.offsetWidth - 16, x - left))}px`,
    );
  }
  destroy() {
    this.reveal.set();
    window.removeEventListener('resize', this.refresh);
    this.media.removeEventListener('change', this.refresh);
    this.root.remove();
    this.rotate?.remove();
    document
      .querySelector('#app')!
      .classList.remove('story-mode', 'mobile-landscape', 'mobile-portrait');
  }
}
