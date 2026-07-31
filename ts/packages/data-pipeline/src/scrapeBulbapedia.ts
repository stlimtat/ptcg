import { ScrapedCard } from "./types";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const CACHE_DIR = join(process.cwd(), ".cache", "bulbapedia");
const POLITENESS_DELAY_MS = 500;

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

// Cache utility functions
function getCacheKey(cardName: string): string {
  return createHash("md5").update(cardName).digest("hex") + ".html";
}

function getCachedHtml(cardName: string): string | null {
  try {
    const cacheFile = join(CACHE_DIR, getCacheKey(cardName));
    if (existsSync(cacheFile)) {
      return readFileSync(cacheFile, "utf-8");
    }
  } catch (error) {
    // Silently ignore cache read errors
  }
  return null;
}

function setCachedHtml(cardName: string, html: string): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    const cacheFile = join(CACHE_DIR, getCacheKey(cardName));
    writeFileSync(cacheFile, html, "utf-8");
  } catch (error) {
    // Silently ignore cache write errors
    console.warn(`Failed to cache HTML for ${cardName}:`, error);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Batch scraping with caching
export async function scrapeBulbapediaCards(
  cardNames: string[]
): Promise<ScrapedCard[]> {
  const results: ScrapedCard[] = [];
  const failures: { cardName: string; error: string }[] = [];

  for (let i = 0; i < cardNames.length; i++) {
    const cardName = cardNames[i];
    const progressStr = `[${i + 1}/${cardNames.length}] Scraping ${cardName}...`;
    console.log(progressStr);

    try {
      // Check cache first
      let html = getCachedHtml(cardName);

      if (!html) {
        // Fetch from Bulbapedia if not cached
        const url = `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(cardName)}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        html = await response.text();
        setCachedHtml(cardName, html);
      }

      // Parse the HTML
      const card = scrapeBulbapediaCard(html, cardName);
      results.push(card);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      failures.push({ cardName, error: errorMsg });
      console.warn(`Failed to scrape ${cardName}: ${errorMsg}`);
    }

    // Polite delay between requests (not after the last one)
    if (i < cardNames.length - 1) {
      await sleep(POLITENESS_DELAY_MS);
    }
  }

  // Report failures
  if (failures.length > 0) {
    console.log("\n=== Scraping Failures ===");
    failures.forEach(({ cardName, error }) => {
      console.log(`- ${cardName}: ${error}`);
    });
  }

  console.log(
    `\n=== Summary ===\nSuccessfully scraped: ${results.length}/${cardNames.length}`
  );

  return results;
}
