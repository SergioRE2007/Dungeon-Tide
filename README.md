# Dungeon Tide

<div align="center">

**Un juego de estrategia y supervivencia en mazmorras generadas proceduralmente.**

Controla heroes, construye defensas y sobrevive oleadas de enemigos en un tablero tactica con IA, objetos y trampas.

[Jugar ahora](https://sergiore2007.github.io/Dungeon-Tide/) · [Reportar bug](https://github.com/SergioRE2007/Dungeon-Tide/issues)

</div>

---

## Sobre el proyecto

Dungeon Tide es un simulador de tablero tactica con dos modos de juego, desarrollado como proyecto educativo de POO para el ciclo DAM. Combina elementos de tower defense, sandbox configurable e inteligencia artificial con campo de vision.

Construido con **JavaScript vanilla**, **Canvas 2D** y sprites pixel art del tileset [0x72 Dungeon Tileset II](https://0x72.itch.io/dungeontileset-ii). Sin frameworks ni dependencias externas.

## Modos de juego

### Sandbox

Simulador libre donde enemigos persiguen aliados en una cuadricula. Configura cada parametro del juego y observa como se desarrolla la batalla.

- Panel de ajustes con 60+ parametros editables en tiempo real
- Colocacion manual de entidades, objetos y trampas (click o arrastrar)
- 5 tipos de mapa generados proceduralmente
- Modo libre (sin condicion de fin) o con victoria/derrota automatica
- Estadisticas post-partida con MVP por faccion
- Semilla configurable para partidas reproducibles

### Oleadas (Tower Defense)

Controla un heroe en el centro del mapa y defiendete de oleadas de enemigos que aparecen en las esquinas.

- Movimiento con **WASD** en 8 direcciones
- Dos armas: **espada** (melee, 8 celdas adyacentes) y **arco** (rango 5 celdas, apuntar con raton)
- Ataque con **click** o **espacio**
- Sistema de oleadas con escalado de dificultad
- **Jefes** cada 5 oleadas (3x vida, 2x danio)
- Tienda entre oleadas: muros, torres, pociones, mejoras del jugador
- Torres automaticas que atacan enemigos en rango

## Entidades

| Sprite | Tipo | Comportamiento |
|--------|------|----------------|
| Aliado | Heroe aliado | Huye de enemigos, recoge objetos. Con estrella activa persigue y mata |
| Enemigo | Goblin | Persigue al aliado mas cercano dentro de su vision |
| Tanque | Ogro | Lento (actua cada 2 turnos) pero mucha vida y danio alto |
| Rapido | Demonio | Doble movimiento por turno, agil y peligroso |
| Muro | Pared | Obstaculo. Los destructibles pueden ser atacados por enemigos |
| Torre | Columna | Ataca automaticamente enemigos en rango. Mejorable por niveles |

## Objetos y trampas

| Sprite | Tipo | Efecto |
|--------|------|--------|
| Escudo | Frasco azul | Absorbe danio antes de perder vida |
| Arma | Espada roja | Aumenta el danio de contraataque |
| Estrella | Moneda | Invencibilidad temporal + modo agresivo |
| Velocidad | Frasco amarillo | Doble movimiento durante varios turnos |
| Pocion | Frasco rojo | Restaura puntos de vida |
| Trampa | Pinchos | Danio al pisar (los aliados las esquivan) |

## Mapas

Cinco tipos de generacion procedural:

- **Arena** — recinto central amurallado con entradas y obstaculos interiores
- **Abierto** — muros lineales dispersos con tendencia a agruparse
- **Salas** — habitaciones conectadas por puertas
- **Laberinto** — generado con DFS + 30% de muros eliminados para jugabilidad
- **Vacio** — solo bordes, lienzo en blanco para colocacion manual

## Tecnologias

- **JavaScript ES6** (modulos nativos, sin framework)
- **HTML5 Canvas 2D** para renderizado
- **CSS** con fuente MedievalSharp
- **PRNG seedable** (mulberry32) para partidas reproducibles
- **Sprites**: [0x72 Dungeon Tileset II v1.7](https://0x72.itch.io/dungeontileset-ii)

## Estructura del proyecto

```
web/
├── index.html                 Interfaz completa (menu + sandbox + oleadas)
├── style.css                  Tema medieval oscuro
└── js/
    ├── app.js                 Entry point, seleccion de modo
    ├── config.js              Parametros sandbox (60+ ajustes)
    ├── oleadasConfig.js       Parametros tower defense
    ├── entidad.js             Entidad base + Aliado, Enemigo, Tanque, Rapido, Muro
    ├── jugador.js             Jugador controlable (modo oleadas)
    ├── torre.js               Torre defensiva con niveles
    ├── objetos.js             Escudo, Arma, Estrella, Velocidad, Pocion, Trampa
    ├── gameboard.js           3 arrays 2D + 5 algoritmos de generacion de mapa
    ├── engine.js              Game loop sandbox
    ├── oleadasEngine.js       Game loop oleadas + tienda + spawners
    ├── renderer.js            Canvas 2D + interpolacion + HUD + stats
    ├── sandbox.js             Logica UI sandbox (toolbox, ajustes)
    ├── oleadas.js             Logica UI oleadas (input, tienda, RAF loop)
    └── rng.js                 PRNG determinista (mulberry32)
```

## Mecanicas clave

- **Movimiento 8 direcciones** con pathfinding por distancia Manhattan
- **Anti-oscilacion**: buffer circular de historial evita que las entidades vuelvan sobre sus pasos
- **Combate**: enemigo ataca aliado → danio + contraataque. Aliado invencible → muerte instantanea del enemigo
- **IA con vision**: cada entidad solo detecta objetivos dentro de su radio de vision
- **Interpolacion de movimiento**: animacion suave entre celdas a 60fps con ease-out

## Licencia

Distribuido bajo la licencia **GPL-3.0**. Ver `LICENSE` para mas informacion.

---

<div align="center">
Desarrollado por <a href="https://github.com/SergioRE2007">SergioRE2007</a>
</div>
