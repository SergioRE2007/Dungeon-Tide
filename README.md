# Dungeon Tide — Documentación Completa del Código

<div align="center">

**Un juego de estrategia y supervivencia en mazmorras generadas proceduralmente.**

[Jugar ahora](https://sergiore2007.github.io/Dungeon-Tide/) · [Reportar bug](https://github.com/SergioRE2007/Dungeon-Tide/issues)

</div>

---

## Índice

1. [Visión General del Proyecto](#1-visión-general-del-proyecto)
2. [Estructura de Archivos](#2-estructura-de-archivos)
3. [Diagrama de Dependencias](#3-diagrama-de-dependencias)
4. [rng.js — Generador de Números Aleatorios](#4-rngjs--generador-de-números-aleatorios)
5. [config.js — Configuración del Sandbox](#5-configjs--configuración-del-sandbox)
6. [oleadasConfig.js — Configuración del Modo Oleadas](#6-oleadasconfigjs--configuración-del-modo-oleadas)
7. [objetos.js — Objetos y Trampas](#7-objetosjs--objetos-y-trampas)
8. [entidad.js — Entidades del Juego](#8-entidadjs--entidades-del-juego)
9. [jugador.js — El Jugador Controlable](#9-jugadorjs--el-jugador-controlable)
10. [torre.js — Torre Defensiva](#10-torrejs--torre-defensiva)
11. [gameboard.js — El Tablero](#11-gameboardjs--el-tablero)
12. [engine.js — Motor del Sandbox](#12-enginejs--motor-del-sandbox)
13. [oleadasEngine.js — Motor del Modo Oleadas](#13-oleadasenginejs--motor-del-modo-oleadas)
14. [renderer.js — Sistema de Renderizado](#14-rendererjs--sistema-de-renderizado)
15. [sandbox.js — UI del Sandbox](#15-sandboxjs--ui-del-sandbox)
16. [oleadas.js — UI del Modo Oleadas](#16-oleadasjs--ui-del-modo-oleadas)
17. [app.js — Punto de Entrada](#17-appjs--punto-de-entrada)
18. [Mecánicas Clave](#18-mecánicas-clave)
19. [Flujo de Ejecución Completo](#19-flujo-de-ejecución-completo)
20. [Referencia Rápida de Propiedades de Entidades](#20-referencia-rápida-de-propiedades-de-entidades)

---

## 1. Visión General del Proyecto

Dungeon Tide es un juego de tablero táctico con dos modos:

- **Sandbox**: Simulador automático donde aliados y enemigos con IA se pelean en un tablero configurable. Tú solo observas y ajustas parámetros.
- **Oleadas (Tower Defense)**: Controlas a un héroe y te defiendes de oleadas de enemigos que aparecen en las esquinas. Tienes una tienda para comprar mejoras.

**Tecnologías usadas:**
- JavaScript ES6 con módulos nativos (`import`/`export`) — sin frameworks
- HTML5 Canvas 2D para el renderizado gráfico
- CSS puro para la interfaz
- PRNG seedable (mulberry32) para reproducibilidad

---

## 2. Estructura de Archivos

```
Dungeon-Tide/
├── index.html              ← Raíz del proyecto (redirecciona a web/)
├── README.md               ← Este archivo
└── web/
    ├── index.html          ← HTML principal (menú + sandbox + oleadas)
    ├── style.css           ← Estilos (tema medieval oscuro)
    ├── wallpaper/          ← Imágenes de fondo
    ├── 0x72_DungeonTilesetII_v1.7/
    │   └── frames/         ← Sprites PNG (personajes, objetos, suelo...)
    └── js/
        ├── app.js              ← Punto de entrada. Gestiona los modos de juego
        ├── config.js           ← Configuración base del Sandbox (60+ parámetros)
        ├── oleadasConfig.js    ← Configuración del modo Oleadas
        ├── rng.js              ← Generador de números aleatorios determinista
        ├── objetos.js          ← Clases: Objeto, Escudo, Arma, Estrella, Velocidad, Pocion, Trampa
        ├── entidad.js          ← Clases: Entidad, Aliado, Enemigo, Tanque, Rápido, Mago, Guerrero, Arquero, Muro...
        ├── jugador.js          ← Clase Jugador (héroe controlable en Oleadas)
        ├── torre.js            ← Clase Torre (defensa automática en Oleadas)
        ├── gameboard.js        ← Clase GameBoard (tablero + generación de mapas)
        ├── engine.js           ← Clase GameEngine (lógica del Sandbox)
        ├── oleadasEngine.js    ← Clase OleadasEngine (lógica de Oleadas + tienda)
        ├── renderer.js         ← Clase Renderer (Canvas 2D, animaciones, HUD)
        ├── sandbox.js          ← UI del Sandbox (eventos, toolbox, zoom)
        └── oleadas.js          ← UI de Oleadas (input WASD, tienda, loop RAF)
```

---

## 3. Diagrama de Dependencias

```
app.js
 ├── sandbox.js
 │    ├── config.js
 │    ├── engine.js ──────────┐
 │    ├── renderer.js         │
 │    ├── entidad.js          │
 │    └── objetos.js          │
 │                            ▼
 └── oleadas.js          gameboard.js
      ├── oleadasEngine.js ──►├── entidad.js
      ├── renderer.js         ├── objetos.js
      ├── entidad.js          └── rng.js
      └── oleadasConfig.js

entidad.js ──► rng.js
jugador.js ──► entidad.js
torre.js   ──► entidad.js
```

**Regla básica:** `rng.js`, `objetos.js`, `entidad.js` son los módulos más bajos. Todo lo demás los importa pero ellos no dependen de nadie (excepto `entidad.js` → `rng.js`).

---

## 4. `rng.js` — Generador de Números Aleatorios

**Propósito:** Provee números aleatorios que pueden ser **deterministas** (si le das una semilla) o **completamente aleatorios** (semilla = -1). Esto permite reproducir partidas exactas.

Usa el algoritmo **mulberry32**, una función hash rápida.

### Variables internas

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `_state` | `number` | Estado actual del PRNG (la "semilla activa") |
| `_useFallback` | `boolean` | Si es `true`, usa `Math.random()` en lugar del PRNG |

### Funciones exportadas

#### `setSeed(seed)`
Inicializa el generador.
- Si `seed === -1` → activa modo aleatorio real (`Math.random()`).
- Si `seed` es otro número → usa mulberry32 determinista.

```js
import * as Rng from './rng.js';
Rng.setSeed(42);    // Partida reproducible con semilla 42
Rng.setSeed(-1);    // Partida aleatoria cada vez
```

#### `random()`
Devuelve un número decimal entre `0` (incluido) y `1` (excluido).

#### `nextInt(max)`
Devuelve un entero entre `0` y `max - 1`.
```js
Rng.nextInt(6)  // → 0, 1, 2, 3, 4 ó 5 (como un dado de 6)
```

#### `nextDouble()`
Igual que `random()`. Devuelve un decimal entre 0 y 1. Útil para probabilidades.
```js
if (Rng.nextDouble() < 0.30) {
    // Ocurre el 30% de las veces
}
```

---

## 5. `config.js` — Configuración del Sandbox

**Propósito:** Objeto exportado por defecto con todos los parámetros del modo Sandbox. El panel lateral de ajustes en la UI modifica este objeto en tiempo real.

```js
import config from './config.js';
config.numAliado = 20; // Cambia el número de aliados
```

### Parámetros disponibles

#### General
| Parámetro | Valor por defecto | Descripción |
|-----------|-------------------|-------------|
| `semilla` | `-1` | Semilla del RNG. -1 = aleatorio |
| `velocidadMs` | `100` | Milisegundos entre cada tick (turno) |
| `modoLibre` | `false` | Si `true`, la partida no termina automáticamente |

#### Mapa
| Parámetro | Valor por defecto | Descripción |
|-----------|-------------------|-------------|
| `filas` | `20` | Alto del tablero en celdas |
| `columnas` | `37` | Ancho del tablero en celdas |
| `tipoMapa` | `"arena"` | Tipo: `"arena"`, `"abierto"`, `"salas"`, `"laberinto"`, `"vacio"` |
| `numMuro` | `60` | Número de muros a generar (en mapa "abierto") |
| `probPegarMuro` | `70` | % de probabilidad de que el siguiente muro esté pegado al anterior |

#### Aliados (básicos)
| Parámetro | Descripción |
|-----------|-------------|
| `numAliado` | Número de aliados normales |
| `vidaAliado` | Vida inicial |
| `danioBaseAliadoMin` / `Max` | Rango de daño |
| `visionAliado` | Radio en celdas donde detectan enemigos |

#### Enemigos normales
| Parámetro | Descripción |
|-----------|-------------|
| `numEnemigo` | Cantidad |
| `vidaEnemigo` | Vida inicial |
| `danioEnemigoMin` / `Max` | Rango de daño |
| `visionEnemigo` | Radio de visión |

#### Enemigo Tanque
| Parámetro | Descripción |
|-----------|-------------|
| `numEnemigoTanque` | Cantidad (por defecto 1) |
| `vidaTanque` | `3000` — muy resistente |
| `danioTanqueMin` / `Max` | `100–200` — daño brutal |
| `visionTanque` | `10` — amplia visión |

#### Enemigo Rápido
| Parámetro | Descripción |
|-----------|-------------|
| `numEnemigoRapido` | Cantidad (por defecto 2) |
| `vidaRapido` | `200` |
| `danioRapidoMin` / `Max` | `100` |
| `visionRapido` | `10` |

#### Enemigo Mago
| Parámetro | Descripción |
|-----------|-------------|
| `numEnemigoMago` | `0` por defecto |
| `vidaMago` | `80` — frágil |
| `danioMagoMin` / `Max` | `20–40` |
| `visionMago` | `8` |
| `rangoMago` | `5` — dispara a distancia |

#### Guerrero (aliado cuerpo a cuerpo avanzado)
| Parámetro | Descripción |
|-----------|-------------|
| `numGuerrero` | `0` por defecto |
| `vidaGuerrero` | `300` |
| `danioGuerreroMin` / `Max` | `30–50` |
| `visionGuerrero` | `8` |

#### Arquero (aliado a distancia)
| Parámetro | Descripción |
|-----------|-------------|
| `numArquero` | `0` por defecto |
| `vidaArquero` | `120` |
| `danioArqueroMin` / `Max` | `15–25` |
| `visionArquero` | `10` |
| `rangoArquero` | `5` — alcance del disparo |

#### Trampas
| Parámetro | Descripción |
|-----------|-------------|
| `numTrampa` | `15` |
| `danioTrampa` | `80` por pisada |

#### Objetos
| Parámetro | Descripción |
|-----------|-------------|
| `turnosSpawnObjeto` | Cada cuántos turnos aparece un objeto nuevo. `0` = desactivado |
| `numEscudo` / `numArma` / `numEstrella` / `numVelocidad` / `numPocion` | Cantidades iniciales |
| `valorEscudo` | `50` — puntos de escudo que da |
| `valorArma` | `20` — daño extra que da |
| `turnosEstrella` | `30` — turnos de invencibilidad |
| `duracionVelocidad` | `30` — turnos de doble movimiento |
| `curacionPocion` | `50` — HP que restaura |

---

## 6. `oleadasConfig.js` — Configuración del Modo Oleadas

**Propósito:** Igual que `config.js` pero para el modo Oleadas. Exportado por defecto.

### Parámetros importantes

#### Mapa y jugador base
| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `filas` / `columnas` | `19` / `35` | Tamaño del tablero |
| `velocidadMs` | `200` | Velocidad de simulación de enemigos |

#### Clases del jugador (`clases`)
Objeto con las 3 clases disponibles. Cada clase tiene:

| Campo | Descripción |
|-------|-------------|
| `nombre` | Nombre mostrado en la UI |
| `desc` | Descripción breve |
| `icono` | Emoji del icono |
| `vida` | Vida máxima inicial |
| `danio` | Daño base |
| `cooldownAtaque` | Turnos entre ataques |
| `arma` | `'espada'`, `'arco'` o `'baston'` |
| `rango` | Rango del arma a distancia (si aplica) |
| `velocidadMoverMs` | Milisegundos entre movimientos del jugador |
| `habilidad` | Objeto con la habilidad especial (ver abajo) |

**Habilidades por clase:**

| Clase | Habilidad | Cooldown | Efecto |
|-------|-----------|----------|--------|
| Guerrero | Golpe Sísmico | 10s | Daño ×3 en radio 5 (forma de diamante) |
| Arquero | Flecha Colosal | 8s | Flecha ancha de rango 12 con daño ×3 |
| Necromancer | Invocar Aliados | 12s | Invoca 3 esqueletos aliados alrededor |

#### Oleadas y escalado
| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `enemigosBase` | `5` | Enemigos en la primera oleada |
| `enemigosIncremento` | `2` | Enemigos adicionales por oleada |
| `escalaVidaOleada` | `1.15` | Multiplicador de vida por oleada (15% más cada vez) |
| `oleadaTanques` | `3` | A partir de qué oleada pueden aparecer tanques |
| `oleadaRapidos` | `5` | A partir de qué oleada aparecen rápidos |
| `oleadaMagos` | `4` | A partir de qué oleada aparecen magos |
| `oleadaBoss` | `5` | Cada cuántas oleadas hay un boss |
| `bossMultiplicadorVida` | `3` | La vida del boss se multiplica por esto |
| `bossMultiplicadorDanio` | `2` | El daño del boss se multiplica por esto |

#### Recompensas
| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `recompensaEnemigo` | `10` | Dinero por matar un enemigo normal |
| `recompensaTanque` | `30` | Dinero por matar un tanque |
| `recompensaRapido` | `15` | Dinero por matar un rápido |
| `recompensaMago` | `20` | Dinero por matar un mago |
| `probDrop` | `0.15` | Probabilidad (15%) de que un enemigo muerto suelte un objeto |

#### Tienda — precios base
| Parámetro | Valor | Escala con compras |
|-----------|-------|--------------------|
| `precioMuro` | `5` | No |
| `precioTorre` | `50` | No |
| `precioMejoraVida` | `20` | Sí (×1.5 cada compra) |
| `precioMejoraDanio` | `15` | Sí |
| `precioMejoraVelAtaque` | `25` | Sí |
| `precioPocion` | `10` | No |
| `precioEscudo` | `15` | No |
| `precioEstrella` | `40` | No |
| `precioMejoraTorre` | `30` | No |

#### Tienda — efectos
| Parámetro | Valor | Qué hace |
|-----------|-------|---------|
| `vidaMuro` | `100` | HP del muro construido |
| `vidaTorre` | `150` | HP de la torre |
| `danioTorre` | `20` | Daño por disparo de la torre |
| `rangoTorre` | `4` | Radio de ataque de la torre |
| `cooldownTorre` | `4` | Turnos entre disparos de la torre |
| `mejoraVidaCantidad` | `50` | HP que añade "Mejorar Vida" |
| `mejoraDanioCantidad` | `10` | Daño extra que añade "Mejorar Daño" |
| `escudoCantidad` | `50` | Escudo que da comprar un escudo |
| `turnosEstrella` | `30` | Turnos de invencibilidad |
| `curacionPocion` | `80` | HP que restaura la poción |
| `escalaPrecio` | `1.5` | Factor por el que sube el precio de las mejoras del jugador |

---

## 7. `objetos.js` — Objetos y Trampas

**Propósito:** Define los objetos recogibles y las trampas. Los objetos se recogen cuando un aliado pisa su celda y aplican un efecto.

### Clase base `Objeto`

```js
class Objeto {
    constructor(fila, columna, simbolo)
    aplicar(aliado) // Override en subclases — aplica el efecto al aliado
}
```

| Propiedad | Descripción |
|-----------|-------------|
| `fila`, `columna` | Posición en el tablero |
| `simbolo` | Carácter identificador (para depuración) |

### `Escudo` (símbolo: `'S'`)
Añade puntos de escudo al aliado. El escudo absorbe daño antes de la vida.

```js
new Escudo(fila, columna, cantidad)
// aplicar(aliado) → aliado.addEscudo(cantidad)
```

### `Arma` (símbolo: `'W'`)
Incrementa permanentemente el daño extra del aliado.

```js
new Arma(fila, columna, cantidad)
// aplicar(aliado) → aliado.addDanioExtra(cantidad)
```

### `Estrella` (símbolo: `'*'`)
Activa invencibilidad temporal. Mientras está activa, el aliado mata enemigos instantáneamente.

```js
new Estrella(fila, columna, turnos)
// aplicar(aliado) → aliado.setTurnosInvencible(turnos)
```

### `Velocidad` (símbolo: `'V'`)
Activa doble movimiento durante varios turnos (el aliado actúa dos veces por turno).

```js
new Velocidad(fila, columna, duracion)
// aplicar(aliado) → aliado.setTurnosVelocidad(duracion)
```

### `Pocion` (símbolo: `'+'`)
Restaura puntos de vida (sin superar el máximo).

```js
new Pocion(fila, columna, curacion)
// aplicar(aliado) → aliado.curar(curacion)
```

### `Trampa` (símbolo: `'^'`)
**No es un `Objeto`** — se almacena en un array separado (`board.trampas[][]`). Inflige daño cada turno a cualquier entidad que esté sobre ella (excepto muros). Los aliados las detectan y evitan.

```js
new Trampa(fila, columna, danio)
trampa.getDanio() // → devuelve el daño de la trampa
```

---

## 8. `entidad.js` — Entidades del Juego

**Propósito:** El módulo más importante. Define todas las entidades que existen en el tablero: aliados, enemigos, muros. Todas heredan de `Entidad`.

### Variable global `contadorId`
Contador que asigna un ID único incremental a cada entidad creada. Se reinicia con `resetContadorId()` al inicio de cada partida.

```js
export function resetContadorId()  // Reinicia el contador a 0
```

### Constantes internas

```js
const HISTORIAL_MAX = 5;  // Máximo de posiciones recordadas por entidad
const MOVIMIENTOS = [     // Las 8 direcciones posibles (ortogonales + diagonales)
    [-1, 0], [1, 0], [0, -1], [0, 1],    // arriba, abajo, izquierda, derecha
    [-1, -1], [-1, 1], [1, -1], [1, 1]   // diagonales
];
```

---

### Clase `Entidad` (clase base)

```js
new Entidad(fila, columna, simbolo, vida, tipo = 'ENTIDAD')
```

#### Propiedades

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `id` | `number` | ID único autoincremental |
| `fila`, `columna` | `number` | Posición actual en el tablero |
| `simbolo` | `string` | Carácter para debug (`'A'`, `'X'`, `'M'`...) |
| `vida` | `number` | Vida actual |
| `vidaMax` | `number` | Vida máxima (igual a `vida` al crear) |
| `danioInfligido` | `number` | Daño total causado (para estadísticas) |
| `danioRecibido` | `number` | Daño total recibido (para estadísticas) |
| `kills` | `number` | Número de enemigos eliminados |
| `tipo` | `string` | Identificador de tipo: `'ALIADO'`, `'ENEMIGO'`, `'MURO'`, etc. |
| `filaAnterior`, `colAnterior` | `number` | Posición antes del último movimiento (para interpolación visual) |
| `moveTimestamp` | `number` | Timestamp del último movimiento (para interpolación) |
| `hitTimestamp` | `number` | Timestamp del último golpe recibido (para efecto blink) |

#### Métodos públicos

##### `recibirDanio(danio)`
Resta `danio` puntos de vida. Activa `hitTimestamp` para el efecto visual de parpadeo. La vida nunca baja de 0.

##### `estaVivo()`
Devuelve `true` si `vida > 0`.

##### `addDanioRecibido(cantidad)`
Suma al contador de daño recibido (para estadísticas). No afecta la vida.

##### `actuar(board)`
**Método vacío en la clase base.** Cada subclase lo sobreescribe con su IA.

##### `distancia(f1, c1, f2, c2)`
Calcula la **distancia Manhattan** entre dos puntos. Fórmula: `|f1-f2| + |c1-c2|`.

```js
entidad.distancia(0, 0, 3, 4) // → 7
```

##### `buscarCercano(tipo, vision, board)`
Busca la entidad del `tipo` indicado más cercana dentro del radio `vision`.
- Itera sobre todas las celdas en el cuadrado `[fila±vision, columna±vision]`
- Usa `instanceof` para el tipo
- Devuelve la entidad más cercana o `null`

```js
const objetivo = enemigo.buscarCercano(Aliado, 5, board);
```

##### `moverHacia(destF, destC, board)`
Intenta moverse una celda en dirección a la posición destino. Ordena los movimientos de menor a mayor distancia y prueba cada uno.

##### `moverLejos(enemigoF, enemigoC, board)`
Lo contrario: ordena los movimientos de mayor a menor distancia (huye del objetivo).

##### `moverRandom(board)`
Con un 30% de probabilidad, hace un movimiento aleatorio (shuffle Fisher-Yates de las 8 direcciones).

#### Métodos privados (no llamar directamente)

##### `_copiarMovimientos()`
Devuelve una copia del array `MOVIMIENTOS` para no modificar el original.

##### `_ordenarPorDistancia(movs, objF, objC, ascendente)`
Ordena `movs` según la distancia al objetivo. `ascendente = true` → acercarse, `false` → alejarse.

##### `_estaEnHistorial(fila, col)`
Comprueba si la posición está en el historial circular (para evitar oscilar).

##### `_intentarMovimientos(movs, board)`
Prueba cada movimiento en orden. Primero evita posiciones del historial; si no puede moverse, usa el historial como fallback.

##### `_moverSiPosible(nuevaFila, nuevaCol, board)`
El método más importante del movimiento. Comprueba si la celda es accesible y:
- Si hay un **muro destructible**: el enemigo lo ataca.
- Si hay una **torre** (símbolo `'R'`): el enemigo la ataca.
- Si hay un **aliado** y soy enemigo: **combate**. El enemigo ataca → el aliado contraataca.
- Si hay un **enemigo** y soy aliado: **combate**. El aliado ataca → el enemigo contraataca.
- Si está **vacía**: se mueve, actualiza `filaAnterior`/`colAnterior`/`moveTimestamp` e historial.

**Lógica de combate melee:**
1. El atacante inflige su daño al defensor.
2. El defensor contraataca.
3. Si alguien muere, se marca pero NO se elimina del tablero aquí — eso lo hace el `tick()`.

---

### Clase `Aliado` — extiende `Entidad`

```js
new Aliado(fila, columna, vida, danioBaseMin, danioBaseMax, vision)
```

Tipo: `'ALIADO'`, símbolo: `'A'`

#### Propiedades adicionales

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `vision` | `number` | Radio de detección de enemigos |
| `danioBaseMin`, `danioBaseMax` | `number` | Rango de daño base |
| `escudo` | `number` | Puntos de escudo actuales (absorben daño) |
| `danioExtra` | `number` | Daño adicional de objetos recogidos |
| `turnosInvencible` | `number` | Turnos restantes de invencibilidad (estrella) |
| `turnosVelocidad` | `number` | Turnos restantes de doble movimiento |
| `objetosRecogidosPersonal` | `number` | Contador individual de objetos recogidos |

#### Métodos

##### `getDanio()`
Calcula el daño de este turno: `danioBaseMin + aleatorio(danioBaseMax - danioBaseMin + 1) + danioExtra`.

##### `addEscudo(cantidad)` / `addDanioExtra(cantidad)`
Incrementan el escudo o el daño extra.

##### `setTurnosInvencible(turnos)` / `setTurnosVelocidad(turnos)`
Activan los estados especiales.

##### `incrementarObjetosRecogidos()`
Suma 1 a `objetosRecogidosPersonal`.

##### `curar(cantidad)`
Restaura vida sin superar `vidaMax`. Fórmula: `Math.min(vida + cantidad, vidaMax)`.

##### `recibirDanio(danio)` *(override)*
Si tiene **escudo**, el daño lo absorbe primero el escudo. Si el escudo no alcanza, el resto va a la vida. Si está **invencible**, ignora todo el daño.

##### `actuar(board)` *(override)*
- Decrementa `turnosVelocidad`.
- Si tiene velocidad activa, llama `_realizarMovimiento()` dos veces.
- Si no, una vez.

##### `_realizarMovimiento(board)`
IA del aliado:
1. Si hay **invencibilidad activa**, la decrementa.
2. Busca el **enemigo más cercano** con `buscarCercano()`.
3. Si hay enemigo → `moverHacia()`.
4. Si no hay enemigo pero hay **objeto cercano** → `moverHacia()` al objeto.
5. Si nada → `moverRandom()`.

##### `_buscarObjetoCercano(board, vision)`
Busca objetos en el tablero dentro del radio `vision`. Devuelve `{fila, columna}` del más cercano o `null`.

---

### Clase `Enemigo` — extiende `Entidad`

```js
new Enemigo(fila, columna, vida, danioMin, danioMax, vision)
```

Tipo: `'ENEMIGO'`, símbolo: `'X'`

#### Métodos

##### `getDanio()`
Igual que Aliado pero con sus propios rangos: `danioMin + aleatorio(danioMax - danioMin + 1)`.

##### `actuar(board)` *(override)*
IA simple:
- Busca el **aliado más cercano** en su radio de visión.
- Si lo encuentra → `moverHacia()`.
- Si no → `moverRandom()`.

---

### Clase `EnemigoTanque` — extiende `Enemigo`

```js
new EnemigoTanque(fila, columna, vida, danioMin, danioMax, vision)
```

Tipo: `'ENEMIGO_TANQUE'`, símbolo: `'T'`

Mucha vida y daño, pero solo actúa en **turnos pares** (uno sí, uno no). Tiene `turnoInterno` para rastrearlo.

##### `actuar(board)` *(override)*
```js
this.turnoInterno++;
if (this.turnoInterno % 2 !== 0) return; // Solo actúa cada 2 turnos
super.actuar(board); // IA del Enemigo normal
```

---

### Clase `EnemigoRapido` — extiende `Enemigo`

```js
new EnemigoRapido(fila, columna, vida, danioMin, danioMax, vision)
```

Tipo: `'ENEMIGO_RAPIDO'`, símbolo: `'R'`

Actúa **dos veces** por turno (doble velocidad).

##### `actuar(board)` *(override)*
```js
super.actuar(board);        // Primer movimiento
if (this.estaVivo()) {
    super.actuar(board);    // Segundo movimiento
}
```

---

### Clase `EnemigoMago` — extiende `Enemigo`

```js
new EnemigoMago(fila, columna, vida, danioMin, danioMax, vision, rango)
```

Tipo: `'ENEMIGO_MAGO'`, símbolo: `'W'`

Ataca a distancia con cooldown. Intenta mantenerse a distancia media del aliado.

#### Propiedades adicionales

| Propiedad | Descripción |
|-----------|-------------|
| `rango` | Distancia máxima de disparo |
| `cooldownMax` | `3` — turnos entre disparos |
| `cooldownActual` | Turnos restantes antes de poder disparar |
| `ultimoObjetivo` | Referencia al último aliado atacado (para dirección del arma) |
| `pendingAnim` | Objeto con datos para la animación de magia en el Renderer |

##### `actuar(board)` *(override)*
1. Decrementa `cooldownActual`.
2. Busca el aliado más cercano.
3. Si está **en rango** y el cooldown es 0 → dispara con `_dispararA()`.
4. Si está **demasiado cerca** (dist ≤ 2) → `moverLejos()`.
5. Si está **demasiado lejos** (dist > rango) → `moverHacia()`.
6. Si no hay aliado → `moverRandom()`.

##### `_dispararA(objetivo, board)`
- Activa cooldown.
- Calcula y aplica daño al objetivo.
- Genera la **trayectoria** de la animación (array de `{f, c}` desde el mago al objetivo).
- Guarda `pendingAnim = { tipo: 'magia', origen, trayectoria }` para que el Renderer la procese.

---

### Clase `AliadoGuerrero` — extiende `Aliado`

```js
new AliadoGuerrero(fila, columna, vida, danioMin, danioMax, vision)
```

Tipo: `'GUERRERO'`, símbolo: `'G'`

Ataca en **arco de espada**: golpea simultáneamente las 8 celdas adyacentes con cooldown.

#### Propiedades adicionales

| Propiedad | Descripción |
|-----------|-------------|
| `cooldownEspada` | `3` — turnos entre ataques de espada |
| `cooldownAtaque` | Contador descendente |
| `ultimoObjetivo` | Para calcular el ángulo del arma en el renderer |
| `pendingAnim` | Animación pendiente de swing |

##### `_realizarMovimiento(board)` *(override)*
1. Decrementa cooldown.
2. Busca enemigo cercano.
3. Si hay enemigo y distancia ≤ 2 y cooldown = 0 → `_atacarEspada()`.
4. Si hay enemigo pero está lejos → `moverHacia()`.
5. Si no hay enemigo → busca objetos o mueve aleatorio.

##### `_atacarEspada(board, objetivo)`
- Activa cooldown.
- Calcula el ángulo hacia el objetivo (para la animación).
- Itera las **8 celdas adyacentes** y aplica daño a todos los enemigos encontrados.
- Si algún enemigo muere: lo elimina del tablero inmediatamente y suma kill.
- Guarda `pendingAnim = { tipo: 'swing', celdas, angulo }`.

---

### Clase `AliadoArquero` — extiende `Aliado`

```js
new AliadoArquero(fila, columna, vida, danioMin, danioMax, vision, rango)
```

Tipo: `'ARQUERO'`, símbolo: `'B'`

Dispara flechas a distancia. Intenta mantener distancia óptima con el enemigo.

#### Propiedades adicionales

| Propiedad | Descripción |
|-----------|-------------|
| `rango` | Distancia máxima de disparo |
| `cooldownMax` | `2` — turnos entre disparos |
| `cooldownActual` | Cooldown actual |
| `ultimoObjetivo` | Para ángulo del arma |
| `pendingAnim` | Animación de flecha |

##### `_realizarMovimiento(board)` *(override)*
1. Si hay enemigo y está en rango y cooldown = 0 → dispara.
2. Si está demasiado cerca (dist ≤ 2) → `moverLejos()`.
3. Si está demasiado lejos (dist > rango) → `moverHacia()`.
4. Si está en rango óptimo → no se mueve.

##### `_dispararA(objetivo, board)`
- Aplica daño al objetivo directamente (sin moverse).
- Genera trayectoria para la animación de flecha.
- Guarda `pendingAnim = { tipo: 'flecha', origen, trayectoria }`.

---

### Clase `AliadoEsqueleto` — extiende `Aliado`

```js
new AliadoEsqueleto(fila, columna, vida, danioMin, danioMax, vision)
```

Tipo: `'ESQUELETO'`, símbolo: `'S'`

Es el aliado que invoca el **Necromancer**. Funciona exactamente igual que un `Aliado` normal pero con su propio tipo para distinguirlo visualmente.

---

### Clase `Muro` — extiende `Entidad`

```js
new Muro(fila, columna, vida = 9999)
```

Tipo: `'MURO'`, símbolo: `'M'`

Obstáculo estático. Si `vida < 9999` es **destructible** (los enemigos pueden atacarlo). La vida por defecto `9999` lo hace prácticamente indestructible.

##### `actuar(board)` *(override)*
No hace nada (los muros no se mueven).

---

## 9. `jugador.js` — El Jugador Controlable

**Propósito:** Extiende `Aliado` para el héroe controlado por el jugador en el modo Oleadas. Añade ataques manuales, habilidades especiales y movimiento por teclado.

```js
new Jugador(fila, columna, idClase, configClases)
```

- `idClase`: `'guerrero'`, `'arquero'` o `'necromancer'`
- `configClases`: referencia a `oleadasConfig.clases`

#### Propiedades adicionales

| Propiedad | Descripción |
|-----------|-------------|
| `dinero` | Dinero acumulado del jugador (igual que `engine.dinero`) |
| `idClase` | Clase seleccionada |
| `armaActual` | `'espada'`, `'arco'` o `'baston'` |
| `cooldownEspada` / `cooldownArco` | Cooldowns de cada arma |
| `danioArco` | Daño del arma a distancia |
| `rangoArco` | Alcance del arma a distancia |
| `velocidadMoverMs` | ms entre movimientos (depende de la clase) |
| `cooldownAtaque` | Cooldown descendente actual |
| `direccion` | `[df, dc]` — última dirección WASD |
| `habilidadConfig` | Objeto de configuración de la habilidad especial |
| `habilidadListaEn` | Timestamp (ms) cuando la habilidad estará disponible |

### Métodos

##### `actuar(board)` *(override)*
El jugador **no tiene IA**. Solo decrementa cooldowns:
- `turnosInvencible--`
- `turnosVelocidad--`
- `cooldownAtaque--`

##### `moverWASD(tecla, board)`
Mueve el jugador según la tecla `'w'`/`'a'`/`'s'`/`'d'`. Devuelve `true` si se movió.

##### `moverDir(df, dc, board)`
Mueve el jugador en una dirección expresada como `(df, dc)`. Normaliza a `-1/0/1` con `Math.sign`. Permite movimiento diagonal.

##### `atacarEspada(board)`
Ataca las **8 celdas adyacentes** sin importar la dirección. Solo funciona si `cooldownAtaque === 0`. Devuelve array de kills.

##### `atacarEspadaArco(angulo, board)`
Ataque de espada **dirigido hacia el mouse**. Selecciona las **3 celdas más alineadas** con el ángulo del mouse + extiende 1 celda más en esa dirección. Devuelve `{ kills, celdasAfectadas }`.

##### `atacarArco(board, angulo)`
Dispara una flecha en línea recta hacia el ángulo del mouse. **Atraviesa enemigos** (puede golpear a varios en fila). Usa `_trazarLineaRecta()` para el raycasting. Devuelve `{ kills, trayectoria }`.

##### `atacarBaston(board, angulo)`
Dispara una bola de magia. **NO atraviesa enemigos** — para en el primero que golpea. Cuando impacta, hace daño en **área** (radio 1 alrededor del objetivo). Devuelve `{ kills, trayectoria, celdasAfectadas }`.

##### `atacar(board)`
Método conveniente: llama `atacarEspada` o `atacarArco` según `armaActual`.

##### `_trazarLineaRecta(f0, c0, sf, sc, maxCeldas)`
Raycasting sobremuestreado: traza una línea desde el jugador y devuelve todas las celdas que atraviesa. Usa pasos de `0.25` celdas para no saltarse celdas diagonales.

##### `habilidadLista()`
Devuelve `true` si la habilidad especial está disponible (cooldown terminado).

##### `habilidadCooldownRestante()`
Devuelve los milisegundos que quedan para que la habilidad esté lista.

##### `usarHabilidad(board, angulo)`
Activa la habilidad especial del jugador. Pone en cooldown y llama al método correcto según el arma:
- `espada` → `_habilidadGolpeSismico(board)`
- `baston` → `_habilidadInvocar(board)`
- `arco` → `_habilidadFlechaColosal(board, angulo)`

##### `_habilidadGolpeSismico(board)`
Daño ×`multiplicadorDanio` en un **radio de diamante** alrededor del jugador. Devuelve `{ tipo: 'sismico', kills, celdasAfectadas }`.

##### `_habilidadFlechaColosal(board, angulo)`
Flecha ancha: traza la línea central + celdas a los lados (ancho configurable). No se detiene en enemigos. Devuelve `{ tipo: 'colosal', kills, trayectoria, trayectoriaCentro }`.

##### `_habilidadInvocar(board)`
Busca hasta `numInvocaciones` celdas libres en radio 2 alrededor del jugador. Crea un `AliadoEsqueleto` (si es Necromancer) o un `Aliado` normal en cada celda. Devuelve `{ tipo: 'invocar', invocados, kills: [] }`.

---

## 10. `torre.js` — Torre Defensiva

**Propósito:** Torre que el jugador coloca en el modo Oleadas. Ataca automáticamente a los enemigos más cercanos.

```js
new Torre(fila, columna, vida, danio, rango, cooldown)
```

Extiende `Entidad`. Tipo heredado de `Entidad`, símbolo: `'R'` (de to**R**re).

#### Propiedades

| Propiedad | Descripción |
|-----------|-------------|
| `danio` | Daño por disparo |
| `rango` | Radio de detección de enemigos |
| `cooldownMax` | Turnos entre disparos |
| `cooldownActual` | Cooldown actual |
| `nivel` | Nivel de la torre (empieza en 1) |

### Métodos

##### `actuar(board)`
1. Si `cooldownActual > 0` → lo decrementa y no hace nada más.
2. Si no → busca el `Enemigo` más cercano con `buscarCercano()`.
3. Si lo encuentra → aplica daño, activa cooldown, registra estadísticas.
4. Si el enemigo muere → lo elimina del tablero inmediatamente.

##### `mejorar()`
Sube el nivel de la torre y mejora sus estadísticas:
- `danio` × 1.4
- `rango` + 1
- `vidaMax` × 1.3
- Restaura la vida al nuevo máximo

---

## 11. `gameboard.js` — El Tablero

**Propósito:** Gestiona los tres arrays 2D del tablero (entidades, objetos, trampas), el array de celdas vacías y la lista de entidades activas. También contiene los 5 algoritmos de generación de mapas.

```js
new GameBoard(filas, columnas)
```

#### Propiedades

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `filas`, `columnas` | `number` | Dimensiones |
| `entidades` | `Array[filas][columnas]` | Entidades en cada celda (o `null`) |
| `objetos` | `Array[filas][columnas]` | Objetos recogibles en cada celda |
| `trampas` | `Array[filas][columnas]` | Trampas en cada celda |
| `vacio` | `Array[filas][columnas]` | `true` = celda es abismo (intransitable) |
| `entidadesActivas` | `Array<Entidad>` | Lista plana de aliados y enemigos vivos |

### Getters y Setters

```js
board.esVacio(f, c)           // ¿Es abismo?
board.setVacio(f, c, v)       // Marcar celda como abismo

board.getEntidad(f, c)        // Entidad en esa celda o null
board.setEntidad(f, c, e)     // Colocar/borrar entidad

board.getObjeto(f, c)         // Objeto en esa celda o null
board.setObjeto(f, c, o)      // Colocar/borrar objeto

board.getTrampa(f, c)         // Trampa en esa celda o null
board.setTrampa(f, c, t)      // Colocar/borrar trampa
```

### Gestión de `entidadesActivas`

```js
board.addEntidadActiva(e)     // Añade si es aliado/enemigo (no muro, no torre)
board.removeEntidadActiva(e)  // Elimina de la lista
```

### Métodos de generación

##### `colocarBordes()`
Coloca `Muro` (indestructibles) en toda la periferia del tablero.

##### `generarMapa(config)`
Despacha al generador correcto según `config.tipoMapa`.

##### `_generarMuros(numMuros, probPegarPct)` — Mapa "abierto"
Genera muros con tendencia a agruparse. Cada muro tiene `probPegarPct`% de probabilidad de colocarse adyacente al anterior.

##### `_generarMapaSalas(topeMuros)` — Mapa "salas"
Genera entre 3 y 6 salas rectangulares con paredes y 1-2 puertas cada una.

##### `_generarMapaLaberinto()` — Mapa "laberinto"
Genera un laberinto perfecto usando **DFS (backtracking)**:
1. Rellena todo con muros.
2. Usa DFS desde la celda (0,0) abriendo caminos entre celdas pares (saltando de 2 en 2).
3. Elimina aleatoriamente el 30% de los muros resultantes para que sea jugable.

##### `_generarMapaArena()` — Mapa "arena"
Crea un recinto cerrado central (60% del tamaño del mapa) con puertas en los 4 lados, más algunos muros aleatorios interiores.

### Métodos de colocación de entidades

##### `colocarEntidades(config)`
Llama a `_colocarEntidadesTipo()` para cada tipo de entidad según los números del config.

##### `_colocarEntidadesTipo(tipo, num, vida, danioMin, danioMax, vision, rango)`
Crea `num` entidades del `tipo` indicado en posiciones aleatorias libres del tablero.

### Métodos de objetos

##### `generarObjetos(config)`
Coloca todos los objetos iniciales del tablero.

##### `_crearObjeto(tipo, f, c, config)`
Factory: crea el objeto correcto según el tipo string.

##### `_crearObjetoAleatorio(config)`
Crea un objeto aleatorio con estas probabilidades:
- 30% → Escudo
- 20% → Arma
- 20% → Velocidad
- 15% → Poción
- 15% → Estrella

##### `spawnObjetoRandom(config)`
Intenta (hasta 100 veces) encontrar una celda libre y colocar un objeto aleatorio.

### Métodos de trampas

##### `generarTrampas(num, danio)`
Coloca `num` trampas en celdas interiores libres (no bordes, no con entidades, no con objetos).

---

## 12. `engine.js` — Motor del Sandbox

**Propósito:** Controla el bucle de juego del modo Sandbox. Se llama a `tick()` repetidamente según `velocidadMs`.

```js
new GameEngine(config)
```

#### Propiedades

| Propiedad | Descripción |
|-----------|-------------|
| `config` | Referencia al objeto `config.js` |
| `board` | Instancia de `GameBoard` |
| `turno` | Número de turnos transcurridos |
| `enemigosEliminados` | Total de enemigos muertos |
| `objetosRecogidos` | Total de objetos recogidos |
| `numAliados` / `numEnemigos` | Conteo actual |
| `numAliadosInicial` / `numEnemigosInicial` | Para las estadísticas |
| `tiempoInicio` | `Date.now()` al iniciar |
| `resultado` | `null`, `"aliados"`, `"enemigos"` o `"empate"` |
| `todasEntidades` | Snapshot inicial de entidades para estadísticas |

### Métodos

##### `inicializar()`
Configura todo para una nueva partida:
1. `resetContadorId()` — reinicia IDs.
2. `Rng.setSeed(config.semilla)` — inicializa el RNG.
3. Crea el `GameBoard` y lo configura (bordes, mapa, entidades, objetos, trampas).
4. Guarda snapshot de entidades para estadísticas post-partida.

##### `tick()`
**El corazón del juego.** Se llama una vez por turno:

```
1. Incrementa turno
2. Copia lista de entidades activas
3. Cada entidad llama a actuar(board)
4. Daño por trampas a todas las entidades sobre ellas
5. Aliados recogen objetos en su celda
6. Elimina entidades muertas del tablero y lista activa
7. Spawn de objeto aleatorio si toca (turnosSpawnObjeto)
8. Actualiza contadores de aliados/enemigos
9. Comprueba condición de victoria/derrota
```

##### `haTerminado()`
Devuelve `true` si `resultado !== null` (la partida ha terminado).

---

## 13. `oleadasEngine.js` — Motor del Modo Oleadas

**Propósito:** Versión del motor para el modo Oleadas con jugador controlable, spawners, tienda y sistema de oleadas.

```js
new OleadasEngine()
```

#### Propiedades

| Propiedad | Descripción |
|-----------|-------------|
| `config` | Referencia a `oleadasConfig` |
| `board` | `GameBoard` |
| `jugador` | Instancia de `Jugador` |
| `torres` | Array de torres activas |
| `oleadaActual` | Número de oleada actual |
| `enemigosVivos` | Enemigos vivos en esta oleada |
| `turno` | Turno total |
| `dinero` | Dinero del jugador |
| `gameOver` | `true` si el jugador murió |
| `oleadaEnCurso` | `true` mientras hay enemigos vivos |
| `spawners` | Array de `{f, c}` — las 4 esquinas donde aparecen enemigos |
| `totalKills` | Total de enemigos eliminados en toda la partida |
| `compras` | Objeto `{tipo: veces}` — contador de compras para el escalado de precios |

### Métodos

##### `inicializar(idClaseSeleccionada)`
1. Crea el tablero sin bordes.
2. Genera abismos decorativos con `_generarVacios()`.
3. Define los 4 spawners en las esquinas.
4. Coloca el jugador en el centro.
5. Reinicia todos los contadores. Dinero inicial: `20`.

##### `_generarVacios()`
Crea 3-5 parches rectangulares de celdas "vacías" (abismos) en posiciones aleatorias. Respeta la zona central (donde está el jugador) y las esquinas (spawners).

##### `iniciarOleada()`
Incrementa `oleadaActual`, activa `oleadaEnCurso` y llama a `_spawnOleada()`.

##### `_spawnOleada(num)`
Calcula cuántos enemigos spawnear y de qué tipos:
- `numEnemigos = enemigosBase + enemigosIncremento * (num - 1)`
- La vida escala con `Math.pow(escalaVidaOleada, num - 1)`
- Si `num % oleadaBoss === 0` → el primer enemigo es un Boss (stats ×multiplicadores)
- Probabilidades de tipos especiales:
  - 20% tanque (si `num >= oleadaTanques`)
  - 25% rápido (si `num >= oleadaRapidos`)
  - 20% mago (si `num >= oleadaMagos`)

##### `_buscarCeldaLibreCerca(f, c, radio)`
Búsqueda en espiral alrededor de `(f, c)` para encontrar la primera celda libre. Si no encuentra nada en el radio, busca aleatoriamente.

##### `tick()`
Bucle de juego más complejo que el sandbox:

```
1. Jugador actúa (decrementa cooldowns)
2. Torres actúan (disparan a enemigos)
3. Enemigos actúan (persiguen al jugador)
4. Aliados invocados actúan
5. Daño por trampas
6. Jugador recoge objetos en su celda
7. Aliados invocados recogen objetos
8. Eliminar muertos: enemigos dan recompensa + drop aleatorio
9. Contar enemigosVivos
10. Si oleadaEnCurso y enemigosVivos = 0 → oleada terminada
11. Si jugador murió → gameOver = true
```

##### `_dropObjeto(f, c)`
Probabilidades de drop al morir un enemigo:
- 35% → Poción
- 25% → Escudo
- 20% → Arma
- 20% → Velocidad

##### `getPrecio(tipo)`
Calcula el precio actual de un ítem de tienda. Las mejoras del jugador suben de precio con cada compra:
```js
precio = precioBase * (escalaPrecio ^ vecesComprado)
```

##### `comprar(tipo)`
Procesa una compra directa (pociones, mejoras...). Descuenta dinero, actualiza `compras[tipo]` y aplica el efecto al jugador. Devuelve `true` si tuvo éxito.

##### `colocarMuro(f, c)`
Valida que haya dinero suficiente y la celda esté libre, luego coloca un `Muro` destructible.

##### `colocarTorre(f, c)`
Igual que `colocarMuro` pero crea una `Torre` y la añade al array `torres`.

##### `mejorarTorre(f, c)`
Llama a `torre.mejorar()` si hay una torre en `(f, c)` y dinero suficiente.

---

## 14. `renderer.js` — Sistema de Renderizado

**Propósito:** Dibuja todo en el Canvas. Gestiona sprites, animaciones, HUD y estadísticas. Está completamente desacoplado de la lógica del juego.

### Sprites y animaciones (módulo)

```js
const SPRITES_PATH = '0x72_DungeonTilesetII_v1.7/frames/';
```

#### `SPRITE_MAP`
Mapa de sprites estáticos:
```js
{ muro, trampa, escudo, arma, velocidad, pocion, suelo, torre, espada, arcoWeapon, flecha, staffRojo, staffVerde, skull }
```

#### `ANIM_MAP`
Mapa de sprites animados con estados `idle` y `run`. Cada estado tiene 4 frames (f0-f3):
```js
{ jugador, jugadorArquero, aliado, aliadoStar, guerrero, arquero, esqueleto, enemigo, tanque, rapido, enemigoMago, necromancer, estrella }
```

#### `cargarSprites()`
Carga todos los sprites al inicio. Devuelve `{ statics, animated, ready }` donde `ready` es una `Promise` que resuelve cuando todos los sprites están listos.

#### `spritesListos` (exportado)
`Promise` que resuelve cuando todos los sprites están cargados. El juego espera a esto antes de iniciar.

---

```js
new Renderer(canvas, hudDiv, statsDiv)
```

#### Propiedades

| Propiedad | Descripción |
|-----------|-------------|
| `canvas` | Elemento `<canvas>` |
| `ctx` | Contexto 2D del canvas |
| `hudDiv` | Div del HUD (info en tiempo real) |
| `statsDiv` | Div de estadísticas post-partida |
| `swingAnim` | Animación actual de swing de espada |
| `flechasAnim` | Array de animaciones de flechas |
| `flechasColosalAnim` | Array de animaciones de flecha colosal |
| `magiaAnim` | Array de animaciones de bola de magia |
| `mouseAngulo` | Ángulo del mouse respecto al jugador (en radianes) |
| `moveDuracion` | `200` ms — duración de la interpolación de movimiento |

### Método de interpolación

##### `_getPosInterpolada(entidad, cellW, cellH)`
Devuelve `{x, y}` en píxeles de la posición **visual interpolada** de la entidad. Usa `moveTimestamp` y la duración para calcular el progreso con una función **ease-out cuadrática**: `p = 1 - (1-progreso)²`.

### Helpers de animación

##### `_estaMoviendose(entidad)`
`true` si la entidad se movió hace menos de `moveDuracion` ms.

##### `_hitBlink(entidad)`
`true` si la entidad fue golpeada hace menos de 300ms Y el tiempo actual cae en un intervalo impar de 60ms (efecto de parpadeo).

##### `_drawAnimSprite(ctx, animKey, state, x, y, w, h)`
Dibuja el frame correcto de una animación. El frame se calcula con `performance.now()` dividido por la duración de frame (100ms si `run`, 150ms si `idle`).

### Métodos de dibujo principales

##### `drawBoard(board, turno)` — Modo Sandbox
Dibuja el tablero completo en dos pasadas:
1. **Primera pasada**: suelo, trampas, objetos, muros.
2. **Segunda pasada**: entidades móviles con interpolación.
3. Grid de líneas semitransparentes.
4. Animaciones de swing, flechas y magia.

##### `drawBoardOleadas(board, engine)` — Modo Oleadas
Similar a `drawBoard` pero con:
- Celdas vacías (abismos) dibujadas en negro.
- Marcado visual de los spawners (borde rojo semitransparente).
- Torres con barra de vida y número de nivel.
- Jugador con su arma equipada apuntando al mouse.
- Círculo de alcance del arco del jugador.
- Animaciones de flecha colosal.

### Métodos de dibujo de sprites

##### `_drawSpriteFill(ctx, key, x, y, w, h)`
Dibuja el sprite llenando completamente la celda (para muros).

##### `_drawSprite(ctx, key, x, y, w, h)`
Dibuja el sprite centrado y escalado con offset vertical de `-12%` (para que se vea mejor sobre el suelo). Si el sprite no cargó, dibuja `'?'`.

### Métodos de animación de ataques

##### `iniciarSwing(celdasAfectadas, angulo)`
Inicia la animación de swing de espada: un flash naranja sobre las celdas afectadas + sprite de espada rotando.

##### `iniciarFlecha(origen, trayectoria)`
Inicia la animación de una flecha moviéndose desde `origen` hasta el final de `trayectoria`.

##### `iniciarMagia(origen, trayectoria, celdasAfectadas)`
Inicia la animación de bola de magia: la bola viaja por la trayectoria y al impactar hace un flash de área púrpura.

##### `iniciarFlechaColosal(origen, trayectoriaCentro, trayectoria)`
Flecha grande que viaja a lo largo de la línea central + flash en todas las celdas afectadas.

### HUD y estadísticas

##### `updateHUD(engine)` — Sandbox
Actualiza el div del HUD con: turno, tiempo, velocidad, conteo de aliados/enemigos, leyenda de símbolos.

##### `mostrarEstadisticas(engine)` — Sandbox
Muestra el panel de estadísticas post-partida:
- Resultado (victoria/derrota/empate)
- Daño total de cada facción
- Supervivientes
- Kills
- MVP de cada lado

##### `updateHUDOleadas(engine)` — Oleadas
Muestra: oleada actual, enemigos vivos, turno, kills totales, vida/escudo del jugador, arma equipada + cooldown, habilidad especial + cooldown, dinero.

### Métodos de dibujo auxiliares

##### `_drawBarraVida(ctx, x, y, cellW, cellH, vida, vidaMax, color)`
Barra de vida encima de la entidad. Cambia de color si está baja (< 50% → amarillo, < 25% → rojo).

##### `_drawArmaEntidad(ctx, x, y, cellW, cellH, entidad, spriteKey)`
Dibuja el sprite del arma orbitando alrededor de la entidad IA, apuntando hacia su último objetivo.

##### `_drawArmaEquipada(ctx, x, y, cellW, cellH, jugador)`
Dibuja el arma del jugador apuntando hacia el ángulo del mouse (`renderer.mouseAngulo`).

---

## 15. `sandbox.js` — UI del Sandbox

**Propósito:** Gestiona toda la interacción del usuario en el modo Sandbox: panel de ajustes, toolbox, zoom, simulación y botones.

### Variables de módulo

| Variable | Descripción |
|----------|-------------|
| `engine` | Instancia de `GameEngine` (permanente, no se recrea) |
| `renderer` | Instancia de `Renderer` |
| `intervalId` | ID del `setInterval` del tick |
| `rafId` | ID del `requestAnimationFrame` del render |
| `pausado` | `true` si la simulación está pausada |
| `enSetup` | `true` antes de iniciar la simulación (en configuración) |
| `zoomScale` | Escala visual del canvas (1 = 100%) |
| `toolSeleccionada` | Herramienta activa del toolbox o `null` |

### Funciones de panel

##### `syncPanelToConfig()`
Lee `config` y actualiza todos los inputs del panel lateral con los valores actuales.

##### `onPanelChange(e)`
Handler de los inputs del panel. Lee el nuevo valor, lo aplica al `config` y:
- Si cambió `velocidadMs` → reinicia el interval.
- Si cambió `tipoMapa` a `'vacio'` → pone todo a cero y activa `modoLibre`.
- Si está en setup y es una clave de generación → regenera la partida.

### Funciones de zoom

##### `resizeCanvas()`
Recalcula el tamaño del canvas según `config.columnas × CELL_SIZE` (32px por celda).

##### `setZoom(newScale, pivotX, pivotY)`
Aplica el zoom manteniendo el punto pivote fijo en pantalla.

##### `resetZoom()` / `applyZoom()`
Resetea o aplica el zoom actual al canvas.

### Generación de partida

##### `generarPartida()`
Reinicia todo para una nueva partida:
1. Para el interval y RAF.
2. Redimensiona el canvas.
3. Llama a `engine.inicializar()`.
4. Dibuja el estado inicial.
5. Oculta botones de pausa/finalizar.

### Toolbox

##### `getCelda(e)`
Convierte coordenadas del mouse a `{f, c}` del tablero (teniendo en cuenta el zoom).

##### `colocarEnCelda(f, c)`
Coloca la entidad/objeto de la herramienta activa en la celda indicada. Llama al renderer para redibujar.

### Simulación

##### `iniciarSimulacion()`
Arranca la simulación:
1. Guarda snapshot de entidades para estadísticas.
2. Inicia `setInterval(tickLoop, config.velocidadMs)`.
3. Inicia el `requestAnimationFrame` para render continuo.

##### `tickLoop()`
Función que se llama cada tick:
1. `engine.tick()`
2. Procesa `pendingAnim` de cada entidad (envía al renderer).
3. Actualiza el HUD.
4. Si la partida terminó → `finalizarPartida()`.

##### `finalizarPartida()`
Para todos los timers y muestra las estadísticas. En modo libre, calcula el ganador por kills.

### Funciones exportadas

```js
export function iniciarSandbox(onVolver)  // Inicia el sandbox y registra todos los eventos
export function destruirSandbox()         // Para timers y oculta el layout
```

---

## 16. `oleadas.js` — UI del Modo Oleadas

**Propósito:** Gestiona la UI del modo Oleadas: selección de clase, input del jugador (WASD + mouse), tienda y overlays.

### Variables de módulo

| Variable | Descripción |
|----------|-------------|
| `engine` | Instancia de `OleadasEngine` |
| `renderer` | Instancia de `Renderer` |
| `gameLoop` | `setInterval` del tick de enemigos |
| `rafId` | `requestAnimationFrame` del render visual |
| `placementMode` | `'muro'` \| `'torre'` \| `'mejoraTorre'` \| `null` |
| `listeners` | Array de todos los event listeners para limpiarlos al salir |
| `keysDown` | `Set` de teclas WASD actualmente pulsadas |
| `lastMousePos` | `{x, y}` — posición actual del mouse en pantalla |
| `mouseHeld` | `true` si el botón del mouse está pulsado |
| `moveTimer` | `setTimeout` del loop de movimiento |
| `attackTimer` | `setInterval` del auto-ataque al mantener click |

### Constante
```js
const ATTACK_INTERVAL = 150; // ms entre ataques al mantener click
```

### Funciones exportadas

##### `iniciarOleadas(onVolver)`
Muestra el menú de selección de clase y registra el botón de volver.

##### `destruirOleadas()`
Limpia todo: para loops, elimina event listeners, oculta el layout.

### Ciclo de juego

##### `_startLoop()` / `_stopLoop()`
Inicia/para el `setInterval` del tick de enemigos. La lógica de IA solo corre si `oleadaEnCurso && !gameOver`.

Dentro del loop también:
- Procesa `pendingAnim` de las entidades activas.
- Actualiza el HUD.
- Detecta game over y fin de oleada.

##### `_startRaf()` / `_stopRaf()`
Inicia/para el `requestAnimationFrame` del render continuo.

##### `_render()`
Función de render: actualiza `renderer.mouseAngulo` y llama a `renderer.drawBoardOleadas()`.

### Input

##### `_procesarMovimiento()`
Lee `keysDown` y calcula `(df, dc)`. Mueve al jugador y recoge objetos.

##### `_loopMovimiento()` / `_startMoveTimer()` / `_stopMoveTimer()`
Sistema de movimiento continuo: al pulsar WASD se mueve inmediatamente y luego en bucle con el `velocidadMoverMs` de la clase.

##### `_procesarAtaqueClick(canvas)`
Calcula el ángulo del mouse respecto al jugador y ataca con el arma activa. Procesa kills (dinero). Inicia animaciones.

##### `_startAttackTimer(canvas)` / `_stopAttackTimer()`
Ataque al mantener el botón del mouse pulsado (cada `ATTACK_INTERVAL` ms).

##### `_procesarKills(kills)`
Para cada enemigo eliminado, suma `totalKills` y la recompensa de dinero correspondiente.

### Tienda

##### `_construirTienda()`
Crea el HTML de la tienda (secciones y botones) a partir de `TIENDA_ITEMS`. Los items con `placement: true` activan el modo de colocación en el mapa.

##### `_actualizarTienda()`
Actualiza precios y estado `disabled/enabled` de cada botón según el dinero actual.

### Overlays

##### `_mostrarOverlayOleada(num)`
Muestra brevemente "OLEADA X" sobre el canvas al iniciar una oleada.

##### `_mostrarGameOver()`
Muestra el overlay de Game Over con estadísticas finales y botón de volver al menú.

---

## 17. `app.js` — Punto de Entrada

**Propósito:** Gestiona el menú principal y la transición entre modos de juego.

```js
function mostrarMenu()     // Muestra el menú, oculta los layouts de juego
```

**Flujo:**
1. Al pulsar **SANDBOX** → `iniciarSandbox(mostrarMenu)`.
2. Al pulsar **OLEADAS** → importa dinámicamente `oleadas.js` (lazy loading) y llama `iniciarOleadas(mostrarMenu)`.
3. Cuando cualquier modo termina, llama a `mostrarMenu()` como callback para volver.

---

## 18. Mecánicas Clave

### Sistema de combate melee

```
Atacante mueve hacia Defensor
→ _moverSiPosible() detecta colisión

Si atacante es ENEMIGO y defensor es ALIADO:
  1. Si aliado está invencible → el enemigo muere instantáneamente
  2. Si no:
     a. Enemigo inflige su daño al aliado
     b. Aliado contraataca con su daño
     c. Los muertes se marcan pero NO se borran aquí
     d. El tick() borra los muertos después

Si atacante es ALIADO y defensor es ENEMIGO:
  1. Si aliado está invencible → el enemigo muere instantáneamente
  2. Si no:
     a. Aliado inflige su daño al enemigo
     b. Enemigo contraataca
     c. Lo mismo: tick() borra los muertos
```

### Sistema de escudo

```
recibirDanio(danio):
  Si invencible → ignorar
  Si escudo > 0:
    Si danio <= escudo → escudo -= danio (no pierde vida)
    Si danio > escudo → danio -= escudo; escudo = 0; vida -= danio
  Si no hay escudo → vida -= danio
```

### Anti-oscilación (historial)

Cada entidad mantiene un `Set` con las últimas 5 posiciones visitadas. Al moverse, primero intenta posiciones que no estén en el historial. Esto evita que los personajes oscilen entre 2 celdas.

### Interpolación visual de movimiento

El sistema de render funciona a 60fps aunque la lógica del juego vaya a solo 5-10fps. Cada entidad guarda su posición anterior (`filaAnterior`, `colAnterior`) y el timestamp del movimiento. El renderer interpola entre la posición anterior y la actual con **ease-out cuadrático** para que el movimiento se vea suave.

### Generación de mapa reproducible

Con `semilla !== -1`, todos los `Rng.nextInt()` y `Rng.nextDouble()` producen la misma secuencia. Esto garantiza que el mismo mapa se genere siempre con la misma semilla.

---

## 19. Flujo de Ejecución Completo

### Modo Sandbox

```
Usuario abre web/ → app.js carga
→ Clic en SANDBOX
→ sandbox.js: iniciarSandbox()
  → spritesListos.then(() => generarPartida())
    → engine.inicializar()  (crea board, entidades, objetos, trampas)
    → renderer.drawBoard()  (dibuja estado inicial)

→ Usuario clica INICIAR
→ sandbox.js: iniciarSimulacion()
  → setInterval(tickLoop, velocidadMs)
  → requestAnimationFrame(loop)
    └── Cada frame: renderer.drawBoard() con interpolación

  → Cada tick:
    → engine.tick()
      → entidades actúan (IA)
      → trampas dañan
      → aliados recogen objetos
      → muertos se eliminan
      → condición victoria/derrota
    → renderer.updateHUD()
    → Si terminado → finalizarPartida()
```

### Modo Oleadas

```
Usuario abre web/ → app.js carga
→ Clic en OLEADAS
→ oleadas.js (importado dinámicamente): iniciarOleadas()
  → Muestra menú de clases

→ Usuario selecciona clase
→ oleadas.js: _iniciarPartidaReal(idClase)
  → engine.inicializar(idClase)  (crea tablero, jugador, spawners)
  → spritesListos.then(() => {
      _startRaf()  (render visual continuo)
      renderer.updateHUDOleadas()
    })

→ Usuario clica INICIAR OLEADA
→ engine.iniciarOleada()  (spawea enemigos en esquinas)
→ setInterval(tick de IA, velocidadMs)

→ Cada frame RAF:
  → _render()  (actualiza ángulo mouse + dibuja tablero)

→ Cada tick de IA:
  → jugador.actuar() (decrementa cooldowns)
  → torres.actuar() (disparan)
  → enemigos.actuar() (persiguen jugador)
  → aliados invocados actúan
  → trampas, objetos, eliminar muertos
  → Si enemigos = 0 → fin de oleada (tienda disponible)
  → Si jugador muere → gameOver

→ Input del usuario:
  → WASD: _procesarMovimiento() a velocidadMoverMs
  → Click: _procesarAtaqueClick() cada ATTACK_INTERVAL
  → E: jugador.usarHabilidad()
  → Click en tienda: engine.comprar() o placementMode
  → Click en mapa (placementMode): engine.colocarMuro/Torre/mejorarTorre
```

---

## 20. Referencia Rápida de Propiedades de Entidades

| Tipo | Clase JS | `tipo` | `simbolo` | Especial |
|------|----------|--------|-----------|---------|
| Aliado básico | `Aliado` | `'ALIADO'` | `'A'` | Recoge objetos, esquiva trampas |
| Guerrero | `AliadoGuerrero` | `'GUERRERO'` | `'G'` | Espada AoE, cooldown 3 |
| Arquero | `AliadoArquero` | `'ARQUERO'` | `'B'` | Disparo a distancia, cooldown 2 |
| Esqueleto | `AliadoEsqueleto` | `'ESQUELETO'` | `'S'` | Invocado por Necromancer |
| Jugador | `Jugador` | `'ALIADO'` (hereda) | `'J'` | Control manual, habilidades |
| Enemigo normal | `Enemigo` | `'ENEMIGO'` | `'X'` | Persigue aliados |
| Enemigo Tanque | `EnemigoTanque` | `'ENEMIGO_TANQUE'` | `'T'` | Solo actúa turnos pares |
| Enemigo Rápido | `EnemigoRapido` | `'ENEMIGO_RAPIDO'` | `'R'` | Actúa 2 veces por turno |
| Enemigo Mago | `EnemigoMago` | `'ENEMIGO_MAGO'` | `'W'` | Ataque a distancia, se aleja |
| Muro | `Muro` | `'MURO'` | `'M'` | Estático, destructible si vida < 9999 |
| Torre | `Torre` | hereda `Entidad` | `'R'` | Dispara automáticamente |

### Símbolos de objetos en el tablero

| Símbolo | Objeto | Efecto |
|---------|--------|--------|
| `S` | `Escudo` | +escudo |
| `W` | `Arma` | +daño permanente |
| `*` | `Estrella` | invencibilidad temporal |
| `V` | `Velocidad` | doble movimiento temporal |
| `+` | `Pocion` | restaura vida |
| `^` | `Trampa` | daño al pisar (enemigos y jugador) |

---

## Tecnologías

- **JavaScript ES6** (módulos nativos, sin transpiladores ni frameworks)
- **HTML5 Canvas 2D** para todo el renderizado
- **CSS** con fuente MedievalSharp (cargada vía Google Fonts)
- **PRNG seedable** (mulberry32) para reproducibilidad
- **Sprites**: [0x72 Dungeon Tileset II v1.7](https://0x72.itch.io/dungeontileset-ii) by 0x72

## Licencia

Distribuido bajo la licencia **GPL-3.0**. Ver `LICENSE` para más información.

---

<div align="center">
Desarrollado por <a href="https://github.com/SergioRE2007">SergioRE2007</a>
</div>
