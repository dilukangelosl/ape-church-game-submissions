'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import useSound from 'use-sound';
import { Game } from '@/lib/games';
import { GameState, SymbolId } from './types';
import { ALL_SYMBOL_IDS, NUM_REELS, NUM_ROWS, NUM_PAYLINES } from './myGameConfig';
import ReelStrip from './slot/ReelStrip';
import GlowBorder from './slot/GlowBorder';
import WinParticles, { WinLevel } from './slot/WinParticles';
import CoinShower from './slot/CoinShower';
import FreeSpinsIntro from './slot/FreeSpinsIntro';

interface MyGameWindowProps {
  game: Game;
  gameState: GameState;
  isActive: boolean;
  onAllReelsStopped: () => void;
  spinTrigger: number;
  betPerLine: number;
}

const REEL_DELAYS = [700, 950, 1200, 1450, 1700];

const IDLE_SYMBOLS: SymbolId[][] = [
  ['golden_cub',         'gold_apechain_tiger', 'apechain_cowboy'],
  ['camo_cub',           'og_top_hat',          'green_cub'      ],
  ['purple_cub',         'camo_cub',            'golden_cub'     ],
  ['gold_apechain_tiger','apechain_cowboy',      'og_top_hat'     ],
  ['green_cub',          'camo_cub',            'purple_cub'     ],
];

function winLevelFor(lastSpinWin: number, betPerLine: number, hasWinLines: boolean): WinLevel {
  if (!hasWinLines && lastSpinWin <= 0) return null;
  // Compare against the TOTAL BET (betPerLine × 20 paylines) — not betPerLine alone.
  // On a 5 APE bet: totalBet=5, big=50 APE, mega=100 APE, jackpot=250 APE.
  const totalBet = betPerLine * NUM_PAYLINES;
  if (lastSpinWin >= totalBet * 50) return 'jackpot';
  if (lastSpinWin >= totalBet * 20) return 'mega';
  if (lastSpinWin >= totalBet * 10) return 'big';
  if (lastSpinWin > 0)              return 'small';
  return null;
}

