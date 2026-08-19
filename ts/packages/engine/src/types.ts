// Types & enums
export type PokemonType =
  | "Grass" | "Fire" | "Water" | "Lightning" | "Psychic" | "Fighting"
  | "Darkness" | "Metal" | "Fairy" | "Dragon" | "Colorless";

export type StatusCondition = "Confused" | "Asleep" | "Paralyzed" | "Poisoned" | "Burned";

export type Player = "p1" | "p2";

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
  // Turn this Pokémon came into play; it cannot evolve on that turn.
  placedOnTurn?: number;
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
  hasDrawnThisTurn: boolean;
  // Attacking ends your turn: once set, only endTurn remains legal.
  attackedThisTurn?: boolean;
  retreatedThisTurn?: boolean;
  stadiumPlayedThisTurn?: boolean;
  /** "<instanceId>:<abilityName>" entries, cleared at end of turn. */
  abilitiesUsedThisTurn?: string[];
  // Set when this player had a Pokémon knocked out on the opponent's last turn
  // (Unfair Stamp and friends check it).
  koedLastTurn?: boolean;
}

export interface GameState {
  turn: number;
  activePlayer: "p1" | "p2";
  phase: "setup" | "main" | "attackResolution" | "checkup" | "gameOver";
  players: Record<"p1" | "p2", PlayerState>;
  winner?: "p1" | "p2" | "draw";
  log: LogEntry[];
  cardRegistry?: Record<string, Card>;
  stadium?: CardInstance;
  // Players who owe a promotion: after a knockout, or during setup. While this
  // is non-empty nobody else may act.
  pendingPromote?: ("p1" | "p2")[];
  // Seeded so episodes replay exactly. Absent means "use Math.random".
  rngSeed?: number;
  // A card effect waiting on a decision; blocks all other actions while set.
  pendingChoice?: import("./effects/choice.js").PendingChoice;
  /**
   * "During your opponent's next turn, …" restrictions. Each entry is cleared
   * when the player it applies to finishes their next turn.
   */
  ongoing?: OngoingEffect[];
}

export interface OngoingEffect {
  kind: "itemLock" | "noRetreat" | "noAttack";
  appliesTo: Player;
  /** Restricted to one Pokémon, when the text names the Defending Pokémon. */
  instanceId?: string;
}

export interface LogEntry {
  timestamp: number;
  player: "p1" | "p2";
  message: string;
}

// Actions
export type Action =
  | { type: "drawCard"; player: "p1" | "p2" }
  | { type: "playPokemon"; player: "p1" | "p2"; cardId: string }
  | { type: "evolve"; player: "p1" | "p2"; targetInstanceId: string; cardId: string }
  | { type: "attachEnergy"; player: "p1" | "p2"; energyCardId: string; targetInstanceId: string }
  | { type: "playTrainer"; player: "p1" | "p2"; cardId: string; targetInstanceId?: string }
  | { type: "retreat"; player: "p1" | "p2"; benchInstanceId: string }
  | { type: "attack"; player: "p1" | "p2"; attackIndex: number; targetInstanceId?: string }
  | { type: "promote"; player: "p1" | "p2"; instanceId: string }
  | { type: "choose"; player: "p1" | "p2"; instanceId?: string }
  | { type: "useAbility"; player: "p1" | "p2"; instanceId: string; abilityName: string }
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
      // Prizes the opponent takes when this is Knocked Out (ex/VSTAR = 2, VMAX = 3).
      prizeValue?: number;
      abilities: Ability[];
      attacks: Attack[];
    }
  | {
      type: "energy";
      id: string;
      name: string;
      /** A list when the card provides a choice of types, e.g. Team Rocket's Energy. */
      providesType: PokemonType | "any" | (PokemonType | "any")[];
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
  /** Printed rules text, compiled by effects/abilities.ts. */
  text?: string;
  kind?: string;
  effect: EffectScript;
}

export interface Attack {
  name: string;
  cost: PokemonType[];
  baseDamage: number;
  /** Printed rules text, compiled by effects/attackText.ts. */
  text?: string;
  /** "+" or "×" suffix on the printed damage. */
  damageModifier?: string | null;
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
