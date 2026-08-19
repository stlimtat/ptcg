import { Card, GameState } from "./types.js";
export declare function createInitialState(p1DeckCardIds: string[], p2DeckCardIds: string[], seed?: number): GameState;
/**
 * Deal opening hands (mulliganing hands with no Basic Pokémon), set prizes, and
 * leave both players owing a promotion. This is the headless entry point: play
 * proceeds entirely through legalActions/applyAction from here.
 *
 * ponytail: bench placement during setup is skipped — a player can bench on
 * their first turn instead. Add it if opening-board decisions start mattering.
 */
export declare function startGame(p1DeckCardIds: string[], p2DeckCardIds: string[], cardRegistry: Record<string, Card>, seed?: number): GameState;
//# sourceMappingURL=state.d.ts.map