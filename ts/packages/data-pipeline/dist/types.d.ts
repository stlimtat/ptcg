export interface ScrapedCard {
    name: string;
    hp?: number;
    stage?: 0 | 1 | 2;
    evolvesFrom?: string;
    types: string[];
    weakness?: {
        type: string;
        mult: number;
    };
    resistance?: {
        type: string;
        reduce: number;
    };
    retreatCost: number;
    attacksRaw: Array<{
        name: string;
        cost: string[];
        damage: number;
        text?: string;
    }>;
    abilities?: Array<{
        name: string;
        text: string;
    }>;
}
export interface DeckList {
    name: string;
    cards: Array<{
        cardName: string;
        count: number;
    }>;
}
//# sourceMappingURL=types.d.ts.map