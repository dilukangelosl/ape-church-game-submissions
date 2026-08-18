'use client';

import React from 'react';
import { WinLevel } from './WinParticles';

// DOM-based shower of the game's tiger-cub coins. CSS rotateY gives each coin
// a 3D flip that WebGL point sprites can't do; a few dozen images is cheap.

const COIN_SRC = '/submissions/legend-of-the-gold-cub/win/coin.webp';

const COUNTS: Record<NonNullable<WinLevel>, number> = {
  small: 10,
  big: 28,
  mega: 46,
  jackpot: 68,
  freespins: 22,
};

interface Coin {
  left: number;   // % of container width
  delay: number;  // s
  dur: number;    // s
  size: number;   // px
  spin: number;   // s per flip
  sway: number;   // px horizontal drift over the fall
  tilt: number;   // deg final z-rotation
}

// Pre-randomized at module load (render must stay pure per react-hooks/purity).
// Each win slices the first N — with dozens of coins in motion the repetition
// between showers is imperceptible.
const COIN_POOL: Coin[] = Array.from({ length: 68 }, () => ({
  left: 2 + Math.random() * 96,
  delay: Math.random() * 0.9,
  dur: 1.5 + Math.random() * 1.4,
  size: 22 + Math.random() * 28,
  spin: 0.45 + Math.random() * 0.75,
  sway: -40 + Math.random() * 80,
  tilt: -50 + Math.random() * 100,
}));

export default function CoinShower({ winLevel }: { winLevel: WinLevel }) {
  if (!winLevel) return null;
  const coins = COIN_POOL.slice(0, COUNTS[winLevel]);

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
      {coins.map((c, i) => (
        <div
          key={`${winLevel}-${i}`}
          className="absolute"
          style={{
            left: `${c.left}%`,
            top: -64,
            width: c.size,
            height: c.size,
            ['--sway' as string]: `${c.sway}px`,
            ['--tilt' as string]: `${c.tilt}deg`,
            animation: `coinFall ${c.dur}s cubic-bezier(0.3, 0, 0.75, 0.5) ${c.delay}s both`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={COIN_SRC}
            alt=""
            className="w-full h-full"
            style={{
              animation: `coinSpin ${c.spin}s linear infinite`,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.55))',
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes coinFall {
          from { transform: translate3d(0, 0, 0) rotate(0deg); }
          to   { transform: translate3d(var(--sway), 1100px, 0) rotate(var(--tilt)); }
        }
        @keyframes coinSpin {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(360deg); }
        }
      `}</style>
    </div>
  );
}
