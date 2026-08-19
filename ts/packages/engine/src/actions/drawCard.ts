import { GameState, Action, ActionHandler } from "../types.js";

export const drawCardHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "drawCard") return false;

    // Only active player can draw
    if (action.player !== state.activePlayer) return false;
    if (state.pendingPromote?.length || state.pendingChoice) return false;

    // Must have cards in deck
    if (state.players[action.player].deck.length === 0) return false;

    return true;
  },

  apply(state: GameState, action: Action): GameState {
    const player = state.players[action.player];

    if (player.deck.length === 0) {
      return state;
    }

    const card = player.deck[0];
    const newDeck = player.deck.slice(1);

    return {
      ...state,
      players: {
        ...state.players,
        [action.player]: {
          ...player,
          deck: newDeck,
          hand: [...player.hand, card],
          hasDrawnThisTurn: true,
        },
      },
      log: [
        ...state.log,
        {
          timestamp: Date.now(),
          player: action.player,
          message: `${action.player} drew a card`,
        },
      ],
    };
  },
};
