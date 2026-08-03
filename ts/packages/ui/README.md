# Pokémon TCG UI

React/Vite-based UI for the Pokémon Trading Card Game engine.

## Quick Start

```bash
cd ts/packages/ui
pnpm dev
```

Visit http://localhost:8000 to play.

## Architecture

### Views
- **Board**: Displays both players' active/bench Pokémon and prize counts
- **Hand**: Lists player's hand cards
- **ActionBar**: Shows available legal actions for current turn
- **Log**: Game event history (scrolling)

### Controllers
- **botController**: Selects random legal action for P2 (opponent)

### State Management
- **useReducer**: Manages GameState via `applyAction` dispatcher
- **legalActions**: Computes available actions each turn
- **Bot loop**: useEffect triggers bot action when activePlayer === 'p2'

### Utils
- **cardLoader**: Minimal hardcoded card registry (test data)
- **cryptoPolyfill**: Browser-safe UUID generator (replaces Node's crypto)

## Game Loop

1. P1 (human) plays action → state updates → UI re-renders
2. When P1 ends turn → activePlayer becomes 'p2'
3. useEffect detects p2 turn → bot selects random legal action
4. Bot action dispatched → state updates → activePlayer becomes 'p1'
5. Loop continues until winner determined

## Build

```bash
pnpm build  # Produces dist/
```

## Tech Stack
- React 18
- TypeScript
- Vite
- @pokemon-tcg/engine (game logic)

## Limitations (v1)
- Test cards only (Bulbasaur, Charmander)
- Bot uses random selection (not AI)
- No animations
- No effect resolution (damage only)
- Text-based UI (no fancy styling)

## Next Steps
1. Replace test card registry with real data pipeline output
2. Implement actual AI for bot (attack when possible)
3. Add effect resolution system
4. Improve UI styling/layout
5. Add card animations
