import { Card } from "@pokemon-tcg/engine";
import { ScrapedCard } from "./types";
import { writeFileSync } from "fs";
import { join } from "path";

export function buildCardJson(
  scrapedCards: ScrapedCard[],
  outputDir: string
): void {
  const cards: Card[] = scrapedCards.map((scraped) => ({
    type: "pokemon" as const,
    id: scraped.name.toLowerCase().replace(/\s+/g, "-"),
    name: scraped.name,
    hp: scraped.hp || 0,
    stage: scraped.stage || 0,
    evolvesFrom: scraped.evolvesFrom,
    types: scraped.types as any,
    retreatCost: scraped.retreatCost,
    abilities: scraped.abilities?.map(a => ({
      name: a.name,
      effect: [],
    })) || [],
    attacks: scraped.attacksRaw.map(a => ({
      name: a.name,
      cost: a.cost as any,
      baseDamage: a.damage,
    })),
  }));

  const output = { cards };
  writeFileSync(
    join(outputDir, "cards.json"),
    JSON.stringify(output, null, 2)
  );
}
