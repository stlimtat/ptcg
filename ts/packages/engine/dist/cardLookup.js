// One registry resolver for every action handler. `state.cardRegistry` is the
// real source; the module-level fallback exists because the test suite installs
// its fixtures through setCardRegistry().
let fallbackRegistry = null;
export function setCardRegistry(registry) {
    fallbackRegistry = registry;
}
export function getCard(state, cardId) {
    const fromState = state.cardRegistry?.[cardId];
    if (fromState)
        return fromState;
    return fallbackRegistry?.get(cardId) ?? null;
}
export function getPokemon(state, cardId) {
    const card = getCard(state, cardId);
    return card && card.type === "pokemon" ? card : null;
}
/**
 * Colorless cost is payable by *any* energy, so typed requirements must be
 * matched first and whatever is left over pays the Colorless.
 */
export function canPayCost(state, attached, cost) {
    if (cost.length === 0)
        return true;
    // Each attached card contributes the set of types it can pay for. "any" is a
    // true wild; a Colorless-only Energy pays Colorless costs and nothing else.
    const pool = [];
    for (const e of attached) {
        const def = getCard(state, e.cardId);
        if (def?.type !== "energy") {
            pool.push(["any"]);
            continue;
        }
        const provides = def.providesType;
        pool.push(Array.isArray(provides) ? provides : [provides]);
    }
    let colorlessNeeded = 0;
    for (const type of cost) {
        if (type === "Colorless") {
            colorlessNeeded++;
            continue;
        }
        // Spend an exact match first, keeping wilds for costs nothing else covers.
        let index = pool.findIndex((p) => p.includes(type));
        if (index < 0)
            index = pool.findIndex((p) => p.includes("any"));
        if (index < 0)
            return false;
        pool.splice(index, 1);
    }
    // Anything left over, of any type, pays the Colorless part of the cost.
    return pool.length >= colorlessNeeded;
}
// xorshift32: deterministic, seedable, good enough for coin flips and shuffles.
export function nextRandom(state) {
    if (state.rngSeed === undefined)
        return [Math.random(), state];
    let x = state.rngSeed || 1;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const seed = x >>> 0;
    return [seed / 0x100000000, { ...state, rngSeed: seed }];
}
export function flipCoin(state) {
    const [value, next] = nextRandom(state);
    return [value >= 0.5, next];
}
//# sourceMappingURL=cardLookup.js.map