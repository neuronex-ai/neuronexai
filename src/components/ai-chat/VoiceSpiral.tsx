import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_VOICE_SPIRAL_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'];

interface VoiceSpiralProps {
    /** Total number of dots in the spiral */
    totalDots?: number;
    /** Base radius of each dot */
    dotRadius?: number;
    /** Base animation duration in seconds */
    duration?: number;
    /** Primary dot color */
    dotColor?: string;
    /** Background color */
    backgroundColor?: string;
    /** Margin from edges */
    margin?: number;
    /** Minimum opacity for dots */
    minOpacity?: number;
    /** Maximum opacity for dots */
    maxOpacity?: number;
    /** Minimum scale multiplier */
    minScale?: number;
    /** Maximum scale multiplier */
    maxScale?: number;
    /** Enable multi-color mode */
    useMultipleColors?: boolean;
    /** Array of colors for multi-color mode */
    colors?: string[];
    /** Audio reactivity intensity (0-1) */
    audioIntensity?: number;
    /** Function to poll volume dynamically (0-1) in requestAnimationFrame without React re-renders */
    getAudioVolume?: () => number;
    /** Whether the component is actively listening */
    isListening?: boolean;
    /** Whether processing/thinking */
    isProcessing?: boolean;
    /** Custom CSS class */
    className?: string;
}

export function VoiceSpiral({
    totalDots = 600,
    dotRadius = 2,
    duration = 3,
    dotColor = '#FFFFFF',
    backgroundColor = 'transparent',
    margin = 2,
    minOpacity = 0.3,
    maxOpacity = 1,
    minScale = 0.5,
    maxScale = 1.5,
    useMultipleColors = true,
    colors = DEFAULT_VOICE_SPIRAL_COLORS,
    audioIntensity = 0,
    getAudioVolume,
    isListening = false,
    isProcessing = false,
    className = '',
}: VoiceSpiralProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const animationFrameRef = useRef<number>();
    const lastFrameRef = useRef(0);
    const isVisibleRef = useRef(typeof document === 'undefined' ? true : document.visibilityState === 'visible');
    const dotsRef = useRef<SVGCircleElement[]>([]);

    // Golden angle for Fibonacci spiral distribution
    const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    const SIZE = 400;
    const CENTER = SIZE / 2;
    const MAX_RADIUS = CENTER - margin - dotRadius;

    // Generate static spiral pattern
    useEffect(() => {
        if (!svgRef.current) return;
        const svg = svgRef.current;
        svg.innerHTML = '';
        dotsRef.current = [];

        for (let i = 0; i < totalDots; i++) {
            const idx = i + 0.5;
            const frac = idx / totalDots;
            const r = Math.sqrt(frac) * MAX_RADIUS;
            const theta = idx * GOLDEN_ANGLE;
            const x = CENTER + r * Math.cos(theta);
            const y = CENTER + r * Math.sin(theta);

            // Determine dot color
            let currentColor = dotColor;
            if (useMultipleColors && colors.length > 0) {
                const colorIndex = Math.floor(frac * colors.length);
                currentColor = colors[Math.min(colorIndex, colors.length - 1)];
            }

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x.toString());
            circle.setAttribute('cy', y.toString());
            circle.setAttribute('r', dotRadius.toString());
            circle.setAttribute('fill', currentColor);
            circle.setAttribute('opacity', minOpacity.toString());
            circle.dataset.baseFrac = frac.toString();
            circle.dataset.baseX = x.toString();
            circle.dataset.baseY = y.toString();
            svg.appendChild(circle);
            dotsRef.current.push(circle);
        }
    }, [totalDots, dotRadius, dotColor, margin, useMultipleColors, colors, minOpacity, GOLDEN_ANGLE, CENTER, MAX_RADIUS]);

    // Animate dots based on audio intensity and state
    const animate = useCallback(() => {
        animationFrameRef.current = requestAnimationFrame(animate);
        if (!isVisibleRef.current) return;
        const now = performance.now();
        if (now - lastFrameRef.current < 32) return;
        lastFrameRef.current = now;
        const time = now / 1000;
        const currentIntensity = getAudioVolume ? getAudioVolume() : audioIntensity;
        const audioBoost = isListening ? currentIntensity * 0.5 : 0;
        const processingPulse = isProcessing ? (Math.sin(time * 4) + 1) / 4 : 0;

        dotsRef.current.forEach((circle, _i) => {
            const frac = parseFloat(circle.dataset.baseFrac || '0');
            const baseX = parseFloat(circle.dataset.baseX || '0');
            const baseY = parseFloat(circle.dataset.baseY || '0');

            // Wave animation factor
            const wavePhase = (time / duration + frac) * Math.PI * 2;
            const waveFactor = (Math.sin(wavePhase) + 1) / 2;

            // Audio reactivity - dots pulse more when audio intensity is high
            // Combined intensity
            const intensity = waveFactor + audioBoost + processingPulse;

            // Calculate dynamic properties
            const scale = minScale + (maxScale - minScale) * intensity;
            const opacity = minOpacity + (maxOpacity - minOpacity) * intensity;

            // Subtle position displacement based on audio
            const displacementAmount = audioBoost * 5 * (1 - frac);
            const angle = frac * Math.PI * 2 + time;
            const dx = Math.cos(angle) * displacementAmount;
            const dy = Math.sin(angle) * displacementAmount;

            circle.setAttribute('r', (dotRadius * scale).toString());
            circle.setAttribute('opacity', opacity.toString());
            circle.setAttribute('cx', (baseX + dx).toString());
            circle.setAttribute('cy', (baseY + dy).toString());
        });

    }, [audioIntensity, getAudioVolume, isListening, isProcessing, duration, minScale, maxScale, minOpacity, maxOpacity, dotRadius]);

    // Start/stop animation loop
    useEffect(() => {
        const handleVisibility = () => {
            isVisibleRef.current = document.visibilityState === 'visible';
            if (isVisibleRef.current) lastFrameRef.current = 0;
        };
        document.addEventListener('visibilitychange', handleVisibility);
        animationFrameRef.current = requestAnimationFrame(animate);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [animate]);

    return (
        <div
            className={className}
            style={{
                width: '100%',
                height: '100%',
                backgroundColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            <svg
                ref={svgRef}
                width="400"
                height="400"
                viewBox="0 0 400 400"
                style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                }}
            />
        </div>
    );
}
