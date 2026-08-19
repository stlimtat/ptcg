import { GameState, PokemonInPlay, PokemonType } from "./types.js";
export { setCardRegistry } from "./cardLookup.js";
type Player = "p1" | "p2";
/**
 * Knock out `victim`'s Active Pokémon: card plus everything attached goes to the
 * discard, the attacker takes that Pokémon's prize value, and the victim owes a
 * promotion. Used by attacks and by between-turn poison/burn damage alike.
 */
export declare function applyKnockout(state: GameState, victim: Player, attacker: Player | null): GameState;
/** Move damage onto a Pokémon in play and knock it out if it reached its HP. */
export declare function applyDamage(state: GameState, victim: Player, amount: number, attacker: Player | null): GameState;
export declare function damageFor(state: GameState, attacker: Player, attackIndex: number, bonus?: number): number;
/** The single attack resolution path. `attackHandler.apply` delegates here. */
export declare function resolveAttack(state: GameState, attacker: Player, attackIndex: number): GameState;
/** An attack's cost after Tools and Stadiums adjust it. */
export declare function adjustedCost(state: GameState, attacker: Player, source: PokemonInPlay, attack: {
    cost: PokemonType[];
}): PokemonType[];
//# sourceMappingURL=attackFlow.d.ts.map