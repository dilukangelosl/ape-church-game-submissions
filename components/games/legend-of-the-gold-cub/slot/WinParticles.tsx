'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type WinLevel = null | 'small' | 'big' | 'mega' | 'jackpot' | 'freespins';

// ── Particle definition ───────────────────────────────────────────────────────

interface P {
  x: number; y: number;
  vx: number; vy: number;
  ax: number; ay: number;    // acceleration
  r: number; g: number; b: number;
  size: number;
  life: number;              // remaining life, 0 = dead
  maxLife: number;
}

// ── Config per win level ──────────────────────────────────────────────────────

interface Emitter {
  count:   number;
  ox: () => number;   // origin x relative to canvas width
  oy: () => number;   // origin y relative to canvas height (0=top)
  vxFn:   () => number;
  vyFn:   () => number;
  axFn:   () => number;
  ayFn:   () => number;
  colorFn: () => [number, number, number];
  sizeFn:  () => number;
  lifeFn:  () => number;
}

const rand  = (a: number, b: number) => a + Math.random() * (b - a);
const angle = (deg: number) => deg * Math.PI / 180;

function emittersFor(level: WinLevel, W: number, H: number): P[] {
  const particles: P[] = [];

  const emit = (cfg: Emitter) => {
    for (let i = 0; i < cfg.count; i++) {
      const life = cfg.lifeFn();
      particles.push({
        x: cfg.ox() * W,
        y: cfg.oy() * H,
        vx: cfg.vxFn(),
        vy: cfg.vyFn(),
        ax: cfg.axFn(),
        ay: cfg.ayFn(),
        r: 0, g: 0, b: 0,
        size: cfg.sizeFn(),
        life,
        maxLife: life,
      });
      const [r, g, b] = cfg.colorFn();
      particles[particles.length - 1].r = r;
      particles[particles.length - 1].g = g;
      particles[particles.length - 1].b = b;
    }
  };

  // Gold sparkle (any win)
  const goldSparkle = (count: number, ox: number, oy: number): void => emit({
    count,
    ox: () => ox + rand(-0.15, 0.15),
    oy: () => oy + rand(-0.05, 0.05),
    vxFn:  () => rand(-120, 120),
    vyFn:  () => rand(-300, -80),
    axFn:  () => rand(-10, 10),
    ayFn:  () => 220,   // gravity
    colorFn: () => {
      const t = Math.random();
      return t < 0.5 ? [1, 0.85, 0.1] : [1, 1, 0.4]; // gold / bright yellow
    },
    sizeFn: () => rand(3, 7),
    lifeFn: () => rand(0.6, 1.4),
  });

  // White flash burst from center
  const flashBurst = (count: number, speed: number): void => emit({
    count,
    ox: () => 0.5,
    oy: () => 0.5,
    vxFn:  () => { const s = rand(80, speed); const a = rand(0, 360); return Math.cos(angle(a)) * s; },
    vyFn:  () => { const s = rand(80, speed); const a = rand(0, 360); return Math.sin(angle(a)) * s; },
    axFn:  () => 0,
    ayFn:  () => 60,
    colorFn: () => Math.random() < 0.5 ? [1, 1, 0.8] : [1, 0.7, 0.1],
    sizeFn: () => rand(4, 10),
    lifeFn: () => rand(0.5, 1.2),
  });

  // (Coin rain is handled by the DOM-based CoinShower — branded tiger coins
  //  that actually flip, which point sprites can't.)

  // Blue/cyan swirl for free spins
  const freeSpinSwirl = (count: number): void => emit({
    count,
    ox: () => 0.5 + rand(-0.25, 0.25),
    oy: () => 0.7 + rand(-0.15, 0.15),
    vxFn:  () => rand(-150, 150),
    vyFn:  () => rand(-350, -100),
    axFn:  () => rand(-30, 30),
    ayFn:  () => 100,
    colorFn: () => {
      const t = Math.random();
      if (t < 0.4) return [0.1, 0.8, 1.0];     // cyan
      if (t < 0.7) return [0.4, 0.2, 1.0];     // purple
      return [1, 1, 1];                          // white
    },
    sizeFn: () => rand(4, 9),
    lifeFn: () => rand(0.7, 1.6),
  });

  switch (level) {
    case 'small':
      goldSparkle(50, 0.5, 0.7);
      break;

    case 'big':
      goldSparkle(120, 0.5, 0.6);
      flashBurst(60, 250);
      break;

    case 'mega':
      flashBurst(180, 380);
      goldSparkle(120, 0.3, 0.5);
      goldSparkle(120, 0.7, 0.5);
      break;

    case 'jackpot':
      flashBurst(250, 500);
      goldSparkle(150, 0.25, 0.5);
      goldSparkle(150, 0.5,  0.4);
      goldSparkle(150, 0.75, 0.5);
      break;

    case 'freespins':
      freeSpinSwirl(200);
      goldSparkle(80, 0.5, 0.6);
      break;

    default:
      break;
  }

  return particles;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface WinParticlesProps {
  winLevel: WinLevel;
}

export default function WinParticles({ winLevel }: WinParticlesProps) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const glRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene:    THREE.Scene;
    camera:   THREE.OrthographicCamera;
    points:   THREE.Points;
    pos:      Float32Array;
    col:      Float32Array;
    siz:      Float32Array;
    geo:      THREE.BufferGeometry;
    rafId:    number;
    W: number; H: number;
  } | null>(null);

  const particlesRef = useRef<P[]>([]);
  const lastTimeRef  = useRef(0);

  // ── Mount ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth  || 500;
    const H = el.clientHeight || 400;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    el.appendChild(renderer.domElement);

    // Camera: x=0..W, y=0..H (y-down), origin top-left
    const camera = new THREE.OrthographicCamera(0, W, 0, -H, 0.1, 100);
    camera.position.z = 10;

    const scene = new THREE.Scene();

    const MAX = 800;
    const pos = new Float32Array(MAX * 3);
    const col = new Float32Array(MAX * 3);
    const siz = new Float32Array(MAX);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(siz, 1));

    const mat = new THREE.PointsMaterial({
      size:            8,
      sizeAttenuation: false,
      vertexColors:    true,
      transparent:     true,
      opacity:         1,
      blending:        THREE.AdditiveBlending,
      depthWrite:      false,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // Idle loop
    let rafId = 0;
    const idle = () => {
      if (!mountedRef.current) return;
      rafId = requestAnimationFrame(idle);
      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(idle);

    glRef.current = { renderer, scene, camera, points, pos, col, siz, geo, rafId, W, H };

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafId);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      glRef.current = null;
    };
  }, []);

  // ── Trigger particles when winLevel changes ────────────────────────────────

  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !winLevel) {
      particlesRef.current = [];
      return;
    }

    const { W, H } = gl;
    particlesRef.current = emittersFor(winLevel, W, H);

    cancelAnimationFrame(gl.rafId);
    lastTimeRef.current = 0;

    const { renderer, scene, camera, pos, col, siz, geo } = gl;

    const loop = (ts: number) => {
      if (!mountedRef.current) return;
      gl.rafId = requestAnimationFrame(loop);

      const dt = lastTimeRef.current ? Math.min((ts - lastTimeRef.current) / 1000, 0.05) : 0.016;
      lastTimeRef.current = ts;

      const ps = particlesRef.current;
      let alive = 0;

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p.life <= 0) continue;

        p.life -= dt;
        if (p.life <= 0) { p.life = 0; continue; }

        p.vx += p.ax * dt;
        p.vy += p.ay * dt;
        p.x  += p.vx * dt;
        p.y  += p.vy * dt;

        // Fade out as life decreases
        const lifeFrac = p.life / p.maxLife;
        const alpha    = lifeFrac < 0.2 ? lifeFrac / 0.2 : 1.0;

        const j = alive;
        pos[j * 3]     = p.x;
        pos[j * 3 + 1] = -p.y;  // flip y for Three.js y-up camera
        pos[j * 3 + 2] = 0;

        col[j * 3]     = p.r * alpha;
        col[j * 3 + 1] = p.g * alpha;
        col[j * 3 + 2] = p.b * alpha;

        siz[j] = p.size * (0.5 + 0.5 * lifeFrac);

        alive++;
        if (alive >= 800) break;
      }

      // Zero out dead slots
      for (let j = alive; j < 800; j++) {
        pos[j * 3] = pos[j * 3 + 1] = pos[j * 3 + 2] = 0;
        col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = 0;
        siz[j] = 0;
      }

      geo.setDrawRange(0, Math.max(alive, 1));
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate    = true;
      geo.attributes.size.needsUpdate     = true;

      renderer.render(scene, camera);
    };

    gl.rafId = requestAnimationFrame(loop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winLevel]);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 40,
        overflow: 'hidden',
      }}
    />
  );
}
