import { describe, it, expect } from "vitest";
import { scrapeBulbapediaCard } from "../src/scrapeBulbapedia";

describe("Bulbapedia scraper", () => {
  it("parses card data from HTML", () => {
    const html = `<h1>Dragapult ex</h1>
      HP: 250
      Stage: 2
      Evolves from: Drakloak
      Retreat Cost: 1`;

    const card = scrapeBulbapediaCard(html, "dragapult-ex");

    expect(card.name).toBe("Dragapult ex");
    expect(card.hp).toBe(250);
    expect(card.stage).toBe(2);
    expect(card.evolvesFrom).toBe("Drakloak");
    expect(card.retreatCost).toBe(1);
  });
});
