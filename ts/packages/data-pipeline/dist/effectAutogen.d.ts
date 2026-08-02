import { EffectNode } from "@pokemon-tcg/engine";
/**
 * Result of auto-generating an EffectScript from card text.
 */
export interface AutogenResult {
    script: EffectNode[];
    confidence: "high" | "medium" | "low" | "none";
    reason: string;
}
/**
 * Auto-generate an EffectScript from card effect text.
 * Uses template matching to classify simple effects (high confidence)
 * and marks complex effects for manual authoring (none confidence).
 */
export declare function autogenEffect(effectText: string): AutogenResult;
export interface BatchCard {
    name: string;
    effectText: string;
}
export interface BatchResult {
    name: string;
    effect: EffectNode[];
    confidence: "high" | "medium" | "low" | "none";
    reason: string;
}
/**
 * Auto-generate EffectScripts for a batch of cards.
 */
export declare function autogenEffectBatch(cards: BatchCard[]): BatchResult[];
//# sourceMappingURL=effectAutogen.d.ts.map