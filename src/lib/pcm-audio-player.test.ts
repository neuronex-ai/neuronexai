import { describe, expect, it } from 'vitest';

import { analysePcm16 } from './pcm-audio-player';

const sinePcm = (frequency: number, sampleRate = 24000, durationMs = 40) => {
  const sampleCount = Math.round(sampleRate * durationMs / 1000);
  const pcm = new Int16Array(sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    pcm[index] = Math.round(Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0x4fff);
  }
  return pcm.buffer;
};

describe('analysePcm16', () => {
  it('extracts real RMS and low-frequency energy from microphone or playback PCM', () => {
    const signal = analysePcm16(sinePcm(110), 24000);
    expect(signal.rms).toBeGreaterThan(0.2);
    expect(signal.low).toBeGreaterThan(signal.high);
  });

  it('returns a silent signal for an empty buffer', () => {
    expect(analysePcm16(new ArrayBuffer(0), 24000)).toEqual({ rms: 0, low: 0, mid: 0, high: 0 });
  });
});
