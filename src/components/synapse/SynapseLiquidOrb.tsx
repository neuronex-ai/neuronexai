import { useEffect, useRef } from "react";

type SynapseLiquidOrbProps = {
    state: string;
    getInputVolume: () => number;
    reducedMotion?: boolean;
};

const STATE_ENERGY: Record<string, number> = {
    idle: 0.18,
    connecting: 0.38,
    listening: 0.58,
    thinking: 0.82,
    speaking: 0.78,
    awaiting_confirmation: 0.45,
    executing: 0.72,
    focusing: 0.55,
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
uniform float u_audio;
uniform vec2 u_pointer;
uniform float u_dark;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.52;
  mat2 rotation = mat2(0.82, -0.57, 0.57, 0.82);
  for (int i = 0; i < 5; i++) {
    value += amplitude * valueNoise(p);
    p = rotation * p * 2.03 + 7.13;
    amplitude *= 0.48;
  }
  return value;
}

void main() {
  vec2 p = (v_uv - 0.5) * 2.0;
  float t = u_time;
  float audio = smoothstep(0.01, 0.9, u_audio);
  float vitality = clamp(u_energy * 0.7 + audio * 0.8, 0.0, 1.0);

  vec2 pointerBend = (u_pointer - 0.5) * 0.12;
  p -= pointerBend * (0.3 + vitality * 0.5);

  // Dynamic noise fields matching iOS 18 fluid motion
  float slowField = fbm(p * 2.2 + vec2(t * 0.12, -t * 0.1));
  float fineField = fbm(p * 6.2 + vec2(-t * 0.18, t * 0.15));
  float breathing = sin(t * 1.4) * 0.012 + sin(t * 0.6 + 2.1) * 0.015;
  
  // High response liquid waves
  float liquidEdge = (slowField - 0.5) * (0.02 + vitality * 0.12);
  float radius = 0.8 + breathing + liquidEdge;
  float distanceToCenter = length(p);
  float antialias = max(fwidth(distanceToCenter) * 1.5, 0.003);
  float alpha = 1.0 - smoothstep(radius - antialias, radius + antialias, distanceToCenter);
  
  if (alpha <= 0.001) {
    outColor = vec4(0.0);
    return;
  }

  float z = sqrt(max(radius * radius - dot(p, p), 0.0)) / radius;
  vec3 normal = normalize(vec3(p / radius, z));
  vec2 flow = vec2(
    fbm(p * 3.5 + vec2(t * 0.22, 13.4)),
    fbm(p * 3.5 + vec2(19.2, -t * 0.21))
  ) - 0.5;
  normal.xy += flow * (0.06 + vitality * 0.16);
  normal = normalize(normal);

  vec3 viewDirection = vec3(0.0, 0.0, 1.0);
  float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.2);
  float innerFresnel = pow(1.0 - max(z, 0.0), 4.5);

  vec3 lightA = normalize(vec3(-0.4, 0.8, 0.6));
  vec3 lightB = normalize(vec3(0.6, -0.4, 0.5));
  float diffuseA = max(dot(normal, lightA), 0.0);
  float diffuseB = max(dot(normal, lightB), 0.0);
  float specularA = pow(max(dot(reflect(-lightA, normal), viewDirection), 0.0), 96.0);
  float specularB = pow(max(dot(reflect(-lightB, normal), viewDirection), 0.0), 48.0);

  float causticBands = sin((normal.x * 6.0 + normal.y * 4.5 + fineField * 4.0) - t * (0.5 + vitality * 0.4));
  float caustics = pow(max(0.0, causticBands * 0.5 + 0.5), 8.0) * (0.18 + vitality * 0.28);
  float internalGlow = pow(max(0.0, 1.0 - distanceToCenter / radius), 1.5);

  // High contrast palette:
  // Dark mode = Brilliant Pearlescent White Liquid Orb
  // Light mode = Rich Deep Liquid Graphite Glass
  vec3 graphite = mix(vec3(0.12, 0.13, 0.15), vec3(0.85, 0.88, 0.92), u_dark);
  vec3 pearl = mix(vec3(0.1, 0.11, 0.12), vec3(0.98, 0.99, 1.0), u_dark);
  vec3 deepGlass = mix(vec3(0.88, 0.90, 0.94), vec3(0.04, 0.05, 0.07), u_dark);
  
  vec3 color = mix(deepGlass, graphite, 0.2 + diffuseA * 0.4);
  color += pearl * (specularA * 1.1 + specularB * 0.3);
  color += pearl * caustics;
  color += pearl * internalGlow * (0.12 + audio * 0.25);

  // Elegant subtle refractive dispersion edge
  vec3 spectral = mix(
    vec3(0.1, 0.15, 0.2), 
    vec3(0.3, 0.5, 0.8) * max(normal.x, 0.0) + vec3(0.6, 0.4, 0.8) * max(-normal.x, 0.0) + vec3(0.4, 0.7, 0.7) * max(normal.y, 0.0),
    u_dark
  );
  
  color += spectral * fresnel * (0.08 + vitality * 0.12);
  color = mix(color, pearl, fresnel * 0.5 + innerFresnel * 0.1);

  float glassAlpha = alpha * mix(0.93, 0.99, fresnel);
  outColor = vec4(color, glassAlpha);
}`;

const compileShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
    }
    return shader;
};

export const SynapseLiquidOrb = ({ state, getInputVolume, reducedMotion = false }: SynapseLiquidOrbProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef(state);
    const volumeRef = useRef(getInputVolume);
    const pointerRef = useRef<[number, number]>([0.5, 0.5]);
    stateRef.current = state;
    volumeRef.current = getInputVolume;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || typeof window === "undefined" || typeof WebGL2RenderingContext === "undefined") return;

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
        if (!vertexShader || !fragmentShader) return;

        const program = gl.createProgram();
        if (!program) return;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, "a_position");
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

        const timeUniform = gl.getUniformLocation(program, "u_time");
        const energyUniform = gl.getUniformLocation(program, "u_energy");
        const audioUniform = gl.getUniformLocation(program, "u_audio");
        const pointerUniform = gl.getUniformLocation(program, "u_pointer");
        const darkUniform = gl.getUniformLocation(program, "u_dark");
        const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

        let frame = 0;
        let startTime = performance.now();
        let smoothedAudio = 0;

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const width = Math.max(1, Math.round(rect.width * dpr));
            const height = Math.max(1, Math.round(rect.height * dpr));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                gl.viewport(0, 0, width, height);
            }
        };

        const draw = (now: number) => {
            resize();
            // Add slight continuous self-pulsating fluctuation even on silence for organic siri feel
            const selfPulse = 0.03 * Math.sin(now * 0.003) + 0.01 * Math.cos(now * 0.007);
            const targetAudio = Math.max(0, Math.min(1, (Number(volumeRef.current()) || 0) + Math.abs(selfPulse)));
            smoothedAudio += (targetAudio - smoothedAudio) * (targetAudio > smoothedAudio ? 0.32 : 0.09);
            
            gl.useProgram(program);
            gl.uniform1f(timeUniform, (now - startTime) / 1000);
            gl.uniform1f(energyUniform, STATE_ENERGY[stateRef.current] ?? 0.22);
            gl.uniform1f(audioUniform, smoothedAudio);
            gl.uniform2f(pointerUniform, pointerRef.current[0], pointerRef.current[1]);
            gl.uniform1f(darkUniform, document.documentElement.classList.contains("dark") || darkQuery.matches ? 1 : 0);
            
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            if (!reducedMotion && document.visibilityState !== "hidden") {
                frame = window.requestAnimationFrame(draw);
            }
        };

        const start = () => {
            if (frame || document.visibilityState === "hidden") return;
            startTime = performance.now();
            frame = window.requestAnimationFrame(draw);
        };
        const handleVisibility = () => {
            if (document.visibilityState === "hidden") {
                window.cancelAnimationFrame(frame);
                frame = 0;
            } else {
                start();
            }
        };
        const handlePointerMove = (event: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            pointerRef.current = [
                Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
                Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / Math.max(1, rect.height))),
            ];
        };
        const handlePointerLeave = () => { pointerRef.current = [0.5, 0.5]; };

        canvas.addEventListener("pointermove", handlePointerMove);
        canvas.addEventListener("pointerleave", handlePointerLeave);
        document.addEventListener("visibilitychange", handleVisibility);
        if (reducedMotion) draw(performance.now());
        else start();

        return () => {
            window.cancelAnimationFrame(frame);
            canvas.removeEventListener("pointermove", handlePointerMove);
            canvas.removeEventListener("pointerleave", handlePointerLeave);
            document.removeEventListener("visibilitychange", handleVisibility);
            gl.deleteBuffer(buffer);
            gl.deleteProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
        };
    }, [reducedMotion]);

    return (
        <span className="relative block w-72 h-72 mx-auto cursor-pointer select-none group" aria-hidden="true">
            {/* Ambient liquid glow behind the glass orb */}
            <span className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-400/20 via-white/10 to-purple-500/20 blur-3xl opacity-80 group-hover:scale-105 transition-transform duration-1000 ease-out" />
            
            {/* The primary Canvas rendering the WebGL fluid */}
            <canvas ref={canvasRef} className="w-full h-full relative z-10 block pointer-events-none drop-shadow-[0_0_40px_rgba(255,255,255,0.15)] dark:drop-shadow-[0_0_50px_rgba(255,255,255,0.25)]" />
            
            {/* Realistic high-end glass 3D optical lens refraction effects */}
            <span className="absolute inset-0 rounded-full border border-white/20 pointer-events-none z-20 bg-gradient-to-tr from-transparent via-white/5 to-white/10 mix-blend-overlay" />
            <span className="absolute inset-[3px] rounded-full border border-white/10 pointer-events-none z-20 bg-gradient-to-b from-white/15 to-transparent mix-blend-screen opacity-70" />
            <span className="absolute top-[8%] left-[15%] w-16 h-8 rounded-full bg-gradient-to-b from-white/40 to-transparent blur-[2px] rotate-[-12deg] pointer-events-none z-20" />
        </span>
    );
};