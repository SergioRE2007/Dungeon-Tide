// PRNG seedable — mulberry32
let _state = 0;
let _useFallback = false;

function mulberry32() {
    _state |= 0;
    _state = (_state + 0x6D2B79F5) | 0;
    let t = Math.imul(_state ^ (_state >>> 15), 1 | _state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function setSeed(seed) {
    if (seed === -1) {
        _useFallback = true;
    } else {
        _useFallback = false;
        _state = seed | 0;
    }
}

export function random() {
    return _useFallback ? Math.random() : mulberry32();
}

export function nextInt(max) {
    return Math.floor(random() * max);
}

export function nextDouble() {
    return random();
}
