import { Game } from '@/lib/games';
import { SymbolId } from './types';

// ── Symbol Catalogue ────────────────────────────────────────────────────────

export type SymbolConfig = {
  id: SymbolId;
  name: string;
  image: string;
  isWild: boolean;
  isScatter: boolean;
};

export const SYMBOL_CONFIG: Record<SymbolId, SymbolConfig> = {
  // symbol2 — SCATTER (triggers free spins), 1 per reel strip
  golden_cub:          { id: 'golden_cub',          name: 'Golden Cub',          image: '/submissions/legend-of-the-gold-cub/symbols/symbol2.webp', isWild: false, isScatter: true  },
  // symbol3 — JACKPOT (highest paying), 1 per reel strip
  gold_apechain_tiger: { id: 'gold_apechain_tiger',  name: 'Gold Apechain Tiger', image: '/submissions/legend-of-the-gold-cub/symbols/symbol3.webp', isWild: false, isScatter: false },
  // symbol8 — tier 2, 2 per reel strip
  apechain_cowboy:     { id: 'apechain_cowboy',      name: 'Apechain Cowboy',     image: '/submissions/legend-of-the-gold-cub/symbols/symbol8.webp', isWild: false, isScatter: false },
  // symbol1 — tier 3, 3 per reel strip
  og_top_hat:          { id: 'og_top_hat',           name: 'Og Top Hat',          image: '/submissions/legend-of-the-gold-cub/symbols/symbol1.webp', isWild: false, isScatter: false },
  // symbol4 — tier 4, 4 per reel strip
  green_cub:           { id: 'green_cub',            name: 'Green Cub',           image: '/submissions/legend-of-the-gold-cub/symbols/symbol4.webp', isWild: false, isScatter: false },
  // symbol6 — tier 5 (most common), 11 per reel strip
  camo_cub:            { id: 'camo_cub',             name: 'Camo Cub',            image: '/submissions/legend-of-the-gold-cub/symbols/symbol6.webp', isWild: false, isScatter: false },
  // symbol7 — WILD, substitutes all except scatter, 3 per reel strip
  purple_cub:          { id: 'purple_cub',           name: 'Purple Cub',          image: '/submissions/legend-of-the-gold-cub/symbols/symbol7.webp', isWild: true,  isScatter: false },
};

// Display order for paytable (user-specified): scatter first, jackpot down to lowest, wild last
export const ALL_SYMBOL_IDS: SymbolId[] = [
  'golden_cub',
  'gold_apechain_tiger',
  'apechain_cowboy',
  'og_top_hat',
  'green_cub',
  'camo_cub',
  'purple_cub',
];

// ── Paytable (multipliers of betPerLine) ────────────────────────────────────
// Payout order (highest → lowest): gold_apechain_tiger → apechain_cowboy →
//   og_top_hat → green_cub → camo_cub.
// Scatter (golden_cub) pays 3+ anywhere × NUM_PAYLINES.
// Wild (purple_cub) substitutes only — no direct payline payout.
//
// Reel frequencies (per strip of 25):
//   gold_apechain_tiger: 1  (rarest  → highest pay)
//   apechain_cowboy:     2  (tier 2)
//   og_top_hat:          3  (tier 3)
//   green_cub:           4  (tier 4)
//   camo_cub:           11  (most common → lowest pay)
//   purple_cub (wild):   3
//   golden_cub (scatter):1
//   Total: 25

export const PAYTABLE: Record<SymbolId, { 3?: number; 4?: number; 5?: number }> = {
  gold_apechain_tiger: { 3: 20, 4: 80,  5: 260 },  // jackpot — symbol3, rarest
  apechain_cowboy:     { 3: 9,  4: 30,  5: 98  },  // tier 2  — symbol8
  og_top_hat:          { 3: 5,  4: 15,  5: 48  },  // tier 3  — symbol1
  green_cub:           { 3: 3,  4: 8,   5: 20  },  // tier 4  — symbol4
  camo_cub:            {        4: 2,   5: 5   },  // tier 5  — no 3-of-kind pay (11/25 too frequent)
  purple_cub:          {},                           // wild — pays via substitution only
  golden_cub:          { 3: 2,  4: 5,   5: 20  },  // scatter — symbol2, triggers free spins
};

// ── Reel Strips ─────────────────────────────────────────────────────────────
// Strip length 25 per reel.
// Counts per reel: camo×11, green×4, og_top_hat×3, cowboy×2,
//                  gold_tiger×1, wild×3, scatter×1 = 25

