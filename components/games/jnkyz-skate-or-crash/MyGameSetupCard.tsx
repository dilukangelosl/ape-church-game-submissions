import React from "react";
import {
    Card,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { Game } from "@/lib/games";
import BetAmountInput from "@/components/shared/BetAmountInput";
import { CustomSlider } from "@/components/shared/CustomSlider";

interface MyGameSetupCardProps {
    game: Game;
    onPlay: () => Promise<void>;
    onCashout: () => void;
    onRewatch: () => void;
    onReset: () => void;
    onPlayAgain: () => Promise<void>;
    playAgainText?: string;
    currentView: 0 | 1 | 2;
    betAmount: number;
    setBetAmount: (amount: number) => void;
    autoCashoutAt: number | null;
    setAutoCashoutAt: (value: number | null) => void;
    isLoading: boolean;
    payout: number | null;
    multiplier: number;
    elapsedMs: number;
    inReplayMode: boolean;
    walletBalance: number;
    minBet: number;
    maxBet: number;
    isGameOngoing: boolean;
    crashAt: number | null;
    introSplashActive?: boolean;
}

const AUTO_CASHOUT_INFO =
    "When enabled, the game cashes out automatically once the multiplier reaches your target.";
const MAX_PROFIT_INFO =
    "Crash payout = bet amount × cashout multiplier.";
const BRAND_PRIMARY = "#7FFFD4";
const BRAND_SURFACE = "linear-gradient(160deg, rgba(7, 20, 28, 0.95), rgba(15, 40, 53, 0.9))";
const BRAND_BORDER = "rgba(127, 255, 212, 0.35)";

const MyGameSetupCard: React.FC<MyGameSetupCardProps> = ({
    game,
    onPlay,
    onCashout,
    onRewatch,
    onReset,
    onPlayAgain,
    playAgainText = "Play Again",
    currentView,
    betAmount,
    setBetAmount,
    autoCashoutAt,
    setAutoCashoutAt,
    isLoading,
    payout,
    multiplier,
    elapsedMs,
    inReplayMode,
    walletBalance,
    maxBet,
    minBet,
    isGameOngoing,
    crashAt,
    introSplashActive = false,
}) => {
    const themeColorBackground = BRAND_PRIMARY;
    const [usdMode, setUsdMode] = React.useState(false);
    const [autoEnabled, setAutoEnabled] = React.useState(autoCashoutAt !== null);
    const primaryButtonClass =
        "w-full border-0 text-[#042d28] font-black uppercase tracking-[0.12em] shadow-[0_0_24px_rgba(127,255,212,0.45)] hover:opacity-95";
    const secondaryButtonClass =
        "w-full border border-[#7FFFD466] bg-[#0D1D29]/85 text-[#C9FFF3] uppercase tracking-[0.08em] hover:bg-[#103346]";
    const statusText = currentView === 2
        ? ((payout ?? 0) > 0 ? "Cashed out safely." : "Wade Crashed")
        : isGameOngoing
            ? "Skating..."
            : "Ready to launch";
    const secondsText = `${(elapsedMs / 1000).toFixed(1)}s`;

    const getCurrentWalletAmount = (): number => {
        return walletBalance;
    };

    const getCurrentWalletAmountMinusReduction = (): number => {
        return walletBalance;
    };

    const getCurrentWalletAmountString = (): string => {
        return `${walletBalance.toFixed(2)} APE`;
    };

    const getBetAmountText = (): string => {
        return `${(betAmount || 0).toLocaleString([], {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
        })} APE`;

    };

    const getTotalBuyInText = (): string => {
        return `${(betAmount || 0).toLocaleString([], {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
        })} APE`;
    };

    const getTotalPayoutText = (): string => {
        return `${(payout || 0).toLocaleString([], {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
        })} APE`;
    };

    const getMaxProfitString = (): string => {
        const projected = autoCashoutAt ? betAmount * autoCashoutAt : 0;
        return `${projected.toLocaleString([], {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
        })} APE`;
    };

    const ShowInUsdAndStats = (invertOnDesktop: boolean) => {
        const showGreenText = (payout || 0) > betAmount;

        return (
            <div
                className={`${invertOnDesktop ? "flex-col-reverse lg:flex-col" : "flex-col"
                    } font-roboto flex gap-12 lg:gap-8`}
            >
                {inReplayMode && (
                    <p
                        className="mt-2 font-semibold text-3xl sm:text-3xl text-center"
                        style={{ color: themeColorBackground }}
                    >
                        Replay Mode
                    </p>
                )}

                {/* show in usd option */}
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <p className="text-foreground text-lg font-semibold">
                            Show Bets in USD
                        </p>
                        <p className="text-sm">
                            Your bets are valued in {usdMode ? "US Dollars" : "APE"}
                        </p>
                    </div>
                    <Switch
                        checked={usdMode}
                        onCheckedChange={() => {
                            setUsdMode(!usdMode);
                        }}
                    />
                </div>

                {/* stats */}
                <div className="w-full flex flex-col items-center gap-2 font-medium text-xs text-[#91989C]">
                    {/* bet per spin */}
                    <div className="w-full flex justify-between items-center gap-2">
                        <p>Bet Amount</p>
                        <p className="text-right">{getBetAmountText()}</p>
                    </div>
                    {/* bet per spin */}
                    <div className="w-full flex justify-between items-center gap-2">
                        <p>Total Buy In</p>
                        <p className="text-right">{getTotalBuyInText()}</p>
                    </div>
                    {/* total pay out */}
                    <div className="w-full flex justify-between items-center gap-2">
                        <p>Total Pay Out</p>
                        <p className={`text-right ${showGreenText ? "text-success" : ""}`}>
                            {getTotalPayoutText()}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    const ShowInUsdAndStatsFinalView = (invertOnDesktop: boolean) => {
        const showGreenText = (payout || 0) > betAmount;

        return (
            <div
                className={`${invertOnDesktop ? "flex-col-reverse lg:flex-col" : "flex-col"
                    } font-roboto flex gap-12 lg:gap-8`}
            >
                {inReplayMode && (
                    <p
                        className="mt-2 font-semibold text-3xl sm:text-3xl text-center"
                        style={{ color: themeColorBackground }}
                    >
                        Replay Mode
                    </p>
                )}

                {/* show in usd option */}
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <p className="text-foreground text-lg font-semibold">
                            Show Bets in USD
                        </p>
                        <p className="text-sm">Your bets are valued in US Dollars</p>
                    </div>
                    <Switch
                        checked={usdMode}
                        onCheckedChange={() => {
                            setUsdMode(!usdMode);
                        }}
                    />
                </div>

                {/* stats */}
                <div className="w-full flex flex-col items-center gap-2 font-medium text-xs text-[#91989C]">
                    {/* bet amount */}
                    <div className="w-full flex justify-between items-center gap-2">
                        <p>Bet Amount</p>
                        <p className="text-right">{getBetAmountText()}</p>
                    </div>
                    {/* bet per spin */}
                    <div className="w-full flex justify-between items-center gap-2">
                        <p>Total Buy In</p>
                        <p className="text-right">{getTotalBuyInText()}</p>
                    </div>
                    {/* total pay out */}
                    <div className="w-full flex justify-between items-center gap-2">
                        <p>Total Pay Out</p>
                        <p className={`text-right ${showGreenText ? "text-success" : ""}`}>
                            {getTotalPayoutText()}
                        </p>
                    </div>
                    <div className="w-full flex justify-between items-center gap-2">
                        <p>Wallet Balance</p>
                        <p className="text-right">{getCurrentWalletAmountString()}</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card
            className="lg:basis-1/3 p-6 flex flex-col border"
            style={{
                background: BRAND_SURFACE,
                borderColor: BRAND_BORDER,
                boxShadow: "0 0 30px rgba(0, 229, 255, 0.18)",
            }}
        >
            <div className="mb-5 flex items-center justify-between rounded-md border border-[#7FFFD444] bg-[#07131B]/75 px-3 py-2">
                <div>
                    <p className="text-sm font-bold tracking-[0.06em] text-[#ECFFFB]">{game.title}</p>
                    {introSplashActive && currentView === 0 ? (
                        <>
                            <p className="mt-2 text-lg font-black uppercase tracking-[0.08em] text-[#7FFFD4]">
                                How To Play
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-[#8AD9E8]">
                                Read the rules, then tap{" "}
                                <span className="font-semibold text-[#C9FFF3]">Agree &amp; Play</span>{" "}
                                on the game screen to set your bet and play.
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="mt-2 text-3xl font-black tracking-[0.06em] text-[#7FFFD4] drop-shadow-[0_0_18px_rgba(127,255,212,0.5)]">
                                {multiplier.toFixed(2)}x
                            </div>
                            <div className="mt-1 text-xs uppercase tracking-[0.09em] text-[#D8FFF6]">
                                {statusText}
                            </div>
                            <div className="mt-1 flex gap-3 text-[11px] text-[#98C9D3]">
                                <span>{secondsText}</span>
                                <span>Crash @{crashAt ? `${crashAt.toFixed(2)}x` : "--"}</span>
                            </div>
                        </>
                    )}
                </div>
                <img
                    src="/submissions/jnkyz-skate-or-crash/ui/jnkyz-logo-white.png"
                    alt="JNKYZ"
                    className="h-8 w-8 rounded-xl border border-[#7FFFD455] bg-transparent p-1 object-contain mix-blend-normal opacity-100"
                />
            </div>
            {currentView === 0 && introSplashActive ? (
                <>
                    <CardContent className="font-roboto grow">
                        <ul className="space-y-2.5 text-sm text-white/90">
                            <li>1. Set your bet amount and optional auto-cashout target.</li>
                            <li>
                                2. Press <span className="font-semibold">Place Your Bet</span> to start
                                the run.
                            </li>
                            <li>3. Multiplier rises while Wade skates — cash out before crash.</li>
                            <li>4. If crash happens first, you lose that round&apos;s bet.</li>
                            <li>5. Use Play Again, Rewatch, or Change Bet after each round.</li>
                        </ul>
                        <p className="mt-4 text-xs text-[#8AD9E8]">
                            Tip: Auto Cashout locks profit automatically at your target multiplier.
                        </p>
                    </CardContent>
                    <div className="grow" />
                </>
            ) : null}
            {currentView === 0 && !introSplashActive ? (
                <>
                    <CardContent className="font-roboto">
                        {/* place your bet button - mobile */}
                        <Button
                            onClick={onPlay}
                            className={`lg:hidden ${primaryButtonClass}`}
                            style={{
                                backgroundColor: themeColorBackground,
                                borderColor: themeColorBackground,
                            }}
                            disabled={betAmount <= 0 || isLoading}
                        >
                            Place Your Bet
                        </Button>

                        {/* bet amount */}
                        <div className="mt-5">
                            <BetAmountInput
                                min={0}
                                max={getCurrentWalletAmountMinusReduction()}
                                step={0.1}
                                value={betAmount}
                                onChange={setBetAmount}
                                balance={getCurrentWalletAmount()}
                                usdMode={usdMode}
                                setUsdMode={setUsdMode}
                                disabled={isLoading}
                                themeColorBackground={themeColorBackground}
                            />
                        </div>

                        <div className="mt-8">
                            <CustomSlider
                                label="Auto Cashout Target"
                                min={1.1}
                                max={10}
                                step={0.1}
                                value={autoCashoutAt ?? 1.1}
                                onChange={setAutoCashoutAt}
                                presets={[1.5, 2, 3]}
                                themeColor={themeColorBackground}
                                disabled={!autoEnabled || isLoading}
                            />
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-2">
                            <div>
                                <p className="text-foreground text-lg font-semibold">
                                    Enable Auto Cashout
                                </p>
                                <p className="text-sm text-[#8AD9E8]">
                                    Auto exits at target multiplier
                                </p>
                            </div>
                            <Switch
                                checked={autoEnabled}
                                onCheckedChange={(checked) => {
                                    setAutoEnabled(checked);
                                    setAutoCashoutAt(checked ? autoCashoutAt ?? 2 : null);
                                }}
                            />
                        </div>
                    </CardContent>

                    <div className="grow"></div>

                    <CardFooter className="mt-8 w-full flex flex-col font-roboto">
                        {/* stats */}
                        <div className="w-full flex flex-col items-center gap-2 rounded-md border border-[#7FFFD433] bg-[#07131B]/70 p-3 font-medium text-xs text-[#9CC5CF]">
                            <div className="w-full flex justify-between items-center gap-2">
                                <p>Auto Cashout</p>
                                <p className="text-right">
                                    {autoCashoutAt ? `${autoCashoutAt.toFixed(2)}x` : "Off"}
                                </p>
                            </div>
                            <div className="w-full flex justify-between items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <p>Auto Cashout</p>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <Info size={16} />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{AUTO_CASHOUT_INFO}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <p className="text-right">
                                    {autoCashoutAt ? `${autoCashoutAt.toFixed(2)}x` : "Off"}
                                </p>
                            </div>
                            <div className="w-full flex justify-between items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <p>Max Profit per Game</p>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <Info size={16} />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{MAX_PROFIT_INFO}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <p className="text-right">{getMaxProfitString()}</p>
                            </div>
                            <div className="w-full flex justify-between items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <p>Max Bet Per Game</p>
                                </div>
                                <p className="text-right">
                                    {maxBet.toLocaleString([], { maximumFractionDigits: 0 })} APE
                                </p>
                            </div>
                        </div>

                        <Button
                            onClick={onPlay}
                            className={`hidden lg:flex mt-6 ${primaryButtonClass}`}
                            style={{
                                backgroundColor: themeColorBackground,
                                borderColor: themeColorBackground,
                            }}
                            disabled={betAmount <= 0 || isLoading}
                        >
                            Place Your Bet
                        </Button>
                    </CardFooter>
                </>
            ) : null}
            {currentView === 1 && (
                <CardContent className="grow font-roboto flex flex-col-reverse lg:flex-col lg:justify-between gap-8">
                    {/* show in usd option + stats */}
                    {ShowInUsdAndStats(true)}

                    <div className="flex lg:flex-col justify-evenly items-center">
                        <div className="font-roboto flex flex-col items-center gap-3 w-full">
                            <Button
                                onClick={onCashout}
                                className={primaryButtonClass}
                                style={{
                                    backgroundColor: themeColorBackground,
                                    borderColor: themeColorBackground,
                                }}
                                disabled={!isGameOngoing}
                            >
                                Cash Out Now
                            </Button>
                            <p className="text-xs text-[#8AD9E8]">
                                Crash target is hidden until round ends.
                            </p>
                        </div>
                    </div>
                </CardContent>
            )}
            {currentView === 2 && (
                <CardContent className="grow font-roboto flex flex-col lg:justify-between gap-8">
                    {/* action buttons - mobile */}
                    <div className="lg:hidden">
                        <Button
                            className={primaryButtonClass}
                            style={{
                                backgroundColor: themeColorBackground,
                                borderColor: themeColorBackground,
                            }}
                            onClick={onPlayAgain}
                        >
                            {playAgainText}
                        </Button>

                        <Button
                            className={`mt-3 ${secondaryButtonClass}`}
                            onClick={onRewatch}
                        >
                            Rewatch Round
                        </Button>

                        <Button
                            className={`mt-3 ${secondaryButtonClass}`}
                            onClick={onReset}
                        >
                            Change Bet
                        </Button>
                    </div>

                    {/* show in usd option + stats */}
                    {ShowInUsdAndStatsFinalView(false)}

                    <div className="text-sm text-[#8AD9E8] text-center">
                        Final multiplier: {multiplier.toFixed(2)}x | Crash at{" "}
                        {crashAt ? `${crashAt.toFixed(2)}x` : "--"}
                    </div>

                    <CardFooter className="w-full hidden lg:block">
                        <div className="w-full flex flex-col gap-4">
                            <Button
                                className={primaryButtonClass}
                                style={{
                                    backgroundColor: themeColorBackground,
                                    borderColor: themeColorBackground,
                                }}
                                onClick={onPlayAgain}
                            >
                                {playAgainText}
                            </Button>

                            <Button
                                className={secondaryButtonClass}
                                onClick={onRewatch}
                            >
                                Rewatch Round
                            </Button>

                            <Button
                                className={secondaryButtonClass}
                                onClick={onReset}
                            >
                                Change Bet
                            </Button>
                        </div>
                    </CardFooter>
                </CardContent>
            )}
        </Card>
    );
};

export default MyGameSetupCard;
