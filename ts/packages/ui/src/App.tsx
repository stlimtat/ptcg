import React, { useReducer, useEffect, useRef, useState } from 'react';
import { GameState, Action, applyAction, legalActions, createInitialState, startGame, CardInstance, GameLogger } from '@pokemon-tcg/engine';
import { Board } from './views/Board';
import { Hand } from './views/Hand';
import { ActionBar } from './views/ActionBar';
import { Log } from './views/Log';
import { DeckSelector } from './views/DeckSelector';
import { loadCardRegistry, loadDeck, initializeData } from './utils/cardLoader';
import { getBotAction } from './controllers/botController';

// ponytail: polyfill randomUUID for browser
if (typeof (globalThis as any).crypto === 'undefined') {
  (globalThis as any).crypto = {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  };
}

export default function App() {
  const [cardRegistry, setCardRegistry] = useState<any>({});
  const [availableDecks, setAvailableDecks] = useState<string[]>([]);
  const [p1DeckName, setP1DeckName] = useState<string>('');
  const [p2DeckName, setP2DeckName] = useState<string>('');
  const [p1Deck, setP1Deck] = useState<string[]>([]);
  const [p2Deck, setP2Deck] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [state, setGameState] = useState<GameState>(createInitialState([], []));
  const [p1SelectedActivePokemon, setP1SelectedActivePokemon] = useState<string>('');
  const [p2SelectedActivePokemon, setP2SelectedActivePokemon] = useState<string>('');
  const [setupPhase, setSetupPhase] = useState(false);
  const loggerRef = useRef<GameLogger | null>(null);

  const dispatch = (action: Action) => {
    setGameState((prev) => {
      try {
        const next = applyAction(prev, action);
        loggerRef.current?.logMove(prev.turn, action.player, action);
        return next;
      } catch (e) {
        console.error('Action failed:', e);
        return prev;
      }
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const cardsRes = await fetch('/cards.json');
        const cardsData = await cardsRes.json();
        setAvailableDecks(await (await fetch('/decks/index.json')).json());
        const registry: any = {};
        const cardsList = Array.isArray(cardsData) ? cardsData : (cardsData.cards || []);
        for (const card of cardsList) {
          registry[card.id] = card;
        }
        setCardRegistry(registry);
        setLoaded(true);
      } catch (e) {
        console.error('Failed to load data:', e);
        setLoaded(true);
      }
    };
    loadData();
  }, []);

  const handleStartGame = async () => {
    try {
      const p1Res = await fetch(`/decks/${p1DeckName}.json`);
      const p1Data = await p1Res.json();
      setP1Deck(p1Data.cards || []);

      const p2Res = await fetch(`/decks/${p2DeckName}.json`);
      const p2Data = await p2Res.json();
      setP2Deck(p2Data.cards || []);

      setGameStarted(true);
    } catch (e) {
      console.error('Failed to load decks:', e);
    }
  };

  // Update game state when decks are loaded
  useEffect(() => {
    if (p1Deck.length > 0 && p2Deck.length > 0 && gameStarted && Object.keys(cardRegistry).length > 0) {
      // Opening hands, mulligans and prizes are the engine's job; the UI only
      // picks the Active Pokémon, through the same promote action a bot uses.
      const initialState = startGame(p1Deck, p2Deck, cardRegistry);

      loggerRef.current = new GameLogger(`game-${Date.now()}`, p1DeckName, p2DeckName);

      setGameState(initialState);
      setSetupPhase(true);
      setP1SelectedActivePokemon('');
      setP2SelectedActivePokemon('');
    }
  }, [p1Deck, p2Deck, gameStarted, cardRegistry, p1DeckName, p2DeckName]);

  const botTimeoutRef = useRef<NodeJS.Timeout>();

  // Save game when it ends
  useEffect(() => {
    if (state.winner && loggerRef.current) {
      loggerRef.current.endGame(state.winner);
      loggerRef.current.saveToIndexedDB().catch(e => console.error('Failed to save game:', e));
    }
  }, [state.winner]);

  // Bot loop: when p2 turn, auto-play random legal action (immediate)
  useEffect(() => {
    const owesPromotion = state.pendingPromote?.includes('p2');
    if (state.phase === 'setup' || state.phase === 'gameOver') return;
    if (state.activePlayer !== 'p2' && !owesPromotion) return;
    const action = getBotAction(state);
    if (action) dispatch(action);
  }, [state]);

  // Choice and promote actions reference cards by instanceId; find the card behind one.
  const findInstanceCardId = (s: GameState, instanceId: string): string | undefined => {
    for (const p of ['p1', 'p2'] as const) {
      const ps = s.players[p];
      for (const zone of [ps.hand, ps.deck, ps.discard, ps.prizes]) {
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
    return undefined;
  };

  const handleAction = (action: Action) => {
    // Override player to ensure it's p1
    const p1Action = { ...action, player: 'p1' } as Action;
    dispatch(p1Action);
  };

  const legal = legalActions(state, 'p1');

  if (!loaded) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
        <h1>Pokémon TCG</h1>
        <p>Loading game data...</p>
      </div>
    );
  }

  if (!gameStarted) {
    return (
      <DeckSelector
        availableDecks={availableDecks}
        p1Selected={p1DeckName}
        p2Selected={p2DeckName}
        onP1Change={setP1DeckName}
        onP2Change={setP2DeckName}
        onStart={handleStartGame}
      />
    );
  }

  // Setup phase: player selects active Pokemon
  if (setupPhase && state.phase === 'setup') {
    const getBasicPokemon = (hand: any[]) => {
      return hand.filter(c => cardRegistry[c.cardId]?.type === 'pokemon' && cardRegistry[c.cardId]?.stage === 0);
    };

    const p1BasicPokemon = getBasicPokemon(state.players.p1.hand);
    const p2BasicPokemon = getBasicPokemon(state.players.p2.hand);
    const canStart = p1SelectedActivePokemon && p2SelectedActivePokemon;

    // Debug: show what's in deck and hand
    const debugDeckInfo = () => {
      const p1DeckCards = state.players.p1.deck.map(c => cardRegistry[c.cardId]);
      const p1HandCards = state.players.p1.hand.map(c => cardRegistry[c.cardId]);
      const p1DeckTypes: Record<string, number> = {};
      const p1HandTypes: Record<string, number> = {};

      p1DeckCards.forEach(c => {
        p1DeckTypes[c?.type || 'unknown'] = (p1DeckTypes[c?.type || 'unknown'] || 0) + 1;
      });
      p1HandCards.forEach(c => {
        p1HandTypes[c?.type || 'unknown'] = (p1HandTypes[c?.type || 'unknown'] || 0) + 1;
      });

      return { p1DeckTypes, p1HandTypes, p1DeckCards, p1HandCards };
    };

    const debug = debugDeckInfo();

    const handleSetupComplete = () => {
      if (!p1SelectedActivePokemon || !p2SelectedActivePokemon) return;
      dispatch({ type: 'promote', player: 'p1', instanceId: p1SelectedActivePokemon });
      dispatch({ type: 'promote', player: 'p2', instanceId: p2SelectedActivePokemon });
      setSetupPhase(false);
    };

    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <h1>Setup Phase - Select Active Pokémon</h1>
        <p>Choose a BASIC Pokémon from your opening hand to be your Active Pokémon.</p>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '30px' }}>
          {/* P1 Setup */}
          <div style={{ flex: 1, border: '2px solid green', padding: '15px' }}>
            <h2>Player 1 (You)</h2>
            <p>Opening hand: {state.players.p1.hand.length} cards</p>
            <p>Basic Pokémon available: {p1BasicPokemon.length}</p>

            <div style={{ marginTop: '15px' }}>
              <h3>Select Active Pokémon:</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {p1BasicPokemon.map((card) => (
                  <button
                    key={card.instanceId}
                    onClick={() => setP1SelectedActivePokemon(card.instanceId)}
                    style={{
                      padding: '10px 15px',
                      border: p1SelectedActivePokemon === card.instanceId ? '3px solid blue' : '1px solid gray',
                      background: p1SelectedActivePokemon === card.instanceId ? '#e3f2fd' : '#f9f9f9',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      fontWeight: p1SelectedActivePokemon === card.instanceId ? 'bold' : 'normal',
                    }}
                  >
                    {cardRegistry[card.cardId]?.name || card.cardId}
                  </button>
                ))}
              </div>
              {p1BasicPokemon.length === 0 && (
                <p style={{ color: 'red' }}>⚠️ No Basic Pokémon! Mulligan happened.</p>
              )}
            </div>
          </div>

          {/* P2 Setup */}
          <div style={{ flex: 1, border: '2px solid blue', padding: '15px' }}>
            <h2>Player 2 (Opponent)</h2>
            <p>Opening hand: {state.players.p2.hand.length} cards</p>
            <p>Basic Pokémon available: {p2BasicPokemon.length}</p>

            <div style={{ marginTop: '15px' }}>
              <h3>Select Active Pokémon:</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {p2BasicPokemon.map((card) => (
                  <button
                    key={card.instanceId}
                    onClick={() => setP2SelectedActivePokemon(card.instanceId)}
                    style={{
                      padding: '10px 15px',
                      border: p2SelectedActivePokemon === card.instanceId ? '3px solid blue' : '1px solid gray',
                      background: p2SelectedActivePokemon === card.instanceId ? '#e3f2fd' : '#f9f9f9',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      fontWeight: p2SelectedActivePokemon === card.instanceId ? 'bold' : 'normal',
                    }}
                  >
                    {cardRegistry[card.cardId]?.name || card.cardId}
                  </button>
                ))}
              </div>
              {p2BasicPokemon.length === 0 && (
                <p style={{ color: 'red' }}>⚠️ No Basic Pokémon! Mulligan happened.</p>
              )}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleSetupComplete}
            disabled={!canStart}
            style={{
              padding: '15px 40px',
              fontSize: '18px',
              cursor: canStart ? 'pointer' : 'not-allowed',
              opacity: canStart ? 1 : 0.5,
              background: canStart ? '#4CAF50' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
            }}
          >
            {canStart ? 'Start Game' : 'Select a Pokémon for both players'}
          </button>
        </div>

        {/* DEBUG: Show deck and hand composition */}
        <div style={{ marginTop: '30px', padding: '15px', background: '#f5f5f5', border: '1px solid #ccc' }}>
          <h3>🔍 DEBUG: P1 Deck & Hand Analysis</h3>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div>
              <h4>Remaining Deck ({state.players.p1.deck.length} cards):</h4>
              <div>
                {Object.entries(debug.p1DeckTypes).map(([type, count]) => (
                  <div key={type}>
                    {type}: {count} cards
                  </div>
                ))}
              </div>
              <details style={{ marginTop: '10px' }}>
                <summary>Show all deck cards</summary>
                <div style={{ fontSize: '11px', maxHeight: '200px', overflow: 'auto' }}>
                  {debug.p1DeckCards.map((c, i) => (
                    <div key={i}>
                      {c?.id} - {c?.name} ({c?.type})
                    </div>
                  ))}
                </div>
              </details>
            </div>

            <div>
              <h4>Opening Hand ({state.players.p1.hand.length} cards):</h4>
              <div>
                {Object.entries(debug.p1HandTypes).map(([type, count]) => (
                  <div key={type}>
                    {type}: {count} cards
                  </div>
                ))}
              </div>
              <details style={{ marginTop: '10px' }}>
                <summary>Show all hand cards</summary>
                <div style={{ fontSize: '11px', maxHeight: '200px', overflow: 'auto' }}>
                  {debug.p1HandCards.map((c, i) => (
                    <div key={i}>
                      {c?.id} - {c?.name} ({c?.type})
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Pokémon TCG</h1>
      <div>
        <strong>Turn: {state.turn}</strong> |
        <strong> Phase: {state.phase}</strong> |
        <strong> Active: {state.activePlayer === 'p1' ? 'YOU' : 'OPPONENT'}</strong>
        {state.winner && <strong style={{ color: 'red' }}> GAME OVER - {state.winner.toUpperCase()} WINS!</strong>}
      </div>

      <Board state={state} cardRegistry={cardRegistry} />

      {state.activePlayer === 'p1' && state.phase !== 'gameOver' && (
        <>
          <Hand
            hand={state.players.p1.hand}
            cardRegistry={cardRegistry}
            onCardClick={() => {}}
          />
          <ActionBar
            actions={legal}
            onAction={handleAction}
            cardRegistry={cardRegistry}
            prompt={state.pendingChoice?.prompt}
            cardForInstance={(id) => cardRegistry[findInstanceCardId(state, id) ?? '']}
          />
        </>
      )}

      {state.activePlayer === 'p2' && state.phase !== 'gameOver' && (
        <div style={{ padding: '10px', background: '#ffebee', border: '1px solid red' }}>
          <p>Opponent is thinking...</p>
        </div>
      )}

      <Log logs={state.log} />
    </div>
  );
}
