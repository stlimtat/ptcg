import { GameState, Action, ActionHandler } from "../types.js";
import { resumeEffect } from "../effects/choice.js";

/**
 * Answer a pending choice with one card, or with nothing to stop early. The
 * effect resumes once no picks remain (or the player passes on an optional one).
 */
export const chooseHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "choose") return false;
    const choice = state.pendingChoice;
    if (!choice || choice.player !== action.player) return false;

    if (action.instanceId === undefined) return choice.optional;
    return choice.options.includes(action.instanceId);
  },

  apply(state: GameState, action: Action): GameState {
    if (action.type !== "choose") return state;
    const choice = state.pendingChoice!;

    if (action.instanceId === undefined) {
      return resumeEffect(state, choice.effect, choice.step, choice.player, choice.picked, choice.args);
    }

    const picked = [...choice.picked, action.instanceId];
    const remaining = choice.remaining - 1;
    // Repeatable choices (damage counters) can land on the same target twice.
    const options = choice.repeatable ? choice.options : choice.options.filter((id) => id !== action.instanceId);

    if (remaining <= 0 || options.length === 0) {
      return resumeEffect(state, choice.effect, choice.step, choice.player, picked, choice.args);
    }

    return { ...state, pendingChoice: { ...choice, picked, remaining, options } };
  },
};
