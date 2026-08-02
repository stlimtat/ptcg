import { EffectNode } from "@pokemon-tcg/engine";
/**
 * DSL pattern templates for common Pokémon card effects.
 * Each template returns an EffectScript (EffectNode[]).
 */
export declare const effectTemplates: {
    /**
     * Simple damage effect: deal X damage to defender.
     * Example: simpleDamage(20)
     */
    simpleDamage(amount: number): EffectNode[];
    /**
     * Damage with healing: deal damage and heal self.
     * Example: damageWithHeal(30, 10)
     */
    damageWithHeal(damage: number, heal: number): EffectNode[];
    /**
     * Damage and discard energy from defender.
     * Example: damageAndDiscard(40, 1)
     */
    damageAndDiscard(damage: number, count: number): EffectNode[];
    /**
     * Draw cards.
     * Example: drawCards(3)
     */
    drawCards(count: number): EffectNode[];
    /**
     * Heal active Pokémon.
     * Example: healActive(20)
     */
    healActive(amount: number): EffectNode[];
    /**
     * Apply status condition to defender.
     * Example: applyCondition("Paralyzed")
     */
    applyCondition(condition: "Confused" | "Asleep" | "Paralyzed" | "Poisoned" | "Burned"): EffectNode[];
    /**
     * Discard energy from defender.
     * Example: discardEnergy(2)
     */
    discardEnergy(count: number): EffectNode[];
    /**
     * Coin flip with different effects for heads/tails.
     * Example: coinFlip([{op: "dealDamage", ...}], [{op: "dealDamage", amount: 0, ...}])
     */
    coinFlip(headsEffect: EffectNode[], tailsEffect: EffectNode[]): EffectNode[];
};
/**
 * Heuristically detect and match effect patterns from card text.
 * Returns the detected effect template or null if no match found.
 *
 * Patterns detected:
 * - "Do X damage" or "Deals X damage" → simpleDamage(X)
 * - "Heal X" or "Heals X HP" → healActive(X)
 * - "Draw X cards" or "Draws X cards" → drawCards(X)
 * - "Paralyze", "Confuse", "Asleep", "Poison", "Burn" → applyCondition(...)
 * - "Discard X energy" → discardEnergy(X)
 * - "Flip a coin" → coinFlip (stub, requires manual effect specification)
 */
export declare function matchTemplateFromText(text: string): EffectNode[] | null;
//# sourceMappingURL=effectTemplates.d.ts.map