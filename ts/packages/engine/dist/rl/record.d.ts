import { Action, Card, GameState, Player } from "../types.js";
/**
 * A game recorded well enough to replay it.
 *
 * The engine is deterministic given a seed and a list of actions, so the seed
 * plus `steps[].action` is the authoritative record — everything else is
 * derived, and `replayRecord` re-derives it to prove the record is faithful.
 *
 * `board` is a human- and diff-readable snapshot after each step. It exists so a
 * replay can be inspected without instantiating the engine, and so a divergence
 * between record and replay can be localised to a step rather than just
 * detected.
 */
export interface RecordedStep {
    /** 1-based index over the whole game. */
    step: number;
    turn: number;
    seat: Player;
    action: Action;
    /** How many actions were legal here — the branching factor at this decision. */
    legalCount: number;
    /** Log lines the engine produced in response to this action. */
    log: string[];
    board: BoardSnapshot;
}
export interface PokemonSnapshot {
    card: string;
    name: string;
    damage: number;
    hp: number;
    energy: string[];
    tools: string[];
    status: string[];
}
export interface SideSnapshot {
    active: PokemonSnapshot | null;
    bench: PokemonSnapshot[];
    handCount: number;
    hand: string[];
    deckCount: number;
    discardCount: number;
    prizeCount: number;
}
export interface BoardSnapshot {
    turn: number;
    phase: GameState["phase"];
    activePlayer: Player;
    stadium: string | null;
    pendingChoice: {
        player: Player;
        prompt: string;
        optionCount: number;
    } | null;
    pendingPromote: Player[];
    p1: SideSnapshot;
    p2: SideSnapshot;
}
export interface GameRecord {
    version: 1;
    seed: number | undefined;
    decks: Record<Player, string[]>;
    deckNames?: Record<Player, string>;
    winner: Player | "draw" | null;
    reason: string;
    turns: number;
    steps: RecordedStep[];
}
/** Everything about a position that is worth reading back later. */
export declare function snapshotBoard(state: GameState, registry?: Record<string, Card>): BoardSnapshot;
/**
 * Re-run a record's actions against a fresh game and report where — if anywhere —
 * the replay diverges from what was recorded. An empty list means the record
 * reproduces exactly.
 */
export declare function replayRecord(record: GameRecord, registry: Record<string, Card>, startGame: (p1: string[], p2: string[], reg: Record<string, Card>, seed?: number) => GameState, applyAction: (state: GameState, action: Action) => GameState): {
    divergences: string[];
    finalState: GameState;
};
/** One line per step, in the same shape replay.mjs prints. */
export declare function formatRecord(record: GameRecord): string;
//# sourceMappingURL=record.d.ts.map