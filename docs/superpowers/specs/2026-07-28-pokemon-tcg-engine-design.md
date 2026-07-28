# Pokémon TCG Game Engine — Design Spec

Date: 2026-07-28

## 1. Goal & scope

Long-term goal: simulate Pokémon TCG matches to derive win/loss statistics via AI (MCTS/self-play). That AI phase is **out of scope** for this spec — deferred to a future design.

This spec covers: the rules engine, card/effect data model, offline data pipeline (scraper), and a playable UI. Playable milestone: two Standard-format decks (Dragapult ex, N's Zoroark ex) playable end-to-end, human vs human (hotseat) or human vs a trivial random-legal-move bot.

Non-goals (this spec): full 2000+ card Standard card pool (engine supports it architecturally; content added incrementally later), AI opponent smarter than random, animations, multiplayer/networking, Go backend (directory reserved, not built).

## 2. Approach

TypeScript throughout (chosen over Python) so a UI can be layered on directly. Architecture mirrors the "headless core / separate GUI" split used by ygopro/edopro (Yu-Gi-Oh): engine package has zero DOM/React dependency; UI depends on engine, never the reverse.

Key decisions:
- **Immutable state + pure reducer** (`applyAction(state, action) => newState`) — makes future MCTS state-cloning free (no deep-copy/restore).
- **Data-driven effect DSL** (JSON-serializable effect trees) instead of one class/file per card — keeps ~2000+ future cards maintainable; most new cards need zero new code, just DSL authoring.
- **Attack resolution as an ordered pipeline** derived 1:1 from the official Pokémon attack flow chart (asia.pokemon-card.com attack_flow_chart_EN.pdf).
- **Card data from Bulbapedia/pokemon.com scraping**, not the Pokémon TCG API — offline pipeline, output committed as static JSON, re-run weekly via cron.
- **Legal-action enumeration** as single source of truth, shared by UI (button enable/disable) and bot (random legal move).

## 3. Repo structure

```
pokemon/
  README.md
  docs/
    superpowers/specs/       # design docs land here
  ts/                         # pnpm workspace root — all TS code
    package.json
    pnpm-workspace.yaml
    packages/
      engine/                 # pure TS, zero DOM/React deps
        src/
          state.ts             # GameState type, initial state builder
          actions.ts           # Action union type
          reducer.ts           # thin dispatcher -> actions/index.ts registry
          attackFlow.ts        # attack resolution pipeline (flow chart steps 1-8)
          actions/              # one file per action type
            attachEnergy.ts     # { isLegal(state, action), apply(state, action) }
            playPokemon.ts
            evolve.ts
            playTrainer.ts
            retreat.ts
            attack.ts
            endTurn.ts
            index.ts            # registry used by reducer.ts + legalActions.ts
          legalActions.ts       # thin: loops registry, collects legal actions
          effects/
            dsl.ts               # effect primitive types + interpreter
            primitives.ts        # dealDamage, discardEnergy, flipCoin, heal, applyCondition...
          cards/
            schema.ts            # Card data type
            registry.ts          # card-id -> Card lookup, loaded from cards.json
        test/
      data-pipeline/           # scraper, run offline via weekly cron, not a runtime dep
        src/
          scrapeBulbapedia.ts
          scrapeLimitless.ts
          buildCardJson.ts
        out/
          cards.json            # generated, committed
          decks/dragapult-ex.json
          decks/n-zoroark-ex.json
      ui/                      # React + Vite, MVC split
        src/
          models/               # UI-only view-state (selection, pending target) — not GameState
            selection.ts
          views/                # pure render, props in / JSX out, no dispatch or logic
            Board.tsx
            ActiveSpot.tsx
            BenchSpot.tsx
            Hand.tsx
            PrizeRow.tsx
            ActionBar.tsx
            Log.tsx
          controllers/          # click handling, Action building, dispatch, bot loop
            boardController.ts
            actionBarController.ts
            botController.ts
          App.tsx               # wires model + controllers + views
        index.html
        vite.config.ts
  # future: go/ for backend (server, matchmaking, persistence) — not built yet
```

## 4. Engine state model & turn structure

```ts
type GameState = {
  turn: number;
  activePlayer: "p1" | "p2";
  phase: "setup" | "main" | "attackResolution" | "checkup" | "gameOver";
  players: Record<"p1"|"p2", PlayerState>;
  winner?: "p1" | "p2" | "draw";
  log: LogEntry[];
};

type PlayerState = {
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  prizes: CardInstance[];        // face-down, count = remaining prizes
  active: PokemonInPlay | null;
  bench: PokemonInPlay[];        // max 5
  energyAttachedThisTurn: boolean;
  supporterPlayedThisTurn: boolean;
};

type PokemonInPlay = {
  card: CardInstance;
  damage: number;
  attachedEnergy: CardInstance[];
  attachedTools: CardInstance[];
  statusConditions: StatusCondition[]; // Confused, Asleep, Paralyzed, Poisoned, Burned
};
```

Turn structure: draw phase → main phase (basic play, evolve, energy attach [max 1/turn], trainers/supporters [max 1 supporter/turn]/tools, retreat [max 1/turn], attack ends main phase) → attack resolution → checkup phase (status effects, simultaneous KO resolution) → pass turn.

Attack resolution pipeline (from official flow chart, in `attackFlow.ts`):
1. Check can-attack (energy attached, not disabled)
2. Announce (resolve status-condition coin flips, e.g. Confused)
3. Target selection
4. Resolve pre-damage-only effects
5. Damage calculation, 5 sub-steps: base → attacker boosts (exit if ≤0) → weakness → resistance → defender reduction (exit if ≤0) → final damage
6. Resolve attack's own effect text
7. Resolve defender-triggered effects (e.g. Rocky Helmet)
8. Simultaneous knockout check + Knock Out Resolution: check HP → resolve KO-triggered abilities/items → simultaneous discard → prize award (next-turn-player-first tiebreak) → bench refill (same tiebreak) → end turn/checkup

## 5. Card data model & effect DSL

```ts
type Card =
  | { type: "pokemon"; id: string; name: string; hp: number; stage: 0|1|2;
      evolvesFrom?: string; types: PokemonType[]; weakness?: {type: PokemonType; mult: 2};
      resistance?: {type: PokemonType; reduce: 30}; retreatCost: number;
      abilities: Ability[]; attacks: Attack[] }
  | { type: "energy"; id: string; name: string; providesType: PokemonType | "any"; special?: EffectScript }
  | { type: "trainer"; id: string; name: string; subtype: "supporter"|"item"|"tool"|"stadium"; effect: EffectScript };

type Attack = { name: string; cost: PokemonType[]; baseDamage: number;
                effect?: EffectScript; requiresTarget?: boolean };

type EffectScript = EffectNode[];
type EffectNode =
  | { op: "dealDamage"; amount: number | "coinFlipDouble"; target: "defender"|"self"|"allBench" }
  | { op: "flipCoin"; onHeads: EffectNode[]; onTails: EffectNode[] }
  | { op: "discardEnergy"; from: "self"|"defender"; count: number; energyType?: PokemonType }
  | { op: "applyStatus"; condition: StatusCondition; target: "defender"|"self" }
  | { op: "heal"; amount: number; target: "self" }
  | { op: "drawCards"; count: number }
  | { op: "modifyDamageTaken"; amount: number; timing: "beforeDamage" }
  | { op: "modifyDamageDealt"; amount: number; timing: "attackerBoost" }
  | { op: "custom"; fn: string };  // escape hatch into cards/customEffects.ts
```

Card registry: `Map<cardId, Card>`, loaded from `cards.json` at startup.

## 6. Data pipeline

Offline, output committed, **runs weekly via cron** (re-scrapes Bulbapedia/limitlesstcg, rebuilds `cards.json`/decks, diffs against committed version — human reviews/commits changes, no auto-commit).

- `scrapeBulbapedia.ts`: card pages for the decks' unique cards — name, HP, type, weakness/resistance, retreat cost, attack costs/damage, raw effect text.
- `scrapeLimitless.ts`: decklists (60-card lists with counts) from limitlesstcg.com/decks.
- `buildCardJson.ts`: joins both, hand-authors `EffectScript` DSL per card's effect text (manual, one-time per card), writes `out/cards.json` + `out/decks/*.json`.

CLI: `pnpm --filter data-pipeline run scrape`. Cron just invokes this CLI on schedule — actual wiring (cron job / GH Action) decided at implementation-plan stage, not here.

Legality: v1 hardcodes the 2 decks as legal, no rotation logic, no `legalIn` field yet.

## 7. UI

React + Vite, hotseat (both players same browser tab) or vs random bot. MVC split:

- **models/** — UI-only view-state (selected card, pending attack target), not `GameState` (engine owns that).
- **views/** — pure render, props in / JSX out, no dispatch or logic: `Board`, `ActiveSpot`, `BenchSpot`, `Hand`, `PrizeRow`, `ActionBar`, `Log`.
- **controllers/** — click handling, builds `Action` objects, dispatches to engine reducer, updates UI model: `boardController`, `actionBarController`, `botController`.

Flow: click card/spot → if ambiguous (e.g. attack needs target) → click target → controller dispatches action → reducer runs → re-render. Bot mode: after human's turn ends, `botController` calls `legalActions()`, picks random, dispatches, loops until bot's turn ends.

No animation/transitions v1 — instant state snap, log is source of truth for "what happened."

## 8. Testing strategy

- **Engine**: unit tests per action file (`actions/attack.test.ts` etc) — legality edge cases + apply correctness. `attackFlow.test.ts` — full pipeline scenarios (weakness/resistance math, KO simultaneous discard, prize/tiebreak order, exit-early on ≤0 damage). Each DSL primitive tested. Golden-path test: full Dragapult ex vs N's Zoroark ex game via scripted action sequence, assert final state.
- **Data pipeline**: snapshot test scraper output shape using checked-in fixture HTML (no live network in CI), assert `buildCardJson.ts` output matches `Card` schema.
- **UI**: no e2e v1 (add if UI bugs recur). Controllers get light unit tests (given state + click, dispatches expected action). Views untested (pure render, low risk).
- Test runner: Vitest across the whole monorepo.
