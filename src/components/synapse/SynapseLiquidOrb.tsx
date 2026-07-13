"use client";

import { useEffect, useRef } from "react";

type PresenceVisualState =
    | "idle"
    | "connecting"
    | "listening"
    | "thinking"
    | "speaking"
    | "awaiting_confirmation"
    | "executing"
    | "focusing"
    | "completed"
    | "error";

interface SynapseLiquidOrbProps {
    state: PresenceVisualState;
    getInputSignal?: () => number;
    getOutputSignal?: () => number;
    reducedMotion?: boolean;
}

interface OrbColor {
    stop1: string;
    stop2: string;
    stop3: string;
}

const STATE_COLORS: Record<PresenceVisualState, OrbColor> = {
    idle: {
        stop1: "rgba(99, 102, 241, 0.85)",   // Indigo
        stop2: "rgba(168, 85, 247, 0.75)",   // Purple
        stop3: "rgba(59, 130, 246, 0.4)"     // Blue
    },
    connecting: {
        stop1: "rgba(245, 158, 11, 0.85)",   // Amber
        stop2: "rgba(236, 72, 153, 0.7)",    // Pink
        stop3: "rgba(239, 68, 68, 0.3)"      // Red
    },
    listening: {
        stop1: "rgba(6, 182, 212, 0.9)",     // Cyan
        stop2: "rgba(59, 130, 246, 0.8)",    // Blue
        stop3: "rgba(168, 85, 247, 0.5)"     // Purple
    },
    thinking: {
        stop1: "rgba(139, 92, 246, 0.9)",    // Violet
        stop2: "rgba(236, 72, 153, 0.75)",   // Pink
        stop3: "rgba(99, 102, 241, 0.5)"     // Indigo
    },
    speaking: {
        stop1: "rgba(236, 72, 153, 0.95)",   // Pink
        stop2: "rgba(249, 115, 22, 0.85)",   // Orange
        stop3: "rgba(6, 182, 212, 0.5)"      // Cyan
    },
    awaiting_confirmation: {
        stop1: "rgba(234, 179, 8, 0.9)",     // Yellow
        stop2: "rgba(249, 115, 22, 0.8)",    // Orange
        stop3: "rgba(239, 68, 68, 0.4)"      // Red
    },
    executing: {
        stop1: "rgba(16, 185, 129, 0.9)",    // Emerald
        stop2: "rgba(59, 130, 246, 0.8)",    // Blue
        stop3: "rgba(99, 102, 241, 0.4)"     // Indigo
    },
    focusing: {
        stop1: "rgba(6, 182, 212, 0.9)",     // Cyan
        stop2: "rgba(139, 92, 246, 0.8)",    // Violet
        stop3: "rgba(255, 255, 255, 0.6)"    // White highlight
    },
    completed: {
        stop1: "rgba(16, 185, 129, 0.95)",   // Emerald
        stop2: "rgba(34, 197, 94, 0.8)",     // Green
        stop3: "rgba(255, 255, 255, 0.5)"    // White highlight
    },
    error: {
        stop1: "rgba(239, 68, 68, 0.95)",    // Red
        stop2: "rgba(185, 28, 28, 0.85)",    // Crimson
        stop3: "rgba(0, 0, 0, 0.6)"          // Deep dark core
    }
};

