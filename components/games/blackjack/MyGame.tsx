"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { randomBytes, Game } from "@/lib/games";
import GameWindow from "@/components/shared/GameWindow";
import MyGameWindow from "./MyGameWindow";
import MyGameSetupCard from "./MyGameSetupCard";
import {
  BLACKJACK_MAX_BET,
  BLACKJACK_MIN_BET,
  BLACKJACK_PAYOUT_MULTIPLIER,
  DEALER_STAND_VALUE,
  PUSH_PAYOUT_MULTIPLIER,
  calculateHandValue,
  createDeck,
  createRoundId,
  drawCard,
  initialBlackjackState,
  isBlackjack,
  isBust,
  shuffleDeck,
  type BlackjackState,
  type PlayingCard,
  type ReplayRoundData,
  type RoundOutcome,
} from "./myGameConfig";
import { bytesToHex, Hex } from "viem";
import { toast } from "sonner";
import "./my-game.styles.css";

interface MyGameComponentProps {
  game: Game;
}

const MyGameComponent: React.FC<MyGameComponentProps> = ({ game }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const replayIdString = searchParams.get("id");

  const walletBalance = 25;
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [gameState, setGameState] = useState<BlackjackState>(
    initialBlackjackState,
  );

  const timeoutRef = useRef<number[]>([]);

  const [currentGameId, setCurrentGameId] = useState<bigint>(
    replayIdString == null
      ? BigInt(bytesToHex(new Uint8Array(randomBytes(32))))
      : BigInt(replayIdString),
  );

  const [userRandomWord, setUserRandomWord] = useState<Hex>(
    bytesToHex(new Uint8Array(randomBytes(32))),
  );

  useEffect(() => {
    if (replayIdString !== null && replayIdString.length > 2) {
      setIsLoading(true);
      setCurrentGameId(BigInt(replayIdString));
      setIsLoading(false);
    }
  }, [replayIdString]);

  const clearAllTimeouts = useCallback((): void => {
    timeoutRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutRef.current = [];
  }, []);

  const scheduleTimeout = useCallback(
    (callback: () => void, delay: number): void => {
      const timeoutId = window.setTimeout(callback, delay);
      timeoutRef.current.push(timeoutId);
    },
    [],
  );

  const currentView = gameState.currentView;
  const betAmount = gameState.betAmount;
  const payout = gameState.payout === 0 ? null : gameState.payout;
  const gameOver = gameState.phase === "resolved";
  const shouldShowPNL = !!payout && payout > betAmount;
  const playAgainText = "Play Again";

  const getActiveBetAmount = (): number => {
    return gameState.betAmount;
  };

  const getTotalPayout = (): number => {
    return gameState.payout;
  };

  const setBetAmount = useCallback((amount: number): void => {
    setGameState((previousState) => ({
      ...previousState,
      betAmount: amount,
      statusMessage: "Place your bet to begin.",
    }));
  }, []);

  const fullyResetState = useCallback(
    (
      replayData: ReplayRoundData | null = null,
      betAmountOverride?: number,
    ): void => {
      clearAllTimeouts();

      setGameState({
        ...initialBlackjackState,
        betAmount:
          betAmountOverride !== undefined
            ? betAmountOverride
            : initialBlackjackState.betAmount,
        replayData,
      });

      setIsLoading(false);
    },
    [clearAllTimeouts],
  );

  const handleReset = useCallback((): void => {
    const newGameId = BigInt(bytesToHex(new Uint8Array(randomBytes(32))));
    const newUserWord = bytesToHex(new Uint8Array(randomBytes(32)));

    setCurrentGameId(newGameId);
    setUserRandomWord(newUserWord);

    fullyResetState(null);

    if (replayIdString !== null) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("id");
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [fullyResetState, replayIdString, router, searchParams]);

  const resolveRound = useCallback(
    (
      playerCards: PlayingCard[],
      dealerCards: PlayingCard[],
      roundId: string,
      roundBetAmount: number,
    ): void => {
      const playerTotal = calculateHandValue(playerCards);
      const dealerTotal = calculateHandValue(dealerCards);

      let outcome: Exclude<RoundOutcome, null>;
      let resolvedPayout = 0;
      let statusMessage = "";

      if (playerTotal > 21) {
        outcome = "dealer";
        statusMessage = "Bust. Dealer wins.";
      } else if (dealerTotal > 21) {
        outcome = "player";
        resolvedPayout = roundBetAmount * BLACKJACK_PAYOUT_MULTIPLIER;
        statusMessage = "Dealer busts. You win.";
      } else if (playerTotal > dealerTotal) {
        outcome = "player";
        resolvedPayout = roundBetAmount * BLACKJACK_PAYOUT_MULTIPLIER;
        statusMessage = "You win.";
      } else if (dealerTotal > playerTotal) {
        outcome = "dealer";
        statusMessage = "Dealer wins.";
      } else {
        outcome = "push";
        resolvedPayout = roundBetAmount * PUSH_PAYOUT_MULTIPLIER;
        statusMessage = "Push.";
      }

      const replayData: ReplayRoundData = {
        roundId,
        betAmount: roundBetAmount,
        playerCards,
        dealerCards,
        outcome,
        payout: resolvedPayout,
      };

      setGameState((previousState) => ({
        ...previousState,
        currentView: 2,
        phase: "resolved",
        playerCards,
        dealerCards,
        dealerHidden: false,
        canHit: false,
        canStand: false,
        payout: resolvedPayout,
        outcome,
        statusMessage,
        replayData,
      }));
    },
    [],
  );

  const runDealerTurn = useCallback(
    (
      sourceDeck: PlayingCard[],
      playerCards: PlayingCard[],
      sourceDealerCards: PlayingCard[],
      roundId: string,
      roundBetAmount: number,
    ): void => {
      let nextDeck = [...sourceDeck];
      let nextDealerCards = [...sourceDealerCards];

      while (calculateHandValue(nextDealerCards) < DEALER_STAND_VALUE) {
        const drawResult = drawCard(nextDeck);
        nextDeck = drawResult.nextDeck;
        nextDealerCards = [...nextDealerCards, drawResult.drawnCard];
      }

      resolveRound(playerCards, nextDealerCards, roundId, roundBetAmount);
    },
    [resolveRound],
  );

  const handleStateAdvance = useCallback((): void => {
    setGameState((previousState) => {
      if (previousState.phase !== "dealing") {
        return previousState;
      }

      return {
        ...previousState,
        phase: "player-turn",
        canHit: true,
        canStand: true,
        statusMessage: "Choose Hit or Stand.",
      };
    });
  }, []);

  const playGame = useCallback(
    async (gameId?: bigint, randomWord?: Hex) => {
      const gameIdToUse = gameId ?? currentGameId;
      const randomWordToUse = randomWord ?? userRandomWord;

      void gameIdToUse;
      void randomWordToUse;

      if (
        Number.isNaN(gameState.betAmount) ||
        gameState.betAmount < BLACKJACK_MIN_BET ||
        gameState.betAmount > BLACKJACK_MAX_BET
      ) {
        toast.error(
          `Bet must be between ${BLACKJACK_MIN_BET} and ${BLACKJACK_MAX_BET}.`,
        );
        return;
      }

      clearAllTimeouts();
      setIsLoading(true);

      try {
        console.log(
          "Mock on-chain transaction: placing blackjack bet",
          gameState.betAmount,
        );

        const roundId = createRoundId();
        let deck = shuffleDeck(createDeck());

        const firstPlayerDraw = drawCard(deck);
        deck = firstPlayerDraw.nextDeck;

        const firstDealerDraw = drawCard(deck);
        deck = firstDealerDraw.nextDeck;

        const secondPlayerDraw = drawCard(deck);
        deck = secondPlayerDraw.nextDeck;

        const secondDealerDraw = drawCard(deck);
        deck = secondDealerDraw.nextDeck;

        const playerCards = [
          firstPlayerDraw.drawnCard,
          secondPlayerDraw.drawnCard,
        ];
        const dealerCards = [
          firstDealerDraw.drawnCard,
          secondDealerDraw.drawnCard,
        ];

        setGameState((previousState) => ({
          ...previousState,
          currentView: 1,
          phase: "dealing",
          deck,
          playerCards,
          dealerCards,
          dealerHidden: true,
          canHit: false,
          canStand: false,
          payout: 0,
          outcome: null,
          roundId,
          statusMessage: "Dealing cards...",
          replayData: null,
        }));

        scheduleTimeout(() => {
          setIsLoading(false);

          const playerHasBlackjack = isBlackjack(playerCards);
          const dealerHasBlackjack = isBlackjack(dealerCards);

          if (playerHasBlackjack || dealerHasBlackjack) {
            resolveRound(
              playerCards,
              dealerCards,
              roundId,
              gameState.betAmount,
            );
            return;
          }

          handleStateAdvance();
        }, 900);
      } catch (error: unknown) {
        if (
          (error instanceof Error &&
            error.message.includes("Transaction not found")) ||
          (typeof error === "string" && error.includes("Transaction not found"))
        ) {
          return;
        }

        toast.error("An unexpected error occurred.");
        setIsLoading(false);
      }
    },
    [
      clearAllTimeouts,
      currentGameId,
      gameState.betAmount,
      handleStateAdvance,
      resolveRound,
      scheduleTimeout,
      userRandomWord,
    ],
  );

  const handleHit = useCallback((): void => {
    setGameState((previousState) => {
      if (!previousState.canHit) {
        return previousState;
      }

      const drawResult = drawCard(previousState.deck);
      const nextPlayerCards = [
        ...previousState.playerCards,
        drawResult.drawnCard,
      ];

      if (isBust(nextPlayerCards)) {
        scheduleTimeout(() => {
          resolveRound(
            nextPlayerCards,
            previousState.dealerCards,
            previousState.roundId ?? createRoundId(),
            previousState.betAmount,
          );
        }, 400);

        return {
          ...previousState,
          deck: drawResult.nextDeck,
          playerCards: nextPlayerCards,
          canHit: false,
          canStand: false,
          phase: "dealer-turn",
          statusMessage: "You busted.",
        };
      }

      return {
        ...previousState,
        deck: drawResult.nextDeck,
        playerCards: nextPlayerCards,
        statusMessage: "Card drawn. Choose Hit or Stand.",
      };
    });
  }, [resolveRound, scheduleTimeout]);

  const handleStand = useCallback((): void => {
    setGameState((previousState) => {
      if (!previousState.canStand) {
        return previousState;
      }

      scheduleTimeout(() => {
        runDealerTurn(
          previousState.deck,
          previousState.playerCards,
          previousState.dealerCards,
          previousState.roundId ?? createRoundId(),
          previousState.betAmount,
        );
      }, 700);

      return {
        ...previousState,
        phase: "dealer-turn",
        dealerHidden: false,
        canHit: false,
        canStand: false,
        statusMessage: "Dealer reveals and plays.",
      };
    });
  }, [runDealerTurn, scheduleTimeout]);

  const handlePlayAgain = useCallback(async (): Promise<void> => {
    const newGameId = BigInt(bytesToHex(new Uint8Array(randomBytes(32))));
    const newUserWord = bytesToHex(new Uint8Array(randomBytes(32)));
    const preservedBet = gameState.betAmount;

    setCurrentGameId(newGameId);
    setUserRandomWord(newUserWord);

    fullyResetState(null, preservedBet);

    scheduleTimeout(() => {
      void playGame(newGameId, newUserWord);
    }, 50);
  }, [fullyResetState, gameState.betAmount, playGame, scheduleTimeout]);

  const handleRewatch = useCallback((): void => {
    const replayData = gameState.replayData;

    if (!replayData) {
      return;
    }

    const initialPlayerCards = replayData.playerCards.slice(0, 2);
    const initialDealerCards = replayData.dealerCards.slice(0, 2);

    fullyResetState(replayData, replayData.betAmount);

    setGameState((previousState) => ({
      ...previousState,
      currentView: 1,
      phase: "dealing",
      playerCards: initialPlayerCards,
      dealerCards: initialDealerCards,
      dealerHidden: true,
      roundId: replayData.roundId,
      statusMessage: "Rewatching previous round...",
      replayData,
    }));

    scheduleTimeout(() => {
      setGameState((previousState) => ({
        ...previousState,
        phase: "player-turn",
        canHit: false,
        canStand: false,
        statusMessage: "Replaying round...",
      }));
    }, 700);

    if (replayData.outcome === "dealer" && replayData.playerCards.length > 2) {
      scheduleTimeout(() => {
        setGameState((previousState) => ({
          ...previousState,
          playerCards: replayData.playerCards,
          phase: "dealer-turn",
          dealerHidden: true,
          canHit: false,
          canStand: false,
          statusMessage: "Player draws and busts.",
        }));
      }, 1300);

      scheduleTimeout(() => {
        setGameState((previousState) => ({
          ...previousState,
          currentView: 2,
          phase: "resolved",
          playerCards: replayData.playerCards,
          dealerCards: replayData.dealerCards,
          dealerHidden: false,
          canHit: false,
          canStand: false,
          outcome: replayData.outcome,
          payout: replayData.payout,
          statusMessage: "Replay complete.",
        }));
      }, 2200);

      return;
    }

    scheduleTimeout(() => {
      setGameState((previousState) => ({
        ...previousState,
        phase: "dealer-turn",
        dealerHidden: false,
        canHit: false,
        canStand: false,
        statusMessage: "Dealer reveals and plays.",
      }));
    }, 1300);

    scheduleTimeout(() => {
      setGameState((previousState) => ({
        ...previousState,
        currentView: 2,
        phase: "resolved",
        playerCards: replayData.playerCards,
        dealerCards: replayData.dealerCards,
        dealerHidden: false,
        canHit: false,
        canStand: false,
        outcome: replayData.outcome,
        payout: replayData.payout,
        statusMessage: "Replay complete.",
      }));
    }, 2200);
  }, [fullyResetState, gameState.replayData, scheduleTimeout]);

  const jackpotMultiplier = BLACKJACK_PAYOUT_MULTIPLIER;

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 lg:gap-10">
        <GameWindow
          game={game}
          currentGameId={currentGameId}
          isLoading={isLoading}
          isGameFinished={gameOver}
          onPlayAgain={handlePlayAgain}
          playAgainText={playAgainText}
          onRewatch={handleRewatch}
          onReset={handleReset}
          betAmount={getActiveBetAmount()}
          payout={payout}
          inReplayMode={replayIdString !== null}
          isUserOriginalPlayer={true}
          showPNL={shouldShowPNL}
          isGamePaused={false}
          resultModalDelayMs={1000}
        >
          <MyGameWindow
            game={game}
            phase={gameState.phase}
            playerCards={gameState.playerCards}
            dealerCards={gameState.dealerCards}
            dealerHidden={gameState.dealerHidden}
            statusMessage={gameState.statusMessage}
            canHit={gameState.canHit}
            canStand={gameState.canStand}
            onHit={handleHit}
            onStand={handleStand}
            gameCompleted={gameOver}
            betAmount={getActiveBetAmount()}
            payoutAmount={getTotalPayout()}
            outcome={gameState.outcome}
          />
        </GameWindow>

        <MyGameSetupCard
          game={game}
          onPlay={async () => await playGame()}
          onSpin={handleStateAdvance}
          onRewatch={handleRewatch}
          onReset={handleReset}
          onPlayAgain={async () => await handlePlayAgain()}
          playAgainText={playAgainText}
          currentView={currentView}
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          numberOfSpins={1}
          setNumberOfSpins={() => undefined}
          isLoading={isLoading}
          payout={payout}
          spinsLeft={0}
          jackpotMultiplier={jackpotMultiplier}
          inReplayMode={replayIdString !== null}
          account={undefined}
          walletBalance={walletBalance}
          playerAddress={undefined}
          isGamePaused={false}
          profile={undefined}
          minBet={BLACKJACK_MIN_BET}
          maxBet={BLACKJACK_MAX_BET}
        />
      </div>
    </div>
  );
};

export default MyGameComponent;
