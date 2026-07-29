import { GameState, Card } from "./types";

// Test-friendly card registry
let testCardRegistry: Map<string, Card> | null = null;

export function setCardRegistry(registry: Map<string, Card> | null) {
  testCardRegistry = registry;
}

export function resolveAttack(
  state: GameState,
  attacker: "p1" | "p2",
  attackIndex: number
): GameState {
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
    if (
      defenderCardDef.weakness &&
      attackerCardDef.types.includes(defenderCardDef.weakness.type)
    ) {
      damage *= defenderCardDef.weakness.mult;
    }

    // Apply resistance (subtract 30)
    if (
      defenderCardDef.resistance &&
      attackerCardDef.types.includes(defenderCardDef.resistance.type)
    ) {
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

      // Step 5b: Award 1 prize card to attacker from defender
      const defenderName = attacker === "p1" ? "p2" : "p1";
      const defenderUpdated = newState.players[defenderName];
      const awardPlayer = newState.players[attacker];

      if (defenderUpdated.prizes.length > 0) {
        const prizeTaken = defenderUpdated.prizes[0];
        const remainingDefenderPrizes = defenderUpdated.prizes.slice(1);

        newState = {
          ...newState,
          players: {
            ...newState.players,
            [attacker]: {
              ...awardPlayer,
              prizes: [...awardPlayer.prizes, prizeTaken],
            },
            [defenderName]: {
              ...defenderUpdated,
              prizes: remainingDefenderPrizes,
            },
          },
        };

        // Step 6: Check for game over (defender has no prizes left)
        if (remainingDefenderPrizes.length === 0) {
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
