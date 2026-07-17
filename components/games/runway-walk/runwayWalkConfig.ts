import { Game } from "@/lib/games";

export type GameLayout = "two-column" | "full-size";
export const runwayWalkLayout: GameLayout = "two-column";

/**
 * Fair-odds multiplier formula, same family as Mines/Tower-style games:
 * multiplier(n) = (1 / survivalProbability)^n * houseEdgeFactor
 *
 * Each step has a fixed 20% bust chance (80% survival). The multiplier
 * compounds by 1/0.8 = 1.25x per successful step before the house edge
 * factor is applied, keeping the EV-per-decision consistent no matter how
 * far the player has already walked.
 */
export const BUST_PROBABILITY = 0.20;
export const SURVIVAL_PROBABILITY = 1 - BUST_PROBABILITY; // 0.80
export const HOUSE_EDGE_FACTOR = 0.98; // ~2% house edge, matching the generous spirit of Diamond Drop

export function multiplierForStep(step: number): number {
    if (step <= 0) return 1;
    return Math.pow(1 / SURVIVAL_PROBABILITY, step) * HOUSE_EDGE_FACTOR;
}

/**
 * Consecutive same-tile streak bonus. Readjusts (not stacks) as the streak
 * grows — 3 in a row = x3, 4 in a row = x4, 5 in a row = x5, etc. Resets to
 * 1 the moment a different tile breaks the streak, per the confirmed spec.
 */
export function streakBonusMultiplier(consecutiveCount: number): number {
    return consecutiveCount >= 3 ? consecutiveCount : 1;
}

/**
 * Small variety bonus — 3 consecutive picks that are all different tile
 * types (no matching pair among them). Assumption, flagged clearly since
 * this specific rule wasn't pinned down as precisely as the same-kind
 * streak bonus: this checks the last 3 REVEALED tiles for mutual
 * distinctness, applied as its own small multiplier alongside (not
 * replacing) the streak bonus above.
 */
export const VARIETY_BONUS = 1.1;
export function varietyBonusMultiplier(lastThreeTiles: string[]): number {
    if (lastThreeTiles.length < 3) return 1;
    const lastThree = lastThreeTiles.slice(-3);
    return new Set(lastThree).size === 3 ? VARIETY_BONUS : 1;
}

// Soft practical cap — surviving this many steps in a row is already only
// ~0.8^30 ≈ 0.04% likely, so this almost never actually triggers, but it
// keeps the UI and payout math bounded rather than genuinely infinite,
// matching the docs' note that payouts are bounded by house pool liquidity.
export const MAX_STEPS = 30;

export const runwayWalk: Game = {
    title: "Koda Pageant Runway Walk",
    description:
        "Walk the runway one step at a time. Every safe step raises your multiplier — cash out anytime, but one bad step ends the walk.",
    gameAddress: "0x0000000000000000000000000000000000000000", // TODO: replace with the deployed game contract address
    gameBackground: "/submissions/runway-walk/background.png",
    card: "/runway-walk/card.png", // TODO: supply — 1:1, min 512x512 (note: plain path here, no /submissions/ prefix — matches the validator's actual requirement for metadata.json's thumbnail/banner, confirmed against the real CI check on the first game)
    banner: "/runway-walk/banner.png", // TODO: supply — 2:1, min 1024x512
    themeColorBackground: "#1a1030",
    song: "/submissions/runway-walk/audio/song.mp3", // TODO: supply — optional ambient loop
    payouts: {
        0: { 0: { 0: 10_000 } }, // required by the Game type but not read directly — see multiplierForStep() above
    },
};