import { Action, GameState, Player } from "../types.js";
/**
 * A flat, fixed action space with a legality mask.
 *
 * Actions are addressed by *position* — hand slot, bench slot, attack index —
 * rather than by instanceId, so the same index means a comparable thing across
 * states and a policy network can learn it. Anything the rules forbid right now
 * is masked out rather than removed, keeping the vector a constant size.
 */
export declare const HAND_SLOTS = 15;
/** Active plus five Bench slots. */
export declare const PLAY_SLOTS = 6;
export declare const ATTACK_SLOTS = 4;
export declare const ABILITY_SLOTS = 2;
export declare const CHOICE_SLOTS = 60;
export declare const ACTION_SPACE_SIZE: number;
/**
 * Index for an action, or -1 when it falls outside the space (a hand bigger
 * than HAND_SLOTS, a choice with more options than CHOICE_SLOTS).
 */
export declare function encodeAction(state: GameState, action: Action): number;
export interface ActionSpaceView {
    /** 1 where the action is legal right now. */
    mask: Uint8Array;
    /** index -> the concrete action it stands for */
    actions: (Action | undefined)[];
    /** Legal actions that did not fit the fixed space (never silently dropped). */
    overflow: Action[];
}
export declare function actionSpace(state: GameState, seat: Player): ActionSpaceView;
//# sourceMappingURL=actionSpace.d.ts.map