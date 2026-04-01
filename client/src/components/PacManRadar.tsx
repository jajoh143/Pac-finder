import { useEffect, useRef, useCallback } from 'react';
import type { FriendBlip } from '../types/index.ts';
import { GHOST_HEX } from '../types/index.ts';

interface Props {
  blips: FriendBlip[];
  myAccuracy?: number;
}

const MAX_RANGE = 200; // metres shown on radar
const RANGE_RINGS = [25, 50, 100, 200]; // metres
const SWEEP_SPEED = (Math.PI * 2) / 5; // full rotation every 5 seconds

interface BlipTrail {
  fade: number;
}

export function PacManRadar({ blips, myAccuracy }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sweepAngleRef = useRef<number>(-Math.PI / 2); // start at North (top)
  const lastTimeRef = useRef<number>(0);
  const blipTrailsRef = useRef<Map<string, BlipTrail>>(new Map());
  const animRef = useRef<number>(0);
  const blipsRef = useRef<FriendBlip[]>(blips);
  const accuracyRef = useRef<number | undefined>(myAccuracy);

  // Keep refs in sync so the animation loop always has fresh data
  blipsRef.current = blips;
  accuracyRef.current = myAccuracy;

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    const cx = W / 2;
    const cy = H / 2;
    const maxR = Math.min(W, H) / 2 - 4;

    // Delta time
    const delta = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0;
    lastTimeRef.current = timestamp;

    // Advance sweep angle
    sweepAngleRef.current = (sweepAngleRef.current + SWEEP_SPEED * delta) % (Math.PI * 2);
    const sweep = sweepAngleRef.current;

    // Update blip trails: check if sweep passed over any blip this frame
    const currentBlips = blipsRef.current;
    for (const blip of currentBlips) {
      // Convert bearing (0=north, CW) to canvas angle (0=east, CCW for standard math)
      const blipRad = bearingToCanvasAngle(blip.bearing);
      // Normalize sweep to same domain
      const sweepNorm = ((sweep % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const blipNorm = ((blipRad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const diff = (sweepNorm - blipNorm + Math.PI * 2) % (Math.PI * 2);

      let trail = blipTrailsRef.current.get(blip.member.id);
      if (!trail) {
        trail = { fade: 0 };
        blipTrailsRef.current.set(blip.member.id, trail);
      }

      if (diff < SWEEP_SPEED * delta + 0.05) {
        trail.fade = 1.0;
      } else {
        trail.fade = Math.max(0.2, trail.fade - 0.5 * delta);
      }
    }

    // ── Clear ────────────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, W, H);

    // ── Radar background circle ───────────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fillStyle = '#001a00';
    ctx.fill();
    ctx.restore();

    // ── Range rings ───────────────────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = '#003300';
    ctx.lineWidth = 1;
    for (const metres of RANGE_RINGS) {
      const r = (metres / MAX_RANGE) * maxR;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      // Ring label
      ctx.fillStyle = '#005500';
      ctx.font = '8px monospace';
      ctx.fillText(`${metres}m`, cx + 4, cy - r + 10);
    }
    ctx.restore();

    // ── Crosshairs ───────────────────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = '#002200';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy - maxR);
    ctx.lineTo(cx, cy + maxR);
    ctx.moveTo(cx - maxR, cy);
    ctx.lineTo(cx + maxR, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // ── Accuracy circle around user ───────────────────────────────────────────
    const accuracy = accuracyRef.current;
    if (accuracy && accuracy > 0) {
      const accuracyR = Math.min((accuracy / MAX_RANGE) * maxR, maxR);
      ctx.save();
      ctx.strokeStyle = accuracy > 50 ? '#ff440033' : '#00ff0022';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, accuracyR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Sweep gradient ────────────────────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    // Draw trailing sector (about 60 degrees behind sweep)
    const sectorStart = sweep - Math.PI / 3;
    ctx.arc(cx, cy, maxR, sectorStart, sweep);
    ctx.closePath();
    // Fallback: use a simple fill with multiple overlapping arcs
    ctx.fillStyle = 'rgba(0, 255, 0, 0.06)';
    ctx.fill();
    ctx.restore();

    // Draw sweep line
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweep) * maxR, cy + Math.sin(sweep) * maxR);
    ctx.stroke();
    ctx.restore();

    // ── Radar border ─────────────────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // ── Ghost blips ───────────────────────────────────────────────────────────
    for (const blip of currentBlips) {
      const trail = blipTrailsRef.current.get(blip.member.id);
      const opacity = trail ? trail.fade : 0.3;
      const { x, y, clamped } = blipToCanvas(blip.bearing, blip.distance, cx, cy, maxR);

      if (clamped) {
        // Draw directional arrow at edge
        drawEdgeArrow(ctx, cx, cy, blip.bearing, maxR, GHOST_HEX[blip.member.color], opacity);
      } else {
        drawGhost(ctx, x, y, GHOST_HEX[blip.member.color], opacity, 11);
        // Name label
        if (opacity > 0.4) {
          ctx.save();
          ctx.fillStyle = `rgba(255,255,255,${opacity * 0.8})`;
          ctx.font = '7px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(blip.member.name.slice(0, 8), x, y + 18);
          ctx.restore();
        }
      }
    }

    // ── Pac-Man at center ─────────────────────────────────────────────────────
    drawPacMan(ctx, cx, cy, 14, timestamp);

    animRef.current = requestAnimationFrame(draw);
  }, []);

  // Setup canvas and start loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio ?? 1;
      const size = Math.min(window.innerWidth, window.innerHeight) - 8;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', margin: 'auto' }}
    />
  );
}

// ─── Canvas helpers ────────────────────────────────────────────────────────────

/** Convert bearing (0=north, clockwise) to canvas angle (0=east, counter-clockwise) */
function bearingToCanvasAngle(bearing: number): number {
  return (bearing - 90) * (Math.PI / 180);
}

function blipToCanvas(
  bearing: number,
  distance: number,
  cx: number,
  cy: number,
  maxR: number
): { x: number; y: number; clamped: boolean } {
  const clamped = distance > MAX_RANGE;
  const clampedDist = Math.min(distance, MAX_RANGE);
  const r = (clampedDist / MAX_RANGE) * maxR;
  const angle = bearingToCanvasAngle(bearing);
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
    clamped,
  };
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  opacity: number,
  size: number
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  // Head semicircle
  ctx.arc(x, y, size, Math.PI, 0, false);
  // Right side down
  ctx.lineTo(x + size, y + size * 0.9);
  // Bottom bumps (3 arcs)
  const bR = size / 3;
  ctx.arc(x + size - bR, y + size * 0.9, bR, 0, Math.PI, false);
  ctx.arc(x, y + size * 0.9, bR, 0, Math.PI, false);
  ctx.arc(x - size + bR, y + size * 0.9, bR, 0, Math.PI, false);
  // Left side up
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();

  // White eyes
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(x - size * 0.35, y - size * 0.1, size * 0.22, 0, Math.PI * 2);
  ctx.arc(x + size * 0.35, y - size * 0.1, size * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Blue pupils
  ctx.fillStyle = '#0000CC';
  ctx.beginPath();
  ctx.arc(x - size * 0.28, y - size * 0.05, size * 0.1, 0, Math.PI * 2);
  ctx.arc(x + size * 0.42, y - size * 0.05, size * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPacMan(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  timestamp: number
) {
  const mouthOpen = 0.25 + 0.2 * Math.abs(Math.sin(timestamp / 120));
  ctx.save();
  ctx.fillStyle = '#FFE000';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, radius, mouthOpen, Math.PI * 2 - mouthOpen);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(x + radius * 0.2, y - radius * 0.55, radius * 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Glow
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#FFE000';
  ctx.beginPath();
  ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawEdgeArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  bearing: number,
  maxR: number,
  color: string,
  opacity: number
) {
  const angle = bearingToCanvasAngle(bearing);
  const edgeX = cx + (maxR - 10) * Math.cos(angle);
  const edgeY = cy + (maxR - 10) * Math.sin(angle);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.translate(edgeX, edgeY);
  ctx.rotate(angle + Math.PI / 2);

  // Triangle arrow
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5, 4);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
