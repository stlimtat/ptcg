# Pokémon TCG Game Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable Pokémon TCG rules engine + UI supporting 2 starter decks (Dragapult ex vs N's Zoroark ex), with human vs human (hotseat) or human vs random-bot play.

**Architecture:** Immutable state + pure reducer pattern. Headless engine (zero DOM deps) separate from React UI. Data-driven effect DSL. Attack resolution follows official flow chart.

**Tech Stack:** TypeScript, pnpm monorepo, Vitest, React + Vite (UI), Node.js scrapers.

---

## File Structure

```
ts/
  package.json (workspace root)
  pnpm-workspace.yaml
  tsconfig.json
  packages/
    engine/
      package.json
      tsconfig.json
      vitest.config.ts
      src/
        index.ts (exports)
        types.ts (all core types: GameState, PlayerState, Action, etc)
        state.ts (initial state builder)
        reducer.ts (thin dispatcher)
        legalActions.ts (enumeration)
        cards/
          schema.ts (Card type)
          registry.ts (Map<cardId, Card>, load from JSON)
          customEffects.ts (escape hatch custom functions)
        effects/
          dsl.ts (EffectScript, EffectNode types)
          interpreter.ts (executeEffectScript function)
          primitives.ts (effect operators: dealDamage, flipCoin, etc)
        actions/
          index.ts (registry: Map<actionType, {isLegal, apply}>)
          playPokemon.ts
          evolve.ts
          attachEnergy.ts
          playTrainer.ts
          retreat.ts
          attack.ts
          endTurn.ts
        attackFlow.ts (8-step pipeline)
      test/
        types.test.ts
        reducer.test.ts
        actions.test.ts (test each action legality + apply)
        attackFlow.test.ts (pipeline scenarios)
        effectsPrimitives.test.ts
        gameFlow.test.ts (golden path: full game)
        fixtures/
          dragapult-vs-zoroark.json (scripted moves)
    data-pipeline/
      package.json
      tsconfig.json
      vitest.config.ts
      src/
        index.ts (CLI entry)
        types.ts
        scrapeBulbapedia.ts
        scrapeLimitless.ts
        buildCardJson.ts
      out/
        cards.json (committed)
        decks/
          dragapult-ex.json (committed)
          n-zoroark-ex.json (committed)
      test/
        fixtures/ (HTML fixture files for scraping tests)
          bulbapedia-dragapult.html
          bulbapedia-zoroark.html
          limitless-decks.html
        scraper.test.ts
        cardBuilder.test.ts
    ui/
      package.json
      tsconfig.json
      vite.config.ts
      vitest.config.ts
      index.html
      src/
        index.tsx
        App.tsx
        types.ts (UIState: selection, pending target)
        models/
          selection.ts (types only)
        views/
          Board.tsx
          ActiveSpot.tsx
          BenchSpot.tsx
          Hand.tsx
          PrizeRow.tsx
          ActionBar.tsx
          Log.tsx
        controllers/
          boardController.ts
          actionBarController.ts
          botController.ts
        utils/
          bot.ts (random legal move)
      test/
        controllers.test.ts
```

---

## Phase 1: Monorepo Setup

### Task 1: Create monorepo structure & root config files

**Files:**
- Create: `ts/package.json`
- Create: `ts/pnpm-workspace.yaml`
- Create: `ts/tsconfig.json`
- Create: `README.md` (root)

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "pokemon-tcg",
  "version": "0.1.0",
  "description": "Pokémon TCG game engine",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "test": "pnpm -r run test",
    "build": "pnpm -r run build"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 3: Create root tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "lib": ["ES2020"]
  }
}
```

- [ ] **Step 4: Create root README.md**

```markdown
# Pokémon TCG Game Engine

A TypeScript implementation of a Pokémon Trading Card Game rules engine with a React UI.

## Packages

- `packages/engine` - Core game rules and state management
- `packages/data-pipeline` - Card scraper and data builder
- `packages/ui` - React-based game interface

## Development

```bash
pnpm install
pnpm test         # Run all tests
pnpm dev          # Start dev servers
```
```

- [ ] **Step 5: Commit**

```bash
git add ts/package.json ts/pnpm-workspace.yaml ts/tsconfig.json README.md
git commit -m "chore: initialize pnpm monorepo structure"
```

---

## Phase 2: Engine Foundation

### Task 2: Create engine package & core types

**Files:**
- Create: `ts/packages/engine/package.json`
- Create: `ts/packages/engine/tsconfig.json`
- Create: `ts/packages/engine/src/types.ts`
- Create: `ts/packages/engine/src/index.ts`

- [ ] **Step 1: Create engine package.json**

```json
{
  "name": "@pokemon-tcg/engine",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "vitest": "workspace:*"
  }
}
```

- [ ] **Step 2: Create engine tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"],
  "exclude": ["test"]
}
```

- [ ] **Step 3: Create src/types.ts with all core types**

