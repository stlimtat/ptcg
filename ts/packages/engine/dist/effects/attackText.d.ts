import { Attack, GameState, Player } from "../types.js";
/**
 * Damage the attack adds before Weakness and Resistance. Returns the bonus and
 * the state, because coin flips consume the seeded RNG.
 */
export declare function damageBonus(state: GameState, attacker: Player, attack: Attack): [number, GameState];
/** Effects that resolve after the damage lands. May ask the player to choose. */
export declare function afterAttack(state: GameState, attacker: Player, attack: Attack): GameState;
/** Every phrasing this module understands; the coverage test reads it too. */
export declare const HANDLED_PATTERNS: RegExp[];
/** True when any pattern in this module recognises the text. */
export declare function isAttackTextHandled(text: string): boolean;
//# sourceMappingURL=attackText.d.ts.map