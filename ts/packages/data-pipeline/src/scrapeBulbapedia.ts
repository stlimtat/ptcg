import { ScrapedCard } from "./types";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const CACHE_DIR = join(process.cwd(), ".cache", "bulbapedia");
const POLITENESS_DELAY_MS = 30000; // 30 seconds between requests (manual rate limiting)
const RETRY_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 5000;

// Browser headers to avoid blocks
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
const HEADERS = {
  "User-Agent": USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://bulbapedia.bulbagarden.net/",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

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

function getJitterDelay(): number {
  return Math.random() * 1000; // 0-1 second random jitter
}

// Batch scraping with caching and retry logic
export async function scrapeBulbapediaCards(
  cardNames: string[]
): Promise<ScrapedCard[]> {
  const results: ScrapedCard[] = [];
  const failures: { cardName: string; error: string }[] = [];

  for (let i = 0; i < cardNames.length; i++) {
    const cardName = cardNames[i];
    const progressStr = `[${i + 1}/${cardNames.length}] Scraping ${cardName}...`;
    console.log(progressStr);

    let html: string | null = null;
    let lastError: string = "";

    // Check cache first
    html = getCachedHtml(cardName);

    // Retry loop if not cached
    if (!html) {
      const url = `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(cardName)}`;
      for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
          const response = await fetch(url, {
            headers: HEADERS,
            redirect: "follow",
          });

          if (!response.ok) {
            const retryable = response.status === 429 || response.status === 503;
            lastError = `HTTP ${response.status}`;
            if (retryable && attempt < RETRY_ATTEMPTS) {
              console.warn(
                `  Attempt ${attempt}/${RETRY_ATTEMPTS}: ${lastError}, retrying...`
              );
              await sleep(RETRY_BACKOFF_MS * attempt);
              continue;
            }
            throw new Error(lastError);
          }

          html = await response.text();
          setCachedHtml(cardName, html);
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          if (attempt < RETRY_ATTEMPTS) {
            console.warn(
              `  Attempt ${attempt}/${RETRY_ATTEMPTS}: ${lastError}, retrying...`
            );
            await sleep(RETRY_BACKOFF_MS * attempt);
          }
        }
      }
    }

    // Parse the HTML if we got it
    try {
      if (html) {
        const card = scrapeBulbapediaCard(html, cardName);
        results.push(card);
      } else {
        failures.push({ cardName, error: lastError || "Unknown error" });
        console.warn(`Failed to scrape ${cardName}: ${lastError}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      failures.push({ cardName, error: errorMsg });
      console.warn(`Failed to parse ${cardName}: ${errorMsg}`);
    }

    // Polite delay between requests (not after the last one)
    if (i < cardNames.length - 1) {
      const jitter = getJitterDelay();
      const totalDelay = POLITENESS_DELAY_MS + jitter;
      await sleep(totalDelay);
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
