import { Aliado, Enemigo, EnemigoTanque, EnemigoRapido, Muro } from './entidad.js';
import { Escudo, Arma, Estrella, Velocidad, Pocion, Trampa } from './objetos.js';
import { Jugador } from './jugador.js';
import { Torre } from './torre.js';

const COLORES_ESTRELLA = ['#ef4444', '#eab308', '#22c55e', '#06b6d4', '#a855f7', '#f5f5f5'];

const SPRITES_PATH = '0x72_DungeonTilesetII_v1.7/frames/';

const SPRITE_MAP = {
    aliado:     'knight_m_idle_anim_f1.png',
    aliadoStar: 'angel_idle_anim_f0.png',
    enemigo:    'goblin_idle_anim_f0.png',
    tanque:     'ogre_idle_anim_f0.png',
    rapido:     'chort_idle_anim_f0.png',
    muro:       'wall_mid.png',
    trampa:     'floor_spikes_anim_f3.png',
    escudo:     'flask_blue.png',
    arma:       'weapon_red_gem_sword.png',
    estrella:   'coin_anim_f0.png',
    velocidad:  'flask_yellow.png',
    pocion:     'flask_red.png',
    suelo:      'floor_1.png',
    jugador:    'knight_f_idle_anim_f0.png',
    torre:      'column.png',
    espada:     'weapon_knight_sword.png',
    arcoWeapon: 'weapon_bow.png',
};

function cargarSprites() {
    const sprites = {};
    const promesas = [];
    for (const [key, file] of Object.entries(SPRITE_MAP)) {
        const img = new Image();
        img.src = SPRITES_PATH + file;
        sprites[key] = img;
        promesas.push(new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve; // no bloquear si falta alguno
        }));
    }
    return { sprites, ready: Promise.all(promesas) };
}

const { sprites, ready: spritesReady } = cargarSprites();
let spritesLoaded = false;
export const spritesListos = spritesReady.then(() => { spritesLoaded = true; });

