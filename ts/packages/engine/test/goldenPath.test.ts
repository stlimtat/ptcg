import { describe, it, expect, beforeEach } from "vitest";
import { applyAction } from "../src/reducer";
import { createInitialState } from "../src/state";
import { resolveAttack, setCardRegistry as setAttackFlowRegistry } from "../src/attackFlow";
import { setCardRegistry as setPlayPokemonRegistry } from "../src/actions/playPokemon";
import { setCardRegistry as setAttachEnergyRegistry } from "../src/actions/attachEnergy";
import { setCardRegistry as setActionAttackRegistry } from "../src/actions/attack";
import { setCardRegistry as setRetreatRegistry } from "../src/actions/retreat";

describe("Golden path: complete game", () => {
  // Dragapult ex and Zoroark ex decks from spec
  // Deck: 10 Dragapult, 10 Zoroark (for prizes), 20 Dragon Energy, 20 Colorless Energy
  const dragapultDeck = [
    ...Array(10).fill("dragapult-ex"),
    ...Array(10).fill("zoroark-ex"),
    ...Array(20).fill("dragon-energy"),
    ...Array(20).fill("colorless-energy"),
  ];
  const zoroarkDeck = [
    ...Array(10).fill("zoroark-ex"),
    ...Array(10).fill("dragapult-ex"),
    ...Array(20).fill("darkness-energy"),
    ...Array(20).fill("colorless-energy"),
  ];

  beforeEach(() => {
    const registry = new Map();

    // Dragapult ex: 250 HP, Dragon type, 1 retreat cost
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

    // Zoroark ex: 230 HP, Darkness type, 1 retreat cost
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

    // Energy cards
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


    setPlayPokemonRegistry(registry);
    setAttachEnergyRegistry(registry);
    setActionAttackRegistry(registry);
    setRetreatRegistry(registry);
    setAttackFlowRegistry(registry);
  });

  it("single attack test", () => {
    // Verify a single attack works
    let state = createInitialState(["dragapult-ex"], ["zoroark-ex"]);
    state = { ...state, phase: "main" };

    const p1Dragapult = { id: "p1-drag-1", cardId: "dragapult-ex", instanceId: "p1-drag-1" };
    const p2Zoroark = { id: "p2-zoro-1", cardId: "zoroark-ex", instanceId: "p2-zoro-1" };

    state.players.p1.active = {
      card: p1Dragapult,
      damage: 0,
      attachedEnergy: [
        { id: "e1", cardId: "dragon-energy", instanceId: "p1-e1" },
        { id: "e2", cardId: "colorless-energy", instanceId: "p1-e2" },
      ],
      attachedTools: [],
      statusConditions: [],
    };

    state.players.p2.active = {
      card: p2Zoroark,
      damage: 0,
      attachedEnergy: [
        { id: "e3", cardId: "darkness-energy", instanceId: "p2-e1" },
        { id: "e4", cardId: "colorless-energy", instanceId: "p2-e2" },
      ],
      attachedTools: [],
      statusConditions: [],
    };

    console.log("Before attack: P2.active.damage =", state.players.p2.active.damage);
    state = resolveAttack(state, "p1", 0);
    console.log("After attack: P2.active.damage =", state.players.p2.active?.damage);
    console.log("P2.active is", state.players.p2.active ? "alive" : "dead");

    // P2 should have taken damage
    expect(state.players.p2.active).toBeDefined();
    expect(state.players.p2.active!.damage).toBeGreaterThan(0);
  });

  it("plays alternating attacks", () => {
    // Create initial game state with scripted decks
    let state = createInitialState(dragapultDeck, zoroarkDeck);
    state = { ...state, phase: "main" };

    // Setup active Pokémon for both players
    const p1Dragapult = { id: "p1-drag-1", cardId: "dragapult-ex", instanceId: "p1-drag-1" };
    const p2Zoroark = { id: "p2-zoro-1", cardId: "zoroark-ex", instanceId: "p2-zoro-1" };

    state.players.p1.active = {
      card: p1Dragapult,
      damage: 0,
      attachedEnergy: [
        { id: "e1", cardId: "dragon-energy", instanceId: "p1-e1" },
        { id: "e2", cardId: "colorless-energy", instanceId: "p1-e2" },
      ],
      attachedTools: [],
      statusConditions: [],
    };

    state.players.p2.active = {
      card: p2Zoroark,
      damage: 0,
      attachedEnergy: [
        { id: "e3", cardId: "darkness-energy", instanceId: "p2-e1" },
        { id: "e4", cardId: "colorless-energy", instanceId: "p2-e2" },
      ],
      attachedTools: [],
      statusConditions: [],
    };

    // Initial prizes
    state.players.p1.prizes = Array(6).fill(null).map((_, i) => ({
      id: `p1-p${i}`,
      cardId: `card-${i}`,
      instanceId: `p1-p${i}`,
    }));
    state.players.p2.prizes = Array(6).fill(null).map((_, i) => ({
      id: `p2-p${i}`,
      cardId: `card-${i}`,
      instanceId: `p2-p${i}`,
    }));

    // Perform attacks: P1 -> P2 -> P1 -> P2
    state = resolveAttack(state, "p1", 0);
    expect(state.players.p2.active!.damage).toBe(100);

    state = applyAction(state, { type: "endTurn", player: "p1" });
    expect(state.activePlayer).toBe("p2");

    state = resolveAttack(state, "p2", 0);
    expect(state.players.p1.active!.damage).toBe(100);

    state = applyAction(state, { type: "endTurn", player: "p2" });
    expect(state.activePlayer).toBe("p1");

    // Verify damage accumulates correctly
    expect(state.players.p1.active!.damage).toBe(100);
    expect(state.players.p2.active!.damage).toBe(100);
  });
});