export const SynapseLiquidOrb = ({
    state,
    getInputSignal,
    getOutputSignal,
    reducedMotion = false
}: SynapseLiquidOrbProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef<PresenceVisualState>(state);
    
    // Smooth transition spring physics states
    const transitionRef = useRef({
        targetScale: 1.0,
        currentScale: 1.0,
        targetTurbulence: 0.15,
        currentTurbulence: 0.15,
        targetSpeed: 1.0,
        currentSpeed: 1.0,
    });

    useEffect(() => {
        stateRef.current = state;
        
        // Define target physical constants per state
        const config: Record<PresenceVisualState, { scale: number; turbulence: number; speed: number }> = {
            idle: { scale: 0.88, turbulence: 0.10, speed: 0.6 },
            connecting: { scale: 0.94, turbulence: 0.28, speed: 1.8 },
            listening: { scale: 1.02, turbulence: 0.35, speed: 1.4 },
            thinking: { scale: 1.05, turbulence: 0.55, speed: 2.5 },
            speaking: { scale: 1.08, turbulence: 0.48, speed: 1.7 },
            awaiting_confirmation: { scale: 0.95, turbulence: 0.22, speed: 0.9 },
            executing: { scale: 1.0, turbulence: 0.40, speed: 2.2 },
            focusing: { scale: 1.03, turbulence: 0.18, speed: 1.1 },
            completed: { scale: 1.05, turbulence: 0.08, speed: 0.4 },
            error: { scale: 0.92, turbulence: 0.65, speed: 3.2 }
        };

        const target = config[state] || config.idle;
        transitionRef.current.targetScale = target.scale;
        transitionRef.current.targetTurbulence = target.turbulence;
        transitionRef.current.targetSpeed = target.speed;
    }, [state]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationFrameId: number;
        let time = 0;

        // Ultra high-res drawing buffer
        const resizeCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = 120 * dpr;
            canvas.height = 120 * dpr;
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            ctx.scale(dpr, dpr);
        };
        resizeCanvas();

        // Simple spring math
        const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;

        // Wave simulation parameters
        const waveCount = 5;
        const waveOffsets = Array.from({ length: waveCount }, (_, i) => (i * Math.PI * 2) / waveCount);

        const render = () => {
            const width = 120;
            const height = 120;
            const centerX = width / 2;
            const centerY = height / 2;

            ctx.clearRect(0, 0, width, height);

            // Fetch dynamic audio/signals
            const inputVal = getInputSignal ? getInputSignal() : 0;
            const outputVal = getOutputSignal ? getOutputSignal() : 0;
            
            // Integrate response signal based on active states
            const activeState = stateRef.current;
            const signalPower = activeState === "listening" ? inputVal : activeState === "speaking" ? outputVal : 0;
            
            // Dynamic boost to physics values
            const signalBoost = Math.max(0, signalPower * 1.6);

            // Fast spring simulation
            const t = transitionRef.current;
            const speedFactor = reducedMotion ? 0.08 : 0.15;
            t.currentScale = lerp(t.currentScale, t.targetScale + (signalBoost * 0.12), speedFactor);
            t.currentTurbulence = lerp(t.currentTurbulence, t.targetTurbulence + (signalBoost * 0.45), speedFactor);
            t.currentSpeed = lerp(t.currentSpeed, t.targetSpeed + (signalBoost * 1.5), speedFactor);

            // Update physical time coordinate
            time += (0.015 * t.currentSpeed);

            // Get current gradients
            const colors = STATE_COLORS[activeState] || STATE_COLORS.idle;

            // Draw fluid orb components using organic compositing
            ctx.globalCompositeOperation = "screen";

            for (let w = 0; w < waveCount; w++) {
                const angleOffset = waveOffsets[w];
                const waveScale = t.currentScale * (0.88 + Math.sin(time + w) * 0.05);
                const radius = (width / 3.4) * waveScale;

                ctx.beginPath();
                const points = 36; // Higher resolution circle pathing for liquid smoothness
                
                for (let i = 0; i <= points; i++) {
                    const angle = (i * Math.PI * 2) / points;
                    
                    // Complex high-frequency harmonic physical noise (Siri-like liquid waves)
                    const noise1 = Math.sin(angle * 3 + time * 1.5 + angleOffset) * 12 * t.currentTurbulence;
                    const noise2 = Math.cos(angle * 5 - time * 2.2 + angleOffset * 2) * 6 * t.currentTurbulence;
                    const noise3 = Math.sin(angle * 1.5 + time * 0.8) * 8 * t.currentTurbulence;
                    
                    // Physical deformation based on dynamic signals
                    const audioDeformation = signalBoost * Math.sin(angle * 6 + time * 4) * 18;

                    const currentRadius = radius + noise1 + noise2 + noise3 + audioDeformation;

                    const x = centerX + Math.cos(angle) * currentRadius;
                    const y = centerY + Math.sin(angle) * currentRadius;

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();

                // Advanced gradient coloring for the organic volumetric 3D liquid feel
                const gradientX = centerX + Math.cos(time + angleOffset) * 12;
                const gradientY = centerY + Math.sin(time + angleOffset) * 12;
                const grad = ctx.createRadialGradient(
                    gradientX,
                    gradientY,
                    2,
                    centerX,
                    centerY,
                    radius * 1.45
                );

                // Add colors with subtle rotation offsets to mimic organic shifting light
                if (w === 0) {
                    grad.addColorStop(0, colors.stop1);
                    grad.addColorStop(0.5, colors.stop2);
                    grad.addColorStop(1, "rgba(0,0,0,0)");
                } else if (w === 1) {
                    grad.addColorStop(0, colors.stop2);
                    grad.addColorStop(0.6, colors.stop3);
                    grad.addColorStop(1, "rgba(0,0,0,0)");
                } else {
                    grad.addColorStop(0, colors.stop3);
                    grad.addColorStop(0.5, colors.stop1);
                    grad.addColorStop(1, "rgba(0,0,0,0)");
                }

                ctx.fillStyle = grad;
                ctx.fill();
            }

            // Draw a bright, high-fidelity inner core to make it pop and look 3D glass/light emission
            ctx.globalCompositeOperation = "source-over";
            ctx.beginPath();
            const coreRadius = (width / 5) * t.currentScale * (0.9 + Math.sin(time * 2.5) * 0.05);
            ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
            
            const coreGrad = ctx.createRadialGradient(
                centerX - 3,
                centerY - 3,
                0,
                centerX,
                centerY,
                coreRadius
            );
            coreGrad.addColorStop(0, "rgba(255, 255, 255, 0.8)");
            coreGrad.addColorStop(0.3, colors.stop1);
            coreGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
            
            ctx.fillStyle = coreGrad;
            ctx.fill();

            // Subtle outer atmospheric glow
            ctx.globalCompositeOperation = "screen";
            ctx.beginPath();
            ctx.arc(centerX, centerY, width / 2.2, 0, Math.PI * 2);
            const atmosphereGrad = ctx.createRadialGradient(
                centerX,
                centerY,
                width / 4,
                centerX,
                centerY,
                width / 2
            );
            atmosphereGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
            atmosphereGrad.addColorStop(0.5, colors.stop2);
            atmosphereGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
            
            ctx.fillStyle = atmosphereGrad;
            ctx.fill();

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [getInputSignal, getOutputSignal, reducedMotion]);

    return (
        <div className="relative flex items-center justify-center w-full h-full">
            {/* Soft backdrop neon blur simulation */}
            <div 
                className="absolute inset-0 rounded-full transition-colors duration-500 pointer-events-none filter blur-xl opacity-60 scale-95"
                style={{
                    backgroundColor: state === "error" ? "rgba(239, 68, 68, 0.45)" :
                                     state === "listening" ? "rgba(6, 182, 212, 0.35)" :
                                     state === "thinking" ? "rgba(139, 92, 246, 0.4)" :
                                     state === "speaking" ? "rgba(236, 72, 153, 0.45)" :
                                     state === "executing" ? "rgba(16, 185, 129, 0.35)" :
                                     "rgba(99, 102, 241, 0.3)"
                }}
            />
            <canvas
                ref={canvasRef}
                className="relative block w-full h-full select-none pointer-events-none z-10"
            />
        </div>
    );
};