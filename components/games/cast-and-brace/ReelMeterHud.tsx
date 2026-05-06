"use client";

import React from "react";
import "./my-game.styles.css";

export interface ReelMeterHudProps {
    progress: number;
    /** Line is retracting after a full meter — show completion flair; taps ignored. */
    reelRetracting?: boolean;
    onReelTap: () => void;
}

/**
 * Shown under the game frame during the reel minigame — tappable so spam-clicks
 * don’t have to hit the canvas.
 */
const ReelMeterHud: React.FC<ReelMeterHudProps> = ({
    progress,
    reelRetracting = false,
    onReelTap,
}) => {
    const pct = Math.round(Math.min(100, Math.max(0, progress)));

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (reelRetracting) {
            return;
        }
        if (e.button !== 0) {
            return;
        }
        onReelTap();
    };

    const handleReelButtonPointerDown = (
        e: React.PointerEvent<HTMLButtonElement>
    ) => {
        e.stopPropagation();
        if (reelRetracting) {
            return;
        }
        if (e.button !== 0) {
            return;
        }
        onReelTap();
    };

    return (
        <div
            className={`emerald-reel-meter-host w-full rounded-xl border border-[#2A3640]/90 bg-[#151C21]/95 px-3 py-3 shadow-md min-[480px]:px-4 min-[480px]:py-3.5${reelRetracting ? " emerald-reel-meter-host-retracting" : ""}`}
        >
            <span className="emerald-sr-only" role="status">
                Reel minigame: use the Click to Reel button, tap this bar or the
                game water, or press Space, to pull the line.
                {reelRetracting ? " Line secured — reeling in." : ""}
            </span>
            <button
                type="button"
                disabled={reelRetracting}
                onPointerDown={handleReelButtonPointerDown}
                className="mb-3 w-full rounded-sm border border-red-900/80 bg-red-600 px-3 py-2.5 text-center font-roboto text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-sm transition-colors hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 disabled:pointer-events-none disabled:opacity-60 min-[480px]:py-3 min-[480px]:text-xs"
            >
                CLICK TO REEL
            </button>
            <div onPointerDown={handlePointerDown}>
                <div className="mb-1.5 flex items-center justify-between gap-2 font-roboto text-[11px] font-semibold uppercase tracking-wider text-teal-100/90 min-[480px]:text-xs">
                    <span>Reel progress</span>
                    <span
                        className={`tabular-nums transition-colors duration-300 ${reelRetracting ? "emerald-reel-meter-pct-complete text-white" : "text-white"}`}
                    >
                        {reelRetracting ? "100%" : `${pct}%`}
                    </span>
                </div>
                <div
                    className={`emerald-reel-meter-track relative h-3 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/15 min-[480px]:h-3.5${reelRetracting ? " emerald-reel-meter-track-complete" : ""}`}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Reel progress"
                >
                    <div
                        className={`emerald-reel-meter-fill-spectrum h-full rounded-full transition-[width] duration-75 ease-out${reelRetracting ? " emerald-reel-meter-fill-complete-burst" : ""}`}
                        style={{ width: `${pct}%` }}
                    />
                    {reelRetracting && (
                        <span
                            className="emerald-reel-meter-complete-shimmer pointer-events-none absolute inset-0 rounded-full"
                            aria-hidden
                        />
                    )}
                </div>
                <p
                    className={`mt-2 text-center font-roboto text-[10px] font-medium min-[480px]:text-[11px] ${reelRetracting ? "text-emerald-300/95" : "text-[#91989C]"}`}
                >
                    {reelRetracting
                        ? "Nice — you’ve got it on the line!"
                        : "Tap / click here or the game — the fish is fighting back!"}
                </p>
            </div>
        </div>
    );
};

export default ReelMeterHud;
