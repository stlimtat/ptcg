import { GameState, Action, ActionHandler, Card } from "../types";

// Card registry lookup - set during testing to validate evolution chains
let testCardRegistry: Map<string, Card> | null = null;

export function setCardRegistry(registry: Map<string, Card> | null) {
  testCardRegistry = registry;
}

export const evolveHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "evolve") return false;

    // Only active player can play during main phase
    if (action.player !== state.activePlayer) return false;
    if (state.phase !== "main") return false;

    const player = state.players[action.player];

    // Card must exist in hand
    const card = player.hand.find((c) => c.cardId === action.cardId);
    if (!card) return false;

    // Find target in bench or active
    const target =
      (player.active?.card.instanceId === action.targetInstanceId ? player.active : null) ||
      player.bench.find((p) => p.card.instanceId === action.targetInstanceId);
    if (!target) return false;

    // Validate evolution chain if registry available
    // Card registry validation pending phase 9
    if (testCardRegistry) {
      const evolutionCard = testCardRegistry.get(action.cardId);
      const targetCard = testCardRegistry.get(target.card.cardId);

      if (!evolutionCard || evolutionCard.type !== "pokemon") return false;
      if (!targetCard || targetCard.type !== "pokemon") return false;

      // Evolution must be next stage
      if (evolutionCard.stage !== targetCard.stage + 1) return false;

      // Evolution must match evolvesFrom
      if (evolutionCard.evolvesFrom !== targetCard.id) return false;
    }

    return true;
  },

  apply(state: GameState, action: Action): GameState {
    const typedAction = action as Extract<Action, { type: "evolve" }>;
    const player = state.players[action.player];
    const cardInstance = player.hand.find((c) => c.cardId === typedAction.cardId)!;

    // Find and replace target
    const newActive = player.active?.card.instanceId === typedAction.targetInstanceId
      ? { ...player.active, card: cardInstance }
      : player.active;

    const newBench = player.bench.map((p) =>
      p.card.instanceId === typedAction.targetInstanceId
        ? { ...p, card: cardInstance }
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
        },
      },
      log: [
        ...state.log,
        {
          timestamp: Date.now(),
          player: action.player,
          message: `${action.player} evolved Pokémon`,
        },
      ],
    };
  },
};
