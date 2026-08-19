import { GameState, Action, ActionHandler } from "../types.js";
import { getCard } from "../cardLookup.js";
import { benchLimit, benchPlacementDamage } from "../effects/continuous.js";

export { setCardRegistry } from "../cardLookup.js";

export const playPokemonHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "playPokemon") return false;

    // Only active player can play during main phase
    if (action.player !== state.activePlayer) return false;
    if (state.phase !== "main") return false;
    if (state.pendingPromote?.length) return false;
    if (state.pendingChoice) return false;
    if (state.players[action.player].attackedThisTurn) return false;

    const player = state.players[action.player];

    // Bench must have space (a Stadium can widen it)
    if (player.bench.length >= benchLimit(state, action.player)) return false;

    // Card must exist in hand
    const card = player.hand.find((c) => c.cardId === action.cardId);
    if (!card) return false;

    // Only Basic Pokémon can be played straight to the bench
    const cardDef = getCard(state, action.cardId);
    if (cardDef && (cardDef.type !== "pokemon" || cardDef.stage !== 0)) return false;

    return true;
  },

  apply(state: GameState, action: Action): GameState {
    const typedAction = action as Extract<Action, { type: "playPokemon" }>;
    const player = state.players[action.player];
    const cardInstance = player.hand.find((c) => c.cardId === typedAction.cardId)!;

    return {
      ...state,
      players: {
        ...state.players,
        [action.player]: {
          ...player,
          hand: player.hand.filter((c) => c !== cardInstance),
          bench: [
            ...player.bench,
            {
              card: cardInstance,
              attachedEnergy: [],
              attachedTools: [],
              statusConditions: [],
              placedOnTurn: state.turn,
              // Risky Ruins chips Basics as they hit the Bench.
              damage: benchPlacementDamage(state, cardInstance.cardId),
            },
          ],
        },
      },
      log: [
        ...state.log,
        {
          timestamp: Date.now(),
          player: action.player,
          message: `${action.player} played basic Pokémon to bench`,
        },
      ],
    };
  },
};
