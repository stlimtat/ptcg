export class GameLogger {
    constructor(gameId, p1Deck, p2Deck) {
        this.gameId = gameId;
        this.session = {
            gameId,
            startedAt: Date.now(),
            p1Deck,
            p2Deck,
            moves: [],
        };
    }
    logMove(turn, player, action, result) {
        this.session.moves.push({
            gameId: this.gameId,
            timestamp: Date.now(),
            turn,
            player,
            action,
            result,
        });
    }
    endGame(winner) {
        this.session.endedAt = Date.now();
        this.session.winner = winner;
    }
    getSession() {
        return this.session;
    }
    async saveToIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("PokemonTCG", 1);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
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
//# sourceMappingURL=gameLogger.js.map