import { describe, it, expect } from "vitest";
import { applyAction } from "../src/reducer";
import { createInitialState } from "../src/state";

describe("EndTurn action", () => {
  it("advances to next player", () => {
    const state = createInitialState(["card-1"], ["card-2"]);
    const newState = applyAction(state, {
      type: "endTurn",
      player: "p1",
    });

    expect(newState.activePlayer).toBe("p2");
  });

  it("increments turn counter when p2 ends turn", () => {
    let state = createInitialState(["card-1"], ["card-2"]);
    state = applyAction(state, { type: "endTurn", player: "p1" });
    state = applyAction(state, { type: "endTurn", player: "p2" });

    expect(state.turn).toBe(2);
  });

  it("resets per-turn flags", () => {
    let state = createInitialState(["card-1"], ["card-2"]);
    state.players.p1.energyAttachedThisTurn = true;
    state.players.p1.supporterPlayedThisTurn = true;

    state = applyAction(state, { type: "endTurn", player: "p1" });

    expect(state.players.p1.energyAttachedThisTurn).toBe(false);
    expect(state.players.p1.supporterPlayedThisTurn).toBe(false);
  });

  it("requires action from active player", () => {
    const state = createInitialState(["card-1"], ["card-2"]);

    expect(() =>
      applyAction(state, { type: "endTurn", player: "p2" })
    ).toThrow();
  });
});
