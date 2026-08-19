import { CardInstance, GameState, Player } from "../types.js";
/**
 * Card effects that need a decision park a PendingChoice on the state and stop.
 * The player answers with a `choose` action, and once enough cards are picked
 * the effect resumes at `step`.
 *
 * Choices are asked one card at a time on purpose: enumerating every k-of-n
 * subset would blow up the action space an agent has to search.
 */
export interface PendingChoice {
    player: Player;
    prompt: string;
    /** instanceIds still selectable */
    options: string[];
    /** cards picked so far */
    picked: string[];
    /** how many more may be picked */
    remaining: number;
    /** may the player stop early (or pick nothing at all)? */
    optional: boolean;
    /** effect to resume, and which step of it */
    effect: string;
    step: number;
    /** options stay selectable after being picked (e.g. damage counters) */
    repeatable?: boolean;
    /** parameters the resuming step needs, e.g. how many counters to place */
    args?: (string | number)[];
}
export declare function ask(state: GameState, choice: Omit<PendingChoice, "picked"> & {
    picked?: string[];
}): GameState;
/** Find a card instance anywhere in either player's zones. */
export declare function findInstance(state: GameState, instanceId: string): CardInstance | null;
export type EffectStep = (state: GameState, player: Player, picked: CardInstance[], args?: (string | number)[]) => GameState;
export declare const effectSteps: Map<string, EffectStep[]>;
export declare function resumeEffect(state: GameState, effect: string, step: number, player: Player, pickedIds: string[], args?: (string | number)[]): GameState;
//# sourceMappingURL=choice.d.ts.map