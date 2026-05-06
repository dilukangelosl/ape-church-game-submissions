"use client";


import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import GameWindow from "@/components/shared/GameWindow";
import MinesWindow from "./minesWindow";
import MinesSetupCard from "./minesSetupCard";
import { bytesToHex } from "viem";
import { randomBytes, Game } from "@/lib/games";
import "./mines.style.css";
import {
    HOUSE_EDGE,
    BOARD_TILE_COUNT,
    DEFAULT_MINE_COUNT,
    MIN_MINE_COUNT,
    MAX_MINE_COUNT,
    createMinePositions,
    getMinesMultiplier,
    getSafeTileCount,
} from "./minesConfig";
import { myGame } from "../minefield-path/myGameConfig";

interface MinesRoundState {
    minePositions: number[];
    revealedTiles: number[];
    explodedMine: number | null;
    currentMultiplier: number;
    payout: number | null;
    lastPayout: number | null;
    resultText: string;
    isLoading: boolean;
}

const INITIAL_ROUND_STATE: MinesRoundState = {
    minePositions: [],
    revealedTiles: [],
    explodedMine: null,
    currentMultiplier: 1,
    payout: null,
    lastPayout: null,
    resultText: "Place your bet and press Deal.",
    isLoading: false,
};

const HOUSE_EDGE_MIN = 0.9;
const HOUSE_EDGE_MAX = 0.9999;
const DEFAULT_POOL_MAX_PAYOUT = 10000;
const MAX_BET_ROUNDS = 99000;
const BACKGROUND_MUSIC_VOLUME = 0.25;
const AUTO_ACTION_DELAY_MS = 90;
const AUTO_NEXT_ROUND_DELAY_MS = 220;
const MANUAL_REVEAL_DELAY_MS = 300;
const MANUAL_MINE_REVEAL_ALL_DELAY_MS = 380;
const MANUAL_MINE_FINISH_DELAY_MS = 1700;
const DIAMOND_SFX_POOL_SIZE = 6;

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

