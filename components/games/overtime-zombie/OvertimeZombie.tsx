"use client";

import React, { Suspense, useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Game, randomBytes } from "@/lib/games";
import { bytesToHex } from "viem";
import { toast } from "sonner";
import GameWindow from "@/components/shared/GameWindow";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import OvertimeZombieWindow from "./OvertimeZombieWindow";
import OvertimeZombieScaler from "./OvertimeZombieScaler";
import {
    OvertimeZombieGameState,
    CellState,
    INITIAL_GAME_STATE,
    generateAllReels,
    buildInitialBoard,
    findMatches,
    markMatches,
    dropMatches,
    consumeDropped,
    cascadeBoard,
    canKick,
    calculateKickPoints,
    markKickShoes,
    markAllForDrop,
    calculateBonusMultiplier,
    computeBigWinLevel,
    WORKER_SYMBOL_ID,
    SHOE_SYMBOL_ID,
    ROWS,
    COLS,
    REEL_LENGTH,
    METER_MAX,
    MATCH_HIGHLIGHT_DURATION,
    DROP_DURATION,
    WORKER_REVEAL_SCAN_SPEED,
    WORKER_REVEAL_HIGHLIGHT,
    EMPTY_SLOT_DURATION,
    RESTOCK_DURATION,
    RESTOCK_SETTLE_DELAY,
    CELL_RESTOCK_DURATION,
    formatApeCompact,
    formatApeFull,
} from "./overtimeZombieConfig";
import { playSound, playSoundInstant, preloadSounds, setSoundMuted, matchSoundForCount } from "./soundManager";
import "./snack-attack.styles.css";

interface OvertimeZombieComponentProps {
    game: Game;
}

// Parse a string into a BigInt without throwing. Returns null for null/empty
// input or any value BigInt() rejects (non-numeric, malformed, etc.). Used to
// guard the replay ?id= query param so a bad URL doesn't crash the mount.
function safeBigInt(value: string | null): bigint | null {
    if (value === null || value === "") return null;
    try {
        return BigInt(value);
    } catch {
        return null;
    }
}

