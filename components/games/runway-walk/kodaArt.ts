/**
 * Same approach as Pageant Showdown's kodaPool.ts, duplicated here rather
 * than imported across game folders — each Ape Church submission needs to
 * be fully self-contained (one game per PR, independently reviewable), so
 * this game doesn't depend on Pageant Showdown's folder existing or being
 * merged.
 *
 * Real Otherside Koda images via their own official asset CDN:
 * https://assets.otherside.xyz/kodas/pfp_full/1200px/{id}.webp — ID range
 * 0-9999. No API key needed, no server route required.
 */

export interface KodaEntry {
    id: number;
    image: string;
}

const KODA_MAX_ID = 9999;

function kodaImageUrl(id: number): string {
    return `https://assets.otherside.xyz/kodas/pfp_full/1200px/${id}.webp`;
}

function randomKodaId(): number {
    return Math.floor(Math.random() * (KODA_MAX_ID + 1));
}

export function pickRandomKoda(): KodaEntry {
    const id = randomKodaId();
    return { id, image: kodaImageUrl(id) };
}

/** Fixed, non-random placeholder — used only for the very first render
 * before pickRandomKoda() runs client-side in a useEffect, to avoid a
 * Next.js hydration mismatch. */
export const PLACEHOLDER_KODA: KodaEntry = { id: 1, image: kodaImageUrl(1) };