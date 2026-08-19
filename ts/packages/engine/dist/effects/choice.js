export function ask(state, choice) {
    // Nothing to choose from: resume immediately rather than stalling the game.
    if (choice.options.length === 0 || choice.remaining <= 0) {
        return resumeEffect(state, choice.effect, choice.step, choice.player, choice.picked ?? [], choice.args);
    }
    return { ...state, pendingChoice: { picked: [], ...choice } };
}
/** Find a card instance anywhere in either player's zones. */
export function findInstance(state, instanceId) {
    for (const p of ["p1", "p2"]) {
        const ps = state.players[p];
        for (const zone of [ps.hand, ps.deck, ps.discard, ps.prizes]) {
            const hit = zone.find((c) => c.instanceId === instanceId);
            if (hit)
                return hit;
        }
        for (const poke of [ps.active, ...ps.bench]) {
            if (!poke)
                continue;
            if (poke.card.instanceId === instanceId)
                return poke.card;
            const attached = [...poke.attachedEnergy, ...poke.attachedTools].find((c) => c.instanceId === instanceId);
            if (attached)
                return attached;
        }
    }
    return null;
}
export const effectSteps = new Map();
export function resumeEffect(state, effect, step, player, pickedIds, args) {
    const steps = effectSteps.get(effect);
    const fn = steps?.[step];
    if (!fn)
        return { ...state, pendingChoice: undefined };
    const picked = pickedIds.map((id) => findInstance(state, id)).filter((c) => !!c);
    return fn({ ...state, pendingChoice: undefined }, player, picked, args);
}
//# sourceMappingURL=choice.js.map