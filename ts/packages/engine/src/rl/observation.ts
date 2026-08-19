import { GameState, Player, PokemonInPlay, PokemonType } from "../types.js";
import { getCard, getPokemon, canPayCost } from "../cardLookup.js";
import { damageFor, adjustedCost } from "../attackFlow.js";
import { effectiveHp } from "../effects/continuous.js";

/**
 * Fixed-length numeric view of the game from one player's seat.
 *
 * Everything here is information that seat is allowed to have: your own hand is
 * itemised, the opponent's is only counted, and neither deck nor either prize
 * pile reveals its contents. Feeding a learner the full GameState would leak
 * hidden information and train a policy that cannot exist at a real table.
 */
const TYPES: PokemonType[] = [
  "Grass", "Fire", "Water", "Lightning", "Psychic", "Fighting",
  "Darkness", "Metal", "Fairy", "Dragon", "Colorless",
];

const BENCH_SLOTS = 5;
/**
 * Actions address the hand by *slot*, so the observation has to say what is in
 * each slot. Without this the policy is choosing "play hand card 3" while only
 * being told how many Trainers it holds — it cannot tell Boss's Orders from an
 * Energy, and no amount of training fixes that.
 */
const HAND_SLOTS = 15;
const HAND_CARD_FEATURES = 12;
/** Pending choices are also addressed by option index. */
const CHOICE_SLOTS = 20;
const CHOICE_FEATURES = 6;
/**
 * What each of the Active Pokémon's attacks would actually do right now.
 * Whether an attack is affordable and whether it wins the exchange is the single
 * most decision-relevant fact on the board, and it is derivable from public
 * information — so the policy should not have to rediscover damage arithmetic
 * from raw type flags.
 */
const ATTACK_SLOTS = 4;
const ATTACK_FEATURES = 4;
/** hp, damage ratio, energy, tools, 5 status flags, prize value, retreat cost, 11 types */
const POKEMON_FEATURES = 9 + 2 + TYPES.length;

const opponentOf = (p: Player): Player => (p === "p1" ? "p2" : "p1");

function encodePokemon(state: GameState, poke: PokemonInPlay | null): number[] {
  if (!poke) return new Array(POKEMON_FEATURES).fill(0);
  const def = getPokemon(state, poke.card.cardId);
  const hp = def?.hp ?? 1;
  return [
    1, // present
    hp / 350,
    Math.min(1, poke.damage / hp), // how close to a knockout
    poke.attachedEnergy.length / 5,
    poke.attachedTools.length,
    poke.statusConditions.includes("Asleep") ? 1 : 0,
    poke.statusConditions.includes("Confused") ? 1 : 0,
    poke.statusConditions.includes("Paralyzed") ? 1 : 0,
    poke.statusConditions.includes("Poisoned") ? 1 : 0,
    poke.statusConditions.includes("Burned") ? 1 : 0,
    (def?.prizeValue ?? 1) / 3,
    (def?.retreatCost ?? 0) / 4,
    ...TYPES.map((t) => (def?.types.includes(t) ? 1 : 0)),
  ];
}

/** Counts of what is in a hand, by card category. */
function handComposition(state: GameState, player: Player): number[] {
  const counts = { pokemon: 0, basic: 0, energy: 0, item: 0, supporter: 0, tool: 0, stadium: 0 };
  for (const card of state.players[player].hand) {
    const def = getCard(state, card.cardId);
    if (!def) continue;
    if (def.type === "pokemon") {
      counts.pokemon++;
      if (def.stage === 0) counts.basic++;
    } else if (def.type === "energy") counts.energy++;
    else counts[def.subtype]++;
  }
  return [counts.pokemon, counts.basic, counts.energy, counts.item, counts.supporter, counts.tool, counts.stadium].map(
    (n) => n / 10
  );
}

/** What a single card looks like when it sits in a hand slot or a choice list. */
function encodeCard(state: GameState, cardId: string | null): number[] {
  if (!cardId) return new Array(HAND_CARD_FEATURES).fill(0);
  const def = getCard(state, cardId);
  if (!def) return new Array(HAND_CARD_FEATURES).fill(0);
  const pokemon = def.type === "pokemon";
  const trainer = def.type === "trainer";
  return [
    1, // present
    pokemon ? 1 : 0,
    pokemon && def.stage === 0 ? 1 : 0,
    pokemon ? def.stage / 2 : 0,
    def.type === "energy" ? 1 : 0,
    def.type === "energy" && (def as any).basic === true ? 1 : 0,
    trainer && def.subtype === "item" ? 1 : 0,
    trainer && def.subtype === "supporter" ? 1 : 0,
    trainer && def.subtype === "tool" ? 1 : 0,
    trainer && def.subtype === "stadium" ? 1 : 0,
    pokemon ? def.hp / 350 : 0,
    pokemon ? (def.prizeValue ?? 1) / 3 : 0,
  ];
}

/** A trimmed card encoding for the options of a pending choice. */
function encodeChoiceOption(state: GameState, cardId: string | null): number[] {
  const full = encodeCard(state, cardId);
  // present, pokemon, basic pokemon, energy, supporter, hp
  return [full[0], full[1], full[2], full[4], full[7], full[10]];
}

