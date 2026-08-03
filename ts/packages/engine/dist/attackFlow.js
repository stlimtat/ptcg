// Test-friendly card registry
let testCardRegistry = null;
export function setCardRegistry(registry) {
    testCardRegistry = registry;
}
export function resolveAttack(state, attacker, attackIndex) {
    const attackerPlayer = state.players[attacker];
    const defenderPlayer = state.players[attacker === "p1" ? "p2" : "p1"];
    if (!attackerPlayer.active || !defenderPlayer.active) {
        return state;
    }
    if (!testCardRegistry) {
        return state;
    }
    // Step 1: Get attack from card registry
    const attackerCardDef = testCardRegistry.get(attackerPlayer.active.card.cardId);
    if (!attackerCardDef || attackerCardDef.type !== "pokemon") {
        return state;
    }
    if (attackIndex < 0 || attackIndex >= attackerCardDef.attacks.length) {
        return state;
    }
    const attack = attackerCardDef.attacks[attackIndex];
    const defenderCardDef = testCardRegistry.get(defenderPlayer.active.card.cardId);
    // Step 2-5: Calculate damage
    let damage = attack.baseDamage;
    if (defenderCardDef && defenderCardDef.type === "pokemon") {
        // Apply weakness (multiply by 2)
        if (defenderCardDef.weakness &&
            attackerCardDef.types.includes(defenderCardDef.weakness.type)) {
            damage *= defenderCardDef.weakness.mult;
        }
        // Apply resistance (subtract 30)
        if (defenderCardDef.resistance &&
            attackerCardDef.types.includes(defenderCardDef.resistance.type)) {
            damage = Math.max(0, damage - defenderCardDef.resistance.reduce);
        }
    }
    let newState = state;
    // Step 3: Apply damage
    newState = {
        ...newState,
        players: {
            ...newState.players,
            [attacker === "p1" ? "p2" : "p1"]: {
                ...defenderPlayer,
                active: defenderPlayer.active
                    ? {
                        ...defenderPlayer.active,
                        damage: defenderPlayer.active.damage + damage,
                    }
                    : defenderPlayer.active,
            },
        },
    };
    // Step 4: Check for KO
    const updatedDefender = newState.players[attacker === "p1" ? "p2" : "p1"];
    if (updatedDefender.active && defenderCardDef && defenderCardDef.type === "pokemon") {
        if (updatedDefender.active.damage >= defenderCardDef.hp) {
            // KO: move active to discard
            newState = {
                ...newState,
                players: {
                    ...newState.players,
                    [attacker === "p1" ? "p2" : "p1"]: {
                        ...updatedDefender,
                        active: null,
                        discard: [...updatedDefender.discard, updatedDefender.active.card],
                    },
                },
            };
            // Step 5b: Award 1 prize card to attacker
            // The attacker takes one prize card from their own prize pile
            const awardPlayer = newState.players[attacker];
            if (awardPlayer.prizes.length > 0) {
                const remainingAttackerPrizes = awardPlayer.prizes.slice(1);
                newState = {
                    ...newState,
                    players: {
                        ...newState.players,
                        [attacker]: {
                            ...awardPlayer,
                            prizes: remainingAttackerPrizes,
                        },
                    },
                };
                // Step 6: Check for game over (attacker has collected all their prizes)
                if (remainingAttackerPrizes.length === 0) {
                    newState = {
                        ...newState,
                        phase: "gameOver",
                        winner: attacker,
                    };
                }
            }
        }
    }
    return newState;
}
//# sourceMappingURL=attackFlow.js.map