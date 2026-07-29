import { describe, it, expect } from "vitest";
import { scrapeLimitlessDeckList } from "../src/scrapeLimitless";

describe("Limitless scraper", () => {
  it("parsesDeckListFromHTML", () => {
    const html = `<h1>Dragapult ex Deck</h1>
      <ul>
        <li>Dragapult ex x2</li>
        <li>Drakloak x4</li>
        <li>Poké Ball x3</li>
      </ul>`;

    const result = scrapeLimitlessDeckList(html);

    expect(result.name).toBe("Dragapult ex Deck");
    expect(result.cards).toHaveLength(3);
  });

  it("extractsCardNamesAndCounts", () => {
    const html = `<h1>Test Deck</h1>
      Dragapult ex x2
      Poké Ball x4
      Professor's Research x1`;

    const result = scrapeLimitlessDeckList(html);

    expect(result.cards[0]).toEqual({
      cardName: "Dragapult ex",
      count: 2,
    });
    expect(result.cards[1]).toEqual({
      cardName: "Poké Ball",
      count: 4,
    });
    expect(result.cards[2]).toEqual({
      cardName: "Professor's Research",
      count: 1,
    });
  });
});
