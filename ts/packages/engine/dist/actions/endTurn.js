export const endTurnHandler = {
    isLegal(state, action) {
        if (action.type !== "endTurn")
            return false;
        return action.player === state.activePlayer;
    },
    apply(state, action) {
        const otherPlayer = action.player === "p1" ? "p2" : "p1";
        const newTurn = action.player === "p2" ? state.turn + 1 : state.turn;
        return {
            ...state,
            turn: newTurn,
            activePlayer: otherPlayer,
            players: {
                ...state.players,
                [action.player]: {
                    ...state.players[action.player],
                    energyAttachedThisTurn: false,
                    supporterPlayedThisTurn: false,
                    hasDrawnThisTurn: false,
                },
            },
            log: [
                ...state.log,
                {
                    timestamp: Date.now(),
                    player: action.player,
                    message: `${action.player} ended turn`,
                },
            ],
        };
    },
};
//# sourceMappingURL=endTurn.js.map