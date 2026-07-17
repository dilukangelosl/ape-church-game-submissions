"use client";

import React, { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Game } from "@/lib/games";
import { cn } from "@/lib/utils";
import BetAmountInput from "@/components/shared/BetAmountInput";
import { BUST_PROBABILITY } from "./runwayWalkConfig";

interface RunwayWalkSetupCardProps {
    game: Game;
    placement?: "sidebar" | "standalone";
    className?: string;

    currentView: 0 | 1 | 2;
    betAmount: number;
    setBetAmount: (amount: number) => void;
    isLoading: boolean;

    currentStep: number;
    totalMultiplier: number;
    bonusMultiplier: number;
    busted: boolean;
    cashedOut: boolean;
    isAdvancing: boolean;
    inReplayMode: boolean;

    walletBalance: number;
    minBet: number;
    maxBet: number;

    onPlay: () => void;
    onCashOut: () => void;
    onPlayAgain: () => void;
    onReset: () => void;
    onRewatch: () => void;
    playAgainText?: string;
    payout: number | null;
    isGamePaused?: boolean;
}

function StatRow({
    label,
    value,
    valueClass = "text-white",
}: {
    label: string;
    value: string;
    valueClass?: string;
}): React.ReactElement {
    return (
        <div className="w-full flex justify-between items-center gap-2 text-xs font-medium">
            <p className="text-white/50">{label}</p>
            <p className={`text-right font-semibold ${valueClass}`}>{value}</p>
        </div>
    );
}

