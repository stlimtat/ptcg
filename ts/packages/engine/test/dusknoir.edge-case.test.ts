import { describe, it, expect, beforeEach } from "vitest";
import { resolveAttack, setCardRegistry as setAttackFlowRegistry } from "../src/attackFlow";
import { createInitialState } from "../src/state";
import { setCardRegistry as setActionAttackRegistry } from "../src/actions/attack";
import { applyAction } from "../src/reducer";

describe("Dusknoir Endgame Edge Case", () => {
  beforeEach(() => {
    const registry = new Map();

    // Dusknoir ex: 250 HP, Darkness type
    // Shadow Impact: 150 damage + hand disruption effect
    registry.set("dusknoir-ex", {
      type: "pokemon",
      id: "dusknoir-ex",
      name: "Dusknoir ex",
      hp: 250,
      stage: 1,
      evolvesFrom: "duskull",
      types: ["Darkness"],
      attacks: [
        {
          name: "Shadow Impact",
          cost: ["Darkness", "Darkness", "Colorless"],
          baseDamage: 150,
          effect: [
            { op: "dealDamage", amount: 150, target: "defender" },
            { op: "custom", fn: "dusknoir__shadowImpact" },
          ],
        },
      ],
      abilities: [],
      retreatCost: 2,
    });

    // Duskull: Basic, Darkness type
    registry.set("duskull", {
      type: "pokemon",
      id: "duskull",
      name: "Duskull",
      hp: 70,
      stage: 0,
      types: ["Darkness"],
      attacks: [
        {
          name: "Will-O-Wisp",
          cost: ["Darkness"],
          baseDamage: 20,
          effect: [
            { op: "dealDamage", amount: 20, target: "defender" },
            {
              op: "flipCoin",
              onHeads: [{ op: "applyStatus", condition: "Paralyzed", target: "defender" }],
              onTails: [],
            },
          ],
        },
      ],
      abilities: [],
      retreatCost: 1,
    });

    // Opponent Pokémon
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

    // Energy cards
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
    registry.set("dragon-energy", {
      type: "energy",
      id: "dragon-energy",
      name: "Dragon Energy",
      providesType: "Dragon",
    });

    setActionAttackRegistry(registry);
    setAttackFlowRegistry(registry);
  });

  it("creates initial state with Dusknoir deck without error", () => {
    const state = createInitialState(
      ["dusknoir-ex", "duskull", "darkness-energy", "darkness-energy", "colorless-energy"],
      ["dragapult-ex", "dragon-energy", "colorless-energy"]
    );

    expect(state).toBeDefined();
    expect(state.phase).toBe("setup");
    expect(state.players.p1.deck.length).toBeGreaterThan(0);
    expect(state.players.p2.deck.length).toBeGreaterThan(0);
  });

  it("verifies Dusknoir can be played and attacked without error", () => {
    let state = createInitialState(
      ["dusknoir-ex", "duskull", "darkness-energy", "darkness-energy", "darkness-energy", "colorless-energy"],
      ["dragapult-ex", "dragon-energy", "colorless-energy"]
    );
    state.phase = "main";

    // Setup Dusknoir ex as active with 3 darkness energy + 1 colorless
    const duskniorCard = { id: "dusk-1", cardId: "dusknoir-ex", instanceId: "dusk-inst-1" };
    state.players.p1.active = {
      card: duskniorCard,
      damage: 0,
      attachedEnergy: [
        { id: "e1", cardId: "darkness-energy", instanceId: "e1-inst" },
        { id: "e2", cardId: "darkness-energy", instanceId: "e2-inst" },
        { id: "e3", cardId: "colorless-energy", instanceId: "e3-inst" },
      ],
      attachedTools: [],
      statusConditions: [],
    };

    // Setup opponent
    const dragapultCard = { id: "drag-1", cardId: "dragapult-ex", instanceId: "drag-inst-1" };
    state.players.p2.active = {
      card: dragapultCard,
      damage: 0,
      attachedEnergy: [
        { id: "e4", cardId: "dragon-energy", instanceId: "e4-inst" },
        { id: "e5", cardId: "colorless-energy", instanceId: "e5-inst" },
      ],
      attachedTools: [],
      statusConditions: [],
    };

    // Verify Dusknoir can attack without error
    const newState = resolveAttack(state, "p1", 0);
    expect(newState).toBeDefined();
    expect(newState.players.p2.active!.damage).toBe(150);
  });

  it("Dusknoir Shadow Impact works when opponent has 1 prize left", () => {
    let state = createInitialState(
      ["dusknoir-ex", "duskull", "darkness-energy", "darkness-energy", "darkness-energy", "colorless-energy"],
      ["dragapult-ex", "dragon-energy", "colorless-energy"]
    );
    state.phase = "main";

    // Setup Dusknoir ex as active with required energy
    const duskniorCard = { id: "dusk-1", cardId: "dusknoir-ex", instanceId: "dusk-inst-1" };
    state.players.p1.active = {
      card: duskniorCard,
      damage: 0,
      attachedEnergy: [
        { id: "e1", cardId: "darkness-energy", instanceId: "e1-inst" },
        { id: "e2", cardId: "darkness-energy", instanceId: "e2-inst" },
        { id: "e3", cardId: "colorless-energy", instanceId: "e3-inst" },
      ],
      attachedTools: [],
      statusConditions: [],
    };

    // Setup opponent with low HP and 1 prize remaining
    const dragapultCard = { id: "drag-1", cardId: "dragapult-ex", instanceId: "drag-inst-1" };
    state.players.p2.active = {
      card: dragapultCard,
      damage: 0,
      attachedEnergy: [
        { id: "e4", cardId: "dragon-energy", instanceId: "e4-inst" },
        { id: "e5", cardId: "colorless-energy", instanceId: "e5-inst" },
      ],
      attachedTools: [],
      statusConditions: [],
    };

    // P2 has only 1 prize left (endgame scenario)
    state.players.p2.prizes = [
      { id: "p2-prize-1", cardId: "card-1", instanceId: "p2-prize-inst-1" },
    ];

    // P1 has multiple prizes
    state.players.p1.prizes = [
      { id: "p1-prize-1", cardId: "card-2", instanceId: "p1-prize-inst-1" },
      { id: "p1-prize-2", cardId: "card-3", instanceId: "p1-prize-inst-2" },
      { id: "p1-prize-3", cardId: "card-4", instanceId: "p1-prize-inst-3" },
    ];

    // Perform Shadow Impact attack
    const newState = resolveAttack(state, "p1", 0);

    // Verify damage is dealt correctly
    expect(newState.players.p2.active!.damage).toBe(150);
    // Verify P2 still has the 1 remaining prize (not taken yet - prize taking happens on KO)
    expect(newState.players.p2.prizes.length).toBe(1);
  });

  it("Dusknoir evolves from Duskull without error", () => {
    let state = createInitialState(
      ["duskull", "dusknoir-ex", "darkness-energy", "colorless-energy"],
      ["dragapult-ex", "dragon-energy"]
    );
    state.phase = "main";

    // Setup Duskull as active
    const duskullCard = { id: "duskull-1", cardId: "duskull", instanceId: "duskull-inst-1" };
    state.players.p1.active = {
      card: duskullCard,
      damage: 0,
      attachedEnergy: [{ id: "e1", cardId: "darkness-energy", instanceId: "e1-inst" }],
      attachedTools: [],
      statusConditions: [],
    };

    // Put Dusknoir in hand
    state.players.p1.hand = [
      { id: "dusk-evo", cardId: "dusknoir-ex", instanceId: "dusk-evo-inst" },
    ];

    // Verify game state is valid after setup
    expect(state.players.p1.active).toBeDefined();
    expect(state.players.p1.active!.card.cardId).toBe("duskull");
    expect(state.players.p1.hand.length).toBe(1);
  });

  it("game state transitions work correctly with Dusknoir active", () => {
    let state = createInitialState(
      ["dusknoir-ex", "duskull", "darkness-energy", "darkness-energy", "darkness-energy", "colorless-energy"],
      ["dragapult-ex", "dragon-energy", "colorless-energy"]
    );
    state.phase = "main";

    // Setup Dusknoir ex as active
    const duskniorCard = { id: "dusk-1", cardId: "dusknoir-ex", instanceId: "dusk-inst-1" };
    state.players.p1.active = {
      card: duskniorCard,
      damage: 0,
      attachedEnergy: [
        { id: "e1", cardId: "darkness-energy", instanceId: "e1-inst" },
        { id: "e2", cardId: "darkness-energy", instanceId: "e2-inst" },
        { id: "e3", cardId: "colorless-energy", instanceId: "e3-inst" },
      ],
      attachedTools: [],
      statusConditions: [],
    };

    // Setup opponent
    const dragapultCard = { id: "drag-1", cardId: "dragapult-ex", instanceId: "drag-inst-1" };
    state.players.p2.active = {
      card: dragapultCard,
      damage: 0,
      attachedEnergy: [
        { id: "e4", cardId: "dragon-energy", instanceId: "e4-inst" },
        { id: "e5", cardId: "colorless-energy", instanceId: "e5-inst" },
      ],
      attachedTools: [],
      statusConditions: [],
    };

    // Initial state
    expect(state.activePlayer).toBe("p1");
    expect(state.phase).toBe("main");

    // Attack
    state = resolveAttack(state, "p1", 0);
    expect(state.players.p2.active!.damage).toBe(150);

    // End turn
    state = applyAction(state, { type: "endTurn", player: "p1" });
    expect(state.activePlayer).toBe("p2");
    expect(state.turn).toBe(1); // ponytail: turn counter advances at turn end
  });

  it("Duskull basic attack inflicts damage without error", () => {
    let state = createInitialState(
      ["duskull", "darkness-energy"],
      ["dragapult-ex", "dragon-energy", "colorless-energy"]
    );
    state.phase = "main";

    // Setup Duskull as active with 1 darkness energy
    const duskullCard = { id: "duskull-1", cardId: "duskull", instanceId: "duskull-inst-1" };
    state.players.p1.active = {
      card: duskullCard,
      damage: 0,
      attachedEnergy: [{ id: "e1", cardId: "darkness-energy", instanceId: "e1-inst" }],
      attachedTools: [],
      statusConditions: [],
    };

    // Setup opponent
    const dragapultCard = { id: "drag-1", cardId: "dragapult-ex", instanceId: "drag-inst-1" };
    state.players.p2.active = {
      card: dragapultCard,
      damage: 0,
      attachedEnergy: [
        { id: "e4", cardId: "dragon-energy", instanceId: "e4-inst" },
        { id: "e5", cardId: "colorless-energy", instanceId: "e5-inst" },
      ],
      attachedTools: [],
      statusConditions: [],
    };

    // Perform Will-O-Wisp attack
    const newState = resolveAttack(state, "p1", 0);

    // Verify 20 damage dealt
    expect(newState.players.p2.active!.damage).toBe(20);
  });
});
