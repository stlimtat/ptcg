// Test-friendly card registry - set during testing to validate card stages
let testCardRegistry = null;
export function setCardRegistry(registry) {
    testCardRegistry = registry;
}
export const playPokemonHandler = {
    isLegal(state, action) {
        if (action.type !== "playPokemon")
            return false;
        // Only active player can play during main phase
        if (action.player !== state.activePlayer)
            return false;
        if (state.phase !== "main")
            return false;
        const player = state.players[action.player];
        // Bench must have space (max 5)
        if (player.bench.length >= 5)
            return false;
        // Card must exist in hand
        const card = player.hand.find((c) => c.cardId === action.cardId);
        if (!card)
            return false;
        // Validate card is basic Pokémon (stage === 0) if registry available
        if (testCardRegistry) {
            const cardDef = testCardRegistry.get(action.cardId);
            if (!cardDef)
                return false;
            if (cardDef.type === "pokemon" && cardDef.stage !== 0)
                return false;
        }
        return true;
    },
    apply(state, action) {
        const typedAction = action;
        const player = state.players[action.player];
        const cardInstance = player.hand.find((c) => c.cardId === typedAction.cardId);
        return {
            ...state,
            players: {
                ...state.players,
                [action.player]: {
                    ...player,
                    hand: player.hand.filter((c) => c !== cardInstance),
                    bench: [
                        ...player.bench,
                        {
                            card: cardInstance,
                            damage: 0,
                            attachedEnergy: [],
                            attachedTools: [],
                            statusConditions: [],
                        },
                    ],
                },
            },
            log: [
                ...state.log,
                {
                    timestamp: Date.now(),
                    player: action.player,
                    message: `${action.player} played basic Pokémon to bench`,
                },
            ],
        };
    },
};
//# sourceMappingURL=playPokemon.js.map