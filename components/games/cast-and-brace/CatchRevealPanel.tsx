"use client";

import React, { useLayoutEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { FishPlatformResult } from "./myGameConfig";
import type { OutcomeType } from "./config/outcomes";
import {
    formatChartMultiplier,
    resolveOutcomeFromPlatform,
} from "./config/outcomeResolve";
import { KOKO_CATCH_REVEAL_VIDEO_PATH } from "./config/outcomeAssets";
import OutcomeImage from "./OutcomeImage";

export interface CatchRevealPanelProps {
    payout: number;
    betAmount: number;
    platformResult: FishPlatformResult | null;
    /** KoKo jackpot MP4: parent advances to results after full playback. */
    onKokoCatchRevealVideoEnded?: () => void;
}

const typeGlowClass: Record<OutcomeType, string> = {
    Loss: "emerald-reveal-glow-junk",
    Low: "emerald-reveal-glow-common",
    Mid: "emerald-reveal-glow-mid",
    High: "emerald-reveal-glow-rare",
    Win: "emerald-reveal-glow-legendary",
    Top: "emerald-reveal-glow-mythical",
    Jackpot: "emerald-reveal-glow-enlightened",
};

const CatchRevealPanel: React.FC<CatchRevealPanelProps> = ({
    payout,
    betAmount,
    platformResult,
    onKokoCatchRevealVideoEnded,
}) => {
    const kokoVideoEndedNotifiedRef = useRef(false);

    useLayoutEffect(() => {
        kokoVideoEndedNotifiedRef.current = false;
    }, [payout, betAmount, platformResult?.payoutIndex]);

    const outcome = useMemo(() => {
        const mult =
            platformResult?.payoutMultiplier != null &&
            Number.isFinite(platformResult.payoutMultiplier)
                ? platformResult.payoutMultiplier
                : betAmount > 0
                  ? payout / betAmount
                  : 0;
        const payoutIndex = platformResult?.payoutIndex ?? 0;
        return resolveOutcomeFromPlatform(mult, payoutIndex);
    }, [payout, betAmount, platformResult]);

    /** Always the chart row’s multiplier so HUD matches manifest / codex. */
    const multLabel = formatChartMultiplier(outcome.multiplier);

    const glow = typeGlowClass[outcome.type];
    const isKoko = outcome.id === "koko_monster";

    const handleKokoVideoEnded = () => {
        if (kokoVideoEndedNotifiedRef.current) {
            return;
        }
        kokoVideoEndedNotifiedRef.current = true;
        onKokoCatchRevealVideoEnded?.();
    };

    return (
        <div
            className="pointer-events-none absolute inset-x-0 bottom-[6%] z-[16] flex max-h-[94%] flex-col items-center justify-end px-2 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] max-[480px]:bottom-[3%] max-[480px]:px-1.5 sm:bottom-[11%] sm:px-4"
            aria-live="polite"
        >
            <div className="flex min-h-0 w-full max-w-[min(90cqw,288px)] max-h-[min(86cqh,100%)] flex-col items-center overflow-y-auto overscroll-contain rounded-[0.65rem] border border-white/20 bg-black/65 px-2 py-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-sm max-[480px]:max-w-[min(94cqw,288px)] max-[480px]:px-[0.55rem] max-[480px]:py-[0.65rem] sm:max-w-[min(92cqw,300px)] sm:px-[1.1375rem] sm:py-[0.975rem]">
                <p className="font-nohemia text-[7px] font-semibold uppercase tracking-[0.24em] text-teal-200 sm:text-[9px]">
                    Catch
                </p>
                <h3 className="mt-0.5 max-w-[min(20ch,100%)] text-balance text-center font-nohemia text-[0.72rem] font-bold leading-tight text-white max-[480px]:text-[0.7rem] sm:mt-1 sm:text-[0.975rem]">
                    {outcome.displayName}
                </h3>
                <p className="mt-0.5 text-center font-nohemia text-[0.5rem] font-medium uppercase leading-snug tracking-[0.16em] text-teal-100/80 max-[480px]:px-0.5 max-[480px]:text-[0.48rem] sm:text-[0.625rem] sm:tracking-[0.18em]">
                    {outcome.tier} · {outcome.type}
                </p>
                <div
                    className={cn(
                        "emerald-reveal-pop relative mt-2 flex shrink-0 items-center justify-center overflow-hidden rounded-md max-[480px]:mt-1.5 sm:mt-[0.8125rem]",
                        "h-[min(5.5rem,min(23cqw,30cqh))] w-[min(5.5rem,min(23cqw,30cqh))] max-[480px]:h-[min(4.65rem,min(20cqw,26cqh))] max-[480px]:w-[min(4.65rem,min(20cqw,26cqh))] sm:h-[6.5rem] sm:w-[6.5rem]",
                        glow,
                    )}
                >
                    {isKoko && KOKO_CATCH_REVEAL_VIDEO_PATH ? (
                        <video
                            key={`koko-video-${payout}-${betAmount}-${platformResult?.payoutIndex ?? 0}`}
                            className="h-full w-full object-contain"
                            src={KOKO_CATCH_REVEAL_VIDEO_PATH}
                            autoPlay
                            muted
                            playsInline
                            loop={false}
                            controls={false}
                            disablePictureInPicture
                            aria-label={outcome.displayName}
                            onEnded={handleKokoVideoEnded}
                        />
                    ) : (
                        <OutcomeImage
                            outcome={outcome}
                            alt={outcome.displayName}
                            width={96}
                            height={96}
                            className="emerald-pixel-bg h-full w-full"
                            portraitScale={isKoko ? 1 : undefined}
                        />
                    )}
                </div>
                <p
                    className="mt-2 font-nohemia text-[1.05rem] font-bold tabular-nums leading-none tracking-tight text-white max-[480px]:mt-1.5 max-[480px]:text-[0.98rem] sm:mt-[0.975rem] sm:text-[1.95rem]"
                    style={{ textShadow: "0 0 18px rgb(45 212 191 / 0.4)" }}
                >
                    {multLabel}
                </p>
            </div>
        </div>
    );
};

export default CatchRevealPanel;
