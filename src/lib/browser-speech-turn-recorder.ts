export interface SpeechTurnRecorderOptions {
  signal?: AbortSignal;
  silenceMs?: number;
  maxDurationMs?: number;
  onLevel?: (level: number) => void;
  noiseSuppression?: boolean;
}

const preferredMimeType = () => {
  if (typeof MediaRecorder === "undefined") return "";
  return [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
};

export async function recordSpeechTurn({
  signal,
  silenceMs = 900,
  maxDurationMs = 20_000,
  onLevel,
  noiseSuppression = false,
}: SpeechTurnRecorderOptions = {}): Promise<Blob | null> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new Error("Gravação de áudio indisponível neste dispositivo.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression,
      autoGainControl: true,
    },
  });

  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const mimeType = preferredMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  const samples = new Uint8Array(analyser.fftSize);
  const startedAt = Date.now();
  let speechDetected = false;
  let silenceStartedAt: number | null = null;
  let animationFrame: number | null = null;
  let settled = false;

  const cleanup = async () => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    stream.getTracks().forEach((track) => track.stop());
    source.disconnect();
    analyser.disconnect();
    await context.close().catch(() => undefined);
    onLevel?.(0);
  };

  return new Promise<Blob | null>((resolve, reject) => {
    const finish = async (blob: Blob | null, error?: Error) => {
      if (settled) return;
      settled = true;
      await cleanup();
      if (error) reject(error);
      else resolve(blob);
    };

    const stopRecorder = () => {
      if (recorder.state === "recording") recorder.stop();
    };

    const abort = () => {
      if (recorder.state === "recording") recorder.stop();
      void finish(null);
    };

    signal?.addEventListener("abort", abort, { once: true });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onerror = () => {
      void finish(null, new Error("Falha ao gravar o áudio."));
    };

    recorder.onstop = () => {
      signal?.removeEventListener("abort", abort);
      if (signal?.aborted || !speechDetected) {
        void finish(null);
        return;
      }
      void finish(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    };

    const monitor = () => {
      if (settled || signal?.aborted) return;
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const normalized = (sample - 128) / 128;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / samples.length);
      onLevel?.(Math.min(1, rms * 8));

      if (rms > 0.035) {
        speechDetected = true;
        silenceStartedAt = null;
      } else if (speechDetected && rms < 0.018) {
        if (silenceStartedAt === null) silenceStartedAt = Date.now();
        if (Date.now() - silenceStartedAt >= silenceMs) {
          stopRecorder();
          return;
        }
      }

      if (Date.now() - startedAt >= maxDurationMs) {
        stopRecorder();
        return;
      }

      animationFrame = requestAnimationFrame(monitor);
    };

    recorder.start(250);
    animationFrame = requestAnimationFrame(monitor);
  });
}
