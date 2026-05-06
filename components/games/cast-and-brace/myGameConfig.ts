import { Game } from "@/lib/games";
import type { Hex } from "viem";
import { outcomes } from "./config/outcomes";
import { buildPayoutsRow, outcomesBySortOrder } from "./config/outcomeResolve";

const ASSET_BASE = "/submissions/cast-and-brace";

/** In-game fishing flow — visuals/animations hook into this later. */
export type FishingPhase =
    | "idle"
    | "casting"
    | "waiting"
    | "bite"
    | "reeling"
    | "reveal";

/** Outcome from the platform / chain (no local RNG). */
export interface FishPlatformResult {
    /** Index into `payouts[0][0][i]` for this template. */
    payoutIndex: number;
    /**
     * Optional: multiplier from Ape Church (payout ÷ bet as a multiple, e.g. 1.5 = 1.5x).
     * When set, tier mapping and HUD use this; otherwise derived from settled payout ÷ bet.
     */
    payoutMultiplier?: number;
}

/** Visual / payout tier for reveal (mapped from multiplier). */
export type FishRevealTier =
    | "junk"
    | "common"
    | "mid"
    | "rare"
    | "legendary"
    | "mythical"
    | "enlightened";

export const REVEAL_TIER_NAMES: Record<FishRevealTier, string> = {
    junk: "The Forsaken",
    common: "Driftborn",
    mid: "Tidebound",
    rare: "Deepmarked",
    legendary: "Emerald Awakened",
    mythical: "Deep Ascended",
    enlightened: "The Enlightened",
};

/**
 * Maps payout multiple to tier (house rules).
 * Junk → common → mid → rare → legendary (2x–&lt;5x) → mythical (5x–&lt;12x) → enlightened (12x+).
 */
export function tierFromMultiplier(multiple: number): FishRevealTier {
    if (!Number.isFinite(multiple) || multiple <= 0) {
        return "junk";
    }
    if (multiple < 1) {
        return "common";
    }
    if (multiple < 1.2) {
        return "mid";
    }
    if (multiple < 2) {
        return "rare";
    }
    if (multiple < 5) {
        return "legendary";
    }
    if (multiple < 12) {
        return "mythical";
    }
    return "enlightened";
}

/**
 * Decorative fish for ambient schools / swarms — chart fish only, excluding
 * jackpot (KoKo) and Forsaken loss art (idle water stays “living” shoals).
 */
export const AMBIENT_FISH_SPRITE_PATHS: readonly string[] = outcomes
    .filter((o) => o.id !== "koko_monster" && o.tier !== "Forsaken")
    .map((o) => `${ASSET_BASE}/${o.filename}`);

/** Idle-school fish set: include all fish outcomes except Forsaken loss art. */
export const IDLE_FISH_SPRITE_PATHS: readonly string[] = outcomes
    .filter((o) => o.tier !== "Forsaken" && o.id !== "koko_monster")
    .map((o) => `${ASSET_BASE}/${o.filename}`);

const REVEAL_SPRITES: Record<FishRevealTier, string> = {
    junk: `${ASSET_BASE}/Forsaken_Relic.png`,
    common: `${ASSET_BASE}/driftborn_minnow.png`,
    mid: `${ASSET_BASE}/tidebound_fangfin.png`,
    rare: `${ASSET_BASE}/awakened_bracefin.png`,
    legendary: `${ASSET_BASE}/eye-crown_fish.png`,
    mythical: `${ASSET_BASE}/Ascender_Fish.png`,
    enlightened: `${ASSET_BASE}/enlightened_leviathan.png`,
};

/** Catch card art when payout is 0 / 0x only (not used in ambient schools). */
const REVEAL_ZERO_WIN_SPRITES = [
    `${ASSET_BASE}/Forsaken_Relic.png`,
    `${ASSET_BASE}/Forsaken_Batula.png`,
] as const;

