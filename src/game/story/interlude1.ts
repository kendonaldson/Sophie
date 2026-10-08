export type StorySpeaker = 'sophie' | 'jimmy' | 'offscreen';
export interface StoryLine {
  speaker: StorySpeaker;
  text: string;
  cue?: 'town' | 'together' | 'alert' | 'walk' | 'escape';
  pauseBeforeMs?: number;
}
export const interlude1 = {
  id: 'interlude-1',
  name: 'Interlude 1',
  title: 'A little fresh air',
  width: 640,
  height: 360,
  feetY: 284,
  sophieX: 280,
  jimmyX: 368,
  spriteScale: 1.5,
  fadeInMs: 650,
  minimumLineMs: 220,
  walkSpeed: 18,
  walkDistance: 70,
  escapeReactionMs: 450,
  escapeStartSpeed: 60,
  escapeAcceleration: 2400,
  escapeSpeed: 620,
  exitMargin: 56,
  clearFrameMs: 180,
  fadeOutMs: 750,
} as const;
export const interludeLines: readonly StoryLine[] = [
  {
    speaker: 'sophie',
    text: 'Thanks for the help back there.\nI had no idea you were so good at jumping.',
  },
  { speaker: 'jimmy', text: "I've practiced a lot." },
  {
    speaker: 'sophie',
    text: 'I think if we stick together, we can accomplish our mission.',
  },
  { speaker: 'jimmy', text: 'What is our mission, anyway?' },
  {
    speaker: 'jimmy',
    text: "I'm still not sure why we left home.\nIt's pretty comfortable there.",
  },
  { speaker: 'sophie', text: "Can't you smell it?", cue: 'town' },
  { speaker: 'sophie', text: 'This whole town is full of delicious food.' },
  { speaker: 'sophie', text: 'Pizza. Hot dogs. Pancakes.' },
  { speaker: 'sophie', text: "It's ours for the taking." },
  {
    speaker: 'jimmy',
    text: 'That sounds less like a mission and more like stealing food.',
    cue: 'together',
  },
  {
    speaker: 'sophie',
    text: "Don't worry.\nWe'll be home before anyone gets back from school.",
  },
  { speaker: 'jimmy', text: 'Okay.', pauseBeforeMs: 650 },
  { speaker: 'jimmy', text: 'Where next?' },
  {
    speaker: 'offscreen',
    text: "Why aren't those dogs on leashes?",
    pauseBeforeMs: 700,
    cue: 'alert',
  },
  { speaker: 'offscreen', text: 'Come here, you two!', cue: 'walk' },
  { speaker: 'offscreen', text: 'Hey!' },
  { speaker: 'offscreen', text: 'Stop! Come here!', pauseBeforeMs: 250 },
  { speaker: 'sophie', text: "Run! It's the police!", cue: 'escape' },
];
