/**
 * The moving ground (D-68 §3).
 *
 * A few large, slow, blurred discs of the accent hues drifting behind the
 * page — Canvas rather than a dozen animated DOM nodes, because one canvas
 * repaints cheaply and can be paused. It is decoration, and it behaves like
 * decoration: `aria-hidden`, behind everything, paused when the tab is
 * hidden, and not drawn at all under `prefers-reduced-motion: reduce`
 * (WCAG 2.3.3), where a still gradient from the stylesheet remains.
 */

import { useEffect, useRef } from "react";

interface Blob {
  x: number;
  y: number;
  r: number;
  dx: number;
  dy: number;
  hue: [number, number, number];
}

export function AmbientBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;
    const context = canvas.getContext("2d");
    if (context === null) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      // Draw at half resolution: the discs are blurred anyway.
      canvas.width = Math.ceil(width / 2);
      canvas.height = Math.ceil(height / 2);
    };
    resize();

    const blobs: Blob[] = [
      {
        x: 0.15,
        y: 0.1,
        r: 0.42,
        dx: 0.00009,
        dy: 0.00006,
        hue: [99, 102, 241],
      },
      {
        x: 0.85,
        y: 0.05,
        r: 0.36,
        dx: -0.00007,
        dy: 0.00008,
        hue: [56, 189, 248],
      },
      {
        x: 0.55,
        y: 0.85,
        r: 0.4,
        dx: 0.00005,
        dy: -0.00007,
        hue: [129, 140, 248],
      },
    ];

    let frame = 0;
    let last = performance.now();
    let running = true;

    const draw = (now: number) => {
      if (!running) return;
      const dt = Math.min(64, now - last);
      last = now;
      const w = canvas.width;
      const h = canvas.height;
      context.clearRect(0, 0, w, h);
      for (const blob of blobs) {
        blob.x += blob.dx * dt;
        blob.y += blob.dy * dt;
        if (blob.x < -0.2 || blob.x > 1.2) blob.dx = -blob.dx;
        if (blob.y < -0.2 || blob.y > 1.2) blob.dy = -blob.dy;
        const cx = blob.x * w;
        const cy = blob.y * h;
        const radius = blob.r * Math.max(w, h);
        const gradient = context.createRadialGradient(
          cx,
          cy,
          0,
          cx,
          cy,
          radius,
        );
        const [r, g, b] = blob.hue;
        gradient.addColorStop(
          0,
          `rgba(${String(r)}, ${String(g)}, ${String(b)}, 0.20)`,
        );
        gradient.addColorStop(
          1,
          `rgba(${String(r)}, ${String(g)}, ${String(b)}, 0)`,
        );
        context.fillStyle = gradient;
        context.fillRect(0, 0, w, h);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    const visibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      style={{ filter: "blur(40px)" }}
    />
  );
}
