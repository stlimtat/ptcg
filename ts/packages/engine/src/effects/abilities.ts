import { CardInstance, GameState, Player, PokemonInPlay } from "../types.js";
import { getCard, getPokemon } from "../cardLookup.js";
import { ask, effectSteps, EffectStep } from "./choice.js";
import { shuffleDeck } from "./shuffle.js";
import { applyDamage } from "../attackFlow.js";
import { abilitiesLocked, effectiveHp } from "./continuous.js";

/**
 * Activated abilities — the "Once during your turn, you may …" kind. They are
 * used through the `useAbility` action, once per Pokémon per turn.
 *
 * Continuous abilities (Fairy Zone, Skyliner, …) are a different beast: they
 * change rules while in play rather than doing something once, and are not
 * handled here.
 */
const opponentOf = (p: Player): Player => (p === "p1" ? "p2" : "p1");

function patch(state: GameState, player: Player, fields: Partial<GameState["players"][Player]>): GameState {
  return { ...state, players: { ...state.players, [player]: { ...state.players[player], ...fields } } };
}

const pokemonInPlay = (ps: GameState["players"][Player]): PokemonInPlay[] =>
  [ps.active, ...ps.bench].filter((p): p is PokemonInPlay => !!p);

function draw(state: GameState, player: Player, count: number): GameState {
  const ps = state.players[player];
  const n = Math.min(count, ps.deck.length);
  return patch(state, player, { deck: ps.deck.slice(n), hand: [...ps.hand, ...ps.deck.slice(0, n)] });
}

/** Pull the chosen cards out of the deck into hand, then shuffle. */
function takeFromDeck(state: GameState, player: Player, picked: CardInstance[]): GameState {
  const ids = new Set(picked.map((c) => c.instanceId));
  const ps = state.players[player];
  return shuffleDeck(
    patch(state, player, { deck: ps.deck.filter((c) => !ids.has(c.instanceId)), hand: [...ps.hand, ...picked] }),
    player
  );
}

const hasEnergyType = (state: GameState, poke: PokemonInPlay, type: string) =>
  poke.attachedEnergy.some((e) => {
    const def = getCard(state, e.cardId);
    return def?.type === "energy" && def.providesType === type;
  });

export interface AbilityImpl {
  /** Can it be used right now, by this Pokémon? */
  usable: (state: GameState, player: Player, source: PokemonInPlay) => boolean;
  steps: EffectStep[];
}

