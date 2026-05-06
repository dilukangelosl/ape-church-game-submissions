"use client";

import React from "react";
import { Cinzel } from "next/font/google";
import { cn } from "@/lib/utils";
import { formatRevealMultiplierLabel } from "./myGameConfig";

/** Classical caps serif — reads medieval / fantasy without blackletter illegibility. */
const statsMedieval = Cinzel({
    subsets: ["latin"],
    weight: ["600", "700"],
    display: "swap",
});

export interface MyGameWindowStatsStripProps {
    currentBetApe: number;
    biggestCatchApe: number;
    highestMultiplier: number;
    /** Optional “Cast i / n” during a multi-cast session (gameplay only). */
    castsProgress?: { current: number; total: number } | null;
    /** Blended into the gold border (title logo + house teal). */
    themeColorBackground?: string;
    className?: string;
}

function apeText(n: number): string {
    return `${(n || 0).toLocaleString([], {
        maximumFractionDigits: 3,
        minimumFractionDigits: 0,
    })} APE`;
}

const MyGameWindowStatsStrip: React.FC<MyGameWindowStatsStripProps> = ({
    currentBetApe,
    biggestCatchApe,
    highestMultiplier,
    castsProgress = null,
    themeColorBackground = "#0d9488",
    className,
}) => {
    return (
        <div
            className={cn(
                statsMedieval.className,
                "cast-stats-strip-medieval pointer-events-none absolute inset-x-0 top-0 z-[14] px-2 py-1.5 backdrop-blur-sm min-[480px]:px-3 min-[480px]:py-2",
                className,
            )}
            style={
                {
                    ["--cast-stats-theme-accent" as string]:
                        themeColorBackground,
                } as React.CSSProperties
            }
            aria-label="Session stats"
        >
            <div className="mx-auto flex w-full min-w-0 max-w-full flex-nowrap items-center gap-x-1 min-[400px]:gap-x-2 sm:gap-x-3 md:gap-x-4">
                <div className="cast-stats-strip-medieval__col tabular-nums">
                    <span className="cast-stats-strip-medieval__label">
                        Bet
                        {castsProgress != null
                            ? ` · ${castsProgress.current}/${castsProgress.total}`
                            : ""}
                    </span>
                    <span className="cast-stats-strip-medieval__value truncate">
                        {apeText(currentBetApe)}
                    </span>
                </div>
                <span
                    className="cast-stats-strip-medieval__rule shrink-0 self-center"
                    aria-hidden
                />
                <div className="cast-stats-strip-medieval__col tabular-nums">
                    <span className="cast-stats-strip-medieval__label">
                        Best catch
                    </span>
                    <span className="cast-stats-strip-medieval__value truncate">
                        {biggestCatchApe > 0 ? apeText(biggestCatchApe) : "—"}
                    </span>
                </div>
                <span
                    className="cast-stats-strip-medieval__rule shrink-0 self-center"
                    aria-hidden
                />
                <div className="cast-stats-strip-medieval__col tabular-nums">
                    <span className="cast-stats-strip-medieval__label">
                        Top Multiplier
                    </span>
                    <span className="cast-stats-strip-medieval__value truncate">
                        {highestMultiplier > 0
                            ? formatRevealMultiplierLabel(highestMultiplier)
                            : "—"}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default MyGameWindowStatsStrip;
