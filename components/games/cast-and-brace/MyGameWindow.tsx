"use client";

import React from "react";
import EmeraldDepthsScene from "./EmeraldDepthsScene";
import type { FishPlatformResult, FishingPhase } from "./myGameConfig";

interface MyGameWindowProps {
    fishingPhase: FishingPhase;
    castAnimKey: number;
    sceneLayoutKey: number;
    fishSchoolSeed: number;
    onCastComplete: () => void;
    onCastWhoosh?: () => void;
    onHookWaterEntry?: () => void;
    onReelMeterTap: () => void;
    onReelComplete: () => void;
    reelPullStarted: boolean;
    revealPayout: number | null;
    revealBet: number;
    platformResult: FishPlatformResult | null;
    /** KoKo jackpot: run after catch-reveal MP4 finishes so results modal waits for video. */
    onKokoCatchRevealVideoEnded?: () => void;
}

const MyGameWindow: React.FC<MyGameWindowProps> = ({
    fishingPhase,
    castAnimKey,
    sceneLayoutKey,
    fishSchoolSeed,
    onCastComplete,
    onCastWhoosh,
    onHookWaterEntry,
    onReelMeterTap,
    onReelComplete,
    reelPullStarted,
    revealPayout,
    revealBet,
    platformResult,
    onKokoCatchRevealVideoEnded,
}) => {
    return (
        <div className="absolute inset-0 z-0 min-h-0 min-w-0 text-white">
            <EmeraldDepthsScene
                fishingPhase={fishingPhase}
                castAnimKey={castAnimKey}
                sceneLayoutKey={sceneLayoutKey}
                fishSchoolSeed={fishSchoolSeed}
                onCastComplete={onCastComplete}
                onCastWhoosh={onCastWhoosh}
                onHookWaterEntry={onHookWaterEntry}
                onReelMeterTap={onReelMeterTap}
                onReelComplete={onReelComplete}
                reelPullStarted={reelPullStarted}
                revealPayout={revealPayout}
                revealBet={revealBet}
                platformResult={platformResult}
                onKokoCatchRevealVideoEnded={onKokoCatchRevealVideoEnded}
            />
        </div>
    );
};

export default MyGameWindow;
