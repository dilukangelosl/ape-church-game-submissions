"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { AMBIENT_FISH_SPRITE_PATHS } from "./myGameConfig";

/** Match idle school: silhouettes only in the lower portion of the scene. */
const FISH_BAND_FRAC = 0.4;

function createRng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), a | 1);
        t = (t + Math.imul(t ^ (t >>> 7), t | 61)) | 0;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export interface ShadowFishSpec {
    id: string;
    src: string;
    topPct: number;
    durationSec: number;
    delaySec: number;
    driftPx: number;
    flip: boolean;
    rotDeg: number;
    scale: number;
    baseWidthPx: number;
    opacity: number;
}

function buildSwarm(seed: number): ShadowFishSpec[] {
    const rng = createRng(seed);
    const count = 5 + Math.floor(rng() * 6);
    const fish: ShadowFishSpec[] = [];

    for (let i = 0; i < count; i++) {
        const sprite =
            AMBIENT_FISH_SPRITE_PATHS[
                Math.floor(rng() * AMBIENT_FISH_SPRITE_PATHS.length)
            ] ?? AMBIENT_FISH_SPRITE_PATHS[0];
        const topPct = 6 + rng() * 88;
        const durationSec = 38 + rng() * 52;
        const delaySec = -rng() * durationSec;
        const driftPx = 4 + rng() * 12;
        const flip = rng() > 0.5;
        const rotDeg = -14 + rng() * 28;
        const scale = 0.55 + rng() * 0.65;
        const baseWidthPx = 32 + Math.floor(rng() * 56);
        const opacity = 0.32 + rng() * 0.26;

        fish.push({
            id: `swarm-${seed}-${i}`,
            src: sprite,
            topPct,
            durationSec,
            delaySec,
            driftPx,
            flip,
            rotDeg,
            scale,
            baseWidthPx,
            opacity,
        });
    }

    return fish;
}

export interface UnderwaterSwarmProps {
    /** Derive stable swarm from cast / session. */
    swarmSeed: number;
}

const UnderwaterSwarm: React.FC<UnderwaterSwarmProps> = ({ swarmSeed }) => {
    const specs = useMemo(() => buildSwarm(swarmSeed), [swarmSeed]);

    return (
        <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[7] overflow-hidden"
            style={{ height: `${FISH_BAND_FRAC * 100}%` }}
            aria-hidden
        >
            {specs.map((f) => (
                <div
                    key={f.id}
                    className="emerald-fish-swim absolute left-0"
                    style={
                        {
                            top: `${f.topPct}%`,
                            animationDuration: `${f.durationSec}s`,
                            animationDelay: `${f.delaySec}s`,
                            ["--emerald-fish-drift-y" as string]: `${f.driftPx}px`,
                            opacity: f.opacity,
                        } as React.CSSProperties
                    }
                >
                    <div
                        className="origin-center"
                        style={{
                            transform: `scaleX(${f.flip ? -1 : 1}) rotate(${f.rotDeg}deg) scale(${f.scale})`,
                        }}
                    >
                        <Image
                            src={f.src}
                            alt=""
                            width={f.baseWidthPx}
                            height={Math.round(f.baseWidthPx * 0.55)}
                            className="emerald-fish-silhouette h-auto max-w-none"
                            style={{ width: f.baseWidthPx, height: "auto" }}
                            unoptimized
                            draggable={false}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default UnderwaterSwarm;
