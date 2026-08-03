import { EffectScript } from "../types";
export interface EffectContext {
    currentDamage: number;
    player: "p1" | "p2";
    defender: "p1" | "p2";
    rng?: () => number;
}
export declare function executeEffect(script: EffectScript, context: EffectContext): EffectContext;
//# sourceMappingURL=interpreter.d.ts.map