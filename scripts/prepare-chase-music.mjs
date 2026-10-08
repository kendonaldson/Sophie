// Original 164 BPM chip-music loop. No samples or third-party recordings.
// Rebuild with: node scripts/prepare-chase-music.mjs (requires ffmpeg).
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const rate = 22050,
  bpm = 164,
  beat = 60 / bpm;
const length = Math.round(16 * 4 * beat * rate);
const samples = new Float64Array(length);
let seed = 391;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};
function voice(at, duration, amplitude, oscillator) {
  const start = Math.round(at * rate);
  for (let i = 0; i < duration * rate; i++) {
    const t = i / rate;
    const envelope = Math.min(1, t / 0.005) * Math.pow(1 - t / duration, 1.4);
    samples[(start + i) % length] += oscillator(t) * amplitude * envelope;
  }
}
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
const roots = [50, 50, 58, 57, 50, 53, 48, 57, 50, 50, 58, 57, 53, 48, 58, 57];
const melody = [0, 7, 12, 10, 7, 3, 5, 7];
for (let bar = 0; bar < 16; bar++) {
  const root = roots[bar];
  for (let step = 0; step < 16; step++) {
    const at = (bar * 4 + step / 4) * beat;
    if (step % 4 === 0 || step === 10)
      voice(at, 0.18, 0.5, (t) =>
        Math.sin(2 * Math.PI * (48 * t + 1.8 * (1 - Math.exp(-35 * t)))),
      );
    if (step === 4 || step === 12)
      voice(
        at,
        0.115,
        0.19,
        (t) => noise() * 0.75 + Math.sin(t * 2 * Math.PI * 180) * 0.25,
      );
    if (step % 2 === 0) voice(at, 0.035, 0.055, noise);
    if (step % 2 === 0) {
      const bass = hz(root - 12 + (step === 14 ? 7 : 0));
      voice(
        at,
        beat * 0.4,
        0.19,
        (t) => (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * bass * t)),
      );
      const note = hz(root + 12 + melody[(step / 2 + Math.floor(bar / 4)) % 8]);
      voice(
        at,
        beat * 0.43,
        0.07,
        (t) =>
          Math.sin(2 * Math.PI * note * t) +
          0.2 * Math.sin(2 * Math.PI * note * 3 * t),
      );
    }
    const arp = hz(root + [12, 15, 19, 24][step % 4]);
    voice(at, beat * 0.2, 0.032, (t) => Math.sin(2 * Math.PI * arp * t));
  }
}
const buffer = Buffer.alloc(44 + length * 2);
buffer.write('RIFF');
buffer.writeUInt32LE(buffer.length - 8, 4);
buffer.write('WAVEfmt ', 8);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(rate, 24);
buffer.writeUInt32LE(rate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(length * 2, 40);
for (let i = 0; i < length; i++)
  buffer.writeInt16LE(
    Math.round(Math.tanh(samples[i] * 1.3) * 27000),
    44 + i * 2,
  );
mkdirSync('work', { recursive: true });
writeFileSync('work/chase-loop.wav', buffer);
const result = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    '-i',
    'work/chase-loop.wav',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '128k',
    'public/assets/audio/chase-loop.mp3',
  ],
  { stdio: 'inherit' },
);
if (result.status !== 0)
  throw new Error(
    'ffmpeg failed; install it to rebuild this optional audio asset.',
  );
