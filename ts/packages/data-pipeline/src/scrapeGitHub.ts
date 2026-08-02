import { Card } from "@pokemon-tcg/engine";

const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en";

// Standard format sets (Scarlet & Violet era, 2023-2026)
const STANDARD_SETS = [
  "sv1",   // Scarlet & Violet
  "sv1pt", // Scarlet & Violet Paldea Evolved
  "sv2",   // Scarlet & Violet 3.5 Obsidian Flames
  "sv3",   // Scarlet & Violet 4 Paradox Rift
  "sv4pt", // Scarlet & Violet Paldean Fates
  "sv45",  // Crown Zenith
];

interface GitHubCard {
  id: string;
  name: string;
  hp?: number;
  stage: number;
  evolvesFrom?: string;
  types: string[];
  weaknesses?: Array<{ type: string; value: string }>;
  resistances?: Array<{ type: string; value: string }>;
  retreatCost: number;
  attacks?: Array<{ name: string; cost: string[]; damage?: string; text?: string }>;
  abilities?: Array<{ name: string; text: string }>;
}

export async function scrapeStandardCards(): Promise<Card[]> {
  const allCards: Card[] = [];

  for (const setCode of STANDARD_SETS) {
    console.log(`Fetching set ${setCode}...`);
    try {
      const url = `${GITHUB_RAW_URL}/${setCode}.json`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch ${setCode}: HTTP ${response.status}`);
        continue;
      }

      const setCards = (await response.json()) as GitHubCard[];
      console.log(`  Got ${setCards.length} cards from ${setCode}`);

      // Convert to our Card type
      for (const ghCard of setCards) {
        const card = {
          id: ghCard.id || ghCard.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
          name: ghCard.name,
          type:
            ghCard.types && ghCard.types.length > 0
              ? "pokemon"
              : ghCard.retreatCost !== undefined
                ? "pokemon"
                : "trainer",
          hp: ghCard.hp,
          stage: (ghCard.stage || 0) as 0 | 1 | 2,
          evolvesFrom: ghCard.evolvesFrom,
          types: (ghCard.types || []) as any,
          weakness: ghCard.weaknesses?.[0]
            ? ({
                type: ghCard.weaknesses[0].type,
                mult: 2,
              } as any)
            : undefined,
          resistance: ghCard.resistances?.[0]
            ? ({
                type: ghCard.resistances[0].type,
                reduce: 30,
              } as any)
            : undefined,
          retreatCost: ghCard.retreatCost || 0,
          abilities: (ghCard.abilities || []).map((a) => ({
            name: a.name,
            effect: [{ op: "custom", fn: `${ghCard.id}__${a.name.replace(/\s+/g, "_")}` }] as any,
          })),
          attacks: (ghCard.attacks || []).map((a) => ({
            name: a.name,
            cost: a.cost || [],
            baseDamage: a.damage ? parseInt(a.damage) : 0,
            effect: [{ op: "custom", fn: `${ghCard.id}__${a.name.replace(/\s+/g, "_")}` }] as any,
          })),
        } as Card;

        allCards.push(card);
      }
    } catch (error) {
      console.error(
        `Error fetching ${setCode}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log(`\nTotal Standard format cards: ${allCards.length}`);
  return allCards;
}
