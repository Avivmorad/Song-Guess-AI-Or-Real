import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sampleRate = 22_050;
const durationSeconds = 18;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(root, "public", "audio");

const humanCompositions = [
  {
    bpm: 112,
    lead: [64, 67, 71, 67, 62, 64, 67, 69, 71, 69, 67, 64, 62, 64, 59, 62],
    bass: [40, 40, 43, 43, 38, 38, 35, 35],
    chords: [[52, 55, 59], [55, 59, 62], [50, 54, 57], [47, 50, 54]],
  },
  {
    bpm: 96,
    lead: [72, 71, 67, 64, 67, 69, 71, 74, 72, 69, 67, 64, 62, 64, 67, 64],
    bass: [45, 45, 41, 41, 43, 43, 40, 40],
    chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
  },
  {
    bpm: 124,
    lead: [67, 67, 70, 72, 67, 65, 63, 65, 67, 70, 72, 75, 74, 70, 67, 65],
    bass: [39, 39, 43, 43, 46, 46, 41, 41],
    chords: [[51, 55, 58], [55, 58, 62], [58, 62, 65], [53, 57, 60]],
  },
];

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function generateProceduralComposition(seed, bpm, rootNote) {
  const random = seededRandom(seed);
  const scale = [0, 2, 3, 5, 7, 8, 10, 12];
  const lead = [];
  let index = Math.floor(random() * 5);
  for (let step = 0; step < 16; step += 1) {
    const movement = random() < 0.2 ? 0 : random() < 0.56 ? 1 : -1;
    index = Math.max(0, Math.min(scale.length - 1, index + movement));
    lead.push(rootNote + scale[index] + (random() > 0.86 ? 12 : 0));
  }
  const roots = [0, 5, 3, 7].map((offset) => rootNote - 24 + offset);
  const bass = Array.from({ length: 8 }, (_, position) => {
    const root = roots[Math.floor(position / 2) % roots.length];
    return root + (random() > 0.72 ? 7 : 0);
  });
  const chords = roots.map((note) => [note + 12, note + 15, note + 19]);
  return { bpm, lead, bass, chords };
}

const proceduralCompositions = [
  generateProceduralComposition(0x51a7, 118, 64),
  generateProceduralComposition(0xc0ffee, 104, 62),
  generateProceduralComposition(0xdecade, 126, 65),
];

function midiToFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function envelope(position, length, attack = 0.08, release = 0.24) {
  const attackLevel = Math.min(1, position / Math.max(attack, 0.001));
  const releaseLevel = Math.min(1, (length - position) / Math.max(release, 0.001));
  return Math.max(0, Math.min(attackLevel, releaseLevel));
}

function oscillator(frequency, time, shape = "sine") {
  const phase = 2 * Math.PI * frequency * time;
  if (shape === "triangle") return (2 / Math.PI) * Math.asin(Math.sin(phase));
  if (shape === "soft-saw") {
    return 0.64 * Math.sin(phase) + 0.23 * Math.sin(phase * 2) + 0.13 * Math.sin(phase * 3);
  }
  return Math.sin(phase);
}

function renderComposition(composition, seed) {
  const sampleCount = sampleRate * durationSeconds;
  const samples = new Float64Array(sampleCount);
  const secondsPerBeat = 60 / composition.bpm;
  const noise = seededRandom(seed);

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const time = sampleIndex / sampleRate;
    const beat = time / secondsPerBeat;
    const halfBeatIndex = Math.floor(beat * 2);
    const leadNote = composition.lead[halfBeatIndex % composition.lead.length];
    const leadPosition = (beat * 2 - halfBeatIndex) * secondsPerBeat * 0.5;
    const leadLength = secondsPerBeat * (halfBeatIndex % 4 === 3 ? 0.92 : 0.46);
    let value =
      0.19 *
      oscillator(midiToFrequency(leadNote), time, "soft-saw") *
      envelope(leadPosition, leadLength, 0.025, 0.12);

    const bassIndex = Math.floor(beat);
    const bassPosition = (beat - bassIndex) * secondsPerBeat;
    const bassFrequency = midiToFrequency(composition.bass[bassIndex % composition.bass.length]);
    value +=
      0.24 *
      (0.82 * oscillator(bassFrequency, time) + 0.18 * oscillator(bassFrequency * 2, time)) *
      envelope(bassPosition, secondsPerBeat * 0.88, 0.02, 0.2);

    const chordIndex = Math.floor(beat / 4) % composition.chords.length;
    const chordPosition = (beat % 4) * secondsPerBeat;
    for (const note of composition.chords[chordIndex]) {
      value +=
        0.045 *
        oscillator(midiToFrequency(note), time, "triangle") *
        envelope(chordPosition, secondsPerBeat * 3.8, 0.5, 0.7);
    }

    const beatPosition = (beat - Math.floor(beat)) * secondsPerBeat;
    if (beatPosition < 0.16) {
      const kickFrequency = 48 + 88 * Math.exp(-beatPosition * 28);
      value += 0.31 * Math.sin(2 * Math.PI * kickFrequency * beatPosition) * Math.exp(-beatPosition * 18);
    }
    const halfPosition = ((beat + 0.5) - Math.floor(beat + 0.5)) * secondsPerBeat;
    if (Math.floor(beat) % 2 === 1 && beatPosition < 0.12) {
      value += 0.1 * (noise() * 2 - 1) * Math.exp(-beatPosition * 28);
    }
    if (halfPosition < 0.055) {
      value += 0.035 * (noise() * 2 - 1) * Math.exp(-halfPosition * 52);
    }

    const fadeIn = Math.min(1, time / 0.6);
    const fadeOut = Math.min(1, (durationSeconds - time) / 1.2);
    samples[sampleIndex] = Math.max(-1, Math.min(1, value * fadeIn * fadeOut));
  }

  return samples;
}

function encodeWav(samples) {
  const dataLength = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);
  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(Math.round(samples[index] * 0x7fff), 44 + index * 2);
  }
  return buffer;
}

await mkdir(outputDirectory, { recursive: true });
const compositions = [...humanCompositions, ...proceduralCompositions];
for (let index = 0; index < compositions.length; index += 1) {
  const filename = `track-${String(index + 1).padStart(3, "0")}.wav`;
  const samples = renderComposition(compositions[index], 9001 + index * 97);
  await writeFile(join(outputDirectory, filename), encodeWav(samples));
  process.stdout.write(`Generated ${filename}\n`);
}