export const abilities: Record<string, AbilityImpl> = {
  // Drakloak — look at the top 2, keep 1, bottom the other.
  "Recon Directive": {
    usable: (state, player) => state.players[player].deck.length > 0,
    steps: [
      (state, player) =>
        ask(state, {
          player,
          prompt: "Look at the top 2 cards of your deck and put 1 into your hand",
          options: state.players[player].deck.slice(0, 2).map((c) => c.instanceId),
          remaining: 1,
          optional: false,
          effect: "Recon Directive",
          step: 1,
        }),
      (state, player, picked) => {
        const keep = picked[0];
        if (!keep) return state;
        const ps = state.players[player];
        const top2 = ps.deck.slice(0, 2);
        const other = top2.find((c) => c.instanceId !== keep.instanceId);
        return patch(state, player, {
          hand: [...ps.hand, keep],
          deck: [...ps.deck.slice(2), ...(other ? [other] : [])],
        });
      },
    ],
  },

  // Fezandipiti ex — draw 3 after a knockout on the opponent's last turn.
  "Flip the Script": {
    usable: (state, player) => state.players[player].koedLastTurn === true,
    steps: [(state, player) => draw(state, player, 3)],
  },

  // Mega Kangaskhan ex — draw 2 while Active.
  "Run Errand": {
    usable: (state, player, source) => state.players[player].active === source,
    steps: [(state, player) => draw(state, player, 2)],
  },

  // Dudunsparce — draw 3, then shuffle itself back into the deck.
  "Run Away Draw": {
    usable: (state, player) => state.players[player].deck.length > 0,
    steps: [
      (state, player, _picked, args) => {
        const sourceId = String(args?.[0] ?? "");
        const next = draw(state, player, 3);
        const ps = next.players[player];
        const source = pokemonInPlay(ps).find((p) => p.card.instanceId === sourceId);
        if (!source) return next;
        const returned: CardInstance[] = [source.card, ...source.attachedEnergy, ...source.attachedTools];
        const withoutSource = patch(next, player, {
          active: ps.active === source ? null : ps.active,
          bench: ps.bench.filter((p) => p !== source),
          deck: [...ps.deck, ...returned],
        });
        // Shuffling itself away can empty the Active Spot.
        if (ps.active === source && withoutSource.players[player].bench.length > 0) {
          return { ...withoutSource, pendingPromote: [...(withoutSource.pendingPromote ?? []), player] };
        }
        return withoutSource;
      },
    ],
  },

  // Teal Mask Ogerpon ex — attach a Basic Grass Energy from hand to itself.
  "Teal Dance": {
    usable: (state, player) =>
      state.players[player].hand.some((c) => {
        const def = getCard(state, c.cardId) as any;
        return def?.type === "energy" && def.basic === true && def.providesType === "Grass";
      }),
    steps: [
      (state, player, _picked, args) =>
        ask(state, {
          player,
          prompt: "Attach a Basic Grass Energy from your hand to this Pokémon",
          options: state.players[player].hand
            .filter((c) => {
              const def = getCard(state, c.cardId) as any;
              return def?.type === "energy" && def.basic === true && def.providesType === "Grass";
            })
            .map((c) => c.instanceId),
          remaining: 1,
          optional: false,
          effect: "Teal Dance",
          step: 1,
          args,
        }),
      (state, player, picked, args) => {
        const energy = picked[0];
        const sourceId = String(args?.[0] ?? "");
        if (!energy) return state;
        const ps = state.players[player];
        const attach = (p: PokemonInPlay) =>
          p.card.instanceId === sourceId ? { ...p, attachedEnergy: [...p.attachedEnergy, energy] } : p;
        return patch(state, player, {
          hand: ps.hand.filter((c) => c.instanceId !== energy.instanceId),
          active: ps.active ? attach(ps.active) : null,
          bench: ps.bench.map(attach),
        });
      },
    ],
  },

  // Dusclops / Dusknoir — snipe counters, then knock this Pokémon out. The
  // counter count is read from the printed text, since the two cards differ.
  "Cursed Blast": {
    usable: (state, player) => !!state.players[player === "p1" ? "p2" : "p1"].active,
    steps: [
      (state, player, _picked, args) => {
        const sourceId = String(args?.[0] ?? "");
        const source = pokemonInPlay(state.players[player]).find((p) => p.card.instanceId === sourceId);
        const def = source && getPokemon(state, source.card.cardId);
        const text = def?.abilities.find((a) => a.name === "Cursed Blast")?.text ?? "";
        const counters = Number(/put (\d+) damage counters/.exec(text)?.[1] ?? 0);
        const opp = opponentOf(player);
        return ask(state, {
          player,
          prompt: `Put ${counters} damage counters on 1 of your opponent's Pokémon`,
          options: pokemonInPlay(state.players[opp]).map((p) => p.card.instanceId),
          remaining: 1,
          optional: false,
          effect: "Cursed Blast",
          step: 1,
          args: [sourceId, counters * 10],
        });
      },
      (state, player, picked, args) => {
        const sourceId = String(args?.[0] ?? "");
        const damage = Number(args?.[1] ?? 0);
        const target = picked[0];
        const opp = opponentOf(player);
        let next = state;

        if (target) {
          const ops = next.players[opp];
          if (ops.active?.card.instanceId === target.instanceId) {
            next = applyDamage(next, opp, damage, player);
          } else {
            next = patch(next, opp, {
              bench: ops.bench.map((p) =>
                p.card.instanceId === target.instanceId ? { ...p, damage: p.damage + damage } : p
              ),
            });
            next = knockOutBench(next, opp, player);
          }
          if (next.phase === "gameOver") return next;
        }

        // Using the Ability knocks out the Pokémon that used it — with no prize
        // for the opponent, since nothing attacked it.
        const ps = next.players[player];
        const source = pokemonInPlay(ps).find((p) => p.card.instanceId === sourceId);
        if (!source) return next;
        const discarded = [source.card, ...source.attachedEnergy, ...source.attachedTools];
        next = patch(next, player, {
          active: ps.active === source ? null : ps.active,
          bench: ps.bench.filter((p) => p !== source),
          discard: [...ps.discard, ...discarded],
        });
        if (ps.active === source) {
          if (next.players[player].bench.length === 0) {
            return { ...next, phase: "gameOver", winner: opp };
          }
          next = { ...next, pendingPromote: [...(next.pendingPromote ?? []), player] };
        }
        return next;
      },
    ],
  },

  /*
   * Meowth ex — "when you play this Pokémon from your hand onto your Bench".
   * That trigger window is exactly "it arrived this turn and is still on the
   * Bench", so it needs no separate hook: the usable predicate expresses it and
   * the player keeps the "you may" choice.
   */
  "Last-Ditch Catch": {
    usable: (state, player, source) =>
      source.placedOnTurn === state.turn &&
      state.players[player].bench.includes(source) &&
      state.players[player].deck.some((c) => {
        const def = getCard(state, c.cardId);
        return def?.type === "trainer" && def.subtype === "supporter";
      }),
    steps: [
      (state, player) =>
        ask(state, {
          player,
          prompt: "Search your deck for a Supporter card",
          options: state.players[player].deck
            .filter((c) => {
              const def = getCard(state, c.cardId);
              return def?.type === "trainer" && def.subtype === "supporter";
            })
            .map((c) => c.instanceId),
          remaining: 1,
          optional: true,
          effect: "Last-Ditch Catch",
          step: 1,
        }),
      (state, player, picked) => takeFromDeck(state, player, picked),
    ],
  },

  // Kadabra — "when you play this Pokémon from your hand to evolve one of your
  // Pokémon": same window, but the Pokémon is an Evolution.
  "Psychic Draw": {
    usable: (state, player, source) => {
      const def = getPokemon(state, source.card.cardId);
      return source.placedOnTurn === state.turn && (def?.stage ?? 0) > 0;
    },
    steps: [(state, player) => draw(state, player, 3)],
  },

  // Munkidori — move up to 3 damage counters between your own Pokémon.
  "Adrena-Brain": {
    usable: (state, player, source) =>
      hasEnergyType(state, source, "Darkness") &&
      pokemonInPlay(state.players[player]).some((p) => p.damage > 0) &&
      !!state.players[opponentOf(player)].active,
    steps: [
      (state, player) =>
        ask(state, {
          player,
          prompt: "Move up to 3 damage counters to your opponent's Active Pokémon",
          options: pokemonInPlay(state.players[player])
            .filter((p) => p.damage > 0)
            .map((p) => p.card.instanceId),
          remaining: 3,
          optional: true,
          repeatable: true,
          effect: "Adrena-Brain",
          step: 1,
        }),
      (state, player, picked) => {
        const opp = opponentOf(player);
        let moved = 0;
        let next = state;
        for (const card of picked) {
          const ps = next.players[player];
          const shift = (p: PokemonInPlay) =>
            p.card.instanceId === card.instanceId && p.damage >= 10 ? { ...p, damage: p.damage - 10 } : p;
          const before = pokemonInPlay(ps).find((p) => p.card.instanceId === card.instanceId)?.damage ?? 0;
          if (before < 10) continue;
          next = patch(next, player, {
            active: ps.active ? shift(ps.active) : null,
            bench: ps.bench.map(shift),
          });
          moved += 10;
        }
        if (moved === 0) return next;
        // Damage moved this way can knock the target out.
        return applyDamage(next, opp, moved, player);
      },
    ],
  },
};

