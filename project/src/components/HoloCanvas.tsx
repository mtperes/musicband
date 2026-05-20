import React, { useRef, useEffect, useCallback } from 'react';

// --- Configuration Constants ---
const BLUR_RADIUS = 8; // Softness of the blobs
const BLOBS_COUNT = 5;  // Number of sources we track
const SPEED_FACTOR = 0.0005; // Controls how fast everything drifts

/**
 * A component that simulates gentle, drifting color blobs on a canvas 
 * with minimal CPU overhead.
 */
const HoloCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number | null>(null);

    // --- Core Drawing Logic (Simplified and optimized) ---
    const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, startTime: number) => {
        const currentTime = Date.now();
        const elapsed = (currentTime - startTime) / 100;

        // OPTIMIZATION 1: Accumulation/Ghosting (Low cost, high effect)
        // Fill with a very low alpha value to simulate color smearing over time.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Draw defined Blob Sources (The core drawing loop)
        for (let i = 0; i < BLOBS_COUNT; i++) {
            const sourceX = canvas.width / 3 * ((i % 3 === 0 ? 1 : 1.5));
            const sourceY = canvas.height / 3 * Math.floor(i / 3) + (Math.random() * 20);

            // Calculate current position based on time and sine waves for smooth drift
            const offsetX = Math.sin((elapsed * SPEED_FACTOR) + i * 1) * 50;
            const offsetY = Math.cos((elapsed * SPEED_FACTOR) + i * 2) * 50;

            // Calculate size/opacity based on time to create the "pulse" effect
            const scaleFactor = 1 + Math.sin(elapsed * 0.001 + i) * 0.3; // Pulsing scale (1.3x max)
            const currentRadius = 15 * scaleFactor;

            // Determine colors based on the blob index for visual variety
            let r, g, b;
            if (i === 0) { // Blob 1: Teal Base
                r = Math.floor(74 + 30 * Math.sin(elapsed * 0.002));
                g = Math.floor(144 + 20 * Math.cos(elapsed * 0.001));
                b = Math.floor(255);
            } else if (i === 1) { // Blob 2: Magenta Energy
                r = Math.floor(230 - 50 * Math.sin(elapsed * 0.001));
                g = Math.floor(74 + 20 * Math.cos(elapsed * 0.002));
                b = Math.floor(220);
            } else if (i === 2) { // Blob 3: Purple Deep Flow
                r = Math.floor(150);
                g = Math.floor(80);
                b = Math.floor(240 - 10 * Math.sin(elapsed * 0.001));
            } else { // Remaining Blobs (Generic)
                 r = Math.floor((i * 50 + 100));
                 g = Math.floor((i * 30 + 150));
                 b = Math.floor(Math.random() * 200);
            }


            // Draw the blob
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.4 + (i / BLOBS_COUNT) * 0.3})`; // Variable opacity for depth
            ctx.filter = `blur(${BLUR_RADIUS}px)`; 
            ctx.beginPath();
            // The arc is centered at the calculated drifting position
            ctx.arc(sourceX + offsetX, sourceY + offsetY, currentRadius, 0, Math.PI * 2);
            ctx.fill();
        }

    }, []);


    // --- React Lifecycle Management (Same as before - this part is correct) ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        function setCanvasSize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', setCanvasSize);
        setCanvasSize();

        let startTime = Date.now();
        
        const animate = () => {
            // We call the draw function here every frame
            draw(ctx, canvas, startTime);
            animationFrameId.current = requestAnimationFrame(() => draw(ctx, canvas, startTime));
        };

        animate();

        return () => {
            window.removeEventListener('resize', setCanvasSize);
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };

    }, [draw]);

    // --- RENDER OUTPUT ---
    return (
        <canvas 
            ref={canvasRef} 
            id="holoCanvas"
            style={{ display: 'block', width: '100%', height: '100%' }}
        />
    );
};

export default HoloCanvas;
