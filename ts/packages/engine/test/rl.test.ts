import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import { Card, Player } from "../src/types.js";
import { startGame } from "../src/state.js";
import { applyAction } from "../src/reducer.js";
import { legalActions } from "../src/legalActions.js";
import { encodeObservation, OBSERVATION_SIZE } from "../src/rl/observation.js";
import { actionSpace, encodeAction, ACTION_SPACE_SIZE } from "../src/rl/actionSpace.js";
import { runEpisode, seatToAct } from "../src/rl/episode.js";
import { randomPolicy, heuristicPolicy } from "../src/rl/policies.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = JSON.parse(fs.readFileSync(path.join(root, "data/cards.json"), "utf8"));
const registry: Record<string, Card> = Object.fromEntries(pool.cards.map((c: any) => [c.id, c]));
const deckOf = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(root, "data/decks", `${name}.json`), "utf8")).cards as string[];

const DECK_A = "lillie-s-clefairy-naic-2026-new-orleans-1st";
const DECK_B = "dragapult-dusknoir-naic-2026-new-orleans-2nd";
// A deck whose game plan the heuristic can actually execute, so the policy
// comparison is not swamped by how much of a deck the engine still ignores.
const DECK_GAUNTLET = "crustle-regional-indianapolis-in-2nd";

// Deterministic RNG so policy tie-breaks do not make tests flaky.
const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

describe("observation encoding", () => {
  it("is a fixed-length vector of finite numbers", () => {
    const state = startGame(deckOf(DECK_A), deckOf(DECK_B), registry, 1);
    const obs = encodeObservation(state, "p1");
    expect(obs).toHaveLength(OBSERVATION_SIZE);
    expect([...obs].every((v) => Number.isFinite(v))).toBe(true);
  });

  it("hides what a player is not allowed to see", () => {
    const state = startGame(deckOf(DECK_A), deckOf(DECK_B), registry, 2);

    // Swapping every hidden card for a different one must not move the vector:
    // opponent hand, both decks and both prize piles are all hidden.
    const tampered = structuredClone(state);
    const filler = state.players.p1.deck[0];
    tampered.players.p2.hand = tampered.players.p2.hand.map((c) => ({ ...c, cardId: filler.cardId }));
    tampered.players.p1.deck = tampered.players.p1.deck.map((c) => ({ ...c, cardId: filler.cardId }));
    tampered.players.p2.deck = tampered.players.p2.deck.map((c) => ({ ...c, cardId: filler.cardId }));
    tampered.players.p1.prizes = tampered.players.p1.prizes.map((c) => ({ ...c, cardId: filler.cardId }));
    tampered.players.p2.prizes = tampered.players.p2.prizes.map((c) => ({ ...c, cardId: filler.cardId }));

    expect([...encodeObservation(tampered, "p1")]).toEqual([...encodeObservation(state, "p1")]);
  });

  it("reacts to what a player can see", () => {
    const state = startGame(deckOf(DECK_A), deckOf(DECK_B), registry, 3);
    const changed = structuredClone(state);
    changed.players.p1.hand = changed.players.p1.hand.slice(1); // own hand is visible

    expect([...encodeObservation(changed, "p1")]).not.toEqual([...encodeObservation(state, "p1")]);
  });
});

describe("action space", () => {
  it("masks exactly the legal actions and round-trips them", () => {
    let state = startGame(deckOf(DECK_A), deckOf(DECK_B), registry, 4);

    for (let step = 0; step < 300 && state.phase !== "gameOver"; step++) {
      const seat = seatToAct(state) as Player;
      const legal = legalActions(state, seat);
      const space = actionSpace(state, seat);

      expect(space.mask).toHaveLength(ACTION_SPACE_SIZE);
      // Every legal action is either addressable or explicitly in overflow.
      expect(space.mask.reduce((a, b) => a + b, 0) + space.overflow.length).toBeGreaterThanOrEqual(
        new Set(legal.map((a) => encodeAction(state, a))).size
      );
      for (let i = 0; i < space.mask.length; i++) {
        if (!space.mask[i]) continue;
        const action = space.actions[i]!;
        // A masked-in index must decode to an action the rules accept.
        expect(legal.some((l) => JSON.stringify(l) === JSON.stringify(action))).toBe(true);
      }

      const first = space.mask.indexOf(1);
      state = applyAction(state, space.actions[first] ?? legal[0]);
    }
  });
});

describe("episodes", () => {
  it("plays to a terminal state and labels the reward from the winner's seat", () => {
    const result = runEpisode(deckOf(DECK_A), deckOf(DECK_B), registry, {
      p1: heuristicPolicy(seeded(11)),
      p2: heuristicPolicy(seeded(22)),
    }, { seed: 7 });

    expect(result.winner === "p1" || result.winner === "p2").toBe(true);
    expect(result.transitions.length).toBeGreaterThan(0);
    for (const t of result.transitions) {
      expect(t.reward).toBe(t.seat === result.winner ? 1 : -1);
      expect(t.mask[t.action]).toBe(1);
    }
  });

  it("replays identically for the same seed and policies", () => {
    const run = () =>
      runEpisode(deckOf(DECK_A), deckOf(DECK_B), registry, {
        p1: heuristicPolicy(seeded(5)),
        p2: heuristicPolicy(seeded(6)),
      }, { seed: 99, recordTransitions: false });

    const a = run();
    const b = run();
    expect([a.winner, a.turns, a.steps]).toEqual([b.winner, b.turns, b.steps]);
  });

  it("beats the random policy with the heuristic one", () => {
    let heuristicWins = 0;
    // 20 games cannot separate a 60% policy from a coin flip; this many can.
    const games = 60;
    for (let i = 0; i < games; i++) {
      // Alternate seats so going first is not what is being measured.
      const swap = i % 2 === 1;
      const result = runEpisode(deckOf(DECK_GAUNTLET), deckOf(DECK_GAUNTLET), registry, {
        p1: swap ? randomPolicy(seeded(i + 100)) : heuristicPolicy(seeded(i)),
        p2: swap ? heuristicPolicy(seeded(i)) : randomPolicy(seeded(i + 100)),
      }, { seed: i + 1, recordTransitions: false });

      const heuristicSeat: Player = swap ? "p2" : "p1";
      if (result.winner === heuristicSeat) heuristicWins++;
    }
    console.log(`heuristic vs random: ${heuristicWins}/${games}`);
    expect(heuristicWins).toBeGreaterThan(games / 2);
  }, 120000);
});
