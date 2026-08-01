import { GameState, Action } from "./types";
import { actionRegistry } from "./actions";

export function applyAction(state: GameState, action: Action): GameState {
  const handler = actionRegistry.get(action.type);
  if (!handler) {
    throw new Error(`Unknown action type: ${action.type}`);
  }

  if (!handler.isLegal(state, action)) {
    throw new Error(`Illegal action: ${action.type}`);
  }

  return handler.apply(state, action);
}
