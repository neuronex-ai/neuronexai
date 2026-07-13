type PlaybackCallback = () => void;

export type PcmAudioSignal = {
  rms: number;
  low: number;
  mid: number;
  high: number;
};

export const SILENT_PCM_SIGNAL: PcmAudioSignal = { rms: 0, low: 0, mid: 0, high: 0 };

const int16ToFloat32 = (buffer: ArrayBuffer) => {
  const view = new DataView(buffer);
  const samples = new Float32Array(Math.floor(buffer.byteLength / 2));
  for (let index = 0; index < samples.length; index += 1) {
    const value = view.getInt16(index * 2, true);
    samples[index] = Math.max(-1, Math.min(1, value / 32768));
  }
  return samples;
};

const goertzel = (samples: Float32Array, sampleRate: number, frequency: number) => {
  if (!samples.length) return 0;
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const coefficient = 2 * Math.cos(omega);
  let previous = 0;
  let beforePrevious = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const current = samples[index] + coefficient * previous - beforePrevious;
    beforePrevious = previous;
    previous = current;
  }
  const power = beforePrevious * beforePrevious + previous * previous - coefficient * previous * beforePrevious;
  return Math.sqrt(Math.max(0, power)) / Math.max(1, samples.length);
};

export const analysePcm16 = (buffer: ArrayBuffer, sampleRate: number): PcmAudioSignal => {
  const samples = int16ToFloat32(buffer);
  if (!samples.length) return SILENT_PCM_SIGNAL;
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
  const rms = Math.min(1, Math.sqrt(sum / samples.length) * 3.1);
  const normalise = (value: number) => Math.min(1, value * 13);
  return {
    rms,
    low: normalise((goertzel(samples, sampleRate, 110) + goertzel(samples, sampleRate, 240)) * 0.5),
    mid: normalise((goertzel(samples, sampleRate, 620) + goertzel(samples, sampleRate, 1180)) * 0.5),
    high: normalise((goertzel(samples, sampleRate, 2350) + goertzel(samples, sampleRate, 4100)) * 0.5),
  };
};

export class PcmAudioPlayer {
  private context: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private playing = false;
  private signalTimeline: Array<{ start: number; end: number; signal: PcmAudioSignal }> = [];

  constructor(
    private readonly sampleRate = 24000,
    private readonly onStart?: PlaybackCallback,
    private readonly onEnd?: PlaybackCallback,
  ) {}

  private ensureContext() {
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext({ sampleRate: this.sampleRate });
      this.nextStartTime = this.context.currentTime;
    }
    if (this.context.state === "suspended") void this.context.resume();
    return this.context;
  }

  enqueue(chunk: ArrayBuffer) {
    if (!chunk.byteLength) return;
    const context = this.ensureContext();
    const samples = int16ToFloat32(chunk);
    if (!samples.length) return;

    const audioBuffer = context.createBuffer(1, samples.length, this.sampleRate);
    audioBuffer.copyToChannel(samples, 0);

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    const signal = analysePcm16(chunk, this.sampleRate);

    if (!this.playing) {
      this.playing = true;
      this.onStart?.();
    }

    const startAt = Math.max(this.nextStartTime, context.currentTime + 0.012);
    source.start(startAt);
    this.nextStartTime = startAt + audioBuffer.duration;
    this.signalTimeline.push({ start: startAt, end: this.nextStartTime, signal });
    this.activeSources.add(source);

    source.onended = () => {
      this.activeSources.delete(source);
      this.signalTimeline = this.signalTimeline.filter((segment) => segment.end > context.currentTime);
      if (this.activeSources.size === 0) {
        this.playing = false;
        this.signalTimeline = [];
        this.nextStartTime = context.currentTime;
        this.onEnd?.();
      }
    };
  }

  stop() {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Source may already have ended.
      }
    }
    this.activeSources.clear();
    this.signalTimeline = [];
    if (this.context) this.nextStartTime = this.context.currentTime;
    if (this.playing) {
      this.playing = false;
      this.onEnd?.();
    }
  }

  getSignal() {
    if (!this.playing || !this.context) return SILENT_PCM_SIGNAL;
    const now = this.context.currentTime;
    return this.signalTimeline.find((segment) => segment.start <= now && segment.end > now)?.signal || SILENT_PCM_SIGNAL;
  }

  async close() {
    this.stop();
    if (this.context && this.context.state !== "closed") {
      await this.context.close();
    }
    this.context = null;
  }
}
