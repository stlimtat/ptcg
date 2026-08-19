import { GameState, Action, ActionHandler, PokemonInPlay } from "../types.js";
import { abilities, usableAbilities } from "../effects/abilities.js";

function findPokemon(state: GameState, player: "p1" | "p2", instanceId: string): PokemonInPlay | null {
  const ps = state.players[player];
  return [ps.active, ...ps.bench].find((p) => p?.card.instanceId === instanceId) ?? null;
}

/** Activate a "once during your turn" Ability. */
export const useAbilityHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "useAbility") return false;
    if (action.player !== state.activePlayer) return false;
    if (state.phase !== "main") return false;
    if (state.pendingPromote?.length || state.pendingChoice) return false;
    if (state.players[action.player].attackedThisTurn) return false;

    const source = findPokemon(state, action.player, action.instanceId);
    if (!source) return false;
    return usableAbilities(state, action.player, source).includes(action.abilityName);
  },

  apply(state: GameState, action: Action): GameState {
    if (action.type !== "useAbility") return state;
    const impl = abilities[action.abilityName];
    if (!impl) return state;

    const used = state.players[action.player].abilitiesUsedThisTurn ?? [];
    const next: GameState = {
      ...state,
      players: {
        ...state.players,
        [action.player]: {
          ...state.players[action.player],
          abilitiesUsedThisTurn: [...used, `${action.instanceId}:${action.abilityName}`],
        },
      },
      log: [
        ...state.log,
        { timestamp: Date.now(), player: action.player, message: `${action.player} used ${action.abilityName}` },
      ],
    };

    // The source Pokémon is passed through as an argument so steps that act on
    // it survive the round trip through a pending choice.
    return impl.steps[0](next, action.player, [], [action.instanceId]);
  },
};
