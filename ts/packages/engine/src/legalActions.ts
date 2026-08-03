import { GameState, Action } from "./types";
import { actionRegistry } from "./actions";

export function legalActions(
  state: GameState,
  player: "p1" | "p2"
): Action[] {
  // Only active player can take actions
  if (player !== state.activePlayer) return [];

  const legal: Action[] = [];
  const playerState = state.players[player];

  // Draw phase: must draw card at start of turn (before other actions)
  if (!playerState.hasDrawnThisTurn && state.phase === "main") {
    const drawAction = { type: "drawCard", player } as any;
    const drawHandler = actionRegistry.get("drawCard");
    if (drawHandler && drawHandler.isLegal(state, drawAction)) {
      legal.push(drawAction);
      // In real TCG, you MUST draw before any other actions
      return legal;
    }
  }

  // Always: endTurn
  const endTurnAction = { type: "endTurn", player } as any;
  const endTurnHandler = actionRegistry.get("endTurn");
  if (endTurnHandler && endTurnHandler.isLegal(state, endTurnAction)) {
    legal.push(endTurnAction);
  }

  // playPokemon: enumerate cards in hand
  const playPokemonHandler = actionRegistry.get("playPokemon");
  if (playPokemonHandler) {
    for (const card of playerState.hand) {
      const action = { type: "playPokemon", player, cardId: card.cardId } as any;
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
        } as any;
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
        } as any;
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
        if (!cardDef || cardDef.type !== "energy") continue;
      }

      // Try to attach to active
      if (playerState.active) {
        const action = {
          type: "attachEnergy",
          player,
          energyCardId: card.cardId,
          targetInstanceId: playerState.active.card.instanceId,
        } as any;
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
        } as any;
        if (attachEnergyHandler.isLegal(state, action)) {
          legal.push(action);
        }
      }
    }
  }

  // playTrainer: enumerate trainer cards in hand
  const playTrainerHandler = actionRegistry.get("playTrainer");
  if (playTrainerHandler) {
    for (const card of playerState.hand) {
      const action = { type: "playTrainer", player, cardId: card.cardId } as any;
      if (playTrainerHandler.isLegal(state, action)) {
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
      } as any;
      if (retreatHandler.isLegal(state, action)) {
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
      } as any;
      if (attackHandler.isLegal(state, action)) {
        legal.push(action);
      }
    }
  }

  return legal;
}
