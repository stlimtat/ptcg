import type { Card } from "../types.js";
export declare function loadCardRegistry(cardsJson: {
    cards: Card[];
}): {
    get(cardId: string): Card;
    has(cardId: string): boolean;
};
export type CardRegistry = ReturnType<typeof loadCardRegistry>;
//# sourceMappingURL=registry.d.ts.map