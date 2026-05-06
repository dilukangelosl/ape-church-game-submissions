const STORAGE_KEY = "cast-brace-player-stats-v1";

export type PersistedPlayerStats = {
    biggestCatchApe: number;
    highestMultiplier: number;
};

const DEFAULTS: PersistedPlayerStats = {
    biggestCatchApe: 0,
    highestMultiplier: 0,
};

/** Stable snapshot for SSR + hydration (must match `loadPlayerStats()` on server). */
export const SERVER_PLAYER_STATS_SNAPSHOT: PersistedPlayerStats =
    Object.freeze({ ...DEFAULTS });

const listeners = new Set<() => void>();
let statsTick = 0;

let cachedClientSnapshot: PersistedPlayerStats = { ...DEFAULTS };
let cachedClientSnapshotTick = -1;

function bumpStatsTick(): void {
    statsTick += 1;
    listeners.forEach((fn) => {
        fn();
    });
}

/** For `useSyncExternalStore` — bumps when `savePlayerStats` runs. */
export function subscribePlayerStats(onChange: () => void): () => void {
    listeners.add(onChange);
    return () => {
        listeners.delete(onChange);
    };
}

function readPlayerStatsFromStorage(): PersistedPlayerStats {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { ...DEFAULTS };
        }
        const p = JSON.parse(raw) as Record<string, unknown>;
        return {
            biggestCatchApe: Math.max(
                0,
                Number(p.biggestCatchApe) || 0,
            ),
            highestMultiplier: Math.max(
                0,
                Number(p.highestMultiplier) || 0,
            ),
        };
    } catch {
        return { ...DEFAULTS };
    }
}

/**
 * `useSyncExternalStore` client snapshot: reads localStorage when `statsTick` changes.
 * Returns a stable object reference between ticks so React does not loop.
 */
export function getPlayerStatsSnapshot(): PersistedPlayerStats {
    if (typeof window === "undefined") {
        return SERVER_PLAYER_STATS_SNAPSHOT;
    }
    if (statsTick !== cachedClientSnapshotTick) {
        cachedClientSnapshotTick = statsTick;
        cachedClientSnapshot = readPlayerStatsFromStorage();
    }
    return cachedClientSnapshot;
}

/** `useSyncExternalStore` server / hydration snapshot — never read localStorage. */
export function getServerPlayerStatsSnapshot(): PersistedPlayerStats {
    return SERVER_PLAYER_STATS_SNAPSHOT;
}

export function loadPlayerStats(): PersistedPlayerStats {
    if (typeof window === "undefined") {
        return { ...DEFAULTS };
    }
    return readPlayerStatsFromStorage();
}

export function savePlayerStats(next: PersistedPlayerStats): void {
    if (typeof window === "undefined") {
        return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    cachedClientSnapshotTick = -1;
    bumpStatsTick();
}

export function mergeRoundIntoPlayerStats(
    prev: PersistedPlayerStats,
    payoutApe: number,
    multiplier: number,
): PersistedPlayerStats {
    const m = Number.isFinite(multiplier) ? multiplier : 0;
    const p = Number.isFinite(payoutApe) ? payoutApe : 0;
    return {
        biggestCatchApe: Math.max(prev.biggestCatchApe, Math.max(0, p)),
        highestMultiplier: Math.max(prev.highestMultiplier, Math.max(0, m)),
    };
}
