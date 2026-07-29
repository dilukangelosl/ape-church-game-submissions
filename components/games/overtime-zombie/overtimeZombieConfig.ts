import { Game } from "@/lib/games";

// --- Symbol Definitions ---
// 8 snack symbols ordered by rarity (0 = most common, 7 = rarest)
// Symbol 8 is the Kick shoe — special, no points, excluded from 7+ matching
export interface SnackSymbol {
    id: number;
    name: string;
    shape: string;   // placeholder shape character
    color: string;    // CSS color
    points: number;   // points awarded per match (0 for shoe/worker) — drives meter only
    weight: number;   // frequency weight for reel generation (higher = more common)
    // APE payout multiplied by the per-spin wager. Indexed by tier:
    //   [0] = 7-8 matches, [1] = 9-10 matches, [2] = 11+ matches.
    // Special symbols (shoe/worker) are excluded from matching → all zeros.
    payoutMultipliers: readonly [number, number, number];
    image?: string;     // optional sprite path in public/submissions/overtime-zombie/
    isKick?: boolean;   // true for the shoe symbol
    isWorker?: boolean; // true for the worker symbol
}

export const SHOE_SYMBOL_ID = 8;
export const WORKER_SYMBOL_ID = 9;
export const KICK_THRESHOLD = 4;

export const SYMBOLS: readonly SnackSymbol[] = [
    { id: 0, name: "Zombie Chips",    shape: "\u25CF", color: "#7F00FF", points: 50,   weight: 20, payoutMultipliers: [0.0325, 0.0975, 0.26],  image: "/submissions/overtime-zombie/chips.webp" },
    { id: 1, name: "Deadly Donut",    shape: "\u25A0", color: "#40E0D0", points: 75,   weight: 18, payoutMultipliers: [0.0585, 0.13, 0.52],   image: "/submissions/overtime-zombie/donut.webp" },
    { id: 2, name: "Corpse Coffee",   shape: "\u25B2", color: "#6F4E37", points: 100,  weight: 15, payoutMultipliers: [0.065, 0.143, 0.65],   image: "/submissions/overtime-zombie/coffee.webp" },
    { id: 3, name: "Porcelain Throne", shape: "\u2B22", color: "#0EA5E9", points: 150,  weight: 12, payoutMultipliers: [0.104, 0.1625, 1.04],  image: "/submissions/overtime-zombie/toilet.webp" },
    { id: 4, name: "Viral Vape",      shape: "\u2B1F", color: "#BEF264", points: 200,  weight: 9,  payoutMultipliers: [0.13, 0.195, 1.3],     image: "/submissions/overtime-zombie/vape.webp" },
    { id: 5, name: "Brain Blaster",   shape: "\u271A", color: "#FB923C", points: 300,  weight: 6,  payoutMultipliers: [0.195, 0.325, 1.95],   image: "/submissions/overtime-zombie/pills.webp" },
    { id: 6, name: "Crypt Dust",      shape: "\u25C6", color: "#FFFFFF", points: 500,  weight: 3,  payoutMultipliers: [0.26, 0.65, 3.25],     image: "/submissions/overtime-zombie/coke.webp" },
    { id: 7, name: "Undead Ooze",     shape: "\u2605", color: "#FF13F0", points: 1000, weight: 1,  payoutMultipliers: [0.65, 1.3, 6.5],      image: "/submissions/overtime-zombie/shots.webp" },
    { id: 8, name: "Kick",            shape: "\uD83D\uDC62", color: "#FFD700", points: 0, weight: 4, payoutMultipliers: [0, 0, 0], image: "/submissions/overtime-zombie/shoe.webp", isKick: true },
    { id: 9, name: "Worker",          shape: "\uD83D\uDC77", color: "#38BDF8", points: 0, weight: 2, payoutMultipliers: [0, 0, 0], image: "/submissions/overtime-zombie/worker.webp", isWorker: true },
] as const;

// --- Match Tiers ---
export const TIER_1_MIN = 7;   // 7-8 matches
export const TIER_1_MAX = 8;
export const TIER_2_MIN = 9;   // 9-10 matches
export const TIER_2_MAX = 10;
export const TIER_3_MIN = 11;  // 11+ matches

