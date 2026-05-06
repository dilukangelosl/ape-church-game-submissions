export type OutcomeTier =
    | "Forsaken"
    | "Driftborn"
    | "Tideborn"
    | "Awakened"
    | "Eye Crowned"
    | "Enlightened"
    | "Ascended"
    | "KoKo Monster";

export type OutcomeType =
    | "Loss"
    | "Low"
    | "Mid"
    | "High"
    | "Win"
    | "Top"
    | "Jackpot";

export type OutcomeConfig = {
    id: string;
    displayName: string;
    filename: string;
    tier: OutcomeTier;
    type: OutcomeType;
    multiplier: number;
    frequency: number;
    isLoss?: boolean;
    sortOrder: number;
};

export const outcomes: OutcomeConfig[] = [
    {
        id: "forsaken_relic",
        displayName: "Forsaken Relic",
        filename: "Forsaken_Relic.png",
        tier: "Forsaken",
        type: "Loss",
        multiplier: 0.0,
        frequency: 27.0,
        isLoss: true,
        sortOrder: 1,
    },
    {
        id: "forsaken_batula",
        displayName: "Forsaken Batula",
        filename: "Forsaken_Batula.png",
        tier: "Forsaken",
        type: "Loss",
        multiplier: 0.0,
        frequency: 27.0,
        isLoss: true,
        sortOrder: 2,
    },
    {
        id: "driftborn_minnow",
        displayName: "Driftborn Minnow",
        filename: "driftborn_minnow.png",
        tier: "Driftborn",
        type: "Low",
        multiplier: 0.4,
        frequency: 34.0,
        sortOrder: 3,
    },
    {
        id: "driftborn_pikelet",
        displayName: "Driftborn Pikelet",
        filename: "driftborn_pikelet.png",
        tier: "Driftborn",
        type: "Low",
        multiplier: 0.4,
        frequency: 34.0,
        sortOrder: 4,
    },
    {
        id: "driftborn_needlefin",
        displayName: "Driftborn Needlefin",
        filename: "driftborn_needlefin.png",
        tier: "Driftborn",
        type: "Low",
        multiplier: 0.6,
        frequency: 34.0,
        sortOrder: 5,
    },
    {
        id: "driftborn_bracegill",
        displayName: "Driftborn Bracegill",
        filename: "driftborn_bracegill.png",
        tier: "Driftborn",
        type: "Low",
        multiplier: 0.6,
        frequency: 34.0,
        sortOrder: 6,
    },
    {
        id: "tidebound_fangfin",
        displayName: "Tidebound Fangfin",
        filename: "tidebound_fangfin.png",
        tier: "Tideborn",
        type: "Mid",
        multiplier: 0.8,
        frequency: 22.0,
        sortOrder: 7,
    },
    {
        id: "tidebound_strongtail",
        displayName: "Tidebound Strongtail",
        filename: "Tidebound_strongtail.png",
        tier: "Tideborn",
        type: "Mid",
        multiplier: 0.8,
        frequency: 22.0,
        sortOrder: 8,
    },
    {
        id: "tidebound_longjaw",
        displayName: "Tidebound Longjaw",
        filename: "tidebound_longjaw.png",
        tier: "Tideborn",
        type: "Mid",
        multiplier: 1.0,
        frequency: 22.0,
        sortOrder: 9,
    },
    {
        id: "awakened_bracefin",
        displayName: "Awakened Bracefin",
        filename: "awakened_bracefin.png",
        tier: "Awakened",
        type: "High",
        multiplier: 1.4,
        frequency: 11.0,
        sortOrder: 10,
    },
    {
        id: "awakened_onefin",
        displayName: "Awakened Onefin",
        filename: "awakened_onefin.png",
        tier: "Awakened",
        type: "High",
        multiplier: 1.8,
        frequency: 11.0,
        sortOrder: 11,
    },
    {
        id: "eye_crown_fish",
        displayName: "Eye-Crown Fish",
        filename: "eye-crown_fish.png",
        tier: "Eye Crowned",
        type: "Win",
        multiplier: 2.5,
        frequency: 3.5,
        sortOrder: 12,
    },
    {
        id: "enlightened_leviathan",
        displayName: "Enlightened Leviathan",
        filename: "enlightened_leviathan.png",
        tier: "Enlightened",
        type: "Win",
        multiplier: 4.0,
        frequency: 1.0,
        sortOrder: 13,
    },
    {
        id: "ascender_fish",
        displayName: "Ascender Fish",
        filename: "Ascender_Fish.png",
        tier: "Ascended",
        type: "Top",
        multiplier: 8.0,
        frequency: 1.3,
        sortOrder: 14,
    },
    {
        id: "koko_monster",
        displayName: "KoKo Monster",
        filename: "KoKo_Monster.png",
        tier: "KoKo Monster",
        type: "Jackpot",
        multiplier: 20.0,
        frequency: 0.2,
        sortOrder: 15,
    },
];

/**
 * Entry menu + codex chrome (single file surface with the chart).
 * Fish names, tiers, types, multipliers, and art paths always come from `outcomes[]`.
 */
export const entryScreenCopy = {
    primaryCta: "Lets BRACE",
    primaryCtaHint: "Lets catch some fish",
    secondaryCta: "Manifest",
    secondaryCtaHint: "study the codex",
    codexTitle: "Eye-fish Codex",
    codexBack: "Return to Lake",
    codexStatMultiplier: "Multiplier",
    codexStatFrequency: "Frequency",
    /** Title image under `public/submissions/cast-and-brace/` (not a fish portrait). */
    menuLogoFilename: "title_logo.png",
} as const;

export function menuLogoPublicPath(): string {
    return `/submissions/cast-and-brace/${entryScreenCopy.menuLogoFilename}`;
}
