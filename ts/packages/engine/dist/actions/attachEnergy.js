// Card registry lookup - set during testing to validate energy types
let testCardRegistry = null;
export function setCardRegistry(registry) {
    testCardRegistry = registry;
}
export const attachEnergyHandler = {
    isLegal(state, action) {
        if (action.type !== "attachEnergy")
            return false;
        // Only one energy per turn
        if (state.players[action.player].energyAttachedThisTurn)
            return false;
        // Only active player can play during main phase
        if (action.player !== state.activePlayer)
            return false;
        if (state.phase !== "main")
            return false;
        const player = state.players[action.player];
        // Card must exist in hand
        const card = player.hand.find((c) => c.cardId === action.energyCardId);
        if (!card)
            return false;
        // Validate card is energy type if registry available
        const registry = state.cardRegistry || testCardRegistry;
        if (registry) {
            const cardDef = registry instanceof Map ? registry.get(action.energyCardId) : registry[action.energyCardId];
            if (!cardDef || cardDef.type !== "energy")
                return false;
        }
        // Find target in bench or active
        const target = (player.active?.card.instanceId === action.targetInstanceId ? player.active : null) ||
            player.bench.find((p) => p.card.instanceId === action.targetInstanceId);
        if (!target)
            return false;
        return true;
    },
    apply(state, action) {
        const typedAction = action;
        const player = state.players[action.player];
        const cardInstance = player.hand.find((c) => c.cardId === typedAction.energyCardId);
        // Find and attach to target
        const newActive = player.active?.card.instanceId === typedAction.targetInstanceId
            ? {
                ...player.active,
                attachedEnergy: [...player.active.attachedEnergy, cardInstance],
            }
            : player.active;
        const newBench = player.bench.map((p) => p.card.instanceId === typedAction.targetInstanceId
            ? { ...p, attachedEnergy: [...p.attachedEnergy, cardInstance] }
            : p);
        return {
            ...state,
            players: {
                ...state.players,
                [action.player]: {
                    ...player,
                    hand: player.hand.filter((c) => c !== cardInstance),
                    active: newActive,
                    bench: newBench,
                    energyAttachedThisTurn: true,
                },
            },
            log: [
                ...state.log,
                {
                    timestamp: Date.now(),
                    player: action.player,
                    message: `${action.player} attached energy`,
                },
            ],
        };
    },
};
//# sourceMappingURL=attachEnergy.js.map