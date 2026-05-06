"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import useSound from "use-sound";
import { Game } from "@/lib/games";
import {
  calculateHandValue,
  type PlayingCard,
  type RoundOutcome,
  type RoundPhase,
} from "./myGameConfig";

interface MyGameWindowProps {
  game: Game;
  phase: RoundPhase;
  playerCards: PlayingCard[];
  dealerCards: PlayingCard[];
  dealerHidden: boolean;
  statusMessage: string;
  canHit: boolean;
  canStand: boolean;
  onHit: () => void;
  onStand: () => void;
  gameCompleted: boolean;
  betAmount: number;
  payoutAmount: number;
  outcome: RoundOutcome;
}

const formatCardLabel = (card: PlayingCard): string => {
  const suitSymbols: Record<PlayingCard["suit"], string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };

  return `${card.rank}${suitSymbols[card.suit]}`;
};

const getCardImagePath = (card: PlayingCard): string => {
  const suitMap: Record<PlayingCard["suit"], string> = {
    hearts: "H",
    diamonds: "D",
    clubs: "C",
    spades: "S",
  };

  return `/my-game/cards/${card.rank}${suitMap[card.suit]}.png`;
};

const getOutcomeText = (outcome: RoundOutcome): string => {
  if (outcome === "player") return "You Win";
  if (outcome === "dealer") return "Dealer Wins";
  if (outcome === "push") return "Push";
  return "";
};

const MyGameWindow: React.FC<MyGameWindowProps> = ({
  game,
  phase,
  playerCards,
  dealerCards,
  dealerHidden,
  statusMessage,
  canHit,
  canStand,
  onHit,
  onStand,
  gameCompleted,
  betAmount,
  payoutAmount,
  outcome,
}) => {
  const muteSfx = false;
  const sfxVolume = 0.5;

  const [winSFX] = useSound("/my-game/sfx/win.mp3", {
    volume: sfxVolume,
    soundEnabled: !muteSfx,
    interrupt: true,
  });

  const [loseSFX] = useSound("/my-game/sfx/lose.mp3", {
    volume: sfxVolume,
    soundEnabled: !muteSfx,
    interrupt: true,
  });

  useEffect(() => {
    if (!gameCompleted) return;

    if (outcome === "player" || outcome === "push") {
      winSFX();
      return;
    }

    if (outcome === "dealer") {
      loseSFX();
    }
  }, [gameCompleted, loseSFX, outcome, winSFX]);

  const visibleDealerCards = dealerHidden
    ? dealerCards.slice(0, 1)
    : dealerCards;

  const playerTotal = calculateHandValue(playerCards);
  const dealerTotal = dealerHidden ? null : calculateHandValue(dealerCards);
  const outcomeText = getOutcomeText(outcome);

  return (
    <div className="absolute inset-0 flex items-center justify-center text-white">
      <div className="my-game-blackjack-board absolute inset-x-[8%] inset-y-[10%] rounded-2xl p-4 sm:p-5">
        <div className="my-game-blackjack-shell my-game-blackjack-shell--classic">
          <div className="my-game-blackjack-topbar my-game-blackjack-topbar--classic">
            <div className="my-game-blackjack-topbar-left">
              <p className="my-game-blackjack-title">{game.title}</p>
            </div>

            <div className="my-game-blackjack-summary">
              <div className="my-game-blackjack-summary-item">
                <span className="my-game-blackjack-label">Bet</span>
                <strong>{betAmount} APE</strong>
              </div>

              <div className="my-game-blackjack-summary-item">
                <span className="my-game-blackjack-label">Payout</span>
                <strong>{payoutAmount} APE</strong>
              </div>
            </div>
          </div>

          <div className="my-game-blackjack-playfield">
            <section className="my-game-blackjack-lane my-game-blackjack-lane--dealer">
              <div className="my-game-blackjack-lane-header">
                <h3 className="my-game-blackjack-lane-title">Dealer</h3>
                <span className="my-game-blackjack-total-pill">
                  {dealerTotal === null ? "Hidden" : `Total: ${dealerTotal}`}
                </span>
              </div>

              <div className="my-game-blackjack-cards-row my-game-blackjack-cards-row--dealer">
                {visibleDealerCards.map((card) => (
                  <Image
                    key={card.id}
                    src={getCardImagePath(card)}
                    alt={formatCardLabel(card)}
                    width={64}
                    height={92}
                    className="my-game-blackjack-card-image"
                  />
                ))}

                {dealerHidden && dealerCards.length > 1 ? (
                  <Image
                    src="/my-game/cards/back.png"
                    alt="Hidden card"
                    width={64}
                    height={92}
                    className="my-game-blackjack-card-image"
                  />
                ) : null}
              </div>
            </section>

            <section className="my-game-blackjack-lane my-game-blackjack-lane--player">
              <div className="my-game-blackjack-lane-header">
                <h3 className="my-game-blackjack-lane-title">Wizard</h3>
                <span className="my-game-blackjack-total-pill">{`Total: ${playerTotal}`}</span>
              </div>

              <div className="my-game-blackjack-cards-row my-game-blackjack-cards-row--player">
                {playerCards.map((card) => (
                  <Image
                    key={card.id}
                    src={getCardImagePath(card)}
                    alt={formatCardLabel(card)}
                    width={64}
                    height={92}
                    className="my-game-blackjack-card-image"
                  />
                ))}
              </div>
            </section>
          </div>

         <div className="my-game-blackjack-bottombar my-game-blackjack-bottombar--classic">
  <div className="my-game-blackjack-status-panel">
    {outcomeText ? (
      <p className="my-game-blackjack-outcome">{outcomeText}</p>
    ) : (
      <p className="my-game-blackjack-status-text">{statusMessage}</p>
    )}
  </div>

  {phase === "player-turn" ? (
    <div className="my-game-blackjack-actions">
      <button
        type="button"
        className="my-game-blackjack-button my-game-blackjack-button--primary"
        onClick={onHit}
        disabled={!canHit}
      >
        Hit
      </button>

      <button
        type="button"
        className="my-game-blackjack-button my-game-blackjack-button--secondary"
        onClick={onStand}
        disabled={!canStand}
      >
        Stand
      </button>
    </div>
  ) : (
    <div className="my-game-blackjack-actions my-game-blackjack-actions--placeholder" />
  )}
</div>
        </div>
      </div>
    </div>
  );
};

export default MyGameWindow;