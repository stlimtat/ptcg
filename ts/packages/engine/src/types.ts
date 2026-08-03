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
  cardRegistry?: Record<string, Card>;
  stadium?: CardInstance;
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
