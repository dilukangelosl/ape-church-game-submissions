'use client';

import React from 'react';
import Image from 'next/image';
import { SYMBOL_CONFIG, PAYTABLE, ALL_SYMBOL_IDS } from '../myGameConfig';
import { SymbolId } from '../types';

interface PaytableProps {
  onClose: () => void;
}

const TIER_LABELS: Partial<Record<SymbolId, { label: string; color: string; bg: string }>> = {
  golden_cub:          { label: 'SCATTER',  color: '#00D4FF', bg: 'rgba(0,212,255,0.15)' },
  gold_apechain_tiger: { label: 'JACKPOT',  color: '#FFD700', bg: 'rgba(255,215,0,0.15)' },
  apechain_cowboy:     { label: 'TIER 2',   color: '#FFA040', bg: 'rgba(255,160,64,0.12)' },
  og_top_hat:          { label: 'TIER 3',   color: '#E8C96A', bg: 'rgba(232,201,106,0.1)' },
  green_cub:           { label: 'TIER 4',   color: '#C8B87A', bg: 'rgba(200,184,122,0.1)' },
  camo_cub:            { label: 'TIER 5',   color: '#A09070', bg: 'rgba(160,144,112,0.1)' },
  purple_cub:          { label: 'WILD',     color: '#C87EFF', bg: 'rgba(200,126,255,0.15)' },
};

