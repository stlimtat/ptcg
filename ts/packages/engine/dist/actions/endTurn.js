import { flipCoin } from "../cardLookup.js";
import { applyDamage } from "../attackFlow.js";
/**
 * Pokémon Checkup, run between turns: poison and burn damage, then coin flips
 * to shake off Asleep and Burned. Paralysis always wears off.
 */
function checkup(state, player) {
    const active = state.players[player].active;
    if (!active)
        return state;
    let next = state;
    let conditions = [...active.statusConditions];
    if (conditions.includes("Poisoned")) {
        next = applyDamage(next, player, 10, null);
        if (!next.players[player].active)
            return next; // knocked out by poison
    }
    if (conditions.includes("Burned")) {
        next = applyDamage(next, player, 20, null);
        if (!next.players[player].active)
            return next;
        const [heads, afterFlip] = flipCoin(next);
        next = afterFlip;
        if (heads)
            conditions = conditions.filter((c) => c !== "Burned");
    }
    if (conditions.includes("Asleep")) {
        const [heads, afterFlip] = flipCoin(next);
        next = afterFlip;
        if (heads)
            conditions = conditions.filter((c) => c !== "Asleep");
    }
    conditions = conditions.filter((c) => c !== "Paralyzed");
    const current = next.players[player].active;
    return {
        ...next,
        players: {
            ...next.players,
            [player]: { ...next.players[player], active: { ...current, statusConditions: conditions } },
        },
    };
}
export const endTurnHandler = {
    isLegal(state, action) {
        if (action.type !== "endTurn")
            return false;
        if (state.phase === "gameOver")
            return false;
        // Knockouts must be resolved before the turn can pass.
        if (state.pendingPromote?.length)
            return false;
        if (state.pendingChoice)
            return false;
        return action.player === state.activePlayer;
    },
    apply(state, action) {
        const player = action.player;
        const otherPlayer = player === "p1" ? "p2" : "p1";
        const newTurn = player === "p2" ? state.turn + 1 : state.turn;
        let next = checkup(state, player);
        if (next.phase === "gameOver")
            return next;
        next = {
            ...next,
            turn: newTurn,
            activePlayer: otherPlayer,
            // "During your opponent's next turn" restrictions end with that turn.
            ongoing: (next.ongoing ?? []).filter((e) => e.appliesTo !== player),
            players: {
                ...next.players,
                [player]: {
                    ...next.players[player],
                    energyAttachedThisTurn: false,
                    supporterPlayedThisTurn: false,
                    hasDrawnThisTurn: false,
                    attackedThisTurn: false,
                    retreatedThisTurn: false,
                    stadiumPlayedThisTurn: false,
                    abilitiesUsedThisTurn: [],
                    // The knockout window this flag records has now passed.
                    koedLastTurn: false,
                },
            },
            log: [
                ...next.log,
                { timestamp: Date.now(), player, message: `${player} ended turn` },
            ],
        };
        // A player who cannot draw at the start of their turn loses.
        if (next.players[otherPlayer].deck.length === 0) {
            return {
                ...next,
                phase: "gameOver",
                winner: player,
                log: [
                    ...next.log,
                    { timestamp: Date.now(), player: otherPlayer, message: `${otherPlayer} decked out` },
                ],
            };
        }
        return next;
    },
};
//# sourceMappingURL=endTurn.js.map