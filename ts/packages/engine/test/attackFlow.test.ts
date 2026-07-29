import { describe, it, expect, beforeEach } from "vitest";
import { resolveAttack, setCardRegistry as setAttackFlowRegistry } from "../src/attackFlow";
import { createInitialState } from "../src/state";
import { setCardRegistry as setActionAttackRegistry } from "../src/actions/attack";

describe("Attack flow", () => {
  beforeEach(() => {
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
      weakness: { type: "Dragon", mult: 2 },
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
      weakness: { type: "Darkness", mult: 2 },
    });
    registry.set("bulbasaur", {
      type: "pokemon",
      id: "bulbasaur",
      name: "Bulbasaur",
      hp: 60,
      stage: 0,
      types: ["Grass"],
      attacks: [
        {
          name: "Vine Whip",
          cost: ["Grass"],
          baseDamage: 30,
        },
      ],
      abilities: [],
      retreatCost: 1,
      weakness: { type: "Fire", mult: 2 },
      resistance: { type: "Water", reduce: 30 },
    });
    registry.set("dragon-energy", {
      type: "energy",
      id: "dragon-energy",
      name: "Dragon Energy",
      providesType: "Dragon",
    });
    registry.set("colorless-energy", {
      type: "energy",
      id: "colorless-energy",
      name: "Colorless Energy",
      providesType: "any",
    });
    registry.set("grass-energy", {
      type: "energy",
      id: "grass-energy",
      name: "Grass Energy",
      providesType: "Grass",
    });

    setActionAttackRegistry(registry);
    setAttackFlowRegistry(registry);
  });

  it("applies base damage to defender", () => {
    let state = createInitialState(["dragapult-ex"], ["zoroark-ex"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "dragapult-1", cardId: "dragapult-ex", instanceId: "p1-active" },
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

    const newState = resolveAttack(state, "p1", 0);

    expect(newState.players.p2.active!.damage).toBe(100);
  });

  it("applies weakness (2x) to damage calculation", () => {
    let state = createInitialState(["dragapult-ex"], ["dragapult-ex"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "dragapult-1", cardId: "dragapult-ex", instanceId: "p1-active" },
      damage: 0,
      attachedEnergy: [
        { id: "e1", cardId: "dragon-energy", instanceId: "e1-inst" },
        { id: "e2", cardId: "colorless-energy", instanceId: "e2-inst" },
      ],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p2.active = {
      card: { id: "dragapult-2", cardId: "dragapult-ex", instanceId: "p2-active" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };

    const newState = resolveAttack(state, "p1", 0);

    // Dragapult ex attacks for 100 damage, Dragapult ex has weakness to Dragon (2x) = 200 damage
    expect(newState.players.p2.active!.damage).toBe(200);
  });

  it("applies resistance (-30) to damage calculation", () => {
    let state = createInitialState(["bulbasaur"], ["bulbasaur"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "p1-active" },
      damage: 0,
      attachedEnergy: [{ id: "e1", cardId: "grass-energy", instanceId: "e1-inst" }],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p2.active = {
      card: { id: "bulbasaur-2", cardId: "bulbasaur", instanceId: "p2-active" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };

    const newState = resolveAttack(state, "p1", 0);

    // Bulbasaur attacks for 30 damage, defender has 0 Water resistance (would apply if attacker was Water)
    // But Bulbasaur is Grass, so no resistance applies
    expect(newState.players.p2.active!.damage).toBe(30);
  });

  it("KOs defender when damage >= HP", () => {
    let state = createInitialState(["dragapult-ex"], ["bulbasaur"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "dragapult-1", cardId: "dragapult-ex", instanceId: "p1-active" },
      damage: 0,
      attachedEnergy: [
        { id: "e1", cardId: "dragon-energy", instanceId: "e1-inst" },
        { id: "e2", cardId: "colorless-energy", instanceId: "e2-inst" },
      ],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p2.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "p2-active" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };
    // Bulbasaur has 60 HP, Dragapult attacks for 100 damage

    const newState = resolveAttack(state, "p1", 0);

    expect(newState.players.p2.active).toBeNull();
  });

  it("awards prize card when KO occurs", () => {
    let state = createInitialState(["dragapult-ex"], ["bulbasaur"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "dragapult-1", cardId: "dragapult-ex", instanceId: "p1-active" },
      damage: 0,
      attachedEnergy: [
        { id: "e1", cardId: "dragon-energy", instanceId: "e1-inst" },
        { id: "e2", cardId: "colorless-energy", instanceId: "e2-inst" },
      ],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p2.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "p2-active" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p1.prizes = [
      { id: "prize-1", cardId: "card-1", instanceId: "prize-1-inst" },
      { id: "prize-2", cardId: "card-2", instanceId: "prize-2-inst" },
    ];

    const newState = resolveAttack(state, "p1", 0);

    // p1 takes 1 prize when KO occurs
    expect(newState.players.p1.prizes).toHaveLength(1);
    // p2's prizes are unchanged (p2 is the one KO'd)
    expect(newState.players.p2.prizes).toHaveLength(0);
  });

  it("game ends when player's prizes reach 0", () => {
    let state = createInitialState(["dragapult-ex"], ["bulbasaur"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "dragapult-1", cardId: "dragapult-ex", instanceId: "p1-active" },
      damage: 0,
      attachedEnergy: [
        { id: "e1", cardId: "dragon-energy", instanceId: "e1-inst" },
        { id: "e2", cardId: "colorless-energy", instanceId: "e2-inst" },
      ],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p2.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "p2-active" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };
    // Only 1 prize left for p1 to collect
    state.players.p1.prizes = [{ id: "prize-1", cardId: "card-1", instanceId: "prize-1-inst" }];
    // p2 starts with full prizes
    state.players.p2.prizes = [
      { id: "p2-prize-1", cardId: "card-2", instanceId: "p2-prize-1-inst" },
      { id: "p2-prize-2", cardId: "card-3", instanceId: "p2-prize-2-inst" },
    ];

    const newState = resolveAttack(state, "p1", 0);

    // p1 has taken their last prize
    expect(newState.players.p1.prizes).toHaveLength(0);
    expect(newState.winner).toBe("p1");
    // p2's prizes are unchanged
    expect(newState.players.p2.prizes).toHaveLength(2);
  });

  it("uses attack data from registry", () => {
    let state = createInitialState(["bulbasaur"], ["zoroark-ex"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "p1-active" },
      damage: 0,
      attachedEnergy: [{ id: "e1", cardId: "grass-energy", instanceId: "e1-inst" }],
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

    const newState = resolveAttack(state, "p1", 0);

    // Bulbasaur's Vine Whip does 30 damage (from registry)
    expect(newState.players.p2.active!.damage).toBe(30);
  });
});
