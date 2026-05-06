import { Game } from "@/lib/games";

export const myGame: Game = {
  title: "Blackjack",
  description: "Beat the dealer by getting closer to 21 without going over.",
  gameAddress: "0x1234567890123456789012345678901234567890",
  gameBackground: "/my-game/backgroundv2.png",
  card: "/my-game/card.png",
  banner: "/my-game/banner.png",
  advanceToNextStateAsset: "/my-game/advance-button.png",
  themeColorBackground: "#0F7B45",
  song: "/my-game/audio/song.mp3",
  payouts: {
    0: {
      0: { 0: 20000 },
    },
  },
};

export type CurrentView = 0 | 1 | 2;

export type RoundPhase =
  | "idle"
  | "dealing"
  | "player-turn"
  | "dealer-turn"
  | "resolved";

export type CardSuit = "hearts" | "diamonds" | "clubs" | "spades";

export type CardRank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type RoundOutcome = "player" | "dealer" | "push" | null;

export interface PlayingCard {
  id: string;
  suit: CardSuit;
  rank: CardRank;
  value: number;
}

export interface ReplayRoundData {
  roundId: string;
  betAmount: number;
  playerCards: PlayingCard[];
  dealerCards: PlayingCard[];
  outcome: Exclude<RoundOutcome, null>;
  payout: number;
}

export interface BlackjackState {
  currentView: CurrentView;
  betAmount: number;
  phase: RoundPhase;
  deck: PlayingCard[];
  playerCards: PlayingCard[];
  dealerCards: PlayingCard[];
  dealerHidden: boolean;
  canHit: boolean;
  canStand: boolean;
  outcome: RoundOutcome;
  payout: number;
  statusMessage: string;
  roundId: string | null;
  replayData: ReplayRoundData | null;
}

export const BLACKJACK_MIN_BET = 1;
export const BLACKJACK_MAX_BET = 100;
export const DEALER_STAND_VALUE = 17;
export const BLACKJACK_PAYOUT_MULTIPLIER = 2;
export const PUSH_PAYOUT_MULTIPLIER = 1;

const SUITS: CardSuit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: CardRank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export const initialBlackjackState: BlackjackState = {
  currentView: 0,
  betAmount: BLACKJACK_MIN_BET,
  phase: "idle",
  deck: [],
  playerCards: [],
  dealerCards: [],
  dealerHidden: true,
  canHit: false,
  canStand: false,
  outcome: null,
  payout: 0,
  statusMessage: "Place your bet to begin.",
  roundId: null,
  replayData: null,
};

export const getCardBaseValue = (rank: CardRank): number => {
  if (rank === "A") {
    return 11;
  }

  if (rank === "J" || rank === "Q" || rank === "K") {
    return 10;
  }

  return Number(rank);
};

export const createDeck = (): PlayingCard[] => {
  const deck: PlayingCard[] = [];

  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      deck.push({
        id: `${rank}-${suit}`,
        suit,
        rank,
        value: getCardBaseValue(rank),
      });
    });
  });

  return deck;
};

export const shuffleDeck = (deck: PlayingCard[]): PlayingCard[] => {
  const shuffledDeck = [...deck];

  for (let index = shuffledDeck.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const currentCard = shuffledDeck[index];

    shuffledDeck[index] = shuffledDeck[randomIndex];
    shuffledDeck[randomIndex] = currentCard;
  }

  return shuffledDeck;
};

export const calculateHandValue = (cards: PlayingCard[]): number => {
  let total = cards.reduce((sum, card) => sum + card.value, 0);
  let aceCount = cards.filter((card) => card.rank === "A").length;

  while (total > 21 && aceCount > 0) {
    total -= 10;
    aceCount -= 1;
  }

  return total;
};

export const isBlackjack = (cards: PlayingCard[]): boolean => {
  return cards.length === 2 && calculateHandValue(cards) === 21;
};

export const isBust = (cards: PlayingCard[]): boolean => {
  return calculateHandValue(cards) > 21;
};

export const drawCard = (
  deck: PlayingCard[]
): { nextDeck: PlayingCard[]; drawnCard: PlayingCard } => {
  const [drawnCard, ...remainingDeck] = deck;

  if (!drawnCard) {
    throw new Error("Cannot draw a card from an empty deck.");
  }

  return {
    nextDeck: remainingDeck,
    drawnCard,
  };
};

export const createRoundId = (): string => {
  return `blackjack-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};