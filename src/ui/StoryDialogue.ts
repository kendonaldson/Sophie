import type { SfxOutput } from '../game/audio/Sfx';
import { SpeechBubble } from './SpeechBubble';
import { readGameplayMode } from './mobile/capabilities';
import type { StoryLine } from '../game/story/interlude1';
export class StoryDialogue {
  private readonly root = document.createElement('div');
  private readonly bubble: SpeechBubble;
  private readonly next = document.createElement('button');
  private readonly media = matchMedia('(pointer: coarse)');
  private rotate?: HTMLElement;
  constructor(
    private readonly host: HTMLElement,
    onAdvance: () => void,
    private readonly onOrientation: (blocked: boolean) => void,
    sfx: SfxOutput,
  ) {
    this.root.className = 'story-ui';
    this.bubble = new SpeechBubble(host, this.root, sfx);
    this.next.className = 'story-next';
    this.next.type = 'button';
    this.next.textContent = 'Continue · X';
    this.next.addEventListener('click', () => {
      onAdvance();
      this.next.blur();
    });
    this.root.append(this.next);
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
    this.bubble.show(line);
    this.next.hidden = !line || line.cue === 'escape';
    this.next.disabled = !canAdvance;
  }
  revealText(ms: number) {
    this.bubble.revealText(ms);
  }
  anchor(x: number, headY: number) {
    this.bubble.anchor(x, headY);
  }
  destroy() {
    this.bubble.destroy();
    window.removeEventListener('resize', this.refresh);
    this.media.removeEventListener('change', this.refresh);
    this.root.remove();
    this.rotate?.remove();
    document
      .querySelector('#app')!
      .classList.remove('story-mode', 'mobile-landscape', 'mobile-portrait');
  }
}
