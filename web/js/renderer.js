import { Aliado, Enemigo, EnemigoTanque, EnemigoRapido, EnemigoMago, Muro, AliadoGuerrero, AliadoArquero, AliadoEsqueleto } from './entidad.js';
import { Escudo, Arma, Estrella, Velocidad, Pocion, Trampa, Cofre } from './objetos.js';
import { Jugador } from './jugador.js';
import { Torre } from './torre.js';

const COLORES_ESTRELLA = ['#ef4444', '#eab308', '#22c55e', '#06b6d4', '#a855f7', '#f5f5f5'];

const SPRITES_PATH = '0x72_DungeonTilesetII_v1.7/frames/';

// Sprites estaticos (sin animacion)
const SPRITE_MAP = {
    // Muros — variantes contextuales
    muro: 'wall_mid.png',
    wallLeft: 'wall_left.png',
    wallRight: 'wall_right.png',
    wallTopMid: 'wall_top_mid.png',
    wallTopLeft: 'wall_top_left.png',
    wallTopRight: 'wall_top_right.png',
    wallHole1: 'wall_hole_1.png',
    wallHole2: 'wall_hole_2.png',
    wallBannerBlue: 'wall_banner_blue.png',
    wallBannerGreen: 'wall_banner_green.png',
    wallBannerRed: 'wall_banner_red.png',
    wallBannerYellow: 'wall_banner_yellow.png',
    // Puertas
    doorFrameLeft: 'doors_frame_left.png',
    doorFrameRight: 'doors_frame_right.png',
    doorFrameTop: 'doors_frame_top.png',
    doorLeafClosed: 'doors_leaf_closed.png',
    doorLeafOpen: 'doors_leaf_open.png',
    // Decoraciones
    columnWall: 'column_wall.png',
    crate: 'crate.png',
    // Trampas — 4 frames de animacion
    trampa0: 'floor_spikes_anim_f0.png',
    trampa1: 'floor_spikes_anim_f1.png',
    trampa2: 'floor_spikes_anim_f2.png',
    trampa3: 'floor_spikes_anim_f3.png',
    // Cofres
    cofre: 'chest_full_open_anim_f0.png',
    cofreAbriendo1: 'chest_full_open_anim_f1.png',
    cofreAbriendo2: 'chest_full_open_anim_f2.png',
    cofreVacio: 'chest_empty_open_anim_f2.png',
    // Items
    trampa: 'floor_spikes_anim_f3.png',
    escudo: 'flask_blue.png',
    arma: 'weapon_red_gem_sword.png',
    velocidad: 'flask_yellow.png',
    pocion: 'flask_red.png',
    suelo0: 'floor_1.png',
    suelo1: 'floor_2.png',
    suelo2: 'floor_3.png',
    suelo3: 'floor_5.png',
    torre: 'column.png',
    espada: 'weapon_knight_sword.png',
    arcoWeapon: 'weapon_bow.png',
    flecha: 'weapon_arrow.png',
    staffRojo: 'weapon_red_magic_staff.png',
    staffVerde: 'weapon_green_magic_staff.png',
    skull: 'skull.png',
    floorStairs: 'floor_stairs.png',
};

// Sets de animacion: { idle: [...], run: [...] }
function _frames(base, states) {
    const result = {};
    for (const state of states) {
        result[state] = [0, 1, 2, 3].map(i => `${base}_${state}_anim_f${i}.png`);
    }
    return result;
}

const ANIM_MAP = {
    jugador:        _frames('knight_f', ['idle', 'run']),
    jugadorArquero: _frames('elf_m', ['idle', 'run']),
    aliado:         _frames('knight_m', ['idle', 'run']),
    aliadoStar:     _frames('angel', ['idle', 'run']),
    guerrero:       _frames('knight_f', ['idle', 'run']),
    arquero:        _frames('elf_m', ['idle', 'run']),
    esqueleto:      _frames('imp', ['idle', 'run']),
    enemigo:        _frames('goblin', ['idle', 'run']),
    tanque:         _frames('ogre', ['idle', 'run']),
    rapido:         _frames('chort', ['idle', 'run']),
    enemigoMago:    _frames('wizzard_m', ['idle', 'run']),
    necromancer:    _frames('wizzard_f', ['idle', 'run']),
    estrella: {
        idle: ['coin_anim_f0.png', 'coin_anim_f1.png', 'coin_anim_f2.png', 'coin_anim_f3.png'],
    },
};

function cargarSprites() {
    const statics = {};
    const animated = {};
    const promesas = [];

    for (const [key, file] of Object.entries(SPRITE_MAP)) {
        const img = new Image();
        img.src = SPRITES_PATH + file;
        statics[key] = img;
        promesas.push(new Promise(resolve => { img.onload = resolve; img.onerror = resolve; }));
    }

    for (const [key, states] of Object.entries(ANIM_MAP)) {
        animated[key] = {};
        for (const [state, files] of Object.entries(states)) {
            animated[key][state] = files.map(file => {
                const img = new Image();
                img.src = SPRITES_PATH + file;
                promesas.push(new Promise(resolve => { img.onload = resolve; img.onerror = resolve; }));
                return img;
            });
        }
    }

    return { statics, animated, ready: Promise.all(promesas) };
}

const { statics: sprites, animated: anims, ready: spritesReady } = cargarSprites();
let spritesLoaded = false;
export const spritesListos = spritesReady.then(() => { spritesLoaded = true; });

function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

export class Renderer {
    constructor(canvas, hudDiv, statsDiv) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.hudDiv = hudDiv;
        this.statsDiv = statsDiv;
        this.swingAnim = null;
        this.flechasAnim = [];
        this.flechasColosalAnim = [];
        this.magiaAnim = [];
        this.explosionesAnim = [];
        this.mouseAngulo = 0;
        this.moveDuracion = 200;
        this._floorMap = null;
        this._floorMapSize = null;

