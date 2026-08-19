import { Card, GameState, Player } from "../types.js";
import { ActionSpaceView } from "./actionSpace.js";
import { GameRecord } from "./record.js";
export interface Decision {
    state: GameState;
    seat: Player;
    observation: Float32Array;
    space: ActionSpaceView;
}
/** Returns the index in the action space to take. */
export type Policy = (decision: Decision) => number;
export interface Transition {
    seat: Player;
    observation: Float32Array;
    mask: Uint8Array;
    action: number;
    /** +1 win, -1 loss, 0 otherwise; only the terminal step is non-zero. */
    reward: number;
}
export interface EpisodeResult {
    winner: Player | "draw" | null;
    turns: number;
    steps: number;
    /** Why the game ended, read off the final log line. */
    reason: string;
    transitions: Transition[];
    /** Present when `record` was requested: every action and the board after it. */
    record?: GameRecord;
}
export interface EpisodeOptions {
    seed?: number;
    maxTurns?: number;
    maxSteps?: number;
    /** Skip transition recording when only the result matters (deck evaluation). */
    recordTransitions?: boolean;
    /**
     * Record every action plus the board after it, so the game can be replayed and
     * inspected. Off by default: it costs a snapshot per step, which is wasted
     * work for the thousands of throwaway games deck evaluation runs.
     */
    record?: boolean;
    /** Deck lists, stored in the record so a replay can reconstruct the game. */
    decks?: Record<Player, string[]>;
    deckNames?: Record<Player, string>;
}
/**
 * Play one full game between two policies.
 *
 * Whoever must act next is derived from the state — a pending choice or an owed
 * promotion can put the seat that is *not* the active player on the clock — so a
 * policy never has to reason about turn order.
 */
export declare function runEpisode(p1Deck: string[], p2Deck: string[], registry: Record<string, Card>, policies: Record<Player, Policy>, options?: EpisodeOptions): EpisodeResult;
/**
 * Continue a game from an arbitrary position. Decision-time search needs this:
 * a rollout is just "finish this game from here and see who wins".
 */
export declare function playFrom(initial: GameState, policies: Record<Player, Policy>, options?: EpisodeOptions): EpisodeResult;
/** The seat that owes the next action, or null if the game is stuck. */
export declare function seatToAct(state: GameState): Player | null;
//# sourceMappingURL=episode.d.ts.map