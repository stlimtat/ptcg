import { describe, it, expect } from "vitest";
import { effectTemplates, matchTemplateFromText } from "../src/effectTemplates";

describe("effectTemplates", () => {
  describe("template functions", () => {
    it("simpleDamage creates correct effect", () => {
      const effect = effectTemplates.simpleDamage(30);
      expect(effect).toEqual([{ op: "dealDamage", amount: 30, target: "defender" }]);
    });

    it("damageWithHeal creates chained effects", () => {
      const effect = effectTemplates.damageWithHeal(40, 20);
      expect(effect).toHaveLength(2);
      expect(effect[0]).toEqual({ op: "dealDamage", amount: 40, target: "defender" });
      expect(effect[1]).toEqual({ op: "heal", amount: 20, target: "self" });
    });

    it("damageAndDiscard creates chained effects", () => {
      const effect = effectTemplates.damageAndDiscard(50, 2);
      expect(effect).toHaveLength(2);
      expect(effect[0]).toEqual({ op: "dealDamage", amount: 50, target: "defender" });
      expect(effect[1]).toEqual({ op: "discardEnergy", from: "defender", count: 2 });
    });

    it("drawCards creates correct effect", () => {
      const effect = effectTemplates.drawCards(3);
      expect(effect).toEqual([{ op: "drawCards", count: 3 }]);
    });

    it("healActive creates correct effect", () => {
      const effect = effectTemplates.healActive(25);
      expect(effect).toEqual([{ op: "heal", amount: 25, target: "self" }]);
    });

    it("applyCondition creates status effect", () => {
      const effect = effectTemplates.applyCondition("Paralyzed");
      expect(effect).toEqual([{ op: "applyStatus", condition: "Paralyzed", target: "defender" }]);
    });

    it("discardEnergy creates correct effect", () => {
      const effect = effectTemplates.discardEnergy(1);
      expect(effect).toEqual([{ op: "discardEnergy", from: "defender", count: 1 }]);
    });

    it("coinFlip creates correct effect with heads/tails branches", () => {
      const headsEffect = [{ op: "dealDamage", amount: 60, target: "defender" }];
      const tailsEffect = [{ op: "dealDamage", amount: 0, target: "defender" }];
      const effect = effectTemplates.coinFlip(headsEffect, tailsEffect);
      expect(effect).toHaveLength(1);
      expect(effect[0].op).toBe("flipCoin");
      expect((effect[0] as any).onHeads).toEqual(headsEffect);
      expect((effect[0] as any).onTails).toEqual(tailsEffect);
    });
  });

  describe("matchTemplateFromText", () => {
    it("detects simple damage pattern", () => {
      const result = matchTemplateFromText("Does 30 damage");
      expect(result).toEqual([{ op: "dealDamage", amount: 30, target: "defender" }]);
    });

    it("detects 'deal X damage' variant", () => {
      const result = matchTemplateFromText("Deal 40 damage to the defending Pokémon");
      expect(result).toEqual([{ op: "dealDamage", amount: 40, target: "defender" }]);
    });

    it("detects heal pattern", () => {
      const result = matchTemplateFromText("Heal 20");
      expect(result).toEqual([{ op: "heal", amount: 20, target: "self" }]);
    });

    it("detects 'heals X hp' variant", () => {
      const result = matchTemplateFromText("Heals 30 HP from this Pokémon");
      expect(result).toEqual([{ op: "heal", amount: 30, target: "self" }]);
    });

    it("detects draw cards pattern", () => {
      const result = matchTemplateFromText("Draw 3 cards");
      expect(result).toEqual([{ op: "drawCards", count: 3 }]);
    });

    it("detects 'draws X cards' variant", () => {
      const result = matchTemplateFromText("Draws 2 cards from your deck");
      expect(result).toEqual([{ op: "drawCards", count: 2 }]);
    });

    it("detects paralyze condition", () => {
      const result = matchTemplateFromText("Paralyze the defending Pokémon");
      expect(result).toEqual([{ op: "applyStatus", condition: "Paralyzed", target: "defender" }]);
    });

    it("detects confuse condition", () => {
      const result = matchTemplateFromText("Confuse the defending Pokémon");
      expect(result).toEqual([{ op: "applyStatus", condition: "Confused", target: "defender" }]);
    });

    it("detects asleep condition", () => {
      const result = matchTemplateFromText("Put the defending Pokémon to sleep");
      expect(result).toEqual([{ op: "applyStatus", condition: "Asleep", target: "defender" }]);
    });

    it("detects poison condition", () => {
      const result = matchTemplateFromText("Poison the defending Pokémon");
      expect(result).toEqual([{ op: "applyStatus", condition: "Poisoned", target: "defender" }]);
    });

    it("detects burn condition", () => {
      const result = matchTemplateFromText("Burn the defending Pokémon");
      expect(result).toEqual([{ op: "applyStatus", condition: "Burned", target: "defender" }]);
    });

    it("detects discard energy pattern", () => {
      const result = matchTemplateFromText("Discard 1 energy from the defending Pokémon");
      expect(result).toEqual([{ op: "discardEnergy", from: "defender", count: 1 }]);
    });

    it("detects 'discards X energy' variant", () => {
      const result = matchTemplateFromText("Discards 2 energy");
      expect(result).toEqual([{ op: "discardEnergy", from: "defender", count: 2 }]);
    });

    it("returns null for unmatched text", () => {
      const result = matchTemplateFromText("This is some random card text");
      expect(result).toBeNull();
    });

    it("returns null for empty string", () => {
      const result = matchTemplateFromText("");
      expect(result).toBeNull();
    });

    it("returns null for null input", () => {
      const result = matchTemplateFromText(null as any);
      expect(result).toBeNull();
    });

    it("returns null for coin flip (requires manual specification)", () => {
      const result = matchTemplateFromText("Flip a coin");
      expect(result).toBeNull();
    });
  });
});
