import type { Card } from "../types.js";

export function loadCardRegistry(cardsJson: { cards: Card[] }) {
  const registry = new Map<string, Card>();

  for (const card of cardsJson.cards) {
    registry.set(card.id, card);
  }

  return {
    get(cardId: string): Card {
      const card = registry.get(cardId);
      if (!card) {
        throw new Error(`Card not found: ${cardId}`);
      }
      return card;
    },
    has(cardId: string): boolean {
      return registry.has(cardId);
    },
  };
}

export type CardRegistry = ReturnType<typeof loadCardRegistry>;
