import { getPokemon, canPayCost } from "./cardLookup.js";
import { damageBonus, afterAttack } from "./effects/attackText.js";
import { effectiveHp, effectiveWeakness, attackDamageBonus, damageTakenReduction, attackCostAdjustment, } from "./effects/continuous.js";
export { setCardRegistry } from "./cardLookup.js";
const other = (p) => (p === "p1" ? "p2" : "p1");
function log(state, player, message) {
    return { ...state, log: [...state.log, { timestamp: Date.now(), player, message }] };
}
function withPlayer(state, player, patch) {
    return { ...state, players: { ...state.players, [player]: { ...state.players[player], ...patch } } };
}
/**
 * Knock out `victim`'s Active Pokémon: card plus everything attached goes to the
 * discard, the attacker takes that Pokémon's prize value, and the victim owes a
 * promotion. Used by attacks and by between-turn poison/burn damage alike.
 */
export function applyKnockout(state, victim, attacker) {
    const ko = state.players[victim].active;
    if (!ko)
        return state;
    const def = getPokemon(state, ko.card.cardId);
    let next = withPlayer(state, victim, {
        active: null,
        koedLastTurn: true,
        discard: [
            ...state.players[victim].discard,
            ko.card,
            ...ko.attachedEnergy,
            ...ko.attachedTools,
        ],
    });
    next = log(next, victim, `${def?.name ?? ko.card.cardId} was Knocked Out`);
    if (attacker) {
        const prizeCount = Math.min(def?.prizeValue ?? 1, next.players[attacker].prizes.length);
        const taken = next.players[attacker].prizes.slice(0, prizeCount);
        next = withPlayer(next, attacker, {
            prizes: next.players[attacker].prizes.slice(prizeCount),
            hand: [...next.players[attacker].hand, ...taken],
        });
        next = log(next, attacker, `${attacker} took ${prizeCount} prize card(s)`);
        if (next.players[attacker].prizes.length === 0) {
            return { ...log(next, attacker, `${attacker} took the last prize`), phase: "gameOver", winner: attacker };
        }
    }
    // No Pokémon left to promote: the victim loses.
    if (next.players[victim].bench.length === 0) {
        const winner = attacker ?? other(victim);
        return { ...log(next, winner, `${victim} has no Pokémon left`), phase: "gameOver", winner };
    }
    return { ...next, pendingPromote: [...(next.pendingPromote ?? []), victim] };
}
/** Move damage onto a Pokémon in play and knock it out if it reached its HP. */
export function applyDamage(state, victim, amount, attacker) {
    const target = state.players[victim].active;
    if (!target || amount <= 0)
        return state;
    const damaged = { ...target, damage: target.damage + amount };
    let next = withPlayer(state, victim, { active: damaged });
    const def = getPokemon(next, target.card.cardId);
    if (def && damaged.damage >= effectiveHp(next, damaged)) {
        next = applyKnockout(next, victim, attacker);
    }
    return next;
}
export function damageFor(state, attacker, attackIndex, bonus = 0) {
    const attackerPoke = state.players[attacker].active;
    const defenderPoke = state.players[other(attacker)].active;
    if (!attackerPoke || !defenderPoke)
        return 0;
    const attackerDef = getPokemon(state, attackerPoke.card.cardId);
    const attack = attackerDef?.attacks[attackIndex];
    if (!attackerDef || !attack)
        return 0;
    // Tools and Stadiums add their damage before Weakness and Resistance.
    let damage = attack.baseDamage + bonus + attackDamageBonus(state, attacker, attackerPoke, attack);
    const defenderDef = getPokemon(state, defenderPoke.card.cardId);
    if (defenderDef) {
        const weakness = effectiveWeakness(state, other(attacker), defenderPoke);
        if (weakness && attackerDef.types.includes(weakness.type)) {
            damage *= weakness.mult;
        }
        if (defenderDef.resistance && attackerDef.types.includes(defenderDef.resistance.type)) {
            damage = Math.max(0, damage - defenderDef.resistance.reduce);
        }
    }
    return Math.max(0, damage - damageTakenReduction(state, defenderPoke));
}
/** The single attack resolution path. `attackHandler.apply` delegates here. */
export function resolveAttack(state, attacker, attackIndex) {
    const attackerPoke = state.players[attacker].active;
    const defender = other(attacker);
    if (!attackerPoke || !state.players[defender].active)
        return state;
    const attackerDef = getPokemon(state, attackerPoke.card.cardId);
    const attack = attackerDef?.attacks[attackIndex];
    if (!attackerDef || !attack)
        return state;
    if (!canPayCost(state, attackerPoke.attachedEnergy, adjustedCost(state, attacker, attackerPoke, attack))) {
        return state;
    }
    // Bonus damage first (it can consume coin flips), then Weakness/Resistance,
    // then the rest of the attack's text.
    const [bonus, rolled] = damageBonus(state, attacker, attack);
    const damage = damageFor(rolled, attacker, attackIndex, bonus);
    let next = log(rolled, attacker, `${attackerDef.name} used ${attack.name} for ${damage}`);
    next = applyDamage(next, defender, damage, attacker);
    if (next.phase === "gameOver")
        return next;
    return afterAttack(next, attacker, attack);
}
/** An attack's cost after Tools and Stadiums adjust it. */
export function adjustedCost(state, attacker, source, attack) {
    const adjustment = attackCostAdjustment(state, attacker, source);
    if (adjustment === 0)
        return attack.cost;
    if (adjustment > 0)
        return [...attack.cost, ...new Array(adjustment).fill("Colorless")];
    // Cheaper: drop Colorless requirements first, they are the generic ones.
    const cost = [...attack.cost];
    for (let i = 0; i < -adjustment; i++) {
        const colorless = cost.lastIndexOf("Colorless");
        if (colorless >= 0)
            cost.splice(colorless, 1);
        else
            cost.pop();
    }
    return cost;
}
//# sourceMappingURL=attackFlow.js.map