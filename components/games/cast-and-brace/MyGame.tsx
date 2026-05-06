"use client";

import React, {
    Suspense,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Info } from "lucide-react";
import { getPayout, randomBytes, Game } from "@/lib/games";
import GameWindow from "@/components/shared/GameWindow";
import MyGameWindow from "./MyGameWindow";
import MyGameWindowStatsStrip from "./MyGameWindowStatsStrip";
import MyGameSetupCard from "./MyGameSetupCard";
import MainMenuOverlay from "./MainMenuOverlay";
import ManifestOverlay from "./ManifestOverlay";
import ReelMeterHud from "./ReelMeterHud";
import { useMyGamePlayerStats } from "./hooks/useMyGamePlayerStats";
import {
    BITE_ALERT_MS,
    CATCH_REVEAL_DISPLAY_MS,
    KOKO_CATCH_REVEAL_SAFETY_MS,
    clampCastsPerSession,
    devKokoJackpotPlatformResult,
    fishResultFromRandomWord,
    FishingPhase,
    FishPlatformResult,
    IDLE_FISH_SCHOOL_SEED,
    initialFishingPhase,
    randomReelTapGoal,
    REEL_FIGHT_DIP_INTERVAL_MAX_MS,
    REEL_FIGHT_DIP_INTERVAL_MIN_MS,
    REEL_FIGHT_DIP_MAX,
    REEL_FIGHT_DIP_MIN,
    REEL_METER_DECAY_INTERVAL_MS,
    REEL_METER_DECAY_PER_TICK,
    WAITING_TO_BITE_MS,
    MY_GAME_BG_PIXEL_HEIGHT,
    MY_GAME_BG_PIXEL_WIDTH,
} from "./myGameConfig";
import { bytesToHex, Hex } from "viem";
import { toast } from "sonner";
import { MyGameAudioController } from "./audio/myGameAudioController";
import { resolveOutcomeFromPlatform } from "./config/outcomeResolve";
import { myGame } from "./myGameConfig";

type EntryOverlay = "none" | "menu" | "manifest";