export const TIER_1_PERCENT = 0.20;
export const TIER_2_PERCENT = 0.50;
export const TIER_3_PERCENT = 1.00;

export const KICK_METER_POINTS = 200; // flat meter points for a kick (1 stage)

export function getTierForCount(count: number): { tier: number; percent: number } {
    if (count >= TIER_3_MIN) return { tier: 3, percent: TIER_3_PERCENT };
    if (count >= TIER_2_MIN) return { tier: 2, percent: TIER_2_PERCENT };
    return { tier: 1, percent: TIER_1_PERCENT };
}

export function getTieredPoints(symbol: SnackSymbol, count: number): number {
    const { percent } = getTierForCount(count);
    return Math.round(symbol.points * percent);
}

// Tiered APE payout multiplier (per per-spin wager). Multiply by per-spin
// wager to get the actual APE awarded for this matched symbol group.
export function getTieredPayoutMultiplier(symbol: SnackSymbol, count: number): number {
    const { tier } = getTierForCount(count);
    return symbol.payoutMultipliers[tier - 1];
}

// --- APE Formatters ---
// 4 dp max with trailing zeros stripped — used for the floating "+N APE" text.
//   2.5 → "2.5 APE",  0.0125 → "0.0125 APE",  50 → "50 APE"
export function formatApe(value: number): string {
    return `${parseFloat(value.toFixed(4))} APE`;
}
// 2 dp max with trailing zeros stripped — used for the stats widget so a
// long decimal can't expand the box on a big win.
//   1.25 → "1.25 APE",  12.5 → "12.5 APE",  10 → "10 APE",  0.0125 → "0.01 APE"
export function formatApeCompact(value: number): string {
    return `${parseFloat(value.toFixed(2))} APE`;
}
// Full-precision APE for the wallet-truth tooltip. 18 decimals matches the
// APE ERC-20 standard. Rounds to 15 significant figures first to strip JS
// float arithmetic noise (so 0.1 + 0.2 displays as 0.3, not 0.30000…04),
// then trims trailing zeros so simple values stay readable.
//   25.5 → "25.5 APE",  0.1 → "0.1 APE",  1e-18 → "0.000000000000000001 APE"
export function formatApeFull(value: number): string {
    if (value === 0) return "0 APE";
    const cleaned = parseFloat(value.toPrecision(15));
    return `${cleaned.toFixed(18).replace(/\.?0+$/, "")} APE`;
}

// --- Board Dimensions ---
export const ROWS = 5;
export const COLS = 6;
export const REEL_LENGTH = 5000;
export const MIN_MATCH_COUNT = 7;
export const TOTAL_CELLS = ROWS * COLS; // 30

// --- Zombie Meter ---
export const METER_MAX = 1000;
export const METER_STAGES = 5;
export const METER_STAGE_THRESHOLD = METER_MAX / METER_STAGES; // 200 per stage

export const STAGE_COLORS: readonly string[] = [
    "#4ADE80", // stage 1 - green (healthy)
    "#FACC15", // stage 2 - yellow (queasy)
    "#FB923C", // stage 3 - orange (sick)
    "#EF4444", // stage 4 - red (infected)
    "#A855F7", // stage 5 - purple (full zombie)
] as const;

// --- Animation Timing (ms) ---
export const SPIN_DELAY = 600;
export const MATCH_HIGHLIGHT_DURATION = 1000; // time matches glow before dropping
export const DROP_DURATION = 350;             // time for snacks to fall out of frame
export const EMPTY_SLOT_DURATION = 600;       // time empty slots are shown after dropping
export const RESTOCK_DURATION = 560;          // time for scale-in animation to finish
export const RESTOCK_SETTLE_DELAY = 800;      // pause after restock settles before next match check
// Cell scale-in animation duration — must match .sa-cell-new in snack-attack.styles.css.
// Used to time per-symbol impact SFX so they land when each cell finishes settling.
export const CELL_RESTOCK_DURATION = 250;

