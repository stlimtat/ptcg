import type { Action, ActionHandler, GameState } from "../types";
import { endTurnHandler } from "./endTurn";
import { playPokemonHandler } from "./playPokemon";
import { evolveHandler } from "./evolve";
import { attachEnergyHandler } from "./attachEnergy";
import { playTrainerHandler } from "./playTrainer";
import { retreatHandler } from "./retreat";
import { attackHandler } from "./attack";

export const actionRegistry = new Map<string, ActionHandler>();

actionRegistry.set("endTurn", endTurnHandler);
actionRegistry.set("playPokemon", playPokemonHandler);
actionRegistry.set("evolve", evolveHandler);
actionRegistry.set("attachEnergy", attachEnergyHandler);
actionRegistry.set("playTrainer", playTrainerHandler);
actionRegistry.set("retreat", retreatHandler);
actionRegistry.set("attack", attackHandler);
