import { legalActions } from "../legalActions.js";
/**
 * A flat, fixed action space with a legality mask.
 *
 * Actions are addressed by *position* — hand slot, bench slot, attack index —
 * rather than by instanceId, so the same index means a comparable thing across
 * states and a policy network can learn it. Anything the rules forbid right now
 * is masked out rather than removed, keeping the vector a constant size.
 */
export const HAND_SLOTS = 15;
/** Active plus five Bench slots. */
export const PLAY_SLOTS = 6;
export const ATTACK_SLOTS = 4;
export const ABILITY_SLOTS = 2;
export const CHOICE_SLOTS = 60;
const SEGMENTS = [
    ["drawCard", 1],
    ["endTurn", 1],
    ["playPokemon", HAND_SLOTS],
    ["evolve", HAND_SLOTS * PLAY_SLOTS],
    ["attachEnergy", HAND_SLOTS * PLAY_SLOTS],
    // Trainers get a "no target" slot plus one per Pokémon, for Tools.
    ["playTrainer", HAND_SLOTS * (PLAY_SLOTS + 1)],
    ["retreat", PLAY_SLOTS - 1],
    ["attack", ATTACK_SLOTS],
    ["promote", PLAY_SLOTS],
    ["useAbility", PLAY_SLOTS * ABILITY_SLOTS],
    // One index per option, plus a final index meaning "stop / decline".
    ["choose", CHOICE_SLOTS + 1],
];
export const ACTION_SPACE_SIZE = SEGMENTS.reduce((n, [, size]) => n + size, 0);
const OFFSETS = {};
{
    let offset = 0;
    for (const [name, size] of SEGMENTS) {
        OFFSETS[name] = offset;
        offset += size;
    }
}
/** Where a Pokémon sits: 0 is Active, 1..5 are Bench slots. */
function playSlotOf(state, player, instanceId) {
    const ps = state.players[player];
    if (ps.active?.card.instanceId === instanceId)
        return 0;
    const bench = ps.bench.findIndex((p) => p.card.instanceId === instanceId);
    return bench < 0 ? -1 : bench + 1;
}
function handSlotOf(state, player, cardId) {
    return state.players[player].hand.findIndex((c) => c.cardId === cardId);
}
/**
 * Index for an action, or -1 when it falls outside the space (a hand bigger
 * than HAND_SLOTS, a choice with more options than CHOICE_SLOTS).
 */
export function encodeAction(state, action) {
    const player = action.player;
    const opponent = player === "p1" ? "p2" : "p1";
    switch (action.type) {
        case "drawCard":
            return OFFSETS.drawCard;
        case "endTurn":
            return OFFSETS.endTurn;
        case "playPokemon": {
            const hand = handSlotOf(state, player, action.cardId);
            return hand >= 0 && hand < HAND_SLOTS ? OFFSETS.playPokemon + hand : -1;
        }
        case "evolve": {
            const hand = handSlotOf(state, player, action.cardId);
            const slot = playSlotOf(state, player, action.targetInstanceId);
            return hand >= 0 && hand < HAND_SLOTS && slot >= 0
                ? OFFSETS.evolve + hand * PLAY_SLOTS + slot
                : -1;
        }
        case "attachEnergy": {
            const hand = handSlotOf(state, player, action.energyCardId);
            const slot = playSlotOf(state, player, action.targetInstanceId);
            return hand >= 0 && hand < HAND_SLOTS && slot >= 0
                ? OFFSETS.attachEnergy + hand * PLAY_SLOTS + slot
                : -1;
        }
        case "playTrainer": {
            const hand = handSlotOf(state, player, action.cardId);
            if (hand < 0 || hand >= HAND_SLOTS)
                return -1;
            const slot = action.targetInstanceId ? playSlotOf(state, player, action.targetInstanceId) : -1;
            // Slot 0 means "no target"; targeted Tools shift up by one.
            const target = slot >= 0 ? slot + 1 : 0;
            return OFFSETS.playTrainer + hand * (PLAY_SLOTS + 1) + target;
        }
        case "retreat": {
            const slot = playSlotOf(state, player, action.benchInstanceId);
            return slot > 0 ? OFFSETS.retreat + (slot - 1) : -1;
        }
        case "attack":
            return action.attackIndex < ATTACK_SLOTS ? OFFSETS.attack + action.attackIndex : -1;
        case "promote": {
            // During setup the choice comes from hand, otherwise from the bench.
            if (state.phase === "setup") {
                const hand = state.players[player].hand.findIndex((c) => c.instanceId === action.instanceId);
                return hand >= 0 && hand < PLAY_SLOTS ? OFFSETS.promote + hand : -1;
            }
            const slot = playSlotOf(state, player, action.instanceId);
            return slot > 0 ? OFFSETS.promote + (slot - 1) : -1;
        }
        case "useAbility": {
            const slot = playSlotOf(state, player, action.instanceId);
            if (slot < 0)
                return -1;
            const ps = state.players[player];
            const poke = slot === 0 ? ps.active : ps.bench[slot - 1];
            const def = poke && state.cardRegistry?.[poke.card.cardId];
            const abilityIndex = def && def.type === "pokemon" ? def.abilities.findIndex((a) => a.name === action.abilityName) : -1;
            return abilityIndex >= 0 && abilityIndex < ABILITY_SLOTS
                ? OFFSETS.useAbility + slot * ABILITY_SLOTS + abilityIndex
                : -1;
        }
        case "choose": {
            const choice = state.pendingChoice;
            if (!choice)
                return -1;
            if (action.instanceId === undefined)
                return OFFSETS.choose + CHOICE_SLOTS;
            const option = choice.options.indexOf(action.instanceId);
            return option >= 0 && option < CHOICE_SLOTS ? OFFSETS.choose + option : -1;
        }
    }
    void opponent;
    return -1;
}
export function actionSpace(state, seat) {
    const mask = new Uint8Array(ACTION_SPACE_SIZE);
    const actions = new Array(ACTION_SPACE_SIZE);
    const overflow = [];
    for (const action of legalActions(state, seat)) {
        const index = encodeAction(state, action);
        if (index < 0) {
            overflow.push(action);
            continue;
        }
        mask[index] = 1;
        actions[index] = action;
    }
    return { mask, actions, overflow };
}
//# sourceMappingURL=actionSpace.js.map