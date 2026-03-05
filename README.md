# Juego de Tablero

Simulador de tablero donde **enemigos** persiguen a **aliados** en una cuadricula con **muros** como obstaculos.
Los aliados pueden recoger **objetos** (escudos, armas, estrellas, pociones, velocidad) para sobrevivir.
Proyecto de POO para el ciclo DAM: herencia, paquetes, arrays bidimensionales e IA con campo de vision.

**Dos versiones**: consola Java y web interactiva con Canvas 2D.

## Version Web

Disponible en: **https://sergiore2007.github.io/Proyecto-Videojuego/**

### Funcionalidades

- **Tablero con Canvas 2D** — renderizado celda por celda con colores
- **Panel de ajustes** (derecha) — todos los parametros configurables en tiempo real
- **Panel de colocacion** (izquierda) — click o arrastrar para colocar entidades, objetos, trampas o borrar
- **Controles**: iniciar, pausar/reanudar, finalizar
- **Modo libre** — la partida no termina sola, resultado por kills al finalizar
- **Mapa vacio** — tablero limpio para sandbox manual
- **Velocidad ajustable en tiempo real**
- **Estadisticas post-partida** con MVP por faccion
- Al cambiar ajustes antes de iniciar, el tablero se regenera automaticamente

### Entidades y objetos

| Simbolo | Tipo | Color | Comportamiento |
|---------|------|-------|----------------|
| `o` | Aliado | Verde | Huye de enemigos, busca objetos |
| `#` | Enemigo | Rojo | Persigue al aliado mas cercano |
| `T` | Tanque | Rojo oscuro | Enemigo lento (actua cada 2 turnos), mucha vida y danio |
| `¤` | Rapido | Amarillo | Enemigo con doble movimiento |
| `[=]` | Muro | Amarillo | Obstaculo fijo |
| `^` | Trampa | Gris | Hace danio a quien pise (aliados las esquivan) |
| `S` | Escudo | Cyan | Absorbe danio |
| `W` | Arma | Morado | Aumenta contraataque |
| `*` | Estrella | Amarillo brillante | Invencibilidad temporal (efecto arcoiris) |
| `V` | Velocidad | Azul | Doble movimiento temporal |
| `+` | Pocion | Verde claro | Cura vida |

### Tipos de mapa

- **Arena** — recinto central con entradas y muros extra
- **Abierto** — muros lineales aleatorios con tendencia a agruparse
- **Salas** — habitaciones con puertas
- **Laberinto** — generado con DFS + 30% de muros eliminados
- **Vacio** — solo bordes, para colocacion manual

## Version Consola (Java)

### Compilar y ejecutar

```bash
javac -d bin src/utils/*.java src/objetos/*.java src/entidades/*.java src/GameEngine.java src/App.java
java -cp bin App
```

### Estructura del proyecto

```
src/
├── App.java                  Entry point (~25 lineas)
├── GameEngine.java           Game loop: tick(), deteccion fin, estado
├── entidades/
│   ├── Entidad.java          Clase abstracta: movimiento 8 dirs, combate, anti-oscilacion
│   ├── Enemigo.java          Persecucion con vision y danio configurable
│   ├── EnemigoTanque.java    Actua cada 2 turnos, mucha vida
│   ├── EnemigoRapido.java    Doble movimiento
│   ├── Aliado.java           Huida, busqueda de objetos, invencibilidad
│   ├── Muro.java             Obstaculo fijo
│   └── Trampa.java           Danio por posicion
├── objetos/
│   ├── Objeto.java           Clase abstracta de objetos recogibles
│   ├── Escudo.java           Absorbe danio
│   ├── Arma.java             Aumenta contraataque
│   ├── Estrella.java         Invencibilidad temporal
│   ├── Velocidad.java        Doble movimiento temporal
│   └── Pocion.java           Cura vida
└── utils/
    ├── GameConfig.java       Todos los parametros configurables
    ├── GameBoard.java        3 arrays 2D + generacion de mapas
    ├── Renderer.java         Renderizado ANSI (tablero + HUD + stats)
    ├── Posicion.java         Coordenada (fila, columna)
    └── Rng.java              Random global
web/
├── index.html
├── style.css
└── js/
    ├── config.js             Parametros configurables
    ├── rng.js                PRNG seedable (mulberry32)
    ├── gameboard.js          3 arrays 2D + generacion de mapas
    ├── entidad.js            Todas las entidades
    ├── objetos.js            Todos los objetos + trampa
    ├── engine.js             Game loop
    ├── renderer.js           Canvas 2D + HUD + stats
    └── app.js                Entry point + UI
```