// --- Reel Generation ---
// Normal mode: includes snacks + shoes, excludes workers
// Bonus mode: includes snacks + workers, excludes shoes
function generateWeightedPool(bonusMode: boolean = false): number[] {
    const pool: number[] = [];
    for (const symbol of SYMBOLS) {
        if (bonusMode && symbol.isKick) continue;    // no shoes in bonus
        if (!bonusMode && symbol.isWorker) continue;  // no workers in normal
        for (let i = 0; i < symbol.weight; i++) {
            pool.push(symbol.id);
        }
    }
    return pool;
}

function seededRandom(seed: number): () => number {
    let s = seed;
    return (): number => {
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
        return (s >>> 0) / 0xFFFFFFFF;
    };
}

export function generateReel(seed: number, bonusMode: boolean = false): number[] {
    const pool = generateWeightedPool(bonusMode);
    const rng = seededRandom(seed);
    const reel: number[] = [];
    for (let i = 0; i < REEL_LENGTH; i++) {
        const index = Math.floor(rng() * pool.length);
        reel.push(pool[index]);
    }
    return reel;
}

// Pre-generated reels with fixed seeds for deterministic results
export const REEL_SEEDS = [314159, 271828, 141421, 173205, 223606, 244949] as const;
export const BONUS_REEL_SEEDS = [161803, 265358, 332050, 414213, 504082, 577215] as const;

export function generateAllReels(bonusMode: boolean = false): number[][] {
    const seeds = bonusMode ? BONUS_REEL_SEEDS : REEL_SEEDS;
    return seeds.map((seed) => generateReel(seed, bonusMode));
}

// --- Bonus Round ---
export const WORKER_REVEAL_SCAN_SPEED = 80;    // ms per cell while scanning
export const WORKER_REVEAL_HIGHLIGHT = 800;     // ms to hold on a found worker

export function countWorkers(board: CellState[][]): number {
    let count = 0;
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col].symbolId === WORKER_SYMBOL_ID) count++;
        }
    }
    return count;
}

export function calculateBonusMultiplier(workerCount: number): number {
    return 1 + (workerCount * 0.5);
}

// --- Big Win Thresholds ---
// Big-win splash trigger tiers, in ascending drama:
//   "bigWin"   → non-bonus spin whose total meets BIG_WIN_WAGER_MULTIPLE
//   "feast"    → bonus round with 1..BONUS_MASSACRE_WORKER_THRESHOLD-1 workers found
//   "massacre" → bonus round with BONUS_MASSACRE_WORKER_THRESHOLD+ workers found
// Gated on worker COUNT (not multiplier) so the massacre threshold survives
// any future re-tuning of calculateBonusMultiplier.
export const BIG_WIN_WAGER_MULTIPLE = 2;
export const BONUS_MASSACRE_WORKER_THRESHOLD = 6;

export type BigWinLevel = "bigWin" | "feast" | "massacre";

export function computeBigWinLevel(args: {
    isBonusRound: boolean;
    bonusWorkersFound: number;
    spinTotalApe: number;
    perSpinWager: number;
}): BigWinLevel | null {
    const { isBonusRound, bonusWorkersFound, spinTotalApe, perSpinWager } = args;
    if (isBonusRound) {
        if (bonusWorkersFound >= BONUS_MASSACRE_WORKER_THRESHOLD) return "massacre";
        if (bonusWorkersFound >= 1) return "feast";
        return null;
    }
    if (perSpinWager > 0 && spinTotalApe >= BIG_WIN_WAGER_MULTIPLE * perSpinWager) {
        return "bigWin";
    }
    return null;
}

// --- Game State Types ---
export interface CellState {
    symbolId: number;
    isMatched: boolean;
    isDropping: boolean;
    isConsumed: boolean;
    isNew: boolean;
    // True only for cells built by buildInitialBoard (Spin press + Bonus round entry).
    // Cascade refills and post-kick refills use isNew alone for a scale-only animation.
    isFreshBoard: boolean;
}

export interface CascadeResult {
    matchedSymbolIds: number[];
    pointsAwarded: number;                 // for the meter
    payoutMultiplierAwarded: number;       // sum of per-group APE multipliers; × wager = APE
    matchCounts: Map<number, number>;
}

