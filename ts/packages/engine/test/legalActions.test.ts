import { describe, it, expect, beforeEach } from "vitest";
import { legalActions } from "../src/legalActions";
import { createInitialState } from "../src/state";
import { setCardRegistry as setPlayPokemonRegistry } from "../src/actions/playPokemon";
import { setCardRegistry as setEvolveRegistry } from "../src/actions/evolve";
import { setCardRegistry as setAttachEnergyRegistry } from "../src/actions/attachEnergy";
import { setCardRegistry as setPlayTrainerRegistry } from "../src/actions/playTrainer";
import { setCardRegistry as setRetreatRegistry } from "../src/actions/retreat";
import { setCardRegistry as setAttackRegistry } from "../src/actions/attack";

describe("legalActions", () => {
  beforeEach(() => {
    // Set up card registry for testing
    const registry = new Map();
    registry.set("dragapult-ex", {
      type: "pokemon",
      id: "dragapult-ex",
      name: "Dragapult ex",
      hp: 250,
      stage: 0,
      types: ["Dragon"],
      attacks: [
        {
          name: "Jet Shot",
          cost: ["Dragon", "Colorless"],
          baseDamage: 100,
        },
      ],
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
      attacks: [
        {
          name: "Unified Assault",
          cost: ["Darkness", "Colorless"],
          baseDamage: 100,
        },
      ],
      abilities: [],
      retreatCost: 1,
    });
    registry.set("grass-energy", {
      type: "energy",
      id: "grass-energy",
      name: "Grass Energy",
      providesType: "Grass",
    });
    registry.set("dragon-energy", {
      type: "energy",
      id: "dragon-energy",
      name: "Dragon Energy",
      providesType: "Dragon",
    });
    registry.set("darkness-energy", {
      type: "energy",
      id: "darkness-energy",
      name: "Darkness Energy",
      providesType: "Darkness",
    });
    registry.set("colorless-energy", {
      type: "energy",
      id: "colorless-energy",
      name: "Colorless Energy",
      providesType: "any",
    });
    registry.set("poke-ball", {
      type: "trainer",
      id: "poke-ball",
      name: "Poké Ball",
      subtype: "item",
      effect: [],
    });

    setPlayPokemonRegistry(registry);
    setEvolveRegistry(registry);
    setAttachEnergyRegistry(registry);
    setPlayTrainerRegistry(registry);
    setRetreatRegistry(registry);
    setAttackRegistry(registry);
  });

  it("includes endTurn as always-legal action for active player", () => {
    let state = createInitialState(["dragapult-ex"], ["zoroark-ex"]);
    state.phase = "main";

    const actions = legalActions(state, "p1");
    const endTurnAction = actions.find((a) => a.type === "endTurn");

    expect(endTurnAction).toBeDefined();
    expect(endTurnAction?.type).toBe("endTurn");
  });

  it("returns empty array for inactive player", () => {
    let state = createInitialState(["dragapult-ex"], ["zoroark-ex"]);
    state.phase = "main";

    const actions = legalActions(state, "p2");

    expect(actions).toHaveLength(0);
  });

  it("includes playable cards from hand during main phase", () => {
    let state = createInitialState(["dragapult-ex"], ["zoroark-ex"]);
    state.phase = "main";
    state.players.p1.hand = [{ id: "dragapult-1", cardId: "dragapult-ex", instanceId: "inst-1" }];

    const actions = legalActions(state, "p1");
    const playPokemonActions = actions.filter((a) => a.type === "playPokemon");

    expect(playPokemonActions.length).toBeGreaterThan(0);
  });

  it("filters actions based on game phase", () => {
    let state = createInitialState(["dragapult-ex"], ["zoroark-ex"]);
    state.phase = "setup"; // Not main phase
    state.players.p1.hand = [{ id: "dragapult-1", cardId: "dragapult-ex", instanceId: "inst-1" }];

    const actions = legalActions(state, "p1");
    const playPokemonActions = actions.filter((a) => a.type === "playPokemon");

    // Should not include playPokemon in setup phase
    expect(playPokemonActions).toHaveLength(0);
  });

  it("enumerates all 7 action types when legal", () => {
    let state = createInitialState(["dragapult-ex"], ["zoroark-ex"]);
    state.phase = "main";
    // Active needs enough energy for attack (Dragon + Colorless)
    state.players.p1.active = {
      card: { id: "dragapult-1", cardId: "dragapult-ex", instanceId: "active-inst" },
      damage: 0,
      attachedEnergy: [
        { id: "e1", cardId: "dragon-energy", instanceId: "e1-inst" },
        { id: "e2", cardId: "colorless-energy", instanceId: "e2-inst" },
      ],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p2.active = {
      card: { id: "zoroark-1", cardId: "zoroark-ex", instanceId: "p2-active" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p1.hand = [
      { id: "poke-ball-1", cardId: "poke-ball", instanceId: "pb-1" },
      { id: "grass-energy-1", cardId: "grass-energy", instanceId: "ge-1" },
    ];
    state.players.p1.bench = [
      {
        card: { id: "zoroark-1", cardId: "zoroark-ex", instanceId: "bench-inst" },
        damage: 0,
        attachedEnergy: [],
        attachedTools: [],
        statusConditions: [],
      },
    ];

    const actions = legalActions(state, "p1");
    const actionTypes = new Set(actions.map((a) => a.type));

    // Should include at least: endTurn, attachEnergy, playTrainer, retreat, attack
    expect(actionTypes.has("endTurn")).toBe(true);
    expect(actionTypes.has("attachEnergy")).toBe(true);
    expect(actionTypes.has("playTrainer")).toBe(true);
    expect(actionTypes.has("retreat")).toBe(true);
    expect(actionTypes.has("attack")).toBe(true);
  });

  it("handles respects energy attachment once-per-turn limit", () => {
    let state = createInitialState(["dragapult-ex"], ["zoroark-ex"]);
    state.phase = "main";
    state.players.p1.energyAttachedThisTurn = true;
    state.players.p1.active = {
      card: { id: "dragapult-1", cardId: "dragapult-ex", instanceId: "active-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p1.hand = [{ id: "e1", cardId: "dragon-energy", instanceId: "e1-inst" }];

    const actions = legalActions(state, "p1");
    const attachEnergyActions = actions.filter((a) => a.type === "attachEnergy");

    expect(attachEnergyActions).toHaveLength(0);
  });
});
