import { GameState, Action, ActionHandler, Card, PokemonType } from "../types";

// Card registry lookup - set during testing to validate attacks
let testCardRegistry: Map<string, Card> | null = null;

export function setCardRegistry(registry: Map<string, Card> | null) {
  testCardRegistry = registry;
}

// Helper to check if energy matches attack cost
function hasEnoughEnergy(
  attachedEnergy: { cardId: string }[],
  attackCost: PokemonType[],
  registry: Map<string, Card> | null
): boolean {
  if (!registry) return true; // Can't validate without registry

  const energyTypes = attachedEnergy.map((e) => {
    const cardDef = registry.get(e.cardId);
    if (cardDef && cardDef.type === "energy") {
      return cardDef.providesType;
    }
    return null;
  });

  // For now, simple check: need at least as many energy as cost
  // Colorless energy can substitute for any type
  const colorlessAvailable = energyTypes.filter((t) => t === "any").length;
  const costByType: Record<string, number> = {};

  for (const type of attackCost) {
    costByType[type] = (costByType[type] || 0) + 1;
  }

  for (const [type, needed] of Object.entries(costByType)) {
    const available =
      energyTypes.filter((t) => t === type).length + colorlessAvailable;
    if (available < needed) return false;
  }

  return true;
}

export const attackHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "attack") return false;

    const typedAction = action as Extract<Action, { type: "attack" }>;

    // Only active player can attack during main phase
    if (action.player !== state.activePlayer) return false;
    if (state.phase !== "main") return false;

    const player = state.players[action.player];

    // Must have active Pokémon
    if (!player.active) return false;

    // Attack index must be valid
    const activeCard = player.active.card;
    if (!testCardRegistry) return true; // Can't validate without registry

    const cardDef = testCardRegistry.get(activeCard.cardId);
    if (!cardDef || cardDef.type !== "pokemon") return false;

    if (typedAction.attackIndex < 0 || typedAction.attackIndex >= cardDef.attacks.length) {
      return false;
    }

    const attack = cardDef.attacks[typedAction.attackIndex];

    // Check energy cost
    if (!hasEnoughEnergy(player.active.attachedEnergy, attack.cost, testCardRegistry)) {
      return false;
    }

    // Check status conditions
    if (player.active.statusConditions.includes("Paralyzed")) return false;
    if (player.active.statusConditions.includes("Asleep")) return false;

    return true;
  },

  apply(state: GameState, action: Action): GameState {
    const typedAction = action as Extract<Action, { type: "attack" }>;
    const attacker = state.players[action.player];
    const defender = state.players[action.player === "p1" ? "p2" : "p1"];

    if (!testCardRegistry || !attacker.active || !defender.active) {
      return state;
    }

    const attackerCard = testCardRegistry.get(attacker.active.card.cardId);
    if (!attackerCard || attackerCard.type !== "pokemon") return state;

    const attack = attackerCard.attacks[typedAction.attackIndex];

    // Check for Confused status (50% chance to fail)
    if (attacker.active.statusConditions.includes("Confused")) {
      // For now, simple implementation: always succeed (TODO: coin flip in phase 16)
      // This is where we'd add actual coin flip logic
    }

    // Calculate damage
    let damage = attack.baseDamage;

    // TODO: Apply attack effects (phase 16)
    // For now, just apply base damage

    return {
      ...state,
      players: {
        ...state.players,
        [action.player === "p1" ? "p2" : "p1"]: {
          ...defender,
          active: defender.active
            ? {
                ...defender.active,
                damage: defender.active.damage + damage,
              }
            : defender.active,
        },
      },
      log: [
        ...state.log,
        {
          timestamp: Date.now(),
          player: action.player,
          message: `${action.player} attacked for ${damage} damage`,
        },
      ],
    };
  },
};
