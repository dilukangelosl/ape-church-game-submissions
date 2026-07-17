"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { randomBytes, Game } from "@/lib/games";
import GameWindow from "@/components/shared/GameWindow";
import RunwayWalkWindow from "./RunwayWalkWindow";
import RunwayWalkSetupCard from "./RunwayWalkSetupCard";
import {
    runwayWalk, BUST_PROBABILITY, MAX_STEPS, multiplierForStep,
    streakBonusMultiplier, varietyBonusMultiplier,
} from "./runwayWalkConfig";
import { KodaEntry, pickRandomKoda, PLACEHOLDER_KODA } from "./kodaArt";
import { bytesToHex, Hex } from "viem";
import { toast } from "sonner";

interface RunwayWalkProps {
    game?: Game;
}

const SAFE_TILES = ["rose", "spotlight", "camera", "applause", "diamond", "ribbon", "crown"] as const;
export type TileName = typeof SAFE_TILES[number] | "missed-step";

/** One step's full record — the 5 tiles shown, which one was picked, and
 * the resolved outcome. Storing all 5 (not just the outcome) so a rewatch
 * can show the exact same board, not just the same result. */
interface StepResult {
    slots: TileName[]; // the 5 tiles that were on offer, in order
    chosenIndex: number;
    safe: boolean;
    tile: TileName; // slots[chosenIndex], kept separately for convenience
}

interface GameState {
    currentStep: number;
    baseMultiplier: number;
    bonusMultiplier: number; // streak bonus * variety bonus, combined
    totalMultiplier: number; // baseMultiplier * bonusMultiplier — what cash-out actually pays
    stepHistory: StepResult[];
    currentSlots: TileName[] | null; // the 5 options for the step in progress, null before playGame()
    isAdvancing: boolean;
    busted: boolean;
    cashedOut: boolean;
    payout: number | null;
    gameOver: boolean;
    streakTile: TileName | null;
    streakCount: number;
}

const initialGameState: GameState = {
    currentStep: 0,
    baseMultiplier: 1,
    bonusMultiplier: 1,
    totalMultiplier: 1,
    stepHistory: [],
    currentSlots: null,
    isAdvancing: false,
    busted: false,
    cashedOut: false,
    payout: null,
    gameOver: false,
    streakTile: null,
    streakCount: 0,
};

const STEP_REVEAL_DURATION_MS = 900;

/** Builds one step's 5-tile board: exactly 1 bust slot at a random
 * position, the other 4 independently random safe tiles. */
function generateSlots(): TileName[] {
    const bustIndex = Math.floor(Math.random() * 5);
    const slots: TileName[] = [];
    for (let i = 0; i < 5; i++) {
        if (i === bustIndex) slots.push("missed-step");
        else slots.push(SAFE_TILES[Math.floor(Math.random() * SAFE_TILES.length)]);
    }
    return slots;
}

