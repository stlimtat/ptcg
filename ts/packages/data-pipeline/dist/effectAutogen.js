import { matchTemplateFromText } from "./effectTemplates";
/**
 * Auto-generate an EffectScript from card effect text.
 * Uses template matching to classify simple effects (high confidence)
 * and marks complex effects for manual authoring (none confidence).
 */
export function autogenEffect(effectText) {
    const script = matchTemplateFromText(effectText);
    if (script) {
        return {
            script,
            confidence: "high",
            reason: "Matched template pattern",
        };
    }
    return {
        script: [],
        confidence: "none",
        reason: "Complex effect",
    };
}
/**
 * Auto-generate EffectScripts for a batch of cards.
 */
export function autogenEffectBatch(cards) {
    return cards.map((card) => {
        const result = autogenEffect(card.effectText);
        return {
            name: card.name,
            effect: result.script,
            confidence: result.confidence,
            reason: result.reason,
        };
    });
}
//# sourceMappingURL=effectAutogen.js.map