```typescript
// Types & enums
export type PokemonType = 
  | "Grass" | "Fire" | "Water" | "Lightning" | "Psychic" | "Fighting" 
  | "Darkness" | "Metal" | "Fairy" | "Dragon" | "Colorless";

export type StatusCondition = "Confused" | "Asleep" | "Paralyzed" | "Poisoned" | "Burned";

export interface CardInstance {
  id: string;
  cardId: string;
  instanceId: string; // unique per copy in play
}

export interface PokemonInPlay {
  card: CardInstance;
  damage: number;
  attachedEnergy: CardInstance[];
  attachedTools: CardInstance[];
  statusConditions: StatusCondition[];
}

export interface PlayerState {
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  prizes: CardInstance[]; // face-down prizes
  active: PokemonInPlay | null;
  bench: PokemonInPlay[];
  energyAttachedThisTurn: boolean;
  supporterPlayedThisTurn: boolean;
}

export interface GameState {
  turn: number;
  activePlayer: "p1" | "p2";
  phase: "setup" | "main" | "attackResolution" | "checkup" | "gameOver";
  players: Record<"p1" | "p2", PlayerState>;
  winner?: "p1" | "p2" | "draw";
  log: LogEntry[];
}

export interface LogEntry {
  timestamp: number;
  player: "p1" | "p2";
  message: string;
}

// Actions
export type Action =
  | { type: "playPokemon"; player: "p1" | "p2"; cardId: string }
  | { type: "evolve"; player: "p1" | "p2"; targetInstanceId: string; cardId: string }
  | { type: "attachEnergy"; player: "p1" | "p2"; energyCardId: string; targetInstanceId: string }
  | { type: "playTrainer"; player: "p1" | "p2"; cardId: string; targetInstanceId?: string }
  | { type: "retreat"; player: "p1" | "p2"; benchInstanceId: string }
  | { type: "attack"; player: "p1" | "p2"; attackIndex: number; targetInstanceId?: string }
  | { type: "endTurn"; player: "p1" | "p2" };

export interface ActionHandler {
  isLegal(state: GameState, action: Action): boolean;
  apply(state: GameState, action: Action): GameState;
}

// Card types (loaded from cards.json)
export type Card =
  | {
      type: "pokemon";
      id: string;
      name: string;
      hp: number;
      stage: 0 | 1 | 2;
      evolvesFrom?: string;
      types: PokemonType[];
      weakness?: { type: PokemonType; mult: 2 };
      resistance?: { type: PokemonType; reduce: 30 };
      retreatCost: number;
      abilities: Ability[];
      attacks: Attack[];
    }
  | {
      type: "energy";
      id: string;
      name: string;
      providesType: PokemonType | "any";
      special?: EffectScript;
    }
  | {
      type: "trainer";
      id: string;
      name: string;
      subtype: "supporter" | "item" | "tool" | "stadium";
      effect: EffectScript;
    };

export interface Ability {
  name: string;
  effect: EffectScript;
}

export interface Attack {
  name: string;
  cost: PokemonType[];
  baseDamage: number;
  effect?: EffectScript;
  requiresTarget?: boolean;
}

// Effect DSL
export type EffectScript = EffectNode[];

export type EffectNode =
  | {
      op: "dealDamage";
      amount: number | "coinFlipDouble";
      target: "defender" | "self" | "allBench";
    }
  | {
      op: "flipCoin";
      onHeads: EffectNode[];
      onTails: EffectNode[];
    }
  | {
      op: "discardEnergy";
      from: "self" | "defender";
      count: number;
      energyType?: PokemonType;
    }
  | {
      op: "applyStatus";
      condition: StatusCondition;
      target: "defender" | "self";
    }
  | {
      op: "heal";
      amount: number;
      target: "self";
    }
  | {
      op: "drawCards";
      count: number;
    }
  | {
      op: "modifyDamageTaken";
      amount: number;
      timing: "beforeDamage";
    }
  | {
      op: "modifyDamageDealt";
      amount: number;
      timing: "attackerBoost";
    }
  | {
      op: "custom";
      fn: string;
    };
```

- [ ] **Step 4: Create src/index.ts**

```typescript
export * from "./types";
export * from "./state";
export * from "./reducer";
export * from "./legalActions";
export { loadCardRegistry } from "./cards/registry";
export { executeEffect } from "./effects/interpreter";
```

- [ ] **Step 5: Commit**

```bash
git add ts/packages/engine/
git commit -m "feat(engine): create package and core types"
```

### Task 3: Create game state initializer

**Files:**
- Create: `ts/packages/engine/src/state.ts`
- Create: `ts/packages/engine/test/state.test.ts`

- [ ] **Step 1: Write failing test for initial state**

```typescript
// test/state.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ts/packages/engine
pnpm test
```

Expected: FAIL — `createInitialState is not defined`

- [ ] **Step 3: Implement src/state.ts**

```typescript
import { GameState } from "./types";

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createInitialState(
  p1DeckCardIds: string[],
  p2DeckCardIds: string[]
): GameState {
  return {
    turn: 1,
    activePlayer: "p1",
    phase: "setup",
    players: {
      p1: {
        deck: shuffle(p1DeckCardIds).map((cardId) => ({
          id: cardId,
          cardId,
          instanceId: `${cardId}-${Math.random()}`,
        })),
        hand: [],
        discard: [],
        prizes: [],
        active: null,
        bench: [],
        energyAttachedThisTurn: false,
        supporterPlayedThisTurn: false,
      },
      p2: {
        deck: shuffle(p2DeckCardIds).map((cardId) => ({
          id: cardId,
          cardId,
          instanceId: `${cardId}-${Math.random()}`,
        })),
        hand: [],
        discard: [],
        prizes: [],
        active: null,
        bench: [],
        energyAttachedThisTurn: false,
        supporterPlayedThisTurn: false,
      },
    },
    log: [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test state.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ts/packages/engine/src/state.ts ts/packages/engine/test/state.test.ts
git commit -m "feat(engine): add game state initializer"
```

