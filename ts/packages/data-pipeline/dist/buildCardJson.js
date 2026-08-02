import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { scrapeStandardCards } from "./scrapeGitHub.js";
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
// Build complete cards.json from GitHub Pokemon TCG Data repo
export async function buildFullStandardCardJson(outputDir) {
    console.log("Building Standard format card database from GitHub...");
    // Ensure output directory exists
    mkdirSync(outputDir, { recursive: true });
    // Fetch all cards from GitHub Pokemon TCG Data
    const cards = await scrapeStandardCards();
    console.log(`Fetched ${cards.length} cards from GitHub`);
    // Write to file
    const outputPath = join(outputDir, "cards.json");
    writeFileSync(outputPath, JSON.stringify(cards, null, 2));
    console.log(`Successfully wrote ${cards.length} cards to ${outputPath}`);
}
//# sourceMappingURL=buildCardJson.js.map