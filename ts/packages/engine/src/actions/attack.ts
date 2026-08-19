import { GameState, Action, ActionHandler } from "../types.js";
import { getPokemon, canPayCost } from "../cardLookup.js";
import { resolveAttack, adjustedCost } from "../attackFlow.js";

export { setCardRegistry } from "../cardLookup.js";

export const attackHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "attack") return false;
    if (action.player !== state.activePlayer) return false;
    if (state.phase !== "main") return false;
    if (state.pendingPromote?.length) return false;
    if (state.pendingChoice) return false;

    // The player going first may not attack on the first turn.
    if (state.turn === 1 && action.player === "p1") return false;

    const player = state.players[action.player];
    if (!player.active) return false;
    // Nothing to attack.
    if (!state.players[action.player === "p1" ? "p2" : "p1"].active) return false;

    const cardDef = getPokemon(state, player.active.card.cardId);
    if (!cardDef) return false;

    const attack = cardDef.attacks[action.attackIndex];
    if (!attack) return false;

    if (!canPayCost(state, player.active.attachedEnergy, adjustedCost(state, action.player, player.active, attack))) {
      return false;
    }

    if (
      state.ongoing?.some(
        (e) =>
          e.kind === "noAttack" &&
          e.appliesTo === action.player &&
          (!e.instanceId || e.instanceId === player.active!.card.instanceId)
      )
    ) {
      return false;
    }

    if (player.active.statusConditions.includes("Paralyzed")) return false;
    if (player.active.statusConditions.includes("Asleep")) return false;

    return true;
  },

  apply(state: GameState, action: Action): GameState {
    if (action.type !== "attack") return state;
    const next = resolveAttack(state, action.player, action.attackIndex);
    if (next.phase === "gameOver") return next;
    // Attacking ends your turn.
    return {
      ...next,
      players: {
        ...next.players,
        [action.player]: { ...next.players[action.player], attackedThisTurn: true },
      },
    };
  },
};
