import { Card, GameState, PokemonType, CardInstance } from "./types.js";
export declare function setCardRegistry(registry: Map<string, Card> | null): void;
export declare function getCard(state: GameState, cardId: string): Card | null;
export declare function getPokemon(state: GameState, cardId: string): {
    type: "pokemon";
    id: string;
    name: string;
    hp: number;
    stage: 0 | 1 | 2;
    evolvesFrom?: string;
    types: PokemonType[];
    weakness?: {
        type: PokemonType;
        mult: 2;
    };
    resistance?: {
        type: PokemonType;
        reduce: 30;
    };
    retreatCost: number;
    prizeValue?: number;
    abilities: import("./types.js").Ability[];
    attacks: import("./types.js").Attack[];
} | null;
/**
 * Colorless cost is payable by *any* energy, so typed requirements must be
 * matched first and whatever is left over pays the Colorless.
 */
export declare function canPayCost(state: GameState, attached: CardInstance[], cost: PokemonType[]): boolean;
export declare function nextRandom(state: GameState): [number, GameState];
export declare function flipCoin(state: GameState): [boolean, GameState];
//# sourceMappingURL=cardLookup.d.ts.map