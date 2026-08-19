import { GameState, Action, ActionHandler } from "../types.js";
import { getCard } from "../cardLookup.js";
import { canEvolveImmediately } from "../effects/continuous.js";

export { setCardRegistry } from "../cardLookup.js";

export const evolveHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "evolve") return false;

    // Only active player can play during main phase
    if (action.player !== state.activePlayer) return false;
    if (state.phase !== "main") return false;
    if (state.pendingPromote?.length) return false;
    if (state.pendingChoice) return false;
    if (state.players[action.player].attackedThisTurn) return false;

    const player = state.players[action.player];

    // Card must exist in hand
    const card = player.hand.find((c) => c.cardId === action.cardId);
    if (!card) return false;

    // Find target in bench or active
    const target =
      (player.active?.card.instanceId === action.targetInstanceId ? player.active : null) ||
      player.bench.find((p) => p.card.instanceId === action.targetInstanceId);
    if (!target) return false;

    // A Pokémon cannot evolve on the turn it came into play, unless a Stadium
    // says otherwise.
    if (
      target.placedOnTurn !== undefined &&
      target.placedOnTurn >= state.turn &&
      !canEvolveImmediately(state, action.cardId)
    ) {
      return false;
    }

    const evolutionCard = getCard(state, action.cardId);
    const targetCard = getCard(state, target.card.cardId);
    if (evolutionCard || targetCard) {
      if (!evolutionCard || evolutionCard.type !== "pokemon") return false;
      if (!targetCard || targetCard.type !== "pokemon") return false;

      // Evolution must be next stage
      if (evolutionCard.stage !== targetCard.stage + 1) return false;

      // evolvesFrom names the Pokémon evolved from (test fixtures key it by id)
      if (![targetCard.name, targetCard.id].includes(evolutionCard.evolvesFrom as string)) return false;
    }

    return true;
  },

  apply(state: GameState, action: Action): GameState {
    const typedAction = action as Extract<Action, { type: "evolve" }>;
    const player = state.players[action.player];
    const cardInstance = player.hand.find((c) => c.cardId === typedAction.cardId)!;

    // Find and replace target
    // Evolving keeps damage and attachments but clears Special Conditions.
    const evolved = (p: typeof player.active & {}) => ({
      ...p,
      card: cardInstance,
      statusConditions: [],
      placedOnTurn: state.turn,
    });

    const newActive = player.active?.card.instanceId === typedAction.targetInstanceId
      ? evolved(player.active)
      : player.active;

    const newBench = player.bench.map((p) =>
      p.card.instanceId === typedAction.targetInstanceId ? evolved(p) : p
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
