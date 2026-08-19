import { CardInstance, GameState, Player } from "../types.js";
import { EffectStep } from "./choice.js";
/** Remove instances from every zone of a player, returning the trimmed state. */
declare function removeFromZones(state: GameState, player: Player, ids: Set<string>): GameState;
/** ex / V / Radiant / ACE SPEC cards all have a Rule Box. */
export declare function hasRuleBox(state: GameState, c: CardInstance): boolean;
export declare const trainerEffects: Record<string, EffectStep[]>;
/** Extra play restrictions beyond "it is a Trainer in your hand". */
export declare const trainerPlayable: Record<string, (state: GameState, player: Player) => boolean>;
export declare function applyTrainerEffect(state: GameState, trainerName: string, player: Player): GameState;
export declare const isTrainerImplemented: (name: string) => boolean;
export { removeFromZones };
//# sourceMappingURL=trainers.d.ts.map