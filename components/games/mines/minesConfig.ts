import { Game } from "@/lib/games";

export const minesGame: Game = {
    title: "Mines",
    description: "Reveal tiles to collect gems. Avoid the mines. Cash out before you hit one.",
    gameAddress: "0x1234567890123456789012345678901234567890",
    gameBackground: "/submissions/mines/background.png",
    card: "/submissions/mines/card.png",
    banner: "/submissions/mines/banner.png",
    advanceToNextStateAsset: "/submissions/mines/advance-button.png",
    themeColorBackground: "#22c55e",
    song: "/submissions/mines/audio/song.mp3",
    payouts: {
        0: { 0: { 0: 10000 } },
    },
};

export const HOUSE_EDGE = 0.97;
export const BOARD_TILE_COUNT = 25;
export const BOARD_COLUMNS = 5;
export const DEFAULT_MINE_COUNT = 3;
export const MIN_MINE_COUNT = 1;
export const MAX_MINE_COUNT = 24;

const PRNG_MASK_64 = (BigInt(1) << BigInt(64)) - BigInt(1);
const PRNG_A = BigInt("6364136223846793005");
const PRNG_C = BigInt("1442695040888963407");

const normalizeRandomWord = (randomWord: `0x${string}`): bigint => {
    const parsed = BigInt(randomWord);
    return (parsed & PRNG_MASK_64) || BigInt(1);
};

const nextSeed = (seed: bigint): bigint =>
    ((seed * PRNG_A + PRNG_C) & PRNG_MASK_64) || BigInt(1);

export function createMinePositions(randomWord: `0x${string}`, mineCount: number): number[] {
    const clampedCount = Math.min(Math.max(mineCount, MIN_MINE_COUNT), MAX_MINE_COUNT);
    const positionSet = new Set<number>();
    const positions: number[] = [];
    let seed = normalizeRandomWord(randomWord);
    while (positionSet.size < clampedCount) {
        seed = nextSeed(seed);
        const pos = Number(seed % BigInt(BOARD_TILE_COUNT));
        if (!positionSet.has(pos)) {
            positionSet.add(pos);
            positions.push(pos);
        }
    }
    return positions;
}

function combinationBigInt(n: number, k: number): bigint {
    if (k > n || k < 0) return BigInt(0);
    if (k === 0 || k === n) return BigInt(1);
    const kk = Math.min(k, n - k);
    let result = BigInt(1);
    for (let i = 0; i < kk; i++) {
        result = (result * BigInt(n - i)) / BigInt(i + 1);
    }
    return result;
}

export function getMinesMultiplier(mineCount: number, safeReveals: number, houseEdge: number): number {
    if (safeReveals <= 0) return 1;
    const safeTiles = BOARD_TILE_COUNT - mineCount;
    if (safeReveals > safeTiles) return 1;
    const cTotal = combinationBigInt(BOARD_TILE_COUNT, safeReveals);
    const cSafe = combinationBigInt(safeTiles, safeReveals);
    if (cSafe === BigInt(0)) return 1;
    const multiplier = (Number(cTotal) / Number(cSafe)) * houseEdge;
    return Number(multiplier.toFixed(4));
}

export function getSafeTileCount(mineCount: number): number {
    const clamped = Math.min(Math.max(mineCount, MIN_MINE_COUNT), MAX_MINE_COUNT);
    return BOARD_TILE_COUNT - clamped;
}
