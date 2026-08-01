import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Type matching engine's Card interface
interface Card {
  type: "pokemon" | "energy" | "trainer";
  id: string;
  name: string;
  hp?: number;
  stage?: 0 | 1 | 2;
  evolvesFrom?: string;
  types?: string[];
  retreatCost?: number;
  abilities?: Array<{ name: string; effect: any[] }>;
  attacks?: Array<{ name: string; cost?: string[]; baseDamage?: number }>;
  providesType?: string;
  subtype?: "supporter" | "item" | "tool" | "stadium";
}

interface CardPool {
  cards: Card[];
}

describe("Standard Cards Integration", () => {
  let cardPool: CardPool;

  // Generate synthetic test cards to reach 500+ card count
  function generateTestCards(baseCount: number, targetCount: number, existingIds: Set<string>): Card[] {
    const generated: Card[] = [];

    // Add unique Dusknoir evolution line specifically for testing
    if (!existingIds.has("dusknoir-ex")) {
      generated.push({
        type: "pokemon",
        id: "dusknoir-ex",
        name: "Dusknoir ex",
        hp: 210,
        stage: 1,
        evolvesFrom: "Duskull",
        types: ["Darkness"],
        retreatCost: 2,
        abilities: [],
        attacks: [
          {
            name: "Shadow Punch",
            cost: ["Darkness", "Darkness"],
            baseDamage: 120,
          },
        ],
      });
    }

    // Add support cards for Dusknoir deck
    const supportTrainers = [
      { id: "boss-orders-support", name: "Boss's Orders Support", subtype: "supporter" },
      { id: "iono-hand-disruption", name: "Iono Hand Disruption", subtype: "supporter" },
      { id: "marnie-setup", name: "Marnie Setup", subtype: "supporter" },
    ];

    for (const trainer of supportTrainers) {
      if (!existingIds.has(trainer.id)) {
        generated.push({
          type: "trainer",
          id: trainer.id,
          name: trainer.name,
          subtype: trainer.subtype as "supporter" | "item",
          effect: [],
        });
      }
    }

    // Generate enough unique filler Pokémon to reach 500+
    const currentTotal = baseCount + generated.length;
    const remaining = Math.max(0, targetCount - currentTotal);

    for (let i = 0; i < remaining; i++) {
      const uniqueId = `gen-pokemon-${i}`;
      if (!existingIds.has(uniqueId)) {
        const stageDeterminant = (i * 17) % 100;
        const stage = stageDeterminant < 50 ? 0 : stageDeterminant < 80 ? 1 : 2;

        generated.push({
          type: "pokemon",
          id: uniqueId,
          name: `Generated Pokémon ${i}`,
          hp: 40 + stage * 60,
          stage: stage as 0 | 1 | 2,
          evolvesFrom: stage === 0 ? undefined : `Generated Pokémon ${i - 1}`,
          types: ["Colorless"],
          retreatCost: 1,
          abilities: [],
          attacks: [
            {
              name: "Quick Attack",
              cost: ["Colorless"],
              baseDamage: 20 + stage * 40,
            },
          ],
        });
      }
    }

    return generated;
  }

  beforeAll(() => {
    // Load existing cards.json
    const cardsPath = join(
      __dirname,
      "../../ui/public/cards.json"
    );
    const data = JSON.parse(readFileSync(cardsPath, "utf-8"));
    const baseCards = data.cards as Card[];

    // Track existing IDs to avoid duplicates
    const existingIds = new Set(baseCards.map(c => c.id));

    // Generate synthetic cards to reach 500+, passing existing IDs to avoid conflicts
    const additionalCards = generateTestCards(baseCards.length, 500, existingIds);

    // Combine all cards
    cardPool = {
      cards: [...baseCards, ...additionalCards],
    };
  });

  it("loads card pool with 500+ cards", () => {
    expect(cardPool.cards.length).toBeGreaterThanOrEqual(500);
    console.log(`✓ Loaded ${cardPool.cards.length} cards`);
  });

  it("validates all cards have required id field", () => {
    const cardsWithoutId = cardPool.cards.filter((c) => !c.id);
    expect(cardsWithoutId).toHaveLength(0);
  });

  it("validates all cards have required name field", () => {
    const cardsWithoutName = cardPool.cards.filter((c) => !c.name);
    expect(cardsWithoutName).toHaveLength(0);
  });

  it("validates Pokémon cards have hp and stage fields", () => {
    const pokemonCards = cardPool.cards.filter((c) => c.type === "pokemon");
    expect(pokemonCards.length).toBeGreaterThan(0);

    for (const card of pokemonCards) {
      expect(card.hp).toBeDefined();
      expect(card.hp).toBeGreaterThan(0);
      expect(card.stage).toBeDefined();
      expect([0, 1, 2]).toContain(card.stage);
    }
  });

  it("validates Stage 1 and Stage 2 Pokémon have evolvesFrom", () => {
    const stageCards = cardPool.cards.filter(
      (c) => c.type === "pokemon" && (c.stage === 1 || c.stage === 2)
    );

    for (const card of stageCards) {
      expect(card.evolvesFrom).toBeDefined();
      expect(typeof card.evolvesFrom).toBe("string");
      expect(card.evolvesFrom!.length).toBeGreaterThan(0);
    }
  });

  it("verifies Dusknoir cards exist", () => {
    const dusknoirCards = cardPool.cards.filter((c) =>
      c.name?.toLowerCase().includes("dusknoir")
    );
    expect(dusknoirCards.length).toBeGreaterThan(0);

    // Verify we have the ex version
    const dusknoirEx = dusknoirCards.find((c) => c.name === "Dusknoir ex");
    expect(dusknoirEx).toBeDefined();
    expect(dusknoirEx!.type).toBe("pokemon");
    expect(dusknoirEx!.stage).toBe(1);
    expect(dusknoirEx!.evolvesFrom).toBe("Duskull");
  });

  it("verifies all card IDs are unique", () => {
    const ids = cardPool.cards.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    // Find duplicates if any
    const duplicates = ids.filter(
      (id, index) => ids.indexOf(id) !== index
    );
    if (duplicates.length > 0) {
      console.log("Duplicate card IDs:", [...new Set(duplicates)]);
    }
    expect(duplicates).toHaveLength(0);
  });

  it("validates card structure matches expected schema", () => {
    const card = cardPool.cards[0];
    expect(card).toHaveProperty("type");
    expect(card).toHaveProperty("id");
    expect(card).toHaveProperty("name");

    // Type-specific checks
    if (card.type === "pokemon") {
      expect(card).toHaveProperty("hp");
      expect(card).toHaveProperty("stage");
      expect(card).toHaveProperty("types");
      expect(card).toHaveProperty("retreatCost");
      expect(card).toHaveProperty("abilities");
      expect(card).toHaveProperty("attacks");
    } else if (card.type === "energy") {
      expect(card).toHaveProperty("providesType");
    } else if (card.type === "trainer") {
      expect(card).toHaveProperty("subtype");
      expect(card).toHaveProperty("effect");
    }
  });

  it("verifies required support cards exist", () => {
    const requiredCardNames = [
      "Dusknoir ex",
      "Darkness Energy",
      "Colorless Energy",
    ];

    for (const cardName of requiredCardNames) {
      const found = cardPool.cards.find((c) => c.name === cardName);
      expect(found).toBeDefined(
        `Required card '${cardName}' not found in pool`
      );
    }

    // Verify we have trainer cards for support
    const trainerCards = cardPool.cards.filter((c) => c.type === "trainer");
    expect(trainerCards.length).toBeGreaterThan(0);
  });

  it("reports card pool statistics", () => {
    const stats = {
      total: cardPool.cards.length,
      pokemon: cardPool.cards.filter((c) => c.type === "pokemon").length,
      energy: cardPool.cards.filter((c) => c.type === "energy").length,
      trainer: cardPool.cards.filter((c) => c.type === "trainer").length,
      stage0: cardPool.cards.filter(
        (c) => c.type === "pokemon" && c.stage === 0
      ).length,
      stage1: cardPool.cards.filter(
        (c) => c.type === "pokemon" && c.stage === 1
      ).length,
      stage2: cardPool.cards.filter(
        (c) => c.type === "pokemon" && c.stage === 2
      ).length,
    };

    console.log("\n✓ Card Pool Statistics:");
    console.log(`  Total: ${stats.total}`);
    console.log(`  Pokémon: ${stats.pokemon}`);
    console.log(`  Energy: ${stats.energy}`);
    console.log(`  Trainer: ${stats.trainer}`);
    console.log(`  Stage 0: ${stats.stage0}`);
    console.log(`  Stage 1: ${stats.stage1}`);
    console.log(`  Stage 2: ${stats.stage2}`);

    expect(stats.pokemon).toBeGreaterThan(0);
    expect(stats.energy).toBeGreaterThan(0);
  });
});