const REVEAL_COMMON_VARIANTS = [
    `${ASSET_BASE}/driftborn_minnow.png`,
    `${ASSET_BASE}/driftborn_pikelet.png`,
    `${ASSET_BASE}/driftborn_bracegill.png`,
    `${ASSET_BASE}/driftborn_needlefin.png`,
] as const;
const REVEAL_LEGENDARY_VARIANTS = [
    `${ASSET_BASE}/eye-crown_fish.png`,
    `${ASSET_BASE}/enlightened_leviathan.png`,
    `${ASSET_BASE}/awakened_bracefin.png`,
] as const;

const REVEAL_MYTHICAL_VARIANTS = [
    `${ASSET_BASE}/Ascender_Fish.png`,
    `${ASSET_BASE}/KoKo_Monster.png`,
    `${ASSET_BASE}/awakened_onefin.png`,
] as const;

const REVEAL_ENLIGHTENED_VARIANTS = [
    `${ASSET_BASE}/enlightened_leviathan.png`,
    `${ASSET_BASE}/eye-crown_fish.png`,
    `${ASSET_BASE}/Ascender_Fish.png`,
] as const;

export type GetRevealSpriteOptions = {
    /** True when the round paid 0 APE / 0x — Forsaken loss art only. */
    zeroPercentWin?: boolean;
};

/** Stable pick for catch card art (common / legendary vary by seed; boot+loss only for 0% wins). */
export function getRevealSprite(
    tier: FishRevealTier,
    variantSeed = 0,
    opts?: GetRevealSpriteOptions,
): string {
    const n = Number.isFinite(variantSeed) ? Math.abs(Math.trunc(variantSeed)) : 0;

    if (opts?.zeroPercentWin === true || tier === "junk") {
        return REVEAL_ZERO_WIN_SPRITES[n % REVEAL_ZERO_WIN_SPRITES.length]!;
    }
    if (tier === "common") {
        return REVEAL_COMMON_VARIANTS[n % REVEAL_COMMON_VARIANTS.length]!;
    }
    if (tier === "mythical") {
        return REVEAL_MYTHICAL_VARIANTS[n % REVEAL_MYTHICAL_VARIANTS.length]!;
    }
    if (tier === "enlightened") {
        return REVEAL_ENLIGHTENED_VARIANTS[n % REVEAL_ENLIGHTENED_VARIANTS.length]!;
    }
    if (tier === "legendary") {
        return REVEAL_LEGENDARY_VARIANTS[n % REVEAL_LEGENDARY_VARIANTS.length]!;
    }
    return REVEAL_SPRITES[tier];
}

/** Row order for the fish compendium / info page. */
export const FISH_GUIDE_TIER_ORDER: readonly FishRevealTier[] = [
    "junk",
    "common",
    "mid",
    "rare",
    "legendary",
    "mythical",
    "enlightened",
] as const;

/** Human-readable payout multiple band for each reveal tier (`tierFromMultiplier`). */
export const REVEAL_TIER_MULTIPLIER_RANGE: Record<FishRevealTier, string> = {
    junk: "0×",
    common: ">0×   –   <1×",
    mid: "1×   –   <1.2×",
    rare: "1.2×   –   <2×",
    legendary: "2×   –   <5×",
    mythical: "5×   –   <12×",
    enlightened: "12×+",
};

/** Short class / kinship label for the almanac (separate from display name). */
export const REVEAL_TIER_CLASS: Record<FishRevealTier, string> = {
    junk: "Cursed haul",
    common: "Shoal-born",
    mid: "Tide-touched",
    rare: "Deep-marked",
    legendary: "Depth-crowned",
    mythical: "Myth-kin",
    enlightened: "Ascendant",
};

/** One representative portrait per tier for the fish guide (variants may differ in play). */
export function getFishGuidePortraitSrc(tier: FishRevealTier): string {
    if (tier === "junk") {
        return `${ASSET_BASE}/Forsaken_Batula.png`;
    }
    if (tier === "common") {
        return REVEAL_COMMON_VARIANTS[0]!;
    }
    if (tier === "legendary") {
        return REVEAL_LEGENDARY_VARIANTS[0]!;
    }
    if (tier === "mythical") {
        return REVEAL_MYTHICAL_VARIANTS[0]!;
    }
    if (tier === "enlightened") {
        return REVEAL_ENLIGHTENED_VARIANTS[0]!;
    }
    return REVEAL_SPRITES[tier];
}

