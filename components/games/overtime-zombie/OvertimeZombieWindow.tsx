"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Game } from "@/lib/games";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BigWinLevel, CellState, FloatingPayoff, METER_STAGE_THRESHOLD, formatApe, formatApeCompact, formatApeFull } from "./overtimeZombieConfig";
import Board from "./Board";
import ProgressBar from "./ProgressBar";
import PayTableModal from "./PayTableModal";
import SetupOverlay from "./SetupOverlay";
import { playSound } from "./soundManager";

// Stage backgrounds (index 0 = starting bg, 1-4 = stage 2-5). Crossfade between these
// as the meter fills. The bonus background swaps in instantly (handled separately).
const STAGE_BACKGROUNDS = [
    "/submissions/overtime-zombie/backgroundStage1.webp",
    "/submissions/overtime-zombie/backgroundStage2.webp",
    "/submissions/overtime-zombie/backgroundStage3.webp",
    "/submissions/overtime-zombie/backgroundStage4.webp",
    "/submissions/overtime-zombie/backgroundStage5.webp",
] as const;
const BONUS_BACKGROUND = "/submissions/overtime-zombie/backgroundBonus.webp";

interface OvertimeZombieWindowProps {
    game: Game;
    board: CellState[][];
    meterPoints: number;
    cascadeCount: number;
    zombieReleased: boolean;
    totalPointsThisSpin: number;
    totalPayoutThisSpin: number;
    isAnimating: boolean;
    isKicking: boolean;
    isBonusRound: boolean;
    bonusWorkersFound: number;
    bonusMultiplier: number;
    isRevealingWorkers: boolean;
    revealScanIndex: number;
    revealHighlightCell: [number, number] | null;
    floatingPayoff: FloatingPayoff | null;
    bigWinLevel: BigWinLevel | null;
    // Spin + stats wiring
    onSpin: () => void;
    canSpin: boolean;
    betAmount: number;
    numberOfSpins: number;
    payout: number | null;
    totalWagered: number;
    spinsRemaining: number;
    isPlaying: boolean;
    // Setup overlay wiring
    currentView: 0 | 1 | 2;
    setBetAmount: (amount: number) => void;
    setNumberOfSpins: (n: number) => void;
    onPlay: () => void;
    walletBalance: number;
    isLoading: boolean;
}

