import { describe, it, expect } from "vitest";
import { createInitialState } from "../src/state";

describe("Game state", () => {
  it("creates initial state for two players", () => {
    const state = createInitialState(
      ["card-dragapult-ex"],
      ["card-zoroark-ex"]
    );

    expect(state.turn).toBe(1);
    expect(state.activePlayer).toBe("p1");
    expect(state.phase).toBe("setup");
    expect(state.players.p1.hand).toHaveLength(0);
    expect(state.players.p2.hand).toHaveLength(0);
    expect(state.players.p1.deck).toHaveLength(1);
    expect(state.players.p2.deck).toHaveLength(1);
    expect(state.log).toHaveLength(0);
  });

  it("sets shuffled decks", () => {
    const p1Deck = Array.from({ length: 60 }, (_, i) => `p1-card-${i}`);
    const p2Deck = Array.from({ length: 60 }, (_, i) => `p2-card-${i}`);
    const state = createInitialState(p1Deck, p2Deck);

    expect(state.players.p1.deck).toHaveLength(60);
    expect(state.players.p2.deck).toHaveLength(60);
  });
});
