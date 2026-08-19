'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface FreeSpinsIntroProps {
  spinsAwarded: number;
}

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  baseScale: number;
}

export default function FreeSpinsIntro({ spinsAwarded }: FreeSpinsIntroProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth;
    const H = el.clientHeight;

    // Scene
    const scene    = new THREE.Scene();
    const camera   = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 1000);
    camera.position.z = 100;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    // Particle geometry — small diamond-ish octahedron for sparkle feel
    const geo = new THREE.OctahedronGeometry(4, 0);

    const COLORS = [0xFFD700, 0xFF8C00, 0xFFE066, 0x00D4FF, 0xFFFFFF, 0xFFA040];

    const particles: Particle[] = [];
    const COUNT = 120;

    for (let i = 0; i < COUNT; i++) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);

      // All start at center
      mesh.position.set(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        0,
      );

      const angle   = Math.random() * Math.PI * 2;
      const speed   = 1.5 + Math.random() * 5;
      const maxLife = 90 + Math.random() * 60;

      particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 0,
        life: 0,
        maxLife,
        baseScale: 0.4 + Math.random() * 1.2,
      });

      scene.add(mesh);
    }

    // Soft background radial glow via a large circle plane
    const bgGeo = new THREE.CircleGeometry(Math.max(W, H) * 0.6, 64);
    const bgMat = new THREE.MeshBasicMaterial({
      color: 0x001a22,
      transparent: true,
      opacity: 0,
    });
    const bgCircle = scene.add(new THREE.Mesh(bgGeo, bgMat));
    void bgCircle;

    let frame = 0;
    let rafId = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      frame++;

      for (const p of particles) {
        p.life++;
        const t = p.life / p.maxLife;

        // Gravity-ish arc
        p.vy -= 0.04;

        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.rotation.x += 0.06;
        p.mesh.rotation.y += 0.04;

        // Scale: burst in then shrink out
        const scale = p.baseScale * Math.sin(t * Math.PI);
        p.mesh.scale.setScalar(Math.max(scale, 0.01));

        // Fade out in last 30% of life
        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;

        // Respawn
        if (p.life >= p.maxLife) {
          p.life = 0;
          p.mesh.position.set(
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 30,
            0,
          );
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.5 + Math.random() * 5;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed;
          const color = COLORS[Math.floor(Math.random() * COLORS.length)];
          mat.color.setHex(color);
          p.maxLife = 90 + Math.random() * 60;
        }
      }

      renderer.render(scene, camera);
    };

    tick();

    return () => {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      particles.forEach(p => {
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.MeshBasicMaterial).dispose();
      });
    };
  }, []);

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none overflow-hidden">

      {/* Three.js canvas layer */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Dark radial backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,30,40,0.82) 0%, rgba(0,0,0,0.92) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-2 sm:gap-3">

        {/* Top label */}
        <p
          className="text-xs sm:text-sm font-bold tracking-[0.35em] uppercase"
          style={{ color: 'rgba(232,200,106,0.8)', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
        >
          Golden Cubs Have Spoken
        </p>

        {/* Main title — carved-gold plaque in the game's logo style */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/submissions/legend-of-the-gold-cub/win/free-spins.webp"
          alt="Free Spins"
          className="w-[min(78%,560px)] object-contain"
          style={{
            filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.7)) drop-shadow(0 0 26px rgba(255,180,0,0.35))',
            animation: 'fsPlaquePulse 1.6s ease-in-out infinite',
          }}
        />

        {/* Spin count — gold counter pill matching the win display */}
        <div
          className="mt-1 px-6 py-1.5 rounded-full flex items-baseline gap-2"
          style={{
            background: 'linear-gradient(135deg, rgba(14,8,0,0.86) 0%, rgba(48,26,0,0.8) 100%)',
            border: '1.5px solid rgba(212,160,23,0.8)',
            boxShadow: '0 0 16px rgba(212,160,23,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <span
            className="font-black tabular-nums leading-none text-4xl"
            style={{
              color: '#FFD700',
              textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 14px rgba(255,200,0,0.55)',
            }}
          >
            {spinsAwarded}
          </span>
          <span className="text-xs font-bold tracking-widest uppercase text-white/60">
            spins
          </span>
        </div>

        {/* Thin gold divider */}
        <div style={{
          width: 160,
          height: 1,
          background: 'linear-gradient(90deg, transparent, #D4A017, transparent)',
          marginTop: 4,
        }} />

        <p
          className="text-xs tracking-widest uppercase"
          style={{ color: 'rgba(212,160,23,0.55)' }}
        >
          Spins on the house
        </p>
      </div>

      <style>{`
        @keyframes fsPlaquePulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.035); }
        }
      `}</style>
    </div>
  );
}
