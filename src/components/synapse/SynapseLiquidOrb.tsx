import { useEffect, useRef } from "react";

import type { PcmAudioSignal } from "@/lib/pcm-audio-player";

type SynapseLiquidOrbProps = {
    state: string;
    getInputSignal: () => PcmAudioSignal;
    getOutputSignal: () => PcmAudioSignal;
    reducedMotion: boolean;
};

const STATE_ENERGY: Record<string, number> = {
    idle: 0.2,
    connecting: 0.4,
    listening: 0.5,
    thinking: 0.72,
    speaking: 0.82,
    awaiting_confirmation: 0.34,
    executing: 0.68,
    focusing: 0.56,
    completed: 0.28,
    error: 0.22,
};

const vertexShaderSource = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform float u_time;
uniform float u_energy;
uniform vec4 u_input;
uniform vec4 u_output;
uniform float u_impulse;
uniform float u_dark;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

float fbm3(vec3 p) {
  float value = 0.0;
  float amplitude = 0.54;
  for (int i = 0; i < 4; i++) {
    value += noise3(p) * amplitude;
    p = p * 2.03 + vec3(7.1, 11.7, 5.3);
    amplitude *= 0.48;
  }
  return value;
}

void main() {
  vec2 p = (v_uv - 0.5) * 2.0;
  float inputRms = smoothstep(0.008, 0.54, u_input.x);
  float outputRms = smoothstep(0.006, 0.48, u_output.x);
  float voice = max(inputRms, outputRms);
  float impulse = clamp(u_impulse, 0.0, 1.0);
  float inputLow = clamp(u_input.y, 0.0, 1.0);
  float inputMid = clamp(u_input.z, 0.0, 1.0);
  float outputLow = clamp(u_output.y, 0.0, 1.0);
  float outputMid = clamp(u_output.z, 0.0, 1.0);
  float low = clamp(inputLow + outputLow, 0.0, 1.0);
  float mid = clamp(inputMid + outputMid, 0.0, 1.0);
  float high = clamp(u_input.w + u_output.w, 0.0, 1.0);
  float vitality = clamp(u_energy + voice * 0.55 + impulse * 0.18, 0.0, 1.0);
  float time = u_time * (0.72 + vitality * 0.3);

  float edgeField = fbm3(vec3(p * 2.3, time * 0.13));
  float polar = atan(p.y, p.x);
  float inputContour = sin(polar * 3.0 - time * 4.1 + inputMid * 2.4) * inputRms;
  float outputContour = sin(polar * 5.0 + time * 3.25 + outputMid * 2.8) * outputRms;
  float onsetContour = sin(polar * 7.0 - time * 5.7) * impulse;
  float breath = sin(time * 1.17) * 0.008 + sin(time * 0.41 + 1.8) * 0.006;
  float radius = 0.89 + breath
    + (edgeField - 0.5) * (0.018 + low * 0.024)
    + inputContour * (0.016 + inputLow * 0.026)
    + outputContour * (0.019 + outputLow * 0.032)
    + onsetContour * 0.013;
  float distanceToCenter = length(p);
  float antialias = max(fwidth(distanceToCenter) * 1.45, 0.0025);
  float silhouette = 1.0 - smoothstep(radius - antialias, radius + antialias, distanceToCenter);
  if (silhouette <= 0.001) {
    outColor = vec4(0.0);
    return;
  }

  float zExtent = sqrt(max(radius * radius - dot(p, p), 0.0));
  float rayLength = zExtent * 2.0;
  float stepSize = rayLength / 18.0;
  float z = -zExtent + stepSize * 0.5;
  float density = 0.0;
  float luminous = 0.0;
  float filaments = 0.0;
  for (int stepIndex = 0; stepIndex < 18; stepIndex++) {
    vec3 samplePoint = vec3(p, z);
    float voiceTorque = inputRms * sin(z * 3.4 + time * 2.1) - outputRms * cos(z * 2.8 - time * 1.8);
    float swirlAngle = time * 0.16 + z * 0.78 + fbm3(samplePoint * 1.35) * 1.25 + voiceTorque * (0.28 + impulse * 0.2);
    mat2 swirl = mat2(cos(swirlAngle), -sin(swirlAngle), sin(swirlAngle), cos(swirlAngle));
    vec3 flowPoint = vec3(swirl * samplePoint.xy, samplePoint.z);
    float broad = fbm3(flowPoint * 2.05 + vec3(time * 0.12, -time * 0.09, time * 0.07));
    float detail = fbm3(flowPoint * 5.1 + vec3(-time * 0.16, time * 0.11, 9.4));
    float ribbon = pow(max(0.0, 1.0 - abs(sin((flowPoint.x - flowPoint.y * 0.72 + broad * 1.8) * 4.2 - time * (0.34 + outputRms * 0.42)))), 7.0);
    float voiceRibbon = pow(max(0.0, 1.0 - abs(sin((flowPoint.y + flowPoint.x * 0.46 + detail * 1.4) * 5.4 + time * (0.48 + impulse * 0.44)))), 9.0) * (voice + impulse * 0.46);
    float radial = 1.0 - smoothstep(0.12, radius, length(samplePoint));
    float localDensity = smoothstep(0.43, 0.82, broad * 0.72 + detail * 0.38) * radial;
    density += localDensity * stepSize;
    filaments += (ribbon + voiceRibbon * 0.46) * radial * stepSize;
    luminous += pow(max(0.0, detail - 0.54), 3.0) * radial * stepSize;
    z += stepSize;
  }

  vec3 normal = normalize(vec3(p / max(radius, 0.001), zExtent / max(radius, 0.001)));
  vec3 viewDirection = vec3(0.0, 0.0, 1.0);
  float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.2);
  vec3 keyLight = normalize(vec3(-0.55, 0.76, 0.62));
  vec3 rimLight = normalize(vec3(0.75, -0.48, 0.5));
  float specular = pow(max(dot(reflect(-keyLight, normal), viewDirection), 0.0), 92.0);
  float rimSpecular = pow(max(dot(reflect(-rimLight, normal), viewDirection), 0.0), 38.0);
  float innerDepth = pow(clamp(1.0 - distanceToCenter / max(radius, 0.001), 0.0, 1.0), 1.6);
  float voiceCaustic = pow(max(0.0, sin(polar * 3.0 + time * (1.2 + outputRms * 1.8)) * 0.5 + 0.5), 8.0) * innerDepth * (voice + impulse * 0.52);
  float microVein = fbm3(vec3(p * 13.0 + vec2(time * 0.025, -time * 0.018), zExtent * 4.0));
  microVein = smoothstep(0.56, 0.79, microVein) * innerDepth;

  vec3 darkCore = mix(vec3(0.16, 0.17, 0.19), vec3(0.018, 0.021, 0.026), u_dark);
  vec3 smoke = mix(vec3(0.31, 0.32, 0.35), vec3(0.37, 0.39, 0.43), u_dark);
  vec3 silver = mix(vec3(0.07, 0.075, 0.085), vec3(0.94, 0.96, 0.99), u_dark);
  vec3 pearl = mix(vec3(0.14, 0.15, 0.17), vec3(1.0), u_dark);

  vec3 color = mix(darkCore, smoke, clamp(density * 1.45, 0.0, 1.0));
  color += silver * filaments * (0.43 + vitality * 0.42 + mid * 0.26);
  color += pearl * luminous * (0.56 + high * 0.52);
  color += pearl * (specular * 0.95 + rimSpecular * 0.28);
  color += pearl * voiceCaustic * (0.16 + high * 0.28);
  color += silver * microVein * (0.028 + vitality * 0.032);
  color = mix(color, silver, fresnel * (0.62 + voice * 0.13));
  color += pearl * pow(fresnel, 5.0) * 0.36;

  float grain = hash31(vec3(gl_FragCoord.xy * 0.37, floor(time * 18.0))) - 0.5;
  color += grain * (0.012 + fresnel * 0.008);

  float glassAlpha = silhouette * mix(0.88, 0.99, fresnel);
  outColor = vec4(color, glassAlpha);
}`;

const compileShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn("[SynapseLiquidOrb] Falha ao compilar shader:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
};

const signalTuple = (signal: PcmAudioSignal) => [signal.rms, signal.low, signal.mid, signal.high] as const;

export const SynapseLiquidOrb = ({ state, getInputSignal, getOutputSignal, reducedMotion }: SynapseLiquidOrbProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef(state);
    const inputSignalRef = useRef(getInputSignal);
    const outputSignalRef = useRef(getOutputSignal);
    const drawOnceRef = useRef<(() => void) | null>(null);
    stateRef.current = state;
    inputSignalRef.current = getInputSignal;
    outputSignalRef.current = getOutputSignal;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || typeof window === "undefined") return;

        let cleanupRenderer: (() => void) | undefined;
        let contextLost = false;

        const disposeRenderer = () => {
            const dispose = cleanupRenderer;
            cleanupRenderer = undefined;
            dispose?.();
        };

        const initialiseRenderer = () => {
            disposeRenderer();
            const gl = canvas.getContext("webgl2", {
                alpha: true,
                antialias: true,
                depth: false,
                premultipliedAlpha: true,
                powerPreference: "high-performance",
            });
            if (!gl) return;

            const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
            const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
            if (!vertexShader || !fragmentShader) {
                if (vertexShader) gl.deleteShader(vertexShader);
                if (fragmentShader) gl.deleteShader(fragmentShader);
                canvas.style.opacity = "0";
                return;
            }
            const program = gl.createProgram();
            if (!program) {
                gl.deleteShader(vertexShader);
                gl.deleteShader(fragmentShader);
                canvas.style.opacity = "0";
                return;
            }
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.warn("[SynapseLiquidOrb] Falha ao vincular programa WebGL:", gl.getProgramInfoLog(program));
                gl.deleteProgram(program);
                gl.deleteShader(vertexShader);
                gl.deleteShader(fragmentShader);
                canvas.style.opacity = "0";
                return;
            }
            canvas.style.opacity = "1";

            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
            const position = gl.getAttribLocation(program, "a_position");
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

            const uniforms = {
                time: gl.getUniformLocation(program, "u_time"),
                energy: gl.getUniformLocation(program, "u_energy"),
                input: gl.getUniformLocation(program, "u_input"),
                output: gl.getUniformLocation(program, "u_output"),
                impulse: gl.getUniformLocation(program, "u_impulse"),
                dark: gl.getUniformLocation(program, "u_dark"),
            };
            let frame = 0;
            const startTime = performance.now();
            const smoothedInput = [0, 0, 0, 0];
            const smoothedOutput = [0, 0, 0, 0];
            let previousVoiceRms = 0;
            let reactiveImpulse = 0;
            let cachedWidth = 1;
            let cachedHeight = 1;

            const resize = () => {
                const rect = canvas.getBoundingClientRect();
                const dpr = Math.min(window.devicePixelRatio || 1, 3);
                cachedWidth = Math.max(1, Math.round(rect.width * dpr));
                cachedHeight = Math.max(1, Math.round(rect.height * dpr));
                if (canvas.width !== cachedWidth || canvas.height !== cachedHeight) {
                    canvas.width = cachedWidth;
                    canvas.height = cachedHeight;
                    gl.viewport(0, 0, cachedWidth, cachedHeight);
                }
            };

            const draw = (now: number) => {
                if (contextLost) return;
                const input = signalTuple(inputSignalRef.current());
                const output = signalTuple(outputSignalRef.current());
                const voiceRms = Math.max(input[0], output[0]);
                const onset = Math.max(0, voiceRms - previousVoiceRms);
                previousVoiceRms = voiceRms;
                const targetImpulse = Math.min(1, onset * 5.8 + voiceRms * 0.18);
                reactiveImpulse += (targetImpulse - reactiveImpulse) * (targetImpulse > reactiveImpulse ? 0.52 : 0.09);
                for (let index = 0; index < 4; index += 1) {
                    smoothedInput[index] += (input[index] - smoothedInput[index]) * (input[index] > smoothedInput[index] ? 0.36 : 0.09);
                    smoothedOutput[index] += (output[index] - smoothedOutput[index]) * (output[index] > smoothedOutput[index] ? 0.42 : 0.1);
                }
                gl.useProgram(program);
                gl.uniform1f(uniforms.time, (now - startTime) / 1000);
                gl.uniform1f(uniforms.energy, STATE_ENERGY[stateRef.current] ?? 0.2);
                gl.uniform4fv(uniforms.input, smoothedInput);
                gl.uniform4fv(uniforms.output, smoothedOutput);
                gl.uniform1f(uniforms.impulse, reactiveImpulse);
                gl.uniform1f(uniforms.dark, document.documentElement.classList.contains("dark") ? 1 : 0);
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
                if (!reducedMotion && document.visibilityState !== "hidden") frame = window.requestAnimationFrame(draw);
            };

            const start = () => {
                if (frame || document.visibilityState === "hidden" || contextLost) return;
                frame = window.requestAnimationFrame(draw);
            };
            const handleVisibility = () => {
                if (document.visibilityState === "hidden") {
                    window.cancelAnimationFrame(frame);
                    frame = 0;
                } else start();
            };
            const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
            resizeObserver?.observe(canvas);
            window.addEventListener("resize", resize, { passive: true });
            document.addEventListener("visibilitychange", handleVisibility);
            resize();
            drawOnceRef.current = () => draw(performance.now());
            if (reducedMotion) draw(performance.now());
            else start();

            cleanupRenderer = () => {
                window.cancelAnimationFrame(frame);
                drawOnceRef.current = null;
                resizeObserver?.disconnect();
                window.removeEventListener("resize", resize);
                document.removeEventListener("visibilitychange", handleVisibility);
                gl.deleteBuffer(buffer);
                gl.deleteProgram(program);
                gl.deleteShader(vertexShader);
                gl.deleteShader(fragmentShader);
            };
        };

        const handleContextLost = (event: Event) => {
            event.preventDefault();
            contextLost = true;
            canvas.style.opacity = "0";
            disposeRenderer();
        };
        const handleContextRestored = () => {
            contextLost = false;
            initialiseRenderer();
        };
        canvas.addEventListener("webglcontextlost", handleContextLost);
        canvas.addEventListener("webglcontextrestored", handleContextRestored);
        const themeObserver = new MutationObserver(() => {
            if (reducedMotion) drawOnceRef.current?.();
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        initialiseRenderer();

        return () => {
            disposeRenderer();
            themeObserver.disconnect();
            canvas.removeEventListener("webglcontextlost", handleContextLost);
            canvas.removeEventListener("webglcontextrestored", handleContextRestored);
        };
    }, [reducedMotion]);

    useEffect(() => {
        if (reducedMotion) drawOnceRef.current?.();
    }, [reducedMotion, state]);

    return (
        <span className="synapse-liquid-orb" aria-hidden="true">
            <span className="synapse-liquid-orb-fallback" />
            <canvas ref={canvasRef} className="synapse-liquid-orb-canvas" />
            <span className="synapse-liquid-orb-lens" />
            <span className="synapse-liquid-orb-caustic" />
        </span>
    );
};
