import { GameState } from "../types";

export const trainerEffects: Record<string, (state: GameState, player: "p1" | "p2") => GameState> = {
  // Draw trainers
  "Arven": (state, player) => {
    const newState = { ...state };
    const playerState = newState.players[player];
    const drawn = playerState.deck.splice(0, 1);
    playerState.hand.push(...drawn);
    return newState;
  },

  "Jacq": (state, player) => {
    const newState = { ...state };
    const playerState = newState.players[player];
    const drawn = playerState.deck.splice(0, 2);
    playerState.hand.push(...drawn);
    return newState;
  },

  "Energy Retrieval": (state, player) => {
    const newState = { ...state };
    const playerState = newState.players[player];
    const energyInDiscard = playerState.discard.filter(
      c => c && state.cardRegistry && state.cardRegistry[c.cardId]?.type === "energy"
    );
    if (energyInDiscard.length > 0) {
      const energy = energyInDiscard[0];
      playerState.discard = playerState.discard.filter(c => c !== energy);
      playerState.hand.push(energy);
    }
    return newState;
  },

  "Energy Search": (state, player) => {
    const newState = { ...state };
    const playerState = newState.players[player];
    const energyInDeck = playerState.deck.filter(
      c => c && state.cardRegistry && state.cardRegistry[c.cardId]?.type === "energy"
    );
    if (energyInDeck.length > 0) {
      const idx = playerState.deck.indexOf(energyInDeck[0]);
      const energy = playerState.deck.splice(idx, 1)[0];
      playerState.hand.push(energy);
    }
    return newState;
  },

  "Crushing Hammer": (state, player) => {
    const newState = { ...state };
    const opponent = player === "p1" ? "p2" : "p1";
    const opponentState = newState.players[opponent];
    if (
      opponentState.active?.attachedEnergy &&
      opponentState.active.attachedEnergy.length > 0
    ) {
      const idx = Math.floor(Math.random() * opponentState.active.attachedEnergy.length);
      opponentState.active.attachedEnergy.splice(idx, 1);
    }
    return newState;
  },

  "Energy Switch": (state, player) => {
    const newState = { ...state };
    const playerState = newState.players[player];
    if (
      playerState.active?.attachedEnergy &&
      playerState.active.attachedEnergy.length > 0 &&
      playerState.bench.length > 0
    ) {
      const idx = Math.floor(Math.random() * playerState.active.attachedEnergy.length);
      const energy = playerState.active.attachedEnergy.splice(idx, 1)[0];
      const benchIdx = Math.floor(Math.random() * playerState.bench.length);
      if (!playerState.bench[benchIdx].attachedEnergy) {
        playerState.bench[benchIdx].attachedEnergy = [];
      }
      playerState.bench[benchIdx].attachedEnergy.push(energy);
    }
    return newState;
  },
};

export function applyTrainerEffect(
  state: GameState,
  trainerName: string,
  player: "p1" | "p2"
): GameState {
  const effect = trainerEffects[trainerName];
  if (effect) {
    return effect(state, player);
  }
  return state;
}