### Task 4: Create reducer dispatcher

**Files:**
- Create: `ts/packages/engine/src/reducer.ts`
- Create: `ts/packages/engine/test/reducer.test.ts`

- [ ] **Step 1: Write failing test for reducer**

```typescript
// test/reducer.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test reducer.test.ts
```

Expected: FAIL

- [ ] **Step 3: Create action registry file (stub)**

```typescript
// src/actions/index.ts
import type { Action, ActionHandler, GameState } from "../types";

export const actionRegistry = new Map<string, ActionHandler>();

// Stubs for now, will be filled by other tasks
actionRegistry.set("endTurn", {
  isLegal: () => true,
  apply: (state) => state,
});
```

- [ ] **Step 4: Implement src/reducer.ts**

```typescript
import { GameState, Action } from "./types";
import { actionRegistry } from "./actions";

export function applyAction(state: GameState, action: Action): GameState {
  const handler = actionRegistry.get(action.type);
  if (!handler) {
    throw new Error(`Unknown action type: ${action.type}`);
  }

  if (!handler.isLegal(state, action)) {
    throw new Error(`Illegal action: ${action.type}`);
  }

  return handler.apply(state, action);
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test reducer.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add ts/packages/engine/src/reducer.ts ts/packages/engine/src/actions/index.ts ts/packages/engine/test/reducer.test.ts
git commit -m "feat(engine): add action dispatcher reducer"
```

---

## Phase 3: Effect System

### Task 5: Create effect DSL types & interpreter

**Files:**
- Create: `ts/packages/engine/src/effects/dsl.ts`
- Create: `ts/packages/engine/src/effects/interpreter.ts`
- Create: `ts/packages/engine/test/effects.test.ts`

- [ ] **Step 1: Write failing test for effect execution**

```typescript
// test/effects.test.ts
import { describe, it, expect } from "vitest";
import { executeEffect } from "../src/effects/interpreter";

describe("Effect interpreter", () => {
  it("executes dealDamage effect", () => {
    const effect = [{ op: "dealDamage", amount: 20, target: "defender" }];
    const result = executeEffect(effect, {
      currentDamage: 0,
      player: "p1",
      defender: "p2",
    });

    expect(result.currentDamage).toBe(20);
  });

  it("executes flipCoin effect with heads branch", () => {
    const rng = () => 0.5; // always heads
    const effect = [
      {
        op: "flipCoin",
        onHeads: [{ op: "dealDamage", amount: 50, target: "defender" }],
        onTails: [{ op: "dealDamage", amount: 0, target: "defender" }],
      },
    ];
    const result = executeEffect(effect, {
      currentDamage: 0,
      player: "p1",
      defender: "p2",
      rng,
    });

    expect(result.currentDamage).toBe(50);
  });

  it("chains multiple effects", () => {
    const effect = [
      { op: "dealDamage", amount: 30, target: "defender" },
      { op: "dealDamage", amount: 20, target: "defender" },
    ];
    const result = executeEffect(effect, {
      currentDamage: 0,
      player: "p1",
      defender: "p2",
    });

    expect(result.currentDamage).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test effects.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement src/effects/interpreter.ts**

```typescript
import { EffectScript, EffectNode } from "../types";

export interface EffectContext {
  currentDamage: number;
  player: "p1" | "p2";
  defender: "p1" | "p2";
  rng?: () => number; // 0-1 for coin flips
}

export function executeEffect(
  script: EffectScript,
  context: EffectContext
): EffectContext {
  let ctx = { ...context };

  for (const node of script) {
    ctx = executeNode(node, ctx);
  }

  return ctx;
}

