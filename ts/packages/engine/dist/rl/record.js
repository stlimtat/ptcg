const nameOf = (registry, cardId) => registry[cardId]?.name ?? cardId;
function snapshotPokemon(registry, poke) {
    if (!poke)
        return null;
    const def = registry[poke.card.cardId];
    return {
        card: poke.card.cardId,
        name: def?.name ?? poke.card.cardId,
        damage: poke.damage,
        hp: def?.type === "pokemon" ? def.hp : 0,
        energy: poke.attachedEnergy.map((e) => nameOf(registry, e.cardId)),
        tools: poke.attachedTools.map((t) => nameOf(registry, t.cardId)),
        status: [...poke.statusConditions],
    };
}
function snapshotSide(registry, state, seat) {
    const ps = state.players[seat];
    return {
        active: snapshotPokemon(registry, ps.active),
        bench: ps.bench.map((p) => snapshotPokemon(registry, p)),
        handCount: ps.hand.length,
        hand: ps.hand.map((c) => nameOf(registry, c.cardId)),
        deckCount: ps.deck.length,
        discardCount: ps.discard.length,
        prizeCount: ps.prizes.length,
    };
}
/** Everything about a position that is worth reading back later. */
export function snapshotBoard(state, registry) {
    const reg = registry ?? state.cardRegistry ?? {};
    return {
        turn: state.turn,
        phase: state.phase,
        activePlayer: state.activePlayer,
        stadium: state.stadium ? nameOf(reg, state.stadium.cardId) : null,
        pendingChoice: state.pendingChoice
            ? {
                player: state.pendingChoice.player,
                prompt: state.pendingChoice.prompt,
                optionCount: state.pendingChoice.options.length,
            }
            : null,
        pendingPromote: [...(state.pendingPromote ?? [])],
        p1: snapshotSide(reg, state, "p1"),
        p2: snapshotSide(reg, state, "p2"),
    };
}
/**
 * Re-run a record's actions against a fresh game and report where — if anywhere —
 * the replay diverges from what was recorded. An empty list means the record
 * reproduces exactly.
 */
export function replayRecord(record, registry, startGame, applyAction) {
    let state = startGame(record.decks.p1, record.decks.p2, registry, record.seed);
    const divergences = [];
    for (const step of record.steps) {
        try {
            state = applyAction(state, step.action);
        }
        catch (error) {
            divergences.push(`step ${step.step}: action rejected on replay (${error.message})`);
            break;
        }
        const replayed = snapshotBoard(state, registry);
        if (JSON.stringify(replayed) !== JSON.stringify(step.board)) {
            divergences.push(`step ${step.step}: board differs after ${step.action.type}`);
        }
    }
    return { divergences, finalState: state };
}
/** One line per step, in the same shape replay.mjs prints. */
export function formatRecord(record) {
    const lines = [];
    const p1 = record.deckNames?.p1 ?? "p1";
    const p2 = record.deckNames?.p2 ?? "p2";
    lines.push(`${p1} (p1) vs ${p2} (p2), seed ${record.seed ?? "unseeded"}`);
    let turn = -1;
    for (const step of record.steps) {
        if (step.turn !== turn) {
            turn = step.turn;
            lines.push(`── turn ${turn} ${"─".repeat(40)}`);
        }
        lines.push(`${String(step.step).padStart(4)} ${step.seat}  ${step.action.type}  (${step.legalCount} legal)`);
        for (const entry of step.log)
            lines.push(`       → ${entry}`);
    }
    lines.push(`result: ${record.winner ?? "unfinished"} — ${record.reason} (turn ${record.turns})`);
    return lines.join("\n");
}
//# sourceMappingURL=record.js.map