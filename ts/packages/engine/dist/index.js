export * from "./types.js";
export * from "./state.js";
export * from "./reducer.js";
export * from "./legalActions.js";
export { loadCardRegistry } from "./cards/registry.js";
export { executeEffect } from "./effects/interpreter.js";
export { trainerEffects, isTrainerImplemented, hasRuleBox } from "./effects/trainers.js";
export { abilities, isAbilityImplemented, usableAbilities } from "./effects/abilities.js";
export { isAttackTextHandled, HANDLED_PATTERNS } from "./effects/attackText.js";
export { effectiveHp, effectiveRetreatCost, effectiveWeakness, attackDamageBonus, benchLimit, abilitiesLocked, toolsDisabled, CONTINUOUS_CARDS, } from "./effects/continuous.js";
export { setCardRegistry, getCard, canPayCost, flipCoin } from "./cardLookup.js";
export { resolveAttack, applyDamage, applyKnockout, damageFor, adjustedCost } from "./attackFlow.js";
export { GameLogger } from "./gameLogger.js";
// Reinforcement-learning surface: fixed observation/action encodings and a
// headless episode runner.
export { encodeObservation, OBSERVATION_SIZE } from "./rl/observation.js";
export { actionSpace, encodeAction, ACTION_SPACE_SIZE, HAND_SLOTS, PLAY_SLOTS, } from "./rl/actionSpace.js";
export { runEpisode, playFrom, seatToAct } from "./rl/episode.js";
export { snapshotBoard, replayRecord, formatRecord } from "./rl/record.js";
export { randomPolicy, heuristicPolicy, rolloutPolicy } from "./rl/policies.js";
//# sourceMappingURL=index.js.map