import { GameState, Player, PokemonInPlay } from "../types.js";
import { EffectStep } from "./choice.js";
export interface AbilityImpl {
    /** Can it be used right now, by this Pokémon? */
    usable: (state: GameState, player: Player, source: PokemonInPlay) => boolean;
    steps: EffectStep[];
}
export declare const abilities: Record<string, AbilityImpl>;
export declare const isAbilityImplemented: (name: string) => boolean;
/** Abilities on a Pokémon that can be activated right now. */
export declare function usableAbilities(state: GameState, player: Player, poke: PokemonInPlay): string[];
//# sourceMappingURL=abilities.d.ts.map