export default function Paytable({ onClose }: PaytableProps) {
  const scatterId = ALL_SYMBOL_IDS.find(id => SYMBOL_CONFIG[id].isScatter)!;
  const wildId    = ALL_SYMBOL_IDS.find(id => SYMBOL_CONFIG[id].isWild)!;
  const paySymbols = ALL_SYMBOL_IDS.filter(
    id => !SYMBOL_CONFIG[id].isWild && !SYMBOL_CONFIG[id].isScatter
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.88)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-2xl"
        style={{
          background: 'linear-gradient(160deg, #08040a 0%, #140a00 40%, #0a0600 100%)',
          border: '1.5px solid #D4A017',
          boxShadow: '0 0 40px rgba(212,160,23,0.25), 0 0 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,215,0,0.08)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Gold shimmer header bar */}
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg, transparent, #FFD700, #FF8C00, #FFD700, transparent)',
          borderRadius: '16px 16px 0 0',
        }} />

        <div className="p-5 sm:p-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full font-bold text-sm transition-all hover:scale-110"
            style={{ background: 'rgba(212,160,23,0.2)', color: '#D4A017', border: '1px solid rgba(212,160,23,0.4)' }}
          >
            ✕
          </button>

          {/* Title */}
          <div className="text-center mb-1 pr-6">
            <h2
              className="text-xl sm:text-2xl font-black tracking-widest uppercase"
              style={{ color: '#FFD700', textShadow: '0 0 16px rgba(255,180,0,0.6), 0 0 32px rgba(255,100,0,0.3)' }}
            >
              Paytable
            </h2>
            <p className="text-[10px] tracking-wider mt-0.5" style={{ color: 'rgba(212,160,23,0.5)' }}>
              LEGEND OF THE GOLD CUB
            </p>
          </div>

          {/* Divider */}
          <div className="my-3" style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,160,23,0.4), transparent)' }} />

          {/* Info row */}
          <div className="flex justify-center gap-4 mb-4">
            {[['20', 'Paylines'], ['×Bet', 'Per Line'], ['L→R', 'Pays']].map(([val, lbl]) => (
              <div key={lbl} className="text-center">
                <p className="text-sm font-black" style={{ color: '#FFD700' }}>{val}</p>
                <p className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{lbl}</p>
              </div>
            ))}
          </div>

          {/* Scatter — full-width featured card */}
          <div
            className="rounded-xl p-3 mb-3"
            style={{
              background: 'linear-gradient(135deg, rgba(0,180,220,0.12) 0%, rgba(0,100,160,0.08) 100%)',
              border: '1px solid rgba(0,212,255,0.35)',
              boxShadow: '0 0 16px rgba(0,212,255,0.1)',
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="relative w-14 h-14 flex-shrink-0">
                <div className="absolute inset-0 rounded-lg" style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)' }} />
                <Image src={SYMBOL_CONFIG[scatterId].image} alt="Golden Cub" fill className="object-contain p-1" sizes="56px" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest"
                    style={{ background: 'rgba(0,212,255,0.2)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.4)' }}
                  >
                    SCATTER
                  </span>
                </div>
                <p className="font-bold text-sm" style={{ color: '#E8F8FF' }}>Golden Cub</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Appears anywhere — no payline needed</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { count: 3, spins: 4, pay: 2 },
                { count: 4, spins: 8, pay: 5 },
                { count: 5, spins: 12, pay: 20 },
              ].map(({ count, spins, pay }) => (
                <div key={count} className="text-center rounded-lg py-1.5" style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <p className="text-[10px] font-bold" style={{ color: 'rgba(0,212,255,0.7)' }}>{count} ×</p>
                  <p className="text-sm font-black" style={{ color: '#00D4FF' }}>{spins} FS</p>
                  <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>+{pay}× pay</p>
                </div>
              ))}
            </div>
          </div>

          {/* Regular symbols */}
          <div className="flex flex-col gap-2 mb-3">
            {paySymbols.map((id, i) => {
              const cfg  = SYMBOL_CONFIG[id];
              const pays = PAYTABLE[id];
              const tier = TIER_LABELS[id];
              const isJackpot = id === 'gold_apechain_tiger';

              return (
                <div
                  key={id}
                  className="flex items-center gap-2.5 rounded-xl p-2"
                  style={{
                    background: isJackpot
                      ? 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,140,0,0.06) 100%)'
                      : 'rgba(255,255,255,0.03)',
                    border: isJackpot
                      ? '1px solid rgba(255,215,0,0.3)'
                      : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: isJackpot ? '0 0 12px rgba(255,180,0,0.08)' : 'none',
                  }}
                >
                  {/* Symbol image */}
                  <div className="relative flex-shrink-0" style={{ width: isJackpot ? 52 : 44, height: isJackpot ? 52 : 44 }}>
                    <div className="absolute inset-0 rounded-lg" style={{ background: tier ? tier.bg : 'rgba(255,255,255,0.05)' }} />
                    <Image src={cfg.image} alt={cfg.name} fill className="object-contain p-1" sizes="52px" />
                  </div>

                  {/* Name + tier badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {tier && (
                        <span
                          className="text-[8px] font-black px-1.5 py-px rounded-full tracking-widest whitespace-nowrap"
                          style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.color}44` }}
                        >
                          {tier.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold truncate" style={{ color: isJackpot ? '#FFD700' : 'rgba(255,255,255,0.75)' }}>
                      {cfg.name}
                    </p>
                  </div>

                  {/* Payout columns */}
                  <div className="flex gap-2 flex-shrink-0">
                    {([3, 4, 5] as const).map(n => (
                      <div key={n} className="text-center w-8">
                        <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{n}×</p>
                        <p
                          className="text-xs font-black tabular-nums"
                          style={{ color: isJackpot ? '#FFD700' : i <= 1 ? '#FFA040' : 'rgba(212,160,23,0.8)' }}
                        >
                          {pays[n] ?? '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Wild */}
          <div
            className="flex items-center gap-3 rounded-xl p-2.5 mb-3"
            style={{
              background: 'linear-gradient(135deg, rgba(200,126,255,0.1) 0%, rgba(120,60,200,0.06) 100%)',
              border: '1px solid rgba(200,126,255,0.3)',
            }}
          >
            <div className="relative w-11 h-11 flex-shrink-0">
              <div className="absolute inset-0 rounded-lg" style={{ background: 'rgba(200,126,255,0.12)' }} />
              <Image src={SYMBOL_CONFIG[wildId].image} alt="Wild" fill className="object-contain p-1" sizes="44px" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest"
                  style={{ background: 'rgba(200,126,255,0.2)', color: '#C87EFF', border: '1px solid rgba(200,126,255,0.4)' }}
                >
                  WILD
                </span>
              </div>
              <p className="text-xs font-semibold" style={{ color: '#D4B0FF' }}>Purple Cub</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Substitutes for all symbols except Scatter</p>
            </div>
          </div>

          {/* Divider */}
          <div className="mb-3" style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,160,23,0.3), transparent)' }} />

          {/* Footer */}
          <div className="flex justify-between items-center text-[9px] tracking-wider" style={{ color: 'rgba(212,160,23,0.4)' }}>
            <span>TARGET RTP 96%</span>
            <span>MAX WIN 500× BET</span>
          </div>
        </div>

        {/* Gold shimmer footer bar */}
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg, transparent, #FF8C00, #FFD700, #FF8C00, transparent)',
          borderRadius: '0 0 16px 16px',
        }} />
      </div>
    </div>
  );
}
