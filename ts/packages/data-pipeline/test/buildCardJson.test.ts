import { describe, it, expect, afterEach } from "vitest";
import { buildCardJson } from "../src/buildCardJson";
import { ScrapedCard } from "../src/types";
import { readFileSync, rmSync } from "fs";
import { join } from "path";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";

describe("Card JSON builder", () => {
  let testDir: string;

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("buildsValidCardJSON", () => {
    testDir = mkdtempSync(join(tmpdir(), "card-json-"));

    const scrapedCards: ScrapedCard[] = [
      {
        name: "Dragapult ex",
        hp: 250,
        stage: 2,
        evolvesFrom: "Drakloak",
        types: ["Dragon"],
        retreatCost: 1,
        attacksRaw: [
          {
            name: "Phantom Force",
            cost: ["Dragon", "Colorless"],
            damage: 180,
          },
        ],
        abilities: [
          {
            name: "Infiltrator",
            text: "Your opponent cannot play Items from their hand.",
          },
        ],
      },
    ];

    buildCardJson(scrapedCards, testDir);

    const output = JSON.parse(readFileSync(join(testDir, "cards.json"), "utf-8"));
    expect(output.cards).toHaveLength(1);
    expect(output.cards[0].name).toBe("Dragapult ex");
    expect(output.cards[0].hp).toBe(250);
  });

  it("outputsCorrectSchema", () => {
    testDir = mkdtempSync(join(tmpdir(), "card-json-"));

    const scrapedCards: ScrapedCard[] = [
      {
        name: "Poké Ball",
        types: ["Colorless"],
        retreatCost: 0,
        attacksRaw: [],
      },
    ];

    buildCardJson(scrapedCards, testDir);

    const output = JSON.parse(readFileSync(join(testDir, "cards.json"), "utf-8"));
    const card = output.cards[0];

    expect(card).toHaveProperty("type", "pokemon");
    expect(card).toHaveProperty("id");
    expect(card).toHaveProperty("name");
    expect(card).toHaveProperty("hp");
    expect(card).toHaveProperty("stage");
    expect(card).toHaveProperty("types");
    expect(card).toHaveProperty("retreatCost");
    expect(card).toHaveProperty("abilities");
    expect(card).toHaveProperty("attacks");
  });
});
