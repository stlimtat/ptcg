import { GameState, Action, ActionHandler, Card } from "../types";

// Card registry lookup - set during testing to validate retreat costs
let testCardRegistry: Map<string, Card> | null = null;

export function setCardRegistry(registry: Map<string, Card> | null) {
  testCardRegistry = registry;
}

export const retreatHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "retreat") return false;

    // Only active player can play during main phase
    if (action.player !== state.activePlayer) return false;
    if (state.phase !== "main") return false;

    const player = state.players[action.player];

    // Must have active Pokémon
    if (!player.active) return false;

    // Bench Pokémon must exist
    const benchPokemon = player.bench.find((p) => p.card.instanceId === action.benchInstanceId);
    if (!benchPokemon) return false;

    // Get retreat cost from active Pokémon
    // Card registry validation pending phase 9
    let retreatCost = 1;
    if (testCardRegistry) {
      const cardDef = testCardRegistry.get(player.active.card.cardId);
      if (cardDef && cardDef.type === "pokemon") {
        retreatCost = cardDef.retreatCost;
      }
    }

    // Must have enough energy attached
    if (player.active.attachedEnergy.length < retreatCost) return false;

    return true;
  },

  apply(state: GameState, action: Action): GameState {
    const typedAction = action as Extract<Action, { type: "retreat" }>;
    const player = state.players[action.player];
    const activeCard = player.active!;
    const benchPokemon = player.bench.find((p) => p.card.instanceId === typedAction.benchInstanceId)!;

    // Get retreat cost
    let retreatCost = 1;
    if (testCardRegistry) {
      const cardDef = testCardRegistry.get(activeCard.card.cardId);
      if (cardDef && cardDef.type === "pokemon") {
        retreatCost = cardDef.retreatCost;
      }
    }

    // Discard energy
    const energyToDiscard = activeCard.attachedEnergy.slice(0, retreatCost);
    const remainingEnergy = activeCard.attachedEnergy.slice(retreatCost);

    // Update bench list: remove switched bench Pokémon, add old active
    const newBench = player.bench.map((p) =>
      p.card.instanceId === typedAction.benchInstanceId
        ? { ...activeCard, attachedEnergy: remainingEnergy }
        : p
    );

    return {
      ...state,
      players: {
        ...state.players,
        [action.player]: {
          ...player,
          active: benchPokemon,
          bench: newBench,
          discard: [...player.discard, ...energyToDiscard],
        },
      },
      log: [
        ...state.log,
        {
          timestamp: Date.now(),
          player: action.player,
          message: `${action.player} retreated`,
        },
      ],
    };
  },
};
