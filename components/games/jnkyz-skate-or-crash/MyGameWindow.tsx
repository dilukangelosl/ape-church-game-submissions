"use client";

import React from "react";
import { Game } from "@/lib/games";

interface MyGameWindowProps {
    game: Game;
    multiplier: number;
    crashAt: number | null;
    isGameOngoing: boolean;
    isCrashed: boolean;
    elapsedMs: number;
    didCashout: boolean;
    sfxMuted: boolean;
}

const MyGameWindow: React.FC<MyGameWindowProps> = ({
    game,
    multiplier,
    crashAt,
    isGameOngoing,
    isCrashed,
    elapsedMs,
    didCashout,
    sfxMuted: _sfxMuted,
}) => {
    const crashText = didCashout ? "Cashed Out" : "Wade Crashed";
    const progress = Math.min(Math.max(multiplier, 1), 10);
    const lanePercent = isCrashed ? 100 : ((progress - 1) / 9) * 100;

    return (
        <div className="absolute inset-0 z-0 flex items-center justify-center text-white">
            <div className="absolute inset-0 rounded-md overflow-hidden border border-white/15 bg-[#1a1a1a]">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a1a28] via-[#0f2233] to-[#05080d]" />
                <div
                    className="absolute left-0 right-0 h-[2px] bg-white/30"
                    style={{ bottom: "28%" }}
                />
                <div className="absolute left-0 right-0 bottom-[28%] h-[32%] bg-gradient-to-t from-[#132839] to-transparent" />
                <div
                    className="absolute bottom-[26%] h-5 w-10 rounded-full bg-[#7FFFD4] shadow-[0_0_20px_rgba(127,255,212,0.85)] transition-all duration-150"
                    style={{ left: `calc(${lanePercent}% - 1.25rem)` }}
                />

                <div className="absolute left-3 top-3 rounded border border-white/20 bg-black/40 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-[#C6F6FF]">
                    {game.title}
                </div>
                <div className="absolute right-3 top-3 rounded border border-white/20 bg-black/40 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#D2FDF1]">
                    {isGameOngoing ? `${multiplier.toFixed(2)}x` : crashAt ? `Crash ${crashAt.toFixed(2)}x` : "Ready"}
                </div>
                {isCrashed ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="rounded-2xl border border-white/25 bg-black/35 px-8 py-6 text-center backdrop-blur-[1px]">
                            <img
                                src="/submissions/jnkyz-skate-or-crash/ui/jnkyz-art-white-cutout-v3.png"
                                alt="JNKYZ Crashed"
                                className="mx-auto h-24 w-auto bg-transparent object-contain opacity-100"
                                style={{
                                    transform: "scale(1.18) rotate(-5deg)",
                                    filter: "drop-shadow(0 0 20px rgba(255,255,255,0.25))",
                                }}
                            />
                            <div className="mt-3 text-center text-xl font-black uppercase tracking-[0.22em] text-[#FFD7D7]">
                                {crashText}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default MyGameWindow;