/** Static angler on the dock before casting and again on catch reveal. */
export const CHARACTER_IDLE_SPRITE = `${ASSET_BASE}/character_idle.png`;

/** Still frame while the line is in the water (after cast deploys): waiting → bite → reeling. */
export const CHARACTER_CAST_IDLE_SPRITE = `${ASSET_BASE}/character_cast_idle.png`;

/** Animated cast while the line extends into the water (`public/submissions/cast-and-brace/character_cast.gif`). */
export const CHARACTER_CAST_GIF = `${ASSET_BASE}/character_cast.gif`;

/**
 * Fallback if GIF frame delays can’t be read from `character_cast.gif` (fetch/parse).
 */
export const CHARACTER_CAST_GIF_DURATION_MS = 1050;

/** Peek-a-boo critter (bottom-left of scene; top half of sprite only). */
export const GIMBOZ_SPRITE = `${ASSET_BASE}/gimboz.png`;

/**
 * Native pixel size of the scene art (all layers share this frame: bg_main, bg_clouds, bg_dock).
 * Game viewport aspect ratio must match so the frame isn’t cropped or letterboxed.
 */
export const MY_GAME_BG_PIXEL_WIDTH = 609;
export const MY_GAME_BG_PIXEL_HEIGHT = 385;

/**
 * Pixel on the shared scene canvas where the angler’s **feet** (sprite bottom-left)
 * should sit — measure `(x, y)` from the **top-left** of `bg_dock.png` (same 609×385
 * frame as `bg_main`). Code maps this to the live artboard with `left` + `bottom`.
 */
export const CHARACTER_FEET_ANCHOR_PX = {
    x: 49,
    y: 216 + MY_GAME_BG_PIXEL_HEIGHT * 0.001,
} as const;

/** How many fishing rounds one “Cast line” session can run (setup UI + session loop). */
export const MY_GAME_MIN_CASTS_PER_SESSION = 1;
export const MY_GAME_MAX_CASTS_PER_SESSION = 15;

export function clampCastsPerSession(n: number): number {
    const t = Math.trunc(Number(n));
    if (!Number.isFinite(t)) {
        return MY_GAME_MIN_CASTS_PER_SESSION;
    }
    return Math.min(
        MY_GAME_MAX_CASTS_PER_SESSION,
        Math.max(MY_GAME_MIN_CASTS_PER_SESSION, t),
    );
}

/** Pretty multiplier for HUD (e.g. 1.25x, 2x, 12.5x). */
export function formatRevealMultiplierLabel(multiple: number): string {
    if (!Number.isFinite(multiple) || multiple <= 0) {
        return "0x";
    }
    const s = multiple.toLocaleString(undefined, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
    });
    return `${s}x`;
}

/**
 * Dev fallback: derives a catch from the VRF/random word bytes (deterministic, not Math.random).
 * Production: pass `resolvedPlatformResult` from `playGame()` — do not use this for live outcomes.
 */
export function fishResultFromRandomWord(word: Hex): FishPlatformResult {
    const slice = word.slice(2, 4);
    const byte = parseInt(slice, 16);
    const n = outcomesBySortOrder.length;
    const payoutIndex = Number.isFinite(byte) ? byte % n : 0;
    const row = outcomesBySortOrder[payoutIndex] ?? outcomesBySortOrder[0]!;
    return {
        payoutIndex,
        payoutMultiplier: row.multiplier,
    };
}

/**
 * Dev-only mock: platform result that resolves to KoKo Monster (jackpot row).
 * Use with `?devKoko=1` on the game page in development — strip the param after one play.
 */
export function devKokoJackpotPlatformResult(): FishPlatformResult {
    const idx = outcomesBySortOrder.findIndex((o) => o.id === "koko_monster");
    const i = idx >= 0 ? idx : outcomesBySortOrder.length - 1;
    const row = outcomesBySortOrder[i]!;
    return {
        payoutIndex: i,
        payoutMultiplier: row.multiplier,
    };
}

export const initialFishingPhase: FishingPhase = "idle";

/**
 * Deterministic idle-school layout (same every load / reset / SSR+client).
 * Avoids a post-mount seed swap that re-ran `buildIdleSchool` and shifted fish vertically.
 */
