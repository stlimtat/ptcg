import { getCard } from "../cardLookup.js";
/**
 * Move a Pokémon into the empty Active spot. Owed after a knockout, and during
 * setup where the choice comes from the opening hand rather than the bench.
 */
export const promoteHandler = {
    isLegal(state, action) {
        if (action.type !== "promote")
            return false;
        if (!state.pendingPromote?.includes(action.player))
            return false;
        if (state.players[action.player].active)
            return false;
        if (state.phase === "setup") {
            const card = state.players[action.player].hand.find((c) => c.instanceId === action.instanceId);
            if (!card)
                return false;
            const def = getCard(state, card.cardId);
            return !def || (def.type === "pokemon" && def.stage === 0);
        }
        return state.players[action.player].bench.some((p) => p.card.instanceId === action.instanceId);
    },
    apply(state, action) {
        if (action.type !== "promote")
            return state;
        const player = state.players[action.player];
        let patch;
        if (state.phase === "setup") {
            const card = player.hand.find((c) => c.instanceId === action.instanceId);
            patch = {
                hand: player.hand.filter((c) => c !== card),
                active: {
                    card,
                    damage: 0,
                    attachedEnergy: [],
                    attachedTools: [],
                    statusConditions: [],
                    placedOnTurn: state.turn,
                },
            };
        }
        else {
            const poke = player.bench.find((p) => p.card.instanceId === action.instanceId);
            patch = {
                bench: player.bench.filter((p) => p !== poke),
                // A Pokémon moving to the Active spot keeps its damage but loses Special Conditions.
                active: { ...poke, statusConditions: [] },
            };
        }
        const pendingPromote = (state.pendingPromote ?? []).filter((p) => p !== action.player);
        return {
            ...state,
            // Setup ends once both players have an Active Pokémon.
            phase: state.phase === "setup" && pendingPromote.length === 0 ? "main" : state.phase,
            pendingPromote,
            players: { ...state.players, [action.player]: { ...player, ...patch } },
            log: [
                ...state.log,
                {
                    timestamp: Date.now(),
                    player: action.player,
                    message: `${action.player} promoted a Pokémon to Active`,
                },
            ],
        };
    },
};
//# sourceMappingURL=promote.js.map