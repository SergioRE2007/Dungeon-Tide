// ==================== Touch Controls ====================
// Virtual joystick + action buttons for mobile devices

let _container = null;   // #oleadasGameArea
let _joystickEl = null;
let _knobEl = null;
let _buttonsEl = null;
let _pauseBtnEl = null;
let _tiendaBtnEl = null;

// Joystick state
let _joystickTouchId = null;
let _joystickCenterX = 0;
let _joystickCenterY = 0;
let _joyDx = 0;
let _joyDy = 0;
const JOYSTICK_RADIUS = 52;
const DEAD_ZONE = 0.15;

// Aim angle (follows joystick or last direction)
let _aimAngle = 0;
let _hasAim = false;

// Attack hold state
let _attackTouchId = null;

// Callbacks
let _callbacks = null;

// ==================== Public API ====================

export function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function initTouchControls(container, callbacks) {
    if (_container) destroyTouchControls();
    _container = container;
    _callbacks = callbacks;
    document.body.classList.add('touch-active');

    _createJoystick();
    _createActionButtons();
    _createPauseButton();
    _createTiendaToggle();
    _bindTouchEvents();
}

export function destroyTouchControls() {
    document.body.classList.remove('touch-active');
    if (_joystickEl) { _joystickEl.remove(); _joystickEl = null; }
    if (_buttonsEl) { _buttonsEl.remove(); _buttonsEl = null; }
    if (_pauseBtnEl) { _pauseBtnEl.remove(); _pauseBtnEl = null; }
    if (_tiendaBtnEl) { _tiendaBtnEl.remove(); _tiendaBtnEl = null; }
    _container = null;
    _callbacks = null;
    _joystickTouchId = null;
    _attackTouchId = null;
    _joyDx = 0;
    _joyDy = 0;
}

export function getJoystickDirection() {
    return { dx: _joyDx, dy: _joyDy };
}

export function getAimAngle() {
    return _aimAngle;
}

export function hasAim() {
    return _hasAim;
}

// ==================== DOM Creation ====================

function _createJoystick() {
    _joystickEl = document.createElement('div');
    _joystickEl.id = 'touchJoystick';
    _joystickEl.className = 'touch-controls';
    _joystickEl.innerHTML = '<div class="joystick-knob"></div>';
    _container.appendChild(_joystickEl);
    _knobEl = _joystickEl.querySelector('.joystick-knob');
}

function _createActionButtons() {
    _buttonsEl = document.createElement('div');
    _buttonsEl.id = 'touchButtons';
    _buttonsEl.className = 'touch-controls';
    _buttonsEl.innerHTML = `
        <button class="touch-action-btn touch-btn-attack" data-action="attack">&#9876;</button>
        <button class="touch-action-btn touch-btn-ability" data-action="ability">E</button>
        <button class="touch-action-btn touch-btn-chest" data-action="chest">F</button>
    `;
    _container.appendChild(_buttonsEl);
}

function _createPauseButton() {
    _pauseBtnEl = document.createElement('button');
    _pauseBtnEl.id = 'touchPause';
    _pauseBtnEl.className = 'touch-controls touch-pause-btn';
    _pauseBtnEl.textContent = '⏸';
    _container.appendChild(_pauseBtnEl);
}

function _createTiendaToggle() {
    _tiendaBtnEl = document.createElement('button');
    _tiendaBtnEl.id = 'touchTiendaToggle';
    _tiendaBtnEl.className = 'touch-controls touch-tienda-btn';
    _tiendaBtnEl.textContent = '🛒';
    _container.appendChild(_tiendaBtnEl);
}

// ==================== Touch Event Handling ====================

