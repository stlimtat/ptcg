/// <reference lib="dom" />
import { GameState } from "../types";

function drawCards(state: GameState, player: "p1" | "p2", count: number): GameState {
  const newState = { ...state };
  const playerState = newState.players[player];
  const drawn = playerState.deck.splice(0, count);
  playerState.hand.push(...drawn);
  return newState;
}

function searchDeckForType(
  state: GameState,
  player: "p1" | "p2",
  cardType: string,
  count: number = 1
): GameState {
  const newState = { ...state };
  const playerState = newState.players[player];
  const matching = playerState.deck.filter(
    c => c && state.cardRegistry && state.cardRegistry[c.cardId]?.type === cardType
  );

  for (let i = 0; i < Math.min(count, matching.length); i++) {
    const idx = playerState.deck.indexOf(matching[i]);
    const card = playerState.deck.splice(idx, 1)[0];
    playerState.hand.push(card);
  }

  return newState;
}

function switchActiveBench(state: GameState, player: "p1" | "p2"): GameState {
  const newState = { ...state };
  const playerState = newState.players[player];

  if (playerState.active && playerState.bench.length > 0) {
    const idx = Math.floor(Math.random() * playerState.bench.length);
    const temp = playerState.active;
    playerState.active = playerState.bench[idx];
    playerState.bench[idx] = temp;
  }
  return newState;
}

function drawFromDiscard(state: GameState, player: "p1" | "p2", cardType?: string): GameState {
  const newState = { ...state };
  const playerState = newState.players[player];

  const candidates = cardType
    ? playerState.discard.filter(c => state.cardRegistry?.[c.cardId]?.type === cardType)
    : playerState.discard;

  if (candidates.length > 0) {
    const card = candidates[0];
    playerState.discard = playerState.discard.filter(c => c !== card);
    playerState.hand.push(card);
  }
  return newState;
}

