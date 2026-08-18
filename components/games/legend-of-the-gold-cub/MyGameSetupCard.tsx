import React, { useState } from 'react';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import { Game } from '@/lib/games';
import BetAmountInput from '@/components/shared/BetAmountInput';
import { CustomSlider } from '@/components/shared/CustomSlider';
import { HUD_PANEL_CARD_CLASS } from '@/components/shared/GameHud';
import { cn } from '@/lib/utils';
import Paytable from './slot/Paytable';
import { GamePhase } from './types';

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

  account?: unknown;
  walletBalance: number;
  playerAddress?: string;
  isGamePaused?: boolean;
  profile?: unknown;
  minBet: number;
  maxBet: number;
  freeSpinsRemaining: number;
  phase: GamePhase;
}

const MAX_SPINS = 15;
const JACKPOT_AMOUNT_INFO = 'Maximum payout from a single spin (5× Golden Cub on one payline).';
const MAX_PROFIT_INFO = 'Jackpot amount × number of paylines hit simultaneously.';

const MyGameSetupCard: React.FC<MyGameSetupCardProps> = ({
  game,
  onPlay,
  onSpin,
  onRewatch,
  onReset,
  onPlayAgain,
  playAgainText = 'Play Again',
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
  maxBet,
  minBet,
  freeSpinsRemaining,
  phase,
}) => {
  const themeColorBackground = game.themeColorBackground;
  const usdMode = false;
  const [showPaytable, setShowPaytable] = useState(false);
  const betPerSpin   = betAmount;
  const betPerLine   = betAmount / 20;
  const totalBuyIn   = betAmount * numberOfSpins;
  const jackpotAmt   = betPerLine * jackpotMultiplier;

  const fmt = (n: number) => n.toLocaleString([], { minimumFractionDigits: 0, maximumFractionDigits: 3 });

  const canSpin = phase === 'IDLE' && freeSpinsRemaining === 0 && spinsLeft > 0;

  const canReplay = (): boolean => {
    if (!playerAddress || !account || inReplayMode) return false;
    return playerAddress.toLowerCase() === (account as { address: string }).address?.toLowerCase();
  };

  const SpinsLeftBlock = (hideOnDesktop: boolean) => (
    <div className={`${hideOnDesktop ? 'lg:hidden' : 'hidden lg:block'} text-center font-nohemia`}>
      {freeSpinsRemaining > 0 ? (
        <>
          <p className="text-lg font-medium" style={{ color: themeColorBackground }}>Free Spins</p>
          <p className="mt-2 font-semibold text-2xl sm:text-5xl" style={{ color: '#FFD700' }}>
            {freeSpinsRemaining}
          </p>
        </>
      ) : (
        <>
          <p className="text-lg font-medium text-[#91989C]">Spins Left</p>
          <p className="mt-2 font-semibold text-2xl sm:text-5xl" style={{ color: themeColorBackground }}>
            {spinsLeft} / {numberOfSpins}
          </p>
        </>
      )}
    </div>
  );

  const StatsBlock = (invertOnDesktop: boolean) => {
    const showGreen = (payout ?? 0) > betAmount * numberOfSpins;
    return (
      <div className={`${invertOnDesktop ? 'flex-col-reverse lg:flex-col' : 'flex-col'} font-roboto flex gap-12 lg:gap-8`}>
        {inReplayMode && (
          <p className="mt-2 font-semibold text-3xl sm:text-3xl text-center" style={{ color: themeColorBackground }}>
            Replay Mode
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-foreground text-lg font-semibold">Show Bets in USD</p>
            <p className="text-sm">Your bets are valued in {usdMode ? 'US Dollars' : 'APE'}</p>
          </div>
          <Switch checked={usdMode} onCheckedChange={() => {}} aria-readonly />
        </div>
        <div className="w-full flex flex-col items-center gap-2 font-medium text-xs text-[#91989C]">
          <div className="w-full flex justify-between items-center gap-2">
            <p>Bet Per Spin</p>
            <p>{fmt(betPerSpin)} APE</p>
          </div>
          <div className="w-full flex justify-between items-center gap-2">
            <p>Total Buy In</p>
            <p>{fmt(totalBuyIn)} APE</p>
          </div>
          <div className="w-full flex justify-between items-center gap-2">
            <p>Total Pay Out</p>
            <p className={showGreen ? 'text-success' : ''}>{fmt(payout ?? 0)} APE</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {showPaytable && <Paytable onClose={() => setShowPaytable(false)} />}

      <Card className={cn('w-full h-full min-h-[400px] p-6 flex flex-col', HUD_PANEL_CARD_CLASS)}>
        {currentView === 0 && (
          <>
            <CardContent className="font-roboto">
              {/* Mobile play button */}
              <Button
                onClick={onPlay}
                className="lg:hidden w-full"
                style={{ backgroundColor: themeColorBackground }}
                disabled={betAmount <= 0 || isGamePaused}
              >
                Search for the Cub
              </Button>

              {/* Bet amount */}
              <div className="mt-5">
                <BetAmountInput
                  min={0}
                  max={walletBalance}
                  step={0.1}
                  value={betAmount}
                  onChange={setBetAmount}
                  balance={walletBalance}
                  usdMode={usdMode}
                  setUsdMode={() => {}}
                  disabled={isLoading}
                  themeColorBackground={themeColorBackground}
                />
              </div>

              {/* Number of spins */}
              <div className="mt-8">
                <CustomSlider
                  label="Number of Spins"
                  min={1}
                  max={MAX_SPINS}
                  step={1}
                  value={numberOfSpins}
                  onChange={setNumberOfSpins}
                  presets={[5, 10, 15]}
                  themeColor={themeColorBackground}
                />
              </div>
            </CardContent>

            <div className="grow" />

            <CardFooter className="mt-8 w-full flex flex-col font-roboto gap-4">
              <div className="w-full flex flex-col items-center gap-2 font-medium text-xs text-[#91989C]">
                <div className="w-full flex justify-between items-center gap-2">
                  <p>Paylines</p>
                  <p>20</p>
                </div>
                <div className="w-full flex justify-between items-center gap-2">
                  <p>Bet Per Line</p>
                  <p>{fmt(betPerLine)} APE</p>
                </div>
                <div className="w-full flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <p>Jackpot (5× Golden Cub)</p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger><Info size={16} /></TooltipTrigger>
                        <TooltipContent><p>{JACKPOT_AMOUNT_INFO}</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p>{fmt(jackpotAmt)} APE</p>
                </div>
                <div className="w-full flex justify-between items-center gap-2">
                  <p>Max Bet Per Game</p>
                  <p>{maxBet} APE</p>
                </div>
              </div>

              {/* Paytable button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowPaytable(true)}
              >
                View Paytable
              </Button>

              <Button
                onClick={onPlay}
                className="hidden lg:flex w-full"
                style={{ backgroundColor: themeColorBackground }}
                disabled={betAmount <= 0 || isGamePaused}
              >
                Search for the Golden Cub
              </Button>
            </CardFooter>
          </>
        )}

        {currentView === 1 && (
          <CardContent className="grow font-roboto flex flex-col-reverse lg:flex-col lg:justify-between gap-8">
            {StatsBlock(true)}
            {SpinsLeftBlock(false)}

            <div className="flex lg:flex-col justify-evenly items-center">
              {SpinsLeftBlock(true)}

              <div className="font-roboto flex flex-col items-center gap-3">
                {freeSpinsRemaining > 0 ? (
                  <div
                    className="px-6 py-3 rounded-full font-bold text-sm text-black"
                    style={{ background: '#FFD700' }}
                  >
                    🐯 Auto-spinning free spins…
                  </div>
                ) : game.advanceToNextStateAsset ? (
                  <>
                    <button
                      onClick={onSpin}
                      disabled={!canSpin}
                      className="relative group disabled:opacity-40 focus:outline-none"
                      style={{ background: 'none', border: 'none', padding: 0 }}
                    >
                      {/* Outer glow ring — pulses when idle/ready */}
                      <span
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{
                          boxShadow: '0 0 0 0 rgba(212,160,23,0)',
                          animationName:           canSpin ? 'spinBtnPulse' : 'none',
                          animationDuration:       '2s',
                          animationTimingFunction: 'ease-in-out',
                          animationIterationCount: 'infinite',
                        }}
                      />
                      <Image
                        src={game.advanceToNextStateAsset}
                        alt="Spin"
                        width={400}
                        height={275}
                        className={[
                          'object-contain select-none',
                          'w-[130px] sm:w-[155px] lg:w-[190px]',
                          // Scale effects
                          'transition-transform duration-150 ease-out',
                          'group-hover:scale-105 group-active:scale-95',
                          // Green glow on hover
                          'group-hover:[filter:drop-shadow(0_0_16px_rgba(100,220,60,0.8))_drop-shadow(0_0_32px_rgba(212,160,23,0.5))]',
                        ].join(' ')}
                        style={{
                          animationName:           canSpin ? 'spinBtnPulse' : undefined,
                          animationDuration:       '2s',
                          animationTimingFunction: 'ease-in-out',
                          animationIterationCount: 'infinite',
                        }}
                      />
                    </button>

                    <style>{`
                      @keyframes spinBtnPulse {
                        0%   { filter: drop-shadow(0 0 6px rgba(100,220,60,0.3)) drop-shadow(0 0 12px rgba(212,160,23,0.2)); }
                        50%  { filter: drop-shadow(0 0 14px rgba(100,220,60,0.7)) drop-shadow(0 0 28px rgba(212,160,23,0.5)); }
                        100% { filter: drop-shadow(0 0 6px rgba(100,220,60,0.3)) drop-shadow(0 0 12px rgba(212,160,23,0.2)); }
                      }
                    `}</style>
                  </>
                ) : (
                  <Button onClick={onSpin} disabled={!canSpin} className="w-full">
                    Spin
                  </Button>
                )}

                {/* Paytable link during play */}
                <button
                  onClick={() => setShowPaytable(true)}
                  className="text-xs underline opacity-50 hover:opacity-80"
                >
                  Paytable
                </button>
              </div>
            </div>
          </CardContent>
        )}

        {currentView === 2 && (
          <CardContent className="grow font-roboto flex flex-col lg:justify-between gap-8">
            {/* Mobile actions */}
            <div className="lg:hidden">
              {canReplay() ? (
                <Button
                  className="w-full"
                  style={{ backgroundColor: themeColorBackground }}
                  onClick={onPlayAgain}
                  disabled={isGamePaused}
                >
                  {playAgainText}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  style={{ backgroundColor: themeColorBackground }}
                  onClick={onRewatch}
                >
                  Rewatch Spins
                </Button>
              )}
              <Button className="w-full mt-3" variant="secondary" onClick={onReset}>
                Change Bet
              </Button>
            </div>

            {StatsBlock(false)}
            {SpinsLeftBlock(false)}

            <CardFooter className="w-full hidden lg:block">
              <div className="w-full flex flex-col gap-4">
                {canReplay() ? (
                  <Button
                    className="w-full"
                    style={{ backgroundColor: themeColorBackground }}
                    onClick={onPlayAgain}
                    disabled={isGamePaused}
                  >
                    {playAgainText}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    style={{ backgroundColor: themeColorBackground }}
                    onClick={onRewatch}
                  >
                    Rewatch Spins
                  </Button>
                )}
                <Button className="w-full" variant="secondary" onClick={onReset}>
                  Change Bet
                </Button>
              </div>
            </CardFooter>
          </CardContent>
        )}
      </Card>
    </>
  );
};

export default MyGameSetupCard;