/** Per-attack: exists, affordable, damage, and whether it knocks the target out. */
function encodeAttacks(state: GameState, seat: Player): number[] {
  const me = state.players[seat];
  const them = state.players[opponentOf(seat)];
  const def = me.active ? getPokemon(state, me.active.card.cardId) : null;
  const values: number[] = [];

  for (let i = 0; i < ATTACK_SLOTS; i++) {
    const attack = def?.attacks[i];
    if (!attack || !me.active || !them.active) {
      values.push(0, 0, 0, 0);
      continue;
    }
    const affordable = canPayCost(state, me.active.attachedEnergy, adjustedCost(state, seat, me.active, attack));
    const damage = damageFor(state, seat, i);
    const targetHp = effectiveHp(state, them.active);
    values.push(
      1,
      affordable ? 1 : 0,
      Math.min(1, damage / 300),
      them.active.damage + damage >= targetHp ? 1 : 0
    );
  }
  return values;
}

export function encodeObservation(state: GameState, seat: Player): Float32Array {
  const opp = opponentOf(seat);
  const me = state.players[seat];
  const them = state.players[opp];

  const values: number[] = [
    // Whose turn, where we are in the game.
    state.activePlayer === seat ? 1 : 0,
    Math.min(1, state.turn / 40),
    state.phase === "main" ? 1 : 0,
    state.phase === "setup" ? 1 : 0,
    state.pendingChoice ? 1 : 0,
    state.pendingPromote?.includes(seat) ? 1 : 0,

    // The race: prizes are the win condition, decks are the clock.
    me.prizes.length / 6,
    them.prizes.length / 6,
    me.deck.length / 60,
    them.deck.length / 60,
    me.hand.length / 10,
    them.hand.length / 10, // count only: the opponent's hand is hidden
    me.discard.length / 60,
    them.discard.length / 60,
    me.bench.length / BENCH_SLOTS,
    them.bench.length / BENCH_SLOTS,

    // What this seat has already spent this turn.
    me.energyAttachedThisTurn ? 1 : 0,
    me.supporterPlayedThisTurn ? 1 : 0,
    me.hasDrawnThisTurn ? 1 : 0,
    me.attackedThisTurn ? 1 : 0,
    me.retreatedThisTurn ? 1 : 0,
    me.koedLastTurn ? 1 : 0,

    // Restrictions in force.
    state.ongoing?.some((e) => e.kind === "itemLock" && e.appliesTo === seat) ? 1 : 0,
    state.ongoing?.some((e) => e.kind === "noAttack" && e.appliesTo === seat) ? 1 : 0,
    state.ongoing?.some((e) => e.kind === "noRetreat" && e.appliesTo === seat) ? 1 : 0,
    state.stadium ? 1 : 0,

    ...handComposition(state, seat),
    ...encodePokemon(state, me.active),
    ...encodePokemon(state, them.active),
  ];

  for (let i = 0; i < BENCH_SLOTS; i++) values.push(...encodePokemon(state, me.bench[i] ?? null));
  for (let i = 0; i < BENCH_SLOTS; i++) values.push(...encodePokemon(state, them.bench[i] ?? null));

  values.push(...encodeAttacks(state, seat));

  // Hand, slot by slot, matching how playPokemon/playTrainer/attachEnergy index it.
  for (let i = 0; i < HAND_SLOTS; i++) values.push(...encodeCard(state, me.hand[i]?.cardId ?? null));

  // The options of a pending choice, in the order the action space lists them.
  const choice = state.pendingChoice;
  for (let i = 0; i < CHOICE_SLOTS; i++) {
    const optionId = choice && choice.player === seat ? choice.options[i] : undefined;
    const card = optionId ? findCardInstance(state, optionId) : null;
    values.push(...encodeChoiceOption(state, card));
  }

  return Float32Array.from(values);
}

/** Resolve an option's instanceId to the card behind it, wherever it lives. */
function findCardInstance(state: GameState, instanceId: string): string | null {
  for (const p of ["p1", "p2"] as Player[]) {
    const ps = state.players[p];
    for (const zone of [ps.hand, ps.deck, ps.discard]) {
      const hit = zone.find((c) => c.instanceId === instanceId);
      if (hit) return hit.cardId;
    }
    for (const poke of [ps.active, ...ps.bench]) {
      if (!poke) continue;
      if (poke.card.instanceId === instanceId) return poke.card.cardId;
      const attached = [...poke.attachedEnergy, ...poke.attachedTools].find((c) => c.instanceId === instanceId);
      if (attached) return attached.cardId;
    }
  }
  return null;
}

export const OBSERVATION_SIZE =
  26 +
  7 +
  POKEMON_FEATURES * (2 + BENCH_SLOTS * 2) +
  ATTACK_SLOTS * ATTACK_FEATURES +
  HAND_SLOTS * HAND_CARD_FEATURES +
  CHOICE_SLOTS * CHOICE_FEATURES;