export default function MyGameWindow({
  game,
  gameState,
  isActive,
  onAllReelsStopped,
  spinTrigger,
  betPerLine,
}: MyGameWindowProps) {
  const muteSfx    = false;
  const sfxVolume  = 0.6;
  const [winSFX]        = useSound('/submissions/legend-of-the-gold-cub/sfx/win.mp3',        { volume: sfxVolume,       soundEnabled: !muteSfx, interrupt: true });
  const [bigWinSFX]     = useSound('/submissions/legend-of-the-gold-cub/sfx/big-win.mp3',    { volume: sfxVolume,       soundEnabled: !muteSfx, interrupt: true });
  const [freeSpinSFX]   = useSound('/submissions/legend-of-the-gold-cub/sfx/free-spins.mp3', { volume: sfxVolume * 0.9, soundEnabled: !muteSfx, interrupt: true });
  const [noWinSFX]      = useSound('/submissions/legend-of-the-gold-cub/sfx/no-win.mp3',     { volume: sfxVolume * 0.55,soundEnabled: !muteSfx, interrupt: true });
  const [spinStartSFX]  = useSound('/submissions/legend-of-the-gold-cub/sfx/spin-start.mp3', { volume: sfxVolume,       soundEnabled: !muteSfx, interrupt: true });
  const [reelDropSFX]   = useSound('/submissions/legend-of-the-gold-cub/sfx/reel-drop.mp3',  { volume: sfxVolume * 0.8, soundEnabled: !muteSfx });
  const [reelSpinPlay, { stop: reelSpinStop, sound: reelSpinHowl }] = useSound(
    '/submissions/legend-of-the-gold-cub/sfx/reel-spin.mp3',
    { volume: sfxVolume * 0.7, loop: true, soundEnabled: !muteSfx }
  );
  const reelSpinActiveRef = useRef(false);

  const [spinning, setSpinning]       = useState<boolean[]>(Array(NUM_REELS).fill(false));

  // Win display
  const [winLevel, setWinLevel]             = useState<WinLevel>(null);
  const [winCounterVal, setWinCounterVal]   = useState(0);
  const [showWinDisplay, setShowWinDisplay] = useState(false);
  const [flashOpacity, setFlashOpacity]     = useState(0);
  const [counterDone, setCounterDone]       = useState(false);

  const winIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimerRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const winTargetRef   = useRef(0); // used by skip handler
  const stoppedRef     = useRef(0);
  const prevTriggerRef = useRef(0);

  const hasResolvedReels = gameState.reels.length === NUM_REELS
    && gameState.reels.every(r => r.length === NUM_ROWS);
  const visibleReels = hasResolvedReels ? gameState.reels : IDLE_SYMBOLS;

  // Per-reel win highlight rows
  const reelHighlights: number[][] = Array.from({ length: NUM_REELS }, () => []);
  if (gameState.phase === 'WIN_DISPLAY') {
    for (const wl of gameState.activeWinLines) {
      for (let r = 0; r < wl.count && r < NUM_REELS; r++) {
        if (!reelHighlights[r].includes(wl.positions[r])) {
          reelHighlights[r].push(wl.positions[r]);
        }
      }
    }
  }

  // Kick reel animations
  useEffect(() => {
    if (spinTrigger === 0 || spinTrigger === prevTriggerRef.current) return;
    prevTriggerRef.current = spinTrigger;
    stoppedRef.current = 0;

    // Clear previous win display
    setWinLevel(null);
    setShowWinDisplay(false);
    setCounterDone(false);
    setFlashOpacity(0);
    winTargetRef.current = 0;
    if (winIntervalRef.current) clearInterval(winIntervalRef.current);
    if (flashTimerRef.current)  clearTimeout(flashTimerRef.current);

    // Play spin-start SFX then loop the reel-spin tick
    spinStartSFX();
    reelSpinPlay();
    reelSpinActiveRef.current = true;

    setSpinning(Array(NUM_REELS).fill(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinTrigger]);

  const handleReelStopped = useCallback(() => {
    reelDropSFX();
    stoppedRef.current += 1;
    if (stoppedRef.current === NUM_REELS) {
      setSpinning(Array(NUM_REELS).fill(false));
      // Fade out the reel spin loop over 300ms then stop it
      if (reelSpinActiveRef.current) {
        reelSpinActiveRef.current = false;
        const howl = reelSpinHowl as { fade?: (from: number, to: number, duration: number) => void } | null;
        if (howl?.fade) {
          howl.fade(sfxVolume * 0.7, 0, 300);
          setTimeout(() => reelSpinStop(), 320);
        } else {
          reelSpinStop();
        }
      }
      onAllReelsStopped();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reelDropSFX, reelSpinHowl, reelSpinStop, onAllReelsStopped]);

  // Win display logic — fires when phase becomes WIN_DISPLAY
  useEffect(() => {
    if (gameState.phase !== 'WIN_DISPLAY') {
      setWinLevel(null);
      setShowWinDisplay(false);
      return;
    }

    const { lastSpinWin, activeWinLines } = gameState;
    const hasWin = lastSpinWin > 0;

    if (!hasWin && activeWinLines.length === 0) {
      noWinSFX();
      return;
    }

    const level = winLevelFor(lastSpinWin, betPerLine, activeWinLines.length > 0);

    // Scatter → free spins SFX takes priority over regular win SFX
    if (gameState.scatterCount >= 3) {
      freeSpinSFX();
    } else if (level === 'jackpot' || level === 'mega' || level === 'big') {
      bigWinSFX();
    } else {
      winSFX();
    }
    setWinLevel(level);
    setShowWinDisplay(true);
    setCounterDone(false);

    // Screen flash for big/mega/jackpot
    if (level === 'jackpot' || level === 'mega' || level === 'big') {
      setFlashOpacity(0.7);
      flashTimerRef.current = setTimeout(() => setFlashOpacity(0), 300);
    }

    // Counter duration scales with win size
    const durationMs = level === 'jackpot' ? 4000
                     : level === 'mega'    ? 3000
                     : level === 'big'     ? 2500
                     :                       1800;

    const target = lastSpinWin;
    const steps  = 60;
    winTargetRef.current = target;
    setWinCounterVal(0);

    if (winIntervalRef.current) clearInterval(winIntervalRef.current);
    let step = 0;
    winIntervalRef.current = setInterval(() => {
      step++;
      // Ease-out cubic — fast climb then slows dramatically
      const eased = 1 - Math.pow(1 - step / steps, 3);
      setWinCounterVal(target * Math.min(eased, 1));
      if (step >= steps) {
        clearInterval(winIntervalRef.current!);
        setCounterDone(true);
      }
    }, durationMs / steps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.phase]);

  // Skip counter animation when user taps screen during WIN_DISPLAY
  const handleScreenTap = useCallback(() => {
    if (gameState.phase !== 'WIN_DISPLAY') return;
    if (winIntervalRef.current) {
      clearInterval(winIntervalRef.current);
      winIntervalRef.current = null;
    }
    setWinCounterVal(winTargetRef.current);
    setCounterDone(true);
  }, [gameState.phase]);

  const isSpinningAny = spinning.some(Boolean);

  // Branded win banner art + accent glow per level (banners generated in the
  // Legend of the Gold Cub logo style — carved stone, gold letters, gems)
  const winStyleMap: Record<NonNullable<WinLevel>, { banner: string; glow: string; width: string }> = {
    small:    { banner: '/submissions/legend-of-the-gold-cub/win/win.webp',      glow: '#FFD700', width: 'min(48%, 300px)' },
    big:      { banner: '/submissions/legend-of-the-gold-cub/win/big-win.webp',  glow: '#FF8C00', width: 'min(64%, 440px)' },
    mega:     { banner: '/submissions/legend-of-the-gold-cub/win/mega-win.webp', glow: '#FF4500', width: 'min(74%, 530px)' },
    jackpot:  { banner: '/submissions/legend-of-the-gold-cub/win/jackpot.webp',  glow: '#FF2200', width: 'min(82%, 590px)' },
    freespins:{ banner: '/submissions/legend-of-the-gold-cub/win/win.webp',      glow: '#00CFFF', width: 'min(54%, 340px)' },
  };
  const isBigWin = winLevel === 'big' || winLevel === 'mega' || winLevel === 'jackpot';

  return (
    <div
      // container-type:size lets the play column cap its width off the HUD
      // stage's *height* (cqh) so the reels never outgrow a short wide stage.
      className="absolute inset-0 z-0 flex flex-col items-center justify-center select-none overflow-hidden px-2 sm:px-4 lg:px-7 lg:[container-type:size]"
      onClick={handleScreenTap}
    >

      {/* Full-res background. The shared GameWindow serves its copy through
          next/Image at width=719, which blurs when stretched across the wide
          HUD stage — so we paint the 2560×1440 master ourselves. object-cover
          center keeps the safe-square content visible at every aspect, down
          to the 1:1 mobile crop. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={game.gameBackground}
        alt=""
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* Screen flash overlay — fires on big/mega/jackpot */}
      <div
        className="absolute inset-0 z-50 pointer-events-none"
        style={{
          background: 'white',
          opacity: flashOpacity,
          transition: 'opacity 0.3s ease-out',
        }}
      />

      {/* Three.js particle system — active during WIN_DISPLAY */}
      <WinParticles winLevel={gameState.phase === 'WIN_DISPLAY' ? winLevel : null} />

      {/* Branded tiger-coin shower — falls with the win display */}
      <CoinShower winLevel={gameState.phase === 'WIN_DISPLAY' ? winLevel : null} />

      {/* Play column: logo + reels. On the wide HUD stage its width is capped by
          the stage height (logo ≈ 0.24×width, grid ≈ 0.6×width + chrome) so the
          whole column always fits vertically, centered with background flanking
          it on wide monitors. Below lg it is simply full width, as before. */}
      <div className="relative z-10 w-full flex flex-col items-center lg:max-w-[min(100%,880px,calc((100cqh_-_260px)*1.55))]">

      {/* Game logo — responsive sizing */}
      <div className="relative z-10 w-full flex justify-center mb-1 sm:mb-2 pointer-events-none">
        <Image
          src="/submissions/legend-of-the-gold-cub/logo.webp"
          alt="Legend of the Gold Cub"
          width={1000}
          height={294}
          priority
          className="w-[90%] sm:w-[82%] max-w-[600px] object-contain"
        />
      </div>

      {/* Free Spins Banner — shown while free spins are active */}
      {gameState.freeSpinsRemaining > 0 && gameState.phase !== 'FREE_SPINS_INTRO' && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap"
          style={{ animation: 'fsBannerPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both' }}
        >
          <div
            className="flex items-center gap-2 px-4 py-1.5 rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(0,20,30,0.95) 0%, rgba(0,40,55,0.95) 100%)',
              border: '1.5px solid rgba(0,212,255,0.7)',
              boxShadow: '0 0 14px rgba(0,212,255,0.5), 0 0 30px rgba(0,180,220,0.25), inset 0 0 10px rgba(0,212,255,0.06)',
              animation: 'fsBannerGlow 1.6s ease-in-out infinite',
            }}
          >
            {/* Pulsing dot */}
            <span
              className="inline-block rounded-full"
              style={{
                width: 7, height: 7,
                background: '#00D4FF',
                boxShadow: '0 0 6px rgba(0,212,255,0.9)',
                animation: 'fsDotPulse 1s ease-in-out infinite',
              }}
            />
            <span
              className="text-xs font-black tracking-widest uppercase"
              style={{ color: 'rgba(0,212,255,0.9)' }}
            >
              Free Spins
            </span>
            {/* Count badge */}
            <span
              className="flex items-center justify-center rounded-full font-black tabular-nums text-xs"
              style={{
                minWidth: 22, height: 22, padding: '0 5px',
                background: 'rgba(0,212,255,0.15)',
                border: '1px solid rgba(0,212,255,0.5)',
                color: '#00D4FF',
                textShadow: '0 0 8px rgba(0,212,255,0.9)',
              }}
            >
              {gameState.freeSpinsRemaining}
            </span>
            <span
              className="text-[10px] tracking-wider uppercase"
              style={{ color: 'rgba(0,212,255,0.5)' }}
            >
              left
            </span>
          </div>
        </div>
      )}

      {/* ── Reel Grid — near full width of game window ── */}
      <div
        className="relative z-10 flex gap-1 sm:gap-2 p-2 sm:p-3 lg:p-[14px_16px]"
        style={{
          width: '100%',
          background: 'rgba(0,0,0,0.65)',
          borderRadius: 16,
          boxShadow: 'inset 0 0 50px rgba(0,0,0,0.75), 0 4px 24px rgba(0,0,0,0.5)',
        }}
      >
        <GlowBorder spinning={isSpinningAny} />

        {/* Full-grid shimmer sweep — a single slow light that crosses all 5 reels */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden" style={{ zIndex: 25 }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(108deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)',
            animation: 'gridShimmer 9s ease-in-out infinite',
          }} />
        </div>

        {Array.from({ length: NUM_REELS }).map((_, reel) => (
          <div key={reel} style={{ flex: 1, minWidth: 0 }}>
            <ReelStrip
              targetSymbols={visibleReels[reel]}
              isSpinning={spinning[reel]}
              spinDuration={REEL_DELAYS[reel]}
              onStopped={handleReelStopped}
              highlightRows={reelHighlights[reel]}
            />
          </div>
        ))}

        {/* Top/bottom gradient mask */}
        <div className="absolute inset-x-0 top-0 h-4 pointer-events-none rounded-t-2xl"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)' }} />
        <div className="absolute inset-x-0 bottom-0 h-4 pointer-events-none rounded-b-2xl"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }} />
      </div>

      </div>{/* /play column */}

      {/* Free Spins Intro — Three.js particle burst (full-stage overlay, must
          stay outside the width-capped play column) */}
      {gameState.phase === 'FREE_SPINS_INTRO' && (
        <FreeSpinsIntro spinsAwarded={gameState.freeSpinsRemaining} />
      )}

      <style>{`
        @keyframes gridShimmer {
          0%   { transform: translateX(-120%); opacity: 0; }
          8%   { opacity: 1; }
          50%  { transform: translateX(120%); opacity: 0.8; }
          51%  { opacity: 0; transform: translateX(120%); }
          100% { transform: translateX(120%); opacity: 0; }
        }
      `}</style>

      {/* ── Win Display overlay — branded banner art + counter ── */}
      {showWinDisplay && winLevel && gameState.phase === 'WIN_DISPLAY' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none">
          {/* Rotating treasure rays behind the banner on big wins and up */}
          {isBigWin && (
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                width: '140%',
                aspectRatio: '1',
                transform: 'translate(-50%, -50%)',
                background: `repeating-conic-gradient(from 0deg, ${winStyleMap[winLevel].glow}38 0deg 11deg, transparent 11deg 26deg)`,
                WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,0.85) 0%, transparent 60%)',
                maskImage: 'radial-gradient(circle, rgba(0,0,0,0.85) 0%, transparent 60%)',
                animation: 'raySpin 12s linear infinite',
              }}
            />
          )}

          <div
            className="relative flex flex-col items-center"
            style={{ animation: 'winPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both' }}
          >
            {/* Banner art */}
            <Image
              src={winStyleMap[winLevel].banner}
              alt={winLevel === 'small' ? 'Win' : winLevel}
              width={1024}
              height={512}
              priority
              className="object-contain h-auto"
              style={{
                width: winStyleMap[winLevel].width,
                filter: `drop-shadow(0 8px 20px rgba(0,0,0,0.65)) drop-shadow(0 0 28px ${winStyleMap[winLevel].glow}59)`,
                animation: isBigWin ? 'bannerPulse 1.8s ease-in-out infinite' : undefined,
              }}
            />

            {/* Animated APE counter */}
            <div
              className="mt-2 sm:mt-3 px-6 sm:px-9 py-2 rounded-full flex items-baseline gap-2"
              style={{
                background: 'linear-gradient(135deg, rgba(14,8,0,0.86) 0%, rgba(48,26,0,0.8) 100%)',
                border: `1.5px solid ${winStyleMap[winLevel].glow}80`,
                boxShadow: `0 0 20px ${winStyleMap[winLevel].glow}40, inset 0 1px 0 rgba(255,255,255,0.08)`,
                backdropFilter: 'blur(5px)',
              }}
            >
              <p
                className="text-2xl sm:text-4xl lg:text-5xl font-black tabular-nums"
                style={{
                  color: '#FFD700',
                  textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 16px rgba(255,200,0,0.55)',
                }}
              >
                {winCounterVal.toFixed(3)}
              </p>
              <span className="text-lg font-bold opacity-70 text-white">APE</span>
            </div>

            {/* Skip hint */}
            {!counterDone && (
              <p className="mt-2 text-xs text-white/35 animate-pulse tracking-widest uppercase">
                Tap to skip
              </p>
            )}
          </div>
        </div>
      )}

      {/* Scatter trigger banner */}
      {gameState.phase === 'WIN_DISPLAY' && gameState.scatterCount >= 3 && (
        <div
          className="absolute top-14 left-1/2 -translate-x-1/2 z-20 px-5 py-1.5 rounded-full text-sm font-bold whitespace-nowrap"
          style={{
            background: '#0ea5e9',
            color: '#fff',
            boxShadow: '0 0 16px rgba(14,165,233,0.8)',
            animation: 'winPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
          }}
        >
          {gameState.scatterCount} Golden Cubs — Free Spins incoming
        </div>
      )}

      <style>{`
        @keyframes winPop {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes raySpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes bannerPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.045); }
        }
        @keyframes fsBannerPop {
          from { opacity: 0; transform: translateX(-50%) scale(0.7); }
          to   { opacity: 1; transform: translateX(-50%) scale(1); }
        }
        @keyframes fsBannerGlow {
          0%,100% { box-shadow: 0 0 14px rgba(0,212,255,0.5), 0 0 30px rgba(0,180,220,0.25), inset 0 0 10px rgba(0,212,255,0.06); }
          50%     { box-shadow: 0 0 22px rgba(0,212,255,0.85), 0 0 50px rgba(0,180,220,0.45), inset 0 0 16px rgba(0,212,255,0.12); }
        }
        @keyframes fsDotPulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
