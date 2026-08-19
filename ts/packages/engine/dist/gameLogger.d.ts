import { Action } from "./types.js";
export interface GameLog {
    gameId: string;
    timestamp: number;
    turn: number;
    player: "p1" | "p2";
    action: Action;
    result?: string;
}
export interface GameSession {
    gameId: string;
    startedAt: number;
    endedAt?: number;
    p1Deck: string;
    p2Deck: string;
    winner?: "p1" | "p2";
    moves: GameLog[];
}
export declare class GameLogger {
    private gameId;
    private session;
    constructor(gameId: string, p1Deck: string, p2Deck: string);
    logMove(turn: number, player: "p1" | "p2", action: Action, result?: string): void;
    endGame(winner: "p1" | "p2"): void;
    getSession(): GameSession;
    saveToIndexedDB(): Promise<void>;
    toJSON(): GameSession;
}
//# sourceMappingURL=gameLogger.d.ts.map