import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scrapeBulbapediaCards } from "./scrapeBulbapedia.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export function buildCardJson(scrapedCards, outputDir) {
    const cards = scrapedCards.map((scraped) => ({
        type: "pokemon",
        id: scraped.name.toLowerCase().replace(/\s+/g, "-"),
        name: scraped.name,
        hp: scraped.hp || 0,
        stage: scraped.stage || 0,
        evolvesFrom: scraped.evolvesFrom,
        types: scraped.types,
        retreatCost: scraped.retreatCost,
        abilities: scraped.abilities?.map(a => ({
            name: a.name,
            effect: [],
        })) || [],
        attacks: scraped.attacksRaw.map(a => ({
            name: a.name,
            cost: a.cost,
            baseDamage: a.damage,
        })),
    }));
    const output = { cards };
    writeFileSync(join(outputDir, "cards.json"), JSON.stringify(output, null, 2));
}
// Read standard card list from JSON
function readStandardCardList() {
    // Look for the file in src directory (one level up from compiled dist)
    const srcPath = join(__dirname, "..", "src", "standardCardList.json");
    const content = readFileSync(srcPath, "utf-8");
    const data = JSON.parse(content);
    return data.allCards || [];
}
// Build complete cards.json from standard format card list
export async function buildFullStandardCardJson(outputDir) {
    console.log("Starting full Standard format card build...");
    // Ensure output directory exists
    mkdirSync(outputDir, { recursive: true });
    // Read all card names
    const allCardNames = readStandardCardList();
    console.log(`Found ${allCardNames.length} cards in Standard format list`);
    // Scrape all cards from Bulbapedia
    const scrapedCards = await scrapeBulbapediaCards(allCardNames);
    console.log(`Successfully scraped ${scrapedCards.length} cards`);
    // Build Card array and write to file
    // ponytail: effect generation stubbed as empty arrays; upgrading to full DSL matching when needed
    const cards = scrapedCards.map((scraped) => ({
        type: "pokemon",
        id: scraped.name.toLowerCase().replace(/\s+/g, "-"),
        name: scraped.name,
        hp: scraped.hp || 0,
        stage: scraped.stage || 0,
        evolvesFrom: scraped.evolvesFrom,
        types: scraped.types,
        retreatCost: scraped.retreatCost,
        abilities: scraped.abilities?.map(a => ({
            name: a.name,
            effect: [],
        })) || [],
        attacks: scraped.attacksRaw.map(a => ({
            name: a.name,
            cost: a.cost,
            baseDamage: a.damage,
            effect: a.text ? [] : undefined,
        })),
    }));
    const output = { cards };
    const outputPath = join(outputDir, "cards.json");
    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Successfully wrote ${cards.length} cards to ${outputPath}`);
}
//# sourceMappingURL=buildCardJson.js.map