// ==================== Touch Controls ====================
// Virtual joystick (move) + aim joystick (aim + auto-attack) for mobile

let _container = null;   // #oleadasGameArea
let _moveJoystickEl = null;
let _moveKnobEl = null;
let _aimJoystickEl = null;
let _aimKnobEl = null;
let _buttonsEl = null;
let _pauseBtnEl = null;
let _tiendaBtnEl = null;

// Move joystick state
let _moveTouchId = null;
let _moveCenterX = 0;
let _moveCenterY = 0;
let _moveDx = 0;
let _moveDy = 0;

// Aim joystick state
let _aimTouchId = null;
let _aimCenterX = 0;
let _aimCenterY = 0;
let _aimAngle = 0;
let _isAiming = false;  // true while finger is on aim joystick

const JOYSTICK_RADIUS = 52;
const DEAD_ZONE = 0.15;

// Callbacks
let _callbacks = null;

// Cleanup tracking
let _docListeners = [];

// ==================== Public API ====================

export function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function initTouchControls(container, callbacks) {
    if (_container) destroyTouchControls();
    _container = container;
    _callbacks = callbacks;
    document.body.classList.add('touch-active');

    _createMoveJoystick();
    _createAimJoystick();
    _createActionButtons();
    _createPauseButton();
    _createTiendaToggle();
    _bindTouchEvents();
}

export function destroyTouchControls() {
    document.body.classList.remove('touch-active');
    if (_moveJoystickEl) { _moveJoystickEl.remove(); _moveJoystickEl = null; }
    if (_aimJoystickEl) { _aimJoystickEl.remove(); _aimJoystickEl = null; }
    if (_buttonsEl) { _buttonsEl.remove(); _buttonsEl = null; }
    if (_pauseBtnEl) { _pauseBtnEl.remove(); _pauseBtnEl = null; }
    if (_tiendaBtnEl) { _tiendaBtnEl.remove(); _tiendaBtnEl = null; }
    // Remove document-level listeners
    for (const [type, fn] of _docListeners) {
        document.removeEventListener(type, fn);
    }
    _docListeners = [];
    _container = null;
    _callbacks = null;
    _moveTouchId = null;
    _aimTouchId = null;
    _moveDx = 0;
    _moveDy = 0;
    _isAiming = false;
}

export function getJoystickDirection() {
    return { dx: _moveDx, dy: _moveDy };
}

export function getAimAngle() {
    return _aimAngle;
}

export function isAiming() {
    return _isAiming;
}

// ==================== DOM Creation ====================

function _createMoveJoystick() {
    _moveJoystickEl = document.createElement('div');
    _moveJoystickEl.id = 'touchJoystick';
    _moveJoystickEl.className = 'touch-controls';
    _moveJoystickEl.innerHTML = '<div class="joystick-knob"></div>';
    _container.appendChild(_moveJoystickEl);
    _moveKnobEl = _moveJoystickEl.querySelector('.joystick-knob');
}

function _createAimJoystick() {
    _aimJoystickEl = document.createElement('div');
    _aimJoystickEl.id = 'touchAimJoystick';
    _aimJoystickEl.className = 'touch-controls';
    _aimJoystickEl.innerHTML = '<div class="joystick-knob aim-knob"></div>';
    _container.appendChild(_aimJoystickEl);
    _aimKnobEl = _aimJoystickEl.querySelector('.joystick-knob');
}

function _createActionButtons() {
    _buttonsEl = document.createElement('div');
    _buttonsEl.id = 'touchButtons';
    _buttonsEl.className = 'touch-controls';
    _buttonsEl.innerHTML = `
        <button class="touch-action-btn touch-btn-ability" data-action="ability">E</button>
        <button class="touch-action-btn touch-btn-chest" data-action="chest">F</button>
    `;
    _container.appendChild(_buttonsEl);
}

function _createPauseButton() {
    _pauseBtnEl = document.createElement('button');
    _pauseBtnEl.id = 'touchPause';
    _pauseBtnEl.className = 'touch-controls touch-pause-btn';
    _pauseBtnEl.textContent = '\u23F8';
    _container.appendChild(_pauseBtnEl);
}

function _createTiendaToggle() {
    _tiendaBtnEl = document.createElement('button');
    _tiendaBtnEl.id = 'touchTiendaToggle';
    _tiendaBtnEl.className = 'touch-controls touch-tienda-btn';
    _tiendaBtnEl.textContent = '\uD83D\uDED2';
    _container.appendChild(_tiendaBtnEl);
}

// ==================== Touch Event Handling ====================

function _addDocListener(type, fn, opts) {
    document.addEventListener(type, fn, opts);
    _docListeners.push([type, fn]);
}

