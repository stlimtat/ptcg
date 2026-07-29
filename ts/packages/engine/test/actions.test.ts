import { describe, it, expect, beforeEach } from "vitest";
import { applyAction } from "../src/reducer";
import { createInitialState } from "../src/state";
import { setCardRegistry } from "../src/actions/playPokemon";

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

describe("PlayPokemon action", () => {
  beforeEach(() => {
    // Set up card registry for testing
    const registry = new Map();
    registry.set("dragapult-ex", {
      type: "pokemon",
      id: "dragapult-ex",
      name: "Dragapult ex",
      hp: 250,
      stage: 0, // Basic Pokémon
      types: ["Dragon"],
      attacks: [],
      abilities: [],
      retreatCost: 1,
    });
    registry.set("zoroark-ex", {
      type: "pokemon",
      id: "zoroark-ex",
      name: "Zoroark ex",
      hp: 230,
      stage: 0,
      types: ["Darkness"],
      attacks: [],
      abilities: [],
      retreatCost: 1,
    });
    registry.set("stage-1-card", {
      type: "pokemon",
      id: "stage-1-card",
      name: "Stage 1 Pokémon",
      hp: 100,
      stage: 1, // Stage 1 evolution
      evolvesFrom: "basic",
      types: ["Water"],
      attacks: [],
      abilities: [],
      retreatCost: 1,
    });
    registry.set("card-1", {
      type: "pokemon",
      id: "card-1",
      name: "Basic Pokémon",
      hp: 120,
      stage: 0,
      types: ["Grass"],
      attacks: [],
      abilities: [],
      retreatCost: 2,
    });
    setCardRegistry(registry);
  });

  it("plays basic Pokémon to bench", () => {
    let state = createInitialState(["dragapult-ex"], ["zoroark-ex"]);
    state.phase = "main";
    state.players.p1.hand = [{ id: "dragapult-ex", cardId: "dragapult-ex", instanceId: "inst-1" }];

    const newState = applyAction(state, {
      type: "playPokemon",
      player: "p1",
      cardId: "dragapult-ex",
    });

    expect(newState.players.p1.bench).toHaveLength(1);
    expect(newState.players.p1.hand).toHaveLength(0);
  });

  it("only allows basic Pokémon to be played", () => {
    let state = createInitialState(["stage-1-card"], ["card-2"]);
    state.phase = "main";
    state.players.p1.hand = [{ id: "stage-1-card", cardId: "stage-1-card", instanceId: "inst-1" }];

    expect(() => applyAction(state, {
      type: "playPokemon",
      player: "p1",
      cardId: "stage-1-card",
    })).toThrow();
  });

  it("requires bench to have space", () => {
    let state = createInitialState(["card-1"], ["card-2"]);
    state.phase = "main";
    state.players.p1.hand = [{ id: "card-1", cardId: "card-1", instanceId: "inst-1" }];
    state.players.p1.bench = Array(5).fill({
      card: { id: "filler", cardId: "filler", instanceId: "inst-filler" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    });

    expect(() => applyAction(state, {
      type: "playPokemon",
      player: "p1",
      cardId: "card-1",
    })).toThrow();
  });

  it("requires main phase", () => {
    let state = createInitialState(["card-1"], ["card-2"]);
    state.phase = "setup";
    state.players.p1.hand = [{ id: "card-1", cardId: "card-1", instanceId: "inst-1" }];

    expect(() => applyAction(state, {
      type: "playPokemon",
      player: "p1",
      cardId: "card-1",
    })).toThrow();
  });

  it("requires action from active player", () => {
    let state = createInitialState(["card-1"], ["card-2"]);
    state.phase = "main";
    state.players.p2.hand = [{ id: "card-1", cardId: "card-1", instanceId: "inst-1" }];

    expect(() => applyAction(state, {
      type: "playPokemon",
      player: "p2",
      cardId: "card-1",
    })).toThrow();
  });
});
