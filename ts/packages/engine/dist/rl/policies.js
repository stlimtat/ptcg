import { getCard, getPokemon } from "../cardLookup.js";
import { damageFor } from "../attackFlow.js";
import { applyAction } from "../reducer.js";
import { playFrom } from "./episode.js";
/** Uniform over legal actions. The floor any learned policy has to beat. */
export const randomPolicy = (rng = Math.random) => ({ space }) => {
    const legal = [];
    for (let i = 0; i < space.mask.length; i++)
        if (space.mask[i])
            legal.push(i);
    if (legal.length === 0)
        return -1;
    return legal[Math.floor(rng() * legal.length)];
};
/**
 * Hand-written baseline: play the deck out roughly the way a person would, so
 * deck comparisons measure the deck rather than the noise of random play.
 *
 * ponytail: a priority ordering, not a search. It exists to give training a
 * non-trivial opponent and to make deck win rates mean something.
 */
export const heuristicPolicy = (rng = Math.random) => ({ state, seat, space }) => {
    let bestIndex = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < space.mask.length; i++) {
        if (!space.mask[i])
            continue;
        const action = space.actions[i];
        if (!action)
            continue;
        const score = scoreAction(state, seat, action) + rng() * 0.01; // break ties randomly
        if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    }
    return bestIndex;
};
const opponentOf = (p) => (p === "p1" ? "p2" : "p1");
function scoreAction(state, seat, action) {
    const me = state.players[seat];
    const them = state.players[opponentOf(seat)];
    switch (action.type) {
        // Forced or free value: always first.
        case "drawCard":
            return 1000;
        case "promote":
            return 900 + promoteValue(state, seat, action.instanceId);
        case "choose":
            return 800 + chooseValue(state, seat, action);
        case "attack": {
            const damage = damageFor(state, seat, action.attackIndex);
            const defender = them.active;
            const defenderDef = defender && getPokemon(state, defender.card.cardId);
            if (!defender || !defenderDef)
                return 0;
            // Knocking something out is the only way to take prizes.
            const lethal = defender.damage + damage >= defenderDef.hp;
            return 500 + (lethal ? 200 + (defenderDef.prizeValue ?? 1) * 50 : 0) + damage / 10;
        }
        case "useAbility":
            return 600;
        case "attachEnergy": {
            // Energy on the Active Pokémon is what turns into damage.
            const toActive = me.active?.card.instanceId === action.targetInstanceId;
            return 400 + (toActive ? 50 : 0);
        }
        case "evolve":
            return 350;
        case "playTrainer": {
            const def = getCard(state, action.cardId);
            if (def?.type !== "trainer")
                return 100;
            // Supporters are once per turn, so spend them before Items.
            if (def.subtype === "supporter")
                return 300;
            if (def.subtype === "tool")
                return 150;
            if (def.subtype === "stadium")
                return 120;
            return 200;
        }
        case "playPokemon":
            // A wider bench is insurance against a knockout ending the game.
            return me.bench.length < 3 ? 250 : 60;
        case "retreat": {
            const active = me.active;
            const def = active && getPokemon(state, active.card.cardId);
            if (!active || !def)
                return 0;
            // Only worth it when the Active Pokémon is nearly dead.
            return active.damage / def.hp > 0.6 ? 180 : 10;
        }
        case "endTurn":
            return 1; // last resort
    }
    return 0;
}
function promoteValue(state, seat, instanceId) {
    const ps = state.players[seat];
    const card = ps.bench.find((p) => p.card.instanceId === instanceId)?.card ??
        ps.hand.find((c) => c.instanceId === instanceId);
    const def = card && getPokemon(state, card.cardId);
    if (!def)
        return 0;
    // Prefer a healthy attacker that does not hand over extra prizes.
    return def.hp / 10 - (def.prizeValue ?? 1) * 10;
}
function chooseValue(state, seat, action) {
    const choice = state.pendingChoice;
    if (!choice)
        return 0;
    // Declining is a last resort: cards are usually played for their effect.
    if (action.instanceId === undefined)
        return -50;
    const card = findCard(state, action.instanceId);
    const def = card && getCard(state, card.cardId);
    if (!def)
        return 0;
    // Discarding as a cost should throw away the least useful card.
    if (/Discard/.test(choice.prompt)) {
        if (def.type === "energy")
            return -20;
        if (def.type === "pokemon")
            return -10;
        return 0;
    }
    // Otherwise prefer Pokémon that can attack, then Energy, then Trainers.
    if (def.type === "pokemon")
        return 20 + (def.prizeValue ?? 1) * 5;
    if (def.type === "energy")
        return 15;
    return 10;
}
function findCard(state, instanceId) {
    for (const p of ["p1", "p2"]) {
        const ps = state.players[p];
        for (const zone of [ps.hand, ps.deck, ps.discard]) {
            const hit = zone.find((c) => c.instanceId === instanceId);
            if (hit)
                return hit;
        }
        for (const poke of [ps.active, ...ps.bench]) {
            if (poke?.card.instanceId === instanceId)
                return poke.card;
        }
    }
    return null;
}
/**
 * Decision-time search: rank the legal actions with the heuristic, then settle
 * the top few by actually playing the game out from each and seeing who wins.
 *
 * Flat Monte Carlo rather than a tree — for a game this size, spending the
 * budget on rollouts from a shortlist beats spending it on tree bookkeeping,
 * and it needs no learned value function.
 *
 * ponytail: candidates/rollouts are the two knobs that matter; both cost linear
 * time, so raise them only as far as the evaluation budget allows.
 */
export const rolloutPolicy = (options = {}) => {
    const { candidates = 4, rollouts = 4, rng = Math.random } = options;
    return (decision) => {
        const { state, seat, space } = decision;
        const legal = [];
        for (let i = 0; i < space.mask.length; i++)
            if (space.mask[i])
                legal.push(i);
        if (legal.length === 0)
            return -1;
        if (legal.length === 1)
            return legal[0];
        // Shortlist by heuristic score so the rollout budget goes on plausible moves.
        const scored = legal
            .map((index) => ({ index, score: scoreAction(state, seat, space.actions[index]) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, candidates);
        if (scored.length === 1)
            return scored[0].index;
        let bestIndex = scored[0].index;
        let bestValue = -Infinity;
        for (const { index } of scored) {
            let wins = 0;
            let played = 0;
            for (let r = 0; r < rollouts; r++) {
                // A distinct seed per rollout, so repeated playouts explore different
                // shuffles rather than replaying one line.
                const seeded = { ...state, rngSeed: ((state.rngSeed ?? 1) + index * 7919 + r * 104729) >>> 0 };
                let next;
                try {
                    next = applyAction(seeded, space.actions[index]);
                }
                catch {
                    continue;
                }
                const result = playFrom(next, {
                    p1: heuristicPolicy(rng),
                    p2: heuristicPolicy(rng),
                }, { recordTransitions: false, maxTurns: 60 });
                played++;
                if (result.winner === seat)
                    wins++;
                else if (!result.winner)
                    wins += 0.5; // unfinished: treat as a draw
            }
            const value = played ? wins / played : 0;
            if (value > bestValue) {
                bestValue = value;
                bestIndex = index;
            }
        }
        return bestIndex;
    };
};
//# sourceMappingURL=policies.js.map