export class Renderer {
    constructor(canvas, hudDiv, statsDiv) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.hudDiv = hudDiv;
        this.statsDiv = statsDiv;
        this.swingAnim = null; // { celdas, angulo, inicio, duracion }
        this.mouseAngulo = 0; // ángulo del mouse respecto al jugador
        this.moveDuracion = 200; // ms de interpolación entre celdas
    }

    _getPosInterpolada(entidad, cellW, cellH) {
        const ahora = performance.now();
        let progreso = entidad.moveTimestamp > 0
            ? Math.min(1, (ahora - entidad.moveTimestamp) / this.moveDuracion)
            : 1;
        // Ease-out cuadrático
        const p = 1 - (1 - progreso) * (1 - progreso);
        const x = (entidad.colAnterior + (entidad.columna - entidad.colAnterior) * p) * cellW;
        const y = (entidad.filaAnterior + (entidad.fila - entidad.filaAnterior) * p) * cellH;
        return { x, y };
    }

    drawBoard(board, turno) {
        const filas = board.filas;
        const columnas = board.columnas;
        const cellW = this.canvas.width / columnas;
        const cellH = this.canvas.height / filas;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.imageSmoothingEnabled = false; // pixel art nítido

        for (let f = 0; f < filas; f++) {
            for (let c = 0; c < columnas; c++) {
                const x = c * cellW;
                const y = f * cellH;

                // Suelo siempre de fondo (estirar a celda completa)
                if (spritesLoaded && sprites.suelo.complete && sprites.suelo.naturalWidth) {
                    ctx.drawImage(sprites.suelo, x, y, cellW, cellH);
                } else {
                    ctx.fillStyle = '#1a1a2e';
                    ctx.fillRect(x, y, cellW, cellH);
                }

                const e = board.getEntidad(f, c);
                const obj = board.getObjeto(f, c);
                const trampa = board.getTrampa(f, c);

                // Trampa (debajo de entidades)
                if (trampa !== null) {
                    this._drawSprite(ctx, 'trampa', x, y, cellW, cellH);
                }

                // Objetos
                if (obj !== null && e === null) {
                    if (obj instanceof Escudo) {
                        this._drawSprite(ctx, 'escudo', x, y, cellW, cellH);
                    } else if (obj instanceof Arma) {
                        this._drawSprite(ctx, 'arma', x, y, cellW, cellH);
                    } else if (obj instanceof Estrella) {
                        this._drawSprite(ctx, 'estrella', x, y, cellW, cellH);
                    } else if (obj instanceof Velocidad) {
                        this._drawSprite(ctx, 'velocidad', x, y, cellW, cellH);
                    } else if (obj instanceof Pocion) {
                        this._drawSprite(ctx, 'pocion', x, y, cellW, cellH);
                    }
                }

                // Entidades
                if (e !== null) {
                    if (e instanceof Muro) {
                        this._drawSpriteFill(ctx, 'muro', x, y, cellW, cellH);
                    } else if (e instanceof EnemigoTanque) {
                        this._drawSprite(ctx, 'tanque', x, y, cellW, cellH);
                    } else if (e instanceof EnemigoRapido) {
                        this._drawSprite(ctx, 'rapido', x, y, cellW, cellH);
                    } else if (e instanceof Enemigo) {
                        this._drawSprite(ctx, 'enemigo', x, y, cellW, cellH);
                    } else if (e instanceof Aliado) {
                        if (e.turnosInvencible > 0) {
                            this._drawSprite(ctx, 'aliadoStar', x, y, cellW, cellH);
                        } else {
                            this._drawSprite(ctx, 'aliado', x, y, cellW, cellH);
                        }
                    }
                }
            }
        }

        // Grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        for (let f = 0; f <= filas; f++) {
            ctx.beginPath();
            ctx.moveTo(0, f * cellH);
            ctx.lineTo(this.canvas.width, f * cellH);
            ctx.stroke();
        }
        for (let c = 0; c <= columnas; c++) {
            ctx.beginPath();
            ctx.moveTo(c * cellW, 0);
            ctx.lineTo(c * cellW, this.canvas.height);
            ctx.stroke();
        }
    }

    _drawSpriteFill(ctx, key, x, y, w, h) {
        const img = sprites[key];
        if (spritesLoaded && img && img.complete && img.naturalWidth) {
            ctx.drawImage(img, x, y, w, h);
        }
    }

    _drawSprite(ctx, key, x, y, w, h) {
        const img = sprites[key];
        if (spritesLoaded && img && img.complete && img.naturalWidth) {
            // Mantener proporcion original, centrado en la celda
            const imgW = img.naturalWidth;
            const imgH = img.naturalHeight;
            const scale = Math.min(w / imgW, h / imgH);
            const dw = imgW * scale;
            const dh = imgH * scale;
            const dx = x + (w - dw) / 2;
            const dy = y + (h - dh) / 2 - h * 0.12;
            ctx.drawImage(img, dx, dy, dw, dh);
        } else {
            const fontSize = Math.floor(Math.min(w, h) * 0.65);
            ctx.font = `bold ${fontSize}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#e0e0e0';
            ctx.fillText('?', x + w / 2, y + h / 2);
        }
    }

    updateHUD(engine) {
        const tiempoMs = Date.now() - engine.tiempoInicio;
        const seg = Math.floor(tiempoMs / 1000);
        const min = Math.floor(seg / 60);
        const s = seg % 60;
        const tiempo = `${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        const colorAliados = engine.numAliados <= 2 ? '#ef4444' : '#22c55e';

        this.hudDiv.innerHTML = `
            <div class="hud-row">
                <span>Turno: <strong>${engine.turno}</strong></span>
                <span>Tiempo: <strong>${tiempo}</strong></span>
                <span>Velocidad: <strong>${engine.config.velocidadMs}ms</strong></span>
            </div>
            <div class="hud-row">
                <span>Aliados: <strong style="color:${colorAliados}">${engine.numAliados}/${engine.config.numAliado}</strong></span>
                <span>Enemigos: <strong style="color:#ef4444">${engine.numEnemigos}</strong></span>
                <span>Eliminados: <strong style="color:#22c55e">${engine.enemigosEliminados}</strong></span>
                <span>Objetos: <strong style="color:#06b6d4">${engine.objetosRecogidos}</strong></span>
            </div>
            <div class="hud-leyenda">
                <span style="color:#22c55e">o</span>=Aliado
                <span style="color:#ef4444">#</span>=Enemigo
                <span style="color:#dc2626">T</span>=Tanque
                <span style="color:#eab308">\u00A4</span>=R\u00E1pido
                <span style="color:#eab308">[=]</span>=Muro
                <span style="color:#9ca3af">^</span>=Trampa
                <span style="color:#06b6d4">S</span>=Escudo
                <span style="color:#a855f7">W</span>=Arma
                <span style="color:#facc15">*</span>=Estrella
                <span style="color:#3b82f6">V</span>=Vel
                <span style="color:#4ade80">+</span>=Poci\u00F3n
            </div>
        `;
    }

    mostrarEstadisticas(engine) {
        let danioAliadosInf = 0, danioAliadosRec = 0, killsAliados = 0, objRecogidos = 0;
        let aliadosVivos = 0;
        let danioEnemigosInf = 0, danioEnemigosRec = 0, killsEnemigos = 0;
        let enemigosVivos = 0;
        let mvpAliado = null, mvpEnemigo = null;

        for (const e of engine.todasEntidades) {
            if (e instanceof Aliado) {
                danioAliadosInf += e.danioInfligido;
                danioAliadosRec += e.danioRecibido;
                killsAliados += e.kills;
                objRecogidos += e.objetosRecogidosPersonal;
                if (e.estaVivo()) aliadosVivos++;
                if (mvpAliado === null || this._esMejorMvp(e, mvpAliado)) mvpAliado = e;
            } else if (e instanceof Enemigo) {
                danioEnemigosInf += e.danioInfligido;
                danioEnemigosRec += e.danioRecibido;
                killsEnemigos += e.kills;
                if (e.estaVivo()) enemigosVivos++;
                if (mvpEnemigo === null || this._esMejorMvp(e, mvpEnemigo)) mvpEnemigo = e;
            }
        }

        const tiempoMs = Date.now() - engine.tiempoInicio;
        const seg = Math.floor(tiempoMs / 1000);
        const tiempo = `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;

        let textoResultado, colorResultado;
        switch (engine.resultado) {
            case "aliados":
                textoResultado = "Los aliados han ganado";
                colorResultado = "#22c55e";
                break;
            case "enemigos":
                textoResultado = "Los enemigos han ganado";
                colorResultado = "#ef4444";
                break;
            default:
                textoResultado = "Empate";
                colorResultado = "#eab308";
                break;
        }

        let mvpAliadoHTML = '';
        if (mvpAliado !== null) {
            mvpAliadoHTML = `
                <div class="stats-section-title" style="color:#22c55e">MVP ALIADO</div>
                <div class="stats-line">Aliado #${mvpAliado.id} \u2014 ${mvpAliado.kills} kills, ${mvpAliado.danioInfligido} da\u00F1o</div>
            `;
        }
        let mvpEnemigoHTML = '';
        if (mvpEnemigo !== null) {
            mvpEnemigoHTML = `
                <div class="stats-section-title" style="color:#ef4444">MVP ENEMIGO</div>
                <div class="stats-line">Enemigo #${mvpEnemigo.id} \u2014 ${mvpEnemigo.kills} kills, ${mvpEnemigo.danioInfligido} da\u00F1o</div>
            `;
        }

        this.statsDiv.innerHTML = `
            <div class="stats-header">ESTADISTICAS DE PARTIDA</div>
            <div class="stats-separator"></div>
            <div class="stats-line">Resultado: <strong style="color:${colorResultado}">${textoResultado}</strong></div>
            <div class="stats-line">Turnos: ${engine.turno} | Tiempo: ${tiempo}</div>
            <div class="stats-separator"></div>
            <div class="stats-section-title" style="color:#22c55e">ALIADOS</div>
            <div class="stats-line">Da\u00F1o infligido total: ${danioAliadosInf}</div>
            <div class="stats-line">Da\u00F1o recibido total: ${danioAliadosRec}</div>
            <div class="stats-line">Supervivientes: ${aliadosVivos}/${engine.numAliadosInicial}</div>
            <div class="stats-line">Kills totales: ${killsAliados}</div>
            <div class="stats-line">Objetos recogidos: ${objRecogidos}</div>
            <div class="stats-separator"></div>
            <div class="stats-section-title" style="color:#ef4444">ENEMIGOS</div>
            <div class="stats-line">Da\u00F1o infligido total: ${danioEnemigosInf}</div>
            <div class="stats-line">Da\u00F1o recibido total: ${danioEnemigosRec}</div>
            <div class="stats-line">Supervivientes: ${enemigosVivos}/${engine.numEnemigosInicial}</div>
            <div class="stats-line">Kills totales: ${killsEnemigos}</div>
            <div class="stats-separator"></div>
            ${mvpAliadoHTML}
            ${mvpEnemigoHTML}
        `;
        this.statsDiv.style.display = 'block';
    }

    _esMejorMvp(candidato, actual) {
        if (candidato.kills !== actual.kills) return candidato.kills > actual.kills;
        return candidato.danioInfligido > actual.danioInfligido;
    }

    // ==================== Oleadas ====================

    drawBoardOleadas(board, engine) {
        const filas = board.filas;
        const columnas = board.columnas;
        const cellW = this.canvas.width / columnas;
        const cellH = this.canvas.height / filas;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.imageSmoothingEnabled = false;

        for (let f = 0; f < filas; f++) {
            for (let c = 0; c < columnas; c++) {
                const x = c * cellW;
                const y = f * cellH;

                // Celdas vacio = abismo
                if (board.esVacio(f, c)) {
                    ctx.fillStyle = '#0a0a12';
                    ctx.fillRect(x, y, cellW, cellH);
                    // Borde sutil de abismo
                    ctx.strokeStyle = 'rgba(30,20,40,0.6)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
                    continue;
                }

                // Suelo
                if (spritesLoaded && sprites.suelo.complete && sprites.suelo.naturalWidth) {
                    ctx.drawImage(sprites.suelo, x, y, cellW, cellH);
                } else {
                    ctx.fillStyle = '#1a1a2e';
                    ctx.fillRect(x, y, cellW, cellH);
                }

                // Spawner decorativo en esquinas
                if (this._esSpawner(f, c, engine)) {
                    ctx.fillStyle = 'rgba(200,50,50,0.15)';
                    ctx.fillRect(x, y, cellW, cellH);
                    ctx.strokeStyle = 'rgba(200,50,50,0.4)';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
                }

                const trampa = board.getTrampa(f, c);
                const obj = board.getObjeto(f, c);
                const e = board.getEntidad(f, c);

                if (trampa !== null) {
                    this._drawSprite(ctx, 'trampa', x, y, cellW, cellH);
                }

                if (obj !== null && e === null) {
                    if (obj instanceof Escudo) this._drawSprite(ctx, 'escudo', x, y, cellW, cellH);
                    else if (obj instanceof Arma) this._drawSprite(ctx, 'arma', x, y, cellW, cellH);
                    else if (obj instanceof Estrella) this._drawSprite(ctx, 'estrella', x, y, cellW, cellH);
                    else if (obj instanceof Velocidad) this._drawSprite(ctx, 'velocidad', x, y, cellW, cellH);
                    else if (obj instanceof Pocion) this._drawSprite(ctx, 'pocion', x, y, cellW, cellH);
                }

                // Entidades estáticas (muros, torres) se dibujan en la celda
                if (e !== null) {
                    if (e instanceof Torre) {
                        this._drawSprite(ctx, 'torre', x, y, cellW, cellH);
                        this._drawBarraVida(ctx, x, y, cellW, cellH, e.vida, e.vidaMax, '#3b82f6');
                        if (e.nivel > 1) {
                            ctx.font = `bold ${Math.floor(cellW * 0.3)}px monospace`;
                            ctx.textAlign = 'right';
                            ctx.textBaseline = 'top';
                            ctx.fillStyle = '#c9a84c';
                            ctx.fillText(e.nivel, x + cellW - 2, y + 2);
                        }
                    } else if (e instanceof Muro) {
                        this._drawSpriteFill(ctx, 'muro', x, y, cellW, cellH);
                        if (e.vidaMax < 9999) {
                            this._drawBarraVida(ctx, x, y, cellW, cellH, e.vida, e.vidaMax, '#eab308');
                        }
                    }
                }
            }
        }

        // Entidades móviles con interpolación (segundo pase)
        for (let f = 0; f < filas; f++) {
            for (let c = 0; c < columnas; c++) {
                const e = board.getEntidad(f, c);
                if (e === null || e instanceof Muro || e instanceof Torre) continue;

                const pos = this._getPosInterpolada(e, cellW, cellH);
                const ex = pos.x;
                const ey = pos.y;

                if (e instanceof Jugador) {
                    if (e.turnosInvencible > 0) {
                        this._drawSprite(ctx, 'aliadoStar', ex, ey, cellW, cellH);
                    } else {
                        this._drawSprite(ctx, 'jugador', ex, ey, cellW, cellH);
                    }
                    this._drawBarraVida(ctx, ex, ey, cellW, cellH, e.vida, e.vidaMax, '#22c55e');
                    this._drawArmaEquipada(ctx, ex, ey, cellW, cellH, e);
                } else if (e instanceof EnemigoTanque) {
                    this._drawSprite(ctx, 'tanque', ex, ey, cellW, cellH);
                    this._drawBarraVida(ctx, ex, ey, cellW, cellH, e.vida, e.vidaMax, '#ef4444');
                } else if (e instanceof EnemigoRapido) {
                    this._drawSprite(ctx, 'rapido', ex, ey, cellW, cellH);
                    this._drawBarraVida(ctx, ex, ey, cellW, cellH, e.vida, e.vidaMax, '#eab308');
                } else if (e instanceof Enemigo) {
                    this._drawSprite(ctx, 'enemigo', ex, ey, cellW, cellH);
                    this._drawBarraVida(ctx, ex, ey, cellW, cellH, e.vida, e.vidaMax, '#ef4444');
                } else if (e instanceof Aliado) {
                    if (e.turnosInvencible > 0) {
                        this._drawSprite(ctx, 'aliadoStar', ex, ey, cellW, cellH);
                    } else {
                        this._drawSprite(ctx, 'aliado', ex, ey, cellW, cellH);
                    }
                }
            }
        }

        // Grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        for (let f = 0; f <= filas; f++) {
            ctx.beginPath();
            ctx.moveTo(0, f * cellH);
            ctx.lineTo(this.canvas.width, f * cellH);
            ctx.stroke();
        }
        for (let c = 0; c <= columnas; c++) {
            ctx.beginPath();
            ctx.moveTo(c * cellW, 0);
            ctx.lineTo(c * cellW, this.canvas.height);
            ctx.stroke();
        }

        // Círculo de alcance del arco
        if (engine && engine.jugador && engine.jugador.armaActual === 'arco') {
            const j = engine.jugador;
            const jpos = this._getPosInterpolada(j, cellW, cellH);
            const jx = jpos.x + cellW / 2;
            const jy = jpos.y + cellH / 2;
            const radio = j.rangoArco * Math.max(cellW, cellH);

            ctx.save();
            ctx.strokeStyle = 'rgba(100, 180, 255, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(jx, jy, radio, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // Swing de espada encima de todo
        this._dibujarSwing(ctx, board);
    }

    iniciarSwing(celdasAfectadas, angulo) {
        this.swingAnim = {
            celdas: celdasAfectadas,
            angulo,
            inicio: performance.now(),
            duracion: 200, // ms
        };
        this._animarSwing();
    }

    _animarSwing() {
        if (!this.swingAnim) return;
        const ahora = performance.now();
        const progreso = (ahora - this.swingAnim.inicio) / this.swingAnim.duracion;
        if (progreso >= 1) {
            this.swingAnim = null;
            return;
        }
        requestAnimationFrame(() => this._animarSwing());
    }

    _dibujarSwing(ctx, board) {
        if (!this.swingAnim) return;
        const ahora = performance.now();
        const progreso = Math.min(1, (ahora - this.swingAnim.inicio) / this.swingAnim.duracion);
        if (progreso >= 1) {
            this.swingAnim = null;
            return;
        }

        const cellW = this.canvas.width / board.columnas;
        const cellH = this.canvas.height / board.filas;
        const { celdas, angulo } = this.swingAnim;

        // Flash naranja/amarillo en celdas afectadas (fade out)
        const alpha = 0.5 * (1 - progreso);
        ctx.fillStyle = `rgba(255, 180, 40, ${alpha})`;
        for (const celda of celdas) {
            const x = celda.c * cellW;
            const y = celda.f * cellH;
            ctx.fillRect(x, y, cellW, cellH);
        }

        // Sprite de espada rotando sobre las celdas afectadas
        const img = sprites.espada;
        if (spritesLoaded && img && img.complete && img.naturalWidth) {
            // Centro del arco = punto medio de las celdas afectadas
            let cx = 0, cy = 0;
            for (const celda of celdas) {
                cx += celda.c * cellW + cellW / 2;
                cy += celda.f * cellH + cellH / 2;
            }
            cx /= celdas.length;
            cy /= celdas.length;

            // Rotación: barrido de ±30° alrededor del ángulo central
            const swingRange = Math.PI / 6; // 30°
            const rotacion = angulo + swingRange * (2 * progreso - 1);

            // Mantener proporción original del sprite
            const imgW = img.naturalWidth;
            const imgH = img.naturalHeight;
            const maxDim = Math.min(cellW, cellH) * 1.4;
            const scale = maxDim / Math.max(imgW, imgH);
            const dw = imgW * scale;
            const dh = imgH * scale;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotacion + Math.PI / 4); // +45° para orientar sprite
            ctx.globalAlpha = 1 - progreso * 0.5;
            ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
            ctx.restore();
        }
    }

    _esSpawner(f, c, engine) {
        if (!engine || !engine.spawners) return false;
        for (const s of engine.spawners) {
            if (Math.abs(f - s.f) <= 1 && Math.abs(c - s.c) <= 1) return true;
        }
        return false;
    }

    _drawBarraVida(ctx, x, y, cellW, cellH, vida, vidaMax, color) {
        const barW = cellW * 0.8;
        const barH = 3;
        const barX = x + (cellW - barW) / 2;
        const barY = y - 1;
        const pct = Math.max(0, vida / vidaMax);

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = pct > 0.5 ? color : (pct > 0.25 ? '#eab308' : '#ef4444');
        ctx.fillRect(barX, barY, barW * pct, barH);
    }

    _drawDireccion(ctx, x, y, cellW, cellH, dir) {
        if (!dir) return;
        const cx = x + cellW / 2;
        const cy = y + cellH / 2;
        const len = cellW * 0.35;
        const dx = cx + dir[1] * len;
        const dy = cy + dir[0] * len;

        ctx.strokeStyle = 'rgba(255,255,100,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(dx, dy);
        ctx.stroke();

        // Punta de flecha
        ctx.fillStyle = 'rgba(255,255,100,0.6)';
        ctx.beginPath();
        ctx.arc(dx, dy, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawArmaEquipada(ctx, x, y, cellW, cellH, jugador) {
        const spriteKey = jugador.armaActual === 'espada' ? 'espada' : 'arcoWeapon';
        const img = sprites[spriteKey];
        if (!spritesLoaded || !img || !img.complete || !img.naturalWidth) return;

        const cx = x + cellW / 2;
        const cy = y + cellH / 2;
        const angulo = this.mouseAngulo;

        // Posicionar el arma al borde del jugador en dirección al mouse
        const dist = cellW * 0.45;
        const ax = cx + Math.cos(angulo) * dist;
        const ay = cy + Math.sin(angulo) * dist;

        // Tamaño proporcional del sprite
        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;
        const maxDim = Math.min(cellW, cellH) * 0.7;
        const scale = maxDim / Math.max(imgW, imgH);
        const dw = imgW * scale;
        const dh = imgH * scale;

        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(angulo + Math.PI / 4);
        // Flip horizontal si mirando a la izquierda para que se vea natural
        if (Math.abs(angulo) > Math.PI / 2) {
            ctx.scale(1, -1);
        }
        ctx.globalAlpha = 0.85;
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
    }

    updateHUDOleadas(engine) {
        const armaIcon = engine.jugador.armaActual === 'espada' ? '\u2694' : '\uD83C\uDFF9';
        const cdTexto = engine.jugador.cooldownAtaque > 0
            ? `<span style="color:#ef4444">(CD: ${engine.jugador.cooldownAtaque})</span>`
            : `<span style="color:#22c55e">(Listo)</span>`;
        const escudoTexto = engine.jugador.escudo > 0
            ? `<span style="color:#06b6d4"> | Escudo: ${engine.jugador.escudo}</span>` : '';
        const invTexto = engine.jugador.turnosInvencible > 0
            ? `<span style="color:#facc15"> | \u2B50 ${engine.jugador.turnosInvencible}t</span>` : '';

        this.hudDiv.innerHTML = `
            <div class="hud-row">
                <span>Oleada: <strong style="color:#c9a84c">${engine.oleadaActual}</strong></span>
                <span>Enemigos: <strong style="color:#ef4444">${engine.enemigosVivos}</strong></span>
                <span>Turno: <strong>${engine.turno}</strong></span>
                <span>Kills: <strong style="color:#22c55e">${engine.totalKills}</strong></span>
            </div>
            <div class="hud-row">
                <span>Vida: <strong style="color:#22c55e">${engine.jugador.vida}/${engine.jugador.vidaMax}</strong>${escudoTexto}${invTexto}</span>
                <span>Arma: <strong>${armaIcon} ${engine.jugador.armaActual}</strong> ${cdTexto}</span>
                <span>Dinero: <strong style="color:#c9a84c">${engine.dinero}$</strong></span>
            </div>
            <div class="hud-leyenda">
                WASD=mover | Click/Espacio=atacar | E/Q=cambiar arma
            </div>
        `;
    }
}
