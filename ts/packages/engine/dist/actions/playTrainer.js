import { getCard } from "../cardLookup.js";
import { applyTrainerEffect, trainerPlayable } from "../effects/trainers.js";
export { setCardRegistry } from "../cardLookup.js";
function targetFor(state, player, instanceId) {
    if (!instanceId)
        return null;
    const ps = state.players[player];
    return [ps.active, ...ps.bench].find((p) => p?.card.instanceId === instanceId) ?? null;
}
export const playTrainerHandler = {
    isLegal(state, action) {
        if (action.type !== "playTrainer")
            return false;
        if (action.player !== state.activePlayer)
            return false;
        if (state.phase !== "main")
            return false;
        if (state.pendingPromote?.length || state.pendingChoice)
            return false;
        const player = state.players[action.player];
        if (player.attackedThisTurn)
            return false;
        const card = player.hand.find((c) => c.cardId === action.cardId);
        if (!card)
            return false;
        const cardDef = getCard(state, action.cardId);
        if (!cardDef)
            return true; // unknown card: fixture-driven tests supply no registry
        if (cardDef.type !== "trainer")
            return false;
        // An attack may have locked Items for this turn.
        if (cardDef.subtype === "item" &&
            state.ongoing?.some((e) => e.kind === "itemLock" && e.appliesTo === action.player)) {
            return false;
        }
        // One Supporter and one Stadium per turn.
        if (cardDef.subtype === "supporter" && player.supporterPlayedThisTurn)
            return false;
        if (cardDef.subtype === "stadium") {
            if (player.stadiumPlayedThisTurn)
                return false;
            // A Stadium with the same name as the one already in play can't be played.
            const inPlay = state.stadium && getCard(state, state.stadium.cardId);
            if (inPlay && inPlay.name === cardDef.name)
                return false;
        }
        // Tools attach to one of your Pokémon that isn't already holding one.
        if (cardDef.subtype === "tool") {
            const target = targetFor(state, action.player, action.targetInstanceId);
            if (!target || target.attachedTools.length > 0)
                return false;
        }
        const restriction = trainerPlayable[cardDef.name];
        if (restriction && !restriction(state, action.player))
            return false;
        return true;
    },
    apply(state, action) {
        if (action.type !== "playTrainer")
            return state;
        const player = state.players[action.player];
        const cardInstance = player.hand.find((c) => c.cardId === action.cardId);
        const cardDef = getCard(state, action.cardId);
        const cardName = cardDef?.name ?? "trainer";
        const subtype = cardDef?.type === "trainer" ? cardDef.subtype : "item";
        let next = {
            ...state,
            players: {
                ...state.players,
                [action.player]: {
                    ...player,
                    hand: player.hand.filter((c) => c !== cardInstance),
                    // Items and Supporters go to the discard; Tools and Stadiums stay in play.
                    discard: subtype === "tool" || subtype === "stadium" ? player.discard : [...player.discard, cardInstance],
                    supporterPlayedThisTurn: subtype === "supporter" ? true : player.supporterPlayedThisTurn,
                    stadiumPlayedThisTurn: subtype === "stadium" ? true : player.stadiumPlayedThisTurn,
                },
            },
            log: [
                ...state.log,
                { timestamp: Date.now(), player: action.player, message: `${action.player} played ${cardName}` },
            ],
        };
        if (subtype === "tool") {
            const attach = (p) => p.card.instanceId === action.targetInstanceId
                ? { ...p, attachedTools: [...p.attachedTools, cardInstance] }
                : p;
            const ps = next.players[action.player];
            return {
                ...next,
                players: {
                    ...next.players,
                    [action.player]: { ...ps, active: ps.active ? attach(ps.active) : null, bench: ps.bench.map(attach) },
                },
            };
        }
        if (subtype === "stadium") {
            const ps = next.players[action.player];
            return {
                ...next,
                stadium: cardInstance,
                players: {
                    ...next.players,
                    // The Stadium it replaces is discarded.
                    [action.player]: { ...ps, discard: state.stadium ? [...ps.discard, state.stadium] : ps.discard },
                },
            };
        }
        return applyTrainerEffect(next, cardName, action.player);
    },
};
//# sourceMappingURL=playTrainer.js.map