const OvertimeZombieComponent: React.FC<OvertimeZombieComponentProps> = ({ game }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const replayIdString = searchParams.get("id");
    const walletBalance = 25;

    // View state
    const [currentView, setCurrentView] = useState<0 | 1 | 2>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Bet state
    const [betAmount, setBetAmount] = useState<number>(0);
    const [numberOfSpins, setNumberOfSpins] = useState<number>(1);
    const [spinsRemaining, setSpinsRemaining] = useState<number>(0);
    const [totalWagered, setTotalWagered] = useState<number>(0);

    // Payout state
    const [payout, setPayout] = useState<number | null>(null);
    const [gameOver, setGameOver] = useState<boolean>(false);
    // Mirror of the latest payout so timers can read it without stale closures
    const payoutRef = useRef<number | null>(null);

    // Game ID / replay. The user random word will be added back when the
    // Ape Church blockchain integration lands and seeds the on-chain RNG.
    // safeBigInt avoids crashing the mount on a malformed ?id= query param
    // (e.g. a non-numeric string) — falls back to a fresh random gameId.
    const [currentGameId, setCurrentGameId] = useState<bigint>(() => {
        const parsed = safeBigInt(replayIdString);
        return parsed ?? BigInt(bytesToHex(new Uint8Array(randomBytes(32))));
    });

    // Core game state
    const [gameState, setGameState] = useState<OvertimeZombieGameState>(INITIAL_GAME_STATE);

    // Timer refs for cleanup
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    const clearAllTimers = useCallback((): void => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    }, []);

    const addTimer = useCallback((cb: () => void, ms: number): void => {
        const id = setTimeout(cb, ms);
        timersRef.current.push(id);
    }, []);

    // Preload all SFX once on mount
    useEffect(() => {
        preloadSounds();
    }, []);

    // Cancel any in-flight timers when the component unmounts so delayed
    // callbacks (cascade chain, win/loss SFX, reveal scan, etc.) can't fire
    // against a torn-down component.
    useEffect(() => {
        return () => clearAllTimers();
    }, [clearAllTimers]);

    // Keep the payout ref in sync for timer-based reads
    useEffect(() => {
        payoutRef.current = payout;
    }, [payout]);

    // Kick screen shake — toggle body class for ~500ms when kick starts
    useEffect(() => {
        if (gameState.isKicking) {
            document.body.classList.add("sa-kicking");
            const timeout = setTimeout(() => {
                document.body.classList.remove("sa-kicking");
            }, 500);
            return () => {
                clearTimeout(timeout);
                document.body.classList.remove("sa-kicking");
            };
        }
    }, [gameState.isKicking]);

    // Replay ID handling. Guarded by safeBigInt — a malformed ?id= param
    // shouldn't crash the component; it just falls through silently and the
    // initial-state random gameId stays in place.
    useEffect(() => {
        const parsed = safeBigInt(replayIdString);
        if (parsed !== null) {
            setIsLoading(true);
            setCurrentGameId(parsed);
        }
    }, [replayIdString]);

    // End the game when all purchased spins have been used and the current spin has settled
    useEffect(() => {
        if (
            currentView === 1
            && spinsRemaining === 0
            && gameState.spinComplete
            && !gameState.isAnimating
            && !gameState.isCascading
            && !gameState.isRevealingWorkers
        ) {
            // Brief pause so the player registers "spin's over" before the
            // modal flies in. Tuned tight since the modal has its own spring
            // entrance + delayed win/gameover SFX on top. When a big-win splash
            // is showing, extend the delay to 2s so the splash gets its full
            // hold before the modal takes over; then clear bigWinLevel so the
            // splash dismisses cleanly instead of lingering under the modal.
            const holdMs = gameState.bigWinLevel !== null ? 2000 : 300;
            const timeout = setTimeout(() => {
                setPayout((prev) => prev ?? 0);
                setCurrentView(2);
                setGameOver(true);
                if (gameState.bigWinLevel !== null) {
                    setGameState((prev) => ({ ...prev, bigWinLevel: null }));
                }
            }, holdMs);
            return () => clearTimeout(timeout);
        }
    }, [
        currentView,
        spinsRemaining,
        gameState.spinComplete,
        gameState.isAnimating,
        gameState.isCascading,
        gameState.isRevealingWorkers,
        gameState.bigWinLevel,
    ]);

    // Win / gameOver fanfare — fires as the "You Won!" / "Try Again!" text
    // inside the modal finishes its scale-in animation, not when the modal
    // first mounts. Matches the text animation timing in GameResultsModal:
    // delay 0.2s + scale duration 0.5s = ~700ms after modal mount.
    useEffect(() => {
        if (currentView !== 2 || !gameOver) return;
        const t = setTimeout(() => {
            playSound((payoutRef.current ?? 0) > 0 ? "win" : "gameOver");
        }, 1000);
        return () => clearTimeout(t);
    }, [currentView, gameOver]);

    // --- CASCADE LOGIC ---
    // Uses refs to avoid stale closures in the timer chain.
    //
    // Normal cascade cycle:
    //   1. Check settled board for matches → highlight (glow)
    //   2. Drop matched snacks out of frame (vending machine dispense)
    //   3. Show empty slots (dashed border)
    //   4. Restock empty slots → scale-in animation
    //   5. Settle pause → everything fully static
    //   6. Repeat from step 1
    //
    // Kick sequence (when no matches but 4+ shoes):
    //   K1. Highlight shoes (show they're being spent)
    //   K2. Drop shoes out of frame
    //   K3. Highlight all remaining snacks (show points being awarded)
    //   K4. Drop all snacks out of frame
    //   K5. Show fully empty board
    //   K6. Full restock → settle → back to step 1

    const cascadeRef = useRef<{
        checkAndHighlight: (state: OvertimeZombieGameState) => void;
        drop: (state: OvertimeZombieGameState, pointsToAward?: number, payoutToAward?: number) => void;
        consume: (state: OvertimeZombieGameState) => void;
        restock: (state: OvertimeZombieGameState) => void;
        kickHighlightShoes: (state: OvertimeZombieGameState) => void;
        kickDropAll: (state: OvertimeZombieGameState) => void;
        kickConsume: (state: OvertimeZombieGameState) => void;
        kickRestock: (state: OvertimeZombieGameState) => void;
        startBonusRound: (state: OvertimeZombieGameState) => void;
        revealNextCell: (state: OvertimeZombieGameState) => void;
        finishBonusRound: (state: OvertimeZombieGameState) => void;
    }>({
        checkAndHighlight: () => {},
        drop: () => {},
        consume: () => {},
        restock: () => {},
        kickHighlightShoes: () => {},
        kickDropAll: () => {},
        kickConsume: () => {},
        kickRestock: () => {},
        startBonusRound: () => {},
        revealNextCell: () => {},
        finishBonusRound: () => {},
    });

    // One whirr at the start of the refill (the mechanical lead-in), then
    // per-unique-symbol impact SFX that land when each cell finishes its
    // scale-in. Shoe/worker get a heavier "special" impact; snacks get the
    // lighter "normal" impact. Used by both the normal cascade restock and
    // the kick restock.
    const fireLayeredRestockSfx = (refilledBoard: CellState[][]): void => {
        playSound("restock");

        const refilledSymbolIds = new Set<number>();
        for (const row of refilledBoard) {
            for (const cell of row) {
                if (cell.isNew) refilledSymbolIds.add(cell.symbolId);
            }
        }
        refilledSymbolIds.forEach((symbolId) => {
            const delay = Math.min(symbolId, 7) ** 2 * 6;
            const isSpecial = symbolId === SHOE_SYMBOL_ID || symbolId === WORKER_SYMBOL_ID;
            const sfx = isSpecial ? "impactSpecial" : "impactNormal";
            addTimer(() => playSound(sfx), delay + CELL_RESTOCK_DURATION);
        });
    };

    // Step 1: Check a fully settled board for matches. If found, highlight them.
    // If no matches: in normal mode check for kick, in bonus mode finish the round.
    cascadeRef.current.checkAndHighlight = (state: OvertimeZombieGameState): void => {
        const { board } = state;
        const result = findMatches(board);

        if (result.matchedSymbolIds.length === 0) {
            // Bonus round: no more cascades → count workers and finish
            if (state.isBonusRound) {
                cascadeRef.current.finishBonusRound(state);
                return;
            }

            // Normal mode: check for kick before ending
            if (canKick(board)) {
                cascadeRef.current.kickHighlightShoes(state);
                return;
            }

            // End of spin (no more matches, no kick available) — award the
            // APE accumulated across this spin's cascades and surface a
            // roll-up "spin total" float that holds until the next SPIN press.
            // Bonus-round spins award + show the total separately at scan end.
            // Skip the float on the FINAL spin so the game-results modal can
            // take over cleanly instead of flashing the rollup beneath it.
            const apeToAward = state.totalPayoutThisSpin;
            if (apeToAward > 0) {
                setPayout((p) => (p ?? 0) + apeToAward);
            }
            const perSpinWager = numberOfSpins > 0 ? betAmount / numberOfSpins : betAmount;
            const bigWinLevel = computeBigWinLevel({
                isBonusRound: false,
                bonusWorkersFound: 0,
                spinTotalApe: apeToAward,
                perSpinWager,
            });
            // Rollup stays visible even on big-win spins — the splash is
            // constrained to the vending display area, so the rollup float
            // (which sits below the meter, outside the splash bounds) remains
            // readable and gives the player the final number for the spin.
            const showSpinTotal = spinsRemaining > 0;
            if (bigWinLevel !== null) {
                // Growl is the "moment" sound for the big-win splash; the
                // rollup below plays its usual win/gameOver chime alongside.
                playSoundInstant("bonusRound");
            }
            if (showSpinTotal) {
                // Win / no-win fanfare paired with the spin-total rollup.
                // Final-spin results modal has its own delayed fanfare elsewhere.
                playSound(apeToAward > 0 ? "win" : "gameOver");
            }
            setGameState((prev) => ({
                ...prev,
                isAnimating: false,
                isCascading: false,
                spinComplete: true,
                isKicking: false,
                totalPayoutThisSpin: 0,
                floatingPayoff: showSpinTotal ? { type: "spinTotal", value: apeToAward } : null,
                bigWinLevel,
            }));
            return;
        }

        const markedBoard = markMatches(board, result.matchedSymbolIds);
        const pointsToAward = result.pointsAwarded;
        // APE earned this cascade — multiplier sum × per-spin wager.
        const perSpinWager = numberOfSpins > 0 ? betAmount / numberOfSpins : betAmount;
        const payoutToAward = result.payoutMultiplierAwarded * perSpinWager;

        // Play the match SFX for the largest matched-symbol count this cascade
        const largestMatch = Math.max(...Array.from(result.matchCounts.values()));
        playSound(matchSoundForCount(largestMatch));

        // Highlight matches — don't update the meter yet; that happens at drop time.
        // Floating "+N APE" payoff appears now and rides through highlight + drop +
        // consume, then gets cleared by the next restock.
        const updatedState: OvertimeZombieGameState = {
            ...state,
            board: markedBoard,
            cascadeCount: state.cascadeCount + 1,
            isAnimating: true,
            isCascading: true,
            floatingPayoff: { type: "ape", value: payoutToAward },
        };

        setGameState(updatedState);

        // After highlight, move to step 2: drop (passing the pending points + APE)
        addTimer(() => {
            cascadeRef.current.drop(updatedState, pointsToAward, payoutToAward);
        }, MATCH_HIGHLIGHT_DURATION);
    };

    // Step 2: Drop matched snacks out of frame — meter fills here
    cascadeRef.current.drop = (state: OvertimeZombieGameState, pointsToAward: number = 0, payoutToAward: number = 0): void => {
        const droppedBoard = dropMatches(state.board);
        playSound("snacksFall");

        // Award the points and update the meter as the snacks drop
        const newMeterPoints = state.isBonusRound
            ? state.meterPoints
            : Math.min(state.meterPoints + pointsToAward, METER_MAX);
        // Once zombie is released, keep it true through the bonus round
        const zombieReleased = state.zombieReleased || (!state.isBonusRound && newMeterPoints >= METER_MAX);
        // Only trigger the bonus round on the FIRST time the meter fills (not on every cascade in bonus)
        const shouldStartBonus = !state.isBonusRound && !state.zombieReleased && zombieReleased;

        const droppedState: OvertimeZombieGameState = {
            ...state,
            board: droppedBoard,
            meterPoints: newMeterPoints,
            totalPointsThisSpin: state.totalPointsThisSpin + pointsToAward,
            totalPayoutThisSpin: state.totalPayoutThisSpin + payoutToAward,
            zombieReleased,
        };

        setGameState(droppedState);

        if (shouldStartBonus) {
            // Meter filled during drop — go to bonus round after drop finishes
            addTimer(() => {
                cascadeRef.current.startBonusRound(droppedState);
            }, DROP_DURATION);
            return;
        }

        addTimer(() => {
            cascadeRef.current.consume(droppedState);
        }, DROP_DURATION);
    };

    // Step 3: Show empty slots
    cascadeRef.current.consume = (state: OvertimeZombieGameState): void => {
        const consumedBoard = consumeDropped(state.board);
        const consumedState: OvertimeZombieGameState = {
            ...state,
            board: consumedBoard,
        };

        setGameState(consumedState);

        addTimer(() => {
            cascadeRef.current.restock(consumedState);
        }, EMPTY_SLOT_DURATION);
    };

    // Step 4: Restock empty slots with new product from reels
    cascadeRef.current.restock = (state: OvertimeZombieGameState): void => {
        const { board, reels, reelPositions } = state;
        const { newBoard, newPositions } = cascadeBoard(board, reels, reelPositions);
        fireLayeredRestockSfx(newBoard);

        const restockedState: OvertimeZombieGameState = {
            ...state,
            board: newBoard,
            reelPositions: newPositions,
            isAnimating: true,
            isCascading: true,
            spinComplete: false,
            // Hide the floating payoff as new product comes in.
            floatingPayoff: null,
        };

        setGameState(restockedState);

        addTimer(() => {
            cascadeRef.current.checkAndHighlight(restockedState);
        }, RESTOCK_DURATION + RESTOCK_SETTLE_DELAY);
    };

    // --- KICK SEQUENCE ---

    // K1: Highlight the shoes being spent — meter does NOT fill yet
    cascadeRef.current.kickHighlightShoes = (state: OvertimeZombieGameState): void => {
        playSound("kick");
        const shoeBoard = markKickShoes(state.board);

        const kickState: OvertimeZombieGameState = {
            ...state,
            board: shoeBoard,
            cascadeCount: state.cascadeCount + 1,
            isAnimating: true,
            isCascading: true,
            isKicking: true,
            // Shows "Kick the Machine!" under the meter to call out that the
            // meter is filling from the kick, not from a points payoff.
            floatingPayoff: { type: "kick" },
        };

        setGameState(kickState);

        // After shoe highlight, drop the entire board (and award meter points then)
        addTimer(() => {
            cascadeRef.current.kickDropAll(kickState);
        }, MATCH_HIGHLIGHT_DURATION);
    };

    // K2: Drop the ENTIRE board at once — meter fills here
    cascadeRef.current.kickDropAll = (state: OvertimeZombieGameState): void => {
        const droppedBoard = markAllForDrop(state.board);
        playSound("snacksFall");
        const kickPoints = calculateKickPoints();
        const newMeterPoints = Math.min(state.meterPoints + kickPoints, METER_MAX);
        const zombieReleased = newMeterPoints >= METER_MAX;

        const droppedState: OvertimeZombieGameState = {
            ...state,
            board: droppedBoard,
            meterPoints: newMeterPoints,
            totalPointsThisSpin: state.totalPointsThisSpin + kickPoints,
            zombieReleased,
            // If this kick fills the meter, hide the "Kick the Machine!" banner
            // immediately so it doesn't linger through the empty-board phase
            // and into the bonus-round transition.
            ...(zombieReleased ? { floatingPayoff: null } : {}),
        };

        setGameState(droppedState);

        addTimer(() => {
            cascadeRef.current.kickConsume(droppedState);
        }, DROP_DURATION);
    };

    // K3: Show fully empty board
    cascadeRef.current.kickConsume = (state: OvertimeZombieGameState): void => {
        const emptyBoard = state.board.map((row) =>
            row.map((cell) => ({
                ...cell,
                isMatched: false,
                isDropping: false,
                isConsumed: true,
            }))
        );

        setGameState({ ...state, board: emptyBoard });

        addTimer(() => {
            if (state.zombieReleased) {
                // Meter filled from kick — go to bonus round
                cascadeRef.current.startBonusRound({ ...state, board: emptyBoard });
            } else {
                cascadeRef.current.kickRestock({ ...state, board: emptyBoard });
            }
        }, EMPTY_SLOT_DURATION);
    };

    // K4: Full board restock, then back to normal cascade checking
    cascadeRef.current.kickRestock = (state: OvertimeZombieGameState): void => {
        const { board, reels, reelPositions } = state;
        const { newBoard, newPositions } = cascadeBoard(board, reels, reelPositions);
        fireLayeredRestockSfx(newBoard);

        const restockedState: OvertimeZombieGameState = {
            ...state,
            board: newBoard,
            reelPositions: newPositions,
            isAnimating: true,
            isCascading: true,
            isKicking: false,
            spinComplete: false,
            // Clear the "Kick the Machine!" text as the new product comes in.
            floatingPayoff: null,
        };

        setGameState(restockedState);

        addTimer(() => {
            cascadeRef.current.checkAndHighlight(restockedState);
        }, RESTOCK_DURATION + RESTOCK_SETTLE_DELAY);
    };

    // --- BONUS ROUND ---

    // Start bonus: clear the board, generate bonus reels (workers instead of shoes), spin once
    cascadeRef.current.startBonusRound = (state: OvertimeZombieGameState): void => {
        // Bonus fanfare fires as the background swaps to the zombie/nighttime scene.
        // Use the preloaded audio element to skip decode latency so the sound
        // lands in sync with the visual swap (not ~150ms behind it).
        playSoundInstant("bonusRound");

        // Generate bonus reels (no shoes, has workers)
        const bonusReels = generateAllReels(true);
        const startIndices = Array.from({ length: 6 }, () =>
            Math.floor(Math.random() * REEL_LENGTH)
        );
        const { board, newPositions } = buildInitialBoard(bonusReels, startIndices);

        // Cascade APE earned PRE-bonus is preserved on the accumulator — the
        // worker multiplier at bonus end applies to the entire spin's APE
        // (normal + bonus cascades), not just the bonus phase. This is the
        // "free spin amplifier" reward for reaching the bonus round.

        const bonusState: OvertimeZombieGameState = {
            ...state,
            board,
            reels: bonusReels,
            reelPositions: newPositions,
            isBonusRound: true,
            isAnimating: true,
            isCascading: false,
            isKicking: false,
            spinComplete: false,
            // Same reason as handleSpin: carry forward so identical (row, col)
            // symbols across the boundary still get a remount + animation.
            cascadeCount: state.cascadeCount + 1,
            totalPointsThisSpin: 0,
            // Reset reveal state so a re-entered bonus round starts in the
            // pre-attack (purple / RELEASED) phase, not stuck in attack red.
            revealScanIndex: -1,
            revealHighlightCell: null,
            isRevealingWorkers: false,
            bonusWorkersFound: 0,
            bonusMultiplier: 1,
            floatingPayoff: null,
        };

        setGameState(bonusState);

        // Let the board settle, then check for matches (normal cascade logic)
        addTimer(() => {
            cascadeRef.current.checkAndHighlight(bonusState);
        }, RESTOCK_SETTLE_DELAY);
    };

    // Finish bonus: start the worker reveal scan
    cascadeRef.current.finishBonusRound = (state: OvertimeZombieGameState): void => {
        // Zombie growl announces the state swap from released → snack attack,
        // synced to the frame/text color change. Preloaded for tight sync.
        playSoundInstant("bonusRound");

        const revealState: OvertimeZombieGameState = {
            ...state,
            isAnimating: false,
            isCascading: false,
            isRevealingWorkers: true,
            revealScanIndex: 0,
            revealHighlightCell: null,
            bonusWorkersFound: 0,
            bonusMultiplier: 1,
        };

        setGameState(revealState);

        addTimer(() => {
            cascadeRef.current.revealNextCell(revealState);
        }, 300);
    };

    // Scan cells one by one, highlight workers when found
    cascadeRef.current.revealNextCell = (state: OvertimeZombieGameState): void => {
        const { board, revealScanIndex, bonusWorkersFound } = state;
        const totalCells = ROWS * COLS;

        // Scan complete
        if (revealScanIndex >= totalCells) {
            const multiplier = calculateBonusMultiplier(bonusWorkersFound);
            // Bonus payout = APE earned across the ENTIRE spin (normal + bonus
            // cascades), amplified by the worker multiplier. With 0 workers
            // the multiplier is 1× so the player keeps their cascade earnings;
            // each additional worker doubles the total spin's payout.
            const spinCascadeApe = state.totalPayoutThisSpin;
            const finalPayout = spinCascadeApe * multiplier;

            const perSpinWager = numberOfSpins > 0 ? betAmount / numberOfSpins : betAmount;
            const bigWinLevel = computeBigWinLevel({
                isBonusRound: true,
                bonusWorkersFound,
                spinTotalApe: finalPayout,
                perSpinWager,
            });
            // Skip the spin-total rollup on the FINAL spin so the game-results
            // modal isn't interrupted by a brief flash of the float.
            const showSpinTotal = spinsRemaining > 0;
            if (bigWinLevel !== null) {
                // Growl is the "moment" sound for the big-win splash.
                // finishBonusRound already fired the growl at scan start, but by
                // scan end (30 cells × timing) enough time has passed that a
                // second growl here reads as the spin-end beat, not a repeat.
                playSoundInstant("bonusRound");
            }
            if (showSpinTotal) {
                // Win / no-win fanfare paired with the spin-total rollup so the
                // spin-end isn't silent. Final-spin uses the modal's own delayed
                // fanfare instead.
                playSound(finalPayout > 0 ? "win" : "gameOver");
            }
            const finalState: OvertimeZombieGameState = {
                ...state,
                isRevealingWorkers: false,
                revealHighlightCell: null,
                bonusMultiplier: multiplier,
                spinComplete: true,
                totalPayoutThisSpin: 0,
                floatingPayoff: showSpinTotal ? { type: "spinTotal", value: finalPayout } : null,
                bigWinLevel,
            };

            setGameState(finalState);

            // Award the bonus payout immediately so end-of-game logic (and the
            // win/gameover SFX) reads the final total — avoids a timing race where
            // the game-over check fired before a delayed payout landed.
            if (finalPayout > 0) {
                setPayout((prev) => (prev ?? 0) + finalPayout);
            }
            return;
        }

        const row = Math.floor(revealScanIndex / COLS);
        const col = revealScanIndex % COLS;
        const cell = board[row][col];

        if (cell.symbolId === WORKER_SYMBOL_ID) {
            // Found a worker — highlight and update multiplier
            playSound("attackWorker");
            const newWorkersFound = bonusWorkersFound + 1;
            const newMultiplier = calculateBonusMultiplier(newWorkersFound);

            const updatedState: OvertimeZombieGameState = {
                ...state,
                revealScanIndex: revealScanIndex + 1,
                revealHighlightCell: [row, col],
                bonusWorkersFound: newWorkersFound,
                bonusMultiplier: newMultiplier,
            };

            setGameState(updatedState);

            // Hold on the worker, then continue scanning
            addTimer(() => {
                cascadeRef.current.revealNextCell(updatedState);
            }, WORKER_REVEAL_HIGHLIGHT);
        } else {
            // Not a worker — mark as scanned and move on quickly
            const updatedState: OvertimeZombieGameState = {
                ...state,
                revealScanIndex: revealScanIndex + 1,
                revealHighlightCell: null,
            };

            setGameState(updatedState);

            addTimer(() => {
                cascadeRef.current.revealNextCell(updatedState);
            }, WORKER_REVEAL_SCAN_SPEED);
        }
    };

    // --- LIFECYCLE FUNCTIONS ---

    const playGame = async (gameId?: bigint): Promise<void> => {
        // Hard input validation — guards against force-calls outside the
        // normal UI flow (which already disables Spin/Play on invalid input).
        // Runs before any loading transition or mock-transaction side effect.
        if (
            !Number.isFinite(betAmount) || betAmount <= 0 ||
            !Number.isFinite(numberOfSpins) || numberOfSpins < 1
        ) {
            toast.error("Invalid bet — set a positive bet amount and at least one spin.");
            setIsLoading(false);
            return;
        }

        // Mock transaction placeholder — will be replaced with the actual
        // `await contract.play(...)` call during blockchain integration.
        // gameId is not consumed here yet; it'll be sent to the contract
        // alongside the user random word once on-chain RNG is wired up.
        void gameId;
        console.log("Mock transaction submitted...", { betAmount, spinCount: numberOfSpins });

        setIsLoading(true);

        try {
            toast.success("Transaction complete!");

            playSound("placeBet");

            // Set up the multi-spin purchase upfront
            // betAmount is the TOTAL wager; per-spin = betAmount / numberOfSpins
            setSpinsRemaining(numberOfSpins);
            setTotalWagered(betAmount);
            setPayout(null);

            addTimer(() => {
                setIsLoading(false);
                setCurrentView(1);
            }, 500);
        } catch (error) {
            // Always clear the loading spinner on ANY error path — previously
            // the "Transaction not found" early return left the spinner stuck.
            setIsLoading(false);
            if (
                (error instanceof Error && error.message.includes("Transaction not found")) ||
                (typeof error === "string" && error.includes("Transaction not found"))
            ) {
                console.warn("Ignoring a known timeout error.");
                return;
            }
            console.error("An unexpected error occurred:", error);
            toast.error("An unexpected error occurred.");
        }
    };

    const handleStateAdvance = useCallback((): void => {
        if (gameState.isAnimating || gameState.isCascading) return;

        playSound("spin");

        // Generate reels if first spin, or if coming out of a bonus round (bonus uses different reels)
        const needsNewReels = gameState.reels.length === 0 || gameState.isBonusRound;
        const reels = needsNewReels ? generateAllReels() : gameState.reels;

        // Generate 6 random start indices (one per reel)
        const startIndices = Array.from({ length: 6 }, () =>
            Math.floor(Math.random() * REEL_LENGTH)
        );

        // Build the initial board — cells animate in via the restock scale-up
        const { board, newPositions } = buildInitialBoard(reels, startIndices);

        const newState: OvertimeZombieGameState = {
            ...INITIAL_GAME_STATE,
            board,
            reels,
            reelPositions: newPositions,
            isAnimating: true,
            // Carry cascadeCount forward (always-incrementing) so cell keys
            // change even when the new board reuses the same symbolId at the
            // same (row, col) — otherwise the cell skips its restock animation.
            cascadeCount: gameState.cascadeCount + 1,
        };

        setGameState(newState);
        setGameOver(false);
        // Consume one of the player's purchased spins
        setSpinsRemaining((prev) => prev - 1);

        // Initial board is already settled (no restock animation needed),
        // so after a brief pause let the player see the board, then check for matches
        addTimer(() => {
            cascadeRef.current.checkAndHighlight(newState);
        }, RESTOCK_SETTLE_DELAY);
    }, [gameState.isAnimating, gameState.isCascading, gameState.reels, addTimer]);

    // Shared low-level cleanup used by both handleReset and handleRewatch.
    // Cancels timers and clears all runtime/play state, but does NOT touch
    // the view, game identity (gameId/userWord), setup inputs (bet/spins),
    // or replay URL — those are context-specific and handled by callers.
    const resetRuntimeState = useCallback((): void => {
        clearAllTimers();
        setGameState(INITIAL_GAME_STATE);
        setPayout(null);
        payoutRef.current = null;  // close the useEffect-sync gap synchronously
        setGameOver(false);
        setIsLoading(false);
        setTotalWagered(0);
        setSpinsRemaining(0);
    }, [clearAllTimers]);

    const handleReset = useCallback((isPlayingAgain: boolean = false): void => {
        resetRuntimeState();

        if (!isPlayingAgain) {
            // Fresh start: regenerate identity, restore setup inputs to their
            // first-render defaults, and strip the replay URL marker. Play Again
            // skips this so it can reuse the same bet config for the next game.
            const newGameId = BigInt(bytesToHex(new Uint8Array(randomBytes(32))));
            setCurrentGameId(newGameId);
            setBetAmount(0);
            setNumberOfSpins(1);

            if (replayIdString !== null) {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("id");
                router.replace(`?${params.toString()}`, { scroll: false });
            }
        }

        setCurrentView(0);
    }, [resetRuntimeState, replayIdString, searchParams, router]);

    const handlePlayAgain = useCallback(async (): Promise<void> => {
        const newGameId = BigInt(bytesToHex(new Uint8Array(randomBytes(32))));
        setCurrentGameId(newGameId);
        handleReset(true);
        await playGame(newGameId);
        // betAmount + numberOfSpins included so playGame uses the latest values
        // (handlePlayAgain captures playGame at memoization time; this forces
        // re-memoization when those state values change)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handleReset, betAmount, numberOfSpins]);

    const handleRewatch = useCallback((): void => {
        // Replay the same game — preserve gameId/userWord/bet/spins/URL so
        // the replay context stays intact (no new transaction, no new game
        // identifier). resetRuntimeState clears timers, animations, totals
        // and the payout ref so no stale state from the prior run leaks in.
        // NOTE: true deterministic replay requires seeded RNG keyed by
        // gameId+userWord — that lands with the Ape Church on-chain
        // integration. For now this clears state cleanly but the next spin
        // still uses Math.random(), so re-runs will not match exactly.
        resetRuntimeState();
        setCurrentView(1);
    }, [resetRuntimeState]);

    const shouldShowPNL = !!payout && payout > 0 && payout > betAmount;

    // Live data for the mobile stats widget. Mirrors what OvertimeZombieWindow
    // computes for its desktop overlay so both surfaces show identical values.
    const liveWonForMobile = (payout ?? 0) + gameState.totalPayoutThisSpin;
    const perSpinForMobile = numberOfSpins > 0 ? betAmount / numberOfSpins : betAmount;
    const formatAmountMobile = (val: number): string =>
        `${val.toLocaleString([], { minimumFractionDigits: 0, maximumFractionDigits: 3 })} APE`;

    return (
        <div>
            {/* Mobile-only title bar — sits ABOVE the scaler (so it renders
                at native viewport size) and ABOVE the mobile stats widget.
                Flex layout with space-between leaves a slot on the right
                for the eventual Ape Church Leaderboard button to drop in
                without restructuring the layout. */}
            <div className="sa-title-mobile">
                <h1 className="text-2xl font-semibold">{game.title}</h1>
                {/* Future: Leaderboard button slot — render here when wired up. */}
            </div>

            {/* Mobile-only stats bar — sits ABOVE the scaler so it renders at
                native viewport size (the scaler's transform would otherwise
                shrink the text to unreadable on narrow viewports). Same four
                rows + dividers as the desktop top-right widget; CSS hides
                whichever isn't appropriate for the current viewport width. */}
            {currentView === 1 && (
                <div className="sa-stats-mobile">
                    <div className="sa-stat-row">
                        <span className="sa-stat-label">Spins Left</span>
                        <span className="sa-stat-value">{spinsRemaining}</span>
                    </div>
                    <div className="sa-stat-divider" />
                    <div className="sa-stat-row">
                        <span className="sa-stat-label">Won</span>
                        <TooltipProvider delayDuration={150}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className={`sa-stat-value sa-stat-value-tooltip ${liveWonForMobile > 0 ? "sa-stat-win" : ""}`}>
                                        {formatApeCompact(liveWonForMobile)}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent className="sa-tooltip-hint">
                                    {formatApeFull(liveWonForMobile)}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <div className="sa-stat-divider" />
                    <div className="sa-stat-row">
                        <span className="sa-stat-label">Wagered</span>
                        <span className="sa-stat-value">{formatAmountMobile(totalWagered)}</span>
                    </div>
                    <div className="sa-stat-row">
                        <span className="sa-stat-label">Per Spin</span>
                        <span className="sa-stat-value">{formatAmountMobile(perSpinForMobile)}</span>
                    </div>
                </div>
            )}
            <OvertimeZombieScaler>
            {/* Desktop title — sits inside the scaler with the same
                max-w/centering as the game frame so they share the same
                left edge at every viewport (both scale together as one
                unit). Hidden on mobile; the mobile title bar above the
                scaler takes over there. */}
            <div className="sa-title-desktop flex flex-row mb-2 sm:mb-4 max-w-[1382px] mx-auto">
                <h1 className="text-3xl font-semibold mr-2">
                    {game.title}
                </h1>
            </div>
            <div className="sa-game-frame w-full">
                <GameWindow
                    game={game}
                    currentGameId={currentGameId}
                    isLoading={isLoading}
                    isGameFinished={gameOver}
                    onPlayAgain={handlePlayAgain}
                    playAgainText="Play Again"
                    // Rewatch is a no-op + visually disabled (via CSS in
                    // snack-attack.styles.css) until the Ape Church blockchain
                    // integration lands and provides deterministic replay
                    // (seeded RNG keyed by gameId + userRandomWord — see
                    // HRNIGHT-146's deferred half). Keeping the button visible
                    // matches the platform's standard end-of-game layout; the
                    // CSS rule greys it out so users see the affordance is
                    // coming, not broken.
                    onRewatch={() => {}}
                    onReset={() => { playSound("select"); handleReset(false); }}
                    betAmount={betAmount}
                    payout={payout}
                    inReplayMode={replayIdString !== null}
                    isUserOriginalPlayer={true}
                    showPNL={shouldShowPNL}
                    isGamePaused={false}
                    resultModalDelayMs={1000}
                    onSfxMutedChange={setSoundMuted}
                    disableBuiltInSong={true}
                    customHeightMobile="600px"
                >
                    <OvertimeZombieWindow
                        game={game}
                        board={gameState.board}
                        meterPoints={gameState.meterPoints}
                        cascadeCount={gameState.cascadeCount}
                        zombieReleased={gameState.zombieReleased}
                        totalPointsThisSpin={gameState.totalPointsThisSpin}
                        totalPayoutThisSpin={gameState.totalPayoutThisSpin}
                        isAnimating={gameState.isAnimating}
                        isKicking={gameState.isKicking}
                        isBonusRound={gameState.isBonusRound}
                        bonusWorkersFound={gameState.bonusWorkersFound}
                        bonusMultiplier={gameState.bonusMultiplier}
                        isRevealingWorkers={gameState.isRevealingWorkers}
                        revealScanIndex={gameState.revealScanIndex}
                        revealHighlightCell={gameState.revealHighlightCell}
                        floatingPayoff={gameState.floatingPayoff}
                        bigWinLevel={gameState.bigWinLevel}
                        onSpin={handleStateAdvance}
                        canSpin={
                            currentView === 1
                            && !gameState.isAnimating
                            && !gameState.isCascading
                            && !gameState.isRevealingWorkers
                            && betAmount > 0
                            && spinsRemaining > 0
                        }
                        betAmount={betAmount}
                        numberOfSpins={numberOfSpins}
                        payout={payout}
                        totalWagered={totalWagered}
                        spinsRemaining={spinsRemaining}
                        isPlaying={currentView === 1}
                        currentView={currentView}
                        setBetAmount={setBetAmount}
                        setNumberOfSpins={setNumberOfSpins}
                        onPlay={async () => await playGame()}
                        walletBalance={walletBalance}
                        isLoading={isLoading}
                    />
                </GameWindow>
            </div>
            </OvertimeZombieScaler>
        </div>
    );
};

const OvertimeZombieComponentWithSuspense: React.FC<OvertimeZombieComponentProps> = (props) => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <OvertimeZombieComponent {...props} />
        </Suspense>
    );
};

export default OvertimeZombieComponentWithSuspense;
