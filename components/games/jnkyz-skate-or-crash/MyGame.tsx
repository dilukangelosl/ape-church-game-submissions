"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GameWindow from "@/components/shared/GameWindow";
import { Game, randomBytes } from "@/lib/games";
import { bytesToHex } from "viem";
import { toast } from "sonner";
import { Howl } from "howler";
import { Button } from "@/components/ui/button";
import { AudioLines, Volume2, VolumeX } from "lucide-react";
import MyGameSetupCard from "./MyGameSetupCard";
import MyGameWindow from "./MyGameWindow";

interface MyGameComponentProps {
    game: Game;
}

interface LastRoundSnapshot {
    betAmount: number;
    autoCashoutAt: number | null;
    crashAt: number;
    didCashout: boolean;
    cashoutMultiplier: number | null;
}

const MIN_BET = 1;
const BASE_HOUSE_EDGE = 0.03;
const MIN_HOUSE_EDGE = 0.01;
const MAX_HOUSE_EDGE = 0.1;
const CRASH_RESOLVE_DELAY_MS = 1800;
const RESULT_SFX_DUCK_VOLUME = 0.72;
const RESULT_SFX_RESTORE_DELAY_MS = 120;
const WIN_SFX_VOLUME = 0.85;
const LOSE_SFX_VOLUME = 0.6;
const RESULT_SFX_CUT_FADE_MS = 120;

const generateGameId = (): bigint =>
    BigInt(bytesToHex(new Uint8Array(randomBytes(32))));