const OvertimeZombieWindow: React.FC<OvertimeZombieWindowProps> = ({
    game,
    board,
    meterPoints,
    cascadeCount,
    zombieReleased,
    isBonusRound,
    isRevealingWorkers,
    revealScanIndex,
    revealHighlightCell,
    floatingPayoff,
    bigWinLevel,
    onSpin,
    canSpin,
    betAmount,
    numberOfSpins,
    payout,
    totalPayoutThisSpin,
    totalWagered,
    spinsRemaining,
    isPlaying,
    bonusMultiplier,
    currentView,
    setBetAmount,
    setNumberOfSpins,
    onPlay,
    walletBalance,
    isLoading,
}) => {
    const [showPayTable, setShowPayTable] = useState(false);

    // Local mirror of the floating payoff so the text can fade out gracefully
    // when restock clears the parent state instead of popping off.
    const [floatState, setFloatState] = useState<{ payoff: FloatingPayoff; key: number; fading: boolean } | null>(null);

    useEffect(() => {
        if (floatingPayoff !== null) {
            // New (or refreshed) match/kick/spinTotal: replace, key on cascadeCount
            // to ensure the float-in animation replays for every cascade step.
            setFloatState({ payoff: floatingPayoff, key: cascadeCount, fading: false });
            return;
        }
        // Parent cleared the value (restock or SPIN press). Start fading the
        // existing text out, then unmount after the fade completes.
        setFloatState((prev) => (prev && !prev.fading ? { ...prev, fading: true } : prev));
        const timer = setTimeout(() => setFloatState(null), 180);
        return () => clearTimeout(timer);
    }, [floatingPayoff, cascadeCount]);

    // Roll-up animation for the spin-total float ("+0 APE" → "+25.5 APE" over ~800ms).
    // Other float types ignore this — they render their value directly.
    const [rollupValue, setRollupValue] = useState(0);
    const spinTotalTarget = floatState?.payoff.type === "spinTotal" ? floatState.payoff.value : null;
    const spinTotalKey = floatState?.payoff.type === "spinTotal" ? floatState.key : null;
    useEffect(() => {
        if (spinTotalTarget === null) {
            setRollupValue(0);
            return;
        }
        const target = spinTotalTarget;
        const duration = 800;
        const start = performance.now();
        let raf = requestAnimationFrame(function tick(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
            setRollupValue(target * eased);
            if (t < 1) raf = requestAnimationFrame(tick);
        });
        return () => cancelAnimationFrame(raf);
    }, [spinTotalTarget, spinTotalKey]);

    // Live "Won" total — committed payout plus any APE accumulated mid-spin.
    // Climbs in real time as cascades resolve so the player sees the total grow.
    const liveWon = (payout ?? 0) + totalPayoutThisSpin;

    // Auto-shrink the float text to fit the meter-wide overlay when a large
    // payoff would otherwise spill outside the machine. Measures the FINAL
    // text (target for spinTotal rollups, exact value otherwise) so the
    // font-size is locked for the whole animation and rollup digits never
    // jitter. peakScale accounts for the float-in animation's overshoot.
    const floatOverlayRef = useRef<HTMLDivElement>(null);
    const floatTextRef = useRef<HTMLSpanElement>(null);
    const floatPayoff = floatState?.payoff;
    const floatKey = floatState?.key ?? null;
    useLayoutEffect(() => {
        const overlayEl = floatOverlayRef.current;
        const textEl = floatTextRef.current;
        if (!overlayEl || !textEl || !floatPayoff) return;
        let finalText: string;
        let peakScale: number;
        if (floatPayoff.type === "kick") {
            finalText = "Kick the Machine!";
            peakScale = 1.06;
        } else if (floatPayoff.type === "spinTotal") {
            finalText = `+${formatApeCompact(floatPayoff.value)}`;
            peakScale = 1.18;
        } else {
            finalText = `+${formatApe(floatPayoff.value)}`;
            peakScale = 1.18;
        }
        textEl.style.fontSize = "";
        const cs = window.getComputedStyle(textEl);
        const baseSize = parseFloat(cs.fontSize);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.font = `${baseSize}px ${cs.fontFamily}`;
        const naturalWidth = ctx.measureText(finalText).width;
        const effectiveWidth = naturalWidth * peakScale;
        const containerWidth = overlayEl.clientWidth;
        if (effectiveWidth > containerWidth) {
            const newSize = Math.floor(baseSize * (containerWidth / effectiveWidth));
            textEl.style.fontSize = `${newSize}px`;
        }
    }, [floatKey, floatPayoff]);

    const formatAmount = (val: number): string =>
        `${val.toLocaleString([], { minimumFractionDigits: 0, maximumFractionDigits: 3 })} APE`;

    const perSpin = numberOfSpins > 0 ? betAmount / numberOfSpins : betAmount;

    // Background progression: which stage layer is active (0 = start, up to 4 = stage 5).
    // The bonus background overrides everything when the zombie is released.
    const isBonusBg = zombieReleased || isBonusRound;
    const activeStage = Math.min(
        Math.floor(meterPoints / METER_STAGE_THRESHOLD),
        STAGE_BACKGROUNDS.length - 1
    );

    return (
        <div className="absolute inset-0 z-0">
            {/* Background layers — stage backgrounds crossfade as the meter fills */}
            <div className="sa-bg-stack">
                {/* Always-on base (starting background) so there's never a transparent flash */}
                <div
                    className="sa-bg-base"
                    style={{ backgroundImage: `url(${STAGE_BACKGROUNDS[0]})` }}
                />
                {/* Stage 2-5 crossfade in on top of the base as the meter climbs */}
                {STAGE_BACKGROUNDS.slice(1).map((src, i) => (
                    <div
                        key={src}
                        className="sa-bg-layer"
                        data-active={!isBonusBg && i + 1 <= activeStage}
                        style={{ backgroundImage: `url(${src})` }}
                    />
                ))}
                {/* Bonus background — instant swap (no crossfade) to feel distinct */}
                <div
                    className="sa-bg-bonus"
                    data-active={isBonusBg}
                    style={{ backgroundImage: `url(${BONUS_BACKGROUND})` }}
                />
            </div>

            {/* Setup overlay — only during setup view */}
            {currentView === 0 && (
                <>
                    <div className="sa-setup-overlay">
                        <SetupOverlay
                            themeColor={game.themeColorBackground}
                            betAmount={betAmount}
                            setBetAmount={setBetAmount}
                            numberOfSpins={numberOfSpins}
                            setNumberOfSpins={setNumberOfSpins}
                            walletBalance={walletBalance}
                            isLoading={isLoading}
                        />
                    </div>

                    {/* Place Your Bet button — positioned over the snack door */}
                    <div className="sa-place-bet-overlay">
                        <button
                            type="button"
                            className="sa-place-bet-button"
                            onClick={onPlay}
                            disabled={betAmount <= 0 || isLoading}
                            style={{
                                backgroundColor: game.themeColorBackground,
                                borderColor: game.themeColorBackground,
                            }}
                        >
                            PLACE YOUR BET
                        </button>
                    </div>
                </>
            )}

            {/* Board positioned over the vending machine black window — hidden during setup */}
            {currentView !== 0 && (
                <div className="sa-vending-overlay">
                    <Board
                        board={board}
                        cascadeCount={cascadeCount}
                        isBonusRound={isBonusRound}
                        isRevealingWorkers={isRevealingWorkers}
                        revealScanIndex={revealScanIndex}
                        revealHighlightCell={revealHighlightCell}
                        isPlaying={isPlaying}
                        bonusMultiplier={bonusMultiplier}
                    />
                </div>
            )}

            {/* Pulsing bonus-round frame around the board (separate element so it isn't clipped).
                Default state is purple (zombie released, board still cascading); switches to red
                once the worker-attack scan/crawl begins, and STAYS red through the post-scan
                payout window until the bonus round ends. */}
            {currentView !== 0 && isBonusRound && (
                <div className={`sa-bonus-frame${revealScanIndex !== -1 ? " sa-bonus-frame-attack" : ""}`} />
            )}

            {/* Zombie meter positioned over the dispenser door — only during play. */}
            {isPlaying && (!isBonusRound || zombieReleased) && (
                <div className="sa-meter-overlay">
                    <ProgressBar
                        points={meterPoints}
                        zombieReleased={zombieReleased || isBonusRound}
                        inAttackPhase={revealScanIndex !== -1}
                    />
                </div>
            )}

            {/* Floating payoff text under the meter:
                - "ape": per-cascade match payout (+N APE)
                - "kick": "Kick the Machine!" banner
                - "spinTotal": end-of-spin total, rolls up from 0 to value and
                  holds until the next SPIN press (parent clears it).
                Shown during bonus rounds too since cascades now award APE there. */}
            {isPlaying && floatState !== null && (() => {
                const { payoff, fading, key } = floatState;
                let text: string;
                if (payoff.type === "kick") {
                    text = "Kick the Machine!";
                } else if (payoff.type === "spinTotal") {
                    // Match the final value's decimal count for a stable
                    // rollup — e.g. target 25 → "0 → 4 → 17 → 25" (no decimals),
                    // target 25.5 → "0.0 → 4.5 → 17.1 → 25.5".
                    const targetCompactStr = parseFloat(payoff.value.toFixed(2)).toString();
                    const dotIdx = targetCompactStr.indexOf(".");
                    const decimals = dotIdx === -1 ? 0 : targetCompactStr.length - dotIdx - 1;
                    // Drop the "+" prefix on a no-win spin so "0 APE" reads
                    // as a flat result rather than a gain of zero.
                    const prefix = payoff.value > 0 ? "+" : "";
                    text = `${prefix}${rollupValue.toFixed(decimals)} APE`;
                } else {
                    text = `+${formatApe(payoff.value)}`;
                }
                const isNoWinSpinTotal = payoff.type === "spinTotal" && payoff.value === 0;
                const classes = [
                    "sa-match-float-text",
                    payoff.type === "kick" ? "sa-match-float-text-kick" : "",
                    isNoWinSpinTotal ? "sa-match-float-text-nowin" : "",
                    fading ? "sa-match-float-text-fade" : "",
                ].filter(Boolean).join(" ");
                return (
                    <div className="sa-match-float-overlay" ref={floatOverlayRef}>
                        <span key={`float-${key}`} className={classes} ref={floatTextRef}>{text}</span>
                    </div>
                );
            })()}

            {/* Stats overlay (top-right) — only during play */}
            {isPlaying && (
            <div className="sa-stats-overlay">
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
                                <span className={`sa-stat-value sa-stat-value-tooltip ${liveWon > 0 ? "sa-stat-win" : ""}`}>
                                    {formatApeCompact(liveWon)}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="sa-tooltip-hint">
                                {formatApeFull(liveWon)}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <div className="sa-stat-divider" />
                <div className="sa-stat-row">
                    <span className="sa-stat-label">Wagered</span>
                    <span className="sa-stat-value">{formatAmount(totalWagered)}</span>
                </div>
                <div className="sa-stat-row">
                    <span className="sa-stat-label">Per Spin</span>
                    <span className="sa-stat-value">{formatAmount(perSpin)}</span>
                </div>
            </div>
            )}

            {/* Spin button on the vending machine */}
            <button
                type="button"
                className={`sa-spin-button ${canSpin ? "sa-spin-button-active" : "sa-spin-button-disabled"} ${currentView === 0 ? "sa-button-splash" : ""}`}
                onClick={onSpin}
                disabled={!canSpin}
                aria-label="Spin"
            >
                <img src="/submissions/overtime-zombie/spinButton.webp" alt="Spin" className="sa-spin-button-img sa-spin-button-img-base" />
                <img src="/submissions/overtime-zombie/spinButtonAlt.webp" alt="" className="sa-spin-button-img sa-spin-button-img-alt" />
            </button>

            {/* Info button below coin return */}
            <button
                type="button"
                className={`sa-info-button ${currentView === 0 ? "sa-button-splash" : ""}`}
                onClick={() => { playSound("openInfo"); setShowPayTable(true); }}
                aria-label="Show pay table"
            >
                <img src="/submissions/overtime-zombie/infoButton.webp" alt="Info" />
            </button>

            {/* Big-win splash — celebrates thresholds set at spin end.
                Renders over the game frame (not full window) so the asset's
                zombie art sits in the vending machine display area. Text
                positioned over the zombie's head, themed by tier:
                  bigWin (non-bonus 2x+ wager)   → neon green
                  feast (bonus, 1-5 workers)     → red
                  massacre (bonus, 6+ workers)   → purple
                Auto-dismisses after 2s on final spins (parent clears
                bigWinLevel from the end-of-game effect); on non-final spins
                it holds until the SPIN press (INITIAL_GAME_STATE spread in
                handleStateAdvance clears it). */}
            {bigWinLevel !== null && (
                <div className={`sa-big-win-splash sa-big-win-${bigWinLevel}`}>
                    <div className="sa-big-win-content">
                        <img
                            src="/submissions/overtime-zombie/BigWinArt.webp"
                            alt=""
                            className="sa-big-win-art"
                        />
                        <span className="sa-big-win-text">
                            {bigWinLevel === "bigWin" && <>BIG<br />WIN!</>}
                            {bigWinLevel === "feast" && <>ZOMBIE<br />FEAST!</>}
                            {bigWinLevel === "massacre" && <>OVERTIME<br />MASSACRE!</>}
                        </span>
                    </div>
                </div>
            )}

            <PayTableModal isOpen={showPayTable} onClose={() => { playSound("closeInfo"); setShowPayTable(false); }} />
        </div>
    );
};

export default OvertimeZombieWindow;
