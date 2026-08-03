export function loadCardRegistry(cardsJson) {
    const registry = new Map();
    for (const card of cardsJson.cards) {
        registry.set(card.id, card);
    }
    return {
        get(cardId) {
            const card = registry.get(cardId);
            if (!card) {
                throw new Error(`Card not found: ${cardId}`);
            }
            return card;
        },
        has(cardId) {
            return registry.has(cardId);
        },
    };
}
//# sourceMappingURL=registry.js.map