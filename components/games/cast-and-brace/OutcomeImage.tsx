"use client";

import React, { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { OutcomeConfig } from "./config/outcomes";
import { getOutcomeImageCandidates } from "./config/outcomeAssets";

/** Linear scale vs other chart fish (width × height). */
export const KOKO_MONSTER_PORTRAIT_SCALE = 3;

export function outcomePortraitLinearScale(outcome: OutcomeConfig): number {
    return outcome.id === "koko_monster" ? KOKO_MONSTER_PORTRAIT_SCALE : 1;
}

export interface OutcomeImageProps {
    outcome: OutcomeConfig;
    alt?: string;
    width: number;
    height: number;
    className?: string;
    priority?: boolean;
    /** When set, overrides {@link outcomePortraitLinearScale} (e.g. smaller KoKo in catch reveal). */
    portraitScale?: number;
}

const OutcomeImage: React.FC<OutcomeImageProps> = ({
    outcome,
    alt = "",
    width,
    height,
    className,
    priority,
    portraitScale,
}) => {
    const candidates = useMemo(
        () => getOutcomeImageCandidates(outcome),
        [outcome],
    );
    const [index, setIndex] = useState(0);
    const s = portraitScale ?? outcomePortraitLinearScale(outcome);
    const iw = Math.round(width * s);
    const ih = Math.round(height * s);

    const onError = useCallback(() => {
        setIndex((i) => i + 1);
    }, []);

    if (index >= candidates.length) {
        return (
            <div
                className={cn(
                    "flex items-center justify-center rounded-md border border-[#3d4a55] bg-[#0f1418] text-[10px] font-semibold uppercase tracking-wide text-[#8a9399]",
                    className,
                )}
                style={{ width: iw, height: ih }}
                aria-hidden={!alt}
            >
                ?
            </div>
        );
    }

    const src = candidates[index]!;

    return (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic public/ paths + GIF fallbacks; native onError candidate chain is reliable here
        <img
            key={src}
            src={src}
            alt={alt}
            width={iw}
            height={ih}
            className={cn(
                "max-h-full max-w-full object-contain",
                className,
            )}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
            onError={onError}
        />
    );
};

export default OutcomeImage;
