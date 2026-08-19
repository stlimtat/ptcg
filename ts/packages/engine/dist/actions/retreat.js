import { effectiveRetreatCost } from "../effects/continuous.js";
export { setCardRegistry } from "../cardLookup.js";
const retreatCostOf = (state, player, poke) => effectiveRetreatCost(state, player, poke);
export const retreatHandler = {
    isLegal(state, action) {
        if (action.type !== "retreat")
            return false;
        // Only active player can play during main phase
        if (action.player !== state.activePlayer)
            return false;
        if (state.phase !== "main")
            return false;
        if (state.pendingPromote?.length)
            return false;
        if (state.pendingChoice)
            return false;
        const player = state.players[action.player];
        if (player.attackedThisTurn)
            return false;
        // Only one retreat per turn
        if (player.retreatedThisTurn)
            return false;
        // Must have active Pokémon
        if (!player.active)
            return false;
        // Bench Pokémon must exist
        const benchPokemon = player.bench.find((p) => p.card.instanceId === action.benchInstanceId);
        if (!benchPokemon)
            return false;
        // Asleep or Paralyzed Pokémon cannot retreat
        if (player.active.statusConditions.some((c) => c === "Asleep" || c === "Paralyzed"))
            return false;
        // An attack may have stopped this Pokémon retreating this turn.
        const active = player.active;
        if (state.ongoing?.some((e) => e.kind === "noRetreat" &&
            e.appliesTo === action.player &&
            (!e.instanceId || e.instanceId === active.card.instanceId))) {
            return false;
        }
        // Must have enough energy attached to pay the retreat cost
        if (player.active.attachedEnergy.length < retreatCostOf(state, action.player, player.active)) {
            return false;
        }
        return true;
    },
    apply(state, action) {
        const typedAction = action;
        const player = state.players[action.player];
        const activeCard = player.active;
        const benchPokemon = player.bench.find((p) => p.card.instanceId === typedAction.benchInstanceId);
        const retreatCost = retreatCostOf(state, action.player, activeCard);
        // Discard energy
        const energyToDiscard = activeCard.attachedEnergy.slice(0, retreatCost);
        const remainingEnergy = activeCard.attachedEnergy.slice(retreatCost);
        // Update bench list: remove switched bench Pokémon, add old active
        // Retreating clears Special Conditions from the Pokémon leaving the Active spot.
        const newBench = player.bench.map((p) => p.card.instanceId === typedAction.benchInstanceId
            ? { ...activeCard, attachedEnergy: remainingEnergy, statusConditions: [] }
            : p);
        return {
            ...state,
            players: {
                ...state.players,
                [action.player]: {
                    ...player,
                    active: benchPokemon,
                    bench: newBench,
                    discard: [...player.discard, ...energyToDiscard],
                    retreatedThisTurn: true,
                },
            },
            log: [
                ...state.log,
                {
                    timestamp: Date.now(),
                    player: action.player,
                    message: `${action.player} retreated`,
                },
            ],
        };
    },
};
//# sourceMappingURL=retreat.js.map