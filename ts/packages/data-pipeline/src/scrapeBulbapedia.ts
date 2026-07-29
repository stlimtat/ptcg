import { ScrapedCard } from "./types";

export function scrapeBulbapediaCard(html: string, cardId: string): ScrapedCard {
  const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const hpMatch = html.match(/HP:?\s*(\d+)/);
  const stageMatch = html.match(/Stage:?\s*(\d+)/);
  const evolvesMatch = html.match(/Evolves from:?\s*([^\n<]+)/);
  const retreatMatch = html.match(/Retreat Cost:?\s*(\d+)/);

  if (!nameMatch) throw new Error("Could not parse card name");

  return {
    name: nameMatch[1],
    hp: hpMatch ? parseInt(hpMatch[1]) : undefined,
    stage: stageMatch ? (parseInt(stageMatch[1]) as 0 | 1 | 2) : 0,
    evolvesFrom: evolvesMatch ? evolvesMatch[1].trim() : undefined,
    types: [],
    retreatCost: retreatMatch ? parseInt(retreatMatch[1]) : 0,
    attacksRaw: [],
  };
}