type S = SymbolId;
const CC: S = 'camo_cub';            // tier 5 — 11/reel
const GN: S = 'green_cub';           // tier 4 — 4/reel
const OT: S = 'og_top_hat';          // tier 3 — 3/reel
const AC: S = 'apechain_cowboy';     // tier 2 — 2/reel
const GA: S = 'gold_apechain_tiger'; // jackpot — 1/reel
const PC: S = 'purple_cub';          // wild    — 3/reel
const GC: S = 'golden_cub';          // scatter — 1/reel

export const REEL_STRIPS: Record<number, SymbolId[]> = {
  0: [CC, CC, CC, CC, CC, CC, CC, GN, GN, GN, GN, CC, CC, CC, CC, OT, OT, OT, AC, AC, GA, PC, PC, PC, GC],
  1: [GN, GN, GN, GN, CC, CC, CC, CC, CC, CC, CC, OT, OT, OT, CC, CC, CC, CC, AC, AC, GA, PC, PC, PC, GC],
  2: [CC, CC, CC, CC, CC, OT, OT, OT, CC, CC, CC, GN, GN, GN, GN, CC, CC, CC, AC, AC, GA, PC, PC, PC, GC],
  3: [CC, CC, CC, CC, CC, CC, CC, GN, GN, GN, GN, CC, CC, CC, CC, OT, OT, OT, AC, AC, GA, PC, PC, PC, GC],
  4: [GN, GN, GN, GN, CC, CC, CC, CC, OT, OT, OT, CC, CC, CC, CC, CC, CC, CC, AC, AC, GA, PC, PC, PC, GC],
};

// ── Paylines (20 lines on 5×3 grid) ─────────────────────────────────────────
// Each entry is an array of row indices [reel0, reel1, reel2, reel3, reel4]
// Row 0 = top, Row 1 = middle, Row 2 = bottom

export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // 0  middle straight
  [0, 0, 0, 0, 0], // 1  top straight
  [2, 2, 2, 2, 2], // 2  bottom straight
  [0, 1, 2, 1, 0], // 3  V shape
  [2, 1, 0, 1, 2], // 4  inverted V
  [0, 0, 1, 2, 2], // 5  diagonal down-right
  [2, 2, 1, 0, 0], // 6  diagonal up-right
  [1, 0, 0, 0, 1], // 7  dip top
  [1, 2, 2, 2, 1], // 8  dip bottom
  [0, 1, 1, 1, 0], // 9  arch top
  [2, 1, 1, 1, 2], // 10 arch bottom
  [1, 0, 1, 2, 1], // 11 zigzag up
  [1, 2, 1, 0, 1], // 12 zigzag down
  [0, 0, 1, 0, 0], // 13 top dip
  [2, 2, 1, 2, 2], // 14 bottom dip
  [1, 1, 0, 1, 1], // 15 middle-top
  [1, 1, 2, 1, 1], // 16 middle-bottom
  [0, 1, 0, 1, 0], // 17 alt top
  [2, 1, 2, 1, 2], // 18 alt bottom
  [1, 0, 2, 0, 1], // 19 extreme zigzag
];

export const NUM_REELS = 5;
export const NUM_ROWS = 3;
export const NUM_PAYLINES = PAYLINES.length;

// ── Free Spins ───────────────────────────────────────────────────────────────

// Reduced from 10/15/20 per ape.church team request — cheaper on-chain gas.
export const FREE_SPINS_AWARD: Record<number, number> = {
  3: 4,
  4: 8,
  5: 12,
};
export const FREE_SPINS_RETRIGGER = 4;

// ── Game Object ─────────────────────────────────────────────────────────────

export const goldCubGame: Game = {
  title: 'Legend of the Gold Cub',
  description: 'The search for the mythical Golden Tiger Cub takes you through the world and IP of Typical Tigers.',
  gameAddress: '0x0000000000000000000000000000000000000000',
  gameBackground: '/submissions/legend-of-the-gold-cub/background.webp',
  card:   '/submissions/legend-of-the-gold-cub/card.png',
  banner: '/submissions/legend-of-the-gold-cub/banner.png',
  advanceToNextStateAsset: '/submissions/legend-of-the-gold-cub/spin-button.webp',
  themeColorBackground: '#D4A017',
  song: '/submissions/legend-of-the-gold-cub/audio/song.mp3',
  // payouts unused — we compute wins directly from PAYTABLE + REEL_STRIPS
  payouts: { 0: { 0: { 0: 0 } } },
};

// alias expected by app/page.tsx template
export const myGame = goldCubGame;
