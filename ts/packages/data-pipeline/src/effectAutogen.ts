import { EffectNode } from "@pokemon-tcg/engine";
import { matchTemplateFromText } from "./effectTemplates";

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
export function autogenEffect(effectText: string): AutogenResult {
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
export function autogenEffectBatch(cards: BatchCard[]): BatchResult[] {
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
