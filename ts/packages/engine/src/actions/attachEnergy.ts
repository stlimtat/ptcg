import { GameState, Action, ActionHandler } from "../types.js";
import { getCard } from "../cardLookup.js";

export { setCardRegistry } from "../cardLookup.js";

export const attachEnergyHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "attachEnergy") return false;

    // Only one energy per turn
    if (state.players[action.player].energyAttachedThisTurn) return false;

    // Only active player can play during main phase
    if (action.player !== state.activePlayer) return false;
    if (state.phase !== "main") return false;
    if (state.pendingPromote?.length) return false;
    if (state.pendingChoice) return false;
    if (state.players[action.player].attackedThisTurn) return false;

    const player = state.players[action.player];

    // Card must exist in hand
    const card = player.hand.find((c) => c.cardId === action.energyCardId);
    if (!card) return false;

    // Must actually be an Energy card
    const cardDef = getCard(state, action.energyCardId);
    if (cardDef && cardDef.type !== "energy") return false;

    // Find target in bench or active
    const target =
      (player.active?.card.instanceId === action.targetInstanceId ? player.active : null) ||
      player.bench.find((p) => p.card.instanceId === action.targetInstanceId);
    if (!target) return false;

    return true;
  },

  apply(state: GameState, action: Action): GameState {
    const typedAction = action as Extract<Action, { type: "attachEnergy" }>;
    const player = state.players[action.player];
    const cardInstance = player.hand.find((c) => c.cardId === typedAction.energyCardId)!;

    // Find and attach to target
    const newActive = player.active?.card.instanceId === typedAction.targetInstanceId
      ? {
          ...player.active,
          attachedEnergy: [...player.active.attachedEnergy, cardInstance],
        }
      : player.active;

    const newBench = player.bench.map((p) =>
      p.card.instanceId === typedAction.targetInstanceId
        ? { ...p, attachedEnergy: [...p.attachedEnergy, cardInstance] }
        : p
    );

    return {
      ...state,
      players: {
        ...state.players,
        [action.player]: {
          ...player,
          hand: player.hand.filter((c) => c !== cardInstance),
          active: newActive,
          bench: newBench,
          energyAttachedThisTurn: true,
        },
      },
      log: [
        ...state.log,
        {
          timestamp: Date.now(),
          player: action.player,
          message: `${action.player} attached energy`,
        },
      ],
    };
  },
};
