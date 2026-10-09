import { sfxConfig } from '../audio/config';
import type { SpeechLine } from '../../ui/SpeechBubble';
export const interlude2 = {
  id: 'interlude-2',
  name: 'Interlude 2',
  title: 'One balloon',
  width: 640,
  height: 360,
  feetY: 284,
  spriteScale: 1.5,
  liftX: 78,
  liftWidth: 112,
  roofX: 190,
  roofWidth: 366,
  sophieLiftX: 151,
  jimmyLiftX: 116,
  sophieEdgeX: 490,
  jimmyRestX: 398,
  sophieSleepX: 332,
  jimmyReadyX: 462,
  arrivalMs: 1100,
  fadeInMs: 650,
  stepOffMs: 4200,
  minimumLineMs: 220,
  returnMs: 1800,
  sleepHoldMs: 1800,
  nightFadeMs: 1100,
  overnightMs: 700,
  morningFadeMs: 1400,
  morningSleepMs: 900,
  edgeWalkMs: 1500,
  joinMs: 1100,
  readyMs: 420,
  crouchMs: 420,
  launchMs: sfxConfig.jimmySuperJump.launchMs,
  emptyMs: 900,
  endingFadeMs: 900,
} as const;
export interface RooftopLine extends SpeechLine {
  pauseBeforeMs?: number;
  cue?: 'edge' | 'wake-jimmy' | 'stand-jimmy';
}
export const rooftopNightLines: readonly RooftopLine[] = [
  { speaker: 'jimmy', text: "We're not going to find food up here." },
  { speaker: 'sophie', text: 'Maybe somebody left a lunch.' },
  { speaker: 'jimmy', text: 'On top of a skyscraper?' },
  { speaker: 'sophie', text: 'You never know.' },
  {
    speaker: 'jimmy',
    text: "I'm tired.\nI want to go home.",
    pauseBeforeMs: 700,
  },
  {
    speaker: 'sophie',
    text: "But we're finally high enough to see the whole city.",
  },
  { speaker: 'sophie', text: 'Hamburgers. Chicken nuggets. Chow mein.' },
  { speaker: 'sophie', text: "It's all down there." },
  { speaker: 'jimmy', text: "You mean the food we're going to steal." },
  {
    speaker: 'sophie',
    text: 'Our mission can wait until morning.',
    pauseBeforeMs: 700,
  },
  { speaker: 'jimmy', text: "Best idea you've had all day." },
];
export const rooftopMorningLines: readonly RooftopLine[] = [
  { speaker: 'sophie', text: 'Jimmy!' },
  { speaker: 'sophie', text: 'Jimmy!', pauseBeforeMs: 400 },
  { speaker: 'jimmy', text: 'What?', cue: 'wake-jimmy' },
  { speaker: 'sophie', text: 'Look! Balloons!' },
  { speaker: 'jimmy', text: 'No.', pauseBeforeMs: 700 },
  { speaker: 'sophie', text: "I haven't said anything yet." },
  { speaker: 'jimmy', text: 'I know you.' },
  { speaker: 'sophie', text: 'You can jump us onto one.', cue: 'edge' },
  { speaker: 'sophie', text: 'Then we ride it back down to the food.' },
  { speaker: 'jimmy', text: 'Or we could go home.', cue: 'stand-jimmy' },
  {
    speaker: 'sophie',
    text: "I promise I'll get you home before Paul gets back.",
  },
  { speaker: 'jimmy', text: 'One balloon.', pauseBeforeMs: 700 },
  { speaker: 'sophie', text: "That's the spirit!" },
  { speaker: 'jimmy', text: "No, it isn't." },
];
export const rooftopLines = [
  ...rooftopNightLines,
  ...rooftopMorningLines,
] as const;
