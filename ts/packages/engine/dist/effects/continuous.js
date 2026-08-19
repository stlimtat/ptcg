import { getCard, getPokemon } from "../cardLookup.js";
/**
 * Continuous effects: Tools, Stadiums and always-on Abilities that change the
 * rules while they are in play, rather than doing something once.
 *
 * Everything the rest of the engine asks about a Pokémon in play — its HP, its
 * Retreat Cost, its Weakness, what its attacks cost and how hard they hit —
 * goes through this module, so a modifier only has to be written once.
 *
 * ponytail: an explicit table keyed by card name. These cards are few and each
 * says something different; pattern-matching their text would be guesswork
 * where a lookup is exact.
 */
const opponentOf = (p) => (p === "p1" ? "p2" : "p1");
const inPlay = (ps) => [ps.active, ...ps.bench].filter((p) => !!p);
const stadiumName = (state) => state.stadium ? getCard(state, state.stadium.cardId)?.name ?? null : null;
/** Jamming Tower switches every Tool off. */
export const toolsDisabled = (state) => stadiumName(state) === "Jamming Tower";
function toolNames(state, poke) {
    if (toolsDisabled(state))
        return [];
    return poke.attachedTools.map((t) => getCard(state, t.cardId)?.name).filter((n) => !!n);
}
const subtypesOf = (def) => (def?.subtypes ?? []);
const isTera = (def) => subtypesOf(def).some((s) => /Tera/i.test(s));
const hasRuleBox = (def) => !!def && def.type === "pokemon" && ((def.prizeValue ?? 1) > 1 || subtypesOf(def).some((s) => /^(ex|V|VMAX|VSTAR|Radiant|ACE SPEC)$/i.test(s)));
/**
 * Whether a Pokémon's Abilities work at all. Team Rocket's Watchtower turns off
 * every Colorless Pokémon's Ability, on both sides.
 */
export function abilitiesLocked(state, poke) {
    const def = getPokemon(state, poke.card.cardId);
    if (!def)
        return false;
    if (stadiumName(state) === "Team Rocket's Watchtower" && def.types.includes("Colorless"))
        return true;
    return false;
}
/** An ability that is simply on while its Pokémon is in play. */
function continuousAbilityInPlay(state, owner, abilityName) {
    return inPlay(state.players[owner]).some((poke) => {
        if (abilitiesLocked(state, poke))
            return false;
        const def = getPokemon(state, poke.card.cardId);
        return def?.abilities.some((a) => a.name === abilityName) ?? false;
    });
}
export function effectiveHp(state, poke) {
    const def = getPokemon(state, poke.card.cardId);
    let hp = def?.hp ?? 1;
    for (const tool of toolNames(state, poke)) {
        if (tool === "Hero's Cape")
            hp += 100;
        if (tool === "Bravery Charm")
            hp += 50;
    }
    return hp;
}
export function effectiveRetreatCost(state, owner, poke) {
    const def = getPokemon(state, poke.card.cardId);
    let cost = def?.retreatCost ?? 0;
    // Latias ex — your Basic Pokémon have no Retreat Cost.
    if (def?.stage === 0 && continuousAbilityInPlay(state, owner, "Skyliner"))
        return 0;
    for (const tool of toolNames(state, poke)) {
        if (tool === "Air Balloon")
            cost -= 2;
        if (tool === "Escape Rope")
            cost -= 1;
    }
    return Math.max(0, cost);
}
/**
 * Weakness after continuous effects. Lillie's Clefairy ex rewrites the Weakness
 * of the *opponent's* Dragon Pokémon, so this needs to know who owns the target.
 */
