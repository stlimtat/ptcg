import { GameState, Player } from "../types.js";
import { nextRandom } from "../cardLookup.js";

/** Seeded deck shuffle, shared by every effect that says "shuffle your deck". */
export function shuffleDeck(state: GameState, player: Player): GameState {
  const deck = [...state.players[player].deck];
  let next = state;
  for (let i = deck.length - 1; i > 0; i--) {
    const [value, advanced] = nextRandom(next);
    next = advanced;
    const j = Math.floor(value * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return { ...next, players: { ...next.players, [player]: { ...next.players[player], deck } } };
}
