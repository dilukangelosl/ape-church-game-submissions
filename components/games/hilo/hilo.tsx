"use client";


import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import GameWindow from "@/components/shared/GameWindow";
import MyGameWindow from "./hiloWindow";
import MyGameSetupCard from "./hiloSetupCard";
import { bytesToHex } from "viem";
import { randomBytes, Game } from "@/lib/games";
import "./hilo.style.css";
import {
    Card,
    GuessDirection,
    HOUSE_EDGE,
    TOTAL_RANKS,
    createDeckFromRandomWord,
    getRankOutcomes,
    getStepMultiplier,
    myGame,
} from "./hiloConfig";

interface CardHistoryEntry {
    card: Card;
    multiplier: number;
    isStart: boolean;
    outcome: "start" | "win" | "loss" | "skip";
}

interface HiloRoundState {
    deck: Card[];
    currentCard: Card | null;
    revealedCard: Card | null;
    currentMultiplier: number;
    payout: number | null;
    lastPayout: number | null;
    lastGuess: GuessDirection | null;
    resultText: string;
    isLoading: boolean;
    isResolving: boolean;
    history: CardHistoryEntry[];
}

const INITIAL_ROUND_STATE: HiloRoundState = {
    deck: [],
    currentCard: null,
    revealedCard: null,
    currentMultiplier: 1,
    payout: null,
    lastPayout: null,
    lastGuess: null,
    resultText: "Place your bet and deal your first card.",
    isLoading: false,
    isResolving: false,
    history: [],
};

const HOUSE_EDGE_MIN = 0.9;
const HOUSE_EDGE_MAX = 0.9999;
const DEFAULT_POOL_MAX_PAYOUT = 10000;
const MAX_BET_ROUNDS = 99000;
const BACKGROUND_MUSIC_VOLUME = 0.25;
const AUTO_ACTION_DELAY_MS = 140;
const AUTO_NEXT_ROUND_DELAY_MS = 220;
const AUTO_RESOLVE_DELAY_MS = 420;
const MANUAL_RESOLVE_DELAY_MS = 320;
const MANUAL_LOSS_RESOLVE_DELAY_MS = 220;
const BIG_CARD_REVEAL_DELAY_MS = 100;

interface ChainRoundData {
    roundId: bigint;
    randomWord: `0x${string}`;
    houseEdge: number;
    maxPayout: number;
}

const clampHouseEdge = (value: number) => Math.min(HOUSE_EDGE_MAX, Math.max(HOUSE_EDGE_MIN, value));
const toSafeNonNegativeInt = (value: number, fallback = 0): number => {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.floor(value));
};

const toSafePositiveInt = (value: number, fallback = 1, maxValue = Number.POSITIVE_INFINITY): number => {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(maxValue, Math.max(1, Math.floor(value)));
};

