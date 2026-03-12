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
