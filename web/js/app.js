import { iniciarSandbox, destruirSandbox } from './sandbox.js';

const menu = document.getElementById('menuPrincipal');
const menuBH = document.getElementById('menuBulletHell');
const btnSandbox = document.getElementById('btnSandbox');
const btnOleadas = document.getElementById('btnOleadas');
const btnBulletHell = document.getElementById('btnBulletHell');
const btnVolverBHMenu = document.getElementById('btnVolverBHMenu');

let oleadasModule = null;
let bulletHellModule = null;

function mostrarMenu() {
    document.body.classList.remove('in-game');
    menu.style.display = 'flex';
    menuBH.style.display = 'none';
    document.getElementById('layout').style.display = 'none';
    document.getElementById('layoutOleadas').style.display = 'none';
    document.getElementById('layoutBulletHell').style.display = 'none';
}

btnSandbox.addEventListener('click', () => {
    document.body.classList.add('in-game');
    menu.style.display = 'none';
    iniciarSandbox(mostrarMenu);
});

btnOleadas.addEventListener('click', async () => {
    document.body.classList.add('in-game');
    menu.style.display = 'none';
    if (!oleadasModule) {
        oleadasModule = await import('./oleadas.js');
    }
    oleadasModule.iniciarOleadas(mostrarMenu);
});

// Bullet Hell: mostrar menu de dificultad
btnBulletHell.addEventListener('click', () => {
    menu.style.display = 'none';
    menuBH.style.display = 'flex';
});

btnVolverBHMenu.addEventListener('click', () => {
    menuBH.style.display = 'none';
    menu.style.display = 'flex';
});

// Botones de dificultad
document.querySelectorAll('.bh-diff-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const dificultad = btn.dataset.diff;
        document.body.classList.add('in-game');
        menuBH.style.display = 'none';
        if (!bulletHellModule) {
            bulletHellModule = await import('./bulletHell.js');
        }
        bulletHellModule.iniciarBulletHell(mostrarMenu, dificultad);
    });
});

mostrarMenu();

// ==================== Pantalla completa ====================

const btnFS = document.getElementById('btnFullscreen');
const hintFS = document.getElementById('fullscreenHint');
const btnHintGo = document.getElementById('btnFullscreenHintGo');
const btnHintClose = document.getElementById('btnFullscreenHintClose');

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

btnFS.addEventListener('click', toggleFullscreen);
btnHintGo.addEventListener('click', () => {
    toggleFullscreen();
    hintFS.style.display = 'none';
});
btnHintClose.addEventListener('click', () => {
    hintFS.style.display = 'none';
    sessionStorage.setItem('fsHintDismissed', '1');
});

document.addEventListener('fullscreenchange', () => {
    btnFS.textContent = document.fullscreenElement ? '\u2716' : '\u26F6';
    if (document.fullscreenElement) {
        hintFS.style.display = 'none';
    }
});

// Mostrar recomendación al entrar en un modo de juego (si no está en fullscreen)
function mostrarHintFullscreen() {
    if (!document.fullscreenElement && !sessionStorage.getItem('fsHintDismissed')) {
        hintFS.style.display = 'flex';
    }
}

// Escuchar clics en los botones de modo para mostrar la recomendación
[btnSandbox, btnOleadas, btnBulletHell].forEach(btn => {
    btn.addEventListener('click', () => setTimeout(mostrarHintFullscreen, 300));
});
