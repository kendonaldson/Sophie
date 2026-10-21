import type { SpeechLine } from '../../ui/SpeechBubble';

export const epilogue = {
  id: 'epilogue',
  name: 'Epilogue',
  title: 'Home, just in time',
  width: 640,
  height: 360,
  feetY: 286,
  spriteScale: 1.5,
  sophieX: 350,
  jimmyX: 265,
  exitX: 710,
  walkSpeed: 94,
  busEntryX: -180,
  busStopX: 320,
  busExitX: 820,
  fadeInMs: 700,
  fadeOutMs: 3000,
  music: 'assets/audio/returning-home.mp3',
  musicLoop: false,
  musicVolume: 0.25,
  punchlineVolume: 0.13,
} as const;

export const epilogueLines = [
  { speaker: 'lizzy', text: "I'm home!" },
  { speaker: 'paul', text: 'Jimmy?' },
  { speaker: 'paul', text: 'Where are you?' },
  { speaker: 'iris', text: 'Where are my puppies?' },
  { speaker: 'sophie', text: "Let's go find our humans." },
  { speaker: 'jimmy', text: 'Finally.' },
  { speaker: 'iris', text: 'Why does Sophie smell like pizza?' },
] as const satisfies readonly SpeechLine[];

const line = (index: number, durationMs: number) => ({
  id: `line-${index}` as const,
  phase: 'dialogue' as const,
  lineIndex: index,
  line: epilogueLines[index]!,
  durationMs,
});

/** Fixed, automatic reading holds. There is no skip or gameplay input. */
export const epilogueBeats = [
  { id: 'establish', phase: 'opening', durationMs: 1600 },
  { id: 'bus-arrive', phase: 'bus', durationMs: 3400 },
  { id: 'bus-stop', phase: 'bus', durationMs: 500 },
  { id: 'bus-door', phase: 'bus', durationMs: 2200 },
  { id: 'bus-close', phase: 'bus', durationMs: 450 },
  { id: 'bus-depart', phase: 'bus', durationMs: 2600 },
  { id: 'exterior-hold', phase: 'pause', durationMs: 600 },
  { id: 'inside-transition', phase: 'transition', durationMs: 650 },
  { id: 'bedroom', phase: 'arrival', durationMs: 2200 },
  line(0, 2600),
  { id: 'home-pause', phase: 'pause', durationMs: 500 },
  line(1, 2200),
  { id: 'call-pause', phase: 'pause', durationMs: 300 },
  line(2, 2700),
  { id: 'listen', phase: 'pause', durationMs: 600 },
  line(3, 3100),
  { id: 'turn', phase: 'pause', durationMs: 550 },
  line(4, 3400),
  line(5, 2200),
  {
    id: 'leave',
    phase: 'walk',
    durationMs:
      ((epilogue.exitX - epilogue.jimmyX) / epilogue.walkSpeed) * 1000,
  },
  { id: 'reunion', phase: 'clear', durationMs: 2600 },
  line(6, 4300),
  { id: 'silence', phase: 'pause', durationMs: 1800 },
  { id: 'fade', phase: 'fade', durationMs: epilogue.fadeOutMs },
] as const;
