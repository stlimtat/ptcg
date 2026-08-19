/// <reference lib="dom" />
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

export class GameLogger {
  private gameId: string;
  private session: GameSession;

  constructor(gameId: string, p1Deck: string, p2Deck: string) {
    this.gameId = gameId;
    this.session = {
      gameId,
      startedAt: Date.now(),
      p1Deck,
      p2Deck,
      moves: [],
    };
  }

  logMove(
    turn: number,
    player: "p1" | "p2",
    action: Action,
    result?: string
  ) {
    this.session.moves.push({
      gameId: this.gameId,
      timestamp: Date.now(),
      turn,
      player,
      action,
      result,
    });
  }

  endGame(winner: "p1" | "p2") {
    this.session.endedAt = Date.now();
    this.session.winner = winner;
  }

  getSession(): GameSession {
    return this.session;
  }

  async saveToIndexedDB() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("PokemonTCG", 1);

      request.onupgradeneeded = (event: Event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("games")) {
          db.createObjectStore("games", { keyPath: "gameId" });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("games", "readwrite");
        const store = transaction.objectStore("games");
        store.put(this.session);

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          reject(transaction.error);
        };
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  toJSON() {
    return this.session;
  }
}
