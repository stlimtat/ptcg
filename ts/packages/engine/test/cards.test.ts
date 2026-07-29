import { describe, it, expect } from "vitest";
import { loadCardRegistry } from "../src/cards/registry";

describe("Card registry", () => {
  it("loads cards from JSON", () => {
    const cardsJson = {
      cards: [
        {
          type: "pokemon",
          id: "dragapult-ex",
          name: "Dragapult ex",
          hp: 250,
          stage: 2,
          evolvesFrom: "Drakloak",
          types: ["Dragon"],
          attacks: [
            {
              name: "Phantom Line",
              cost: ["Colorless", "Colorless"],
              baseDamage: 100,
            },
          ],
          abilities: [],
          retreatCost: 1,
        },
      ],
    };

    const registry = loadCardRegistry(cardsJson as any);
    expect(registry.get("dragapult-ex")).toBeDefined();
    expect(registry.get("dragapult-ex")?.name).toBe("Dragapult ex");
  });

  it("throws on missing card", () => {
    const registry = loadCardRegistry({ cards: [] });
    expect(() => registry.get("missing")).toThrow();
  });
});
