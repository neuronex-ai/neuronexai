class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];

      for (let i = 0; i < channelData.length; i += 1) {
        this.buffer[this.bufferIndex] = channelData[i];
        this.bufferIndex += 1;

        if (this.bufferIndex >= this.bufferSize) {
          const pcm16 = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j += 1) {
            pcm16[j] = Math.max(-32768, Math.min(32767, Math.floor(this.buffer[j] * 32768)));
          }
          this.port.postMessage({ type: "audio", data: pcm16.buffer }, [pcm16.buffer]);
          this.bufferIndex = 0;
        }
      }

      let sum = 0;
      for (let i = 0; i < channelData.length; i += 1) {
        sum += Math.abs(channelData[i]);
      }
      this.port.postMessage({ type: "intensity", value: Math.min(1, (sum / channelData.length) * 10) });
    }
    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);