function _bindTouchEvents() {
    // Move joystick
    _moveJoystickEl.addEventListener('touchstart', _onMoveStart, { passive: false });
    _addDocListener('touchmove', _onMoveMove, { passive: false });
    _addDocListener('touchend', _onMoveEnd, { passive: false });
    _addDocListener('touchcancel', _onMoveEnd, { passive: false });

    // Aim joystick
    _aimJoystickEl.addEventListener('touchstart', _onAimStart, { passive: false });
    // Move/end handled by same doc listeners — they check both touch IDs

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
        _toggleTienda();
    }, { passive: false });

    // Canvas touch for placement mode
    const canvas = _container.querySelector('canvas');
    if (canvas) {
        canvas.addEventListener('touchstart', _onCanvasTouch, { passive: false });
    }
}

function _toggleTienda() {
    const tienda = document.getElementById('tienda');
    if (!tienda) return;
    const isOpen = tienda.classList.contains('tienda-abierta');
    if (isOpen) {
        tienda.classList.remove('tienda-abierta');
    } else {
        tienda.classList.add('tienda-abierta');
        // Close on tap outside — add one-time listener
        setTimeout(() => {
            const closer = (ev) => {
                if (!tienda.contains(ev.target) && ev.target !== _tiendaBtnEl) {
                    tienda.classList.remove('tienda-abierta');
                    document.removeEventListener('touchstart', closer);
                }
            };
            document.addEventListener('touchstart', closer, { passive: true });
        }, 50);
    }
}

// ==================== Move Joystick ====================

function _onMoveStart(e) {
    e.preventDefault();
    if (_moveTouchId !== null) return;
    const touch = e.changedTouches[0];
    _moveTouchId = touch.identifier;
    const rect = _moveJoystickEl.getBoundingClientRect();
    _moveCenterX = rect.left + rect.width / 2;
    _moveCenterY = rect.top + rect.height / 2;
    _updateMoveJoystick(touch.clientX, touch.clientY);
}

function _onMoveMove(e) {
    for (const touch of e.changedTouches) {
        if (touch.identifier === _moveTouchId) {
            e.preventDefault();
            _updateMoveJoystick(touch.clientX, touch.clientY);
        }
        if (touch.identifier === _aimTouchId) {
            e.preventDefault();
            _updateAimJoystick(touch.clientX, touch.clientY);
        }
    }
}

function _onMoveEnd(e) {
    for (const touch of e.changedTouches) {
        if (touch.identifier === _moveTouchId) {
            _moveTouchId = null;
            _moveDx = 0;
            _moveDy = 0;
            _moveKnobEl.style.transform = 'translate(-50%, -50%)';
        }
        if (touch.identifier === _aimTouchId) {
            _aimTouchId = null;
            _isAiming = false;
            _aimKnobEl.style.transform = 'translate(-50%, -50%)';
            if (_callbacks && _callbacks.onAttackEnd) _callbacks.onAttackEnd();
        }
    }
}

function _updateMoveJoystick(touchX, touchY) {
    let dx = touchX - _moveCenterX;
    let dy = touchY - _moveCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > JOYSTICK_RADIUS) {
        dx = (dx / dist) * JOYSTICK_RADIUS;
        dy = (dy / dist) * JOYSTICK_RADIUS;
    }

    _moveKnobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    const normDx = dx / JOYSTICK_RADIUS;
    const normDy = dy / JOYSTICK_RADIUS;
    const normDist = Math.sqrt(normDx * normDx + normDy * normDy);

    if (normDist < DEAD_ZONE) {
        _moveDx = 0;
        _moveDy = 0;
    } else {
        _moveDx = normDx;
        _moveDy = normDy;
    }
}

// ==================== Aim Joystick ====================

function _onAimStart(e) {
    e.preventDefault();
    if (_aimTouchId !== null) return;
    const touch = e.changedTouches[0];
    _aimTouchId = touch.identifier;
    const rect = _aimJoystickEl.getBoundingClientRect();
    _aimCenterX = rect.left + rect.width / 2;
    _aimCenterY = rect.top + rect.height / 2;
    _isAiming = true;
    _updateAimJoystick(touch.clientX, touch.clientY);
    // Start auto-attack
    if (_callbacks && _callbacks.onAttackStart) _callbacks.onAttackStart();
}

function _updateAimJoystick(touchX, touchY) {
    let dx = touchX - _aimCenterX;
    let dy = touchY - _aimCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > JOYSTICK_RADIUS) {
        dx = (dx / dist) * JOYSTICK_RADIUS;
        dy = (dy / dist) * JOYSTICK_RADIUS;
    }

    _aimKnobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    const normDist = dist / JOYSTICK_RADIUS;
    if (normDist > DEAD_ZONE) {
        _aimAngle = Math.atan2(dy, dx);
    }
}

// ==================== Canvas Touch ====================

function _onCanvasTouch(e) {
    if (_callbacks && _callbacks.onCanvasTouch) {
        const touch = e.changedTouches[0];
        _callbacks.onCanvasTouch(touch.clientX, touch.clientY, e);
    }
}
