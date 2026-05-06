import { outcomes, type OutcomeConfig } from "./outcomes";

/** Stable row order for payouts, dev mock, and manifest. */
export const outcomesBySortOrder: OutcomeConfig[] = [...outcomes].sort(
    (a, b) => a.sortOrder - b.sortOrder,
);

const MULT_MATCH_EPS = 1e-6;

/** Non-negative modulo — stable for negative `payoutIndex` from upstream. */
export function unsignedMod(n: number, m: number): number {
    if (!Number.isFinite(m) || m <= 0) {
        return 0;
    }
    const t = Math.trunc(n);
    return ((t % m) + m) % m;
}

export function multipliersMatch(a: number, b: number): boolean {
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
        return false;
    }
    return Math.abs(a - b) < MULT_MATCH_EPS;
}

function lossFallback(): OutcomeConfig {
    return (
        outcomesBySortOrder.find((o) => o.isLoss === true) ??
        outcomesBySortOrder[0]!
    );
}

/**
 * Maps platform payout multiple + ledger row index to exactly one chart row.
 *
 * Tie-break (same `multiplier` on several fish): candidates are sorted by
 * `sortOrder`; `payoutIndex` picks deterministically via `unsignedMod`, so
 * distinct platform indices still map to distinct fish when the pool size > 1.
 */
export function resolveOutcomeFromPlatform(
    payoutMultiple: number,
    payoutIndex: number,
): OutcomeConfig {
    if (!Number.isFinite(payoutMultiple)) {
        return lossFallback();
    }
    const pool = outcomesBySortOrder.filter((o) =>
        multipliersMatch(o.multiplier, payoutMultiple),
    );
    if (pool.length === 0) {
        let best = outcomesBySortOrder[0]!;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const o of outcomesBySortOrder) {
            const d = Math.abs(o.multiplier - payoutMultiple);
            if (d < bestDist) {
                bestDist = d;
                best = o;
            }
        }
        return best;
    }
    const sorted = [...pool].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = unsignedMod(payoutIndex, sorted.length);
    return sorted[idx]!;
}

/** `getPayout` factors: multiple × 10_000 → integer ape units per 1 APE bet. */
export function buildPayoutsRow(): Record<number, number> {
    const row: Record<number, number> = {};
    outcomesBySortOrder.forEach((o, i) => {
        row[i] = Math.round(o.multiplier * 10_000);
    });
    return row;
}

export function formatChartMultiplier(mult: number): string {
    if (!Number.isFinite(mult) || mult < 0) {
        return "0.0x";
    }
    return `${mult.toFixed(1)}x`;
}

export function formatChartFrequency(pct: number): string {
    if (!Number.isFinite(pct)) {
        return "0.0%";
    }
    return `${pct.toFixed(1)}%`;
}
