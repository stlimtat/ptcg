import { describe, it, expect, beforeEach } from "vitest";
import { applyAction } from "../src/reducer";
import { createInitialState } from "../src/state";
import { setCardRegistry as setPlayPokemonRegistry } from "../src/actions/playPokemon";
import { setCardRegistry as setEvolveRegistry } from "../src/actions/evolve";
import { setCardRegistry as setAttachEnergyRegistry } from "../src/actions/attachEnergy";
import { setCardRegistry as setPlayTrainerRegistry } from "../src/actions/playTrainer";
import { setCardRegistry as setRetreatRegistry } from "../src/actions/retreat";
import { setCardRegistry as setAttackRegistry } from "../src/actions/attack";

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
    setPlayPokemonRegistry(registry);
    setEvolveRegistry(registry);
    setAttachEnergyRegistry(registry);
    setPlayTrainerRegistry(registry);
    setRetreatRegistry(registry);
    setAttackRegistry(registry);
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

describe("Evolve action", () => {
  beforeEach(() => {
    const registry = new Map();
    registry.set("bulbasaur", {
      type: "pokemon",
      id: "bulbasaur",
      name: "Bulbasaur",
      hp: 60,
      stage: 0,
      types: ["Grass"],
      attacks: [],
      abilities: [],
      retreatCost: 1,
    });
    registry.set("ivysaur", {
      type: "pokemon",
      id: "ivysaur",
      name: "Ivysaur",
      hp: 100,
      stage: 1,
      evolvesFrom: "bulbasaur",
      types: ["Grass"],
      attacks: [],
      abilities: [],
      retreatCost: 1,
    });
    registry.set("venusaur", {
      type: "pokemon",
      id: "venusaur",
      name: "Venusaur",
      hp: 150,
      stage: 2,
      evolvesFrom: "ivysaur",
      types: ["Grass"],
      attacks: [],
      abilities: [],
      retreatCost: 2,
    });
    setEvolveRegistry(registry);
  });

  it("evolves Pokémon in bench", () => {
    let state = createInitialState(["bulbasaur"], ["card-2"]);
    state.phase = "main";
    state.players.p1.bench = [{
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "bulbasaur-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    }];
    state.players.p1.hand = [{ id: "ivysaur-1", cardId: "ivysaur", instanceId: "ivysaur-inst" }];

    const newState = applyAction(state, {
      type: "evolve",
      player: "p1",
      targetInstanceId: "bulbasaur-inst",
      cardId: "ivysaur",
    });

    expect(newState.players.p1.bench[0].card.cardId).toBe("ivysaur");
    expect(newState.players.p1.hand).toHaveLength(0);
  });

  it("evolves Pokémon in active", () => {
    let state = createInitialState(["bulbasaur"], ["card-2"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "bulbasaur-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p1.hand = [{ id: "ivysaur-1", cardId: "ivysaur", instanceId: "ivysaur-inst" }];

    const newState = applyAction(state, {
      type: "evolve",
      player: "p1",
      targetInstanceId: "bulbasaur-inst",
      cardId: "ivysaur",
    });

    expect(newState.players.p1.active!.card.cardId).toBe("ivysaur");
    expect(newState.players.p1.hand).toHaveLength(0);
  });

  it("requires card to be in hand", () => {
    let state = createInitialState(["bulbasaur"], ["card-2"]);
    state.phase = "main";
    state.players.p1.bench = [{
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "bulbasaur-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    }];

    expect(() => applyAction(state, {
      type: "evolve",
      player: "p1",
      targetInstanceId: "bulbasaur-inst",
      cardId: "ivysaur",
    })).toThrow();
  });

  it("requires target to be in play", () => {
    let state = createInitialState(["bulbasaur"], ["card-2"]);
    state.phase = "main";
    state.players.p1.hand = [{ id: "ivysaur-1", cardId: "ivysaur", instanceId: "ivysaur-inst" }];

    expect(() => applyAction(state, {
      type: "evolve",
      player: "p1",
      targetInstanceId: "nonexistent",
      cardId: "ivysaur",
    })).toThrow();
  });

  it("requires main phase", () => {
    let state = createInitialState(["bulbasaur"], ["card-2"]);
    state.phase = "setup";
    state.players.p1.bench = [{
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "bulbasaur-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    }];
    state.players.p1.hand = [{ id: "ivysaur-1", cardId: "ivysaur", instanceId: "ivysaur-inst" }];

    expect(() => applyAction(state, {
      type: "evolve",
      player: "p1",
      targetInstanceId: "bulbasaur-inst",
      cardId: "ivysaur",
    })).toThrow();
  });

  it("requires active player", () => {
    let state = createInitialState(["bulbasaur"], ["card-2"]);
    state.phase = "main";
    state.players.p2.bench = [{
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "bulbasaur-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    }];
    state.players.p2.hand = [{ id: "ivysaur-1", cardId: "ivysaur", instanceId: "ivysaur-inst" }];

    expect(() => applyAction(state, {
      type: "evolve",
      player: "p2",
      targetInstanceId: "bulbasaur-inst",
      cardId: "ivysaur",
    })).toThrow();
  });
});

describe("AttachEnergy action", () => {
  beforeEach(() => {
    const registry = new Map();
    registry.set("grass-energy", {
      type: "energy",
      id: "grass-energy",
      name: "Grass Energy",
      providesType: "Grass",
    });
    registry.set("bulbasaur", {
      type: "pokemon",
      id: "bulbasaur",
      name: "Bulbasaur",
      hp: 60,
      stage: 0,
      types: ["Grass"],
      attacks: [],
      abilities: [],
      retreatCost: 1,
    });
    setAttachEnergyRegistry(registry);
  });

  it("attaches energy to target", () => {
    let state = createInitialState(["bulbasaur"], ["card-2"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "bulbasaur-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p1.hand = [{ id: "energy-1", cardId: "grass-energy", instanceId: "energy-inst" }];

    const newState = applyAction(state, {
      type: "attachEnergy",
      player: "p1",
      energyCardId: "grass-energy",
      targetInstanceId: "bulbasaur-inst",
    });

    expect(newState.players.p1.active!.attachedEnergy).toHaveLength(1);
    expect(newState.players.p1.hand).toHaveLength(0);
    expect(newState.players.p1.energyAttachedThisTurn).toBe(true);
  });

  it("only allows one energy attachment per turn", () => {
    let state = createInitialState(["bulbasaur"], ["card-2"]);
    state.phase = "main";
    state.players.p1.energyAttachedThisTurn = true;
    state.players.p1.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "bulbasaur-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p1.hand = [{ id: "energy-1", cardId: "grass-energy", instanceId: "energy-inst" }];

    expect(() => applyAction(state, {
      type: "attachEnergy",
      player: "p1",
      energyCardId: "grass-energy",
      targetInstanceId: "bulbasaur-inst",
    })).toThrow();
  });

  it("requires card to be in hand", () => {
    let state = createInitialState(["bulbasaur"], ["card-2"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "bulbasaur-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };

    expect(() => applyAction(state, {
      type: "attachEnergy",
      player: "p1",
      energyCardId: "grass-energy",
      targetInstanceId: "bulbasaur-inst",
    })).toThrow();
  });
});

describe("PlayTrainer action", () => {
  beforeEach(() => {
    const registry = new Map();
    registry.set("poke-ball", {
      type: "trainer",
      id: "poke-ball",
      name: "Poké Ball",
      subtype: "item",
      effect: [],
    });
    registry.set("professor-oak", {
      type: "trainer",
      id: "professor-oak",
      name: "Professor Oak",
      subtype: "supporter",
      effect: [],
    });
    setPlayTrainerRegistry(registry);
  });

  it("plays item trainer card", () => {
    let state = createInitialState(["card-1"], ["card-2"]);
    state.phase = "main";
    state.players.p1.hand = [{ id: "item-1", cardId: "poke-ball", instanceId: "item-inst" }];

    const newState = applyAction(state, {
      type: "playTrainer",
      player: "p1",
      cardId: "poke-ball",
    });

    expect(newState.players.p1.hand).toHaveLength(0);
    expect(newState.players.p1.discard).toHaveLength(1);
  });

  it("only allows one supporter per turn", () => {
    let state = createInitialState(["card-1"], ["card-2"]);
    state.phase = "main";
    state.players.p1.supporterPlayedThisTurn = true;
    state.players.p1.hand = [
      { id: "supp-1", cardId: "professor-oak", instanceId: "supp-inst-1" },
      { id: "supp-2", cardId: "professor-oak", instanceId: "supp-inst-2" },
    ];

    expect(() => applyAction(state, {
      type: "playTrainer",
      player: "p1",
      cardId: "professor-oak",
    })).toThrow();
  });

  it("requires main phase", () => {
    let state = createInitialState(["card-1"], ["card-2"]);
    state.phase = "setup";
    state.players.p1.hand = [{ id: "item-1", cardId: "poke-ball", instanceId: "item-inst" }];

    expect(() => applyAction(state, {
      type: "playTrainer",
      player: "p1",
      cardId: "poke-ball",
    })).toThrow();
  });
});

describe("Retreat action", () => {
  beforeEach(() => {
    const registry = new Map();
    registry.set("bulbasaur", {
      type: "pokemon",
      id: "bulbasaur",
      name: "Bulbasaur",
      hp: 60,
      stage: 0,
      types: ["Grass"],
      attacks: [],
      abilities: [],
      retreatCost: 1,
    });
    registry.set("charmander", {
      type: "pokemon",
      id: "charmander",
      name: "Charmander",
      hp: 60,
      stage: 0,
      types: ["Fire"],
      attacks: [],
      abilities: [],
      retreatCost: 1,
    });
    registry.set("grass-energy", {
      type: "energy",
      id: "grass-energy",
      name: "Grass Energy",
      providesType: "Grass",
    });
    setRetreatRegistry(registry);
  });

  it("switches active with bench Pokémon", () => {
    let state = createInitialState(["bulbasaur"], ["card-2"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "active-inst" },
      damage: 0,
      attachedEnergy: [{ id: "e1", cardId: "grass-energy", instanceId: "e1-inst" }],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p1.bench = [{
      card: { id: "charmander-1", cardId: "charmander", instanceId: "bench-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    }];

    const newState = applyAction(state, {
      type: "retreat",
      player: "p1",
      benchInstanceId: "bench-inst",
    });

    expect(newState.players.p1.active!.card.instanceId).toBe("bench-inst");
    expect(newState.players.p1.bench[0].card.instanceId).toBe("active-inst");
  });

  it("discards energy equal to retreat cost", () => {
    let state = createInitialState(["bulbasaur"], ["card-2"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "active-inst" },
      damage: 0,
      attachedEnergy: [{ id: "e1", cardId: "grass-energy", instanceId: "e1-inst" }],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p1.bench = [{
      card: { id: "charmander-1", cardId: "charmander", instanceId: "bench-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    }];

    const newState = applyAction(state, {
      type: "retreat",
      player: "p1",
      benchInstanceId: "bench-inst",
    });

    expect(newState.players.p1.active!.attachedEnergy).toHaveLength(0);
    expect(newState.players.p1.discard).toHaveLength(1);
  });

  it("requires sufficient energy", () => {
    let state = createInitialState(["bulbasaur"], ["card-2"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "active-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p1.bench = [{
      card: { id: "charmander-1", cardId: "charmander", instanceId: "bench-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    }];

    expect(() => applyAction(state, {
      type: "retreat",
      player: "p1",
      benchInstanceId: "bench-inst",
    })).toThrow();
  });
});

describe("Attack action", () => {
  beforeEach(() => {
    const registry = new Map();
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
    });
    registry.set("charmander", {
      type: "pokemon",
      id: "charmander",
      name: "Charmander",
      hp: 60,
      stage: 0,
      types: ["Fire"],
      attacks: [
        {
          name: "Scratch",
          cost: ["Fire"],
          baseDamage: 30,
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
    registry.set("fire-energy", {
      type: "energy",
      id: "fire-energy",
      name: "Fire Energy",
      providesType: "Fire",
    });
    setAttackRegistry(registry);
  });

  it("performs attack with sufficient energy", () => {
    let state = createInitialState(["bulbasaur"], ["charmander"]);
    state.phase = "main";
    state.turn = 2; // the player going first may not attack on turn 1
    state.players.p1.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "p1-active-inst" },
      damage: 0,
      attachedEnergy: [{ id: "e1", cardId: "grass-energy", instanceId: "e1-inst" }],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p2.active = {
      card: { id: "charmander-1", cardId: "charmander", instanceId: "p2-active-inst" },
      damage: 0,
      attachedEnergy: [{ id: "e2", cardId: "fire-energy", instanceId: "e2-inst" }],
      attachedTools: [],
      statusConditions: [],
    };

    const newState = applyAction(state, {
      type: "attack",
      player: "p1",
      attackIndex: 0,
    });

    expect(newState.players.p2.active!.damage).toBeGreaterThan(0);
  });

  it("requires sufficient energy cost", () => {
    let state = createInitialState(["bulbasaur"], ["charmander"]);
    state.phase = "main";
    state.players.p1.active = {
      card: { id: "bulbasaur-1", cardId: "bulbasaur", instanceId: "p1-active-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };
    state.players.p2.active = {
      card: { id: "charmander-1", cardId: "charmander", instanceId: "p2-active-inst" },
      damage: 0,
      attachedEnergy: [],
      attachedTools: [],
      statusConditions: [],
    };

    expect(() => applyAction(state, {
      type: "attack",
      player: "p1",
      attackIndex: 0,
    })).toThrow();
  });
});