export function effectiveWeakness(state, owner, poke) {
    const def = getPokemon(state, poke.card.cardId);
    if (def?.types.includes("Dragon") && continuousAbilityInPlay(state, opponentOf(owner), "Fairy Zone")) {
        return { type: "Psychic", mult: 2 };
    }
    return def?.weakness;
}
/** Extra damage to the opponent's Active Pokémon, before Weakness/Resistance. */
export function attackDamageBonus(state, attacker, source, _attack) {
    const def = getPokemon(state, source.card.cardId);
    const target = state.players[opponentOf(attacker)].active;
    const targetDef = target && getPokemon(state, target.card.cardId);
    let bonus = 0;
    for (const tool of toolNames(state, source)) {
        if (tool === "Brave Bangle" && !hasRuleBox(def))
            bonus += 30;
        if (tool === "Hop's Choice Band" && def?.name.startsWith("Hop's"))
            bonus += 30;
        if (tool === "Maximum Belt" && subtypesOf(targetDef).includes("ex"))
            bonus += 50;
        if (tool === "Choice Belt" && hasRuleBox(targetDef))
            bonus += 30;
        if (tool === "Vitality Band")
            bonus += 20;
        if (tool === "Defiance Band" && state.players[attacker].prizes.length > state.players[opponentOf(attacker)].prizes.length) {
            bonus += 30;
        }
    }
    // Postwick — Hop's Pokémon hit harder, whoever owns them.
    if (stadiumName(state) === "Postwick" && def?.name.startsWith("Hop's"))
        bonus += 30;
    return bonus;
}
/** Damage reduction applied to the Pokémon taking the hit. */
export function damageTakenReduction(state, poke) {
    let reduction = 0;
    for (const tool of toolNames(state, poke)) {
        if (tool === "Rock Chestplate")
            reduction += 30;
        if (tool === "Bravery Charm")
            reduction += 0; // HP only
    }
    return reduction;
}
/**
 * Colorless Energy added to or removed from an attack's cost. Negative makes the
 * attack cheaper.
 */
export function attackCostAdjustment(state, attacker, source) {
    const def = getPokemon(state, source.card.cardId);
    let adjustment = 0;
    for (const tool of toolNames(state, source)) {
        if (tool === "Hop's Choice Band" && def?.name.startsWith("Hop's"))
            adjustment -= 1;
        if (tool === "Counter Gain" &&
            state.players[attacker].prizes.length > state.players[opponentOf(attacker)].prizes.length) {
            adjustment -= 1;
        }
    }
    // Nighttime Mine taxes Tera Pokémon on both sides.
    if (stadiumName(state) === "Nighttime Mine" && isTera(def))
        adjustment += 1;
    return adjustment;
}
/** Area Zero Underdepths widens the Bench for players with a Tera Pokémon. */
export function benchLimit(state, owner) {
    if (stadiumName(state) === "Area Zero Underdepths") {
        const hasTera = inPlay(state.players[owner]).some((p) => isTera(getPokemon(state, p.card.cardId)));
        if (hasTera)
            return 8;
    }
    return 5;
}
/** Battle Cage stops attack and Ability effects placing counters on the Bench. */
export const benchCountersPrevented = (state) => stadiumName(state) === "Battle Cage";
/** Festival Grounds keeps Special Conditions off anything with Energy attached. */
export function immuneToStatus(state, poke) {
    return stadiumName(state) === "Festival Grounds" && poke.attachedEnergy.length > 0;
}
/** Risky Ruins chips any Basic non-Darkness Pokémon put onto a Bench. */
export function benchPlacementDamage(state, cardId) {
    if (stadiumName(state) !== "Risky Ruins")
        return 0;
    const def = getPokemon(state, cardId);
    if (!def || def.stage !== 0 || def.types.includes("Darkness"))
        return 0;
    return 20;
}
/** Forest of Vitality lets Grass Pokémon evolve the turn they are played. */
export function canEvolveImmediately(state, cardId) {
    if (stadiumName(state) !== "Forest of Vitality")
        return false;
    if (state.turn <= 1)
        return false;
    const def = getPokemon(state, cardId);
    return def?.types.includes("Grass") ?? false;
}
/**
 * Tools, Stadiums and continuous Abilities this module actually implements.
 * The coverage tests read it so "routed into play" is never mistaken for
 * "does what the card says".
 */
export const CONTINUOUS_CARDS = new Set([
    // Tools
    "Hero's Cape",
    "Bravery Charm",
    "Air Balloon",
    "Escape Rope",
    "Brave Bangle",
    "Hop's Choice Band",
    "Maximum Belt",
    "Choice Belt",
    "Vitality Band",
    "Defiance Band",
    "Counter Gain",
    // Stadiums
    "Jamming Tower",
    "Team Rocket's Watchtower",
    "Postwick",
    "Nighttime Mine",
    "Area Zero Underdepths",
    "Battle Cage",
    "Festival Grounds",
    "Risky Ruins",
    "Forest of Vitality",
    // Continuous abilities
    "Skyliner",
    "Fairy Zone",
]);
//# sourceMappingURL=continuous.js.map