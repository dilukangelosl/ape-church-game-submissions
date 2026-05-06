import type { OutcomeConfig } from "./outcomes";

const MY_GAME = "/my-game";

/** KoKo catch reveal uses still art (keep assets small for submission). */
export const KOKO_CATCH_REVEAL_VIDEO_PATH: string | null = null;

/** Optional extra paths if a portrait is renamed on disk without updating `outcomes.filename`. */
const OUTCOME_IMAGE_ALTS: Readonly<Record<string, readonly string[]>> = {};

function dedupe(paths: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of paths) {
        if (!seen.has(p)) {
            seen.add(p);
            out.push(p);
        }
    }
    return out;
}

/** Ordered URL candidates; try in order until one loads. */
export function getOutcomeImageCandidates(o: OutcomeConfig): string[] {
    const primary = `${MY_GAME}/${o.filename}`;
    const extras = OUTCOME_IMAGE_ALTS[o.id] ?? [];
    return dedupe([primary, ...extras]);
}
