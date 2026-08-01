import { Card } from '@pokemon-tcg/engine';
import { CardRegistry } from '../types';
import cardsData from '../../public/cards.json';
import dragapultDeck from '../../public/decks/dragapult-ex.json';
import zoroarkDeck from '../../public/decks/zoroark-ex.json';

export function loadCardRegistry(): CardRegistry {
  const registry: CardRegistry = {};
  for (const card of cardsData.cards) {
    registry[card.id] = card as Card;
  }
  return registry;
}

export function loadDeck(deckName: 'dragapult-ex' | 'zoroark-ex'): string[] {
  if (deckName === 'dragapult-ex') {
    return dragapultDeck.cards;
  } else if (deckName === 'zoroark-ex') {
    return zoroarkDeck.cards;
  }
  return [];
}
