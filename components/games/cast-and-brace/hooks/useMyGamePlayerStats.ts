"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
    getPlayerStatsSnapshot,
    getServerPlayerStatsSnapshot,
    loadPlayerStats,
    mergeRoundIntoPlayerStats,
    savePlayerStats,
    subscribePlayerStats,
    type PersistedPlayerStats,
} from "../lib/myGamePlayerStats";

export function useMyGamePlayerStats(): {
    stats: PersistedPlayerStats;
    recordSettledRound: (payoutApe: number, multiplier: number) => void;
} {
    const stats = useSyncExternalStore(
        subscribePlayerStats,
        getPlayerStatsSnapshot,
        getServerPlayerStatsSnapshot,
    );

    const recordSettledRound = useCallback(
        (payoutApe: number, multiplier: number) => {
            const prev = loadPlayerStats();
            const next = mergeRoundIntoPlayerStats(
                prev,
                payoutApe,
                multiplier,
            );
            savePlayerStats(next);
        },
        [],
    );

    return { stats, recordSettledRound };
}
