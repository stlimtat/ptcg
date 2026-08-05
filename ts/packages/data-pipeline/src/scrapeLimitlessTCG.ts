import * as fs from "fs";

// Scrape competitive deck lists from limitless TCG
// Returns deck lists with proper Pokemon/Trainer/Energy mix

async function scrapeLimitlessTCG() {
  // Limitless TCG format lists URL
  const formatUrl =
    "https://www.limitless.xyz/decks/?f=standard&t=recent&p=all";

  console.log("Fetching Limitless TCG deck lists...");

  try {
    // Fetch the format page
    const response = await fetch(formatUrl);
    const html = await response.text();

    // Extract deck links from HTML
    // Pattern: /decks/show/[id]
    const deckLinkRegex = /\/decks\/show\/(\d+)/g;
    const deckIds = new Set<string>();
    let match;

    while ((match = deckLinkRegex.exec(html)) !== null) {
      deckIds.add(match[1]);
    }

    console.log(`Found ${deckIds.size} deck IDs`);

    // Fetch first few decks to build our deck files
    const decksToFetch = Array.from(deckIds).slice(0, 5);
    const decks: {
      name: string;
      cards: string[];
      source: string;
    }[] = [];

    for (const deckId of decksToFetch) {
      const deckUrl = `https://www.limitless.xyz/decks/show/${deckId}`;
      console.log(`Fetching deck ${deckId}...`);

      const deckRes = await fetch(deckUrl);
      const deckHtml = await deckRes.text();

      // Parse deck name (look for <h1> or title)
      const nameMatch = deckHtml.match(
        /<h1[^>]*>([^<]+)<\/h1>|<title>([^<]+)<\/title>/
      );
      const deckName = nameMatch
        ? (nameMatch[1] || nameMatch[2]).trim()
        : `Deck ${deckId}`;

      // Parse card list
      // Look for patterns like "4x sv1-1" or card list in data attributes
      const cardPattern =
        /(\d+)x\s+([a-zA-Z0-9\-]+)|data-card-id="([^"]+)"(?:[^>]*data-count="(\d+)")?/g;
      const cardCounts: Record<string, number> = {};

      let cardMatch;
      while ((cardMatch = cardPattern.exec(deckHtml)) !== null) {
        if (cardMatch[1] && cardMatch[2]) {
          // Format: "4x sv1-1"
          const count = parseInt(cardMatch[1]);
          const cardId = cardMatch[2];
          cardCounts[cardId] = (cardCounts[cardId] || 0) + count;
        } else if (cardMatch[3]) {
          // Format: data-card-id with data-count
          const cardId = cardMatch[3];
          const count = cardMatch[4] ? parseInt(cardMatch[4]) : 1;
          cardCounts[cardId] = (cardCounts[cardId] || 0) + count;
        }
      }

      // Build card array (repeat cardId based on count)
      const cards: string[] = [];
      for (const [cardId, count] of Object.entries(cardCounts)) {
        for (let i = 0; i < count; i++) {
          cards.push(cardId);
        }
      }

      if (cards.length > 0) {
        decks.push({
          name: deckName,
          cards: cards.slice(0, 60), // Limit to 60 cards
          source: deckUrl,
        });
      }

      // Avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`Successfully fetched ${decks.length} decks`);

    // Save decks
    for (const deck of decks) {
      const filename = deck.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const deckJson = {
        name: deck.name,
        cards: deck.cards,
        source: deck.source,
      };

      const outPath = `./out/decks/${filename}.json`;
      fs.writeFileSync(outPath, JSON.stringify(deckJson, null, 2));
      console.log(`Saved: ${outPath} (${deck.cards.length} cards)`);
    }
  } catch (e) {
    console.error("Error scraping Limitless TCG:", e);
  }
}

// Run scraper
scrapeLimitlessTCG();
