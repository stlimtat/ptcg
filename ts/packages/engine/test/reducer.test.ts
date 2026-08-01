import { describe, it, expect } from "vitest";
import { applyAction } from "../src/reducer";
import { createInitialState } from "../src/state";

describe("Reducer", () => {
  it("throws on unknown action type", () => {
    const state = createInitialState(["card-1"], ["card-2"]);
    const action = { type: "unknown" } as any;

    expect(() => applyAction(state, action)).toThrow("Unknown action type");
  });

  it("delegates to action handler for known type", () => {
    const state = createInitialState(["card-1"], ["card-2"]);
    const action = { type: "endTurn", player: "p1" } as any;

    const newState = applyAction(state, action);
    expect(newState).toBeDefined();
    expect(newState !== state).toBe(true); // immutable
  });
});