export const trainerEffects: Record<string, (state: GameState, player: "p1" | "p2") => GameState> = {
  // Supporters that draw
  "Arven": (state, player) => drawCards(state, player, 1),
  "Jacq": (state, player) => drawCards(state, player, 2),
  "Judge": (state, player) => drawCards(state, player, 1),
  "Iono": (state, player) => drawCards(state, player, 1),
  "Katy": (state, player) => drawCards(state, player, 1),
  "Brassius": (state, player) => drawCards(state, player, 1),
  "Clavell": (state, player) => drawCards(state, player, 2),
  "Dendra": (state, player) => drawCards(state, player, 1),
  "Falkner": (state, player) => drawCards(state, player, 1),
  "Geeta": (state, player) => drawCards(state, player, 2),
  "Giacomo": (state, player) => drawCards(state, player, 1),
  "Grusha": (state, player) => drawCards(state, player, 1),
  "Miriam": (state, player) => drawCards(state, player, 2),
  "Nemona": (state, player) => drawCards(state, player, 2),
  "Ortega": (state, player) => drawCards(state, player, 1),
  "Penny": (state, player) => drawCards(state, player, 1),
  "Poppy": (state, player) => drawCards(state, player, 1),
  "Professor's Research (Professor Sada)": (state, player) => drawCards(state, player, 3),
  "Professor's Research (Professor Turo)": (state, player) => drawCards(state, player, 3),
  "Ryme": (state, player) => drawCards(state, player, 1),
  "Saguaro": (state, player) => drawCards(state, player, 1),
  "Team Star Grunt": (state, player) => drawCards(state, player, 1),
  "Youngster": (state, player) => drawCards(state, player, 1),

  // Item search trainers
  "Artazon": (state, player) => searchDeckForType(state, player, "trainer", 1),
  "Great Ball": (state, player) => searchDeckForType(state, player, "pokemon", 1),
  "Nest Ball": (state, player) => searchDeckForType(state, player, "pokemon", 1),
  "Poké Ball": (state, player) => searchDeckForType(state, player, "pokemon", 1),
  "Ultra Ball": (state, player) => searchDeckForType(state, player, "pokemon", 1),
  "Pokégear 3.0": (state, player) => drawCards(state, player, 1),

  // Energy retrieval
  "Energy Retrieval": (state, player) => drawFromDiscard(state, player, "energy"),
  "Superior Energy Retrieval": (state, player) => drawFromDiscard(state, player, "energy"),
  "Energy Search": (state, player) => searchDeckForType(state, player, "energy", 1),
  "Electric Generator": (state, player) => searchDeckForType(state, player, "energy", 1),

  // Energy switch
  "Energy Switch": (state, player) => {
    const newState = { ...state };
    const playerState = newState.players[player];
    if (playerState.active?.attachedEnergy && playerState.active.attachedEnergy.length > 0 && playerState.bench.length > 0) {
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

  // Disruption
  "Crushing Hammer": (state, player) => {
    const newState = { ...state };
    const opponent = player === "p1" ? "p2" : "p1";
    const opponentState = newState.players[opponent];
    if (opponentState.active?.attachedEnergy && opponentState.active.attachedEnergy.length > 0) {
      const idx = Math.floor(Math.random() * opponentState.active.attachedEnergy.length);
      opponentState.active.attachedEnergy.splice(idx, 1);
    }
    return newState;
  },

  "Pokémon Catcher": (state, player) => switchActiveBench(state, player === "p1" ? "p2" : "p1"),
  "Switch": (state, player) => switchActiveBench(state, player),
  "Potion": (state, player) => {
    const newState = { ...state };
    const playerState = newState.players[player];
    if (playerState.active) {
      playerState.active.damage = Math.max(0, playerState.active.damage - 20);
    }
    return newState;
  },

  // Recursion
  "Super Rod": (state, player) => {
    const newState = { ...state };
    const playerState = newState.players[player];
    const pokemon = playerState.discard.filter(c => state.cardRegistry?.[c.cardId]?.type === "pokemon");
    for (let i = 0; i < Math.min(2, pokemon.length); i++) {
      const idx = playerState.discard.indexOf(pokemon[i]);
      const card = playerState.discard.splice(idx, 1)[0];
      playerState.deck.push(card);
    }
    return newState;
  },

  "Pal Pad": (state, player) => {
    const newState = { ...state };
    const playerState = newState.players[player];
    const supporters = playerState.discard.filter(
      c => state.cardRegistry?.[c.cardId]?.type === "trainer"
    );
    for (let i = 0; i < Math.min(2, supporters.length); i++) {
      const idx = playerState.discard.indexOf(supporters[i]);
      const card = playerState.discard.splice(idx, 1)[0];
      playerState.hand.push(card);
    }
    return newState;
  },

  // Rare Candy evolution
  "Rare Candy": (state, player) => {
    // Stage 1/2 search from deck - simplified to just draw
    return drawCards(state, player, 1);
  },

  // Tools/Stadium effects (simplified - most need continuous effects)
  "Choice Belt": (state, player) => state,
  "Defiance Band": (state, player) => state,
  "Exp. Share": (state, player) => state,
  "Bravery Charm": (state, player) => state,
  "Fighting Au Lait": (state, player) => state,
  "Rock Chestplate": (state, player) => state,
  "Rocky Helmet": (state, player) => state,
  "Vitality Band": (state, player) => state,
  "Patrol Cap": (state, player) => state,
  "Picnic Basket": (state, player) => state,
  "Luminous Energy": (state, player) => state,

  // Stadiums (continuous effects not fully supported yet)
  "Beach Court": (state, player) => state,
  "Calamitous Snowy Mountain": (state, player) => state,
  "Calamitous Wasteland": (state, player) => state,
  "Mesagoza": (state, player) => state,
  "Pokémon League Headquarters": (state, player) => state,
  "Practice Studio": (state, player) => state,
  "Town Store": (state, player) => state,

  // Other
  "Letter of Encouragement": (state, player) => drawCards(state, player, 1),
  "Vengeful Punch": (state, player) => state,
  "Delivery Drone": (state, player) => drawCards(state, player, 1),

  // Energy (shouldn't be trainers but are in card pool)
  "Basic Fighting Energy": (state, player) => state,
  "Basic Fire Energy": (state, player) => state,
  "Basic Grass Energy": (state, player) => state,
  "Basic Lightning Energy": (state, player) => state,
  "Basic Water Energy": (state, player) => state,
  "Reversal Energy": (state, player) => state,
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
