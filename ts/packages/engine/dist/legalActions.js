import { actionRegistry } from "./actions/index.js";
import { usableAbilities } from "./effects/abilities.js";
export function legalActions(state, player) {
    if (state.phase === "gameOver")
        return [];
    const playerState = state.players[player];
    const promoteHandler = actionRegistry.get("promote");
    // A card effect waiting on a decision: the only move is to answer it.
    const choice = state.pendingChoice;
    if (choice) {
        if (choice.player !== player)
            return [];
        const answers = choice.options.map((instanceId) => ({ type: "choose", player, instanceId }));
        // Optional choices can be stopped early / declined.
        if (choice.optional)
            answers.push({ type: "choose", player });
        return answers;
    }
    // A player who owes a promotion acts out of turn, and does nothing else until
    // an Active Pokémon is back in place.
    if (state.pendingPromote?.length) {
        if (!state.pendingPromote.includes(player) || !promoteHandler)
            return [];
        const sources = state.phase === "setup" ? playerState.hand : playerState.bench.map((p) => p.card);
        return sources
            .map((card) => ({ type: "promote", player, instanceId: card.instanceId }))
            .filter((a) => promoteHandler.isLegal(state, a));
    }
    // Only active player can take actions
    if (player !== state.activePlayer)
        return [];
    // Attacking ends the turn: nothing but endTurn remains.
    if (playerState.attackedThisTurn) {
        const endTurn = { type: "endTurn", player };
        return actionRegistry.get("endTurn")?.isLegal(state, endTurn) ? [endTurn] : [];
    }
    const legal = [];
    // Draw phase: must draw card at start of turn (before other actions)
    if (!playerState.hasDrawnThisTurn && state.phase === "main") {
        const drawAction = { type: "drawCard", player };
        const drawHandler = actionRegistry.get("drawCard");
        if (drawHandler && drawHandler.isLegal(state, drawAction)) {
            legal.push(drawAction);
            // In real TCG, you MUST draw before any other actions
            return legal;
        }
    }
    // Always: endTurn
    const endTurnAction = { type: "endTurn", player };
    const endTurnHandler = actionRegistry.get("endTurn");
    if (endTurnHandler && endTurnHandler.isLegal(state, endTurnAction)) {
        legal.push(endTurnAction);
    }
    // playPokemon: enumerate cards in hand
    const playPokemonHandler = actionRegistry.get("playPokemon");
    if (playPokemonHandler) {
        for (const card of playerState.hand) {
            const action = { type: "playPokemon", player, cardId: card.cardId };
            if (playPokemonHandler.isLegal(state, action)) {
                legal.push(action);
            }
        }
    }
    // evolve: enumerate cards in hand that can evolve targets in play
    const evolveHandler = actionRegistry.get("evolve");
    if (evolveHandler) {
        for (const card of playerState.hand) {
            // Try to evolve active
            if (playerState.active) {
                const action = {
                    type: "evolve",
                    player,
                    targetInstanceId: playerState.active.card.instanceId,
                    cardId: card.cardId,
                };
                if (evolveHandler.isLegal(state, action)) {
                    legal.push(action);
                }
            }
            // Try to evolve each bench Pokémon
            for (const benchPoke of playerState.bench) {
                const action = {
                    type: "evolve",
                    player,
                    targetInstanceId: benchPoke.card.instanceId,
                    cardId: card.cardId,
                };
                if (evolveHandler.isLegal(state, action)) {
                    legal.push(action);
                }
            }
        }
    }
    // attachEnergy: enumerate energy cards in hand and targets
    const attachEnergyHandler = actionRegistry.get("attachEnergy");
    if (attachEnergyHandler) {
        for (const card of playerState.hand) {
            // Skip non-energy cards if registry available
            if (state.cardRegistry) {
                const cardDef = state.cardRegistry[card.cardId];
                if (!cardDef || cardDef.type !== "energy")
                    continue;
            }
            // Try to attach to active
            if (playerState.active) {
                const action = {
                    type: "attachEnergy",
                    player,
                    energyCardId: card.cardId,
                    targetInstanceId: playerState.active.card.instanceId,
                };
                if (attachEnergyHandler.isLegal(state, action)) {
                    legal.push(action);
                }
            }
            // Try to attach to each bench Pokémon
            for (const benchPoke of playerState.bench) {
                const action = {
                    type: "attachEnergy",
                    player,
                    energyCardId: card.cardId,
                    targetInstanceId: benchPoke.card.instanceId,
                };
                if (attachEnergyHandler.isLegal(state, action)) {
                    legal.push(action);
                }
            }
        }
    }
    // playTrainer: enumerate trainer cards in hand. Tools need a target Pokémon,
    // so they get one action per attachable Pokémon.
    const playTrainerHandler = actionRegistry.get("playTrainer");
    if (playTrainerHandler) {
        const targets = [playerState.active, ...playerState.bench].filter((p) => p);
        for (const card of playerState.hand) {
            const def = state.cardRegistry?.[card.cardId];
            const isTool = def?.type === "trainer" && def.subtype === "tool";
            const candidates = isTool
                ? targets.map((p) => ({ type: "playTrainer", player, cardId: card.cardId, targetInstanceId: p.card.instanceId }))
                : [{ type: "playTrainer", player, cardId: card.cardId }];
            for (const action of candidates) {
                if (playTrainerHandler.isLegal(state, action))
                    legal.push(action);
            }
        }
    }
    // retreat: enumerate bench Pokémon that can be switched in
    const retreatHandler = actionRegistry.get("retreat");
    if (retreatHandler) {
        for (const benchPoke of playerState.bench) {
            const action = {
                type: "retreat",
                player,
                benchInstanceId: benchPoke.card.instanceId,
            };
            if (retreatHandler.isLegal(state, action)) {
                legal.push(action);
            }
        }
    }
    // useAbility: enumerate activated abilities on every Pokémon in play
    const useAbilityHandler = actionRegistry.get("useAbility");
    if (useAbilityHandler) {
        for (const poke of [playerState.active, ...playerState.bench]) {
            if (!poke)
                continue;
            for (const abilityName of usableAbilities(state, player, poke)) {
                const action = { type: "useAbility", player, instanceId: poke.card.instanceId, abilityName };
                if (useAbilityHandler.isLegal(state, action))
                    legal.push(action);
            }
        }
    }
    // attack: enumerate attacks from active Pokémon (no specific targets yet)
    const attackHandler = actionRegistry.get("attack");
    if (attackHandler && playerState.active) {
        // ponytail: simplified - enumerate attack indices 0-2 (typical Pokémon have 1-2 attacks)
        for (let attackIndex = 0; attackIndex < 3; attackIndex++) {
            const action = {
                type: "attack",
                player,
                attackIndex,
            };
            if (attackHandler.isLegal(state, action)) {
                legal.push(action);
            }
        }
    }
    return legal;
}
//# sourceMappingURL=legalActions.js.map