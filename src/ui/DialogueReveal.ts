import type { SfxOutput } from '../game/audio/Sfx';
import {
  isBoopCharacter,
  sfxConfig,
  type DialogueSpeaker,
} from '../game/audio/config';

/** Elapsed-time reveal; at most one immediate boop per tick, never a tone backlog. */
export class DialogueReveal {
  private characters: string[] = [];
  private speaker?: DialogueSpeaker;
  private elapsed = 0;
  private count = 0;
  constructor(
    private readonly sfx: Pick<SfxOutput, 'dialogueBoop' | 'stopDialogue'>,
    private readonly revealMs = sfxConfig.dialogue.revealMs,
  ) {}
  set(text = '', speaker?: DialogueSpeaker) {
    this.sfx.stopDialogue();
    this.characters = Array.from(text);
    this.speaker = speaker;
    this.elapsed = 0;
    this.count = 0;
  }
  tick(ms: number) {
    this.elapsed += Number.isFinite(ms) ? Math.max(0, ms) : 0;
    const previous = this.count;
    this.count = Math.min(
      this.characters.length,
      Math.floor(this.elapsed / Math.max(1, this.revealMs)),
    );
    const letter = this.characters
      .slice(previous, this.count)
      .find(isBoopCharacter);
    if (letter && this.speaker) this.sfx.dialogueBoop(this.speaker, letter);
    return this.characters.slice(0, this.count).join('');
  }
}
