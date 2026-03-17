# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dungeon Tide** is a browser-based strategy/tower defense game written in **vanilla JavaScript** (ES6 modules) with HTML5 Canvas rendering. The game has two distinct modes:

1. **Sandbox** — A free-form tactical simulator where you configure an arena (entities, walls, objects) and watch AI-controlled allies fight enemies with AI.
2. **Oleadas (Waves)** — An action survival mode where you control a hero character and defend against spawning enemy waves, with an in-game shop system, floating damage numbers, particle effects, and persistent stats/achievements.

The game is deployed to GitHub Pages. No build tools, frameworks, or npm packages are used.

## Running Locally

Simply open `web/index.html` in a browser. The game is fully functional locally with no build step required. The entry point is `web/js/app.js`, which handles navigation between menu and game modes.

## Architecture Overview

The codebase is organized by responsibility, not by layer. Core architectural insights:

### Dependency Graph
```
app.js (entry point)
 ├── sandbox.js (Sandbox UI & event handling)
 │    ├── config.js
 │    ├── engine.js ────────┐
 │    ├── renderer.js       │
 │    ├── entidad.js        │
 │    └── objetos.js        │
 │                           ▼
 └── oleadas.js        gameboard.js
      ├── oleadasEngine.js  ├── entidad.js
      ├── oleadasConfig.js  ├── objetos.js
      ├── renderer.js       └── rng.js
      ├── jugador.js
      ├── torre.js
      └── entidad.js

Key: entidad.js ─► rng.js (lowest-level core)
     These are foundational; everything else depends on them
```

### Two Parallel Game Pipelines

**Sandbox Pipeline:**
1. `config.js` - Configuration object with 60+ parameters
2. `gameboard.js` - Map generation and entity placement
3. `engine.js` - Game loop: `tick()` processes all entity actions each turn
4. `renderer.js` - Draws current game state to canvas
5. `sandbox.js` - Handles UI (toolbox, zoom, settings panel, event listeners)

**Oleadas (Waves) Pipeline:**
1. `oleadasConfig.js` - Configuration for wave mode and shop items
2. `oleadasEngine.js` - Game loop with shop/economy logic
3. `jugador.js` - Player character (hero, controlled by WASD + mouse)
4. `torre.js` - Defensive towers placed on map
5. `renderer.js` - Reused for rendering (with minor adjustments)
6. `oleadas.js` - Handles UI (shop, wave start, RequestAnimationFrame loop)

Both pipelines share foundational modules (`entidad.js`, `objetos.js`, `gameboard.js`, `renderer.js`).

## Key Modules & Patterns

### Entity System (`entidad.js`)
All game characters (allies, enemies, walls) inherit from the base `Entidad` class. Each entity has:
- **Position** (`fila`, `columna`)
- **Health** (`vida`) and damage tracking (`danioRecibido`)
- **Type** (`tipo`) — string constant: `'ALIADO'`, `'ENEMIGO'`, `'ENEMIGO_TANQUE'`, `'ENEMIGO_RAPIDO'`, `'ENEMIGO_MAGO'`, `'GUERRERO'`, `'ARQUERO'`, `'MURO'`, etc.
- **AI** via `actuar(gameboard)` — called each tick to move/attack
- **Unique ID** (`id`) — auto-incremented, reset on game start via `resetContadorId()`

**Helpers** (exported from `entidad.js`):
- `esAliado(tipo)` / `esEnemigo(tipo)` — use these instead of chaining `||` type checks
- `generarTrayectoria(origenF, origenC, destinoF, destinoC)` — generates interpolated path (Chebyshev)

Common entity types:
- **Allies** (green): `Aliado`, `AliadoGuerrero` (melee, high health), `AliadoArquero` (ranged), `AliadoEsqueleto` (special)
- **Enemies** (red/variants): `Enemigo` (basic), `EnemigoTanque` (slow/tanky), `EnemigoRapido` (fast), `EnemigoMago` (ranged)
- **Obstacles** (yellow): `Muro` (walls, do not act)

