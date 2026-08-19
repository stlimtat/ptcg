import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import { Card } from "../src/types.js";
import { startGame } from "../src/state.js";
import { runEpisode } from "../src/rl/episode.js";
import { heuristicPolicy } from "../src/rl/policies.js";

/**
 * Every deck on disk — imported from tournaments or produced by deckSearch —
 * has to be legal and playable. A search that drifts into an unplayable list
 * would otherwise show up as a mysterious win rate rather than an error.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = JSON.parse(fs.readFileSync(path.join(root, "data/cards.json"), "utf8"));
const registry: Record<string, Card> = Object.fromEntries(pool.cards.map((c: any) => [c.id, c]));

const deckDir = path.join(root, "data/decks");
const deckFiles = fs.readdirSync(deckDir).filter((f) => f.endsWith(".json") && f !== "index.json");
const deckOf = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(deckDir, file), "utf8")).cards as string[];

describe.each(deckFiles)("deck %s", (file) => {
  const cards = deckOf(file);

  it("is exactly 60 known cards", () => {
    expect(cards).toHaveLength(60);
    expect(cards.every((id) => !!registry[id])).toBe(true);
  });

  it("respects the 4-copy limit, which Basic Energy is exempt from", () => {
    const counts: Record<string, number> = {};
    for (const id of cards) {
      const def: any = registry[id];
      if (def.type === "energy" && def.basic) continue;
      counts[def.name] = (counts[def.name] ?? 0) + 1;
    }
    const over = Object.entries(counts).filter(([, n]) => n > 4);
    expect(over).toEqual([]);
  });

  it("can open a game, so it holds a Basic Pokémon", () => {
    const basics = cards.filter((id) => {
      const def = registry[id];
      return def.type === "pokemon" && def.stage === 0;
    });
    expect(basics.length).toBeGreaterThan(0);

    // A hand with no Basic mulligans; the engine must still reach a promotion.
    const state = startGame(cards, cards, registry, 1);
    expect(state.pendingPromote).toContain("p1");
  });
});

it("plays every deck to a finish against a fixed opponent", () => {
  const opponent = deckOf(deckFiles[0]);
  for (const file of deckFiles) {
    const result = runEpisode(deckOf(file), opponent, registry, {
      p1: heuristicPolicy(() => 0.5),
      p2: heuristicPolicy(() => 0.5),
    }, { seed: 3, recordTransitions: false });
    expect(result.winner, `${file} did not finish: ${result.reason}`).toBeTruthy();
  }
}, 120000);