export interface OvertimeZombieGameState {
    board: CellState[][];               // [row][col]
    reels: number[][];                  // 6 reels
    reelPositions: number[];            // current position in each reel
    meterPoints: number;                // current zombie meter progress
    totalPointsThisSpin: number;        // points from all cascades in current spin
    totalPayoutThisSpin: number;        // APE earned from cascades in current spin (cleared on each new spin)
    cascadeCount: number;               // number of cascades in current spin chain
    isAnimating: boolean;               // whether cascade animation is running
    isCascading: boolean;               // whether we're mid-cascade chain
    spinComplete: boolean;              // true when no more cascades possible
    zombieReleased: boolean;            // true when meter reaches max
    isKicking: boolean;                 // true during a kick sequence
    isBonusRound: boolean;              // true during the bonus spin
    bonusWorkersFound: number;          // workers on board when bonus spin settles
    bonusMultiplier: number;            // starts at 1x and gains +0.5x for each worker found
    isRevealingWorkers: boolean;        // true during worker-by-worker reveal
    revealScanIndex: number;            // current cell being scanned (0-29, row-major)
    revealHighlightCell: [number, number] | null; // [row, col] of currently highlighted worker
    // Floating "what just happened" text below the meter — either match points
    // ("+250") during a cascade or a kick message ("Kick the Machine!") when a
    // kick fires. Cleared on the next restock / new spin / bonus entry.
    floatingPayoff: FloatingPayoff | null;
    // Big-win splash tier for the current spin. Set at spin-end when the
    // payout crosses the tier threshold; cleared on next spin (INITIAL_GAME_STATE
    // spread in handleStateAdvance) or, on final spins, after the 2s hold.
    bigWinLevel: BigWinLevel | null;
}

export type FloatingPayoff =
    | { type: "ape"; value: number }       // APE awarded this cascade — formatted as "+N APE"
    | { type: "kick" }                     // "Kick the Machine!" banner
    | { type: "spinTotal"; value: number }; // Spin-end total — rolls up from 0 to value, holds until next spin press

export const INITIAL_GAME_STATE: OvertimeZombieGameState = {
    board: [],
    reels: [],
    reelPositions: [0, 0, 0, 0, 0, 0],
    meterPoints: 0,
    totalPointsThisSpin: 0,
    totalPayoutThisSpin: 0,
    cascadeCount: 0,
    isAnimating: false,
    isCascading: false,
    spinComplete: false,
    zombieReleased: false,
    isKicking: false,
    isBonusRound: false,
    bonusWorkersFound: 0,
    bonusMultiplier: 1,
    isRevealingWorkers: false,
    revealScanIndex: -1,
    revealHighlightCell: null,
    floatingPayoff: null,
    bigWinLevel: null,
};

// --- Board Logic ---
export function buildInitialBoard(reels: number[][], startIndices: number[]): {
    board: CellState[][];
    newPositions: number[];
} {
    const board: CellState[][] = [];
    const newPositions = [...startIndices];

    for (let row = 0; row < ROWS; row++) {
        const rowCells: CellState[] = [];
        for (let col = 0; col < COLS; col++) {
            const reelIndex = newPositions[col] % REEL_LENGTH;
            rowCells.push({
                symbolId: reels[col][reelIndex],
                isMatched: false,
                isDropping: false,
                isConsumed: false,
                // Initial board cells animate in like a full restock (vending machine spool-up)
                isNew: true,
                isFreshBoard: true,
            });
            newPositions[col]++;
        }
        board.push(rowCells);
    }

    return { board, newPositions };
}

