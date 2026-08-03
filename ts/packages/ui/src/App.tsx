import React, { useReducer, useEffect, useRef, useState } from 'react';
import { GameState, Action, applyAction, legalActions, createInitialState, CardInstance } from '@pokemon-tcg/engine';
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
  const [availableDecks, setAvailableDecks] = useState<string[]>(['dragapult-ex', 'zoroark-ex', 'grass-deck', 'fire-deck']);
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

  const dispatch = (action: Action) => {
    try {
      setGameState(applyAction(state, action));
    } catch (e) {
      console.error('Action failed:', e);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const cardsRes = await fetch('/cards.json');
        const cardsData = await cardsRes.json();
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
      const initialState = createInitialState(p1Deck, p2Deck);
      initialState.cardRegistry = cardRegistry;

      // Setup phase: draw 7 cards for each player with mulligan logic (BASIC Pokemon only)
      const setupPlayer = (playerKey: 'p1' | 'p2', opponentKey: 'p1' | 'p2') => {
        let hand = initialState.players[playerKey].deck.splice(0, 7);
        // Check for BASIC Pokemon only (stage 0)
        const hasBasicPokemon = hand.some(c =>
          cardRegistry[c.cardId]?.type === 'pokemon' && cardRegistry[c.cardId]?.stage === 0
        );

        if (!hasBasicPokemon) {
          // Mulligan: shuffle back and redraw, opponent +1 card
          initialState.players[playerKey].deck.push(...hand);
          initialState.players[playerKey].deck.sort(() => Math.random() - 0.5);
          hand = initialState.players[playerKey].deck.splice(0, 7);
          const opponentExtraCard = initialState.players[opponentKey].deck.splice(0, 1);
          initialState.players[opponentKey].hand.push(...opponentExtraCard);
        }

        // Append to hand (don't overwrite - preserves mulligan bonus cards from opponent)
        initialState.players[playerKey].hand.push(...hand);
      };

      setupPlayer('p1', 'p2');
      setupPlayer('p2', 'p1');

      // Stay in setup phase - wait for players to select active Pokemon
      initialState.phase = 'setup';
      initialState.turn = 0;

      setGameState(initialState);
      setSetupPhase(true);
      setP1SelectedActivePokemon('');
      setP2SelectedActivePokemon('');
    }
  }, [p1Deck, p2Deck, gameStarted, cardRegistry]);

  const botTimeoutRef = useRef<NodeJS.Timeout>();

  // Bot loop: when p2 turn, auto-play random legal action (100ms delay)
  useEffect(() => {
    if (state.activePlayer === 'p2' && state.phase !== 'gameOver') {
      botTimeoutRef.current = setTimeout(() => {
        const action = getBotAction(state);
        if (action) {
          dispatch(action);
        }
      }, 100); // Fast bot response
    }

    return () => {
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    };
  }, [state.activePlayer, state.phase, state.turn]);

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

    const handleSetupComplete = () => {
      // Find selected cards
      const p1SelectedCard = state.players.p1.hand.find(c => c.instanceId === p1SelectedActivePokemon);
      const p2SelectedCard = state.players.p2.hand.find(c => c.instanceId === p2SelectedActivePokemon);

      if (!p1SelectedCard || !p2SelectedCard) return;

      // Create new state with active Pokemon set
      const newState = { ...state };
      newState.players.p1.active = {
        card: p1SelectedCard,
        damage: 0,
        attachedEnergy: [],
        attachedTools: [],
        statusConditions: [],
      };
      newState.players.p1.hand = newState.players.p1.hand.filter(c => c !== p1SelectedCard);

      newState.players.p2.active = {
        card: p2SelectedCard,
        damage: 0,
        attachedEnergy: [],
        attachedTools: [],
        statusConditions: [],
      };
      newState.players.p2.hand = newState.players.p2.hand.filter(c => c !== p2SelectedCard);

      // Award 6 prize cards to each player
      newState.players.p1.prizes = newState.players.p1.deck.splice(0, 6);
      newState.players.p2.prizes = newState.players.p2.deck.splice(0, 6);

      // Randomize first player, enter main phase
      const firstPlayer = Math.random() < 0.5 ? 'p1' : 'p2';
      newState.turn = 1;
      newState.activePlayer = firstPlayer;
      newState.phase = 'main';
      // Both players need to draw at start of their turn (via draw phase logic)
      newState.players.p1.hasDrawnThisTurn = false;
      newState.players.p2.hasDrawnThisTurn = false;

      newState.log.push({
        timestamp: Date.now(),
        player: firstPlayer,
        message: `Setup complete. ${firstPlayer} goes first.`,
      });

      setGameState(newState);
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
          <ActionBar actions={legal} onAction={handleAction} cardRegistry={cardRegistry} />
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
