export interface SpeechLine {
  speaker: 'sophie' | 'jimmy' | 'offscreen';
  text: string;
}
/** Shared native-resolution dialogue; off-screen speakers never need a world entity. */
export class SpeechBubble {
  readonly element = document.createElement('section');
  private readonly label = document.createElement('strong');
  private readonly text = document.createElement('p');
  private line?: SpeechLine;
  constructor(
    private readonly host: HTMLElement,
    parent: HTMLElement,
  ) {
    this.element.className = 'story-bubble';
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-live', 'polite');
    this.element.setAttribute('aria-atomic', 'true');
    this.element.append(this.label, this.text);
    parent.append(this.element);
  }
  show(line?: SpeechLine) {
    this.element.hidden = !line;
    if (
      !line ||
      (line.text === this.line?.text && line.speaker === this.line.speaker)
    )
      return;
    this.line = line;
    this.element.dataset.speaker = line.speaker;
    this.label.textContent =
      line.speaker === 'offscreen'
        ? 'A VOICE FROM OFF-SCREEN'
        : line.speaker.toUpperCase();
    this.text.textContent = line.text;
  }
  anchor(x: number, headY: number) {
    const bubble = this.element;
    if (this.line?.speaker === 'offscreen') {
      bubble.style.left = '18px';
      bubble.style.bottom = 'auto';
      bubble.style.top = '18%';
      return;
    }
    const left = Math.max(
      12,
      Math.min(
        this.host.clientWidth - bubble.offsetWidth - 12,
        x - bubble.offsetWidth / 2,
      ),
    );
    bubble.style.left = `${left}px`;
    bubble.style.top = 'auto';
    bubble.style.bottom = `${this.host.clientHeight - headY + 12}px`;
    bubble.style.setProperty(
      '--tail-x',
      `${Math.max(16, Math.min(bubble.offsetWidth - 16, x - left))}px`,
    );
  }
}
