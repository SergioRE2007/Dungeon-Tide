<div align="center">

# ⚔️ Dungeon Tide ⚔️

### Sobrevive a las oleadas. Domina la mazmorra.

Un juego de estrategia y supervivencia en mazmorras con pixel art, directamente en tu navegador.

**[🎮 Jugar ahora](https://sergiore2007.github.io/Dungeon-Tide/)** · **[🐛 Reportar bug](https://github.com/SergioRE2007/Dungeon-Tide/issues)**

---

</div>

## 🎮 ¿Qué es Dungeon Tide?

Dungeon Tide es un juego de **tower defense con acción directa**: controlas un héroe en una mazmorra, colocas defensas, compras mejoras y te enfrentas a oleadas de enemigos cada vez más peligrosos. También incluye un **modo Sandbox** donde puedes crear tus propias batallas y ver cómo se desarrollan con IA.

Todo funciona directamente en el navegador, sin instalar nada.

---

## 🕹️ Modos de juego

### ⚔️ Oleadas (Tower Defense)

El modo principal. Controlas a tu héroe en tiempo real, defiendes tu mazmorra contra hordas de enemigos que aparecen por las esquinas del mapa y usas la tienda para hacerte más fuerte entre oleada y oleada.

**Antes de empezar** eliges:
- **Clase de héroe** — Guerrero, Arquero o Nigromante
- **Dificultad** — Fácil, Normal o Difícil
- **Tamaño del mapa** — Pequeño, Mediano, Grande o Enorme
- **Velocidad de juego** — Lenta, Normal o Rápida
- **Oro inicial** — Cuánto oro empiezas
- **Drops** — Frecuencia con la que los enemigos sueltan objetos

### 🧪 Sandbox

Un simulador táctico libre. Configuras el mapa con aliados, enemigos, muros, trampas y objetos, y pulsas play para ver cómo la IA controla a todos los personajes. Perfecto para experimentar con combinaciones y estrategias.

Incluye más de **60 parámetros ajustables**, sistema de semillas para partidas reproducibles, zoom, control de velocidad y herramientas de colocación.

---

## 🎯 Controles (Modo Oleadas)

| Acción | Tecla |
|---|---|
| **Moverse** | `W` `A` `S` `D` |
| **Atacar** (dirección del ratón) | `Click izquierdo` (mantener) |
| **Atacar** (alrededor) | `Espacio` |
| **Habilidad especial** | `E` |
| **Abrir cofre** | `F` (cerca de un cofre, cuesta oro) |
| **Cancelar colocación** | `Esc` |
| **Comprar en la tienda** | Click en los items del panel derecho |

> **Consejo:** Mueve el ratón para apuntar tus ataques. La dirección del ratón determina hacia dónde golpeas o disparas.

---

## 🛡️ Clases de héroe

### Guerrero
| | |
|---|---|
| **Vida** | ❤️❤️❤️ Alta (300) |
| **Daño** | ⚔️⚔️ Medio-alto (40) |
| **Velocidad** | 🏃 Lenta |
| **Arma** | Espada — golpea a todos los enemigos adyacentes |
| **Habilidad (E)** | **Golpe Sísmico** — Daño masivo en área grande (radio 5 celdas). Enfriamiento: 10s |

El tanque del grupo. Aguanta muchos golpes y su habilidad especial limpia la zona cuando te rodean.

### Arquero
| | |
|---|---|
| **Vida** | ❤️ Baja (120) |
| **Daño** | ⚔️ Medio (20) |
| **Velocidad** | 🏃🏃🏃 Muy rápida |
| **Arma** | Arco — dispara en línea recta hacia el ratón |
| **Habilidad (E)** | **Flecha Colosal** — Proyectil enorme de largo alcance (12 celdas) con área amplia. Enfriamiento: 8s |

Rápido y letal a distancia. Mantén la distancia con los enemigos y ataca desde lejos.

### Nigromante
| | |
|---|---|
| **Vida** | ❤️ Muy baja (100) |
| **Daño** | ⚔️ Bajo (15) |
| **Velocidad** | 🏃🏃 Media |
| **Arma** | Bastón — dispara un proyectil que explota en área (3x3) |
| **Habilidad (E)** | **Invocar Aliados** — Invoca 3 esqueletos aliados que luchan por ti. Enfriamiento: 12s |

El más frágil pero el único que puede crear su propio ejército. Deja que tus esquelétos absorban el daño.

---

## 👾 Enemigos

Los enemigos aparecen por las **4 esquinas del mapa** y sus stats crecen con cada oleada.

| Enemigo | Vida | Daño | Rasgo especial |
|---|---|---|---|
| **Básico** | Normal | Normal | Persigue al aliado más cercano |
| **Tanque** | Muy alta | Alto | Lento (actúa cada 2 turnos), pero devastador |
| **Rápido** | Baja | Medio | Se mueve mucho más rápido que el resto |
| **Mago** | Baja | Medio | Ataca a distancia con proyectiles que explotan |
| **Jefe** | Extrema | Muy alto | Aparece cada 5 oleadas. Suelta cofre garantizado |

**Progresión:**
- Oleada 1-2: Solo enemigos básicos
- Oleada 3+: Aparecen tanques
- Oleada 4+: Aparecen magos
- Oleada 5+: Aparecen enemigos rápidos + primer jefe
- Cada 5 oleadas: Jefe con recompensa especial

> Los stats de los enemigos **escalan exponencialmente** — cada oleada son un 40% más fuertes que la anterior.

---

## 🛒 Tienda

Durante la partida tienes acceso a la tienda en el panel derecho. Los precios suben con cada compra.

### Mejoras del jugador
| Item | Efecto | Precio base |
|---|---|---|
| **Vida +30%** | Aumenta tu vida máxima | 20 oro |
| **Daño +40%** | Aumenta tu daño total | 15 oro |
| **Vel. Ataque** | Reduce el enfriamiento de ataques un 15% | 25 oro |

### Consumibles
| Item | Efecto | Precio |
|---|---|---|
| **Poción** | Te cura al máximo | 25% de tu vida máxima |
| **Escudo +50** | Absorbe 50 puntos de daño | 15 oro |

### Defensas (haz click para colocar en el mapa)
| Item | Efecto | Precio base |
|---|---|---|
| **Muro** | Bloquea el paso (100 vida) | 5 oro |

---

## 🎁 Cofres y recompensas

Los enemigos pueden **soltar objetos** al morir (escudos, armas, pociones, estrellas). Los jefes siempre sueltan un **cofre especial**.

### Sistema de cofres (gacha)

Acércate a un cofre y pulsa `F` para abrirlo (cuesta oro). Recibirás un buff aleatorio con una de estas rarezas:

| Rareza | Color | Potencia |
|---|---|---|
| Normal | ⬜ Gris | Buff básico |
| Raro | 🟦 Azul | Buff mejorado |
| Épico | 🟪 Púrpura | Buff poderoso |
| Legendario | 🟨 Dorado | Buff devastador |

**Buffs posibles:**
- **Robo de Vida** — Te curas al hacer daño
- **Ganancia de Oro** — Ganas más oro por cada kill
- **Velocidad** — Te mueves más rápido
- **Reducción de enfriamiento** — Tu habilidad especial se recarga antes

### Recompensa de jefe

Al derrotar un jefe, eliges **1 de 4 mejoras permanentes**:
- 2x Daño
- 2x Vida
- 1.4x Velocidad de ataque
- 2x Suerte (mejores drops en cofres)

---

## 🏰 Modo Sandbox

El sandbox es tu laboratorio. Puedes:

- **Colocar entidades** — Aliados, enemigos, muros, guerreros, arqueros, tanques, magos...
- **Añadir objetos y trampas** — Escudos, armas, pociones, estrellas, trampas de daño
- **Ajustar stats** — Vida, daño, visión, rango de cada tipo de entidad
- **Controlar la simulación** — Pausar, reanudar, cambiar velocidad
- **Zoom** — De 100% a 1000%
- **Semilla** — Usa la misma semilla para reproducir exactamente la misma partida
- **Modo libre** — La partida no termina automáticamente

Pulsa play y observa cómo la IA controla a todos los personajes en una batalla a muerte.

---

## 💡 Consejos

- **Coloca muros estratégicamente** para crear cuellos de botella y canalizar a los enemigos hacia tus torres.
- **No gastes todo tu oro en mejoras** — guarda para pociones de emergencia.
- **El Arquero es ideal para principiantes** — su velocidad te permite esquivar fácilmente.
- **El Nigromante es el más difícil** pero el más divertido — tus esqueletos son tu escudo viviente.
- **Prioriza los magos enemigos** — su ataque a distancia con explosión es muy peligroso.
- **Abre cofres tras derrotar jefes** — la mejora de suerte hace que los cofres posteriores sean mucho mejores.
- **A partir de la oleada 5** hay un límite de tiempo por oleada (20s). No puedes farmear indefinidamente.

---

## 🔧 Detalles técnicos

<details>
<summary>Click para ver info técnica</summary>

### Stack

- **JavaScript vanilla** (ES6 modules) — sin frameworks, sin build tools, sin npm
- **HTML5 Canvas** — renderizado con sprites pixel art
- **Sprites** — [0x72 Dungeon Tileset II v1.7](https://0x72.itch.io/dungeontileset-ii)

### Cómo ejecutar localmente

Abre `web/index.html` en tu navegador. No necesitas instalar nada.

### Estructura del proyecto

```
web/
├── index.html          ← Punto de entrada
├── js/
│   ├── app.js          ← Navegación entre menús
│   ├── oleadas.js      ← UI del modo Oleadas
│   ├── oleadasEngine.js ← Lógica del modo Oleadas
│   ├── oleadasConfig.js ← Configuración de oleadas
│   ├── sandbox.js      ← UI del modo Sandbox
│   ├── engine.js       ← Motor del Sandbox
│   ├── config.js       ← Configuración del Sandbox
│   ├── entidad.js      ← Todas las clases de entidades
│   ├── jugador.js      ← Lógica del jugador
│   ├── torre.js        ← Torres defensivas
│   ├── objetos.js      ← Objetos y trampas
│   ├── gameboard.js    ← Tablero y generación de mapas
│   ├── renderer.js     ← Renderizado Canvas y animaciones
│   └── rng.js          ← Generador aleatorio determinista
└── 0x72_DungeonTilesetII_v1.7/  ← Sprites
```

### Despliegue

Push a `main` → GitHub Pages se encarga del resto.

</details>

---

<div align="center">

Hecho con ⚔️ por [SergioRE2007](https://github.com/SergioRE2007)

</div>