function _bindTouchEvents() {
    // Joystick touch
    _joystickEl.addEventListener('touchstart', _onJoystickStart, { passive: false });
    document.addEventListener('touchmove', _onJoystickMove, { passive: false });
    document.addEventListener('touchend', _onJoystickEnd, { passive: false });
    document.addEventListener('touchcancel', _onJoystickEnd, { passive: false });

    // Attack button — hold behavior
    const atkBtn = _buttonsEl.querySelector('[data-action="attack"]');
    atkBtn.addEventListener('touchstart', _onAttackStart, { passive: false });
    document.addEventListener('touchend', _onAttackEnd, { passive: false });
    document.addEventListener('touchcancel', _onAttackEnd, { passive: false });

    // Ability button — single tap
    const abilBtn = _buttonsEl.querySelector('[data-action="ability"]');
    abilBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (_callbacks && _callbacks.onAbility) _callbacks.onAbility();
    }, { passive: false });

    // Chest button — single tap
    const chestBtn = _buttonsEl.querySelector('[data-action="chest"]');
    chestBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (_callbacks && _callbacks.onChest) _callbacks.onChest();
    }, { passive: false });

    // Pause
    _pauseBtnEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (_callbacks && _callbacks.onPause) _callbacks.onPause();
    }, { passive: false });

    // Tienda toggle
    _tiendaBtnEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const tienda = document.getElementById('tienda');
        if (tienda) tienda.classList.toggle('tienda-mobile-open');
    }, { passive: false });

    // Canvas touch for placement mode
    const canvas = _container.querySelector('canvas');
    if (canvas) {
        canvas.addEventListener('touchstart', _onCanvasTouch, { passive: false });
    }
}

function _onJoystickStart(e) {
    e.preventDefault();
    if (_joystickTouchId !== null) return; // already tracking
    const touch = e.changedTouches[0];
    _joystickTouchId = touch.identifier;

    const rect = _joystickEl.getBoundingClientRect();
    _joystickCenterX = rect.left + rect.width / 2;
    _joystickCenterY = rect.top + rect.height / 2;

    _updateJoystick(touch.clientX, touch.clientY);
}

function _onJoystickMove(e) {
    if (_joystickTouchId === null) return;
    for (const touch of e.changedTouches) {
        if (touch.identifier === _joystickTouchId) {
            e.preventDefault();
            _updateJoystick(touch.clientX, touch.clientY);
            break;
        }
    }
}

function _onJoystickEnd(e) {
    if (_joystickTouchId === null) return;
    for (const touch of e.changedTouches) {
        if (touch.identifier === _joystickTouchId) {
            _joystickTouchId = null;
            _joyDx = 0;
            _joyDy = 0;
            _knobEl.style.transform = 'translate(-50%, -50%)';
            break;
        }
    }
}

function _updateJoystick(touchX, touchY) {
    let dx = touchX - _joystickCenterX;
    let dy = touchY - _joystickCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = JOYSTICK_RADIUS;

    // Clamp to radius
    if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
    }

    // Visual knob position
    _knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // Normalize to -1..1
    const normDx = dx / maxDist;
    const normDy = dy / maxDist;

    // Apply dead zone
    const normDist = Math.sqrt(normDx * normDx + normDy * normDy);
    if (normDist < DEAD_ZONE) {
        _joyDx = 0;
        _joyDy = 0;
    } else {
        _joyDx = normDx;
        _joyDy = normDy;
        // Update aim angle based on joystick direction
        _aimAngle = Math.atan2(normDy, normDx);
        _hasAim = true;
    }
}

function _onAttackStart(e) {
    e.preventDefault();
    if (_attackTouchId !== null) return;
    _attackTouchId = e.changedTouches[0].identifier;
    if (_callbacks && _callbacks.onAttackStart) _callbacks.onAttackStart();
}

function _onAttackEnd(e) {
    if (_attackTouchId === null) return;
    for (const touch of e.changedTouches) {
        if (touch.identifier === _attackTouchId) {
            _attackTouchId = null;
            if (_callbacks && _callbacks.onAttackEnd) _callbacks.onAttackEnd();
            break;
        }
    }
}

function _onCanvasTouch(e) {
    if (_callbacks && _callbacks.onCanvasTouch) {
        const touch = e.changedTouches[0];
        _callbacks.onCanvasTouch(touch.clientX, touch.clientY, e);
    }
}
