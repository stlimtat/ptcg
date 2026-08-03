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
    if (p1Deck.length > 0 && p2Deck.length > 0 && gameStarted) {
      const initialState = createInitialState(p1Deck, p2Deck);
      initialState.cardRegistry = cardRegistry;

      // Setup phase: draw 7 cards for each player
      const p1Drawn = initialState.players.p1.deck.splice(0, 7);
      const p2Drawn = initialState.players.p2.deck.splice(0, 7);
      initialState.players.p1.hand = p1Drawn;
      initialState.players.p2.hand = p2Drawn;

      // Set active Pokemon for each player (first Pokemon in hand)
      const p1PokemonInHand = p1Drawn.find(c => cardRegistry[c.cardId]?.type === 'pokemon');
      const p2PokemonInHand = p2Drawn.find(c => cardRegistry[c.cardId]?.type === 'pokemon');

      if (p1PokemonInHand && cardRegistry[p1PokemonInHand.cardId]) {
        initialState.players.p1.active = {
          card: p1PokemonInHand,
          damage: 0,
          attachedEnergy: [],
          attachedTools: [],
          statusConditions: [],
        };
        // Remove from hand
        initialState.players.p1.hand = initialState.players.p1.hand.filter(c => c.id !== p1PokemonInHand.id);
      }

      if (p2PokemonInHand && cardRegistry[p2PokemonInHand.cardId]) {
        initialState.players.p2.active = {
          card: p2PokemonInHand,
          damage: 0,
          attachedEnergy: [],
          attachedTools: [],
          statusConditions: [],
        };
        // Remove from hand
        initialState.players.p2.hand = initialState.players.p2.hand.filter(c => c.id !== p2PokemonInHand.id);
      }

      // Award 6 prize cards to each player
      initialState.players.p1.prizes = initialState.players.p1.deck.splice(0, 6);
      initialState.players.p2.prizes = initialState.players.p2.deck.splice(0, 6);

      // Start turn 1, player 1's turn, main phase
      initialState.turn = 1;
      initialState.activePlayer = 'p1';
      initialState.phase = 'main';

      setGameState(initialState);
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
