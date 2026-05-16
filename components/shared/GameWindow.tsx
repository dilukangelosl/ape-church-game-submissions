"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Howl } from "howler";
import { Volume2, VolumeX, AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import GameResultsModal from "./GameResultsModal";
import { Game } from "@/lib/games";

type GameWindowProps = {
    game: Game;
    isLoading: boolean;
    isGameFinished: boolean;
    customHeightMobile?: string;
    children: React.ReactNode;

    betAmount: number | null;
    payout: number | null;
    inReplayMode: boolean;
    isUserOriginalPlayer: boolean;
    showPNL: boolean;
    isGamePaused?: boolean;

    onReset: () => void;
    onPlayAgain?: () => void;
    playAgainText?: string;
    onRewatch?: () => void;
    currentGameId: bigint;

    disableBuiltInSong?: boolean;
    /** When set, music mute is controlled by the parent (e.g. splash overlay toggles). */
    musicMuted?: boolean;
    onMusicMutedChange?: (muted: boolean) => void;
    /** When set, SFX mute is controlled by the parent. */
    sfxMuted?: boolean;
    onSfxMutedChange?: (muted: boolean) => void;
    musicVolumeMultiplier?: number;

    resultModalDelayMs?: number;
};

const GameWindow: React.FC<GameWindowProps> = ({
    game,
    isLoading,
    isGameFinished,
    customHeightMobile,
    children,

    betAmount,
    payout,
    inReplayMode = true,
    isUserOriginalPlayer = false,
    showPNL = false,
    isGamePaused = false,

    onReset,
    onPlayAgain,
    playAgainText = "Play Again",
    onRewatch,
    currentGameId,

    disableBuiltInSong = false,
    musicMuted: controlledMusicMuted,
    onMusicMutedChange,
    sfxMuted: controlledSfxMuted,
    onSfxMutedChange,
    musicVolumeMultiplier = 1,

    resultModalDelayMs = 0,
}) => {
    const audioRef = useRef<Howl | null>(null);
    const musicIsControlled = typeof controlledMusicMuted === "boolean";
    const sfxIsControlled = typeof controlledSfxMuted === "boolean";
    const [internalMuteMusic, setInternalMuteMusic] = useState(false);
    const [internalMuteSfx, setInternalMuteSfx] = useState(false);
    const muteMusic = musicIsControlled ? controlledMusicMuted! : internalMuteMusic;
    const muteSfx = sfxIsControlled ? controlledSfxMuted! : internalMuteSfx;
    const [showResults, setShowResults] = useState(false);

    const hasBuiltInSong = !disableBuiltInSong && Boolean(game.song);

    useEffect(() => {
        if (!hasBuiltInSong) return;

        const sound = new Howl({
            src: [game.song!],
            loop: true,
            volume: 0.5 * musicVolumeMultiplier,
            mute: muteMusic,
        });

        audioRef.current = sound;

        if (!muteMusic) {
            sound.play();
        }

        return () => {
            sound.unload();
            audioRef.current = null;
        };
    }, [game.song, hasBuiltInSong]);

    useEffect(() => {
        if (!hasBuiltInSong) return;
        const audio = audioRef.current;
        if (!audio) return;

        audio.mute(muteMusic);
        audio.volume(0.5 * musicVolumeMultiplier);
        if (!muteMusic && !audio.playing()) {
            audio.play();
        }
    }, [muteMusic, hasBuiltInSong, musicVolumeMultiplier]);

    useEffect(() => {
        if (musicIsControlled) return;
        onMusicMutedChange?.(muteMusic);
    }, [musicIsControlled, muteMusic, onMusicMutedChange]);

    useEffect(() => {
        if (sfxIsControlled) return;
        onSfxMutedChange?.(muteSfx);
    }, [sfxIsControlled, muteSfx, onSfxMutedChange]);

    useEffect(() => {
        if (isGameFinished && resultModalDelayMs > 0) {
            const id = window.setTimeout(() => setShowResults(true), resultModalDelayMs);
            return () => window.clearTimeout(id);
        }
        setShowResults(isGameFinished);
    }, [isGameFinished, resultModalDelayMs]);

    useEffect(() => {
        if (!isGameFinished) {
            setShowResults(false);
        }
    }, [isGameFinished]);

    return (
        <div
            className={cn(
                "lg:basis-2/3 w-full rounded-[12px] border-[2.25px] sm:border-[3.75px] lg:border-[4.68px] border-[#2A3640] relative overflow-hidden",
            )}
        >

            {isGamePaused && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-[#12181C]/75 backdrop-blur-xs rounded-[8px] font-roboto p-4">
                    <h2 className="font-semibold text-xl sm:text-3xl text-center">
                        Game Paused
                    </h2>
                    <p className="text-sm text-muted-foreground text-center max-w-sm sm:max-w-md mx-auto">
                        The game contract is currently paused for maintenance or updates.
                        Please check back later.
                    </p>
                </div>
            )}

            {isLoading && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-[#12181C]/75 text-white backdrop-blur-xs rounded-[8px] font-roboto">
                    Loading...
                </div>
            )}

            {showResults &&
                betAmount !== null &&
                payout !== null &&
                onReset &&
                onPlayAgain && (
                    <GameResultsModal
                        key={currentGameId.toString()}
                        isOpen={showResults}
                        payout={payout}
                        betAmount={betAmount}
                        usdMode={false}
                        apePrice={1}
                        isLoading={isLoading}
                        gameTitle={game.title}
                        onReset={onReset}
                        onPlayAgain={onPlayAgain}
                        playAgainButtonText={playAgainText}
                        onRewatch={onRewatch}
                        showPlayAgainOption={!inReplayMode && isUserOriginalPlayer}
                        showRewatchOption={inReplayMode || isUserOriginalPlayer}
                        showPNL={showPNL}
                    />
                )}

            {game.animatedBackground && game.animatedBackground !== "" ? (
                <video
                    src={game.animatedBackground}
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls={false}
                    disablePictureInPicture={true}
                    className="w-full h-full object-cover rounded-[8px] pointer-events-none"
                />
            ) : (
                <Image
                    src={game.gameBackground}
                    alt="Game Background"
                    width={719}
                    height={719}
                    className="w-full h-full object-cover rounded-[8px] opacity-75"
                    style={{
                        minHeight: customHeightMobile ? customHeightMobile : "100%",
                    }}
                    priority
                />
            )}

            {children}

            <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="p-2 bg-[#151C21]/40 rounded-[8px] text-[#91989C]"
                    onClick={() => {
                        const next = !muteSfx;
                        if (sfxIsControlled) onSfxMutedChange?.(next);
                        else setInternalMuteSfx(next);
                    }}
                    title={muteSfx ? "Unmute SFX" : "Mute SFX"}
                >
                    {muteSfx ? (
                        <AudioLines className="w-5 h-5 opacity-40" />
                    ) : (
                        <AudioLines className="w-5 h-5" />
                    )}
                </Button>

                {hasBuiltInSong ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="p-2 bg-[#151C21]/40 rounded-[8px] text-[#91989C]"
                        onClick={() => {
                            const next = !muteMusic;
                            if (musicIsControlled) onMusicMutedChange?.(next);
                            else setInternalMuteMusic(next);
                        }}
                        title={muteMusic ? "Unmute music" : "Mute music"}
                    >
                        {muteMusic ? (
                            <VolumeX className="w-6 h-6" />
                        ) : (
                            <Volume2 className="w-6 h-6" />
                        )}
                    </Button>
                ) : null}
            </div>
        </div>
    );
};

export default GameWindow;