const RunwayWalkComponent: React.FC<RunwayWalkProps> = ({ game: gameProp }) => {
    const game = gameProp ?? runwayWalk;
    const router = useRouter();
    const searchParams = useSearchParams();
    const replayIdString = searchParams.get("id");
    const walletBalance = 25; // TODO: get wallet balance from wallet

    const [isGameOngoing, setIsGameOngoing] = useState<boolean>(false);
    const [currentView, setCurrentView] = useState<0 | 1 | 2>(0);
    const [betAmount, setBetAmount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [gameState, setGameState] = useState<GameState>(initialGameState);
    const [isRewatching, setIsRewatching] = useState<boolean>(false);

    const [koda, setKoda] = useState<KodaEntry>(PLACEHOLDER_KODA);
    useEffect(() => {
        setKoda(pickRandomKoda());
    }, []);

    const [currentGameId, setCurrentGameId] = useState<bigint>(
        replayIdString == null
            ? BigInt(bytesToHex(new Uint8Array(randomBytes(32))))
            : BigInt(replayIdString)
    );
    const [userRandomWord, setUserRandomWord] = useState<Hex>(
        bytesToHex(new Uint8Array(randomBytes(32)))
    );

    useEffect(() => {
        if (replayIdString !== null && replayIdString.length > 2) {
            setIsLoading(true);
            setCurrentGameId(BigInt(replayIdString));
        }
    }, [replayIdString]);

    const getActiveBetAmount = (): number => betAmount;
    const getTotalPayout = (): number => gameState.payout ?? 0;
    const shouldShowPNL: boolean = !!gameState.payout && gameState.payout > betAmount;

    const playGame = async (gameId?: bigint, randomWord?: Hex): Promise<void> => {
        if (betAmount <= 0) {
            toast.info("Enter a bet amount first.");
            return;
        }

        setIsLoading(true);
        setIsGameOngoing(true);

        const gameIdToUse = gameId ?? currentGameId;
        const randomWordToUse = randomWord ?? userRandomWord;

        try {
            // TODO: replace with the real on-chain transaction.
            console.log("playGame mock tx", { gameIdToUse, randomWordToUse, betAmount });
            const receiptSuccess = true;

            if (!receiptSuccess) {
                toast.info("Something went wrong..");
                setIsLoading(false);
                setIsGameOngoing(false);
                return;
            }

            toast.success("Transaction complete!");
            setIsLoading(false);
            setCurrentView(1);
            setGameState({ ...initialGameState, currentSlots: generateSlots() });
        } catch (error) {
            if (
                (error instanceof Error && error.message.includes("Transaction not found")) ||
                (typeof error === "string" && (error as string).includes("Transaction not found"))
            ) {
                console.warn("Ignoring a known timeout error.");
                return;
            }
            console.error("An unexpected error occurred:", error);
            toast.error("An unexpected error occurred.");
            setIsLoading(false);
            setIsGameOngoing(false);
        }
    };

    /**
     * handleStateAdvance() — resolves the step given which of the 5 tiles
     * the player picked. During a real round, chosenIndex comes from the
     * player's click; during a rewatch, it's replayed from stored history
     * instead (see handleRewatch()).
     */
    const handleStateAdvance = async (chosenIndex: number): Promise<void> => {
        if (gameState.busted || gameState.cashedOut || gameState.isAdvancing) return;
        if (gameState.currentStep >= MAX_STEPS) return;
        if (!gameState.currentSlots) return;

        setGameState((prev) => ({ ...prev, isAdvancing: true }));

        const slots = gameState.currentSlots;
        const tile = slots[chosenIndex];
        const isSafe = tile !== "missed-step";

        setTimeout(() => {
            setGameState((prev) => {
                const stepRecord: StepResult = { slots, chosenIndex, safe: isSafe, tile };
                const newHistory = isRewatching ? prev.stepHistory : [...prev.stepHistory, stepRecord];

                if (!isSafe) {
                    return {
                        ...prev,
                        stepHistory: newHistory,
                        busted: true,
                        payout: 0,
                        isAdvancing: false,
                        gameOver: true,
                        currentSlots: slots, // keep so the window can reveal all 5 on bust
                    };
                }

                // Update the consecutive-same-tile streak.
                const streakTile = prev.streakTile === tile ? tile : tile;
                const streakCount = prev.streakTile === tile ? prev.streakCount + 1 : 1;

                const recentTiles = newHistory.filter(s => s.safe).map(s => s.tile).slice(-3);
                const bonus = streakBonusMultiplier(streakCount) * varietyBonusMultiplier(recentTiles);

                const newStep = prev.currentStep + 1;
                const base = multiplierForStep(newStep);

                return {
                    ...prev,
                    currentStep: newStep,
                    baseMultiplier: base,
                    bonusMultiplier: bonus,
                    totalMultiplier: base * bonus,
                    stepHistory: newHistory,
                    currentSlots: isRewatching ? prev.currentSlots : generateSlots(),
                    isAdvancing: false,
                    streakTile,
                    streakCount,
                };
            });

            if (!isSafe) {
                setCurrentView(2);
                setIsGameOngoing(false);
            }
        }, STEP_REVEAL_DURATION_MS);
    };

    const cashOut = (): void => {
        if (gameState.busted || gameState.cashedOut || gameState.isAdvancing || gameState.currentStep === 0) return;
        const roundPayout = betAmount * gameState.totalMultiplier;
        setGameState((prev) => ({ ...prev, cashedOut: true, payout: roundPayout, gameOver: true }));
        setCurrentView(2);
        setIsGameOngoing(false);
    };

    const handleReset = (isPlayingAgain: boolean = false): void => {
        if (!isPlayingAgain) {
            const newGameId = BigInt(bytesToHex(new Uint8Array(randomBytes(32))));
            const newUserWord = bytesToHex(new Uint8Array(randomBytes(32)));
            setCurrentGameId(newGameId);
            setUserRandomWord(newUserWord);
        }

        setGameState(initialGameState);
        setCurrentView(0);
        setIsLoading(false);
        setIsGameOngoing(false);
        setBetAmount(0);
        setIsRewatching(false);
        setKoda(pickRandomKoda());

        if (replayIdString !== null) {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("id");
            router.replace(`?${params.toString()}`, { scroll: false });
        }
    };

    const handlePlayAgain = async (): Promise<void> => {
        const newGameId = BigInt(bytesToHex(new Uint8Array(randomBytes(32))));
        const newUserWord = bytesToHex(new Uint8Array(randomBytes(32)));
        setCurrentGameId(newGameId);
        setUserRandomWord(newUserWord);

        handleReset(true);
        await playGame(newGameId, newUserWord);
    };

    /**
     * handleRewatch() — replays the exact same walk: same 5-tile boards,
     * same picks, same outcomes, no new randomness anywhere.
     */
    const handleRewatch = (): void => {
        if (gameState.stepHistory.length === 0) return;
        const storedHistory = gameState.stepHistory;
        const wasCashedOut = gameState.cashedOut;
        const finalPayout = gameState.payout;

        setIsRewatching(true);
        setCurrentView(1);
        setIsGameOngoing(false);
        setGameState({ ...initialGameState, stepHistory: [], currentSlots: storedHistory[0]?.slots ?? null });

        let i = 0;
        const replayNext = () => {
            if (i >= storedHistory.length) {
                if (wasCashedOut) {
                    setGameState((prev) => ({ ...prev, cashedOut: true, payout: finalPayout, gameOver: true }));
                    setCurrentView(2);
                }
                return;
            }
            const chosenIndex = storedHistory[i].chosenIndex;
            setGameState((prev) => ({ ...prev, currentSlots: storedHistory[i].slots }));
            i++;
            handleStateAdvance(chosenIndex).then(() => {
                setTimeout(replayNext, STEP_REVEAL_DURATION_MS + 100);
            });
        };
        setTimeout(replayNext, 300);
    };

    const setupCardProps = {
        game,
        currentView,
        betAmount: currentView === 0 ? betAmount : getActiveBetAmount(),
        setBetAmount,
        isLoading,
        currentStep: gameState.currentStep,
        totalMultiplier: gameState.totalMultiplier,
        bonusMultiplier: gameState.bonusMultiplier,
        busted: gameState.busted,
        cashedOut: gameState.cashedOut,
        isAdvancing: gameState.isAdvancing,
        inReplayMode: replayIdString !== null,
        walletBalance,
        minBet: 1,
        maxBet: 100,
        onPlay: async () => await playGame(),
        onCashOut: cashOut,
        onPlayAgain: handlePlayAgain,
        onReset: () => handleReset(false),
        onRewatch: handleRewatch,
        playAgainText: "Play Again",
        payout: gameState.payout,
    };

    const gameWindowContent = (
        <RunwayWalkWindow
            game={game}
            koda={koda}
            currentStep={gameState.currentStep}
            totalMultiplier={gameState.totalMultiplier}
            bonusMultiplier={gameState.bonusMultiplier}
            streakCount={gameState.streakCount}
            isAdvancing={gameState.isAdvancing}
            busted={gameState.busted}
            cashedOut={gameState.cashedOut}
            gameCompleted={gameState.gameOver}
            betAmount={getActiveBetAmount()}
            payoutAmount={getTotalPayout()}
            stepHistory={gameState.stepHistory}
            currentSlots={gameState.currentSlots}
            currentView={currentView}
            inReplayMode={replayIdString !== null}
            onPickSlot={(i) => handleStateAdvance(i)}
        />
    );

    return (
        <div>
            <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 sm:gap-8 lg:gap-10">
                <div className="min-w-0 w-full h-full lg:basis-2/3 lg:self-stretch">
                <GameWindow
                    game={game}
                    currentGameId={currentGameId}
                    isLoading={isLoading}
                    isGameFinished={gameState.gameOver}
                    onPlayAgain={handlePlayAgain}
                    playAgainText="Play Again"
                    onRewatch={handleRewatch}
                    onReset={() => handleReset(false)}
                    betAmount={getActiveBetAmount()}
                    payout={gameState.payout}
                    inReplayMode={replayIdString !== null}
                    isUserOriginalPlayer={true}
                    showPNL={shouldShowPNL}
                    isGamePaused={false}
                    resultModalDelayMs={1200}
                >
                    {gameWindowContent}
                </GameWindow>
                </div>

                <div className="flex min-w-0 w-full flex-col lg:basis-1/3 lg:min-h-0 lg:self-stretch">
                <RunwayWalkSetupCard {...setupCardProps} placement="sidebar" />
                </div>
            </div>
        </div>
    );
};

export default RunwayWalkComponent;