import React from "react";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Game } from "@/lib/games";
import BetAmountInput from "@/components/shared/BetAmountInput";
import ChipSelection, { Chip } from "@/components/shared/ChipSelection";

interface WalletAccount {
  address: string;
}

interface MyGameSetupCardProps {
  game: Game;
  onPlay: () => void;
  onSpin: () => void;
  onRewatch: () => void;
  onReset: () => void;
  onPlayAgain: () => void;
  playAgainText?: string;
  currentView: 0 | 1 | 2;

  betAmount: number;
  setBetAmount: (amount: number) => void;
  numberOfSpins: number;
  setNumberOfSpins: (spins: number) => void;
  isLoading: boolean;
  payout: number | null;
  spinsLeft: number;
  jackpotMultiplier: number;
  inReplayMode: boolean;

  account?: WalletAccount;
  walletBalance: number;
  playerAddress?: string;
  isGamePaused?: boolean;
  profile?: unknown;
  minBet: number;
  maxBet: number;
}

const MyGameSetupCard: React.FC<MyGameSetupCardProps> = ({
  game,
  onPlay,
  onSpin,
  onRewatch,
  onReset,
  onPlayAgain,
  playAgainText = "Play Again",
  currentView,
  betAmount,
  setBetAmount,
  numberOfSpins,
  setNumberOfSpins,
  isLoading,
  payout,
  spinsLeft,
  jackpotMultiplier,
  inReplayMode,
  account,
  playerAddress,
  walletBalance,
  isGamePaused = false,
  profile,
  maxBet,
  minBet,
}) => {
  const themeColorBackground = game.themeColorBackground;
  const usdMode = false;

  void onSpin;
  void numberOfSpins;
  void setNumberOfSpins;
  void spinsLeft;
  void profile;

  const chips: Chip[] = [
    { id: "1", value: 1, image: "/shared/chips/chip_1.png" },
    { id: "5", value: 5, image: "/shared/chips/chip_5.png" },
    { id: "10", value: 10, image: "/shared/chips/chip_10.png" },
    { id: "25", value: 25, image: "/shared/chips/chip_25.png" },
  ];

  const [selectedChipId, setSelectedChipId] = React.useState<string | null>(null);

  const getCurrentWalletAmount = (): number => {
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

  const getPotentialWinAmount = (): number => {
    return betAmount * jackpotMultiplier;
  };

  const getPotentialWinAmountString = (): string => {
    const value = getPotentialWinAmount();
    return `${value.toLocaleString([], {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    })} APE`;
  };

  const getMaxProfitString = (): string => {
    const value = Math.max(getPotentialWinAmount() - betAmount, 0);
    return `${value.toLocaleString([], {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    })} APE`;
  };

  const canReplay = (): boolean => {
    if (!playerAddress || !account) {
      return false;
    }

    if (inReplayMode) {
      return false;
    }

    return playerAddress.toLowerCase() === account.address.toLowerCase();
  };

  const handleChipSelect = (chip: Chip): void => {
    setSelectedChipId(chip.id);
    setBetAmount(chip.value);
  };

  const showPositivePayout = (payout || 0) > betAmount;

  return (
    <Card className="lg:basis-1/3 p-6 flex flex-col">
      {currentView === 0 && (
        <>
          <CardContent className="font-roboto">
            <Button
              onClick={onPlay}
              className="lg:hidden w-full my-game-setup-primary"
              style={{
                backgroundColor: themeColorBackground,
                borderColor: themeColorBackground,
              }}
              disabled={betAmount <= 0 || isGamePaused || isLoading}
            >
              Deal Cards
            </Button>

            <div className="mt-5">
              <BetAmountInput
                min={minBet}
                max={Math.min(maxBet, getCurrentWalletAmount())}
                step={1}
                value={betAmount}
                onChange={setBetAmount}
                balance={getCurrentWalletAmount()}
                usdMode={usdMode}
                setUsdMode={() => undefined}
                disabled={isLoading || isGamePaused}
                themeColorBackground={themeColorBackground}
              />
            </div>

            <ChipSelection
              chips={chips}
              selectedChipId={selectedChipId}
              onChipSelect={handleChipSelect}
              onRemoveAllBets={() => {
                setSelectedChipId(null);
                setBetAmount(minBet);
              }}
            />
          </CardContent>

          <div className="grow" />

          <CardFooter className="mt-8 w-full flex flex-col font-roboto">
            <div className="w-full flex flex-col items-center gap-2 font-medium text-xs text-[#91989C]">
              <div className="w-full flex justify-between items-center gap-2">
                <p>Game</p>
                <p className="text-right">Blackjack</p>
              </div>

              <div className="w-full flex justify-between items-center gap-2">
                <p>Bet Amount</p>
                <p className="text-right">{getBetAmountText()}</p>
              </div>

              <div className="w-full flex justify-between items-center gap-2">
                <p>Potential Win</p>
                <p className="text-right">{getPotentialWinAmountString()}</p>
              </div>

              <div className="w-full flex justify-between items-center gap-2">
                <p>Max Profit</p>
                <p className="text-right">{getMaxProfitString()}</p>
              </div>

              <div className="w-full flex justify-between items-center gap-2">
                <p>Wallet Balance</p>
                <p className="text-right">{getCurrentWalletAmountString()}</p>
              </div>

              <div className="w-full flex justify-between items-center gap-2">
                <p>Min Bet</p>
                <p className="text-right">
                  {minBet.toLocaleString([], { maximumFractionDigits: 0 })} APE
                </p>
              </div>

              <div className="w-full flex justify-between items-center gap-2">
                <p>Max Bet</p>
                <p className="text-right">
                  {maxBet.toLocaleString([], { maximumFractionDigits: 0 })} APE
                </p>
              </div>
            </div>

            <Button
              onClick={onPlay}
              className="hidden lg:flex mt-6 w-full my-game-setup-primary"
              style={{
                backgroundColor: themeColorBackground,
                borderColor: themeColorBackground,
              }}
              disabled={betAmount <= 0 || isGamePaused || isLoading}
            >
              Deal Cards
            </Button>
          </CardFooter>
        </>
      )}

      {currentView === 1 && (
        <CardContent className="grow font-roboto flex flex-col justify-between gap-8">
          <div className="flex flex-col gap-8">
            {inReplayMode && (
              <p
                className="mt-2 font-semibold text-3xl sm:text-3xl text-center"
                style={{ color: themeColorBackground }}
              >
                Replay Mode
              </p>
            )}

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
                onCheckedChange={() => undefined}
                aria-readonly
              />
            </div>

            <div className="w-full flex flex-col items-center gap-2 font-medium text-xs text-[#91989C]">
              <div className="w-full flex justify-between items-center gap-2">
                <p>Current Bet</p>
                <p className="text-right">{getTotalBuyInText()}</p>
              </div>

              <div className="w-full flex justify-between items-center gap-2">
                <p>Potential Win</p>
                <p className="text-right">{getPotentialWinAmountString()}</p>
              </div>

              <div className="w-full flex justify-between items-center gap-2">
                <p>Current Payout</p>
                <p className={`text-right ${showPositivePayout ? "text-success" : ""}`}>
                  {getTotalPayoutText()}
                </p>
              </div>

              <div className="w-full flex justify-between items-center gap-2">
                <p>Wallet Balance</p>
                <p className="text-right">{getCurrentWalletAmountString()}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              className="w-full my-game-setup-secondary"
              style={{
                backgroundColor: themeColorBackground,
                borderColor: themeColorBackground,
              }}
              onClick={onReset}
            >
              Change Bet
            </Button>
          </div>
        </CardContent>
      )}

      {currentView === 2 && (
        <CardContent className="grow font-roboto flex flex-col lg:justify-between gap-8">
          <div className="lg:hidden">
            {canReplay() ? (
              <Button
                className="w-full my-game-setup-primary"
                style={{
                  backgroundColor: themeColorBackground,
                  borderColor: themeColorBackground,
                }}
                onClick={onPlayAgain}
                disabled={isGamePaused}
              >
                {playAgainText}
              </Button>
            ) : (
              <Button
                className="w-full my-game-setup-primary"
                style={{
                  backgroundColor: themeColorBackground,
                  borderColor: themeColorBackground,
                }}
                onClick={onRewatch}
              >
                Rewatch Round
              </Button>
            )}

            <Button
              className="w-full mt-3 my-game-setup-secondary"
              variant="secondary"
              onClick={onReset}
            >
              Change Bet
            </Button>
          </div>

          <div className="flex flex-col gap-8">
            {inReplayMode && (
              <p
                className="mt-2 font-semibold text-3xl sm:text-3xl text-center"
                style={{ color: themeColorBackground }}
              >
                Replay Mode
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-foreground text-lg font-semibold">
                  Show Bets in USD
                </p>
                <p className="text-sm">Your bets are valued in APE</p>
              </div>
              <Switch
                checked={usdMode}
                onCheckedChange={() => undefined}
                aria-readonly
              />
            </div>

            <div className="w-full flex flex-col items-center gap-2 font-medium text-xs text-[#91989C]">
              <div className="w-full flex justify-between items-center gap-2">
                <p>Total Bet</p>
                <p className="text-right">{getTotalBuyInText()}</p>
              </div>

              <div className="w-full flex justify-between items-center gap-2">
                <p>Total Payout</p>
                <p className={`text-right ${showPositivePayout ? "text-success" : ""}`}>
                  {getTotalPayoutText()}
                </p>
              </div>

              <div className="w-full flex justify-between items-center gap-2">
                <p>Potential Win</p>
                <p className="text-right">{getPotentialWinAmountString()}</p>
              </div>

              <div className="w-full flex justify-between items-center gap-2">
                <p>Wallet Balance</p>
                <p className="text-right">{getCurrentWalletAmountString()}</p>
              </div>
            </div>
          </div>

          <CardFooter className="w-full hidden lg:block px-0">
            <div className="w-full flex flex-col gap-4">
              {canReplay() ? (
                <Button
                  className="w-full my-game-setup-primary"
                  style={{
                    backgroundColor: themeColorBackground,
                    borderColor: themeColorBackground,
                  }}
                  onClick={onPlayAgain}
                  disabled={isGamePaused}
                >
                  {playAgainText}
                </Button>
              ) : (
                <Button
                  className="w-full my-game-setup-primary"
                  style={{
                    backgroundColor: themeColorBackground,
                    borderColor: themeColorBackground,
                  }}
                  onClick={onRewatch}
                >
                  Rewatch Round
                </Button>
              )}

              <Button
                className="w-full my-game-setup-secondary"
                variant="secondary"
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