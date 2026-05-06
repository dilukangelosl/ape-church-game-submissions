"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { IDLE_FISH_SPRITE_PATHS } from "./myGameConfig";

function createRng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), a | 1);
        t = (t + Math.imul(t ^ (t >>> 7), t | 61)) | 0;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function rndPx(rng: () => number, min: number, max: number): string {
    return `${(min + rng() * (max - min)).toFixed(1)}px`;
}

export interface IdleSchoolFishSpec {
    id: string;
    src: string;
    cxPct: number;
    cyPct: number;
    panX0: string;
    panX1: string;
    panY0: string;
    panY1: string;
    panLegSec: number;
    delaySec: number;
    alternateReverse: boolean;
    yWobble0: string;
    yWobble1: string;
    yWobble2: string;
    yWobble3: string;
    yWobbleSec: number;
    yWobbleDelaySec: number;
    fishScale: number;
    widthPx: number;
    bobDurSec: number;
    bobDelaySec: string;
    bobDy: string;
}

/**
 * Default vertical band for the school layer (inset from scene top/bottom, %).
 * Same band is used for setup idle, full round, and replay so fish never
 * “jump” to a different depth range between phases.
 * (Smaller top inset = band + fish sit higher on the game screen.)
 */
const IDLE_FISH_BAND_TOP_PCT = 50;
const IDLE_FISH_BAND_BOTTOM_PCT = -15;

function buildIdleSchool(seed: number): IdleSchoolFishSpec[] {
    const rng = createRng(seed ^ 0x1a2b3c4d);
    const sprites = [...IDLE_FISH_SPRITE_PATHS];
    for (let i = sprites.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = sprites[i];
        sprites[i] = sprites[j]!;
        sprites[j] = tmp!;
    }
    const count = sprites.length;
    const fish: IdleSchoolFishSpec[] = [];

    const clusterCx = 50 + rng() * 18;
    /* Positions are % within the band (top of band = 0%, bottom = 100%). Spread through the strip. */
    const clusterCy = 38 + rng() * 54;

    for (let i = 0; i < count; i++) {
        const sprite = sprites[i] ?? sprites[0];
        const cxPct = clusterCx + (rng() - 0.5) * 34;
        const cyPct = Math.min(
            96,
            Math.max(
                0,
                clusterCy + (rng() - 0.5) * 44,
            ),
        );
        /* Calmer motion — smaller pan / bob so the school doesn’t feel hyperactive. */
        const span = 17 + rng() * 11;
        /* cqw tracks the artboard; vw made pan oversized vs the scene on phones. */
        const panX0 = `${-(span * (0.45 + rng() * 0.25)).toFixed(1)}cqw`;
        const panX1 = `${(span * (0.45 + rng() * 0.25)).toFixed(1)}cqw`;
        const panY0 = rndPx(rng, -4, 4);
        const panY1 = rndPx(rng, -4, 4);
        const panLegSec = Number((7.2 + rng() * 6.5).toFixed(6));
        const delaySec = Number((-rng() * panLegSec * 2).toFixed(6));
        const alternateReverse = rng() > 0.5;
        const yWobble0 = rndPx(rng, -5, 5);
        const yWobble1 = rndPx(rng, -5, 5);
        const yWobble2 = rndPx(rng, -5, 5);
        const yWobble3 = rndPx(rng, -5, 5);
        const yWobbleSec = Number((7.5 + rng() * 9).toFixed(6));
        const yWobbleDelaySec = Number((rng() * 4).toFixed(6));
        const fishScale = Number((0.42 + rng() * 0.5).toFixed(6));
        const widthPx = 22 + Math.floor(rng() * 30);
        const bobDurSec = Number((3.2 + rng() * 3.2).toFixed(6));
        const bobDelaySec = `${(rng() * 2.8).toFixed(2)}s`;
        const bobDy = `-${(0.7 + rng() * 2.2).toFixed(1)}px`;

        fish.push({
            id: `idle-school-${seed}-${i}`,
            src: sprite,
            cxPct: Number(cxPct.toFixed(4)),
            cyPct: Number(cyPct.toFixed(4)),
            panX0,
            panX1,
            panY0,
            panY1,
            panLegSec,
            delaySec,
            alternateReverse,
            yWobble0,
            yWobble1,
            yWobble2,
            yWobble3,
            yWobbleSec,
            yWobbleDelaySec,
            fishScale,
            widthPx,
            bobDurSec,
            bobDelaySec,
            bobDy,
        });
    }

    return fish;
}

