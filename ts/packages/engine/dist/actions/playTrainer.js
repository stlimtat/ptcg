// Card registry lookup - set during testing to validate trainer subtypes
let testCardRegistry = null;
export function setCardRegistry(registry) {
    testCardRegistry = registry;
}
export const playTrainerHandler = {
    isLegal(state, action) {
        if (action.type !== "playTrainer")
            return false;
        // Only active player can play during main phase
        if (action.player !== state.activePlayer)
            return false;
        if (state.phase !== "main")
            return false;
        const player = state.players[action.player];
        // Card must exist in hand
        const card = player.hand.find((c) => c.cardId === action.cardId);
        if (!card)
            return false;
        // Validate card is trainer type if registry available
        // Card registry validation pending phase 9
        if (testCardRegistry) {
            const cardDef = testCardRegistry.get(action.cardId);
            if (!cardDef || cardDef.type !== "trainer")
                return false;
            // Supporters limited to 1 per turn
            if (cardDef.subtype === "supporter" && player.supporterPlayedThisTurn) {
                return false;
            }
        }
        return true;
    },
    apply(state, action) {
        const typedAction = action;
        const player = state.players[action.player];
        const cardInstance = player.hand.find((c) => c.cardId === typedAction.cardId);
        // Determine if supporter
        let supporterPlayedThisTurn = player.supporterPlayedThisTurn;
        if (testCardRegistry) {
            const cardDef = testCardRegistry.get(typedAction.cardId);
            if (cardDef && cardDef.type === "trainer" && cardDef.subtype === "supporter") {
                supporterPlayedThisTurn = true;
            }
        }
        return {
            ...state,
            players: {
                ...state.players,
                [action.player]: {
                    ...player,
                    hand: player.hand.filter((c) => c !== cardInstance),
                    discard: [...player.discard, cardInstance],
                    supporterPlayedThisTurn,
                },
            },
            log: [
                ...state.log,
                {
                    timestamp: Date.now(),
                    player: action.player,
                    message: `${action.player} played trainer card`,
                },
            ],
        };
    },
};
//# sourceMappingURL=playTrainer.js.map