export const IDLE_FISH_SCHOOL_SEED = 0x5ca1e111 >>> 0;

/** Human-facing label for the fishing HUD under the game window. */
export function fishingPhaseDisplayLabel(phase: FishingPhase): string {
    const labels: Record<FishingPhase, string> = {
        idle: "Idle",
        casting: "Casting",
        waiting: "Line out (waiting)",
        bite: "BITE!",
        reeling: "Fight — reel!",
        reveal: "Catch!",
    };
    return labels[phase];
}

/** When the optional manual advance control should be interactive. */
export function fishingManualAdvanceEnabled(
    currentView: 0 | 1 | 2,
    phase: FishingPhase,
): boolean {
    return (
        currentView === 1 &&
        phase !== "idle" &&
        phase !== "reveal" &&
        phase !== "casting" &&
        phase !== "waiting" &&
        phase !== "bite" &&
        phase !== "reeling"
    );
}

/** Time line sits in the water before the bite (ms). */
export const WAITING_TO_BITE_MS = 3000;

/** “BITE” shows first; “REEL” after this delay — matches BITE pop animation (~0.52s). */
export const BITE_WORD_BEFORE_REEL_MS = 540;
/** “REEL” pop + read time before `reeling` opens (ms). */
export const REEL_FLASH_ALERT_MS = 480;
/** Full bite phase: BITE → REEL, then minigame. */
export const BITE_ALERT_MS =
    BITE_WORD_BEFORE_REEL_MS + REEL_FLASH_ALERT_MS;

/** Inclusive tap count to fill the reel meter (before decay / fight-back dips). */
export const REEL_TAP_GOAL_MIN = 5;
export const REEL_TAP_GOAL_MAX = 25;

/**
 * Uniform integer in [REEL_TAP_GOAL_MIN, REEL_TAP_GOAL_MAX].
 * Uses crypto RNG when available so this stays independent of catch outcome / VRF bytes.
 */
export function randomReelTapGoal(): number {
    const min = REEL_TAP_GOAL_MIN;
    const max = REEL_TAP_GOAL_MAX;
    const span = max - min + 1;
    if (typeof globalThis.crypto?.getRandomValues === "function") {
        const buf = new Uint32Array(1);
        globalThis.crypto.getRandomValues(buf);
        return min + (buf[0]! % span);
    }
    return min + Math.floor(Math.random() * span);
}

/** Meter drain while fighting (one tick every `REEL_METER_DECAY_INTERVAL_MS`). */
export const REEL_METER_DECAY_PER_TICK = 0.085;
export const REEL_METER_DECAY_INTERVAL_MS = 50;

/** Periodic fish “fight back” — extra meter loss, scaled by random in [0,1). */
export const REEL_FIGHT_DIP_MIN = 6;
export const REEL_FIGHT_DIP_MAX = 13;
export const REEL_FIGHT_DIP_INTERVAL_MIN_MS = 1200;
export const REEL_FIGHT_DIP_INTERVAL_MAX_MS = 2000;

/** Fish catch card on the playfield before the platform “You won” results modal (ms). */
export const CATCH_REVEAL_DISPLAY_MS = 3200;

/**
 * KoKo jackpot catch-reveal: advance after full video (`ended`), or this fallback if
 * `ended` never fires (broken file, autoplay block, etc.).
 */
export const KOKO_CATCH_REVEAL_SAFETY_MS = 300_000;

export const myGame: Game = {
    title: "Cast & Brace",
    description:
        "Player vs house fishing game. Cast your line and see what the depths return.",
    gameAddress: "0x1234567890123456789012345678901234567890",
    /** GameWindow static fill; in-scene layers are composed in `WaterBackground`. */
    gameBackground: `${ASSET_BASE}/bg_main.png`,
    card: `${ASSET_BASE}/card.png`,
    banner: `${ASSET_BASE}/banner.png`,
    themeColorBackground: "#0d9488",
    /* Add `song: "/submissions/cast-and-brace/audio/song.mp3"` and set GameWindow `disableBuiltInSong={false}` when you ship an MP3. */
    payouts: {
        0: {
            0: buildPayoutsRow(),
        },
    },
};