        // Floating texts (damage numbers, gold, etc.)
        this.floatingTexts = [];
        // Particle system
        this.particles = [];
        // Screen shake
        this._shakeIntensity = 0;
        this._shakeEnd = 0;
        // Screen flash (level up, perk, etc.)
        this._flashColor = null;
        this._flashEnd = 0;
        this._flashDuration = 0;
        // Chest opening animations
        this._cofresAbriendose = [];
    }

    // ==================== Screen Shake ====================

    shake(intensity = 5, durationMs = 200) {
        this._shakeIntensity = intensity;
        this._shakeEnd = performance.now() + durationMs;
    }

    // ==================== Screen Flash ====================

    flash(color = 'rgba(255,215,0,0.3)', durationMs = 400) {
        this._flashColor = color;
        this._flashEnd = performance.now() + durationMs;
        this._flashDuration = durationMs;
    }

    // ==================== Floating Texts ====================

    addFloatingText(gridX, gridY, text, color, scale = 1, opts = {}) {
        this.floatingTexts.push({
            x: gridX, y: gridY,
            text: String(text),
            color,
            scale,
            startTime: performance.now(),
            duration: opts.duration || 900,
            crit: opts.crit || false,
            glow: opts.glow || false,
        });
    }

    _renderFloatingTexts(ctx, cellW, cellH) {
        const now = performance.now();
        this.floatingTexts = this.floatingTexts.filter(ft => {
            const elapsed = now - ft.startTime;
            if (elapsed >= ft.duration) return false;

            const t = elapsed / ft.duration;
            const alpha = t < 0.2 ? t / 0.2 : 1 - ((t - 0.2) / 0.8);
            const rise = t * cellH * (ft.crit ? 2.5 : 1.5);

            const px = ft.x * cellW + cellW / 2;
            const py = ft.y * cellH - rise;
            // Crits: bigger, with bounce effect
            let sizeMultiplier = ft.scale;
            if (ft.crit) {
                const bounce = t < 0.15 ? 1 + Math.sin(t / 0.15 * Math.PI) * 0.5 : 1;
                sizeMultiplier *= 1.6 * bounce;
            }
            const fontSize = Math.max(10, Math.floor(cellH * 0.45 * sizeMultiplier));

            ctx.save();
            ctx.font = `bold ${fontSize}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = Math.max(0, alpha);

            // Glow effect for level-up, XP, etc.
            if (ft.glow || ft.crit) {
                ctx.shadowColor = ft.color;
                ctx.shadowBlur = ft.crit ? 12 : 8;
            }

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillText(ft.text, px + 1, py + 1);
            // Text
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, px, py);

            // Crit: double render for extra brightness
            if (ft.crit) {
                ctx.globalAlpha = Math.max(0, alpha * 0.5);
                ctx.fillText(ft.text, px, py);
            }

            ctx.restore();

            return true;
        });
    }

    // ==================== Particles ====================

    addParticleBurst(gridX, gridY, count, color, spread = 2) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.3 + Math.random() * spread;
            this.particles.push({
                x: gridX, y: gridY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.5,
                color,
                life: 0.4 + Math.random() * 0.6,
                startTime: performance.now(),
                size: 2 + Math.random() * 3,
            });
        }
    }

    _renderParticles(ctx, cellW, cellH) {
        const now = performance.now();
        this.particles = this.particles.filter(p => {
            const elapsed = (now - p.startTime) / 1000;
            if (elapsed >= p.life) return false;

            const t = elapsed / p.life;
            const px = (p.x + p.vx * elapsed) * cellW;
            const py = (p.y + p.vy * elapsed + 0.5 * elapsed * elapsed) * cellH;
            const alpha = 1 - t;
            const size = p.size * (1 - t * 0.5);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            return true;
        });
    }

    _renderCooldownBars(ctx, cellW, cellH, engine) {
        if (!engine || !engine.jugador || !engine.jugador.estaVivo()) return;
        const jug = engine.jugador;
        const now = performance.now();

        // jug.x/y are cell-center coordinates
        const centerX = jug.x * cellW;
        const centerY = jug.y * cellH;
        const barW = cellW * 1.4;
        const barH = 4;
        const startX = centerX - barW / 2;

        // Attack cooldown bar (below player sprite)
        const cdAtk = Math.max(0, jug.ataqueListoEn - now);
        const cdAtkTotal = jug.cooldownAtaqueMs;
        if (cdAtk > 0) {
            const yBar = centerY + cellH / 2 + 4;
            const ratio = 1 - cdAtk / cdAtkTotal;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(startX, yBar, barW, barH);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(startX, yBar, barW * ratio, barH);
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(startX, yBar, barW, barH);
        }

        // Ability cooldown bar (below attack bar)
        if (jug.habilidadConfig) {
            const cdHab = jug.habilidadCooldownRestante();
            const cdHabTotal = jug.habilidadConfig.cooldownMs * (1 - (jug.buffs.reduccionCooldownHab || 0));
            if (cdHab > 0) {
                const yBar = centerY + cellH / 2 + 10;
                const ratio = 1 - cdHab / cdHabTotal;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(startX, yBar, barW, barH);
                ctx.fillStyle = '#a855f7';
                ctx.fillRect(startX, yBar, barW * ratio, barH);
                ctx.strokeStyle = 'rgba(255,255,255,0.15)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(startX, yBar, barW, barH);
            } else {
                // Show "E ready" glow
                const yBar = centerY + cellH / 2 + 10;
                ctx.save();
                ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 300);
                ctx.fillStyle = '#a855f7';
                ctx.fillRect(startX, yBar, barW, barH);
                ctx.restore();
            }
        }

        // Stamina bar (blue, below other bars)
        if (jug.staminaMax > 0) {
            const staminaRatio = jug.stamina / jug.staminaMax;
            const yBar = centerY + cellH / 2 + 16;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(startX, yBar, barW, barH);
            // Color azul, se oscurece cuando está baja
            const blue = staminaRatio > 0.3 ? '#3b82f6' : '#1e40af';
            ctx.fillStyle = blue;
            ctx.fillRect(startX, yBar, barW * staminaRatio, barH);
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(startX, yBar, barW, barH);
        }
    }

    _renderCanvasHUD(ctx, engine) {
        if (!engine || !engine.jugador) return;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const jug = engine.jugador;
        const isBH = jug.idClase === 'bullethell';
        const scale = Math.max(1, Math.min(w / 800, 2));
        const pad = 8 * scale;

        ctx.save();
        ctx.textBaseline = 'top';
        ctx.font = `bold ${14 * scale}px Consolas, monospace`;
        const pillH = 18 * scale + pad;
        const textY = pad + 3 * scale;

        if (!isBH) {
            // ---- Top-center: Wave | Time | Kills | Gold (+ Countdown) ----
            const esMazmorra = engine.piso !== undefined;
            const oleadaTxt = esMazmorra ? `PISO ${engine.piso}` : `OLEADA ${engine.oleadaActual}`;
            const nivelTxt = `Nv.${jug.nivel || 1}`;
            const tiempoMs = Date.now() - engine.tiempoInicio;
            const seg = Math.floor(tiempoMs / 1000);
            const tiempoTxt = `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;
            const killsTxt = `Kills: ${engine.totalKills}`;
            const goldTxt = `${engine.dinero}$`;

            let countdownTxt = '';
            if (engine._waveForceEnd) {
                const restante = Math.max(0, engine._waveForceEnd - performance.now());
                if (restante > 0) {
                    countdownTxt = `\u23F1 ${Math.ceil(restante / 1000)}s`;
                }
            }

            const gap = 14 * scale;
            const parts = [oleadaTxt, nivelTxt, tiempoTxt, killsTxt, goldTxt];
            if (countdownTxt) parts.push(countdownTxt);
            const partsW = parts.map(t => ctx.measureText(t).width);
            const totalTextW = partsW.reduce((a, b) => a + b, 0);
            const pillW = totalTextW + gap * (parts.length - 1) + pad * 2;
            const pillX = esMazmorra ? pad : (w - pillW) / 2;

            // Pill background
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            _roundRect(ctx, pillX, pad, pillW, pillH, 6 * scale);
            ctx.fill();

            // Vertically center text in pill
            const fontSize = 14 * scale;
            const pillInnerTop = pad;
            const textYCentered = pillInnerTop + (pillH - fontSize) / 2;

            let textX = pillX + pad;
            const colors = ['#c9a84c', '#a78bfa', '#e2e8f0', '#22c55e', '#c9a84c'];
            if (countdownTxt) {
                const cdSeg = Math.ceil(Math.max(0, engine._waveForceEnd - performance.now()) / 1000);
                colors.push(cdSeg <= 5 ? '#ef4444' : '#facc15');
            }
            for (let i = 0; i < parts.length; i++) {
                ctx.fillStyle = colors[i];
                ctx.fillText(parts[i], textX, textYCentered);
                textX += partsW[i] + gap;
            }
        }

        // ---- Health bar: bottom-left in mazmorra, bottom-center in oleadas ----
        if (!isBH && jug.estaVivo()) {
            const esMazmorraBar = engine.piso !== undefined;
            const barW = Math.min(200 * scale, w * 0.3);
            const barH = 10 * scale;
            const xpBarH = 5 * scale;
            const totalH = barH + 6 + xpBarH + pad;
            const barX = esMazmorraBar ? pad : (w - barW) / 2;
            const barY = h - totalH;

            // Background
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            _roundRect(ctx, barX - 2, barY - 2, barW + 4, barH + 4, 4 * scale);
            ctx.fill();

            // Red background
            ctx.fillStyle = '#7f1d1d';
            ctx.fillRect(barX, barY, barW, barH);

            // Green fill
            const hpRatio = Math.max(0, jug.vida / jug.vidaMax);
            ctx.fillStyle = hpRatio > 0.3 ? '#22c55e' : '#ef4444';
            ctx.fillRect(barX, barY, barW * hpRatio, barH);

            // Shield overlay
            if (jug.escudo > 0) {
                ctx.fillStyle = 'rgba(6,182,212,0.4)';
                const shieldRatio = Math.min(1, jug.escudo / jug.vidaMax);
                ctx.fillRect(barX, barY, barW * shieldRatio, barH);
            }

            // HP text
            ctx.font = `bold ${9 * scale}px Consolas, monospace`;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(`${jug.vida}/${jug.vidaMax}`, barX + barW / 2, barY + 1);

            // XP bar (below health bar)
            const xpBarY = barY + barH + 6;
            const xpRatio = jug.xpParaSiguienteNivel > 0
                ? Math.min(1, (jug.xp || 0) / jug.xpParaSiguienteNivel)
                : 0;

            // Background
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            _roundRect(ctx, barX - 2, xpBarY - 1, barW + 4, xpBarH + 2, 3 * scale);
            ctx.fill();

            ctx.fillStyle = '#1e1b4b';
            ctx.fillRect(barX, xpBarY, barW, xpBarH);

            // XP fill (purple gradient)
            ctx.fillStyle = '#7c3aed';
            ctx.fillRect(barX, xpBarY, barW * xpRatio, xpBarH);

            // XP text
            ctx.font = `bold ${7 * scale}px Consolas, monospace`;
            ctx.fillStyle = '#e0e7ff';
            ctx.fillText(`Nv.${jug.nivel || 1}  ${jug.xp || 0}/${jug.xpParaSiguienteNivel}`, barX + barW / 2, xpBarY);
            ctx.textAlign = 'left';
        }

        ctx.restore();
    }

    _getFloorSprite(f, c, filas, columnas) {
        if (!this._floorMap || this._floorMapSize !== filas * columnas) {
            this._floorMap = new Uint8Array(filas * columnas);
            for (let i = 0; i < filas; i++) {
                for (let j = 0; j < columnas; j++) {
                    // floor_1 ~80%, floor_2 ~5%, floor_3 ~5%, floor_5 ~10%
                    const h = ((i * 7 + j * 13 + i * j * 3) & 0xFF) % 20;
                    this._floorMap[i * columnas + j] = h < 16 ? 0 : h < 17 ? 1 : h < 18 ? 2 : 3;
                }
            }
            this._floorMapSize = filas * columnas;
        }
        const idx = this._floorMap[f * columnas + c];
        return sprites['suelo' + idx];
    }

    // ==================== Wall sprite contextual ====================

    _getWallSpriteKey(board, f, c, filas, cols) {
        const isW = (ff, cc) => {
            if (ff < 0 || ff >= filas || cc < 0 || cc >= cols) return false;
            return board.getEntidad(ff, cc) instanceof Muro;
        };
        const below = isW(f + 1, c);
        const left  = isW(f, c - 1);
        const right = isW(f, c + 1);

        if (!below) {
            // Front face (visible from south)
            if (!left && right) return 'wallLeft';
            if (left && !right) return 'wallRight';
            return 'muro';
        }
        // Top surface
        if (!left && right) return 'wallTopLeft';
        if (left && !right) return 'wallTopRight';
        return 'wallTopMid';
    }

    _getWallDecoration(f, c) {
        const h = ((f * 31 + c * 17 + f * c * 7) >>> 0) % 100;
        if (h < 3) return 'wallBannerBlue';
        if (h < 5) return 'wallBannerGreen';
        if (h < 7) return 'wallBannerRed';
        if (h < 8) return 'wallBannerYellow';
        if (h < 11) return 'wallHole1';
        if (h < 13) return 'wallHole2';
        return null;
    }

    // ==================== Floor decorations ====================

    _getFloorDecoration(f, c, filas, cols, board) {
        if (board.getEntidad(f, c)) return null;
        if (board.getObjeto(f, c)) return null;
        if (board.getTrampa(f, c)) return null;
        // Only near wall corners (inner corners)
        const isW = (ff, cc) => {
            if (ff < 0 || ff >= filas || cc < 0 || cc >= cols) return false;
            return board.getEntidad(ff, cc) instanceof Muro;
        };
        // Check for L-shaped wall corners adjacent
        const wallAbove = isW(f - 1, c);
        const wallBelow = isW(f + 1, c);
        const wallLeft  = isW(f, c - 1);
        const wallRight = isW(f, c + 1);
        const adjWalls = (wallAbove ? 1 : 0) + (wallBelow ? 1 : 0) + (wallLeft ? 1 : 0) + (wallRight ? 1 : 0);
        if (adjWalls < 2) return null; // Need at least 2 adjacent walls (corner)
        const h = ((f * 41 + c * 23 + f * c * 11) >>> 0) % 100;
        if (h < 20) return 'columnWall';
        if (h < 30) return 'crate';
        return null;
    }

    // ==================== Animated traps ====================

    _drawTrampaAnimada(ctx, x, y, w, h) {
        const frameIdx = Math.floor(performance.now() / 200) % 4;
        this._drawSprite(ctx, 'trampa' + frameIdx, x, y, w, h);
    }

    // ==================== Chest opening animation ====================

    iniciarAperturaCofre(gridX, gridY) {
        this._cofresAbriendose.push({ x: gridX, y: gridY, startTime: performance.now() });
    }

    _drawCofresAbriendose(ctx, cellW, cellH) {
        const now = performance.now();
        for (let i = this._cofresAbriendose.length - 1; i >= 0; i--) {
            const c = this._cofresAbriendose[i];
            const elapsed = now - c.startTime;
            if (elapsed > 600) {
                this._cofresAbriendose.splice(i, 1);
                continue;
            }
            const px = c.x * cellW;
            const py = c.y * cellH;
            let key;
            if (elapsed < 150) key = 'cofre';
            else if (elapsed < 350) key = 'cofreAbriendo1';
            else key = 'cofreAbriendo2';
            this._drawSprite(ctx, key, px, py, cellW, cellH);
        }
    }

    _getPosInterpolada(entidad, cellW, cellH) {
        // Usar coordenadas continuas x/y directamente (actualizadas cada frame)
        return {
            x: (entidad.x - 0.5) * cellW,
            y: (entidad.y - 0.5) * cellH
        };
    }

    // ==================== Animacion helpers ====================

    _estaMoviendose(entidad) {
        if (entidad.enMovimiento) return true;
        // Fallback del timestamp para el jugador (que no usa enMovimiento)
        const duracion = entidad.velocidadMoverMs || this.moveDuracion;
        return entidad.moveTimestamp > 0 && (performance.now() - entidad.moveTimestamp) < duracion;
    }

    _hitBlink(entidad) {
        return entidad.hitTimestamp > 0
            && (performance.now() - entidad.hitTimestamp) < 300
            && Math.floor(performance.now() / 60) % 2 === 0;
    }

    _drawAnimSprite(ctx, animKey, state, x, y, w, h, extraScale = 1) {
        const set = anims[animKey];
        if (!set) return;
        const frames = set[state] || set.idle;
        if (!frames || frames.length === 0) return;

        const frameMs = state === 'run' ? 100 : 150;
        const frameIdx = Math.floor(performance.now() / frameMs) % frames.length;
        const img = frames[frameIdx];

        if (spritesLoaded && img && img.complete && img.naturalWidth) {
            const imgW = img.naturalWidth;
            const imgH = img.naturalHeight;
            const scale = Math.min(w / imgW, h / imgH) * extraScale;
            const dw = imgW * scale;
            const dh = imgH * scale;
            const dx = x + (w - dw) / 2;
            const dy = y + (h - dh) / 2 - h * 0.12;
            ctx.drawImage(img, dx, dy, dw, dh);
        }
    }

    // ==================== Sandbox ====================

    drawBoard(board, turno) {
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

                const floorSpr = this._getFloorSprite(f, c, filas, columnas);
                if (spritesLoaded && floorSpr && floorSpr.complete && floorSpr.naturalWidth) {
                    ctx.drawImage(floorSpr, x, y, cellW, cellH);
                } else {
                    ctx.fillStyle = '#1a1a2e';
                    ctx.fillRect(x, y, cellW, cellH);
                }

                const e = board.getEntidad(f, c);
                const obj = board.getObjeto(f, c);
                const trampa = board.getTrampa(f, c);

                if (trampa !== null) {
                    this._drawTrampaAnimada(ctx, x, y, cellW, cellH);
                }

                if (obj !== null && e === null) {
                    if (obj instanceof Escudo) {
                        this._drawSprite(ctx, 'escudo', x, y, cellW, cellH);
                    } else if (obj instanceof Arma) {
                        this._drawSprite(ctx, 'arma', x, y, cellW, cellH);
                    } else if (obj instanceof Estrella) {
                        this._drawAnimSprite(ctx, 'estrella', 'idle', x, y, cellW, cellH, 0.45);
                    } else if (obj instanceof Velocidad) {
                        this._drawSprite(ctx, 'velocidad', x, y, cellW, cellH);
                    } else if (obj instanceof Pocion) {
                        this._drawSprite(ctx, 'pocion', x, y, cellW, cellH);
                    }

                }

                if (e instanceof Muro) {
                    this._drawSpriteFill(ctx, 'muro', x, y, cellW, cellH);
                }
            }
        }

        // Segundo paso: entidades móviles con interpolación
        for (let f = 0; f < filas; f++) {
            for (let c = 0; c < columnas; c++) {
                const e = board.getEntidad(f, c);
                if (e === null || e instanceof Muro) continue;

                const pos = this._getPosInterpolada(e, cellW, cellH);
                const blink = this._hitBlink(e);
                const estado = this._estaMoviendose(e) ? 'run' : 'idle';
                if (!blink) {
                    if (e instanceof EnemigoTanque) {
                        this._drawAnimSprite(ctx, 'tanque', estado, pos.x, pos.y, cellW, cellH);
                    } else if (e instanceof EnemigoRapido) {
                        this._drawAnimSprite(ctx, 'rapido', estado, pos.x, pos.y, cellW, cellH);
                    } else if (e instanceof EnemigoMago) {
                        this._drawAnimSprite(ctx, 'enemigoMago', estado, pos.x, pos.y, cellW, cellH);
                        this._drawArmaEntidad(ctx, pos.x, pos.y, cellW, cellH, e, 'staffRojo');
                    } else if (e instanceof Enemigo) {
                        this._drawAnimSprite(ctx, 'enemigo', estado, pos.x, pos.y, cellW, cellH);
                    } else if (e instanceof AliadoGuerrero) {
                        const key = e.turnosInvencible > 0 ? 'aliadoStar' : 'guerrero';
                        this._drawAnimSprite(ctx, key, estado, pos.x, pos.y, cellW, cellH);
                        this._drawArmaEntidad(ctx, pos.x, pos.y, cellW, cellH, e, 'espada');
                    } else if (e instanceof AliadoArquero) {
                        const key = e.turnosInvencible > 0 ? 'aliadoStar' : 'arquero';
                        this._drawAnimSprite(ctx, key, estado, pos.x, pos.y, cellW, cellH);
                        this._drawArmaEntidad(ctx, pos.x, pos.y, cellW, cellH, e, 'arcoWeapon');
                    } else if (e instanceof Aliado) {
                        const key = e.turnosInvencible > 0 ? 'aliadoStar' : 'aliado';
                        this._drawAnimSprite(ctx, key, estado, pos.x, pos.y, cellW, cellH);
                    }
                }

                // Barras de vida para entidades del sandbox
                if (e instanceof Aliado || e instanceof Enemigo) {
                    const color = e instanceof Enemigo ? '#ef4444' : '#22c55e';
                    this._drawBarraVida(ctx, pos.x, pos.y, cellW, cellH, e.vida, e.vidaMax, color);
                }
            }
        }

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

        // Dibujar animaciones de ataques (swing de espada, flechas y magia)
        this._dibujarSwing(ctx, board);
        this._dibujarFlechas(ctx, board);
        this._dibujarMagia(ctx, board);
        this._dibujarProyectiles(ctx, board);
        this._dibujarExplosiones(ctx, board);
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

        // Screen shake
        const now = performance.now();
        if (now < this._shakeEnd && this._shakeIntensity > 0) {
            const dx = (Math.random() - 0.5) * this._shakeIntensity * 2;
            const dy = (Math.random() - 0.5) * this._shakeIntensity * 2;
            ctx.save();
            ctx.translate(dx, dy);
        }

        for (let f = 0; f < filas; f++) {
            for (let c = 0; c < columnas; c++) {
                const x = c * cellW;
                const y = f * cellH;

                if (board.esVacio(f, c)) {
                    ctx.fillStyle = '#0a0a12';
                    ctx.fillRect(x, y, cellW, cellH);
                    ctx.strokeStyle = 'rgba(30,20,40,0.6)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
                    continue;
                }

                const floorSpr = this._getFloorSprite(f, c, filas, columnas);
                if (spritesLoaded && floorSpr && floorSpr.complete && floorSpr.naturalWidth) {
                    ctx.drawImage(floorSpr, x, y, cellW, cellH);
                } else {
                    ctx.fillStyle = '#1a1a2e';
                    ctx.fillRect(x, y, cellW, cellH);
                }

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
                    this._drawTrampaAnimada(ctx, x, y, cellW, cellH);
                }

                // Floor decorations (columns, crates near wall corners)
                const floorDeco = this._getFloorDecoration(f, c, filas, columnas, board);
                if (floorDeco) {
                    this._drawSprite(ctx, floorDeco, x, y, cellW, cellH);
                }

                if (obj !== null && e === null) {
                    if (obj instanceof Cofre) {
                        this._drawSprite(ctx, 'cofre', x, y, cellW, cellH);
                    } else if (obj instanceof Escudo) this._drawSprite(ctx, 'escudo', x, y, cellW, cellH);
                    else if (obj instanceof Arma) this._drawSprite(ctx, 'arma', x, y, cellW, cellH);
                    else if (obj instanceof Estrella) this._drawAnimSprite(ctx, 'estrella', 'idle', x, y, cellW, cellH, 0.45);
                    else if (obj instanceof Velocidad) this._drawSprite(ctx, 'velocidad', x, y, cellW, cellH);
                    else if (obj instanceof Pocion) this._drawSprite(ctx, 'pocion', x, y, cellW, cellH);

                }
                // Cofre también visible cuando hay entidad encima
                if (obj instanceof Cofre && e !== null) {
                    this._drawSprite(ctx, 'cofre', x, y, cellW, cellH);
                }

                // Entidades estaticas (muros, torres)
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

        // Entidades moviles con interpolacion (segundo pase)
        for (let f = 0; f < filas; f++) {
            for (let c = 0; c < columnas; c++) {
                const e = board.getEntidad(f, c);
                if (e === null || e instanceof Muro || e instanceof Torre) continue;
                // Skip jugador en grid scan — se renderiza aparte con x,y continuo
                if (e instanceof Jugador) continue;

                const pos = this._getPosInterpolada(e, cellW, cellH);
                const ex = pos.x;
                const ey = pos.y;
                const blink = this._hitBlink(e);
                const estado = this._estaMoviendose(e) ? 'run' : 'idle';

                if (e instanceof EnemigoTanque) {
                    const bossScale = e.esBoss ? 1.6 : 1;
                    if (!blink) this._drawAnimSprite(ctx, 'tanque', estado, ex, ey, cellW, cellH, bossScale);
                    this._drawBarraVida(ctx, ex, ey, cellW, cellH, e.vida, e.vidaMax, e.esBoss ? '#ff6600' : '#ef4444');
                } else if (e instanceof EnemigoRapido) {
                    if (!blink) this._drawAnimSprite(ctx, 'rapido', estado, ex, ey, cellW, cellH);
                    this._drawBarraVida(ctx, ex, ey, cellW, cellH, e.vida, e.vidaMax, '#eab308');
                } else if (e instanceof EnemigoMago) {
                    if (!blink) this._drawAnimSprite(ctx, 'enemigoMago', estado, ex, ey, cellW, cellH);
                    this._drawBarraVida(ctx, ex, ey, cellW, cellH, e.vida, e.vidaMax, '#a855f7');
                    this._drawArmaEntidad(ctx, ex, ey, cellW, cellH, e, 'staffRojo');
                } else if (e instanceof Enemigo) {
                    if (!blink) this._drawAnimSprite(ctx, 'enemigo', estado, ex, ey, cellW, cellH);
                    this._drawBarraVida(ctx, ex, ey, cellW, cellH, e.vida, e.vidaMax, '#ef4444');
                } else if (e instanceof AliadoGuerrero) {
                    if (!blink) {
                        const key = e.turnosInvencible > 0 ? 'aliadoStar' : 'guerrero';
                        this._drawAnimSprite(ctx, key, estado, ex, ey, cellW, cellH);
                    }
                    this._drawBarraVida(ctx, ex, ey, cellW, cellH, e.vida, e.vidaMax, '#22c55e');
                    this._drawArmaEntidad(ctx, ex, ey, cellW, cellH, e, 'espada');
                } else if (e instanceof AliadoArquero) {
                    if (!blink) {
                        const key = e.turnosInvencible > 0 ? 'aliadoStar' : 'arquero';
                        this._drawAnimSprite(ctx, key, estado, ex, ey, cellW, cellH);
                    }
                    this._drawBarraVida(ctx, ex, ey, cellW, cellH, e.vida, e.vidaMax, '#22c55e');
                    this._drawArmaEntidad(ctx, ex, ey, cellW, cellH, e, 'arcoWeapon');
                } else if (e instanceof AliadoEsqueleto) {
                    if (!blink) {
                        const key = e.turnosInvencible > 0 ? 'aliadoStar' : 'esqueleto';
                        this._drawAnimSprite(ctx, key, estado, ex, ey, cellW, cellH);
                    }
                    this._drawBarraVida(ctx, ex, ey, cellW, cellH, e.vida, e.vidaMax, '#22c55e');
                } else if (e instanceof Aliado) {
                    if (!blink) {
                        const key = e.turnosInvencible > 0 ? 'aliadoStar' : 'aliado';
                        this._drawAnimSprite(ctx, key, estado, ex, ey, cellW, cellH);
                    }
                    this._drawBarraVida(ctx, ex, ey, cellW, cellH, e.vida, e.vidaMax, '#22c55e');
                }
            }
        }

        // Jugador off-grid: renderizar usando x,y continuo
        if (board.jugadorRef && board.jugadorRef.estaVivo()) {
            const j = board.jugadorRef;
            // x,y son centro de celda; convertir a pixel top-left
            const ex = (j.x - 0.5) * cellW;
            const ey = (j.y - 0.5) * cellH;
            const blink = this._hitBlink(j);
            const estado = this._estaMoviendose(j) ? 'run' : 'idle';

            if (!blink) {
                if (j.turnosInvencible > 0) {
                    this._drawAnimSprite(ctx, 'aliadoStar', estado, ex, ey, cellW, cellH);
                } else if (j.idClase === 'necromancer') {
                    this._drawAnimSprite(ctx, 'necromancer', estado, ex, ey, cellW, cellH);
                } else {
                    const animKey = j.idClase === 'arquero' ? 'jugadorArquero' : 'jugador';
                    this._drawAnimSprite(ctx, animKey, estado, ex, ey, cellW, cellH);
                }
            }
            if (j.idClase !== 'bullethell') {
                this._drawBarraVida(ctx, ex, ey, cellW, cellH, j.vida, j.vidaMax, '#22c55e');
            }
            this._drawArmaEquipada(ctx, ex, ey, cellW, cellH, j);
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

        // Circulo de alcance del arco
        if (engine && engine.jugador && engine.jugador.armaActual === 'arco') {
            const j = engine.jugador;
            const jx = j.x * cellW;
            const jy = j.y * cellH;
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

        // Prompt [F] sobre cofres cercanos al jugador
        if (engine && engine.jugador && engine.jugador.estaVivo()) {
            const jf = Math.floor(engine.jugador.y);
            const jc = Math.floor(engine.jugador.x);
            for (let df = -1; df <= 1; df++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const cf = jf + df;
                    const cc = jc + dc;
                    if (cf < 0 || cf >= filas || cc < 0 || cc >= columnas) continue;
                    const obj = board.getObjeto(cf, cc);
                    if (obj instanceof Cofre) {
                        const cx = cc * cellW + cellW / 2;
                        const cy = cf * cellH;
                        const bob = Math.sin(performance.now() / 300) * 2;
                        const fontSize = Math.max(10, Math.floor(cellW * 0.4));
                        ctx.save();
                        ctx.font = `bold ${fontSize}px monospace`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        // [F]
                        ctx.fillStyle = '#f0e6c8';
                        ctx.strokeStyle = '#000';
                        ctx.lineWidth = 2;
                        ctx.strokeText('[F]', cx, cy + bob - 2);
                        ctx.fillText('[F]', cx, cy + bob - 2);
                        // Costo
                        const costFontSize = Math.max(8, Math.floor(cellW * 0.3));
                        ctx.font = `bold ${costFontSize}px monospace`;
                        const puedePagar = engine.dinero >= obj.costoAbrir;
                        ctx.fillStyle = puedePagar ? '#c9a84c' : '#ef4444';
                        ctx.strokeText(`$${obj.costoAbrir}`, cx, cy + bob + costFontSize);
                        ctx.fillText(`$${obj.costoAbrir}`, cx, cy + bob + costFontSize);
                        ctx.restore();
                    }
                }
            }
        }

        this._drawCofresAbriendose(ctx, cellW, cellH);
        this._dibujarProyectiles(ctx, board);
        this._dibujarExplosiones(ctx, board);
        this._dibujarSwing(ctx, board);
        this._dibujarFlechas(ctx, board);
        this._dibujarFlechasColosales(ctx, board);
        this._dibujarMagia(ctx, board);

        // Cooldown bars under player
        this._renderCooldownBars(ctx, cellW, cellH, engine);

        // Floating texts & particles (on top of everything)
        this._renderParticles(ctx, cellW, cellH);
        this._renderFloatingTexts(ctx, cellW, cellH);

        // End screen shake
        if (now < this._shakeEnd) {
            ctx.restore();
        }

        // Screen flash overlay
        if (this._flashColor && now < this._flashEnd) {
            const t = 1 - (this._flashEnd - now) / this._flashDuration;
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - t);
            ctx.fillStyle = this._flashColor;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.restore();
        }

        // Canvas-based HUD overlay
        this._renderCanvasHUD(ctx, engine);
    }

    iniciarSwing(celdasAfectadas, angulo) {
        this.swingAnim = {
            celdas: celdasAfectadas,
            angulo,
            inicio: performance.now(),
            duracion: 200,
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

    iniciarFlecha(origen, trayectoria) {
        if (!trayectoria || trayectoria.length === 0) return;
        const ruta = [origen, ...trayectoria];
        this.flechasAnim.push({
            ruta,
            inicio: performance.now(),
            duracion: 60 * ruta.length,
        });
        if (this.flechasAnim.length === 1) {
            this._animarFlecha();
        }
    }

    iniciarMagia(origen, trayectoria, celdasAfectadas) {
        if (!trayectoria || trayectoria.length === 0) return;
        const ruta = [origen, ...trayectoria];
        this.magiaAnim.push({
            ruta,
            celdasAfectadas: celdasAfectadas || [],
            inicio: performance.now(),
            duracion: 80 * ruta.length + 300, // más tiempo para mostrar el área
        });
        if (this.magiaAnim.length === 1) {
            this._animarMagia();
        }
    }

    _animarMagia() {
        if (!this.magiaAnim || this.magiaAnim.length === 0) return;
        const ahora = performance.now();
        this.magiaAnim = this.magiaAnim.filter(a => (ahora - a.inicio) < a.duracion);
        if (this.magiaAnim.length > 0) {
            requestAnimationFrame(() => this._animarMagia());
        }
    }

    _animarFlecha() {
        if (!this.flechasAnim || this.flechasAnim.length === 0) return;
        const ahora = performance.now();
        this.flechasAnim = this.flechasAnim.filter(a => (ahora - a.inicio) < a.duracion);
        if (this.flechasAnim.length > 0) {
            requestAnimationFrame(() => this._animarFlecha());
        }
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

        const alpha = 0.5 * (1 - progreso);
        ctx.fillStyle = `rgba(255, 180, 40, ${alpha})`;
        for (const celda of celdas) {
            const x = celda.c * cellW;
            const y = celda.f * cellH;
            ctx.fillRect(x, y, cellW, cellH);
        }

        const img = sprites.espada;
        if (spritesLoaded && img && img.complete && img.naturalWidth) {
            let cx = 0, cy = 0;
            for (const celda of celdas) {
                cx += celda.c * cellW + cellW / 2;
                cy += celda.f * cellH + cellH / 2;
            }
            cx /= celdas.length;
            cy /= celdas.length;

            const swingRange = Math.PI / 6;
            const rotacion = angulo + swingRange * (2 * progreso - 1);

            const imgW = img.naturalWidth;
            const imgH = img.naturalHeight;
            const maxDim = Math.min(cellW, cellH) * 1.4;
            const scale = maxDim / Math.max(imgW, imgH);
            const dw = imgW * scale;
            const dh = imgH * scale;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rotacion + Math.PI / 4);
            ctx.globalAlpha = 1 - progreso * 0.5;
            ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
            ctx.restore();
        }
    }

    iniciarFlechaColosal(origen, trayectoriaCentro, trayectoria) {
        if (!trayectoriaCentro || trayectoriaCentro.length === 0) return;
        this.flechasColosalAnim.push({
            origen,
            trayectoriaCentro,
            trayectoria, // all affected cells (for AoE flash)
            inicio: performance.now(),
            duracion: 120 * trayectoriaCentro.length + 200, // travel + flash
        });
        if (this.flechasColosalAnim.length === 1) {
            this._animarFlechaColosal();
        }
    }

    _animarFlechaColosal() {
        if (!this.flechasColosalAnim || this.flechasColosalAnim.length === 0) return;
        const ahora = performance.now();
        this.flechasColosalAnim = this.flechasColosalAnim.filter(a => (ahora - a.inicio) < a.duracion);
        if (this.flechasColosalAnim.length > 0) {
            requestAnimationFrame(() => this._animarFlechaColosal());
        }
    }

    _dibujarFlechasColosales(ctx, board) {
        if (!this.flechasColosalAnim || this.flechasColosalAnim.length === 0) return;
        const ahora = performance.now();
        const cellW = this.canvas.width / board.columnas;
        const cellH = this.canvas.height / board.filas;
        const img = sprites.flecha;

        for (const anim of this.flechasColosalAnim) {
            const elapsed = ahora - anim.inicio;
            const travelDur = 120 * anim.trayectoriaCentro.length;
            const travelProg = Math.min(1, elapsed / travelDur);

            // Draw AoE flash on all affected cells
            const flashStart = travelDur * 0.5;
            if (elapsed > flashStart) {
                const flashProg = Math.min(1, (elapsed - flashStart) / (anim.duracion - flashStart));
                const alpha = 0.35 * (1 - flashProg);
                ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
                for (const celda of anim.trayectoria) {
                    ctx.fillRect(celda.c * cellW, celda.f * cellH, cellW, cellH);
                }
            }

            // Draw large arrow sprite traveling along center line
            if (spritesLoaded && img && img.complete && img.naturalWidth && travelProg < 1) {
                const t = anim.trayectoriaCentro;
                if (t.length < 2) continue;
                const start = anim.origen;
                const end = t[t.length - 1];

                const curF = start.f + (end.f - start.f) * travelProg;
                const curC = start.c + (end.c - start.c) * travelProg;

                const cx = curC * cellW + cellW / 2;
                const cy = curF * cellH + cellH / 2;
                const angulo = Math.atan2(end.f - start.f, end.c - start.c);

                const imgW = img.naturalWidth;
                const imgH = img.naturalHeight;
                const maxDim = Math.min(cellW, cellH) * 2.0;
                const scale = maxDim / Math.max(imgW, imgH);
                const dw = imgW * scale;
                const dh = imgH * scale;

                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(angulo + Math.PI / 2);
                ctx.globalAlpha = 0.9;
                ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
                ctx.restore();
            }
        }
    }

    _dibujarFlechas(ctx, board) {
        if (!this.flechasAnim || this.flechasAnim.length === 0) return;
        const ahora = performance.now();
        const cellW = this.canvas.width / board.columnas;
        const cellH = this.canvas.height / board.filas;
        const img = sprites.flecha;
        if (!spritesLoaded || !img || !img.complete || !img.naturalWidth) return;

        for (const anim of this.flechasAnim) {
            const progreso = Math.min(1, (ahora - anim.inicio) / anim.duracion);
            if (progreso >= 1) continue;

            const t = anim.ruta;
            if (t.length < 2) continue;

            const start = t[0];
            const end = t[t.length - 1];

            const curF = start.f + (end.f - start.f) * progreso;
            const curC = start.c + (end.c - start.c) * progreso;

            const cx = curC * cellW + cellW / 2;
            const cy = curF * cellH + cellH / 2;
            const angulo = Math.atan2(end.f - start.f, end.c - start.c);

            const imgW = img.naturalWidth;
            const imgH = img.naturalHeight;
            const maxDim = Math.min(cellW, cellH) * 0.8;
            const scale = maxDim / Math.max(imgW, imgH);
            const dw = imgW * scale;
            const dh = imgH * scale;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angulo + Math.PI / 2);
            ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
            ctx.restore();
        }
    }

    _dibujarMagia(ctx, board) {
        if (!this.magiaAnim || this.magiaAnim.length === 0) return;
        const ahora = performance.now();
        const cellW = this.canvas.width / board.columnas;
        const cellH = this.canvas.height / board.filas;

        for (const anim of this.magiaAnim) {
            const elapsed = ahora - anim.inicio;
            const progreso = Math.min(1, elapsed / anim.duracion);
            if (progreso >= 1) continue;

            const t = anim.ruta;
            if (t.length < 2) continue;

            // Duracion de viaje (sin el buffer de 300ms del flash)
            const travelDur = 80 * t.length;
            // Progreso del viaje: 0→1 solo mientras la bola viaja
            const travelProg = Math.min(1, elapsed / travelDur);

            const start = t[0];
            const end = t[t.length - 1];

            // Flash de impacto: empieza al 80% del viaje (solapandose con la bola)
            // Se muestra SIEMPRE en el punto final (haya o no enemigo)
            const impactoStart = travelDur * 0.8;
            if (elapsed >= impactoStart) {
                const impactoProg = Math.min(1, (elapsed - impactoStart) / (anim.duracion - impactoStart));
                const alphaImpacto = 0.7 * (1 - impactoProg);

                // Area alrededor del enemigo (si hubo impacto directo)
                if (anim.celdasAfectadas && anim.celdasAfectadas.length > 0) {
                    ctx.fillStyle = `rgba(200, 100, 255, ${alphaImpacto * 0.7})`;
                    for (const celda of anim.celdasAfectadas) {
                        ctx.fillRect(celda.c * cellW, celda.f * cellH, cellW, cellH);
                    }
                }

                // Siempre: celda final con flash brillante (el punto de impacto)
                ctx.fillStyle = `rgba(230, 160, 255, ${alphaImpacto})`;
                ctx.fillRect(end.c * cellW, end.f * cellH, cellW, cellH);
            }

            // La bola solo se dibuja mientras viaja (antes de llegar)
            if (travelProg >= 1) continue;

            const curF = start.f + (end.f - start.f) * travelProg;
            const curC = start.c + (end.c - start.c) * travelProg;

            const cx = curC * cellW + cellW / 2;
            const cy = curF * cellH + cellH / 2;

            // Bola de magia (circulo brillante con estela)
            const radio = Math.min(cellW, cellH) * 0.3;

            ctx.save();
            // Estela
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radio * 2);
            gradient.addColorStop(0, 'rgba(180, 60, 255, 0.6)');
            gradient.addColorStop(0.5, 'rgba(120, 40, 200, 0.3)');
            gradient.addColorStop(1, 'rgba(80, 20, 150, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(cx, cy, radio * 2, 0, Math.PI * 2);
            ctx.fill();

            // Nucleo
            ctx.fillStyle = '#d8b4fe';
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(cx, cy, radio * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    _dibujarProyectiles(ctx, board) {
        if (!board.proyectiles || board.proyectiles.length === 0) return;

        const cellW = this.canvas.width / board.columnas;
        const cellH = this.canvas.height / board.filas;
        const radio = Math.min(cellW, cellH) * 0.3;
        const halfW = cellW / 2;
        const halfH = cellH / 2;

        // Cache del sprite de bala (se regenera si cambia el tamaño)
        const spriteSize = Math.ceil(radio * 4) + 2;
        if (!this._proyectilSprite || this._proyectilSpriteSize !== spriteSize) {
            const off = document.createElement('canvas');
            off.width = spriteSize;
            off.height = spriteSize;
            const oc = off.getContext('2d');
            const center = spriteSize / 2;

            // Estela
            const gradient = oc.createRadialGradient(center, center, 0, center, center, radio * 2);
            gradient.addColorStop(0, 'rgba(180, 60, 255, 0.6)');
            gradient.addColorStop(0.5, 'rgba(120, 40, 200, 0.3)');
            gradient.addColorStop(1, 'rgba(80, 20, 150, 0)');
            oc.fillStyle = gradient;
            oc.beginPath();
            oc.arc(center, center, radio * 2, 0, Math.PI * 2);
            oc.fill();

            // Nucleo
            oc.shadowColor = '#a855f7';
            oc.shadowBlur = 8;
            oc.fillStyle = '#d8b4fe';
            oc.beginPath();
            oc.arc(center, center, radio * 0.5, 0, Math.PI * 2);
            oc.fill();

            this._proyectilSprite = off;
            this._proyectilSpriteSize = spriteSize;
        }

        const sprite = this._proyectilSprite;
        const halfSprite = spriteSize / 2;
        const now = performance.now();
        const canvasW = this.canvas.width;
        const canvasH = this.canvas.height;

        for (let i = 0; i < board.proyectiles.length; i++) {
            const p = board.proyectiles[i];

            // Interpolacion suave entre paso anterior y actual
            const tickInterval = p._prevTickTime ? (p._lastTickTime - p._prevTickTime) : 200;
            const lerpT = Math.min(1, (now - p._lastTickTime) / Math.max(tickInterval, 50));

            const tPrev = Math.max(0, p.paso - 1) / p.pasos;
            const tCur = p.paso / p.pasos;
            const dF = p.destinoF - p.origenF;
            const dC = p.destinoC - p.origenC;
            const drawF = p.origenF + dF * (tPrev + (tCur - tPrev) * lerpT);
            const drawC = p.origenC + dC * (tPrev + (tCur - tPrev) * lerpT);

            const cx = drawC * cellW + halfW;
            const cy = drawF * cellH + halfH;

            // Skip si fuera de pantalla
            if (cx < -spriteSize || cx > canvasW + spriteSize ||
                cy < -spriteSize || cy > canvasH + spriteSize) continue;

            ctx.drawImage(sprite, cx - halfSprite, cy - halfSprite);
        }
    }

    iniciarExplosion(f, c, radio = 0) {
        this.explosionesAnim.push({
            f, c, radio,
            inicio: performance.now(),
            duracion: radio > 0 ? 500 : 400
        });
    }

    _dibujarExplosiones(ctx, board) {
        if (!this.explosionesAnim || this.explosionesAnim.length === 0) return;

        const ahora = performance.now();
        const cellW = this.canvas.width / board.columnas;
        const cellH = this.canvas.height / board.filas;

        this.explosionesAnim = this.explosionesAnim.filter(exp => {
            const elapsed = ahora - exp.inicio;
            if (elapsed >= exp.duracion) return false;

            const progreso = elapsed / exp.duracion;
            const x = exp.c * cellW + cellW / 2;
            const y = exp.f * cellH + cellH / 2;
            const alpha = 1 - progreso;

            ctx.save();

            if (exp.radio > 0) {
                // Explosión en área: iluminar todas las celdas afectadas
                const r = exp.radio;
                for (let df = -r; df <= r; df++) {
                    for (let dc = -r; dc <= r; dc++) {
                        const af = exp.f + df;
                        const ac = exp.c + dc;
                        if (af < 0 || af >= board.filas || ac < 0 || ac >= board.columnas) continue;
                        ctx.fillStyle = `rgba(255, 120, 50, ${alpha * 0.35})`;
                        ctx.fillRect(ac * cellW, af * cellH, cellW, cellH);
                    }
                }
                // Onda expansiva grande
                const maxRadio = Math.min(cellW, cellH) * (1 + exp.radio);
                ctx.strokeStyle = `rgba(255, 140, 50, ${alpha * 0.8})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(x, y, maxRadio * progreso, 0, Math.PI * 2);
                ctx.stroke();
                // Núcleo
                ctx.fillStyle = `rgba(255, 200, 100, ${alpha * 0.6})`;
                ctx.beginPath();
                ctx.arc(x, y, maxRadio * 0.25, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Explosión simple (sin área)
                const maxRadio = Math.min(cellW, cellH) * 1.5;
                ctx.strokeStyle = `rgba(230, 160, 255, ${alpha * 0.8})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(x, y, maxRadio * progreso, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = `rgba(255, 200, 255, ${alpha * 0.6})`;
                ctx.beginPath();
                ctx.arc(x, y, maxRadio * 0.3, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
            return true;
        });
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

        ctx.fillStyle = 'rgba(255,255,100,0.6)';
        ctx.beginPath();
        ctx.arc(dx, dy, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawArmaEntidad(ctx, x, y, cellW, cellH, entidad, spriteKey) {
        const img = sprites[spriteKey];
        if (!spritesLoaded || !img || !img.complete || !img.naturalWidth) return;

        // Calcular angulo hacia el objetivo o usar ultima direccion
        let angulo = 0;
        if (entidad.ultimoObjetivo && entidad.ultimoObjetivo.estaVivo && entidad.ultimoObjetivo.estaVivo()) {
            angulo = Math.atan2(entidad.ultimoObjetivo.fila - entidad.fila, entidad.ultimoObjetivo.columna - entidad.columna);
        } else if (entidad.ultimoObjetivo) {
            angulo = Math.atan2(entidad.ultimoObjetivo.fila - entidad.fila, entidad.ultimoObjetivo.columna - entidad.columna);
        }

        const cx = x + cellW / 2;
        const cy = y + cellH / 2;
        const dist = cellW * 0.45;
        const ax = cx + Math.cos(angulo) * dist;
        const ay = cy + Math.sin(angulo) * dist;

        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;
        const maxDim = Math.min(cellW, cellH) * 0.6;
        const scale = maxDim / Math.max(imgW, imgH);
        const dw = imgW * scale;
        const dh = imgH * scale;

        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(angulo + Math.PI / 4);
        if (Math.abs(angulo) > Math.PI / 2) {
            ctx.scale(1, -1);
        }
        ctx.globalAlpha = 0.85;
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
    }

    _drawArmaEquipada(ctx, x, y, cellW, cellH, jugador) {
        let spriteKey = 'arcoWeapon';
        if (jugador.armaActual === 'espada') {
            spriteKey = 'espada';
        } else if (jugador.armaActual === 'baston') {
            spriteKey = 'staffRojo';
        }
        const img = sprites[spriteKey];
        if (!spritesLoaded || !img || !img.complete || !img.naturalWidth) return;

        const cx = x + cellW / 2;
        const cy = y + cellH / 2;
        const angulo = this.mouseAngulo;

        const dist = cellW * 0.45;
        const ax = cx + Math.cos(angulo) * dist;
        const ay = cy + Math.sin(angulo) * dist;

        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;
        const maxDim = Math.min(cellW, cellH) * 0.7;
        const scale = maxDim / Math.max(imgW, imgH);
        const dw = imgW * scale;
        const dh = imgH * scale;

        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(angulo + Math.PI / 4);
        if (Math.abs(angulo) > Math.PI / 2) {
            ctx.scale(1, -1);
        }
        ctx.globalAlpha = 0.85;
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
    }

    updateHUDOleadas(engine) {
        const armaIcon = engine.jugador.armaActual === 'espada' ? '\u2694' : '\uD83C\uDFF9';
        const cdRestante = Math.max(0, engine.jugador.ataqueListoEn - performance.now());
        const cdTexto = cdRestante > 0
            ? `<span style="color:#ef4444">(CD: ${(cdRestante / 1000).toFixed(1)}s)</span>`
            : `<span style="color:#22c55e">(Listo)</span>`;
        const escudoTexto = engine.jugador.escudo > 0
            ? `<span style="color:#06b6d4"> | Escudo: ${engine.jugador.escudo}</span>` : '';
        const invTexto = engine.jugador.turnosInvencible > 0
            ? `<span style="color:#facc15"> | \u2B50 ${engine.jugador.turnosInvencible}t</span>` : '';

        let habTexto = '';
        if (engine.jugador.habilidadConfig) {
            const nombre = engine.jugador.habilidadConfig.nombre;
            if (engine.jugador.habilidadLista()) {
                habTexto = `<span style="color:#a855f7"> | [E] ${nombre} <strong style="color:#22c55e">Listo</strong></span>`;
            } else {
                const restante = Math.ceil(engine.jugador.habilidadCooldownRestante() / 1000);
                habTexto = `<span style="color:#a855f7"> | [E] ${nombre} <strong style="color:#ef4444">${restante}s</strong></span>`;
            }
        }

        const tiempoMs = Date.now() - engine.tiempoInicio;
        const seg = Math.floor(tiempoMs / 1000);
        const min = Math.floor(seg / 60);
        const s = seg % 60;
        const tiempo = `${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        // HUD is now rendered on canvas via _renderCanvasHUD
        // Keep hudDiv update for backwards compat (sandbox mode etc.)
        if (this.hudDiv) {
            this.hudDiv.innerHTML = `
                <div class="hud-row">
                    <span>Enemigos: <strong style="color:#ef4444">${engine.enemigosVivos}</strong></span>
                    <span>Kills: <strong style="color:#22c55e">${engine.totalKills}</strong></span>
                </div>
                <div class="hud-row">
                    <span>Vida: <strong style="color:#22c55e">${engine.jugador.vida}/${engine.jugador.vidaMax}</strong>${escudoTexto}${invTexto}</span>
                    <span>Daño: <strong style="color:#f97316">${engine.jugador.danioBaseMin + engine.jugador.danioExtra}</strong></span>
                    <span>Arma: <strong>${armaIcon} ${engine.jugador.armaActual}</strong> ${cdTexto}${habTexto}</span>
                    <span>Dinero: <strong style="color:#c9a84c">${engine.dinero}$</strong></span>
                    <span>Nivel: <strong style="color:#a78bfa">${engine.jugador.nivel || 1}</strong> (${engine.jugador.xp || 0}/${engine.jugador.xpParaSiguienteNivel})</span>
                </div>
            `;
        }
    }
}