const Mines: React.FC = () => {
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
    const [mineCount, setMineCount] = useState(DEFAULT_MINE_COUNT);
    const [autoBetCount, setAutoBetCount] = useState(1);
    const [isAutoBetting, setIsAutoBetting] = useState(false);
    const [remainingAutoBets, setRemainingAutoBets] = useState(0);
    const [autoTotalPayout, setAutoTotalPayout] = useState(0);
    const [autoRoundsPlayed, setAutoRoundsPlayed] = useState(0);
    const [showStoppedAutoSummary, setShowStoppedAutoSummary] = useState(false);
    const [autoSelectedTiles, setAutoSelectedTiles] = useState<number[]>([]);
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
    const [roundState, setRoundState] = useState<MinesRoundState>(INITIAL_ROUND_STATE);
    const [pendingManualRevealTiles, setPendingManualRevealTiles] = useState<number[]>([]);
    const [manualShowAllAfterMine, setManualShowAllAfterMine] = useState(false);
    const [isRewatching, setIsRewatching] = useState(false);
    const [forceExpandedReplayEndCard, setForceExpandedReplayEndCard] = useState(false);
    const [isSfxMuted, setIsSfxMuted] = useState(false);
    const [isMusicMuted, setIsMusicMuted] = useState(false);
    const [chainHouseEdge, setChainHouseEdge] = useState(() => clampHouseEdge(HOUSE_EDGE));
    const [maxPayoutPerGame, setMaxPayoutPerGame] = useState(DEFAULT_POOL_MAX_PAYOUT);
    const resolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const revealAllAfterMineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoActionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const replayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const manualRevealTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
    const roundStateRef = useRef(roundState);
    const pendingManualRevealTilesRef = useRef<number[]>([]);
    const manualClickOrderRef = useRef<Record<number, number>>({});
    const manualClickCounterRef = useRef(0);
    const lastRoundRandomWordRef = useRef<`0x${string}` | null>(null);
    const lastFinishedRoundRef = useRef<MinesRoundState | null>(null);
    const lastRevealOrderRef = useRef<number[]>([]);
    const lastGameMineCountRef = useRef<number>(DEFAULT_MINE_COUNT);
    const replaySequenceTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const lastAutoSessionBetCountRef = useRef(1);
    const autoSessionTargetBetsRef = useRef(0);
    const autoRoundsPlayedRef = useRef(0);
    const remainingAutoBetsRef = useRef(0);
    const purchasedRoundsRemainingRef = useRef(0);
    const cashoutSfxRef = useRef<HTMLAudioElement | null>(null);
    const diamondSfxPoolRef = useRef<HTMLAudioElement[]>([]);
    const loseSfxRef = useRef<HTMLAudioElement | null>(null);
    const loseBombSfxRef = useRef<HTMLAudioElement | null>(null);
    const notEnoughSfxRef = useRef<HTMLAudioElement | null>(null);
    const autoTileSelectSfxRef = useRef<HTMLAudioElement | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const bgmGainRef = useRef<GainNode | null>(null);

    useEffect(() => {
        const audio = new Audio("/submissions/mines/sfx/win_v2.mp3");
        audio.preload = "auto";
        cashoutSfxRef.current = audio;
        return () => {
            audio.pause();
            cashoutSfxRef.current = null;
        };
    }, []);

    useEffect(() => {
        const pool = Array.from({ length: DIAMOND_SFX_POOL_SIZE }, () => {
            const audio = new Audio("/submissions/mines/sfx/diamond.mp3");
            audio.preload = "auto";
            return audio;
        });
        diamondSfxPoolRef.current = pool;
        return () => {
            diamondSfxPoolRef.current.forEach((audio) => audio.pause());
            diamondSfxPoolRef.current = [];
        };
    }, []);

    useEffect(() => {
        const audio = new Audio("/submissions/mines/sfx/lose_v2.mp3");
        audio.preload = "auto";
        loseSfxRef.current = audio;
        return () => {
            audio.pause();
            loseSfxRef.current = null;
        };
    }, []);

    useEffect(() => {
        const audio = new Audio("/submissions/mines/sfx/lose_bomb.mp3");
        audio.preload = "auto";
        loseBombSfxRef.current = audio;
        return () => {
            audio.pause();
            loseBombSfxRef.current = null;
        };
    }, []);

    useEffect(() => {
        const audio = new Audio("/submissions/mines/sfx/not_enough.mp3");
        audio.preload = "auto";
        notEnoughSfxRef.current = audio;
        return () => {
            audio.pause();
            notEnoughSfxRef.current = null;
        };
    }, []);

    useEffect(() => {
        const audio = new Audio("/submissions/mines/sfx/select_auto_tiles.mp3");
        audio.preload = "auto";
        audio.volume = 0.8;
        autoTileSelectSfxRef.current = audio;
        return () => {
            audio.pause();
            autoTileSelectSfxRef.current = null;
        };
    }, []);

    useEffect(() => {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const gain = ctx.createGain();
        gain.gain.value = isMusicMuted ? 0 : BACKGROUND_MUSIC_VOLUME;
        gain.connect(ctx.destination);
        bgmGainRef.current = gain;

        void fetch("/submissions/mines/audio/song.mp3")
            .then((r) => r.arrayBuffer())
            .then((buf) => ctx.decodeAudioData(buf))
            .then((decoded) => {
                if (audioCtxRef.current !== ctx) return;
                const source = ctx.createBufferSource();
                source.buffer = decoded;
                source.loop = true;
                source.connect(gain);
                source.start(0);
            })
            .catch(() => {});

        return () => {
            void ctx.close();
            audioCtxRef.current = null;
            bgmGainRef.current = null;
        };
    }, []);

    useEffect(() => {
        const gain = bgmGainRef.current;
        const ctx = audioCtxRef.current;
        if (!gain) return;

        gain.gain.value = isMusicMuted ? 0 : BACKGROUND_MUSIC_VOLUME;
        if (!isMusicMuted && ctx && ctx.state === "suspended") {
            void ctx.resume();
        }
    }, [isMusicMuted]);

    const houseEdge = clampHouseEdge(chainHouseEdge);

    const playDiamondSfx = (): void => {
        if (isSfxMuted || diamondSfxPoolRef.current.length === 0) return;
        const audio = diamondSfxPoolRef.current[0].cloneNode() as HTMLAudioElement;
        void audio.play().catch(() => {});
    };

    const safePurchasedRoundsRemaining = toSafeNonNegativeInt(purchasedRoundsRemaining, 0);
    const canReveal =
        currentView === 1 &&
        !isRewatching &&
        !roundState.isLoading &&
        roundState.explodedMine === null &&
        roundState.minePositions.length > 0;
    const canCashOut =
        currentView === 1 &&
        !isRewatching &&
        !roundState.isLoading &&
        pendingManualRevealTiles.length === 0 &&
        roundState.revealedTiles.length > 0 &&
        roundState.explodedMine === null;
    const canDeal =
        betMode === "manual" &&
        currentView !== 1 &&
        !isRewatching &&
        !roundState.isLoading &&
        safePurchasedRoundsRemaining > 0;
    const hasActivePackage = safePurchasedRoundsRemaining > 0;
    const packageLocked = roundState.isLoading || currentView === 1 || hasActivePackage;
    const isAutoSelectionMode =
        betMode === "auto" &&
        currentView !== 1 &&
        !isAutoBetting &&
        !showStoppedAutoSummary &&
        !isRewatching;
    const manualRoundsRemaining = safePurchasedRoundsRemaining;
    const currentPayout = Number(
        (Math.min(currentView === 1 ? betAmount * roundState.currentMultiplier : roundState.payout ?? 0, maxPayoutPerGame)).toFixed(2)
    );
    const isAutoSessionResult = betMode === "auto" && currentView === 2 && autoRoundsPlayed > 0 && !isAutoBetting && !forceExpandedReplayEndCard;
    const isManualSessionComplete = betMode === "manual" && currentView === 2 && safePurchasedRoundsRemaining === 0;
    const revealAllAutoTiles =
        betMode === "auto" &&
        ((currentView === 1 && (roundState.revealedTiles.length > 0 || roundState.explodedMine !== null)) || currentView === 2);
    const revealAllManualTiles =
        betMode === "manual" &&
        ((currentView === 1 && manualShowAllAfterMine) ||
            (currentView === 2 && (roundState.explodedMine !== null || roundState.payout !== null)));
    const revealAllTiles = revealAllAutoTiles || revealAllManualTiles;
    const modalPayout = isAutoSessionResult ? autoTotalPayout : isManualSessionComplete ? manualSessionTotalPayout : roundState.payout;
    const modalShowPnl = (modalPayout ?? 0) > betAmount;
    const endCardGamesCount = isAutoSessionResult ? autoRoundsPlayed : manualRoundsPlayed;
    const showEndCardGamesNote =
        currentView === 2 &&
        !isRewatching &&
        endCardGamesCount > 0 &&
        !(betMode === "manual" && safePurchasedRoundsRemaining > 0);

    const resetTimers = (): void => {
        if (resolveTimeoutRef.current !== null) {
            clearTimeout(resolveTimeoutRef.current);
            resolveTimeoutRef.current = null;
        }
        if (autoActionTimeoutRef.current !== null) {
            clearTimeout(autoActionTimeoutRef.current);
            autoActionTimeoutRef.current = null;
        }
        if (revealAllAfterMineTimeoutRef.current !== null) {
            clearTimeout(revealAllAfterMineTimeoutRef.current);
            revealAllAfterMineTimeoutRef.current = null;
        }
        if (replayTimeoutRef.current !== null) {
            clearTimeout(replayTimeoutRef.current);
            replayTimeoutRef.current = null;
        }
        if (replaySequenceTimeoutsRef.current.length > 0) {
            replaySequenceTimeoutsRef.current.forEach((id) => clearTimeout(id));
            replaySequenceTimeoutsRef.current = [];
        }
        if (manualRevealTimeoutsRef.current.length > 0) {
            manualRevealTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
            manualRevealTimeoutsRef.current = [];
        }
        manualClickOrderRef.current = {};
        manualClickCounterRef.current = 0;
        setManualShowAllAfterMine(false);
        setPendingManualRevealTiles([]);
    };

    useEffect(() => {
        autoRoundsPlayedRef.current = autoRoundsPlayed;
    }, [autoRoundsPlayed]);

    useEffect(() => {
        const maxSelectable = getSafeTileCount(mineCount);
        setAutoSelectedTiles((prev) => {
            if (prev.length <= maxSelectable) return prev;
            const sorted = [...prev].sort((a, b) => b - a);
            return sorted.slice(prev.length - maxSelectable).reverse();
        });
    }, [mineCount]);

    useEffect(() => {
        remainingAutoBetsRef.current = remainingAutoBets;
    }, [remainingAutoBets]);

    useEffect(() => {
        purchasedRoundsRemainingRef.current = safePurchasedRoundsRemaining;
    }, [safePurchasedRoundsRemaining]);

    useEffect(() => {
        roundStateRef.current = roundState;
    }, [roundState]);

    useEffect(() => {
        pendingManualRevealTilesRef.current = pendingManualRevealTiles;
    }, [pendingManualRevealTiles]);

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
        }));
        setCurrentView(2);
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
            if (!isSfxMuted && notEnoughSfxRef.current) {
                notEnoughSfxRef.current.currentTime = 0;
                void notEnoughSfxRef.current.play().catch(() => {});
            }
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
        setRoundState({
            ...INITIAL_ROUND_STATE,
            resultText: `Bought ${roundsToBuy} rounds. Click Deal to start.`,
        });
        setPendingManualRevealTiles([]);
        setManualShowAllAfterMine(false);
        manualClickOrderRef.current = {};
        manualClickCounterRef.current = 0;
    };

    const handleManualPrimaryAction = (): void => {
        if (currentView === 1 || roundState.isLoading) {
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
            if (!isSfxMuted && notEnoughSfxRef.current) {
                notEnoughSfxRef.current.currentTime = 0;
                void notEnoughSfxRef.current.play().catch(() => {});
            }
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
        if (betAmount <= 0) return;

        setIsRewatching(false);
        setCurrentView(0);
        resetTimers();
        lastRevealOrderRef.current = [];
        lastGameMineCountRef.current = mineCount;

        if (!options?.rewatch) {
            const roundsPool = toSafeNonNegativeInt(options?.roundsPoolOverride ?? safePurchasedRoundsRemaining, 0);

            if (!options?.noPayment) {
                if (roundsPool <= 0) {
                    setRoundState((prev) => ({ ...prev, resultText: "Buy rounds before dealing." }));
                    return;
                }
            } else if (roundsPool <= 0) {
                setRoundState((prev) => ({ ...prev, resultText: "No purchased rounds left." }));
                return;
            }

            setPurchasedRoundsRemaining(Math.max(0, toSafeNonNegativeInt(roundsPool, 0) - 1));
            console.log("Mock tx submitted for gameId:", currentGameId.toString());
        }

        let randomWordForRound: `0x${string}`;

        if (options?.rewatch) {
            if (!lastRoundRandomWordRef.current) {
                setRoundState((prev) => ({ ...prev, resultText: "No prior result available for rewatch." }));
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
                setRoundState((prev) => ({ ...prev, resultText: message, isLoading: false }));
                return;
            }
        }

        const mines = createMinePositions(randomWordForRound, mineCount);

        setRoundState({
            minePositions: mines,
            revealedTiles: [],
            explodedMine: null,
            currentMultiplier: 1,
            payout: null,
            lastPayout: null,
            resultText: "",
            isLoading: false,
        });
        setManualShowAllAfterMine(false);
        manualClickOrderRef.current = {};
        manualClickCounterRef.current = 0;
        setPendingManualRevealTiles([]);
        setCurrentView(1);
    };

    const handleRevealTile = (index: number): void => {
        if (!canReveal) return;

        if (pendingManualRevealTilesRef.current.includes(index) || roundState.revealedTiles.includes(index)) {
            return;
        }

        if (manualClickOrderRef.current[index] === undefined) {
            manualClickCounterRef.current += 1;
            manualClickOrderRef.current[index] = manualClickCounterRef.current;
        }

        setPendingManualRevealTiles((prev) => (prev.includes(index) ? prev : [...prev, index]));

        const clickTimeMinePositions = roundStateRef.current.minePositions;
        if (clickTimeMinePositions.length > 0 && !clickTimeMinePositions.includes(index)) {
            playDiamondSfx();
        }

        const timeoutId = setTimeout(() => {
            manualRevealTimeoutsRef.current = manualRevealTimeoutsRef.current.filter((id) => id !== timeoutId);

            const latestRoundState = roundStateRef.current;
            if (latestRoundState.explodedMine !== null || latestRoundState.minePositions.length <= 0) {
                setPendingManualRevealTiles((prev) => prev.filter((tileIndex) => tileIndex !== index));
                return;
            }

            const isMine = latestRoundState.minePositions.includes(index);

            if (isMine) {
                const mineClickOrder = manualClickOrderRef.current[index] ?? Number.POSITIVE_INFINITY;
                const safeTileCount = getSafeTileCount(mineCount);
                const clickedSafeBeforeMine = Array.from({ length: BOARD_TILE_COUNT }, (_, tileIndex) => tileIndex)
                    .filter((tileIndex) => !latestRoundState.minePositions.includes(tileIndex))
                    .filter((tileIndex) => {
                        const clickOrder = manualClickOrderRef.current[tileIndex];
                        return clickOrder !== undefined && clickOrder < mineClickOrder;
                    }).length;

                if (clickedSafeBeforeMine >= safeTileCount) {
                    const allSafeTiles = Array.from({ length: BOARD_TILE_COUNT }, (_, tileIndex) => tileIndex)
                        .filter((tileIndex) => !latestRoundState.minePositions.includes(tileIndex));
                    const finalMultiplier = getMinesMultiplier(mineCount, safeTileCount, houseEdge);
                    const amount = Number(Math.min(betAmount * finalMultiplier, maxPayoutPerGame).toFixed(2));

                    if (!isSfxMuted && cashoutSfxRef.current) {
                        cashoutSfxRef.current.currentTime = 0;
                        void cashoutSfxRef.current.play().catch(() => {});
                    }

                    if (manualRevealTimeoutsRef.current.length > 0) {
                        manualRevealTimeoutsRef.current.forEach((pendingId) => clearTimeout(pendingId));
                        manualRevealTimeoutsRef.current = [];
                    }

                    setRoundState((prev) => ({
                        ...prev,
                        revealedTiles: allSafeTiles,
                        currentMultiplier: finalMultiplier,
                    }));
                    setPendingManualRevealTiles([]);
                    resolveTimeoutRef.current = setTimeout(() => {
                        finishRound(amount, `All gems found before mine click! Cashed out at ${finalMultiplier.toFixed(2)}x.`);
                    }, 400);
                    return;
                }

                if (!isSfxMuted && loseBombSfxRef.current) {
                    loseBombSfxRef.current.currentTime = 0;
                    void loseBombSfxRef.current.play().catch(() => {});
                }

                if (manualRevealTimeoutsRef.current.length > 0) {
                    manualRevealTimeoutsRef.current.forEach((pendingId) => clearTimeout(pendingId));
                    manualRevealTimeoutsRef.current = [];
                }

                setRoundState((prev) => ({ ...prev, explodedMine: index }));
                setPendingManualRevealTiles([]);
                revealAllAfterMineTimeoutRef.current = setTimeout(() => {
                    setManualShowAllAfterMine(true);
                }, MANUAL_MINE_REVEAL_ALL_DELAY_MS);
                resolveTimeoutRef.current = setTimeout(() => {
                    finishRound(0, "You hit a mine!");
                }, MANUAL_MINE_FINISH_DELAY_MS);
                return;
            }

            if (latestRoundState.revealedTiles.includes(index)) {
                setPendingManualRevealTiles((prev) => prev.filter((tileIndex) => tileIndex !== index));
                return;
            }

            const nextRevealedTiles = [...latestRoundState.revealedTiles, index];
            const safeTiles = getSafeTileCount(mineCount);
            const allSafeRevealed = nextRevealedTiles.length >= safeTiles;
            const nextMultiplier = getMinesMultiplier(mineCount, nextRevealedTiles.length, houseEdge);

            lastRevealOrderRef.current.push(index);
            setRoundState((prev) => ({
                ...prev,
                revealedTiles: nextRevealedTiles,
                currentMultiplier: nextMultiplier,
            }));
            setPendingManualRevealTiles((prev) => prev.filter((tileIndex) => tileIndex !== index));

            if (allSafeRevealed) {
                const amount = Number(Math.min(betAmount * nextMultiplier, maxPayoutPerGame).toFixed(2));
                resolveTimeoutRef.current = setTimeout(() => {
                    finishRound(amount, `All gems found! Cashed out at ${nextMultiplier.toFixed(2)}x.`);
                }, 400);
            }
        }, MANUAL_REVEAL_DELAY_MS);
        manualRevealTimeoutsRef.current.push(timeoutId);

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

    const handleAutoReveal = (): void => {
        if (!isAutoBetting || !canReveal) return;

        const selectedTiles = autoSelectedTiles.filter(
            (index, position, values) =>
                index >= 0 &&
                index < BOARD_TILE_COUNT &&
                values.indexOf(index) === position
        );

        if (selectedTiles.length <= 0) {
            setRoundState((prev) => ({
                ...prev,
                resultText: "Select at least one auto tile before starting autobet.",
            }));
            stopAutobet();
            return;
        }

        const selectedMine = selectedTiles.find((index) => roundState.minePositions.includes(index));
        const safeSelections = selectedTiles.filter((index) => !roundState.minePositions.includes(index));
        lastRevealOrderRef.current.push(...safeSelections);
        const nextMultiplier = getMinesMultiplier(mineCount, safeSelections.length, houseEdge);

        if (selectedMine !== undefined) {
            if (!isSfxMuted && loseBombSfxRef.current) {
                loseBombSfxRef.current.currentTime = 0;
                void loseBombSfxRef.current.play().catch(() => {});
            }

            setRoundState((prev) => ({
                ...prev,
                revealedTiles: safeSelections,
                explodedMine: selectedMine,
                currentMultiplier: nextMultiplier,
            }));

            resolveTimeoutRef.current = setTimeout(() => {
                finishRound(0, "Auto hit a mine.");
            }, 650);
            return;
        }

        if (!isSfxMuted && cashoutSfxRef.current) {
            cashoutSfxRef.current.currentTime = 0;
            void cashoutSfxRef.current.play().catch(() => {});
        }

        setRoundState((prev) => ({
            ...prev,
            revealedTiles: safeSelections,
            currentMultiplier: nextMultiplier,
        }));

        const amount = Number(Math.min(betAmount * nextMultiplier, maxPayoutPerGame).toFixed(2));
        resolveTimeoutRef.current = setTimeout(() => {
            finishRound(amount, `Auto cashed out at ${nextMultiplier.toFixed(2)}x.`);
        }, 650);
    };

    const startAutobet = (overrideBetCount?: number): void => {
        if (isAutoBetting || betAmount <= 0) return;

        if (autoSelectedTiles.length <= 0) {
            setRoundState((prev) => ({
                ...prev,
                resultText: "Select at least one auto tile before starting autobet.",
            }));
            return;
        }

        setShowStoppedAutoSummary(false);

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
        setCurrentView(0);
        setIsAutoBetting(true);
        setRemainingAutoBets(toSafeNonNegativeInt(totalBets, 1));
        remainingAutoBetsRef.current = totalBets;
        void playGame({ noPayment: true, roundsPoolOverride: preparedRoundsPool });
    };

    const resumeAutobet = (): void => {
        if (isAutoBetting || !showStoppedAutoSummary) return;

        if (toSafeNonNegativeInt(remainingAutoBets, 0) <= 0) {
            setRoundState((prev) => ({ ...prev, resultText: "No auto bets left to resume." }));
            return;
        }

        if (autoSelectedTiles.length <= 0) {
            setRoundState((prev) => ({
                ...prev,
                resultText: "Select at least one auto tile before starting autobet.",
            }));
            return;
        }

        const remaining = toSafePositiveInt(remainingAutoBets, 1, MAX_BET_ROUNDS);
        const availableRounds = toSafeNonNegativeInt(safePurchasedRoundsRemaining, 0);
        if (availableRounds < remaining) {
            setRoundState((prev) => ({
                ...prev,
                resultText: "Buy enough rounds to cover your remaining auto bets.",
            }));
            return;
        }

        // Keep current auto session totals/progress and continue from where it stopped.
        autoSessionTargetBetsRef.current = Math.max(
            toSafeNonNegativeInt(autoSessionTargetBetsRef.current, 0),
            toSafeNonNegativeInt(autoRoundsPlayedRef.current, 0) + remaining,
        );

        setShowStoppedAutoSummary(false);
        setIsAutoBetting(true);

        if (currentView === 2) {
            return;
        }

        if (currentView === 0) {
            void playGame({
                noPayment: true,
                roundsPoolOverride: toSafeNonNegativeInt(availableRounds, 0),
            });
        }
    };

    const stopAutobet = (): void => {
        resetTimers();
        setIsAutoBetting(false);
        setShowStoppedAutoSummary(true);
        setRoundState((prev) => ({ ...prev, resultText: "Autobet stopped." }));
    };

    const handleBetModeChange = (mode: "manual" | "auto"): void => {
        if (mode === betMode) return;
        if (isAutoBetting) {
            resetTimers();
            setIsAutoBetting(false);
            setRemainingAutoBets(0);
        }
        resetTimers();
        setCurrentView(0);
        setRoundState(INITIAL_ROUND_STATE);
        setShowStoppedAutoSummary(false);
        setBetMode(mode);
    };

    const handleToggleAutoTile = (index: number): void => {
        if (!isAutoSelectionMode) return;

        const maxSelectable = getSafeTileCount(mineCount);
        setAutoSelectedTiles((prev) => {
            if (!isSfxMuted && autoTileSelectSfxRef.current) {
                autoTileSelectSfxRef.current.currentTime = 0;
                void autoTileSelectSfxRef.current.play().catch(() => {});
            }
            if (prev.includes(index)) {
                return prev.filter((tileIndex) => tileIndex !== index);
            }
            if (prev.length >= maxSelectable) return prev;
            return [...prev, index];
        });
    };


    const handleReset = (options?: { keepPackage?: boolean; keepAuto?: boolean; preserveSessionConfig?: boolean }): void => {
        resetTimers();
        autoSessionTargetBetsRef.current = 0;
        setForceExpandedReplayEndCard(false);

        setCurrentGameId(BigInt(bytesToHex(new Uint8Array(randomBytes(32)))));
        setCurrentView(0);
        if (!options?.preserveSessionConfig) {
            setBetAmount(1);
            setNumberOfSpins(1);
            setBetMode("manual");
            setMineCount(DEFAULT_MINE_COUNT);
            setAutoBetCount(1);
            setAutoSelectedTiles([]);
        }
        setAutoTotalPayout(0);
        setAutoRoundsPlayed(0);
        setChainHouseEdge(clampHouseEdge(HOUSE_EDGE));
        setMaxPayoutPerGame(DEFAULT_POOL_MAX_PAYOUT);
        setIsRewatching(false);
        setRoundState(INITIAL_ROUND_STATE);
        setShowStoppedAutoSummary(false);
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
        if (!replayRound) return;

        const revealOrder = [...lastRevealOrderRef.current];
        const replayMineCount = lastGameMineCountRef.current;
        const { explodedMine, minePositions } = replayRound;

        handleReset({ keepPackage: true, keepAuto: false, preserveSessionConfig: true });
        setIsRewatching(true);
        setForceExpandedReplayEndCard(true);

        // Clear any leftover replay timeouts
        replaySequenceTimeoutsRef.current.forEach((id) => clearTimeout(id));
        replaySequenceTimeoutsRef.current = [];

        // Start: board with mine positions but nothing revealed
        setRoundState({
            ...INITIAL_ROUND_STATE,
            minePositions,
        });
        setCurrentView(1);

        const REPLAY_TILE_MS = 480;
        const REPLAY_PRE_RESULT_MS = 500;

        let delay = 550;

        revealOrder.forEach((tileIndex) => {
            const id = setTimeout(() => {
                playDiamondSfx();
                setRoundState((prev) => {
                    const nextRevealed = [...prev.revealedTiles, tileIndex];
                    return {
                        ...prev,
                        revealedTiles: nextRevealed,
                        currentMultiplier: getMinesMultiplier(replayMineCount, nextRevealed.length, houseEdge),
                    };
                });
            }, delay);
            replaySequenceTimeoutsRef.current.push(id);
            delay += REPLAY_TILE_MS;
        });

        delay += REPLAY_PRE_RESULT_MS;

        if (explodedMine !== null) {
            // Show the bomb tile with sound, then reveal all mines
            const bombId = setTimeout(() => {
                if (!isSfxMuted && loseBombSfxRef.current) {
                    loseBombSfxRef.current.currentTime = 0;
                    void loseBombSfxRef.current.play().catch(() => {});
                }
                setRoundState((prev) => ({ ...prev, explodedMine }));
                setManualShowAllAfterMine(true);
            }, delay);
            replaySequenceTimeoutsRef.current.push(bombId);
            delay += MANUAL_MINE_FINISH_DELAY_MS + 300;
        } else {
            // Win — last tile reveal already played the cashout sound; nothing extra needed here.
        }

        // Jump to end result
        const endId = setTimeout(() => {
            setIsRewatching(false);
            setRoundState(replayRound);
            setCurrentView(2);
            replaySequenceTimeoutsRef.current = [];
        }, delay);
        replaySequenceTimeoutsRef.current.push(endId);
    };

    useEffect(() => {
        if (isRewatching || currentView !== 2 || roundState.payout === null) {
            return;
        }
        lastFinishedRoundRef.current = { ...roundState };
    }, [isRewatching, currentView, roundState]);

    useEffect(() => {
        if (!isAutoBetting || currentView !== 1 || roundState.isLoading || !canReveal) {
            return;
        }

        autoActionTimeoutRef.current = setTimeout(() => {
            handleAutoReveal();
        }, AUTO_ACTION_DELAY_MS);

        return () => {
            if (autoActionTimeoutRef.current !== null) {
                clearTimeout(autoActionTimeoutRef.current);
                autoActionTimeoutRef.current = null;
            }
        };
    }, [isAutoBetting, currentView, roundState.isLoading, canReveal, autoSelectedTiles, roundState.minePositions, mineCount, houseEdge, betAmount, maxPayoutPerGame, isSfxMuted]);

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
        <div className="mines-root flex flex-col lg:flex-row gap-4 sm:gap-8 lg:gap-10">
            <GameWindow
                game={game}
                currentGameId={currentGameId}
                isLoading={roundState.isLoading && betMode === "auto"}
                isGameFinished={currentView === 2 && !isRewatching}
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
                resultModalDelayMs={betMode === "auto" ? 0 : 250}
                disableBuiltInSong
                onMusicMutedChange={setIsMusicMuted}
                onSfxMutedChange={setIsSfxMuted}
            >
                <MinesWindow
                    minePositions={roundState.minePositions}
                    revealedTiles={roundState.revealedTiles}
                    explodedMine={roundState.explodedMine}
                    isRoundActive={currentView === 1}
                    isAutoBetting={isAutoBetting}
                    isAutoSelectionMode={isAutoSelectionMode}
                    showAutoSelectedTiles={betMode === "auto"}
                    revealAllTiles={revealAllTiles}
                    pendingRevealTiles={pendingManualRevealTiles}
                    autoSelectedTiles={autoSelectedTiles}
                    canReveal={canReveal}
                    onRevealTile={handleRevealTile}
                    onToggleAutoTile={handleToggleAutoTile}
                    showEndCardGamesNote={showEndCardGamesNote}
                    endCardGamesCount={endCardGamesCount}
                />
            </GameWindow>

            <MinesSetupCard
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
                hasActivePackage={hasActivePackage}
                packageLocked={packageLocked}
                manualRoundsRemaining={manualRoundsRemaining}
                manualRoundsPlayed={manualRoundsPlayed}
                payoutCardTitle="Current Payout"
                payoutCardValue={currentPayout}
                autoTotalPayout={autoTotalPayout}
                autoRoundsPlayed={autoRoundsPlayed}
                mineCount={mineCount}
                setMineCount={setMineCount}
                onCashOut={handleCashOut}
                canCashOut={canCashOut}
                onStart={handleManualPrimaryAction}
                onStartAutobet={() => startAutobet()}
                onResumeAutobet={resumeAutobet}
                onBuyAutoRounds={buyAutoRoundsForTarget}
                onStopAutobet={stopAutobet}
                isLoading={roundState.isLoading}
                isResolving={false}
                walletBalance={walletBalance}
                walletShake={walletShake}
                maxPayoutPerGame={maxPayoutPerGame}
                canStartAutobet={autoSelectedTiles.length > 0}
                autoNeedsRounds={toSafeNonNegativeInt(autoBetCount, 1) > safePurchasedRoundsRemaining}
            />
        </div>
    );
};

export default Mines;