const RunwayWalkSetupCard: React.FC<RunwayWalkSetupCardProps> = ({
    placement = "sidebar",
    className,
    currentView,
    betAmount,
    setBetAmount,
    isLoading,
    currentStep,
    totalMultiplier,
    bonusMultiplier,
    busted,
    cashedOut,
    isAdvancing,
    inReplayMode,
    walletBalance,
    minBet,
    maxBet,
    onPlay,
    onCashOut,
    onPlayAgain,
    onReset,
    onRewatch,
    playAgainText = "Play Again",
    payout,
    isGamePaused = false,
}) => {
    const [usdMode, setUsdMode] = useState<boolean>(false);

    const canStartWalk = currentView === 0 && !isLoading && !inReplayMode && betAmount > 0;
    const canCashOut = currentView === 1 && !busted && !cashedOut && !isAdvancing && !inReplayMode && currentStep > 0;
    const potentialPayout = betAmount * totalMultiplier;
    const formatApe = (value: number): string =>
        `${value.toLocaleString([], { minimumFractionDigits: 0, maximumFractionDigits: 3 })} APE`;
    const netPayout = payout ?? 0;
    const isWin = netPayout > betAmount;
    const canPlayAgain = !inReplayMode;

    const actionButtons = () => (
        <>
            {currentView === 0 && (
                <Button
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold"
                    disabled={!canStartWalk}
                    onClick={onPlay}
                >
                    {isLoading ? "Starting…" : "Start the Walk"}
                </Button>
            )}
            {currentView === 1 && (
                <Button
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                    disabled={!canCashOut}
                    onClick={onCashOut}
                >
                    Cash Out
                </Button>
            )}
        </>
    );

    const gameOverActionButtons = () => (
        <div className="flex flex-col gap-2">
            {canPlayAgain ? (
                <Button
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold"
                    onClick={onPlayAgain}
                    disabled={isGamePaused}
                >
                    {playAgainText}
                </Button>
            ) : (
                <Button className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold" onClick={onRewatch}>
                    Rewatch Walk
                </Button>
            )}
            <Button className="w-full" variant="secondary" onClick={onReset}>
                Change Bet
            </Button>
            {canPlayAgain && currentStep > 0 && (
                <Button className="w-full text-xs opacity-70" variant="secondary" onClick={onRewatch}>
                    Rewatch Last Walk
                </Button>
            )}
        </div>
    );

    return (
        <Card
            className={cn(
                "w-full h-full min-h-0 flex flex-col overflow-hidden bg-[#12181C] border-[#2A3640] text-white",
                className
            )}
        >
            {(currentView === 0 || currentView === 1) && (
                <div className="shrink-0 lg:hidden px-6 pt-4 flex flex-col gap-2">
                    {actionButtons()}
                </div>
            )}
            {currentView === 2 && (
                <div className="shrink-0 lg:hidden px-6 pt-4 flex flex-col gap-2">
                    {gameOverActionButtons()}
                </div>
            )}

            <CardContent className="flex flex-col gap-4 pt-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                {currentView === 0 && (
                    <div>
                        <p className="text-xs uppercase tracking-wide text-white/50 mb-2">Bet amount</p>
                        <BetAmountInput
                            min={minBet}
                            max={maxBet}
                            step={1}
                            value={betAmount}
                            onChange={setBetAmount}
                            balance={walletBalance}
                            disabled={currentView !== 0 || isLoading}
                            usdMode={usdMode}
                            setUsdMode={setUsdMode}
                            themeColorBackground="#1a1030"
                        />
                        <p className="text-xs text-white/50 text-center mt-3">
                            Pick 1 of 5 tiles each step — 1 hides a stumble ({Math.round(BUST_PROBABILITY * 100)}% odds). Cash out anytime.
                        </p>
                    </div>
                )}

                {currentView === 1 && (
                    <div className="flex flex-col gap-2 text-center">
                        <p className="text-xs uppercase tracking-wide text-white/50">Current multiplier</p>
                        <p className="text-2xl font-bold text-amber-300">{totalMultiplier.toFixed(2)}x</p>
                        {bonusMultiplier > 1 && (
                            <p className="text-xs text-emerald-300 font-semibold">🔥 {bonusMultiplier.toFixed(2)}x streak bonus active!</p>
                        )}
                        <p className="text-xs text-white/50">
                            Cash out now for <span className="text-emerald-300 font-semibold">{potentialPayout.toFixed(2)}</span>
                        </p>
                        <p className="text-xs text-white/40 mt-1">Pick a tile on the runway to take your next step.</p>
                    </div>
                )}

                {currentView === 2 && (
                    <div className="flex flex-col gap-4">
                        {inReplayMode && (
                            <p className="text-center text-sm font-semibold text-amber-400/90">Replay Mode</p>
                        )}
                        <div
                            className="rounded-xl px-4 py-3 text-center"
                            style={{
                                background: busted
                                    ? "rgba(239,68,68,0.1)"
                                    : isWin
                                      ? "rgba(52,211,153,0.12)"
                                      : "rgba(245,158,11,0.1)",
                                border: `2px solid ${busted ? "#ef4444" : isWin ? "#34d399" : "#f59e0b"}`,
                            }}
                        >
                            <p
                                className="text-[10px] uppercase tracking-widest mb-1"
                                style={{ color: busted ? "#ef4444" : isWin ? "#34d399" : "#fbbf24" }}
                            >
                                {busted ? "Stumble — walk over" : cashedOut ? "Cashed out" : "Run complete"}
                            </p>
                            <p
                                className="text-2xl font-bold"
                                style={{ color: busted ? "#ef4444" : isWin ? "#34d399" : "#fbbf24" }}
                            >
                                {busted
                                    ? "0 APE"
                                    : `${netPayout > betAmount ? "+" : ""}${formatApe(netPayout)}`}
                            </p>
                        </div>

                        <div className="rounded-lg border border-white/10 bg-black/20 p-3 flex flex-col gap-2">
                            <StatRow label="Bet amount" value={formatApe(betAmount)} />
                            <StatRow
                                label="Total payout"
                                value={formatApe(netPayout)}
                                valueClass={isWin ? "text-emerald-300" : busted ? "text-red-400" : "text-white"}
                            />
                            <StatRow label="Final multiplier" value={`${totalMultiplier.toFixed(2)}x`} valueClass="text-amber-300" />
                            <StatRow label="Steps taken" value={String(currentStep)} />
                            {bonusMultiplier > 1 && (
                                <StatRow
                                    label="Bonus applied"
                                    value={`${bonusMultiplier.toFixed(2)}x`}
                                    valueClass="text-emerald-300"
                                />
                            )}
                        </div>
                    </div>
                )}

                <div className="grow hidden lg:block" />
            </CardContent>

            <CardFooter className="hidden lg:flex flex-col gap-2 shrink-0">
                {currentView === 2 ? gameOverActionButtons() : actionButtons()}
            </CardFooter>
        </Card>
    );
};

export default RunwayWalkSetupCard;
