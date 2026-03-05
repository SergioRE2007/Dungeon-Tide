# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Console-based board game in Java where enemies pursue allies on a grid. Allies collect power-ups (shields, weapons, stars) to survive. Educational OOP project for the DAM cycle. All code is in Spanish.

## Build & Run

```bash
# Compile (order matters: utils → objetos → entidades → GameEngine → App)
javac -d bin src/utils/*.java src/objetos/*.java src/entidades/*.java src/GameEngine.java src/App.java

# Run
java -cp bin App
```

No build tool (Maven/Gradle) — just javac. Output goes to `bin/` (gitignored). No test framework.

## Architecture

Four main classes orchestrate the game:

- **`GameConfig`** (`src/utils/`): All configurable parameters (board size, entity counts, stats, spawn intervals, object values)
- **`GameBoard`** (`src/utils/`): Encapsulates the 3 board arrays (`Entidad[][]`, `Objeto[][]`, `Trampa[][]`) + map generation + entity/object placement
- **`GameEngine`** (`src/`): Game loop logic — tick(), win/loss detection, state tracking
- **`Renderer`** (`src/utils/`): ANSI rendering of the board and HUD
- **`App`** (`src/`): Entry point, wires everything together (~25 lines)

Two parallel inheritance hierarchies:

- **Entidades** (`src/entidades/`): `Entidad` (abstract) → `Enemigo` → `EnemigoTanque`, `EnemigoRapido`; `Aliado`; `Muro`
- **Objetos** (`src/objetos/`): `Objeto` (abstract) → `Escudo`, `Arma`, `Estrella`, `Velocidad`, `Pocion`

**Key mechanics in `Entidad.java`:**
- 8-directional movement with Manhattan distance sorting
- Anti-oscillation system (circular history buffer, avoids returning unless trapped)
- Combat: enemy attacks ally → damage + counterattack; invincible ally → instant kill
- All movement/combat methods receive `GameBoard` instead of raw arrays

**AI behaviors:**
- `Enemigo`: pursues nearest ally within vision radius, otherwise random movement
- `Aliado`: flees enemies, collects nearby objects opportunistically; with star active, pursues and kills enemies

**Rendering:** ANSI escape codes for colors, StringBuilder for flicker-free single-flush output (in `Renderer.java`).

## Configuration

All game parameters live in `GameConfig.java` as public fields with sensible defaults. Modify these to tune gameplay.
