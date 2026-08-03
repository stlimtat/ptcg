# Manual UI Testing Guide

## Setup
1. From the root `ts/` directory, run: `pnpm install`
2. Build all packages: `pnpm build`

## Running the Dev Server
From `ts/packages/ui/`, run:
```bash
pnpm dev
```

This starts a Vite dev server on http://localhost:8000

## Game Flow to Test

### Starting State
- Two players: P1 (you) and P2 (opponent/bot)
- P1 starts the game
- 30 cards in each deck (test cards: Bulbasaur + Grass Energy, Charmander + Fire Energy)

### Test Sequence
1. **Play Pokémon**: Click "Play Pokémon" button to put Pokémon on the bench
2. **Attach Energy**: Click "Attach Energy" to attach energy to active Pokémon
3. **Attack**: Click "Attack 0" to perform basic attack
4. **Damage**: Verify damage appears on opponent's active Pokémon
5. **Retreat**: Click "Retreat" to swap active with bench Pokémon
6. **End Turn**: Click "End Turn" → bot auto-plays
7. **Game End**: When one player has 0 prizes, game should show winner

## UI Components

| Component | Purpose |
|-----------|---------|
| **Board** | Displays both players' active/bench Pokémon + prizes |
| **Hand** | Lists cards in your hand (clickable) |
| **ActionBar** | Shows legal actions available this turn |
| **Log** | Scrolls game events chronologically |

## Expected Behavior

### P1 (Human) Turn
- ActionBar shows available actions
- Can click any action to play
- After action, state updates immediately
- Can chain actions until End Turn

### P2 (Bot) Turn
- Shows "Opponent is thinking..."
- Bot auto-selects random legal action every 500ms
- Game continues until bot ends turn or wins

### Game End
- Page shows "GAME OVER - P1 WINS!" or "GAME OVER - P2 WINS!"
- No more actions available

## Known Limitations (v1)
- No card animations
- No drag-and-drop
- Bot uses random selection (not AI)
- Test cards only (Bulbasaur, Charmander)
- No actual effect resolution (damage only)
