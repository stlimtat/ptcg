const GITHUB_RAW_URL = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en";
// Standard format sets (Scarlet & Violet era, 2023-2026)
const STANDARD_SETS = [
    "sv1", // Scarlet & Violet
    "sv1pt", // Scarlet & Violet Paldea Evolved
    "sv2", // Scarlet & Violet 3.5 Obsidian Flames
    "sv3", // Scarlet & Violet 4 Paradox Rift
    "sv4pt", // Scarlet & Violet Paldean Fates
    "sv45", // Crown Zenith
];
export async function scrapeStandardCards() {
    const allCards = [];
    for (const setCode of STANDARD_SETS) {
        console.log(`Fetching set ${setCode}...`);
        try {
            const url = `${GITHUB_RAW_URL}/${setCode}.json`;
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`Failed to fetch ${setCode}: HTTP ${response.status}`);
                continue;
            }
            const setCards = (await response.json());
            console.log(`  Got ${setCards.length} cards from ${setCode}`);
            // Convert to our Card type
            for (const ghCard of setCards) {
                const card = {
                    id: ghCard.id || ghCard.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
                    name: ghCard.name,
                    type: ghCard.types && ghCard.types.length > 0
                        ? "pokemon"
                        : ghCard.retreatCost !== undefined
                            ? "pokemon"
                            : "trainer",
                    hp: ghCard.hp,
                    stage: (ghCard.stage || 0),
                    evolvesFrom: ghCard.evolvesFrom,
                    types: (ghCard.types || []),
                    weakness: ghCard.weaknesses?.[0]
                        ? {
                            type: ghCard.weaknesses[0].type,
                            mult: 2,
                        }
                        : undefined,
                    resistance: ghCard.resistances?.[0]
                        ? {
                            type: ghCard.resistances[0].type,
                            reduce: 30,
                        }
                        : undefined,
                    retreatCost: ghCard.retreatCost || 0,
                    abilities: (ghCard.abilities || []).map((a) => ({
                        name: a.name,
                        effect: [{ op: "custom", fn: `${ghCard.id}__${a.name.replace(/\s+/g, "_")}` }],
                    })),
                    attacks: (ghCard.attacks || []).map((a) => ({
                        name: a.name,
                        cost: a.cost || [],
                        baseDamage: a.damage ? parseInt(a.damage) : 0,
                        effect: [{ op: "custom", fn: `${ghCard.id}__${a.name.replace(/\s+/g, "_")}` }],
                    })),
                };
                allCards.push(card);
            }
        }
        catch (error) {
            console.error(`Error fetching ${setCode}:`, error instanceof Error ? error.message : error);
        }
    }
    console.log(`\nTotal Standard format cards: ${allCards.length}`);
    return allCards;
}
//# sourceMappingURL=scrapeGitHub.js.map