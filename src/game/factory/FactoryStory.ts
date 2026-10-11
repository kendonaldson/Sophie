import type { SpeechLine } from '../../ui/SpeechBubble';
import { factoryTuning as t } from './config';

export const factoryDialogue = {
  opening: [
    { speaker: 'shelly', text: 'You owe me for that pizza!' },
    { speaker: 'sophie', text: "We're dogs.\nWe don't have any money." },
    { speaker: 'jimmy', text: "I don't think that's helping." },
    { speaker: 'shelly', text: 'Then stop stealing pizza!' },
  ],
  midpoint: [
    { speaker: 'shelly', text: "That's enough." },
    { speaker: 'shelly', text: "You're not getting away with my pizza." },
  ],
  final: [
    {
      speaker: 'shelly',
      text: 'Nobody steals a pizza and runs through my entire kitchen!',
    },
    {
      speaker: 'jimmy',
      text: "Technically, we've been running through most of the restaurant.",
    },
    { speaker: 'shelly', text: "Don't even think about it." },
  ],
  outro: [
    { speaker: 'shelly', text: 'Would you two PLEASE stop?!' },
    { speaker: 'sophie', text: 'Sorry! I really like pizza.' },
    { speaker: 'jimmy', text: "..." },
  ],
} as const satisfies Record<string, readonly SpeechLine[]>;
export type FactoryPhase =
  | 'opening'
  | 'chase'
  | 'midpoint-dialogue'
  | 'midpoint'
  | 'midpoint-spin'
  | 'second-half'
  | 'final-dialogue'
  | 'final'
  | 'final-spin'
  | 'outro'
  | 'escape'
  | 'empty'
  | 'fade'
  | 'complete';
/** Story beats only; no gameplay physics or colliders live here. */
export class FactoryStory {
  phase: FactoryPhase = 'opening';
  elapsed = 0;
  lineIndex = 0;
  midpointSeen = false;
  finalSeen = false;
  private get lines() {
    return this.phase === 'opening'
      ? factoryDialogue.opening
      : this.phase === 'midpoint-dialogue'
        ? factoryDialogue.midpoint
        : this.phase === 'final-dialogue'
          ? factoryDialogue.final
          : this.phase === 'outro'
            ? factoryDialogue.outro
            : undefined;
  }
  get line(): SpeechLine | undefined {
    return this.lines?.[this.lineIndex];
  }
  get scripted() {
    return !['chase', 'midpoint', 'second-half', 'final'].includes(this.phase);
  }
  get fade() {
    return this.phase === 'complete'
      ? 1
      : this.phase === 'fade'
        ? this.elapsed / t.fadeMs
        : 0;
  }
  enter(phase: FactoryPhase) {
    this.phase = phase;
    this.elapsed = 0;
    this.lineIndex = 0;
  }
  midpoint() {
    this.enter(this.midpointSeen ? 'midpoint' : 'midpoint-dialogue');
    this.midpointSeen = true;
  }
  final() {
    this.enter(this.finalSeen ? 'final' : 'final-dialogue');
    this.finalSeen = true;
  }
  reset(afterMidpoint: boolean) {
    this.enter(afterMidpoint ? 'second-half' : 'chase');
  }
  tick(ms: number) {
    let remaining = Math.max(0, ms);
    while (remaining > 0 && this.scripted && this.phase !== 'complete') {
      const line = this.line;
      const duration = line
        ? Math.max(1900, line.text.length * 43 + 850) +
          (this.phase === 'opening' && this.lineIndex === 1 ? 350 : 0)
        : this.phase === 'midpoint-spin'
          ? t.midpointSpinMs
          : this.phase === 'final-spin'
            ? t.finalSpinMs
            : this.phase === 'escape'
              ? t.escapeMs
              : this.phase === 'empty'
                ? t.emptyMs
                : t.fadeMs;
      const step = Math.min(remaining, duration - this.elapsed);
      this.elapsed += step;
      remaining -= step;
      if (this.elapsed + 1e-6 < duration) break;
      this.elapsed = 0;
      if (this.lines && this.lineIndex + 1 < this.lines.length) {
        this.lineIndex++;
        continue;
      }
      this.enter(
        this.phase === 'opening'
          ? 'chase'
          : this.phase === 'midpoint-dialogue'
            ? 'midpoint'
            : this.phase === 'midpoint-spin'
              ? 'second-half'
              : this.phase === 'final-dialogue'
                ? 'final'
                : this.phase === 'final-spin'
                  ? 'outro'
                  : this.phase === 'outro'
                    ? 'escape'
                    : this.phase === 'escape'
                      ? 'empty'
                      : this.phase === 'empty'
                        ? 'fade'
                        : 'complete',
      );
    }
  }
}
