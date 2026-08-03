export const drawCardHandler = {
    isLegal(state, action) {
        if (action.type !== "drawCard")
            return false;
        // Only active player can draw
        if (action.player !== state.activePlayer)
            return false;
        // Must have cards in deck
        if (state.players[action.player].deck.length === 0)
            return false;
        return true;
    },
    apply(state, action) {
        const player = state.players[action.player];
        if (player.deck.length === 0) {
            return state;
        }
        const card = player.deck[0];
        const newDeck = player.deck.slice(1);
        return {
            ...state,
            players: {
                ...state.players,
                [action.player]: {
                    ...player,
                    deck: newDeck,
                    hand: [...player.hand, card],
                    hasDrawnThisTurn: true,
                },
            },
            log: [
                ...state.log,
                {
                    timestamp: Date.now(),
                    player: action.player,
                    message: `${action.player} drew a card`,
                },
            ],
        };
    },
};
//# sourceMappingURL=drawCard.js.map