function executeNode(node: EffectNode, ctx: EffectContext): EffectContext {
  if (node.op === "dealDamage") {
    const amount =
      node.amount === "coinFlipDouble"
        ? (ctx.rng?.() || Math.random()) > 0.5
          ? 40
          : 0
        : node.amount;
    return {
      ...ctx,
      currentDamage: ctx.currentDamage + amount,
    };
  }

  if (node.op === "flipCoin") {
    const isHeads = (ctx.rng?.() || Math.random()) > 0.5;
    const branch = isHeads ? node.onHeads : node.onTails;
    return executeEffect(branch, ctx);
  }

  if (node.op === "drawCards") {
    // Stub: drawing handled in game state, not here
    return ctx;
  }

  if (node.op === "discardEnergy") {
    // Stub
    return ctx;
  }

  if (node.op === "applyStatus") {
    // Stub
    return ctx;
  }

  if (node.op === "heal") {
    // Stub
    return ctx;
  }

  if (node.op === "modifyDamageTaken") {
    return {
      ...ctx,
      currentDamage: Math.max(0, ctx.currentDamage - node.amount),
    };
  }

  if (node.op === "modifyDamageDealt") {
    // Applied before damage, stub for now
    return ctx;
  }

  if (node.op === "custom") {
    // Stub: escape hatch, implemented elsewhere
    return ctx;
  }

  return ctx;
}
```

- [ ] **Step 4: Create src/effects/dsl.ts (types already in types.ts)**

```typescript
// src/effects/dsl.ts - just re-exports for convenience
export type { EffectNode, EffectScript } from "../types";
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test effects.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add ts/packages/engine/src/effects/ ts/packages/engine/test/effects.test.ts
git commit -m "feat(engine): add effect DSL interpreter"
```

---

## Phase 4: Card Registry & Lookup

### Task 6: Create card schema & registry loader

**Files:**
- Create: `ts/packages/engine/src/cards/schema.ts`
- Create: `ts/packages/engine/src/cards/registry.ts`
- Create: `ts/packages/engine/test/cards.test.ts`

- [ ] **Step 1: Write failing test for card registry**

```typescript
// test/cards.test.ts
import { describe, it, expect } from "vitest";
import { loadCardRegistry } from "../src/cards/registry";