export function findMatches(board: CellState[][]): CascadeResult {
    // Count occurrences of each symbol on the board (exclude shoes)
    const counts = new Map<number, number>();
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const id = board[row][col].symbolId;
            if (id === SHOE_SYMBOL_ID || id === WORKER_SYMBOL_ID) continue; // shoes and workers don't count for matching
            counts.set(id, (counts.get(id) ?? 0) + 1);
        }
    }

    // Find symbols with 7+ occurrences
    const matchedSymbolIds: number[] = [];
    const matchCounts = new Map<number, number>();
    let pointsAwarded = 0;
    let payoutMultiplierAwarded = 0;

    for (const [symbolId, count] of counts) {
        if (count >= MIN_MATCH_COUNT) {
            matchedSymbolIds.push(symbolId);
            matchCounts.set(symbolId, count);
            const symbol = SYMBOLS[symbolId];
            pointsAwarded += getTieredPoints(symbol, count);
            payoutMultiplierAwarded += getTieredPayoutMultiplier(symbol, count);
        }
    }

    return { matchedSymbolIds, pointsAwarded, payoutMultiplierAwarded, matchCounts };
}

// --- Kick Logic ---
export function countShoes(board: CellState[][]): number {
    let count = 0;
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col].symbolId === SHOE_SYMBOL_ID) count++;
        }
    }
    return count;
}

export function canKick(board: CellState[][]): boolean {
    return countShoes(board) >= KICK_THRESHOLD;
}

export function calculateKickPoints(): number {
    return KICK_METER_POINTS;
}

export function markKickShoes(board: CellState[][]): CellState[][] {
    return board.map((row) =>
        row.map((cell) => ({
            ...cell,
            isNew: false,
            isFreshBoard: false,
            isDropping: false,
            isMatched: cell.symbolId === SHOE_SYMBOL_ID,
        }))
    );
}

export function markAllForDrop(board: CellState[][]): CellState[][] {
    return board.map((row) =>
        row.map((cell) => ({
            ...cell,
            isMatched: false,
            isDropping: true,
        }))
    );
}

export function markMatches(board: CellState[][], matchedIds: number[]): CellState[][] {
    const matchSet = new Set(matchedIds);
    return board.map((row) =>
        row.map((cell) => ({
            ...cell,
            isNew: false,
            isFreshBoard: false,
            isDropping: false,
            isMatched: matchSet.has(cell.symbolId),
        }))
    );
}

export function dropMatches(board: CellState[][]): CellState[][] {
    return board.map((row) =>
        row.map((cell) => {
            if (!cell.isMatched) return cell;
            return {
                ...cell,
                isMatched: false,
                isDropping: true,
            };
        })
    );
}

export function consumeDropped(board: CellState[][]): CellState[][] {
    return board.map((row) =>
        row.map((cell) => {
            if (!cell.isDropping) return cell;
            return {
                ...cell,
                isDropping: false,
                isConsumed: true,
            };
        })
    );
}

export function cascadeBoard(
    board: CellState[][],
    reels: number[][],
    reelPositions: number[]
): { newBoard: CellState[][]; newPositions: number[] } {
    const newPositions = [...reelPositions];

    // Restock in-place: consumed (empty) cells get new product from the reel,
    // all other cells stay exactly where they are (no gravity/dropping)
    const newBoard: CellState[][] = board.map((row) =>
        row.map((cell, col) => {
            if (!cell.isConsumed) {
                // Clearing isFreshBoard here ensures survivor cells from a
                // fresh-board state don't replay the spin animation on the
                // next cascade remount.
                return { ...cell, isNew: false, isFreshBoard: false };
            }
            // Restock this empty slot from the reel
            const reelIndex = newPositions[col] % REEL_LENGTH;
            const newCell: CellState = {
                symbolId: reels[col][reelIndex],
                isMatched: false,
                isDropping: false,
                isConsumed: false,
                isNew: true,
                isFreshBoard: false,
            };
            newPositions[col]++;
            return newCell;
        })
    );

    return { newBoard, newPositions };
}

// --- Game Config ---
export const overtimeZombieGame: Game = {
    title: "Overtime Zombie",
    description: "Feed zombie snacks from the vending machine to transform the office manager. Fill the zombie meter to release the Overtime Zombie!",
    gameAddress: "0x0000000000000000000000000000000000000000",
    gameBackground: "/submissions/overtime-zombie/backgroundStage1.webp",
    card: "/submissions/overtime-zombie/card.png",
    banner: "/submissions/overtime-zombie/banner.png",
    themeColorBackground: "#A855F7",
    song: "/shared/audio/song.mp3",
    payouts: {
        0: { 0: { 0: 0 } },
    },
};