const roundToTwoDecimals = (value: number): number =>
    Math.round(value * 100) / 100;

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const MyGameComponent: React.FC<MyGameComponentProps> = ({ game }) => {
    const router = useRouter();
    const [replayIdString, setReplayIdString] = useState<string | null>(null);
    const inReplayMode = replayIdString !== null;

    const [walletBalance, setWalletBalance] = useState(100000);

    const [currentView, setCurrentView] = useState<0 | 1 | 2>(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isGameOngoing, setIsGameOngoing] = useState(false);
    const [isCrashed, setIsCrashed] = useState(false);

    const [betAmount, setBetAmount] = useState(5);
    const [autoCashoutAt, setAutoCashoutAt] = useState<number | null>(2);
    const [multiplier, setMultiplier] = useState(1);
    const [crashAt, setCrashAt] = useState<number | null>(null);
    const [payout, setPayout] = useState<number | null>(null);
    const [didCashout, setDidCashout] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [splashDismissed, setSplashDismissed] = useState(false);
    const [sfxMuted, setSfxMuted] = useState(false);
    const [musicMuted, setMusicMuted] = useState(false);
    const [musicVolumeMultiplier, setMusicVolumeMultiplier] = useState(1);

    const [currentGameId, setCurrentGameId] = useState<bigint>(
        replayIdString ? BigInt(replayIdString) : generateGameId(),
    );
    const [lastRound, setLastRound] = useState<LastRoundSnapshot | null>(null);

    const sessionStatsRef = useRef({ wagered: 0, returned: 0 });
    const rafIdRef = useRef<number | null>(null);
    const finalizeTimeoutRef = useRef<number | null>(null);
    const winSfxRef = useRef<Howl | null>(null);
    const loseSfxRef = useRef<Howl | null>(null);
    const restoreMusicTimeoutRef = useRef<number | null>(null);
    const roundStartMsRef = useRef<number>(0);
    const roundEndedRef = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const readReplayId = (): void => {
            const params = new URLSearchParams(window.location.search);
            setReplayIdString(params.get("id"));
        };
        readReplayId();
        window.addEventListener("popstate", readReplayId);
        return () => {
            window.removeEventListener("popstate", readReplayId);
        };
    }, []);

    useEffect(() => {
        if (!replayIdString || replayIdString.length <= 2) {
            return;
        }
        setCurrentGameId(BigInt(replayIdString));
    }, [replayIdString]);

    useEffect(() => {
        winSfxRef.current = new Howl({
            src: ["/submissions/jnkyz-skate-or-crash/audio/win.ogg"],
            loop: false,
            volume: WIN_SFX_VOLUME,
            mute: sfxMuted,
        });
        loseSfxRef.current = new Howl({
            src: ["/submissions/jnkyz-skate-or-crash/audio/lose.ogg"],
            loop: false,
            volume: LOSE_SFX_VOLUME,
            mute: sfxMuted,
        });
        return () => {
            winSfxRef.current?.unload();
            loseSfxRef.current?.unload();
            winSfxRef.current = null;
            loseSfxRef.current = null;
        };
    }, []);

    useEffect(() => {
        winSfxRef.current?.mute(sfxMuted);
        loseSfxRef.current?.mute(sfxMuted);
    }, [sfxMuted]);

    const stopRoundLoop = (): void => {
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        if (finalizeTimeoutRef.current !== null) {
            window.clearTimeout(finalizeTimeoutRef.current);
            finalizeTimeoutRef.current = null;
        }
    };

    const playResultSfx = (didWin: boolean): void => {
        if (sfxMuted) {
            return;
        }
        if (restoreMusicTimeoutRef.current !== null) {
            window.clearTimeout(restoreMusicTimeoutRef.current);
            restoreMusicTimeoutRef.current = null;
        }
        setMusicVolumeMultiplier(RESULT_SFX_DUCK_VOLUME);
        winSfxRef.current?.off("end");
        loseSfxRef.current?.off("end");
        const sfx = didWin ? winSfxRef.current : loseSfxRef.current;
        if (!sfx) {
            setMusicVolumeMultiplier(1);
            return;
        }
        sfx.stop();
        const playId = sfx.play();
        sfx.once("end", () => {
            restoreMusicTimeoutRef.current = window.setTimeout(() => {
                setMusicVolumeMultiplier(1);
                restoreMusicTimeoutRef.current = null;
            }, RESULT_SFX_RESTORE_DELAY_MS);
        }, playId);
    };

    const stopResultSfxForNewRound = (): void => {
        if (restoreMusicTimeoutRef.current !== null) {
            window.clearTimeout(restoreMusicTimeoutRef.current);
            restoreMusicTimeoutRef.current = null;
        }
        setMusicVolumeMultiplier(1);

        if (winSfxRef.current?.playing()) {
            winSfxRef.current.fade(winSfxRef.current.volume(), 0, RESULT_SFX_CUT_FADE_MS);
            window.setTimeout(() => {
                winSfxRef.current?.stop();
                winSfxRef.current?.volume(WIN_SFX_VOLUME);
            }, RESULT_SFX_CUT_FADE_MS + 20);
        }
        if (loseSfxRef.current?.playing()) {
            loseSfxRef.current.fade(loseSfxRef.current.volume(), 0, RESULT_SFX_CUT_FADE_MS);
            window.setTimeout(() => {
                loseSfxRef.current?.stop();
                loseSfxRef.current?.volume(LOSE_SFX_VOLUME);
            }, RESULT_SFX_CUT_FADE_MS + 20);
        }
    };

    const computeDynamicHouseEdge = (): number => {
        const stats = sessionStatsRef.current;
        if (stats.wagered <= 0) {
            return BASE_HOUSE_EDGE;
        }
        const realizedRtp = stats.returned / stats.wagered;
        const adjustment = clamp((0.97 - realizedRtp) * 0.3, -0.02, 0.02);
        return clamp(BASE_HOUSE_EDGE + adjustment, MIN_HOUSE_EDGE, MAX_HOUSE_EDGE);
    };

    const generateCrashPoint = (houseEdge: number): number => {
        const random = Math.random();
        const raw = (1 - houseEdge) / Math.max(1e-6, 1 - random);
        return clamp(roundToTwoDecimals(raw), 1.01, 100);
    };

    const finalizeRound = (
        roundCrashAt: number,
        didWin: boolean,
        resolvedMultiplier: number | null,
        delayMs = 0,
    ): void => {
        if (roundEndedRef.current) {
            return;
        }

        roundEndedRef.current = true;
        stopRoundLoop();
        setIsGameOngoing(false);

        const completeFinalize = (): void => {
            setCurrentView(2);
            const resolvedPayout = didWin && resolvedMultiplier !== null
                ? roundToTwoDecimals(betAmount * resolvedMultiplier)
                : 0;
            if (resolvedPayout > 0) {
                setWalletBalance((prev) => roundToTwoDecimals(prev + resolvedPayout));
            }

            sessionStatsRef.current = {
                wagered: sessionStatsRef.current.wagered + betAmount,
                returned: sessionStatsRef.current.returned + resolvedPayout,
            };

            setDidCashout(didWin);
            setPayout(resolvedPayout);
            setLastRound({
                betAmount,
                autoCashoutAt,
                crashAt: roundCrashAt,
                didCashout: didWin,
                cashoutMultiplier: resolvedMultiplier,
            });
        };

        if (delayMs > 0) {
            finalizeTimeoutRef.current = window.setTimeout(() => {
                finalizeTimeoutRef.current = null;
                completeFinalize();
            }, delayMs);
            return;
        }

        completeFinalize();
    };

    const startRoundLoop = (roundCrashAt: number): void => {
        const step = (now: number) => {
            if (roundEndedRef.current) {
                return;
            }

            const elapsed = now - roundStartMsRef.current;
            const seconds = elapsed / 1000;
            const nextMultiplier = roundToTwoDecimals(
                1 + 0.42 * seconds + 0.18 * seconds * seconds,
            );

            setElapsedMs(Math.floor(elapsed));
            setMultiplier(nextMultiplier);

            if (nextMultiplier >= roundCrashAt) {
                setIsCrashed(true);
                setMultiplier(roundCrashAt);
                playResultSfx(false);
                finalizeRound(roundCrashAt, false, null, CRASH_RESOLVE_DELAY_MS);
                return;
            }
            if (
                autoCashoutAt !== null &&
                nextMultiplier >= autoCashoutAt &&
                autoCashoutAt < roundCrashAt
            ) {
                playResultSfx(true);
                finalizeRound(roundCrashAt, true, autoCashoutAt);
                return;
            }

            rafIdRef.current = requestAnimationFrame(step);
        };

        rafIdRef.current = requestAnimationFrame(step);
    };

    const playGame = async (): Promise<void> => {
        stopResultSfxForNewRound();
        if (betAmount < MIN_BET) {
            toast.error(`Bet must be at least ${MIN_BET} APE.`);
            return;
        }
        if (betAmount > walletBalance) {
            toast.error("Insufficient balance.");
            return;
        }

        setIsLoading(true);
        roundEndedRef.current = false;
        setCurrentView(1);
        setIsGameOngoing(true);
        setIsCrashed(false);
        setDidCashout(false);
        setPayout(null);
        setMultiplier(1);
        setElapsedMs(0);
        setWalletBalance((prev) => roundToTwoDecimals(prev - betAmount));

        console.log("Mock transaction submitted for crash game round.");

        const houseEdge = computeDynamicHouseEdge();
        const nextCrashAt = generateCrashPoint(houseEdge);

        setCrashAt(nextCrashAt);
        setIsLoading(false);
        roundStartMsRef.current = performance.now();
        startRoundLoop(nextCrashAt);
    };

    const handleCashout = (): void => {
        if (!isGameOngoing || crashAt === null || roundEndedRef.current) {
            return;
        }
        if (multiplier >= crashAt) {
            return;
        }
        playResultSfx(true);
        finalizeRound(crashAt, true, multiplier);
    };

    const handleReset = (): void => {
        stopResultSfxForNewRound();
        stopRoundLoop();
        roundEndedRef.current = false;
        setCurrentView(0);
        setIsLoading(false);
        setIsGameOngoing(false);
        setIsCrashed(false);
        setMultiplier(1);
        setCrashAt(null);
        setElapsedMs(0);
        setPayout(null);
        setDidCashout(false);
        setCurrentGameId(generateGameId());

        if (inReplayMode) {
            const params = new URLSearchParams(
                typeof window === "undefined" ? "" : window.location.search,
            );
            params.delete("id");
            router.replace(`?${params.toString()}`, { scroll: false });
            setReplayIdString(null);
        }
    };

    const handlePlayAgain = async (): Promise<void> => {
        stopRoundLoop();
        roundEndedRef.current = false;
        setCurrentGameId(generateGameId());
        await playGame();
    };

    const handleRewatch = (): void => {
        if (!lastRound) {
            return;
        }
        stopRoundLoop();
        roundEndedRef.current = false;
        setBetAmount(lastRound.betAmount);
        setAutoCashoutAt(lastRound.autoCashoutAt);
        setCrashAt(lastRound.crashAt);
        setMultiplier(lastRound.didCashout && lastRound.cashoutMultiplier
            ? lastRound.cashoutMultiplier
            : lastRound.crashAt);
        setDidCashout(lastRound.didCashout);
        setIsCrashed(!lastRound.didCashout);
        setPayout(lastRound.didCashout && lastRound.cashoutMultiplier
            ? roundToTwoDecimals(lastRound.betAmount * lastRound.cashoutMultiplier)
            : 0);
        setCurrentView(2);
        setIsGameOngoing(false);
        setElapsedMs(0);
    };

    useEffect(
        () => () => {
            stopRoundLoop();
            if (restoreMusicTimeoutRef.current !== null) {
                window.clearTimeout(restoreMusicTimeoutRef.current);
                restoreMusicTimeoutRef.current = null;
            }
            setMusicVolumeMultiplier(1);
        },
        [],
    );

    const playAgainText = "Play Again";
    const showPNL = payout !== null && payout > betAmount;

    return (
        <div className="relative">
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 lg:gap-10">
                <div className="relative w-full min-w-0 lg:basis-2/3">
                    <GameWindow
                        game={game}
                        currentGameId={currentGameId}
                        isLoading={isLoading}
                        isGameFinished={currentView === 2}
                        onPlayAgain={handlePlayAgain}
                        playAgainText={playAgainText}
                        onRewatch={handleRewatch}
                        onReset={handleReset}
                        betAmount={betAmount}
                        payout={payout}
                        inReplayMode={inReplayMode}
                        isUserOriginalPlayer={true}
                        showPNL={showPNL}
                        isGamePaused={false}
                        resultModalDelayMs={800}
                        musicMuted={musicMuted}
                        onMusicMutedChange={setMusicMuted}
                        sfxMuted={sfxMuted}
                        onSfxMutedChange={setSfxMuted}
                        musicVolumeMultiplier={musicVolumeMultiplier}
                    >
                        <MyGameWindow
                            game={game}
                            multiplier={multiplier}
                            crashAt={crashAt}
                            isGameOngoing={isGameOngoing}
                            isCrashed={isCrashed}
                            elapsedMs={elapsedMs}
                            didCashout={didCashout}
                            sfxMuted={sfxMuted}
                        />
                    </GameWindow>

                    {!splashDismissed ? (
                        <div className="absolute inset-0 z-[35] flex flex-col overflow-hidden rounded-[12px] bg-[#050a0e]">
                            <div className="absolute bottom-4 right-4 z-[40] flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="p-2 bg-[#151C21]/40 rounded-[8px] text-[#91989C]"
                                    onClick={() => setSfxMuted((prev) => !prev)}
                                    title={sfxMuted ? "Unmute SFX" : "Mute SFX"}
                                >
                                    {sfxMuted ? (
                                        <AudioLines className="h-5 w-5 opacity-40" />
                                    ) : (
                                        <AudioLines className="h-5 w-5" />
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="p-2 bg-[#151C21]/40 rounded-[8px] text-[#91989C]"
                                    onClick={() => setMusicMuted((prev) => !prev)}
                                    title={musicMuted ? "Unmute music" : "Mute music"}
                                >
                                    {musicMuted ? (
                                        <VolumeX className="h-6 w-6" />
                                    ) : (
                                        <Volume2 className="h-6 w-6" />
                                    )}
                                </Button>
                            </div>
                            <div className="min-h-0 flex-1">
                                <video
                                    className="h-full w-full object-contain"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    preload="auto"
                                >
                                    <source
                                        src="/submissions/jnkyz-skate-or-crash/splash-screen.webm"
                                        type="video/webm"
                                    />
                                </video>
                            </div>
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#050a0e] to-transparent sm:h-36" />
                            <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-5 pt-4 sm:pb-7">
                                <button
                                    type="button"
                                    onClick={() => setSplashDismissed(true)}
                                    className="min-w-[180px] rounded-md border border-[#7FFFD4]/40 bg-[#7FFFD4] px-6 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[#042d28] shadow-[0_0_24px_rgba(127,255,212,0.35)] transition hover:opacity-95 active:scale-[0.98] sm:px-8 sm:py-3 sm:text-sm"
                                >
                                    Agree &amp; Play
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>

                <MyGameSetupCard
                    game={game}
                    onPlay={playGame}
                    onCashout={handleCashout}
                    onRewatch={handleRewatch}
                    onReset={handleReset}
                    onPlayAgain={handlePlayAgain}
                    playAgainText={playAgainText}
                    currentView={currentView}
                    betAmount={betAmount}
                    setBetAmount={setBetAmount}
                    autoCashoutAt={autoCashoutAt}
                    setAutoCashoutAt={setAutoCashoutAt}
                    isLoading={isLoading}
                    payout={payout}
                    multiplier={multiplier}
                    elapsedMs={elapsedMs}
                    inReplayMode={inReplayMode}
                    walletBalance={walletBalance}
                    minBet={MIN_BET}
                    maxBet={walletBalance}
                    isGameOngoing={isGameOngoing}
                    crashAt={crashAt}
                    introSplashActive={!splashDismissed}
                />
            </div>
        </div>
    );
};

export default MyGameComponent;