export function tuningFromFrequency(frequency: number, reference = 440) {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const exactNote = 69 + 12 * Math.log2(frequency / reference);
  const midi = Math.round(exactNote);
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return { note: names[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1, cents: (exactNote - midi) * 100, frequency };
}

export const drumTracks = ['pulse', 'kick', 'snare', 'hat'] as const;
export type DrumTrack = typeof drumTracks[number];
export type DrumPattern = Record<DrumTrack, boolean[]>;
export type DrumKit = 'wood' | 'electronic' | 'studio';
export type RhythmConfig = { bpm: number; beats: number; subdivision: number; volume: number; kit: DrumKit; pattern: DrumPattern; muted: DrumTrack[] };
export type RhythmPreset = { config: RhythmConfig; drums: boolean };

export function readRhythmPreset(value: unknown): RhythmPreset | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const { bpm, beats, subdivision, volume, kit, pattern, muted, drums } = row;
  if (typeof bpm !== 'number' || !Number.isInteger(bpm) || bpm < 30 || bpm > 240
    || typeof beats !== 'number' || ![2, 3, 4, 6, 7].includes(beats)
    || typeof subdivision !== 'number' || ![1, 2, 4].includes(subdivision)
    || typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0 || volume > 1
    || typeof kit !== 'string' || !['wood', 'electronic', 'studio'].includes(kit)
    || typeof drums !== 'boolean' || !pattern || typeof pattern !== 'object'
    || !Array.isArray(muted) || !muted.every((track) => drumTracks.includes(track))) return null;
  const tracks = pattern as Record<string, unknown>;
  if (!drumTracks.every((track) => Array.isArray(tracks[track])
    && tracks[track].length === beats * subdivision && tracks[track].every((step) => typeof step === 'boolean'))) return null;
  return { drums, config: { bpm, beats, subdivision, volume, kit: kit as DrumKit, pattern: tracks as DrumPattern, muted: muted as DrumTrack[] } };
}

export function rhythmConfigKey(config: RhythmConfig, drums: boolean) {
  return JSON.stringify([drums, config.bpm, config.beats, config.subdivision, config.volume, config.kit,
    drumTracks.map((track) => config.pattern[track]), drumTracks.map((track) => config.muted.includes(track))]);
}

export function createPattern(beats: number, subdivision: number, drums: boolean): DrumPattern {
  const steps = Array.from({ length: beats * subdivision }, (_, index) => index);
  return {
    pulse: steps.map((step) => !drums && step % subdivision === 0),
    kick: steps.map((step) => drums && step % (subdivision * 2) === 0),
    snare: steps.map((step) => drums && step % (subdivision * 2) === subdivision),
    hat: steps.map(() => drums),
  };
}

export class DrumTransport {
  private context: AudioContext;
  private output: GainNode;
  private noise: AudioBuffer;
  private timer: ReturnType<typeof setInterval> | undefined;
  private frame = 0;
  private nextTime = 0;
  private nextStep = 0;
  private queue: { time: number; step: number }[] = [];
  private config: RhythmConfig;
  private onStep: (step: number) => void;

  constructor(context: AudioContext, config: RhythmConfig, onStep: (step: number) => void) {
    this.context = context;
    this.config = config;
    this.onStep = onStep;
    this.output = context.createGain();
    this.output.gain.value = config.volume;
    this.output.connect(context.destination);
    this.noise = context.createBuffer(1, context.sampleRate * 0.2, context.sampleRate);
    const samples = this.noise.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
  }

  configure(config: RhythmConfig) {
    this.config = config;
    this.output.gain.setTargetAtTime(config.volume, this.context.currentTime, 0.01);
  }

  async start() {
    await this.context.resume();
    if (this.context.state === 'closed') return;
    this.nextTime = this.context.currentTime + 0.05;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 25);
    const paint = () => {
      while (this.queue.length && this.queue[0].time <= this.context.currentTime) this.onStep(this.queue.shift()!.step);
      this.frame = requestAnimationFrame(paint);
    };
    this.frame = requestAnimationFrame(paint);
  }

  private schedule() {
    const { bpm, beats, subdivision, pattern, muted } = this.config;
    while (this.nextTime < this.context.currentTime + 0.1) {
      const step = this.nextStep % (beats * subdivision);
      for (const track of drumTracks) {
        if (pattern[track][step] && !muted.includes(track)) this.hit(track, this.nextTime, step === 0);
      }
      this.queue.push({ time: this.nextTime, step });
      this.nextTime += 60 / bpm / subdivision;
      this.nextStep = step + 1;
    }
  }

  private hit(track: DrumTrack, time: number, accent: boolean) {
    const envelope = this.context.createGain();
    const duration = track === 'kick' ? 0.18 : track === 'snare' ? 0.12 : 0.045;
    envelope.gain.setValueAtTime(track === 'hat' ? 0.16 : 0.65, time);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    envelope.connect(this.output);
    let source: OscillatorNode | AudioBufferSourceNode;
    if (track === 'snare' || track === 'hat') {
      const noise = this.context.createBufferSource();
      noise.buffer = this.noise;
      const filter = this.context.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = track === 'hat' ? 7000 : 1400;
      noise.connect(filter);
      filter.connect(envelope);
      noise.onended = () => { filter.disconnect(); envelope.disconnect(); };
      source = noise;
    } else {
      const tone = this.context.createOscillator();
      tone.type = this.config.kit === 'electronic' ? 'square' : 'sine';
      const pitch = track === 'kick' ? (this.config.kit === 'studio' ? 140 : 100)
        : (accent ? 1400 : 950) * (this.config.kit === 'wood' ? 0.65 : 1);
      tone.frequency.setValueAtTime(pitch, time);
      tone.frequency.exponentialRampToValueAtTime(track === 'kick' ? 42 : pitch * 0.6, time + duration);
      tone.connect(envelope);
      tone.onended = () => envelope.disconnect();
      source = tone;
    }
    source.start(time);
    source.stop(time + duration);
  }

  stop() {
    clearInterval(this.timer);
    cancelAnimationFrame(this.frame);
    this.queue = [];
    this.output.disconnect();
    if (this.context.state !== 'closed') void this.context.close().catch(() => {});
  }
}