import { Card } from '@pokemon-tcg/engine';
import { CardRegistry } from '../types';

let cardsCache: any = null;
let decksCache: Record<string, string[]> = {};

export function loadCardRegistry(): CardRegistry {
  const registry: CardRegistry = {};
  if (cardsCache) {
    const cards = Array.isArray(cardsCache) ? cardsCache : cardsCache.cards || [];
    for (const card of cards) {
      registry[card.id] = card as Card;
    }
  }
  return registry;
}

export async function initializeData() {
  // Fetch cards
  const cardsRes = await fetch('/cards.json');
  cardsCache = await cardsRes.json();

  // Fetch decks
  const dragapultRes = await fetch('/decks/dragapult-ex.json');
  const dragapultDeck = await dragapultRes.json();
  decksCache['dragapult-ex'] = dragapultDeck.cards || [];

  const zoroarkRes = await fetch('/decks/zoroark-ex.json');
  const zoroarkDeck = await zoroarkRes.json();
  decksCache['zoroark-ex'] = zoroarkDeck.cards || [];
}

export function loadDeck(deckName: 'dragapult-ex' | 'zoroark-ex'): string[] {
  return decksCache[deckName] || [];
}
