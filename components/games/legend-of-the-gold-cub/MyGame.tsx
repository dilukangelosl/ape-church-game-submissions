'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Game, randomBytes } from '@/lib/games';
import { bytesToHex, Hex } from 'viem';
import { toast, Toaster } from 'sonner';

import GameWindow from '@/components/shared/GameWindow';
import GameHud from '@/components/shared/GameHud';
import MyGameWindow from './MyGameWindow';
import MyGameSetupCard from './MyGameSetupCard';

import { GameState, INITIAL_GAME_STATE, SpinRecord, SymbolId } from './types';
import { goldCubGame, NUM_PAYLINES, FREE_SPINS_AWARD, FREE_SPINS_RETRIGGER, myGame } from './myGameConfig';
import { resolveReelsFromSeed, getVisibleSymbols } from './engine/ReelEngine';
import { evaluateWins } from './engine/WinEvaluator';

// Inner component owns useSearchParams — must be inside a Suspense boundary
const MyGameInner = () => {
  const game = myGame;

  const themeColorBackground = game.themeColorBackground;
  const router = useRouter();
  const searchParams = useSearchParams();
  const replayIdString = searchParams.get('id');
  const walletBalance = 25;

  // ── Platform state ──────────────────────────────────────────────────────────
  const [isGameOngoing, setIsGameOngoing]   = useState(false);
  const [currentView, setCurrentView]       = useState<0 | 1 | 2>(0);
  const [isLoading, setIsLoading]           = useState(false);
  const [payout, setPayout]                 = useState<number | null>(null);

  // ── Game config state ───────────────────────────────────────────────────────
  const [betAmount, setBetAmount]           = useState(0);
  const [numberOfSpins, setNumberOfSpins]   = useState(10);

  // ── Derived: bet per line ───────────────────────────────────────────────────
  const betPerLine = betAmount / NUM_PAYLINES;

  // ── Game engine state ───────────────────────────────────────────────────────
  const [gameState, setGameState]           = useState<GameState>(INITIAL_GAME_STATE);
  const [spinTrigger, setSpinTrigger]       = useState(0);

  // ── Replay ──────────────────────────────────────────────────────────────────
  const [currentGameId, setCurrentGameId] = useState<bigint>(
    replayIdString == null
      ? BigInt(bytesToHex(new Uint8Array(randomBytes(32))))
      : BigInt(replayIdString)
  );
  const [userRandomWord, setUserRandomWord] = useState<Hex>(
    bytesToHex(new Uint8Array(randomBytes(32)))
  );

  // Recorded spins for rewatch
  const recordedSpinsRef  = useRef<SpinRecord[]>([]);
  const replayCursorRef   = useRef(0);
  const isReplayModeRef   = useRef(false);

  // Pending free spins queue & current spin index
  const freeSpinsQueueRef  = useRef(0);
  const currentSpinIndexRef = useRef(0);
  const totalPayoutRef      = useRef(0);

  // Timers
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  useEffect(() => {
    if (replayIdString !== null && replayIdString.length > 2) {
      setIsLoading(true);
      setCurrentGameId(BigInt(replayIdString));
    }
  }, [replayIdString]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
  }, []);

  const freshGameId = () => BigInt(bytesToHex(new Uint8Array(randomBytes(32))));
  const freshWord   = () => bytesToHex(new Uint8Array(randomBytes(32))) as Hex;

  // ── Core spin resolver ──────────────────────────────────────────────────────

  // Forced symbol grids for debug mode [reel][row]
  function resolveSpin(isFreeSpins: boolean): SpinRecord {
    const seedBytes      = randomBytes(32);
    const positions      = resolveReelsFromSeed(seedBytes);
    const visibleSymbols = getVisibleSymbols(positions);
    const winResult      = evaluateWins(visibleSymbols, betPerLine);

    const record: SpinRecord = {
      seed: Array.from(seedBytes),
      reelPositions: positions,
      visibleSymbols,
      winResult,
      isFreeSpins,
      betPerLine,
    };

    if (!isReplayModeRef.current) {
      recordedSpinsRef.current.push(record);
    }

    return record;
  }

  function resolveSpinFromRecord(record: SpinRecord): SpinRecord {
    return record;
  }

  // ── Execute a single spin (base or free) ────────────────────────────────────

  const executeSpin = useCallback((isFreeSpins: boolean) => {
    let record: SpinRecord;

    if (isReplayModeRef.current) {
      const cursor = replayCursorRef.current;
      if (cursor >= recordedSpinsRef.current.length) return;
      record = resolveSpinFromRecord(recordedSpinsRef.current[cursor]);
      replayCursorRef.current = cursor + 1;
    } else {
      record = resolveSpin(isFreeSpins);
    }

    // Update visible reels and start animation
    setGameState(prev => ({
      ...prev,
      phase: 'SPINNING',
      reels: record.visibleSymbols,
      activeWinLines: [],
      lastSpinWin: 0,
      scatterCount: 0,
    }));
    setSpinTrigger(t => t + 1);

    // Store record for onAllReelsStopped closure
    pendingRecordRef.current = record;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betPerLine]);

  const pendingRecordRef = useRef<SpinRecord | null>(null);

  // ── Called when all 5 reels have visually stopped ──────────────────────────

  const handleAllReelsStopped = useCallback(() => {
    const record = pendingRecordRef.current;
    if (!record) return;

    const { winResult, isFreeSpins } = record;

    totalPayoutRef.current += winResult.totalWin;
    // Only count base game spins toward the purchased spin total
    if (!isFreeSpins) {
      currentSpinIndexRef.current += 1;
    }

    // Accumulate platform payout
    setPayout(prev => (prev ?? 0) + winResult.totalWin);

    // Handle free spins trigger / retrigger
    let newFreeSpins = freeSpinsQueueRef.current;
    if (winResult.triggeredFreeSpins) {
      newFreeSpins += isFreeSpins ? FREE_SPINS_RETRIGGER : winResult.freeSpinsAwarded;
      freeSpinsQueueRef.current = newFreeSpins;
    }

    setGameState(prev => ({
      ...prev,
      phase: 'WIN_DISPLAY',
      activeWinLines: winResult.lines,
      lastSpinWin: winResult.totalWin,
      totalSessionWin: prev.totalSessionWin + winResult.totalWin,
      freeSpinsRemaining: isFreeSpins
        ? Math.max(0, prev.freeSpinsRemaining - 1 + (winResult.triggeredFreeSpins ? FREE_SPINS_RETRIGGER : 0))
        : (winResult.triggeredFreeSpins ? winResult.freeSpinsAwarded : prev.freeSpinsRemaining),
      scatterCount: winResult.scatterCount,
      spinsCompleted: prev.spinsCompleted + 1,
    }));

    // After win display, decide next phase. Duration tracks the win tier so
    // the popup outlives its counter animation (1800–4000ms in MyGameWindow)
    // and its SFX (win.mp3 2.5s, big-win.mp3 4.3s) instead of closing at a
    // flat 1.8s with audio still playing.
    const totalBet = record.betPerLine * NUM_PAYLINES;
    const displayDuration =
      winResult.totalWin >= totalBet * 50 ? 4800 :   // jackpot (counter 4000)
      winResult.totalWin >= totalBet * 20 ? 3800 :   // mega    (counter 3000)
      winResult.totalWin >= totalBet * 10 ? 3300 :   // big     (counter 2500)
      winResult.totalWin > 0              ? 2600 :   // win     (counter 1800)
                                            800;

    phaseTimerRef.current = setTimeout(() => {
      const freeSpin = freeSpinsQueueRef.current;
      const spinsLeft = numberOfSpins - currentSpinIndexRef.current;

      if (freeSpin > 0) {
        // Enter or continue free spins
        if (!isFreeSpins && winResult.triggeredFreeSpins) {
          setGameState(prev => ({ ...prev, phase: 'FREE_SPINS_INTRO' }));
          phaseTimerRef.current = setTimeout(() => {
            setGameState(prev => ({ ...prev, phase: 'FREE_SPINS', activeWinLines: [] }));
            freeSpinsQueueRef.current -= 1;
            executeSpin(true);
          }, 2000);
        } else {
          setGameState(prev => ({ ...prev, phase: 'FREE_SPINS', activeWinLines: [] }));
          freeSpinsQueueRef.current -= 1;
          executeSpin(true);
        }
      } else if (spinsLeft > 0) {
        // More base spins remain — wait for user to press spin
        setGameState(prev => ({ ...prev, phase: 'IDLE', activeWinLines: [] }));
      } else {
        // All spins used — game over
        setCurrentView(2);
        setIsGameOngoing(false);
        setGameState(prev => ({ ...prev, phase: 'IDLE', activeWinLines: [] }));
      }
    }, displayDuration);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberOfSpins, executeSpin]);

  // ── Lifecycle Functions ─────────────────────────────────────────────────────

  const playGame = useCallback(async (
    gameId?: bigint,
    randomWord?: Hex,
  ) => {
    if (betAmount <= 0) {
      toast.error('Set a bet amount first.');
      return;
    }

    setIsLoading(true);
    setIsGameOngoing(true);

    const gameIdToUse   = gameId   ?? currentGameId;
    const _randomWord   = randomWord ?? userRandomWord;

    try {
      const receiptSuccess = true; // platform will replace with real tx

      if (receiptSuccess) {
        toast.success('Transaction complete! The search begins.');
        setTimeout(() => {
          // Reset per-game counters
          currentSpinIndexRef.current = 0;
          totalPayoutRef.current      = 0;
          freeSpinsQueueRef.current   = 0;
          recordedSpinsRef.current    = [];
          replayCursorRef.current     = 0;
          isReplayModeRef.current     = false;

          setGameState(INITIAL_GAME_STATE);
          setPayout(null);
          setIsLoading(false);
          setCurrentView(1);
        }, 800);
      } else {
        toast.info('Something went wrong. Please try again.');
        setIsLoading(false);
        setIsGameOngoing(false);
      }
    } catch (error) {
      if (
        (error instanceof Error && error.message.includes('Transaction not found')) ||
        (typeof error === 'string' && error.includes('Transaction not found'))
      ) {
        return;
      }
      toast.error('An unexpected error occurred.');
      setIsLoading(false);
      setIsGameOngoing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betAmount, currentGameId, userRandomWord]);

  const handleReset = useCallback((isPlayingAgain = false) => {
    clearTimers();

    if (!isPlayingAgain) {
      setCurrentGameId(freshGameId());
      setUserRandomWord(freshWord());
    }

    currentSpinIndexRef.current = 0;
    totalPayoutRef.current      = 0;
    freeSpinsQueueRef.current   = 0;
    recordedSpinsRef.current    = [];
    replayCursorRef.current     = 0;
    isReplayModeRef.current     = false;
    pendingRecordRef.current    = null;

    setGameState(INITIAL_GAME_STATE);
    setSpinTrigger(0);
    setCurrentView(0);
    setPayout(null);
    setIsGameOngoing(false);
    setIsLoading(false);

    if (replayIdString !== null) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('id');
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [clearTimers, replayIdString, router, searchParams]);

  const handlePlayAgain = useCallback(async () => {
    const newId   = freshGameId();
    const newWord = freshWord();
    setCurrentGameId(newId);
    setUserRandomWord(newWord);
    handleReset(true);
    setTimeout(() => playGame(newId, newWord), 100);
  }, [handleReset, playGame]);

  const handleRewatch = useCallback(() => {
    if (recordedSpinsRef.current.length === 0) {
      toast.error('No session available to rewatch.');
      return;
    }
    clearTimers();
    isReplayModeRef.current  = true;
    replayCursorRef.current  = 0;
    currentSpinIndexRef.current = 0;
    totalPayoutRef.current   = 0;
    freeSpinsQueueRef.current = 0;

    setGameState(INITIAL_GAME_STATE);
    setSpinTrigger(0);
    setPayout(null);
    setCurrentView(1);
    setIsGameOngoing(false);
  }, [clearTimers]);

  const handleStateAdvance = useCallback(() => {
    if (gameState.phase === 'SPINNING' || gameState.phase === 'FREE_SPINS_INTRO') return;
    if (freeSpinsQueueRef.current > 0) return; // free spins auto-run

    const spinsLeft = numberOfSpins - currentSpinIndexRef.current;
    if (spinsLeft <= 0) return;

    executeSpin(false);
  }, [gameState.phase, numberOfSpins, executeSpin]);

  // ── Derived values for SetupCard ────────────────────────────────────────────

  const getSpinsLeft  = () => numberOfSpins - currentSpinIndexRef.current;
  const getTotalPayout = () => payout ?? 0;
  const jackpotMultiplier = 500; // 5× golden_cub × betPerLine

  const playAgainText = `Play Again (${numberOfSpins} More Spins)`;
  const shouldShowPNL = !!payout && payout > betAmount;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Themed toaster — matches Golden Tiger Cub colour palette */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1a0a00',
            color: '#FFD700',
            border: '1px solid #D4A017',
            fontSize: '0.9rem',
            fontWeight: 600,
          },
          className: 'gold-toast',
        }}
      />

      <GameHud
        title={game.title}
        panel={
          <MyGameSetupCard
            game={game}
            onPlay={async () => await playGame()}
            onSpin={handleStateAdvance}
            onRewatch={handleRewatch}
            onReset={() => handleReset(false)}
            onPlayAgain={async () => await handlePlayAgain()}
            playAgainText={playAgainText}
            currentView={currentView}
            betAmount={betAmount}
            setBetAmount={setBetAmount}
            numberOfSpins={numberOfSpins}
            setNumberOfSpins={setNumberOfSpins}
            isLoading={isLoading}
            payout={payout}
            spinsLeft={getSpinsLeft()}
            jackpotMultiplier={jackpotMultiplier}
            inReplayMode={replayIdString !== null}
            account={undefined}
            walletBalance={walletBalance}
            playerAddress={undefined}
            isGamePaused={false}
            profile={undefined}
            minBet={1}
            maxBet={100}
            freeSpinsRemaining={gameState.freeSpinsRemaining}
            phase={gameState.phase}
          />
        }
      >
        <GameWindow
          game={game}
          currentGameId={currentGameId}
          isLoading={isLoading}
          isGameFinished={currentView === 2}
          onPlayAgain={handlePlayAgain}
          playAgainText={playAgainText}
          onRewatch={handleRewatch}
          onReset={() => handleReset(false)}
          betAmount={betAmount}
          payout={payout}
          inReplayMode={replayIdString !== null}
          isUserOriginalPlayer={true}
          showPNL={shouldShowPNL}
          isGamePaused={false}
          resultModalDelayMs={1000}
          customHeightMobile="400px"
          hudMode
        >
          <MyGameWindow
            game={game}
            gameState={gameState}
            isActive={currentView === 1}
            onAllReelsStopped={handleAllReelsStopped}
            spinTrigger={spinTrigger}
            betPerLine={betPerLine}
          />
        </GameWindow>
      </GameHud>
    </div>
  );
};

// Exported component wraps in Suspense so app/page.tsx doesn't need changing.
// Next.js requires useSearchParams to be inside a Suspense boundary for static builds.
const MyGameComponent: React.FC = () => (
  <Suspense fallback={<div />}>
    <MyGameInner />
  </Suspense>
);

export default MyGameComponent;
