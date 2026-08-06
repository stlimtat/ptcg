import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ScrapedDeck {
  archetype: string;
  player: string;
  cards: Array<{ name: string; count: number }>;
  placement: string;
}

async function scrapeLimitlessTCG() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log("Loading Limitless TCG...");
  await page.goto("https://www.limitless-tcg.com/decks/", {
    waitUntil: "networkidle",
  });

  // Load card registry
  const cardsPath = path.join(__dirname, "../../ui/public/cards.json");
  if (!fs.existsSync(cardsPath)) {
    console.error(`Cards file not found at ${cardsPath}`);
    await browser.close();
    return;
  }

  const cardsData = JSON.parse(fs.readFileSync(cardsPath, "utf-8"));
  const cardsByName: Record<string, string> = {};

  cardsData.forEach((card: any) => {
    cardsByName[card.name.toLowerCase()] = card.id;
  });

  console.log(`Loaded ${Object.keys(cardsByName).length} cards from pool`);

  // Wait for decks to load
  await page.waitForTimeout(3000);

  // Extract deck links - try multiple selectors
  let deckLinks = await page.locator('a[href*="/deck/"]').all();
  console.log(`Found ${deckLinks.length} deck links`);

  const decks: ScrapedDeck[] = [];
  const maxDecks = 5;

  for (let i = 0; i < Math.min(deckLinks.length, maxDecks); i++) {
    try {
      const link = deckLinks[i];
      const href = await link.getAttribute("href");
      if (!href) continue;

      console.log(`Processing deck ${i + 1}/${maxDecks}: ${href}`);
      await page.goto(`https://www.limitless-tcg.com${href}`, {
        waitUntil: "domcontentloaded",
      });

      // Extract deck metadata
      const archetype = await page
        .locator('text=/Archetype:|Deck Type:/')
        .first()
        .textContent()
        .then((t) => t?.replace(/Archetype:|Deck Type:/g, "").trim() || "Unknown");

      const player = await page
        .locator('[data-testid="deck-player-name"], .player-name')
        .first()
        .textContent()
        .then((t) => t?.trim() || "Unknown");

      const placement = await page
        .locator('[data-testid="deck-placement"], .placement')
        .first()
        .textContent()
        .then((t) => t?.trim() || "N/A");

      // Extract cards from deck list - multiple selector attempts
      let cardRows = await page.locator('[class*="card"], [class*="Card"]').all();

      const deckCards: Array<{ name: string; count: number }> = [];

      for (const row of cardRows) {
        const text = await row.textContent();
        if (!text) continue;

        // Try to parse "Card Name x2" format
        const match = text.match(/(.+?)\s+x(\d+)/);
        if (match) {
          const cardName = match[1].trim();
          const count = parseInt(match[2]);
          if (!isNaN(count) && cardName.length > 0) {
            deckCards.push({ name: cardName, count });
          }
        }
      }

      if (deckCards.length > 0) {
        decks.push({ archetype, player, cards: deckCards, placement });
        console.log(`  ✓ Found ${deckCards.length} cards`);
      }
    } catch (e) {
      console.log(`  ✗ Error processing deck: ${e}`);
    }
  }

  console.log(`\nProcessed ${decks.length} decks`);

  // Convert to our format
  const outDir = path.join(__dirname, "../../../ui/public/decks");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const deck of decks) {
    const convertedCards: string[] = [];
    let unmatchedCount = 0;

    for (const deckCard of deck.cards) {
      const cardId = cardsByName[deckCard.name.toLowerCase()];
      if (cardId) {
        for (let i = 0; i < deckCard.count; i++) {
          convertedCards.push(cardId);
        }
      } else {
        unmatchedCount++;
        console.log(`  Unmapped: ${deckCard.name}`);
      }
    }

    if (convertedCards.length >= 40) {
      const filename = deck.archetype
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const deckJson = {
        name: `${deck.archetype} (${deck.player}) - ${deck.placement}`,
        cards: convertedCards.slice(0, 60),
        source: `Limitless TCG`,
      };

      const outPath = path.join(outDir, `${filename}.json`);
      fs.writeFileSync(outPath, JSON.stringify(deckJson, null, 2));
      console.log(
        `✓ Saved: ${filename}.json (${convertedCards.length} cards, ${unmatchedCount} unmapped)`
      );
    }
  }

  await browser.close();
  console.log("Done!");
}

scrapeLimitlessTCG().catch(console.error);
