import { Attack, GameState, Player, PokemonInPlay, PokemonType } from "../types.js";
/** Jamming Tower switches every Tool off. */
export declare const toolsDisabled: (state: GameState) => boolean;
/**
 * Whether a Pokémon's Abilities work at all. Team Rocket's Watchtower turns off
 * every Colorless Pokémon's Ability, on both sides.
 */
export declare function abilitiesLocked(state: GameState, poke: PokemonInPlay): boolean;
export declare function effectiveHp(state: GameState, poke: PokemonInPlay): number;
export declare function effectiveRetreatCost(state: GameState, owner: Player, poke: PokemonInPlay): number;
/**
 * Weakness after continuous effects. Lillie's Clefairy ex rewrites the Weakness
 * of the *opponent's* Dragon Pokémon, so this needs to know who owns the target.
 */
export declare function effectiveWeakness(state: GameState, owner: Player, poke: PokemonInPlay): {
    type: PokemonType;
    mult: 2;
} | undefined;
/** Extra damage to the opponent's Active Pokémon, before Weakness/Resistance. */
export declare function attackDamageBonus(state: GameState, attacker: Player, source: PokemonInPlay, _attack: Attack): number;
/** Damage reduction applied to the Pokémon taking the hit. */
export declare function damageTakenReduction(state: GameState, poke: PokemonInPlay): number;
/**
 * Colorless Energy added to or removed from an attack's cost. Negative makes the
 * attack cheaper.
 */
export declare function attackCostAdjustment(state: GameState, attacker: Player, source: PokemonInPlay): number;
/** Area Zero Underdepths widens the Bench for players with a Tera Pokémon. */
export declare function benchLimit(state: GameState, owner: Player): number;
/** Battle Cage stops attack and Ability effects placing counters on the Bench. */
export declare const benchCountersPrevented: (state: GameState) => boolean;
/** Festival Grounds keeps Special Conditions off anything with Energy attached. */
export declare function immuneToStatus(state: GameState, poke: PokemonInPlay): boolean;
/** Risky Ruins chips any Basic non-Darkness Pokémon put onto a Bench. */
export declare function benchPlacementDamage(state: GameState, cardId: string): number;
/** Forest of Vitality lets Grass Pokémon evolve the turn they are played. */
export declare function canEvolveImmediately(state: GameState, cardId: string): boolean;
/**
 * Tools, Stadiums and continuous Abilities this module actually implements.
 * The coverage tests read it so "routed into play" is never mistaken for
 * "does what the card says".
 */
export declare const CONTINUOUS_CARDS: Set<string>;
//# sourceMappingURL=continuous.d.ts.map