/** Knock out Benched Pokémon that have reached their HP, awarding prizes. */
function knockOutBench(state: GameState, owner: Player, taker: Player): GameState {
  let next = state;
  for (const poke of [...next.players[owner].bench]) {
    const def = getPokemon(next, poke.card.cardId);
    if (!def || poke.damage < effectiveHp(next, poke)) continue;
    const ps = next.players[owner];
    next = patch(next, owner, {
      bench: ps.bench.filter((p) => p !== poke),
      discard: [...ps.discard, poke.card, ...poke.attachedEnergy, ...poke.attachedTools],
      koedLastTurn: true,
    });
    const count = Math.min(def.prizeValue ?? 1, next.players[taker].prizes.length);
    next = patch(next, taker, {
      prizes: next.players[taker].prizes.slice(count),
      hand: [...next.players[taker].hand, ...next.players[taker].prizes.slice(0, count)],
    });
    if (next.players[taker].prizes.length === 0) return { ...next, phase: "gameOver", winner: taker };
  }
  return next;
}

for (const [name, impl] of Object.entries(abilities)) effectSteps.set(name, impl.steps);

export const isAbilityImplemented = (name: string) => name in abilities;

/** Abilities on a Pokémon that can be activated right now. */
export function usableAbilities(state: GameState, player: Player, poke: PokemonInPlay): string[] {
  const def = getPokemon(state, poke.card.cardId);
  if (!def) return [];
  if (abilitiesLocked(state, poke)) return [];
  const used = state.players[player].abilitiesUsedThisTurn ?? [];
  return def.abilities
    .filter((a) => {
      const impl = abilities[a.name];
      if (!impl) return false;
      if (used.includes(`${poke.card.instanceId}:${a.name}`)) return false;
      return impl.usable(state, player, poke);
    })
    .map((a) => a.name);
}