const MyGameComponent: React.FC = () => {
    const game = myGame;
    
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const replayIdString = searchParams.get("id");
    const walletBalance = 25;

    const [currentView, setCurrentView] = useState<0 | 1 | 2>(0);
    const [entryOverlay, setEntryOverlay] = useState<EntryOverlay>("menu");

    const [betAmount, setBetAmount] = useState<number>(0);
    /** Rounds per session when the player taps Cast line (1–15). */
    const [castsPerSession, setCastsPerSession] = useState(1);
    /** Total stake for the active session (`betAmount × locked cast count`). */
    const [sessionStakeApe, setSessionStakeApe] = useState<number | null>(null);
    /** For HUD “Cast i / n” while a multi-cast session is in progress. */
    const [sessionCastsTotalDisplay, setSessionCastsTotalDisplay] =
        useState(0);
    const [currentCastIndexDisplay, setCurrentCastIndexDisplay] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [payout, setPayout] = useState<number | null>(null);
    const [gameOver, setGameOver] = useState(false);

    const [fishingPhase, setFishingPhase] =
        useState<FishingPhase>(initialFishingPhase);
    const [platformResult, setPlatformResult] =
        useState<FishPlatformResult | null>(null);
    const [lastPlatformResult, setLastPlatformResult] =
        useState<FishPlatformResult | null>(null);
    const [castAnimKey, setCastAnimKey] = useState(0);
    /**
     * Bumps when remounting the scene (e.g. Play Again / Rewatch). Intentionally not
     * bumped on Change Bet so the water + fish band keep the same layout geometry.
     */
    const [sceneLayoutKey, setSceneLayoutKey] = useState(0);
    /**
     * Fish school layout is derived deterministically from this seed (see `IDLE_FISH_SCHOOL_SEED`).
     * Kept constant so refresh / reset never re-randomizes vertical placement of the school.
     */
    const [fishSchoolSeed] = useState(IDLE_FISH_SCHOOL_SEED);
    /** Bet used for the last settled round; kept for rewatch so payout / multiplier match the original. */
    const [settledBetForReplay, setSettledBetForReplay] = useState<number | null>(
        null
    );
    const reelRevealCommittedRef = useRef(false);
    const fishingPhaseRef = useRef<FishingPhase>(initialFishingPhase);
    const tapGoalRef = useRef(15);
    const isReelPullAnimRef = useRef(false);
    const catchRevealToResultsTimeoutRef = useRef<number | null>(null);
    /** KoKo catch video calls this to advance to results; cleared after one run. */
    const kokoCatchRevealAdvanceRef = useRef<(() => void) | null>(null);
    /** Locked when a session starts (`playGame`). */
    const sessionCastsTotalRef = useRef(1);
    const currentCastIndexRef = useRef(1);
    const sessionPayoutAccumulatorRef = useRef(0);

    const audioRef = useRef<MyGameAudioController | null>(null);

    const lastRevealRoundKeyRef = useRef<number>(-1);
    const swarmTimeoutRef = useRef<number | null>(null);
    const swarmLastSoundRef = useRef<"fish_swim_pass" | "bubble_pop_soft" | null>(
        null,
    );
    /** Invalidates delayed jackpot sting across strict remount / reset. */
    const revealPlayTokenRef = useRef(0);

    const [reelProgress, setReelProgress] = useState(0);
    const [isReelPullAnim, setIsReelPullAnim] = useState(false);

    const [currentGameId, setCurrentGameId] = useState<bigint>(
        replayIdString == null
            ? BigInt(bytesToHex(new Uint8Array(randomBytes(32))))
            : BigInt(replayIdString)
    );
    const [userRandomWord, setUserRandomWord] = useState<Hex>(
        bytesToHex(new Uint8Array(randomBytes(32)))
    );

    const { stats: playerSessionStats, recordSettledRound } =
        useMyGamePlayerStats();

    useEffect(() => {
        if (replayIdString !== null && replayIdString.length > 2) {
            setIsLoading(true);
            setCurrentGameId(BigInt(replayIdString));
        }
    }, [replayIdString]);

    useLayoutEffect(() => {
        audioRef.current = new MyGameAudioController();
        return () => {
            audioRef.current?.dispose();
            audioRef.current = null;
        };
    }, []);

    const unlockAudioFromGesture = useCallback(() => {
        audioRef.current?.unlockFromGesture();
    }, []);

    /** Re-nudge lake loop after phase / overlay changes (tab pause, first play retry, etc.). */
    useEffect(() => {
        audioRef.current?.ensureLakeAmbient();
    }, [
        currentView,
        fishingPhase,
        castAnimKey,
        entryOverlay,
        gameOver,
        isLoading,
    ]);

    /** Main-menu loop only on entry parchment; lake resumes when overlay closes. */
    useEffect(() => {
        audioRef.current?.setMainMenuMusicDesired(entryOverlay === "menu");
    }, [entryOverlay]);

    /** First pointer/tap in the game column unlocks quiet ambient (autoplay-safe). */
    const handleGameColumnPointerDownCapture = useCallback(
        (e: React.PointerEvent) => {
            if (!e.isPrimary || e.button !== 0) {
                return;
            }
            unlockAudioFromGesture();
            const t = e.target;
            if (!(t instanceof Element)) {
                return;
            }
            if (t.closest(".emerald-reel-meter-host")) {
                return;
            }
            const btn = t.closest("button");
            if (btn instanceof HTMLButtonElement && btn.disabled) {
                return;
            }
            const roleBtn = t.closest('[role="button"]');
            if (
                roleBtn instanceof HTMLElement &&
                roleBtn.getAttribute("aria-disabled") === "true"
            ) {
                return;
            }
            if (btn || roleBtn) {
                audioRef.current?.playMenuSelect();
            }
        },
        [unlockAudioFromGesture],
    );

    useEffect(() => {
        if (fishingPhase !== "waiting" || currentView !== 1) {
            return;
        }
        audioRef.current?.preloadBiteSignal();
        const t = window.setTimeout(() => {
            if (fishingPhaseRef.current !== "waiting") {
                return;
            }
            audioRef.current?.playBiteSignal();
            setFishingPhase((p) => (p === "waiting" ? "bite" : p));
        }, WAITING_TO_BITE_MS);
        return () => window.clearTimeout(t);
    }, [fishingPhase, currentView, castAnimKey]);

    useEffect(() => {
        reelRevealCommittedRef.current = false;
    }, [castAnimKey]);

    useEffect(() => {
        fishingPhaseRef.current = fishingPhase;
    }, [fishingPhase]);

    useEffect(() => {
        isReelPullAnimRef.current = isReelPullAnim;
    }, [isReelPullAnim]);

    /** New round: pick tap goal and reset reel meter when the cast starts. */
    useEffect(() => {
        if (fishingPhase !== "casting" || currentView !== 1) {
            return;
        }
        tapGoalRef.current = randomReelTapGoal();
        setReelProgress(0);
        setIsReelPullAnim(false);
    }, [fishingPhase, currentView, castAnimKey]);

    /** After bite alert, open the reel minigame. */
    useEffect(() => {
        if (fishingPhase !== "bite") {
            return;
        }
        const t = window.setTimeout(() => {
            setFishingPhase((p) => (p === "bite" ? "reeling" : p));
        }, BITE_ALERT_MS);
        return () => window.clearTimeout(t);
    }, [fishingPhase, castAnimKey]);

    /** Passive meter decay while fighting. */
    useEffect(() => {
        if (fishingPhase !== "reeling" || isReelPullAnim) {
            return;
        }
        const id = window.setInterval(() => {
            setReelProgress((p) =>
                p >= 100 ? p : Math.max(0, p - REEL_METER_DECAY_PER_TICK)
            );
        }, REEL_METER_DECAY_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, [fishingPhase, isReelPullAnim, castAnimKey]);

    /** Random fight-back dips. */
    useEffect(() => {
        if (fishingPhase !== "reeling" || isReelPullAnim) {
            return;
        }
        let cancelled = false;
        let tid: number | undefined;

        const scheduleDip = () => {
            if (cancelled) {
                return;
            }
            const wait =
                REEL_FIGHT_DIP_INTERVAL_MIN_MS +
                Math.random() *
                    (REEL_FIGHT_DIP_INTERVAL_MAX_MS -
                        REEL_FIGHT_DIP_INTERVAL_MIN_MS);
            tid = window.setTimeout(() => {
                if (cancelled) {
                    return;
                }
                setReelProgress((p) => {
                    if (p >= 100) {
                        return p;
                    }
                    const dip =
                        REEL_FIGHT_DIP_MIN +
                        Math.random() * (REEL_FIGHT_DIP_MAX - REEL_FIGHT_DIP_MIN);
                    return Math.max(0, p - dip);
                });
                scheduleDip();
            }, wait) as unknown as number;
        };

        scheduleDip();
        return () => {
            cancelled = true;
            if (tid !== undefined) {
                window.clearTimeout(tid);
            }
        };
    }, [fishingPhase, isReelPullAnim, castAnimKey]);

    /** Meter full → play line-in retract animation. */
    useEffect(() => {
        if (
            fishingPhase === "reeling" &&
            reelProgress >= 100 &&
            !isReelPullAnim
        ) {
            setIsReelPullAnim(true);
        }
    }, [fishingPhase, reelProgress, isReelPullAnim]);

    const getActiveBetAmount = (): number => betAmount;
    const getModalStakeApe = (): number =>
        sessionStakeApe !== null ? sessionStakeApe : betAmount;
    const shouldShowPNL: boolean =
        !!payout && payout > 0 && payout > getModalStakeApe();
    const playAgainText = "Play Again";

    /** Keep HUD visible through retract so the bar can show a full + completion effect. */
    const showReelHudBelowGame =
        currentView === 1 && fishingPhase === "reeling";

    const applyPayoutForResult = useCallback(
        (result: FishPlatformResult, wager: number): number => {
            const factor = getPayout(
                game.payouts,
                0,
                0,
                result.payoutIndex
            );
            return (wager * factor) / 10_000;
        },
        [game]
    );

    const handleCastComplete = useCallback(() => {
        setFishingPhase((p) => (p === "casting" ? "waiting" : p));
    }, []);

    const handleCastWhoosh = useCallback(() => {
        unlockAudioFromGesture();
        audioRef.current?.playOneShot("cast_whoosh");
    }, [unlockAudioFromGesture]);

    const handleHookWaterEntry = useCallback(() => {
        unlockAudioFromGesture();
        audioRef.current?.playOneShot("hook_splash_small");
    }, [unlockAudioFromGesture]);

    const handleReelMeterTap = useCallback(() => {
        if (
            fishingPhaseRef.current !== "reeling" ||
            isReelPullAnimRef.current
        ) {
            return;
        }
        unlockAudioFromGesture();
        audioRef.current?.playReelClick();
        const add = 100 / tapGoalRef.current;
        setReelProgress((p) => Math.min(100, p + add));
    }, [unlockAudioFromGesture]);

    const clearCatchRevealResultsTimeout = useCallback(() => {
        if (catchRevealToResultsTimeoutRef.current !== null) {
            window.clearTimeout(catchRevealToResultsTimeoutRef.current);
            catchRevealToResultsTimeoutRef.current = null;
        }
    }, []);

    const notifyKokoCatchRevealVideoEnded = useCallback(() => {
        kokoCatchRevealAdvanceRef.current?.();
    }, []);

    const handleReelComplete = useCallback(() => {
        if (reelRevealCommittedRef.current) {
            return;
        }
        if (fishingPhaseRef.current !== "reeling") {
            return;
        }
        if (platformResult === null) {
            return;
        }
        reelRevealCommittedRef.current = true;
        setFishingPhase("reveal");
        const wager = settledBetForReplay ?? betAmount;
        const won = applyPayoutForResult(platformResult, wager);
        const multFromResult = platformResult.payoutMultiplier;
        const multiplier =
            multFromResult != null && Number.isFinite(multFromResult)
                ? multFromResult
                : wager > 0
                  ? won / wager
                  : 0;
        recordSettledRound(won, multiplier);
        sessionPayoutAccumulatorRef.current += won;
        const castIdx = currentCastIndexRef.current;
        const totalCasts = sessionCastsTotalRef.current;
        const isLastCast = castIdx >= totalCasts;
        const revealOutcome = resolveOutcomeFromPlatform(
            multiplier,
            platformResult.payoutIndex,
        );
        const isKokoJackpot = revealOutcome.id === "koko_monster";
        setPayout(won);
        setSettledBetForReplay(wager);
        setCurrentView(isLastCast ? 2 : 1);
        clearCatchRevealResultsTimeout();
        kokoCatchRevealAdvanceRef.current = null;

        let catchRevealAdvanceRan = false;
        const advanceCatchRevealToResults = () => {
            if (catchRevealAdvanceRan) {
                return;
            }
            catchRevealAdvanceRan = true;
            kokoCatchRevealAdvanceRef.current = null;
            clearCatchRevealResultsTimeout();
            if (!isLastCast) {
                currentCastIndexRef.current = castIdx + 1;
                setCurrentCastIndexDisplay(castIdx + 1);
                const newWord = bytesToHex(
                    new Uint8Array(randomBytes(32)),
                ) as Hex;
                setUserRandomWord(newWord);
                const nextResult = fishResultFromRandomWord(newWord);
                setPlatformResult(nextResult);
                setLastPlatformResult(nextResult);
                setPayout(null);
                reelRevealCommittedRef.current = false;
                lastRevealRoundKeyRef.current = -1;
                setCastAnimKey((k) => k + 1);
                setFishingPhase(initialFishingPhase);
                window.requestAnimationFrame(() => {
                    setFishingPhase("casting");
                });
                return;
            }
            setPayout(sessionPayoutAccumulatorRef.current);
            setGameOver(true);
        };

        kokoCatchRevealAdvanceRef.current = advanceCatchRevealToResults;
        const revealDelayMs = isKokoJackpot
            ? KOKO_CATCH_REVEAL_SAFETY_MS
            : CATCH_REVEAL_DISPLAY_MS;
        catchRevealToResultsTimeoutRef.current = window.setTimeout(
            advanceCatchRevealToResults,
            revealDelayMs,
        ) as unknown as number;
    }, [
        platformResult,
        betAmount,
        settledBetForReplay,
        applyPayoutForResult,
        clearCatchRevealResultsTimeout,
        recordSettledRound,
    ]);

    const playGame = async (
        gameId?: bigint,
        randomWord?: Hex,
        /** When Ape Church supplies the resolved outcome, use it (no local derivation). */
        resolvedPlatformResult?: FishPlatformResult | null
    ) => {
        unlockAudioFromGesture();
        setIsLoading(true);
        // Mock tx placeholder — replace with Ape Church settlement + resolved result.

        const randomWordToUse = randomWord ?? userRandomWord;
        void gameId;

        try {
            const receiptSuccess = true;

            if (receiptSuccess) {
                setSettledBetForReplay(null);
                const lockedCasts = clampCastsPerSession(castsPerSession);
                sessionCastsTotalRef.current = lockedCasts;
                currentCastIndexRef.current = 1;
                sessionPayoutAccumulatorRef.current = 0;
                setSessionCastsTotalDisplay(lockedCasts);
                setCurrentCastIndexDisplay(1);
                setSessionStakeApe(betAmount * lockedCasts);
                const wantDevKoko =
                    process.env.NODE_ENV === "development" &&
                    searchParams.get("devKoko") === "1";
                const result =
                    resolvedPlatformResult != null
                        ? resolvedPlatformResult
                        : wantDevKoko
                          ? devKokoJackpotPlatformResult()
                          : fishResultFromRandomWord(randomWordToUse);
                if (wantDevKoko) {
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete("devKoko");
                    const q = params.toString();
                    router.replace(q ? `${pathname}?${q}` : pathname, {
                        scroll: false,
                    });
                }
                setPlatformResult(result);
                setLastPlatformResult(result);
                setPayout(null);
                toast.success("Transaction complete!");
                setTimeout(() => {
                    setIsLoading(false);
                    setCastAnimKey((k) => k + 1);
                    setFishingPhase("casting");
                    setCurrentView(1);
                }, 880);
            } else {
                toast.info("Something went wrong..");
                setIsLoading(false);
            }
        } catch (error) {
            if (
                (error instanceof Error &&
                    error.message.includes("Transaction not found")) ||
                (typeof error === "string" && error.includes("Transaction not found"))
            ) {
                return;
            }
            toast.error("An unexpected error occurred.");
            setIsLoading(false);
        }
    };

    /** Ape Church contract hook — this game advances phases automatically (no manual steps). */
    const handleStateAdvance = (): void => {};

    const handleReset = (isPlayingAgain: boolean = false) => {
        clearCatchRevealResultsTimeout();
        kokoCatchRevealAdvanceRef.current = null;
        audioRef.current?.resetGameplayAudio();
        lastRevealRoundKeyRef.current = -1;
        swarmLastSoundRef.current = null;
        revealPlayTokenRef.current += 1;
        if (swarmTimeoutRef.current !== null) {
            window.clearTimeout(swarmTimeoutRef.current);
            swarmTimeoutRef.current = null;
        }
        reelRevealCommittedRef.current = false;
        fishingPhaseRef.current = initialFishingPhase;
        if (isPlayingAgain) {
            setSceneLayoutKey((k) => k + 1);
        }

        if (isPlayingAgain === false) {
            setCurrentGameId(
                BigInt(bytesToHex(new Uint8Array(randomBytes(32))))
            );
            setUserRandomWord(bytesToHex(new Uint8Array(randomBytes(32))));
            setLastPlatformResult(null);
            setCastAnimKey(0);
            setSettledBetForReplay(null);
            setEntryOverlay("none");
        }

        setCurrentView(0);
        setPayout(null);
        setGameOver(false);
        setIsLoading(false);
        setFishingPhase(initialFishingPhase);
        setPlatformResult(null);
        setReelProgress(0);
        setIsReelPullAnim(false);
        setSessionStakeApe(null);
        setSessionCastsTotalDisplay(0);
        setCurrentCastIndexDisplay(1);
        sessionCastsTotalRef.current = 1;
        currentCastIndexRef.current = 1;
        sessionPayoutAccumulatorRef.current = 0;

        if (replayIdString !== null) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("id");
            router.replace(`?${params.toString()}`, { scroll: false });
        }
    };

    const handlePlayAgain = async () => {
        const newGameId = BigInt(bytesToHex(new Uint8Array(randomBytes(32))));
        const newUserWord = bytesToHex(new Uint8Array(randomBytes(32)));
        setCurrentGameId(newGameId);
        setUserRandomWord(newUserWord);
        handleReset(true);
        await playGame(newGameId, newUserWord);
    };

    const handleRewatch = () => {
        if (lastPlatformResult === null) {
            return;
        }
        const saved = lastPlatformResult;
        handleReset(true);
        setPlatformResult(saved);
        setCastAnimKey((k) => k + 1);
        setFishingPhase("casting");
        setPayout(null);
        setGameOver(false);
        setCurrentView(1);
    };

    /** Underwater suspense — sparse swim / bubble one-shots (anti-repetition + long gaps). */
    useEffect(() => {
        if (fishingPhase !== "waiting" || currentView !== 1) {
            if (swarmTimeoutRef.current !== null) {
                window.clearTimeout(swarmTimeoutRef.current);
                swarmTimeoutRef.current = null;
            }
            return;
        }
        let cancelled = false;
        const scheduleNext = () => {
            if (cancelled) {
                return;
            }
            const base = 12_000 + Math.random() * 16_000;
            const extraGap = Math.random() < 0.22 ? 5_000 + Math.random() * 9_000 : 0;
            const delay = base + extraGap;
            swarmTimeoutRef.current = window.setTimeout(() => {
                swarmTimeoutRef.current = null;
                if (cancelled || fishingPhaseRef.current !== "waiting") {
                    return;
                }
                const last = swarmLastSoundRef.current;
                const roll = Math.random();
                let id: "fish_swim_pass" | "bubble_pop_soft";
                if (last === "fish_swim_pass") {
                    id = roll < 0.78 ? "bubble_pop_soft" : "fish_swim_pass";
                } else if (last === "bubble_pop_soft") {
                    id = roll < 0.78 ? "fish_swim_pass" : "bubble_pop_soft";
                } else {
                    id = roll < 0.5 ? "fish_swim_pass" : "bubble_pop_soft";
                }
                swarmLastSoundRef.current = id;
                audioRef.current?.playOneShot(id);
                scheduleNext();
            }, delay) as unknown as number;
        };
        scheduleNext();
        return () => {
            cancelled = true;
            if (swarmTimeoutRef.current !== null) {
                window.clearTimeout(swarmTimeoutRef.current);
                swarmTimeoutRef.current = null;
            }
        };
    }, [fishingPhase, currentView, castAnimKey]);

    /** Line tension while the reel minigame runs (including pull-back anim). */
    useEffect(() => {
        if (fishingPhase !== "reeling" || currentView !== 1) {
            audioRef.current?.stopLineTension();
            return;
        }
        audioRef.current?.startLineTension();
    }, [fishingPhase, currentView, castAnimKey]);

    /**
     * Reveal sting — stop line tension first, then win / lose / jackpot.
     * Jackpot is delayed slightly after tension stops so it reads above reveal_win.
     */
    useEffect(() => {
        if (fishingPhase !== "reveal" || platformResult === null) {
            return;
        }
        const multKnown =
            platformResult.payoutMultiplier != null &&
            Number.isFinite(platformResult.payoutMultiplier);
        if (!multKnown && payout === null) {
            return;
        }
        const wager = settledBetForReplay ?? betAmount;
        const mult =
            platformResult.payoutMultiplier != null &&
            Number.isFinite(platformResult.payoutMultiplier)
                ? platformResult.payoutMultiplier
                : wager > 0 && payout != null
                  ? payout / wager
                  : 0;
        const outcome = resolveOutcomeFromPlatform(
            mult,
            platformResult.payoutIndex,
        );
        const ctrl = audioRef.current;
        ctrl?.stopLineTension();

        const isJackpot = outcome.id === "koko_monster";
        const isLoss = outcome.isLoss === true || outcome.multiplier <= 0;

        if (isJackpot) {
            const token = ++revealPlayTokenRef.current;
            const tid = window.setTimeout(() => {
                if (revealPlayTokenRef.current !== token) {
                    return;
                }
                lastRevealRoundKeyRef.current = castAnimKey;
                audioRef.current?.playOneShot("jackpot_win");
            }, 120) as unknown as number;
            return () => {
                revealPlayTokenRef.current += 1;
                window.clearTimeout(tid);
            };
        }

        if (lastRevealRoundKeyRef.current === castAnimKey) {
            return;
        }
        lastRevealRoundKeyRef.current = castAnimKey;

        if (isLoss) {
            ctrl?.playOneShot("reveal_lose");
        } else {
            ctrl?.playOneShot("reveal_win");
        }
    }, [
        fishingPhase,
        castAnimKey,
        platformResult,
        settledBetForReplay,
        betAmount,
        payout,
    ]);

    return (
        <div
            className="min-h-0"
            onPointerDownCapture={handleGameColumnPointerDownCapture}
        >
            <div className="flex min-h-0 flex-col gap-4 sm:gap-8 lg:flex-row lg:items-stretch lg:gap-8 xl:gap-10">
                    <div className="flex min-h-0 min-w-0 w-full flex-col lg:min-h-0 lg:flex-[2.85] lg:basis-0">
                        <div
                            className="relative w-full min-w-0 overflow-hidden"
                            style={{
                                aspectRatio: `${MY_GAME_BG_PIXEL_WIDTH} / ${Math.round(MY_GAME_BG_PIXEL_HEIGHT * 1.1)}`,
                            }}
                        >
                            {entryOverlay === "menu" && (
                                <MainMenuOverlay
                                    open
                                    onLetsBrace={() =>
                                        setEntryOverlay("none")
                                    }
                                    onOpenManifest={() =>
                                        setEntryOverlay("manifest")
                                    }
                                />
                            )}
                            {entryOverlay === "manifest" && (
                                <ManifestOverlay
                                    open
                                    onClose={() =>
                                        setEntryOverlay("menu")
                                    }
                                />
                            )}
                            <Link
                                href="/fish-guide"
                                className="pointer-events-auto absolute left-2 top-10 z-[16] flex h-9 w-9 items-center justify-center rounded-full border border-[rgb(201_162_39_/_0.22)] bg-[rgb(0_0_0_/_0.28)] text-[#e8c85a]/75 shadow-[0_0_12px_rgb(0_0_0_/_0.45)] backdrop-blur-[2px] transition hover:border-[rgb(201_162_39_/_0.4)] hover:bg-[rgb(0_0_0_/_0.42)] hover:text-[#e8c85a] min-[480px]:top-11"
                                aria-label="Open fish compendium"
                            >
                                <Info
                                    className="h-[1.125rem] w-[1.125rem]"
                                    strokeWidth={2.25}
                                    aria-hidden
                                />
                            </Link>
                            <GameWindow
                                game={game}
                                currentGameId={currentGameId}
                                isLoading={isLoading}
                                isGameFinished={gameOver}
                                onPlayAgain={handlePlayAgain}
                                playAgainText={playAgainText}
                                onRewatch={handleRewatch}
                                onReset={() => handleReset(false)}
                                betAmount={getModalStakeApe()}
                                payout={payout}
                                inReplayMode={replayIdString !== null}
                                isUserOriginalPlayer={true}
                                showPNL={shouldShowPNL}
                                isGamePaused={false}
                                resultModalDelayMs={0}
                                disableBuiltInSong
                            >
                                <MyGameWindow
                                    fishingPhase={fishingPhase}
                                    castAnimKey={castAnimKey}
                                    sceneLayoutKey={sceneLayoutKey}
                                    fishSchoolSeed={fishSchoolSeed}
                                    onCastComplete={handleCastComplete}
                                    onCastWhoosh={handleCastWhoosh}
                                    onHookWaterEntry={handleHookWaterEntry}
                                    onReelMeterTap={handleReelMeterTap}
                                    onReelComplete={handleReelComplete}
                                    reelPullStarted={isReelPullAnim}
                                    revealPayout={payout}
                                    revealBet={settledBetForReplay ?? betAmount}
                                    platformResult={platformResult}
                                    onKokoCatchRevealVideoEnded={
                                        notifyKokoCatchRevealVideoEnded
                                    }
                                />
                            </GameWindow>
                            <MyGameWindowStatsStrip
                                currentBetApe={
                                    currentView === 0
                                        ? betAmount
                                        : (sessionStakeApe ??
                                          settledBetForReplay ??
                                          betAmount)
                                }
                                castsProgress={
                                    currentView === 1 &&
                                    sessionCastsTotalDisplay > 1
                                        ? {
                                              current: currentCastIndexDisplay,
                                              total: sessionCastsTotalDisplay,
                                          }
                                        : null
                                }
                                biggestCatchApe={
                                    playerSessionStats.biggestCatchApe
                                }
                                highestMultiplier={
                                    playerSessionStats.highestMultiplier
                                }
                                themeColorBackground={
                                    game.themeColorBackground
                                }
                                className="z-[22]"
                            />
                        </div>
                    </div>

                    <div className="flex min-h-0 min-w-0 w-full flex-col lg:min-h-0 lg:flex-1 lg:basis-0">
                        <MyGameSetupCard
                            game={game}
                            onPlay={async () => await playGame()}
                            onAdvance={handleStateAdvance}
                            onRewatch={handleRewatch}
                            onReset={() => handleReset(false)}
                            onPlayAgain={async () => await handlePlayAgain()}
                            playAgainText={playAgainText}
                            currentView={currentView}
                            fishingPhase={fishingPhase}
                            settledBetAmount={settledBetForReplay}
                            betAmount={
                                currentView === 0
                                    ? betAmount
                                    : getActiveBetAmount()
                            }
                            setBetAmount={setBetAmount}
                            isLoading={isLoading}
                            payout={payout}
                            platformResult={platformResult}
                            inReplayMode={replayIdString !== null}
                            walletBalance={walletBalance}
                            minBet={1}
                            maxBet={100}
                            castsPerSession={castsPerSession}
                            setCastsPerSession={setCastsPerSession}
                            sessionTotalStakeApe={sessionStakeApe}
                            reelSlot={
                                showReelHudBelowGame ? (
                                    <ReelMeterHud
                                        progress={reelProgress}
                                        reelRetracting={isReelPullAnim}
                                        onReelTap={handleReelMeterTap}
                                    />
                                ) : null
                            }
                        />
                    </div>
                </div>
        </div>
    );
};

export default MyGameComponent;
