import type { Action, ActionHandler, GameState } from "../types";
import { endTurnHandler } from "./endTurn";

export const actionRegistry = new Map<string, ActionHandler>();

actionRegistry.set("endTurn", endTurnHandler);
