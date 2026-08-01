import { EffectNode } from "@pokemon-tcg/engine";

/**
 * DSL pattern templates for common Pokémon card effects.
 * Each template returns an EffectScript (EffectNode[]).
 */
export const effectTemplates = {
  /**
   * Simple damage effect: deal X damage to defender.
   * Example: simpleDamage(20)
   */
  simpleDamage(amount: number): EffectNode[] {
    return [{ op: "dealDamage", amount, target: "defender" }];
  },

  /**
   * Damage with healing: deal damage and heal self.
   * Example: damageWithHeal(30, 10)
   */
  damageWithHeal(damage: number, heal: number): EffectNode[] {
    return [
      { op: "dealDamage", amount: damage, target: "defender" },
      { op: "heal", amount: heal, target: "self" },
    ];
  },

  /**
   * Damage and discard energy from defender.
   * Example: damageAndDiscard(40, 1)
   */
  damageAndDiscard(damage: number, count: number): EffectNode[] {
    return [
      { op: "dealDamage", amount: damage, target: "defender" },
      { op: "discardEnergy", from: "defender", count },
    ];
  },

  /**
   * Draw cards.
   * Example: drawCards(3)
   */
  drawCards(count: number): EffectNode[] {
    return [{ op: "drawCards", count }];
  },

  /**
   * Heal active Pokémon.
   * Example: healActive(20)
   */
  healActive(amount: number): EffectNode[] {
    return [{ op: "heal", amount, target: "self" }];
  },

  /**
   * Apply status condition to defender.
   * Example: applyCondition("Paralyzed")
   */
  applyCondition(condition: "Confused" | "Asleep" | "Paralyzed" | "Poisoned" | "Burned"): EffectNode[] {
    return [{ op: "applyStatus", condition, target: "defender" }];
  },

  /**
   * Discard energy from defender.
   * Example: discardEnergy(2)
   */
  discardEnergy(count: number): EffectNode[] {
    return [{ op: "discardEnergy", from: "defender", count }];
  },

  /**
   * Coin flip with different effects for heads/tails.
   * Example: coinFlip([{op: "dealDamage", ...}], [{op: "dealDamage", amount: 0, ...}])
   */
  coinFlip(headsEffect: EffectNode[], tailsEffect: EffectNode[]): EffectNode[] {
    return [
      {
        op: "flipCoin",
        onHeads: headsEffect,
        onTails: tailsEffect,
      },
    ];
  },
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
export function matchTemplateFromText(text: string): EffectNode[] | null {
  if (!text || typeof text !== "string") return null;

  const normalized = text.toLowerCase();

  // Pattern 1: Damage detection
  // Matches: "does 30 damage", "deal 40 damage", "deals 50 damage to the defending Pokémon"
  const damageMatch = normalized.match(/(?:does|deal|deals?)\s+(\d+)\s+damage/i);
  if (damageMatch) {
    const amount = parseInt(damageMatch[1], 10);
    return effectTemplates.simpleDamage(amount);
  }

  // Pattern 2: Healing detection
  // Matches: "heal 20", "heals 30 hp", "heals 40 damage"
  const healMatch = normalized.match(/heal(?:s?)?\s+(\d+)\s*(?:hp|damage)?/i);
  if (healMatch) {
    const amount = parseInt(healMatch[1], 10);
    return effectTemplates.healActive(amount);
  }

  // Pattern 3: Draw cards detection
  // Matches: "draw 1 card", "draws 2 cards", "draw 3"
  const drawMatch = normalized.match(/draw(?:s?)?\s+(\d+)\s*card(?:s)?/i);
  if (drawMatch) {
    const count = parseInt(drawMatch[1], 10);
    return effectTemplates.drawCards(count);
  }

  // Pattern 4: Status conditions
  // Matches: "paralyze", "confuse", "sleep", "poison", "burn"
  const statusMatch = normalized.match(/(paralyze|confuse|sleep|poison|burn)/i);
  if (statusMatch) {
    const statusMap: Record<string, "Paralyzed" | "Confused" | "Asleep" | "Poisoned" | "Burned"> = {
      paralyze: "Paralyzed",
      confuse: "Confused",
      sleep: "Asleep",
      asleep: "Asleep",
      poison: "Poisoned",
      burn: "Burned",
    };
    const condition = statusMap[statusMatch[1].toLowerCase()];
    if (condition) {
      return effectTemplates.applyCondition(condition);
    }
  }

  // Pattern 5: Discard energy detection
  // Matches: "discard 1 energy", "discards 2 energy"
  const discardMatch = normalized.match(/discard(?:s?)?\s+(\d+)\s*energy/i);
  if (discardMatch) {
    const count = parseInt(discardMatch[1], 10);
    return effectTemplates.discardEnergy(count);
  }

  // Pattern 6: Coin flip detection
  // Matches: "flip a coin", "coin flip"
  // Note: Returns a generic coin flip structure; caller must fill in actual effects
  const coinMatch = normalized.match(/(?:flip\s+a\s+coin|coin\s+flip)/i);
  if (coinMatch) {
    // ponytail: coin flip stub—returns null for now, requires manual effect specification
    // Will upgrade to full parsing when text contains explicit heads/tails effects
    return null;
  }

  // No match
  return null;
}
