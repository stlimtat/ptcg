import { GameState, Action, ActionHandler } from "../types";

export const endTurnHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "endTurn") return false;
    return action.player === state.activePlayer;
  },

  apply(state: GameState, action: Action): GameState {
    const otherPlayer = action.player === "p1" ? "p2" : "p1";
    const newTurn = action.player === "p2" ? state.turn + 1 : state.turn;

    return {
      ...state,
      turn: newTurn,
      activePlayer: otherPlayer,
      players: {
        ...state.players,
        [action.player]: {
          ...state.players[action.player],
          energyAttachedThisTurn: false,
          supporterPlayedThisTurn: false,
          hasDrawnThisTurn: false,
        },
      },
      log: [
        ...state.log,
        {
          timestamp: Date.now(),
          player: action.player,
          message: `${action.player} ended turn`,
        },
      ],
    };
  },
};