export interface IdleFishSchoolProps {
    schoolSeed: number;
    /** Dark silhouettes (gameplay); full color when false (idle / after catch). */
    silhouette?: boolean;
    /** Scene inset from top (defaults match gameplay / idle). */
    bandTopPct?: number;
    /** Scene inset from bottom (defaults match gameplay / idle). */
    bandBottomPct?: number;
}

const IdleFishSchool: React.FC<IdleFishSchoolProps> = ({
    schoolSeed,
    silhouette = false,
    bandTopPct = IDLE_FISH_BAND_TOP_PCT,
    bandBottomPct = IDLE_FISH_BAND_BOTTOM_PCT,
}) => {
    const specs = useMemo(() => buildIdleSchool(schoolSeed), [schoolSeed]);
    const bandHeightPct = 100 - bandTopPct - bandBottomPct;

    return (
        <div
            className="pointer-events-none absolute inset-x-0 z-[6] overflow-hidden"
            style={{
                left: 0,
                right: 0,
                top: `${bandTopPct}%`,
                bottom: "auto",
                height: `${bandHeightPct}%`,
            }}
            aria-hidden
        >
            {specs.map((f) => (
                <div
                    key={f.id}
                    className="emerald-idle-school-anchor absolute"
                    style={{
                        left: `${f.cxPct}%`,
                        top: `${f.cyPct}%`,
                    }}
                >
                    <div
                        className="emerald-idle-school-pan"
                        style={
                            {
                                ["--idle-pan-x0" as string]: f.panX0,
                                ["--idle-pan-x1" as string]: f.panX1,
                                ["--idle-pan-y0" as string]: f.panY0,
                                ["--idle-pan-y1" as string]: f.panY1,
                                animationDuration: `${f.panLegSec.toFixed(6)}s`,
                                animationDelay: `${f.delaySec.toFixed(6)}s`,
                                animationDirection: f.alternateReverse
                                    ? "alternate-reverse"
                                    : "alternate",
                            } as React.CSSProperties
                        }
                    >
                        <div
                            className="emerald-idle-school-face"
                            style={
                                {
                                    ["--idle-face-a" as string]:
                                        f.alternateReverse ? -1 : 1,
                                    ["--idle-face-b" as string]:
                                        f.alternateReverse ? 1 : -1,
                                    animationDuration: `${(f.panLegSec * 2).toFixed(6)}s`,
                                    animationDelay: `${f.delaySec.toFixed(6)}s`,
                                } as React.CSSProperties
                            }
                        >
                        <div
                            className="emerald-idle-school-y-wobble"
                            style={
                                {
                                    ["--idle-y-0" as string]: f.yWobble0,
                                    ["--idle-y-1" as string]: f.yWobble1,
                                    ["--idle-y-2" as string]: f.yWobble2,
                                    ["--idle-y-3" as string]: f.yWobble3,
                                    animationDuration: `${f.yWobbleSec.toFixed(6)}s`,
                                    animationDelay: `${f.yWobbleDelaySec.toFixed(6)}s`,
                                } as React.CSSProperties
                            }
                        >
                        <div
                            className="emerald-idle-school-bob"
                            style={
                                {
                                    ["--idle-bob-dy" as string]: f.bobDy,
                                    animationDuration: `${f.bobDurSec.toFixed(6)}s`,
                                    animationDelay: f.bobDelaySec,
                                } as React.CSSProperties
                            }
                        >
                            <div className="origin-center max-[480px]:scale-[0.72]">
                                <div
                                    className="origin-center"
                                    style={{
                                        transform: `scale(${(f.fishScale * 1.65).toFixed(6)})`,
                                    }}
                                >
                                    <Image
                                        src={f.src}
                                        alt=""
                                        width={f.widthPx}
                                        height={Math.round(f.widthPx * 0.55)}
                                        className={
                                            silhouette
                                                ? "emerald-fish-silhouette h-auto max-w-none object-contain opacity-[0.52] [image-rendering:pixelated]"
                                                : "h-auto max-w-none object-contain drop-shadow-[0_1px_3px_rgb(0_0_0_/_0.45)] [image-rendering:pixelated]"
                                        }
                                        style={{
                                            width: f.widthPx,
                                            height: "auto",
                                        }}
                                        unoptimized
                                        draggable={false}
                                    />
                                </div>
                            </div>
                        </div>
                        </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default IdleFishSchool;