const MyGame: React.FC = () => {
    const game = myGame;
    const searchParams = useSearchParams();
    const replayId = searchParams.get("id");

    const [currentGameId, setCurrentGameId] = useState<bigint>(
        BigInt(bytesToHex(new Uint8Array(randomBytes(32))))
    );

    const [currentView, setCurrentView] = useState<0 | 1 | 2>(0);
    const [betAmount, setBetAmount] = useState(1);
    const [numberOfSpins, setNumberOfSpins] = useState(1);
    const [betMode, setBetMode] = useState<"manual" | "auto">("manual");
    const [autoBetCount, setAutoBetCount] = useState(1);
    const [isAutoBetting, setIsAutoBetting] = useState(false);
    const [remainingAutoBets, setRemainingAutoBets] = useState(0);
    const [autoTotalPayout, setAutoTotalPayout] = useState(0);
    const [autoRoundsPlayed, setAutoRoundsPlayed] = useState(0);
    const [showStoppedAutoSummary, setShowStoppedAutoSummary] = useState(false);
    const [autoLowerOrSameRanks, setAutoLowerOrSameRanks] = useState<number[]>([]);
    const [autoHigherOrSameRanks, setAutoHigherOrSameRanks] = useState<number[]>([]);
    const [autoSkipRanks, setAutoSkipRanks] = useState<number[]>([]);
    const [autoAceAction, setAutoAceAction] = useState<"higher" | "same" | "skip">("skip");
    const [autoKingAction, setAutoKingAction] = useState<"lower" | "same" | "skip">("skip");
    const [autoCashoutMultiplier, setAutoCashoutMultiplier] = useState(2);
    const [walletBalance, setWalletBalance] = useState(25);
    const [walletShake, setWalletShake] = useState(false);
    const walletShakeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggerWalletShake = React.useCallback(() => {
        setWalletShake(false);
        if (walletShakeTimeoutRef.current) clearTimeout(walletShakeTimeoutRef.current);
        requestAnimationFrame(() => {
            setWalletShake(true);
            walletShakeTimeoutRef.current = setTimeout(() => setWalletShake(false), 550);
        });
    }, []);
    const [purchasedRoundsRemaining, setPurchasedRoundsRemaining] = useState(0);
    const [manualSessionTotalPayout, setManualSessionTotalPayout] = useState(0);
    const [manualRoundsPlayed, setManualRoundsPlayed] = useState(0);
    const [roundState, setRoundState] = useState<HiloRoundState>(INITIAL_ROUND_STATE);
    const [isRewatching, setIsRewatching] = useState(false);
    const [isSfxMuted, setIsSfxMuted] = useState(false);
    const [isMusicMuted, setIsMusicMuted] = useState(false);
    const [chainHouseEdge, setChainHouseEdge] = useState(() => clampHouseEdge(HOUSE_EDGE));
    const [maxPayoutPerGame, setMaxPayoutPerGame] = useState(DEFAULT_POOL_MAX_PAYOUT);
    const resolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoActionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const replayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRoundDeckRef = useRef<Card[] | null>(null);
    const lastRoundRandomWordRef = useRef<`0x${string}` | null>(null);
    const lastFinishedRoundRef = useRef<HiloRoundState | null>(null);
    const lastAutoSessionBetCountRef = useRef(1);
    const autoSessionTargetBetsRef = useRef(0);
    const autoRoundsPlayedRef = useRef(0);
    const remainingAutoBetsRef = useRef(0);
    const purchasedRoundsRemainingRef = useRef(0);
    const cashoutSfxRef = useRef<HTMLAudioElement | null>(null);
    const loseSfxRef = useRef<HTMLAudioElement | null>(null);
    const bgmRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio("/submissions/hilo/sfx/win_v2.mp3");
        audio.preload = "auto";
        cashoutSfxRef.current = audio;
        return () => {
            audio.pause();
            cashoutSfxRef.current = null;
        };
    }, []);

    useEffect(() => {
        const audio = new Audio("/submissions/hilo/sfx/lose_v2.mp3");
        audio.preload = "auto";
        loseSfxRef.current = audio;
        return () => {
            audio.pause();
            loseSfxRef.current = null;
        };
    }, []);

    useEffect(() => {
        const audio = new Audio("/submissions/hilo/audio/casino_background.mp3");
        audio.preload = "auto";
        audio.loop = true;
        audio.volume = BACKGROUND_MUSIC_VOLUME;
        bgmRef.current = audio;

        if (!isMusicMuted) {
            void audio.play().catch(() => {
                // Browser autoplay can be blocked until user interacts.
            });
        }

        return () => {
            audio.pause();
            bgmRef.current = null;
        };
    }, []);

    useEffect(() => {
        const audio = bgmRef.current;
        if (!audio) return;

        audio.volume = BACKGROUND_MUSIC_VOLUME;
        audio.muted = isMusicMuted;
        if (!isMusicMuted && audio.paused) {
            void audio.play().catch(() => {
                // Browser autoplay can be blocked until user interacts.
            });
        }
    }, [isMusicMuted]);

    const houseEdge = clampHouseEdge(chainHouseEdge);

    const outcomes = useMemo(() => {
        if (!roundState.currentCard) {
            return { higher: 0, lower: 0, equal: 0 };
        }
        return getRankOutcomes(roundState.currentCard.rank);
    }, [roundState.currentCard]);

    const getOutsForDirection = (currentRank: number, direction: GuessDirection): number => {
        if (direction === "same") {
            return 1;
        }

        if (direction === "higher") {
            if (currentRank === 1) {
                return outcomes.higher;
            }
            return outcomes.higher + outcomes.equal;
        }

        if (currentRank === TOTAL_RANKS) {
            return outcomes.lower;
        }
        return outcomes.lower + outcomes.equal;
    };

    const higherMultiplier = useMemo(
        () => getStepMultiplier(getOutsForDirection(roundState.currentCard?.rank ?? 0, "higher"), TOTAL_RANKS, houseEdge),
        [outcomes.higher, outcomes.equal, roundState.currentCard, houseEdge]
    );

    const lowerMultiplier = useMemo(
        () => getStepMultiplier(getOutsForDirection(roundState.currentCard?.rank ?? 0, "lower"), TOTAL_RANKS, houseEdge),
        [outcomes.lower, outcomes.equal, roundState.currentCard, houseEdge]
    );

    const sameMultiplier = useMemo(
        () => getStepMultiplier(1, TOTAL_RANKS, houseEdge),
        [houseEdge]
    );

    const canGuess =
        currentView === 1 &&
        !isRewatching &&
        !roundState.isResolving &&
        !roundState.isLoading &&
        roundState.currentCard !== null &&
        roundState.deck.length > 0;
    const canCashOut = currentView === 1 && !isRewatching && !roundState.isResolving && roundState.currentMultiplier > 1;
    const canSkip = canGuess;
    const safePurchasedRoundsRemaining = toSafeNonNegativeInt(purchasedRoundsRemaining, 0);
    const canDeal =
        betMode === "manual" &&
        currentView !== 1 &&
        !isRewatching &&
        !roundState.isResolving &&
        !roundState.isLoading &&
        (betMode !== "manual" || safePurchasedRoundsRemaining > 0);
    const hasActivePackage = safePurchasedRoundsRemaining > 0;
    const packageLocked = roundState.isLoading || roundState.isResolving || currentView === 1 || hasActivePackage;
    const manualRoundsRemaining = safePurchasedRoundsRemaining;
    const currentPayout = Number(
        (Math.min(currentView === 1 ? betAmount * roundState.currentMultiplier : roundState.payout ?? 0, maxPayoutPerGame)).toFixed(2)
    );
    const isAutoSessionResult = betMode === "auto" && currentView === 2 && autoRoundsPlayed > 0 && !isAutoBetting;
    const isManualSessionComplete = betMode === "manual" && currentView === 2 && safePurchasedRoundsRemaining === 0;
    const modalPayout = isAutoSessionResult ? autoTotalPayout : isManualSessionComplete ? manualSessionTotalPayout : roundState.payout;
    const modalShowPnl = (modalPayout ?? 0) > betAmount;
    const endCardGamesCount = isAutoSessionResult ? autoRoundsPlayed : manualRoundsPlayed;
    const showEndCardGamesNote =
        currentView === 2 &&
        !isRewatching &&
        endCardGamesCount > 0 &&
        !(betMode === "manual" && safePurchasedRoundsRemaining > 0);
    const hasAnyAutoGuessRule =
        autoLowerOrSameRanks.length > 0 ||
        autoHigherOrSameRanks.length > 0 ||
        autoAceAction !== "skip" ||
        autoKingAction !== "skip";

    const resetTimers = (): void => {
        if (resolveTimeoutRef.current !== null) {
            clearTimeout(resolveTimeoutRef.current);
            resolveTimeoutRef.current = null;
        }
        if (autoActionTimeoutRef.current !== null) {
            clearTimeout(autoActionTimeoutRef.current);
            autoActionTimeoutRef.current = null;
        }
        if (replayTimeoutRef.current !== null) {
            clearTimeout(replayTimeoutRef.current);
            replayTimeoutRef.current = null;
        }
        if (revealTimeoutRef.current !== null) {
            clearTimeout(revealTimeoutRef.current);
            revealTimeoutRef.current = null;
        }
    };

    useEffect(() => {
        autoRoundsPlayedRef.current = autoRoundsPlayed;
    }, [autoRoundsPlayed]);

    useEffect(() => {
        remainingAutoBetsRef.current = remainingAutoBets;
    }, [remainingAutoBets]);

    useEffect(() => {
        purchasedRoundsRemainingRef.current = safePurchasedRoundsRemaining;
    }, [safePurchasedRoundsRemaining]);

    const finishRound = (roundPayout: number, text: string): void => {
        const cappedRoundPayout = Number(Math.min(roundPayout, maxPayoutPerGame).toFixed(2));
        const resultText =
            cappedRoundPayout < roundPayout
                ? `${text} Payout capped by house pool liquidity.`
                : text;

        if (isAutoBetting) {
            setAutoTotalPayout((prev) => Number((prev + cappedRoundPayout).toFixed(2)));
            setAutoRoundsPlayed((prev) => {
                const next = toSafeNonNegativeInt(prev, 0) + 1;
                autoRoundsPlayedRef.current = next;
                return next;
            });
            setRemainingAutoBets((prev) => {
                const next = Math.max(0, toSafeNonNegativeInt(prev, 0) - 1);
                remainingAutoBetsRef.current = next;
                return next;
            });
        } else {
            setManualSessionTotalPayout((prev) => Number((prev + cappedRoundPayout).toFixed(2)));
            setManualRoundsPlayed((prev) => toSafeNonNegativeInt(prev, 0) + 1);
        }

        setRoundState((prev) => ({
            ...prev,
            payout: cappedRoundPayout,
            lastPayout: cappedRoundPayout,
            resultText,
            isResolving: false,
        }));
        setCurrentView(2);
    };

    const createCardSequence = (randomWord: `0x${string}`, length = 512): Card[] => {
        return createDeckFromRandomWord(randomWord, length);
    };

    const requestRoundFromChain = async (): Promise<ChainRoundData> => {
        // Template/dev adapter: replace with Ape Church SDK calls when connecting live chain settlement.
        const useMockChain = process.env.NEXT_PUBLIC_APE_CHAIN_MODE !== "live";

        if (!useMockChain) {
            throw new Error("On-chain adapter not configured. Connect Ape Church round request/settlement APIs.");
        }

        const randomWord = bytesToHex(new Uint8Array(randomBytes(32))) as `0x${string}`;
        const roundId = BigInt(bytesToHex(new Uint8Array(randomBytes(32))));

        return {
            roundId,
            randomWord,
            houseEdge: clampHouseEdge(HOUSE_EDGE),
            maxPayout: DEFAULT_POOL_MAX_PAYOUT,
        };
    };

    const buyManualRounds = (): void => {
        const roundsToBuy = toSafePositiveInt(numberOfSpins, 1, MAX_BET_ROUNDS);
        const packageCost = Number((betAmount * roundsToBuy).toFixed(2));

        if (walletBalance < packageCost) {
            triggerWalletShake();
            setRoundState((prev) => ({
                ...prev,
                resultText: `Not enough balance to buy ${roundsToBuy} rounds.`,
            }));
            return;
        }

        setWalletBalance((prev) => Number((prev - packageCost).toFixed(2)));
        setPurchasedRoundsRemaining(roundsToBuy);
        setManualSessionTotalPayout(0);
        setManualRoundsPlayed(0);
        setCurrentView(0);
        setRoundState((prev) => ({
            ...prev,
            resultText: `Bought ${roundsToBuy} rounds. Click Deal First Card to start.`,
        }));
    };

    const handleManualPrimaryAction = (): void => {
        if (currentView === 1 || roundState.isLoading || roundState.isResolving) {
            return;
        }

        if (safePurchasedRoundsRemaining <= 0) {
            buyManualRounds();
            return;
        }

        void playGame();
    };

    const buyAutoRoundsForTarget = (): void => {
        const totalBets = toSafePositiveInt(autoBetCount, 1, MAX_BET_ROUNDS);
        const availableRounds = toSafeNonNegativeInt(safePurchasedRoundsRemaining, 0);
        const roundsToBuy = Math.max(0, totalBets - availableRounds);

        if (roundsToBuy <= 0) {
            setRoundState((prev) => ({
                ...prev,
                resultText: "You already have enough rounds to start autobet.",
            }));
            return;
        }

        const buyCost = Number((betAmount * roundsToBuy).toFixed(2));
        if (walletBalance < buyCost) {
            triggerWalletShake();
            setRoundState((prev) => ({
                ...prev,
                resultText: `Not enough balance to buy ${roundsToBuy} auto rounds.`,
            }));
            return;
        }

        setWalletBalance((prev) => Number((prev - buyCost).toFixed(2)));
        setPurchasedRoundsRemaining((prev) => toSafeNonNegativeInt(prev, 0) + roundsToBuy);
        setRoundState((prev) => ({
            ...prev,
            resultText: `Bought ${roundsToBuy} auto rounds for ${buyCost.toFixed(2)} APE.`,
        }));
    };

    const playGame = async (options?: {
        rewatch?: boolean;
        noPayment?: boolean;
        roundsPoolOverride?: number;
        roundsToBuyOverride?: number;
        skipLoadingDelay?: boolean;
    }) => {
        if (betAmount <= 0) {
            return;
        }

        setIsRewatching(false);
        setCurrentView(0);

        resetTimers();

        if (!options?.rewatch) {
            let roundsPool = toSafeNonNegativeInt(options?.roundsPoolOverride ?? safePurchasedRoundsRemaining, 0);

            if (!options?.noPayment) {
                if (roundsPool <= 0) {
                    setRoundState((prev) => ({
                        ...prev,
                        resultText: "Buy rounds before dealing.",
                    }));
                    return;
                }
            } else if (roundsPool <= 0) {
                setRoundState((prev) => ({
                    ...prev,
                    resultText: "No purchased rounds left.",
                }));
                return;
            }

            setPurchasedRoundsRemaining(Math.max(0, toSafeNonNegativeInt(roundsPool, 0) - 1));
            console.log("Mock tx submitted for gameId:", currentGameId.toString());
        }

        let randomWordForRound: `0x${string}`;

        if (options?.rewatch) {
            if (!lastRoundRandomWordRef.current) {
                setRoundState((prev) => ({
                    ...prev,
                    resultText: "No prior on-chain random result available for rewatch.",
                }));
                return;
            }
            randomWordForRound = lastRoundRandomWordRef.current;
        } else {
            try {
                const chainRound = await requestRoundFromChain();
                randomWordForRound = chainRound.randomWord;
                lastRoundRandomWordRef.current = randomWordForRound;
                setCurrentGameId(chainRound.roundId);
                setChainHouseEdge(clampHouseEdge(chainRound.houseEdge));
                setMaxPayoutPerGame(Number(Math.max(1, chainRound.maxPayout).toFixed(2)));
            } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to retrieve on-chain randomness.";
                setRoundState((prev) => ({
                    ...prev,
                    resultText: message,
                    isLoading: false,
                }));
                return;
            }
        }

        const cardSequence =
            options?.rewatch && lastRoundDeckRef.current
                ? [...lastRoundDeckRef.current]
                : createCardSequence(randomWordForRound);

        if (!options?.rewatch) {
            lastRoundDeckRef.current = [...cardSequence];
        }

        const first = cardSequence.shift() ?? null;

        setRoundState((prev) => ({
            ...prev,
            deck: [],
            currentCard: null,
            revealedCard: null,
            currentMultiplier: 1,
            payout: null,
            lastGuess: null,
            resultText: "Dealing cards...",
            isLoading: !options?.skipLoadingDelay,
            isResolving: false,
            history: [],
        }));

        const dealDelay = options?.skipLoadingDelay ? 0 : 320;
        setTimeout(() => {
            setRoundState((prev) => ({
                ...prev,
                currentCard: first,
                deck: cardSequence,
                isLoading: false,
                resultText: "",
                history: first
                    ? [{ card: first, multiplier: 1, isStart: true, outcome: "start" }]
                    : [],
            }));
            setCurrentView(1);
        }, dealDelay);
    };

    const startAutobet = (overrideBetCount?: number): void => {
        if (isAutoBetting || betAmount <= 0) return;

        setShowStoppedAutoSummary(false);

        if (!hasAnyAutoGuessRule) {
            setRoundState((prev) => ({
                ...prev,
                resultText: "Select at least one Higher/Same or Lower/Same rule before starting autobet.",
            }));
            return;
        }

        const totalBets = toSafePositiveInt(overrideBetCount ?? autoBetCount, 1, MAX_BET_ROUNDS);
        const availableRounds = toSafeNonNegativeInt(safePurchasedRoundsRemaining, 0);
        if (availableRounds < totalBets) {
            setRoundState((prev) => ({
                ...prev,
                resultText: "Buy enough rounds to cover your selected auto bets.",
            }));
            return;
        }

        const preparedRoundsPool = toSafeNonNegativeInt(availableRounds, totalBets);
        lastAutoSessionBetCountRef.current = totalBets;
        autoSessionTargetBetsRef.current = totalBets;
        setPurchasedRoundsRemaining(preparedRoundsPool);
        setAutoTotalPayout(0);
        setAutoRoundsPlayed(0);
        autoRoundsPlayedRef.current = 0;
        // Reset view to 0 before setting isAutoBetting so the auto-trigger useEffect
        // (which fires on currentView === 2) cannot see the old finished-game view
        // and launch a phantom extra game.
        setCurrentView(0);
        setIsAutoBetting(true);
        setRemainingAutoBets(toSafeNonNegativeInt(totalBets, 1));
        remainingAutoBetsRef.current = totalBets;
        void playGame({ noPayment: true, roundsPoolOverride: preparedRoundsPool });
    };

    const resumeAutobet = (): void => {
        if (isAutoBetting || !showStoppedAutoSummary) return;

        if (toSafeNonNegativeInt(remainingAutoBets, 0) <= 0) {
            setRoundState((prev) => ({
                ...prev,
                resultText: "No auto bets left to resume.",
            }));
            return;
        }

        // Game ended and view landed on 2 — set isAutoBetting and let the existing
        // view-2 useEffect fire (after render, with correct closure) to launch next game.
        if (currentView === 2) {
            setShowStoppedAutoSummary(false);
            setIsAutoBetting(true);
            return;
        }

        // Mid-round at view 1 — true resume from current card position.
        if (currentView === 1 && roundState.currentCard && !roundState.isLoading) {
            setShowStoppedAutoSummary(false);
            setIsAutoBetting(true);
            setRoundState((prev) => ({
                ...prev,
                isResolving: false,
                resultText: "Autobet resumed.",
            }));
            return;
        }

        // View 0 or any other state — fall back to starting a fresh auto session
        // with the remaining bets count.
        setShowStoppedAutoSummary(false);
        startAutobet(toSafePositiveInt(remainingAutoBets, 1, MAX_BET_ROUNDS));
    };

    const stopAutobet = (): void => {
        if (resolveTimeoutRef.current !== null) {
            clearTimeout(resolveTimeoutRef.current);
            resolveTimeoutRef.current = null;
        }
        if (autoActionTimeoutRef.current !== null) {
            clearTimeout(autoActionTimeoutRef.current);
            autoActionTimeoutRef.current = null;
        }

        setIsAutoBetting(false);
        setShowStoppedAutoSummary(true);
        setRoundState((prev) => ({
            ...prev,
            isResolving: false,
            resultText: prev.currentCard ? "Autobet stopped." : prev.resultText,
        }));
    };

    const handleCashOut = (): void => {
        if (!canCashOut) return;
        if (!isSfxMuted && cashoutSfxRef.current) {
            cashoutSfxRef.current.currentTime = 0;
            void cashoutSfxRef.current.play().catch(() => {});
        }
        const amount = Number(Math.min(betAmount * roundState.currentMultiplier, maxPayoutPerGame).toFixed(2));
        finishRound(amount, `Cashed out at ${roundState.currentMultiplier.toFixed(2)}x.`);
    };

    const handleStateAdvance = (direction: GuessDirection): void => {
        if (!canGuess || !roundState.currentCard) return;

        if (revealTimeoutRef.current !== null) {
            clearTimeout(revealTimeoutRef.current);
            revealTimeoutRef.current = null;
        }

        const currentRank = roundState.currentCard.rank;
        const nextCard = roundState.deck[0];
        if (!nextCard) return;
        const remainingDeck = roundState.deck.slice(1);
        const outs = getOutsForDirection(currentRank, direction);
        const stepMultiplier = getStepMultiplier(outs, TOTAL_RANKS, houseEdge);
        const nextMultiplier = Number((roundState.currentMultiplier * stepMultiplier).toFixed(2));

        const didWin =
            direction === "same"
                ? nextCard.rank === currentRank
                : direction === "higher"
                    ? currentRank === 1
                        ? nextCard.rank > currentRank
                        : nextCard.rank >= currentRank
                    : currentRank === TOTAL_RANKS
                        ? nextCard.rank < currentRank
                        : nextCard.rank <= currentRank;

        setRoundState((prev) => ({
            ...prev,
            isResolving: true,
            lastGuess: direction,
            revealedCard: null,
            history: [
                ...prev.history,
                {
                    card: nextCard,
                    multiplier: nextMultiplier,
                    isStart: false,
                    outcome: didWin ? "win" : "loss",
                },
            ],
        }));

        revealTimeoutRef.current = setTimeout(() => {
            setRoundState((prev) => ({
                ...prev,
                revealedCard: nextCard,
            }));
            revealTimeoutRef.current = null;
        }, BIG_CARD_REVEAL_DELAY_MS);

        if (!didWin && !isSfxMuted && loseSfxRef.current) {
            loseSfxRef.current.currentTime = 0;
            void loseSfxRef.current.play().catch(() => {});
        }

        const resolveDelay = isAutoBetting
            ? AUTO_RESOLVE_DELAY_MS
            : didWin
                ? MANUAL_RESOLVE_DELAY_MS
                : MANUAL_LOSS_RESOLVE_DELAY_MS;
        resolveTimeoutRef.current = setTimeout(() => {
            if (!didWin) {
                finishRound(0, "Wrong call. You lost this round.");
                return;
            }

            setRoundState((prev) => ({
                ...prev,
                currentCard: nextCard,
                deck: remainingDeck,
                currentMultiplier: nextMultiplier,
                revealedCard: null,
                isResolving: false,
                resultText: "",
            }));
        }, resolveDelay);
    };

    const handleSkipCard = (): void => {
        if (!canSkip || !roundState.currentCard) return;

        if (revealTimeoutRef.current !== null) {
            clearTimeout(revealTimeoutRef.current);
            revealTimeoutRef.current = null;
        }

        const nextCard = roundState.deck[0];
        if (!nextCard) return;
        const remainingDeck = roundState.deck.slice(1);
        const currentMultiplier = roundState.currentMultiplier;

        setRoundState((prev) => ({
            ...prev,
            isResolving: true,
            revealedCard: null,
            history: [
                ...prev.history,
                {
                    card: nextCard,
                    multiplier: currentMultiplier,
                    isStart: false,
                    outcome: "skip",
                },
            ],
        }));

        revealTimeoutRef.current = setTimeout(() => {
            setRoundState((prev) => ({
                ...prev,
                revealedCard: nextCard,
            }));
            revealTimeoutRef.current = null;
        }, BIG_CARD_REVEAL_DELAY_MS);

        const resolveDelay = isAutoBetting ? AUTO_RESOLVE_DELAY_MS : MANUAL_RESOLVE_DELAY_MS;
        resolveTimeoutRef.current = setTimeout(() => {
            setRoundState((prev) => ({
                ...prev,
                currentCard: nextCard,
                deck: remainingDeck,
                revealedCard: null,
                isResolving: false,
                resultText: "",
            }));
        }, resolveDelay);
    };

    const handleBetModeChange = (mode: "manual" | "auto"): void => {
        if (mode === betMode) return;
        // Stop any running auto session
        if (isAutoBetting) {
            resetTimers();
            setIsAutoBetting(false);
            setRemainingAutoBets(0);
        }
        // Clear current game view back to setup
        resetTimers();
        setCurrentView(0);
        setRoundState(INITIAL_ROUND_STATE);
        setShowStoppedAutoSummary(false);
        setBetMode(mode);
    };

    const handleReset = (options?: { keepPackage?: boolean; keepAuto?: boolean; preserveSessionConfig?: boolean }): void => {
        resetTimers();
        autoSessionTargetBetsRef.current = 0;

        setCurrentGameId(BigInt(bytesToHex(new Uint8Array(randomBytes(32)))));
        setCurrentView(0);
        if (!options?.preserveSessionConfig) {
            setBetAmount(1);
            setNumberOfSpins(1);
            setBetMode("manual");
            setAutoBetCount(1);
            setAutoLowerOrSameRanks([]);
            setAutoHigherOrSameRanks([]);
            setAutoSkipRanks([]);
            setAutoAceAction("skip");
            setAutoKingAction("skip");
            setAutoCashoutMultiplier(2);
        }
        setAutoTotalPayout(0);
        setAutoRoundsPlayed(0);
        setChainHouseEdge(clampHouseEdge(HOUSE_EDGE));
        setMaxPayoutPerGame(DEFAULT_POOL_MAX_PAYOUT);
        setIsRewatching(false);
        setRoundState(INITIAL_ROUND_STATE);
        setShowStoppedAutoSummary(false);
        lastRoundDeckRef.current = null;
        lastRoundRandomWordRef.current = null;
        if (!options?.keepPackage) {
            setWalletBalance(25);
        }
        if (!options?.keepPackage) {
            setPurchasedRoundsRemaining(0);
        }
        setManualSessionTotalPayout(0);
        setManualRoundsPlayed(0);
        if (!options?.keepAuto) {
            setIsAutoBetting(false);
            setRemainingAutoBets(0);
            remainingAutoBetsRef.current = 0;
            autoRoundsPlayedRef.current = 0;
        }
    };

    const handleResultReset = (): void => {
        const shouldMinimizeOnly =
            betMode === "manual" &&
            currentView === 2 &&
            safePurchasedRoundsRemaining > 0;

        if (shouldMinimizeOnly) {
            const backdrop = document.querySelector(".absolute.inset-0.z-20") as HTMLElement | null;
            backdrop?.click();
            return;
        }

        if (betMode === "auto") {
            handleReset({ preserveSessionConfig: true });
            return;
        }

        handleReset();
    };

    const handlePlayAgain = (): void => {
        const shouldRestartAutoSession =
            currentView === 2 &&
            autoRoundsPlayed > 0 &&
            !isAutoBetting &&
            lastAutoSessionBetCountRef.current > 0;
        const replayAutoBetCount = toSafePositiveInt(lastAutoSessionBetCountRef.current, 1, MAX_BET_ROUNDS);

        if (shouldRestartAutoSession) {
            handleReset({ keepPackage: true, keepAuto: false, preserveSessionConfig: true });
            setCurrentGameId(BigInt(bytesToHex(new Uint8Array(randomBytes(32)))));
            setBetMode("auto");
            setAutoBetCount(replayAutoBetCount);
            window.setTimeout(() => {
                startAutobet(replayAutoBetCount);
            }, 0);
            return;
        }

        const isReplayingCompletedManualSession =
            betMode === "manual" &&
            currentView === 2 &&
            safePurchasedRoundsRemaining === 0 &&
            manualRoundsPlayed > 0;

        const desiredManualRounds = isReplayingCompletedManualSession
            ? toSafePositiveInt(manualRoundsPlayed, 1, MAX_BET_ROUNDS)
            : toSafePositiveInt(numberOfSpins, 1, MAX_BET_ROUNDS);
        const roundsToBuyOverride = desiredManualRounds;

        if (isReplayingCompletedManualSession) {
            setNumberOfSpins(desiredManualRounds);
        }

        handleReset({ keepPackage: true, keepAuto: false, preserveSessionConfig: true });
        setCurrentGameId(BigInt(bytesToHex(new Uint8Array(randomBytes(32)))));
        void playGame({ roundsToBuyOverride });
    };

    const handleRewatch = (): void => {
        const replayRound = lastFinishedRoundRef.current;
        const replayHistory = replayRound?.history ?? [];
        if (!replayRound || replayHistory.length === 0) return;

        const startEntry = replayHistory[0];
        handleReset({ keepPackage: true, keepAuto: false });

        setIsRewatching(true);

        setRoundState((prev) => ({
            ...prev,
            deck: [],
            currentCard: startEntry.card,
            revealedCard: null,
            currentMultiplier: 1,
            payout: null,
            lastPayout: replayRound.lastPayout,
            lastGuess: null,
            resultText: "Rewatching last round...",
            isLoading: false,
            isResolving: false,
            history: [startEntry],
        }));
        setCurrentView(1);

        let cursor = 1;

        const REWATCH_REVEAL_MS = 500;
        const REWATCH_STEP_MS = 900;

        const runReplayStep = () => {
            if (cursor >= replayHistory.length) {
                setRoundState(replayRound);
                setCurrentView(2);
                replayTimeoutRef.current = null;
                return;
            }

            const entry = replayHistory[cursor];
            cursor += 1;

            // Phase 1: reveal the new card on the big card slot
            setRoundState((prev) => {
                const nh = [...prev.history, entry];
                return {
                    ...prev,
                    revealedCard: entry.card,
                    history: nh,
                };
            });

            if (entry.outcome === "loss") {
                // Loss: stay on revealed card, then advance to next step
                replayTimeoutRef.current = setTimeout(runReplayStep, REWATCH_STEP_MS);
            } else {
                // Win: after reveal delay, promote to currentCard then schedule next step
                replayTimeoutRef.current = setTimeout(() => {
                    setRoundState((prev) => ({
                        ...prev,
                        currentCard: entry.card,
                        revealedCard: null,
                        currentMultiplier: entry.multiplier,
                    }));
                    replayTimeoutRef.current = setTimeout(runReplayStep, REWATCH_STEP_MS - REWATCH_REVEAL_MS);
                }, REWATCH_REVEAL_MS);
            }
        };

        replayTimeoutRef.current = setTimeout(runReplayStep, 500);
    };

    useEffect(() => {
        if (isRewatching || currentView !== 2 || roundState.payout === null) {
            return;
        }

        // Persist the exact finished state currently shown to the player for rewatch.
        lastFinishedRoundRef.current = {
            ...roundState,
            deck: [...roundState.deck],
            history: [...roundState.history],
        };
    }, [isRewatching, currentView, roundState]);

    useEffect(() => {
        if (
            isRewatching ||
            currentView !== 1 ||
            roundState.isLoading ||
            roundState.isResolving ||
            !roundState.currentCard ||
            roundState.deck.length > 0
        ) {
            return;
        }

        const amount = Number(Math.min(betAmount * roundState.currentMultiplier, maxPayoutPerGame).toFixed(2));
        finishRound(
            amount,
            `All cards used. Auto-cashed out at ${roundState.currentMultiplier.toFixed(2)}x.`
        );
    }, [
        isRewatching,
        currentView,
        roundState.isLoading,
        roundState.isResolving,
        roundState.currentCard,
        roundState.deck.length,
        roundState.currentMultiplier,
        betAmount,
        maxPayoutPerGame,
    ]);

    useEffect(() => {
        if (!isAutoBetting || currentView !== 1 || roundState.isLoading || roundState.isResolving) {
            return;
        }

        const currentRank = roundState.currentCard?.rank ?? 0;

        if (canCashOut && roundState.currentMultiplier >= autoCashoutMultiplier) {
            autoActionTimeoutRef.current = setTimeout(() => {
                handleCashOut();
            }, AUTO_ACTION_DELAY_MS);
        } else if (canSkip && autoSkipRanks.includes(currentRank)) {
            autoActionTimeoutRef.current = setTimeout(() => {
                handleSkipCard();
            }, AUTO_ACTION_DELAY_MS);
        } else if (canGuess && roundState.currentCard) {
            autoActionTimeoutRef.current = setTimeout(() => {
                if (currentRank === 1) {
                    if (autoAceAction === "higher") {
                        handleStateAdvance("higher");
                        return;
                    }
                    if (autoAceAction === "same") {
                        handleStateAdvance("same");
                        return;
                    }
                    if (canSkip) {
                        handleSkipCard();
                    }
                    return;
                }

                if (currentRank === TOTAL_RANKS) {
                    if (autoKingAction === "lower") {
                        handleStateAdvance("lower");
                        return;
                    }
                    if (autoKingAction === "same") {
                        handleStateAdvance("same");
                        return;
                    }
                    if (canSkip) {
                        handleSkipCard();
                    }
                    return;
                }

                const prefersLower = autoLowerOrSameRanks.includes(currentRank);
                const prefersHigher = autoHigherOrSameRanks.includes(currentRank);

                if (prefersLower && !prefersHigher) {
                    handleStateAdvance("lower");
                    return;
                }

                if (prefersHigher && !prefersLower) {
                    handleStateAdvance("higher");
                    return;
                }

                // Strictly follow configured rules: if no guess rule is set for this rank, skip it.
                if (canSkip) {
                    handleSkipCard();
                }
            }, AUTO_ACTION_DELAY_MS);
        }

        return () => {
            if (autoActionTimeoutRef.current !== null) {
                clearTimeout(autoActionTimeoutRef.current);
                autoActionTimeoutRef.current = null;
            }
        };
    }, [
        isAutoBetting,
        currentView,
        roundState.isLoading,
        roundState.isResolving,
        roundState.currentCard,
        canGuess,
        canCashOut,
        outcomes.higher,
        outcomes.lower,
        canSkip,
        autoCashoutMultiplier,
        autoSkipRanks,
        autoLowerOrSameRanks,
        autoHigherOrSameRanks,
        autoAceAction,
        autoKingAction,
        hasAnyAutoGuessRule,
    ]);

    useEffect(() => {
        if (!isAutoBetting || currentView !== 2) {
            return;
        }

        const targetBets = autoSessionTargetBetsRef.current;
        const reachedTarget = targetBets > 0 && autoRoundsPlayed >= targetBets;

        if (toSafeNonNegativeInt(remainingAutoBets, 0) <= 0 || reachedTarget) {
            autoSessionTargetBetsRef.current = 0;
            setIsAutoBetting(false);
            setRemainingAutoBets(0);
            return;
        }

        autoActionTimeoutRef.current = setTimeout(() => {
            const latestTarget = autoSessionTargetBetsRef.current;
            const latestPlayed = autoRoundsPlayedRef.current;
            const latestRemaining = remainingAutoBetsRef.current;
            const latestPurchasedRounds = purchasedRoundsRemainingRef.current;
            const latestReachedTarget = latestTarget > 0 && toSafeNonNegativeInt(latestPlayed, 0) >= latestTarget;
            if (toSafeNonNegativeInt(latestRemaining, 0) <= 0 || latestReachedTarget) {
                return;
            }
            void playGame({
                noPayment: true,
                roundsPoolOverride: toSafeNonNegativeInt(latestPurchasedRounds, 0),
            });
        }, AUTO_NEXT_ROUND_DELAY_MS);

        return () => {
            if (autoActionTimeoutRef.current !== null) {
                clearTimeout(autoActionTimeoutRef.current);
                autoActionTimeoutRef.current = null;
            }
        };
    }, [isAutoBetting, currentView, remainingAutoBets, autoRoundsPlayed]);

    return (
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 lg:gap-10">
            <GameWindow
                game={game}
                currentGameId={currentGameId}
                isLoading={roundState.isLoading && betMode === "auto"}
                isGameFinished={
                    currentView === 2 &&
                    !isRewatching
                }
                onPlayAgain={handlePlayAgain}
                playAgainText="Play Again"
                onReset={handleResultReset}
                onRewatch={handleRewatch}
                betAmount={betAmount}
                payout={modalPayout}
                inReplayMode={replayId !== null || isRewatching}
                isUserOriginalPlayer
                showPNL={modalShowPnl}
                isGamePaused={false}
                resultModalDelayMs={250}
                disableBuiltInSong
                onMusicMutedChange={setIsMusicMuted}
                onSfxMutedChange={setIsSfxMuted}
            >
                <MyGameWindow
                    currentCard={roundState.currentCard}
                    revealedCard={roundState.revealedCard}
                    isSfxMuted={isSfxMuted}
                    isAutoBetting={isAutoBetting}
                    betAmount={betAmount}
                    history={roundState.history}
                    currentMultiplier={roundState.currentMultiplier}
                    higherOuts={outcomes.higher}
                    lowerOuts={outcomes.lower}
                    equalOuts={outcomes.equal}
                    higherMultiplier={higherMultiplier}
                    lowerMultiplier={lowerMultiplier}
                    sameMultiplier={sameMultiplier}
                    canGuess={canGuess}
                    canCashOut={canCashOut}
                    canSkip={canSkip}
                    canDeal={canDeal}
                    isRoundActive={currentView === 1}
                    onGuess={handleStateAdvance}
                    onSkip={handleSkipCard}
                    onCashOut={handleCashOut}
                    onDeal={() => void playGame()}
                    showMiniResult={betMode === "manual" && currentView === 2 && safePurchasedRoundsRemaining > 0}
                    miniResultPayout={roundState.payout}
                    miniResultText={roundState.resultText}
                    roundsLeft={safePurchasedRoundsRemaining}
                    onPlayAgain={handlePlayAgain}
                    showEndCardGamesNote={showEndCardGamesNote}
                    endCardGamesCount={endCardGamesCount}
                />
            </GameWindow>

            <MyGameSetupCard
                currentView={currentView}
                betAmount={betAmount}
                setBetAmount={hasActivePackage ? () => {} : setBetAmount}
                numberOfSpins={numberOfSpins}
                setNumberOfSpins={setNumberOfSpins}
                betMode={betMode}
                setBetMode={handleBetModeChange}
                autoBetCount={autoBetCount}
                setAutoBetCount={setAutoBetCount}
                isAutoBetting={isAutoBetting}
                showStoppedAutoSummary={showStoppedAutoSummary}
                remainingAutoBets={remainingAutoBets}
                autoLowerOrSameRanks={autoLowerOrSameRanks}
                setAutoLowerOrSameRanks={setAutoLowerOrSameRanks}
                autoHigherOrSameRanks={autoHigherOrSameRanks}
                setAutoHigherOrSameRanks={setAutoHigherOrSameRanks}
                autoSkipRanks={autoSkipRanks}
                setAutoSkipRanks={setAutoSkipRanks}
                autoAceAction={autoAceAction}
                setAutoAceAction={setAutoAceAction}
                autoKingAction={autoKingAction}
                setAutoKingAction={setAutoKingAction}
                autoCashoutMultiplier={autoCashoutMultiplier}
                setAutoCashoutMultiplier={setAutoCashoutMultiplier}
                hasActivePackage={hasActivePackage}
                packageLocked={packageLocked}
                manualRoundsRemaining={manualRoundsRemaining}
                manualRoundsPlayed={manualRoundsPlayed}
                payoutCardTitle="Current Payout"
                payoutCardValue={currentPayout}
                autoTotalPayout={autoTotalPayout}
                autoRoundsPlayed={autoRoundsPlayed}
                onStart={handleManualPrimaryAction}
                onStartAutobet={() => startAutobet()}
                onResumeAutobet={resumeAutobet}
                onBuyAutoRounds={buyAutoRoundsForTarget}
                onStopAutobet={stopAutobet}
                isLoading={roundState.isLoading}
                isResolving={roundState.isResolving}
                walletBalance={walletBalance}
                walletShake={walletShake}
                maxPayoutPerGame={maxPayoutPerGame}
                canStartAutobet={hasAnyAutoGuessRule}
                autoNeedsRounds={toSafeNonNegativeInt(autoBetCount, 1) > safePurchasedRoundsRemaining}
            />
        </div>
    );
};

export default MyGame;
