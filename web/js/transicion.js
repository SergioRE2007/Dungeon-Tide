// transicion.js — Overlay de transición con guerrero corriendo

const SPRITE_BASE = '0x72_DungeonTilesetII_v1.7/frames/';
const RUN_FRAMES = [
    'knight_m_run_anim_f0.png',
    'knight_m_run_anim_f1.png',
    'knight_m_run_anim_f2.png',
    'knight_m_run_anim_f3.png',
];

const SCALE = 6;          // x6 pixel art scale
const FRAME_MS = 100;     // ms por frame de animación
const FADE_MS = 300;       // duración del fade CSS
const CROSS_MS = 700;      // ms que tarda el guerrero en cruzar la pantalla

let overlay = null;
let canvas = null;
let ctx = null;
let imgs = [];
let loaded = false;
let transitioning = false;

function _ensureDOM() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'transicionOverlay';
    canvas = document.createElement('canvas');
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
}

function _preload() {
    if (loaded) return Promise.resolve();
    return new Promise(resolve => {
        let count = 0;
        for (const file of RUN_FRAMES) {
            const img = new Image();
            img.src = SPRITE_BASE + file;
            img.onload = () => { count++; if (count === RUN_FRAMES.length) { loaded = true; resolve(); } };
            img.onerror = () => { count++; if (count === RUN_FRAMES.length) { loaded = true; resolve(); } };
            imgs.push(img);
        }
    });
}

function _animateKnight() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Canvas a resolución nativa del display
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Sprite dimensions (original ~16x28 approx, scaled up)
    const sw = (imgs[0]?.naturalWidth || 16) * SCALE;
    const sh = (imgs[0]?.naturalHeight || 28) * SCALE;
    const y = Math.floor((h - sh) / 2);

    const startX = -sw;
    const endX = w + sw;
    const startTime = performance.now();
    let frameIdx = 0;
    let lastFrame = startTime;

    return new Promise(resolve => {
        function draw(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / CROSS_MS, 1);

            // Advance animation frame
            if (now - lastFrame >= FRAME_MS) {
                frameIdx = (frameIdx + 1) % imgs.length;
                lastFrame = now;
            }

            ctx.clearRect(0, 0, w, h);

            // Draw dust particles behind the knight
            const knightX = startX + (endX - startX) * progress;
            _drawDust(ctx, knightX, y + sh, sw, progress, now);

            // Draw knight
            if (imgs[frameIdx]?.complete) {
                ctx.drawImage(imgs[frameIdx], Math.floor(knightX), y, sw, sh);
            }

            if (progress < 1) {
                requestAnimationFrame(draw);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(draw);
    });
}

// Dust particles behind the knight
const _dustParticles = [];
function _drawDust(ctx, knightX, groundY, knightW, progress, now) {
    // Spawn new dust — more particles for a richer trail
    if (progress > 0.05 && progress < 0.95) {
        const spawnCount = Math.random() < 0.6 ? 2 : 1;
        for (let s = 0; s < spawnCount; s++) {
            _dustParticles.push({
                x: knightX + knightW * (0.05 + Math.random() * 0.15),
                y: groundY - 2 - Math.random() * 8,
                vx: -2 - Math.random() * 3,
                vy: -0.5 - Math.random() * 2,
                life: 1,
                size: 3 + Math.random() * 5,
            });
        }
    }

    // Update & draw
    for (let i = _dustParticles.length - 1; i >= 0; i--) {
        const p = _dustParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.life -= 0.02;
        if (p.life <= 0) { _dustParticles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life * 0.45;
        ctx.fillStyle = '#b8a070';
        const sz = Math.floor(p.size * (0.5 + p.life * 0.5));
        ctx.beginPath();
        ctx.arc(Math.floor(p.x), Math.floor(p.y), sz * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

/**
 * Ejecuta una transición: fade in overlay → guerrero corre → ejecuta callback → fade out
 * @param {Function} callback — se ejecuta a mitad de la transición (cuando la pantalla está tapada)
 * @returns {Promise}
 */
export async function transicionar(callback) {
    if (transitioning) {
        // Si ya hay una transición en curso, ejecutar callback directamente
        if (callback) callback();
        return;
    }
    transitioning = true;
    _ensureDOM();
    await _preload();

    _dustParticles.length = 0;

    // Fase 1: Fade in del overlay
    overlay.classList.remove('salir');
    overlay.classList.add('activo');

    await _wait(FADE_MS);

    // Fase 2: Ejecutar callback (cambiar pantallas) mientras overlay cubre todo
    if (callback) callback();

    // Fase 3: Guerrero corre
    await _animateKnight();

    // Fase 4: Fade out del overlay
    overlay.classList.add('salir');

    await _wait(FADE_MS);

    overlay.classList.remove('activo', 'salir');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    transitioning = false;
}

function _wait(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// Precarga sprites al importar el módulo
_ensureDOM();
_preload();