describe("Card registry", () => {
  it("loads cards from JSON", () => {
    const cardsJson = {
      cards: [
        {
          type: "pokemon",
          id: "dragapult-ex",
          name: "Dragapult ex",
          hp: 250,
          stage: 2,
          evolvesFrom: "Drakloak",
          types: ["Dragon"],
          attacks: [
            {
              name: "Phantom Line",
              cost: ["Colorless", "Colorless"],
              baseDamage: 100,
            },
          ],
          abilities: [],
          retreatCost: 1,
        },
      ],
    };

    const registry = loadCardRegistry(cardsJson as any);
    expect(registry.get("dragapult-ex")).toBeDefined();
    expect(registry.get("dragapult-ex")?.name).toBe("Dragapult ex");
  });

  it("throws on missing card", () => {
    const registry = loadCardRegistry({ cards: [] });
    expect(() => registry.get("missing")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test cards.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement src/cards/registry.ts**

```typescript
import type { Card } from "../types";

export function loadCardRegistry(cardsJson: { cards: Card[] }) {
  const registry = new Map<string, Card>();

  for (const card of cardsJson.cards) {
    registry.set(card.id, card);
  }

  return {
    get(cardId: string): Card {
      const card = registry.get(cardId);
      if (!card) {
        throw new Error(`Card not found: ${cardId}`);
      }
      return card;
    },
    has(cardId: string): boolean {
      return registry.has(cardId);
    },
  };
}

export type CardRegistry = ReturnType<typeof loadCardRegistry>;
```

- [ ] **Step 4: Create src/cards/schema.ts**

```typescript
// Exports already defined in types.ts
export type { Card, Attack, Ability } from "../types";
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test cards.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add ts/packages/engine/src/cards/ ts/packages/engine/test/cards.test.ts
git commit -m "feat(engine): add card registry and loader"
```

---

## Phase 5: Action Implementations

### Task 7: Implement EndTurn action

**Files:**
- Modify: `ts/packages/engine/src/actions/index.ts`
- Create: `ts/packages/engine/src/actions/endTurn.ts`
- Create: `ts/packages/engine/test/actions.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// test/actions.test.ts (partial)
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- actions.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement src/actions/endTurn.ts**

```typescript
import { GameState, Action, ActionHandler } from "../types";

export const endTurnHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "endTurn") return false;
    return action.player === state.activePlayer;
  },

  apply(state: GameState, action: Action): GameState {
    const otherPlayer = action.player === "p1" ? "p2" : "p1";
    const newTurn = action.player === "p2" ? state.turn + 1 : state.turn;

    return {
      ...state,
      turn: newTurn,
      activePlayer: otherPlayer,
      players: {
        ...state.players,
        [action.player]: {
          ...state.players[action.player],
          energyAttachedThisTurn: false,
          supporterPlayedThisTurn: false,
        },
      },
      log: [
        ...state.log,
        {
          timestamp: Date.now(),
          player: action.player,
          message: `${action.player} ended turn`,
        },
      ],
    };
  },
};
```

- [ ] **Step 4: Update src/actions/index.ts**

```typescript
import { endTurnHandler } from "./endTurn";

actionRegistry.set("endTurn", endTurnHandler);
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test -- actions.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add ts/packages/engine/src/actions/endTurn.ts ts/packages/engine/test/actions.test.ts
git commit -m "feat(engine): implement endTurn action"
```

### Task 8: Implement PlayPokemon action

**Files:**
- Modify: `ts/packages/engine/src/actions/index.ts`
- Create: `ts/packages/engine/src/actions/playPokemon.ts`
- Modify: `ts/packages/engine/test/actions.test.ts`

- [ ] **Step 1: Add test for playPokemon**

```typescript
it("plays basic Pokémon to bench", () => {
  let state = createInitialState(["dragapult-ex"], ["zoroark-ex"]);
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
  const state = createInitialState(["stage-1-card"], ["card-2"]);
  state.players.p1.hand = [{ id: "stage-1-card", cardId: "stage-1-card", instanceId: "inst-1" }];

  expect(() => applyAction(state, {
    type: "playPokemon",
    player: "p1",
    cardId: "stage-1-card",
  })).toThrow();
});

it("requires bench to have space", () => {
  const state = createInitialState(["card-1"], ["card-2"]);
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- actions.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement src/actions/playPokemon.ts**

```typescript
import { GameState, Action, ActionHandler, CardInstance } from "../types";
import { getCardRegistry } from "../cards/registry";

export const playPokemonHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "playPokemon") return false;
    const player = state.players[action.player];
    
    if (player.bench.length >= 5) return false; // Bench full
    
    const card = player.hand.find(c => c.cardId === action.cardId);
    if (!card) return false;

    const registry = getCardRegistry();
    const cardData = registry.get(card.cardId);
    if (cardData.type !== "pokemon" || cardData.stage !== 0) return false; // Must be basic

    return action.player === state.activePlayer && state.phase === "main";
  },

  apply(state: GameState, action: Action): GameState {
    const player = state.players[action.player];
    const cardInstance = player.hand.find(c => c.cardId === action.cardId)!;

    return {
      ...state,
      players: {
        ...state.players,
        [action.player]: {
          ...player,
          hand: player.hand.filter(c => c !== cardInstance),
          bench: [
            ...player.bench,
            {
              card: cardInstance,
              damage: 0,
              attachedEnergy: [],
              attachedTools: [],
              statusConditions: [],
            },
          ],
        },
      },
      log: [
        ...state.log,
        {
          timestamp: Date.now(),
          player: action.player,
          message: `${action.player} played basic Pokémon to bench`,
        },
      ],
    };
  },
};
```

- [ ] **Step 4: Update src/actions/index.ts**

```typescript
import { playPokemonHandler } from "./playPokemon";
actionRegistry.set("playPokemon", playPokemonHandler);
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test -- actions.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add ts/packages/engine/src/actions/playPokemon.ts ts/packages/engine/test/actions.test.ts
git commit -m "feat(engine): implement playPokemon action"
```

### Task 9: Implement Evolve action

(Similar pattern: test → implement → register → commit)

Test cases: must have valid `evolvesFrom` match, target must be in play (bench or active), evolution must be stage N+1, can only evolve once per turn per Pokémon.

```typescript
// src/actions/evolve.ts
export const evolveHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "evolve") return false;
    const player = state.players[action.player];
    const card = player.hand.find(c => c.cardId === action.cardId);
    if (!card) return false;

    const registry = getCardRegistry();
    const cardData = registry.get(card.cardId);
    if (cardData.type !== "pokemon" || !cardData.evolvesFrom) return false;

    const target = [player.active, ...player.bench].find(
      p => p?.card.instanceId === action.targetInstanceId
    );
    if (!target) return false;

    const targetData = registry.get(target.card.cardId);
    if (targetData.type !== "pokemon" || targetData.name !== cardData.evolvesFrom) return false;

    return action.player === state.activePlayer && state.phase === "main";
  },

  apply(state: GameState, action: Action): GameState {
    // Remove card from hand, replace target in bench/active
    // ...
  },
};
```

### Task 10: Implement AttachEnergy action

Test: max 1/turn, target must be Pokémon in play.

```typescript
// src/actions/attachEnergy.ts
export const attachEnergyHandler: ActionHandler = {
  isLegal(state: GameState, action: Action): boolean {
    if (action.type !== "attachEnergy") return false;
    if (state.players[action.player].energyAttachedThisTurn) return false;
    
    const player = state.players[action.player];
    const card = player.hand.find(c => c.cardId === action.cardId);
    if (!card) return false;

    const registry = getCardRegistry();
    const cardData = registry.get(card.cardId);
    if (cardData.type !== "energy") return false;

    const target = [player.active, ...player.bench].find(
      p => p?.card.instanceId === action.targetInstanceId
    );
    return !!target && action.player === state.activePlayer && state.phase === "main";
  },

  apply(state: GameState, action: Action): GameState {
    // Add energy to target, mark energyAttachedThisTurn=true
    // ...
  },
};
```

### Task 11: Implement PlayTrainer action

Test: supporters max 1/turn, items/tools unlimited, apply item/supporter effects via DSL.

### Task 12: Implement Retreat action

Test: cost in energy ≤ attached energy, switches active to bench slot, cost energy to discard.

### Task 13: Implement Attack action

Test: energy ≥ cost, status checks (Confused flip, Paralyzed prevention), triggers attackFlow pipeline.

### Task 14: Register all actions

Update `src/actions/index.ts` to register all 7 handlers. Update `legalActions.ts` to enumerate all action types.

---

## Phase 6: Legal Actions Enumeration

### Task 9: Implement legalActions function

**Files:**
- Create: `ts/packages/engine/src/legalActions.ts`
- Create: `ts/packages/engine/test/legalActions.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// test/legalActions.test.ts
import { describe, it, expect } from "vitest";
import { legalActions } from "../src/legalActions";
import { createInitialState } from "../src/state";

describe("Legal actions", () => {
  it("includes endTurn in main phase", () => {
    const state = createInitialState(["card-1"], ["card-2"]);
    const actions = legalActions(state, "p1");

    const endTurn = actions.find((a) => a.type === "endTurn");
    expect(endTurn).toBeDefined();
  });

  it("excludes endTurn in setup phase", () => {
    const state = createInitialState(["card-1"], ["card-2"]);
    state.phase = "setup";
    const actions = legalActions(state, "p1");

    const endTurn = actions.find((a) => a.type === "endTurn");
    expect(endTurn).toBeUndefined();
  });

  it("enumerates playable cards from hand", () => {
    const state = createInitialState(["card-1"], ["card-2"]);
    state.players.p1.hand.push({
      id: "card-1",
      cardId: "card-1",
      instanceId: "inst-1",
    });
    const actions = legalActions(state, "p1");

    const playActions = actions.filter((a) => a.type === "playPokemon");
    expect(playActions.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- legalActions.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement src/legalActions.ts**

```typescript
import { GameState, Action } from "./types";
import { actionRegistry } from "./actions";

export function legalActions(
  state: GameState,
  player: "p1" | "p2"
): Action[] {
  const legal: Action[] = [];

  if (player !== state.activePlayer) {
    return legal;
  }

  // Enumerate possible actions for each type
  for (const [actionType, handler] of actionRegistry) {
    if (actionType === "endTurn") {
      const action = { type: "endTurn", player } as any;
      if (handler.isLegal(state, action)) {
        legal.push(action);
      }
    }

    if (actionType === "playPokemon") {
      for (const card of state.players[player].hand) {
        const action = { type: "playPokemon", player, cardId: card.cardId };
        if (handler.isLegal(state, action as any)) {
          legal.push(action as any);
        }
      }
    }

    // Similar for other action types...
  }

  return legal;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- legalActions.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ts/packages/engine/src/legalActions.ts ts/packages/engine/test/legalActions.test.ts
git commit -m "feat(engine): add legal actions enumeration"
```

---

## Phase 7: Attack Flow Pipeline

### Task 10: Implement attack flow pipeline

**Files:**
- Create: `ts/packages/engine/src/attackFlow.ts`
- Create: `ts/packages/engine/test/attackFlow.test.ts`

Follow the 8-step official flow chart. Each step is a pure function that transforms state. Test damage calculation, KO handling, simultaneous discard, prize award with tiebreak, bench refill.

---

## Phase 8: Engine Tests

### Task 11: Write golden-path game test

**Files:**
- Modify: `ts/packages/engine/test/gameFlow.test.ts` (new file)

Test a complete game loop using scripted moves (Dragapult ex vs N's Zoroark ex), verify game terminates when one player runs out of prizes.

---

## Phase 9: Data Pipeline Setup & Scrapers

### Task 15: Create data pipeline package & Bulbapedia scraper

**Files:**
- Create: `ts/packages/data-pipeline/package.json`
- Create: `ts/packages/data-pipeline/tsconfig.json`
- Create: `ts/packages/data-pipeline/src/types.ts`
- Create: `ts/packages/data-pipeline/src/scrapeBulbapedia.ts`
- Create: `ts/packages/data-pipeline/test/scraper.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@pokemon-tcg/data-pipeline",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "scrape": "node dist/index.js",
    "build": "tsc",
    "test": "vitest"
  },
  "dependencies": {
    "@pokemon-tcg/engine": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "vitest": "workspace:*"
  }
}
```

- [ ] **Step 2: Define types in src/types.ts**

```typescript
export interface ScrapedCard {
  name: string;
  hp?: number;
  stage?: 0 | 1 | 2;
  evolvesFrom?: string;
  types: string[];
  weakness?: { type: string; mult: number };
  resistance?: { type: string; reduce: number };
  retreatCost: number;
  attacksRaw: Array<{ name: string; cost: string[]; damage: number; text?: string }>;
  abilities?: Array<{ name: string; text: string }>;
}

export interface DeckList {
  name: string;
  cards: Array<{ cardName: string; count: number }>;
}
```

- [ ] **Step 3: Write failing test for scraper**

```typescript
// test/scraper.test.ts
import { describe, it, expect } from "vitest";
import { scrapeBulbapediaCard } from "../src/scrapeBulbapedia";
import { readFileSync } from "fs";
import { join } from "path";

describe("Bulbapedia scraper", () => {
  it("parses card data from HTML fixture", () => {
    const html = readFileSync(
      join(__dirname, "fixtures/dragapult-ex.html"),
      "utf-8"
    );
    const card = scrapeBulbapediaCard(html, "dragapult-ex");

    expect(card.name).toBe("Dragapult ex");
    expect(card.hp).toBe(250);
    expect(card.stage).toBe(2);
    expect(card.evolvesFrom).toBe("Drakloak");
  });
});
```

- [ ] **Step 4: Implement src/scrapeBulbapedia.ts**

```typescript
import { ScrapedCard } from "./types";

export function scrapeBulbapediaCard(html: string, cardId: string): ScrapedCard {
  // Simple regex-based extraction (minimal parser)
  const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const hpMatch = html.match(/HP:?\s*(\d+)/);
  const stageMatch = html.match(/Stage:?\s*(\d+)/);
  const evolvesMatch = html.match(/Evolves from:?\s*([^<]+)/);
  const retreatMatch = html.match(/Retreat Cost:?\s*(\d+)/);

  if (!nameMatch) throw new Error("Could not parse card name");

  return {
    name: nameMatch[1],
    hp: hpMatch ? parseInt(hpMatch[1]) : undefined,
    stage: stageMatch ? (parseInt(stageMatch[1]) as 0 | 1 | 2) : 0,
    evolvesFrom: evolvesMatch ? evolvesMatch[1].trim() : undefined,
    types: [],
    retreatCost: retreatMatch ? parseInt(retreatMatch[1]) : 0,
    attacksRaw: [],
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd ts/packages/data-pipeline
pnpm test
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add ts/packages/data-pipeline/
git commit -m "feat(data-pipeline): add Bulbapedia scraper"
```

### Task 16: Add limitlesstcg decklists scraper

**Files:**
- Modify: `ts/packages/data-pipeline/src/scrapeLimitless.ts` (new)
- Modify: `ts/packages/data-pipeline/test/scraper.test.ts`

Similar pattern: test fixture HTML → parse decklists → return list of card names + counts.

### Task 17: Build card JSON output

**Files:**
- Create: `ts/packages/data-pipeline/src/buildCardJson.ts`
- Create: `ts/packages/data-pipeline/src/index.ts` (CLI)
- Modify: `ts/packages/data-pipeline/test/cardBuilder.test.ts`

CLI task: `pnpm --filter data-pipeline run scrape` invokes `buildCardJson.ts`, which:
1. Calls scrapeBulbapedia for each card in target decks
2. Calls scrapeLimitless for decklists
3. For each scraped card, hand-author its DSL effect tree (stored in a `.ts` module)
4. Output `packages/data-pipeline/out/cards.json` + `out/decks/*.json`

Test: snapshot test output JSON matches `Card` schema from engine.

---

## Phase 10: UI Setup

### Task 18: Create React/Vite UI package

**Files:**
- Create: `ts/packages/ui/package.json`
- Create: `ts/packages/ui/tsconfig.json`
- Create: `ts/packages/ui/vite.config.ts`
- Create: `ts/packages/ui/index.html`
- Create: `ts/packages/ui/src/index.tsx`
- Create: `ts/packages/ui/src/App.tsx`
- Create: `ts/packages/ui/src/types.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@pokemon-tcg/ui",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@pokemon-tcg/engine": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "vitest": "workspace:*"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
});
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pokémon TCG</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create src/index.tsx**

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Create src/types.ts**

```typescript
export interface UIState {
  selectedCardInstanceId?: string;
  pendingTargetInstanceId?: string;
  gameMode: "hotseat" | "vs-bot";
  botDelay: number; // ms
}
```

- [ ] **Step 6: Create minimal src/App.tsx**

```typescript
import { useState } from "react";
import { createInitialState, GameState } from "@pokemon-tcg/engine";
import { UIState } from "./types";

export function App() {
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialState(["dragapult-ex", "dragapult-ex"], ["zoroark-ex", "zoroark-ex"])
  );
  const [uiState, setUIState] = useState<UIState>({
    gameMode: "hotseat",
    botDelay: 1000,
  });

  return (
    <div className="app">
      <h1>Pokémon TCG</h1>
      <div>Game setup in progress...</div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add ts/packages/ui/
git commit -m "chore(ui): initialize React/Vite project"
```

---

## Phase 11: UI Components & Controllers

### Task 19: Implement view components (Board, Hand, ActionBar, Log)

**Files:**
- Create: `ts/packages/ui/src/views/Board.tsx`
- Create: `ts/packages/ui/src/views/Hand.tsx`
- Create: `ts/packages/ui/src/views/ActionBar.tsx`
- Create: `ts/packages/ui/src/views/Log.tsx`
- Create: `ts/packages/ui/src/views/ActiveSpot.tsx`
- Create: `ts/packages/ui/src/views/PrizeRow.tsx`
- Create: `ts/packages/ui/test/views.test.tsx`

Each view is a pure React component that takes props (game state + callbacks) and renders JSX:

```typescript
// src/views/Board.tsx
export function Board({
  gameState,
  selectedCardInstanceId,
  onSpotClick,
}: {
  gameState: GameState;
  selectedCardInstanceId?: string;
  onSpotClick: (instanceId: string) => void;
}) {
  return (
    <div className="board">
      <div className="opponent-row">
        <div className="opponent-prizes">
          <PrizeRow player="p2" count={gameState.players.p2.prizes.length} />
        </div>
        <div className="opponent-bench">
          {gameState.players.p2.bench.map(pokemon => (
            <BenchSpot
              key={pokemon.card.instanceId}
              pokemon={pokemon}
              selected={selectedCardInstanceId === pokemon.card.instanceId}
              onClick={() => onSpotClick(pokemon.card.instanceId)}
            />
          ))}
        </div>
        <div className="opponent-active">
          {gameState.players.p2.active && (
            <ActiveSpot
              pokemon={gameState.players.p2.active}
              selected={selectedCardInstanceId === gameState.players.p2.active.card.instanceId}
              onClick={() => onSpotClick(gameState.players.p2.active!.card.instanceId)}
            />
          )}
        </div>
      </div>
      {/* ... player 1 row ... */}
    </div>
  );
}
```

Test: verify Board renders all spots, clicking spot calls handler.

### Task 20: Implement controller layer

**Files:**
- Create: `ts/packages/ui/src/controllers/boardController.ts`
- Create: `ts/packages/ui/src/controllers/actionBarController.ts`
- Create: `ts/packages/ui/src/controllers/botController.ts`
- Create: `ts/packages/ui/test/controllers.test.ts`

Controllers own click/action logic, not views:

```typescript
// src/controllers/boardController.ts
export function handleSpotClick(
  gameState: GameState,
  uiState: UIState,
  instanceId: string
): { uiState: UIState; actions?: Action[] } {
  // Determine if this is attack target selection, evolution target, etc.
  // Return updated UI state + any pending actions
}

// src/controllers/actionBarController.ts
export function handleActionButtonClick(
  gameState: GameState,
  action: Action,
  dispatch: (action: Action) => void
): void {
  dispatch(action);
}

// src/controllers/botController.ts
export function getBotMove(gameState: GameState): Action {
  const legal = legalActions(gameState, gameState.activePlayer);
  return legal[Math.floor(Math.random() * legal.length)];
}
```

Test: given state + click, verify correct action dispatched.

---

## Phase 12: Integration & Manual Testing

### Task 21: Wire App.tsx dispatcher + bot loop + views

**Files:**
- Modify: `ts/packages/ui/src/App.tsx`

Connect reducer + controllers + views:

```typescript
import { applyAction, legalActions } from "@pokemon-tcg/engine";
import { handleSpotClick } from "./controllers/boardController";
import { getBotMove } from "./controllers/botController";

export function App() {
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialState([...dragapultDeck], [...zoroarkDeck])
  );
  const [uiState, setUIState] = useState<UIState>({ gameMode: "vs-bot", botDelay: 1000 });

  const handleAction = (action: Action) => {
    const newState = applyAction(gameState, action);
    setGameState(newState);

    if (uiState.gameMode === "vs-bot" && newState.activePlayer === "p2") {
      setTimeout(() => {
        const botMove = getBotMove(newState);
        setGameState(applyAction(newState, botMove));
      }, uiState.botDelay);
    }
  };

  const handleSpotClickWrapper = (instanceId: string) => {
    const { uiState: newUIState, actions } = handleSpotClick(gameState, uiState, instanceId);
    setUIState(newUIState);
    if (actions?.length === 1) {
      handleAction(actions[0]);
    }
  };

  return (
    <div className="container">
      <Board gameState={gameState} onSpotClick={handleSpotClickWrapper} />
      <Hand gameState={gameState} onCardClick={...} />
      <ActionBar
        legalActions={legalActions(gameState, gameState.activePlayer)}
        onAction={handleAction}
      />
      <Log log={gameState.log} />
    </div>
  );
}
```

- [ ] **Step 1: Implement dispatch loop with bot integration**
- [ ] **Step 2: Render board, hand, action bar, log**
- [ ] **Step 3: Test manually: start dev server, play a game hotseat**
- [ ] **Step 4: Test manually: vs bot, verify legal moves only**
- [ ] **Step 5: Commit**

```bash
git add ts/packages/ui/src/App.tsx
git commit -m "feat(ui): integrate game state and bot loop"
```

### Task 22: Playable milestone test

- [ ] **Step 1: Run dev server**

```bash
cd ts/packages/ui
pnpm dev
```

- [ ] **Step 2: Play a full game hotseat (both players, same screen)**

Verify:
- Draw phase automatic (or triggered)
- Main phase: can play Pokémon, attach energy, play trainers
- Attack phase: can attack with legal energy + no status disables
- After KO: prizes awarded correctly, bench refilled
- Game ends when one player has no prizes left

- [ ] **Step 3: Play vs bot**

Verify:
- Bot picks only legal moves
- Bot loop doesn't crash
- Decks don't run out (fixture small decks, OK for now)

- [ ] **Step 4: Commit final playable state**

```bash
git add .
git commit -m "feat: playable Pokémon TCG hotseat + bot (Dragapult ex vs N's Zoroark ex)"
```

---

## Summary

**Total Tasks:** 22 major milestones
1. Monorepo setup (1)
2. Engine foundation: types, state, reducer, cards (4)
3. Effect system: DSL, interpreter, primitives (3)
4. Actions: 7 action handlers + registry (8)
5. Legal actions enumeration (1)
6. Attack flow pipeline (1)
7. Golden-path game test (1)
8. Data pipeline: scrapers + builder (3)
9. UI setup: React/Vite (1)
10. UI components: views + controllers (2)
11. UI integration + manual testing (1)

**Commits per phase:** ~2-3 commits per phase, ~25-30 total commits
**Dependencies:** Engine foundation → actions/effects → attack flow → data pipeline (independent) | UI setup → components → integration
**Playable Milestone:** After phase 7 (engine + tests complete); UI can develop in parallel
**Testing Strategy:** TDD per task (failing test → implement → pass → commit), snapshot tests for data pipeline, light controller tests for UI

