"use client";

import React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import useSound from "use-sound";
import { Game } from "@/lib/games";
import { KodaEntry } from "./kodaArt";
import { TileName } from "./RunwayWalk";

interface StepResult {
    slots: TileName[];
    chosenIndex: number;
    safe: boolean;
    tile: TileName;
}

interface RunwayWalkWindowProps {
    game: Game;
    koda: KodaEntry;
    currentStep: number;
    totalMultiplier: number;
    bonusMultiplier: number;
    streakCount: number;
    isAdvancing: boolean;
    busted: boolean;
    cashedOut: boolean;
    gameCompleted: boolean;
    betAmount: number;
    payoutAmount: number;
    stepHistory: StepResult[];
    currentSlots: TileName[] | null;
    currentView: 0 | 1 | 2;
    inReplayMode: boolean;
    onPickSlot: (index: number) => void;
}

const TILE_IMAGE: Record<TileName, string> = {
    rose: "/submissions/runway-walk/tiles/tile-rose.png",
    spotlight: "/submissions/runway-walk/tiles/tile-spotlight.png",
    camera: "/submissions/runway-walk/tiles/tile-camera.png",
    applause: "/submissions/runway-walk/tiles/tile-applause.png",
    diamond: "/submissions/runway-walk/tiles/tile-diamond.png",
    ribbon: "/submissions/runway-walk/tiles/tile-ribbon.png",
    crown: "/submissions/runway-walk/tiles/tile-crown.png",
    "missed-step": "/submissions/runway-walk/tiles/tile-missed-step.png",
};

// Reusing the same 5 Diamond Drop sound effects rather than 7 individual
// tile sounds — mapped to the game's actual moments, same audio identity
// as the rest of the site.
const CLINK_SRC = "/submissions/runway-walk/sfx/diamond-drop-clink.mp3";       // regular safe tile land
const JACKPOT_SRC = "/submissions/runway-walk/sfx/diamond-drop-jackpot.mp3";   // premium tile land (diamond, crown)
const STINGER_SRC = "/submissions/runway-walk/sfx/gs-drums-stinger.mp3";       // streak bonus triggers
const ALL_RELEASE_SRC = "/submissions/runway-walk/sfx/all-coins-release.mp3";  // cash out
const SINGLE_RELEASE_SRC = "/submissions/runway-walk/sfx/single-coin-release.mp3"; // starting the walk

const PREMIUM_TILES: TileName[] = ["diamond", "crown"];

function poseForState(busted: boolean, cashedOut: boolean, isAdvancing: boolean, currentStep: number): string {
    if (busted) return "/submissions/runway-walk/poses/koda-stumble.png";
    if (cashedOut) return "/submissions/runway-walk/poses/koda-winner.png";
    if (isAdvancing) return "/submissions/runway-walk/poses/koda-walking.png";
    if (currentStep === 0) return "/submissions/runway-walk/poses/koda-idle.png";
    return "/submissions/runway-walk/poses/koda-finalist.png";
}

/** Persistent ambient mystical pink fog — soft blurred blobs that slowly
 * drift and pulse behind the Koda, matching the dreamy painted art style.
 * Not tied to any game event; just atmosphere, always present. */
const FOG_BLOBS = [
    { size: 220, left: "20%", top: "35%", color: "rgba(236,72,153,0.35)", duration: 9, delay: 0 },
    { size: 180, left: "65%", top: "45%", color: "rgba(217,70,239,0.28)", duration: 11, delay: 1.5 },
    { size: 260, left: "45%", top: "55%", color: "rgba(244,114,182,0.22)", duration: 13, delay: 0.7 },
    { size: 150, left: "30%", top: "60%", color: "rgba(232,121,249,0.3)", duration: 8, delay: 2.2 },
    { size: 200, left: "75%", top: "30%", color: "rgba(236,72,153,0.2)", duration: 10, delay: 3 },
];

const MysticalFog: React.FC = () => (
    <div className="absolute inset-0 z-[5] overflow-hidden pointer-events-none" style={{ filter: "blur(24px)" }}>
        {FOG_BLOBS.map((blob, i) => (
            <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                    width: blob.size,
                    height: blob.size,
                    left: blob.left,
                    top: blob.top,
                    background: blob.color,
                }}
                animate={{
                    x: [0, 20, -15, 0],
                    y: [0, -15, 10, 0],
                    opacity: [0.6, 1, 0.7, 0.6],
                }}
                transition={{
                    duration: blob.duration,
                    delay: blob.delay,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
        ))}
    </div>
);

