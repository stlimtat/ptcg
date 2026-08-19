import { Card, CardInstance, GameState } from "./types.js";
import { nextRandom } from "./cardLookup.js";

type Player = "p1" | "p2";

function emptyPlayer(deck: CardInstance[]) {
  return {
    deck,
    hand: [] as CardInstance[],
    discard: [] as CardInstance[],
    prizes: [] as CardInstance[],
    active: null,
    bench: [],
    energyAttachedThisTurn: false,
    supporterPlayedThisTurn: false,
    hasDrawnThisTurn: false,
    attackedThisTurn: false,
    retreatedThisTurn: false,
  };
}

// Instance ids are positional rather than random so a seeded game replays exactly.
const toInstances = (cardIds: string[], player: Player): CardInstance[] =>
  cardIds.map((cardId, i) => ({ id: `${player}-${i}`, cardId, instanceId: `${player}-${i}` }));

function shuffle<T>(array: T[], rng: () => number): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createInitialState(
  p1DeckCardIds: string[],
  p2DeckCardIds: string[],
  seed?: number
): GameState {
  let state = { rngSeed: seed } as GameState;
  const rng = () => {
    const [value, next] = nextRandom(state);
    state = next;
    return value;
  };

  return {
    turn: 1,
    activePlayer: "p1",
    phase: "setup",
    players: {
      p1: emptyPlayer(shuffle(toInstances(p1DeckCardIds, "p1"), rng)),
      p2: emptyPlayer(shuffle(toInstances(p2DeckCardIds, "p2"), rng)),
    },
    log: [],
    rngSeed: state.rngSeed,
  };
}

const isBasic = (registry: Record<string, Card>, cardId: string) => {
  const def = registry[cardId];
  return def?.type === "pokemon" && def.stage === 0;
};

/**
 * Deal opening hands (mulliganing hands with no Basic Pokémon), set prizes, and
 * leave both players owing a promotion. This is the headless entry point: play
 * proceeds entirely through legalActions/applyAction from here.
 *
 * ponytail: bench placement during setup is skipped — a player can bench on
 * their first turn instead. Add it if opening-board decisions start mattering.
 */
export function startGame(
  p1DeckCardIds: string[],
  p2DeckCardIds: string[],
  cardRegistry: Record<string, Card>,
  seed?: number
): GameState {
  let state: GameState = { ...createInitialState(p1DeckCardIds, p2DeckCardIds, seed), cardRegistry };
  const rng = () => {
    const [value, next] = nextRandom(state);
    state = next;
    return value;
  };

  const mulligans: Record<Player, number> = { p1: 0, p2: 0 };

  for (const player of ["p1", "p2"] as Player[]) {
    let deck = state.players[player].deck;
    let hand = deck.slice(0, 7);
    // Redraw until the opening hand holds at least one Basic Pokémon.
    while (!hand.some((c) => isBasic(cardRegistry, c.cardId)) && mulligans[player] < 20) {
      mulligans[player]++;
      deck = shuffle(deck, rng);
      hand = deck.slice(0, 7);
    }
    deck = deck.slice(7);

    state = {
      ...state,
      players: {
        ...state.players,
        [player]: { ...state.players[player], hand, deck: deck.slice(6), prizes: deck.slice(0, 6) },
      },
    };
  }

  // Each mulligan lets the opponent draw one extra card.
  for (const player of ["p1", "p2"] as Player[]) {
    const opponent: Player = player === "p1" ? "p2" : "p1";
    const extra = mulligans[opponent];
    if (!extra) continue;
    const ps = state.players[player];
    state = {
      ...state,
      players: {
        ...state.players,
        [player]: { ...ps, hand: [...ps.hand, ...ps.deck.slice(0, extra)], deck: ps.deck.slice(extra) },
      },
    };
  }

  return {
    ...state,
    pendingPromote: ["p1", "p2"],
    log: [
      ...state.log,
      { timestamp: Date.now(), player: "p1", message: `Game start (mulligans p1:${mulligans.p1} p2:${mulligans.p2})` },
    ],
  };
}