### RNG System (`rng.js`)
Uses **mulberry32** for deterministic randomness:
- `setSeed(seed)` — if `seed === -1`, uses `Math.random()`; otherwise deterministic
- `nextInt(max)`, `nextDouble()`, `random()` — all respect the seed
- This enables reproducible games: same seed = same map layout, same behavior

### Object & Trap System (`objetos.js`)
- **Items** (`Escudo`, `Arma`, `Pocion`, `Velocidad`, `Estrella`) — picked up by allies to grant bonuses
- **Traps** (`Trampa`) — deal damage each turn; stored in `gameboard.trampaMap`
- Items and traps are stored separately from entities: `gameboard.objetoMap` and `gameboard.trampaMap`

### Rendering (`renderer.js`)
- Uses **Canvas 2D** with sprite-based animation
- Sprites from `0x72_DungeonTilesetII_v1.7/frames/`
- Animation states: `idle` (4 frames) and `run` (4 frames) per entity type
- Current frame index increments each tick; renderer loops animation
- Renders in this order: background → entities → HUD (health bars, stats, messages)

### Game Loop Difference
- **Sandbox** (`engine.js`): Synchronous tick via `setInterval(engine.tick, config.velocidadMs)` in `sandbox.js`
- **Oleadas** (`oleadasEngine.js`): RequestAnimationFrame loop in `oleadas.js` with accumulated delta time

## Common Development Patterns

### Adding a New Entity Type
1. Create class in `entidad.js` extending `Entidad`
2. Add the new `tipo` string to `TIPOS_ALIADO` or `TIPOS_ENEMIGO` in `entidad.js`
3. Add `ANIM_MAP` entry in `renderer.js` for animations
4. Add spawn logic in `gameboard.colocarEntidades()` (Sandbox) or `oleadasEngine.js` (Oleadas)
5. Add configuration in `config.js` (if Sandbox) or `oleadasConfig.js` (if Oleadas)

### Modifying Game Balance
- **Sandbox**: Adjust `config.js` values — UI panel automatically reads from this object
- **Oleadas**: Modify `oleadasConfig.js` (waves, shop prices) or entity stats in `entidad.js`

### Fixing Entity Behavior
- Edit the `actuar(gameboard)` method in `entidad.js` for the relevant class
- Remember to call `this.actuar()` in both `engine.js` and `oleadasEngine.js` tick loops

### Rendering Issues
- Check `renderer.js` for drawing order, sprite paths, and animation logic
- Animation frames stored in `ANIM_MAP` (sprites are PNG files from tileset)
- HUD rendering happens in `renderer.renderHUD()` — stats, health bars, messages

## Important Conventions

- **No entity IDs after death** — dead entities are removed from `gameboard.entidadesActivas`; their `id` is never reused
- **Entity positions stored in gameboard** — `gameboard.entidadMap[fila][columna]` must match entity.fila/columna
- **Config immutability during game** — config changes only apply to next game start
- **Spanish variable names** — most variable names are in Spanish (e.g., `fila`, `columna`, `danio`, `vida`)

## File Size Reference
Largest files (watch for complexity):
- `renderer.js` (1070 lines) — Canvas rendering, animations, HUD
- `oleadas.js` (682 lines) — Wave mode UI, shop, RAF loop
- `entidad.js` (667 lines) — All entity classes and AI
- `jugador.js` (530 lines) — Player character logic
- `sandbox.js` (518 lines) — Sandbox UI, toolbox, zoom, settings panel
- `gameboard.js` (418 lines) — Board, map generation, entity placement

## Deployment
The game is deployed to GitHub Pages. The root `index.html` redirects to `web/`. Simply push to the `main` branch; GitHub Actions handles the rest.

## Useful Debugging Tips
- Use `config.semilla = 42` to reproduce bugs with the same map layout
- Check `gameboard.entidadesActivas` to verify entity counts and state
- `config.velocidadMs` can be set to large values (e.g., 1000) to slow down the game for inspection
- `config.modoLibre = true` prevents auto-game-end for extended testing
