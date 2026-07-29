import { DeckList } from "./types";

export function scrapeLimitlessDeckList(html: string): DeckList {
  const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (!nameMatch) throw new Error("Could not parse deck name");

  const cards: Array<{ cardName: string; count: number }> = [];
  const cardMatches = html.matchAll(/([^\n<]+?)\s+x(\d+)/g);

  for (const match of cardMatches) {
    cards.push({
      cardName: match[1].trim(),
      count: parseInt(match[2]),
    });
  }

  return {
    name: nameMatch[1],
    cards,
  };
}
