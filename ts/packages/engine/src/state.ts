import { randomUUID } from "crypto";
import { GameState } from "./types";

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createInitialState(
  p1DeckCardIds: string[],
  p2DeckCardIds: string[]
): GameState {
  return {
    turn: 1,
    activePlayer: "p1",
    phase: "setup",
    players: {
      p1: {
        deck: shuffle(p1DeckCardIds).map((cardId) => {
          const id = randomUUID();
          return { id, cardId, instanceId: id };
        }),
        hand: [],
        discard: [],
        prizes: [],
        active: null,
        bench: [],
        energyAttachedThisTurn: false,
        supporterPlayedThisTurn: false,
      },
      p2: {
        deck: shuffle(p2DeckCardIds).map((cardId) => {
          const id = randomUUID();
          return { id, cardId, instanceId: id };
        }),
        hand: [],
        discard: [],
        prizes: [],
        active: null,
        bench: [],
        energyAttachedThisTurn: false,
        supporterPlayedThisTurn: false,
      },
    },
    log: [],
  };
}