const RunwayWalkWindow: React.FC<RunwayWalkWindowProps> = ({
    currentStep,
    totalMultiplier,
    bonusMultiplier,
    streakCount,
    isAdvancing,
    busted,
    cashedOut,
    gameCompleted,
    betAmount,
    payoutAmount,
    stepHistory,
    currentSlots,
    currentView,
    inReplayMode,
    onPickSlot,
}) => {
    const muteSfx = false;
    const sfxVolume = 0.5;

    const [stepSFX] = useSound(CLINK_SRC, { volume: sfxVolume, soundEnabled: !muteSfx, interrupt: true });
    const [jackpotSFX] = useSound(JACKPOT_SRC, { volume: sfxVolume, soundEnabled: !muteSfx, interrupt: true });
    const [bustSFX] = useSound("/submissions/runway-walk/sfx/crowd-gasp.mp3", { volume: sfxVolume, soundEnabled: !muteSfx, interrupt: true });
    const [cashOutSFX] = useSound(ALL_RELEASE_SRC, { volume: sfxVolume, soundEnabled: !muteSfx, interrupt: true });
    const [varietyBonusSFX] = useSound(ALL_RELEASE_SRC, { volume: sfxVolume, soundEnabled: !muteSfx, interrupt: true });
    const [tilesAppearSFX] = useSound(SINGLE_RELEASE_SRC, { volume: sfxVolume, soundEnabled: !muteSfx, interrupt: true });

    // Per-step sound depends on which bonus (if any) just applied:
    //   bonus >= 3x  -> jackpot (the 3+/4+/5+ same-tile streak bonus)
    //   bonus == 1.1x -> the variety bonus (3 different tiles in a row)
    //   otherwise     -> the regular clink
    const playStepSFX = React.useCallback((bonus: number) => {
        if (bonus >= 3) jackpotSFX();
        else if (Math.abs(bonus - 1.1) < 0.001) varietyBonusSFX();
        else stepSFX();
    }, [jackpotSFX, varietyBonusSFX, stepSFX]);

    // "Tiles appear" — fires every time a fresh 5-tile board is presented,
    // including the very first one when the walk starts.
    const prevSlotsRef = React.useRef<TileName[] | null>(null);
    React.useEffect(() => {
        if (currentSlots && currentSlots !== prevSlotsRef.current) {
            tilesAppearSFX();
        }
        prevSlotsRef.current = currentSlots;
    }, [currentSlots, tilesAppearSFX]);

    const prevStepRef = React.useRef(currentStep);
    React.useEffect(() => {
        if (currentStep > prevStepRef.current && !busted) {
            playStepSFX(bonusMultiplier);
        }
        prevStepRef.current = currentStep;
    }, [currentStep, busted, bonusMultiplier, playStepSFX]);

    React.useEffect(() => {
        if (gameCompleted) {
            if (busted) bustSFX();
            else if (cashedOut) cashOutSFX();
        }
    }, [gameCompleted, busted, cashedOut, bustSFX, cashOutSFX]);

    const pose = poseForState(busted, cashedOut, isAdvancing, currentStep);
    const canPick = currentView === 1 && !busted && !cashedOut && !isAdvancing && !inReplayMode;

    return (
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-between text-white bg-gradient-to-b from-[#1a1030]/70 via-[#120a24]/60 to-[#0a0614]/80 overflow-hidden py-4 px-6">
            <MysticalFog />

            <div className="text-center z-20">
                <p className="text-xs tracking-[0.2em] uppercase text-amber-300/80">Koda Pageant</p>
                <p className="text-lg sm:text-xl font-bold text-amber-100">Runway Walk</p>
            </div>

            {/* Trail of previously PICKED tiles, in order — the actual
                runway "walked so far." */}
            <div className="w-full max-w-md flex items-center justify-center gap-1 flex-wrap min-h-[32px]">
                <AnimatePresence>
                    {stepHistory.map((step, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative w-8 h-8 sm:w-9 sm:h-9 rounded overflow-hidden border"
                            style={{ borderColor: step.safe ? "#38bdf8" : "#ef4444" }}
                        >
                            <Image src={TILE_IMAGE[step.tile]} alt={step.tile} fill unoptimized className="object-cover" />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* The Koda */}
            <motion.div
                className="relative w-40 h-40 sm:w-48 sm:h-48 z-10"
                animate={isAdvancing ? { y: [0, -6, 0] } : { y: 0, scale: cashedOut ? [1, 1.08, 1] : 1 }}
                transition={isAdvancing ? { duration: 0.45, repeat: Infinity } : { duration: 0.4 }}
            >
                <Image src={pose} alt="Koda" fill unoptimized className="object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)]" />
            </motion.div>

            {/* The 5-tile board — click one to take the next step. Hidden
                until revealed; on bust, all 5 flip so the player can see
                where the missed-step tile actually was. */}
            {currentView === 1 && currentSlots && (
                <div className="flex gap-2 z-20">
                    {currentSlots.map((tile, i) => {
                        const isLastPicked = gameCompleted && stepHistory.length > 0 && stepHistory[stepHistory.length - 1].chosenIndex === i;
                        const revealed = gameCompleted || (isAdvancing && isLastPicked);
                        return (
                            <motion.button
                                key={i}
                                disabled={!canPick}
                                onClick={() => canPick && onPickSlot(i)}
                                whileHover={canPick ? { scale: 1.06 } : {}}
                                whileTap={canPick ? { scale: 0.95 } : {}}
                                className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border-2 bg-[#1a1030]"
                                style={{
                                    borderColor: revealed
                                        ? (tile === "missed-step" ? "#ef4444" : "#38bdf8")
                                        : "#4c3a7a",
                                    cursor: canPick ? "pointer" : "default",
                                }}
                            >
                                {revealed ? (
                                    <Image src={TILE_IMAGE[tile]} alt={tile} fill unoptimized className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-amber-200/60 text-lg font-bold">?</div>
                                )}
                            </motion.button>
                        );
                    })}
                </div>
            )}

            <div className="flex flex-col items-center gap-1 z-20">
                <div className="text-3xl sm:text-4xl font-black text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]">
                    {totalMultiplier.toFixed(2)}x
                </div>
                {bonusMultiplier > 1 && (
                    <div className="text-xs font-bold text-emerald-300">🔥 {bonusMultiplier.toFixed(2)}x bonus</div>
                )}
                <div className="text-xs text-white/60">Step {currentStep}</div>
            </div>

            <AnimatePresence>
                {gameCompleted && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-center z-20"
                    >
                        {busted ? (
                            <p className="text-red-300 font-bold text-lg">Stumbled! Lost {betAmount.toFixed(2)}</p>
                        ) : (
                            <p className="text-emerald-300 font-bold text-lg">Cashed out! +{payoutAmount.toFixed(2)}</p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RunwayWalkWindow;