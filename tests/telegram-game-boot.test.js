
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

const source = readFileSync('_client/src/game/game-boot.js', 'utf8')
    .replace(/^import .*;\r?$/gm, '')
    .replace('export function setupGameBoot', 'function setupGameBoot')
    .replace('const _earlyPngs =', "window._allGamePngs = ['missing.png', 'pending.png'];\n    const _earlyPngs =");

function checkBoot({ modulesFirst }) {
    const pending = new EventEmitter();
    const missing = new EventEmitter();
    const timers = new Map();
    const moduleCallbacks = [];
    const elements = new Map(['_clo', '_loader_ui', '_prgBar', '_prgPct']
        .map(id => [id, { style: {} }]));
    const events = [];
    const calls = [];
    const window = {
        __telegramRuntime: {},
        _preloaderVisualReady() {
            assert.equal(elements.get('_prgPct').textContent, '100%');
            assert.equal(elements.get('_loader_ui').style.display, 'none');
            events.push('ready');
        },
    };
    runInNewContext(source + '\nsetupGameBoot();', {
        window,
        document: { getElementById: id => elements.get(id) },
        console: { log() {}, error() {} },
        root: { children: [], addChild(child) { this.children.push(child); } },
        PIXI: {
            Container: class {},
            Loader: { shared: { loading: false } },
            Texture: {
                from(url) {
                    calls.push(url);
                    return { baseTexture: url.endsWith('missing.png') ? missing : pending };
                },
            },
        },
        modules: {
            flags: {},
            checkFlags(names, callback) { moduleCallbacks.push(callback); },
            constructSkills() {},
            constructAchievements() {},
        },
        iface: { init() { events.push('interface'); } },
        home: { init() { events.push('home'); } },
        setTimeout(fn, delay) { timers.set(delay, fn); },
        setInterval() {},
        clearInterval() {},
        startBackgroundMusic() { events.push('music'); },
        checkRewardLink() { events.push('rewards'); },
    });
    window._startEarlyPngPreload();
    missing.emit('error', new Error('404'));
    assert.equal(elements.get('_prgPct').textContent, '50%');
    window.endLoadGame();
    assert(timers.has(0), 'Telegram must start module loading without the 4s delay');
    timers.get(0)();
    assert.equal(moduleCallbacks.length, 16);
    if (modulesFirst) moduleCallbacks.forEach(callback => callback());
    timers.get(200)();
    assert.equal(calls.filter(url => url.endsWith('missing.png')).length, 1);
    pending.emit('loaded');
    assert.equal(elements.get('_prgPct').textContent, '99%');
    assert.deepEqual(events, ['interface', 'home']);
    if (!modulesFirst) {
        timers.get(300)();
        moduleCallbacks.slice(0, -1).forEach(callback => callback());
        assert.equal(elements.get('_prgPct').textContent, '99%');
        moduleCallbacks.at(-1)();
    }
    timers.get(300)();
    assert.deepEqual(events, ['interface', 'home', 'ready', 'music', 'rewards']);
}

checkBoot({ modulesFirst: false });
checkBoot({ modulesFirst: true });
console.log('Telegram boot: early PNG failure, honest progress and both load orders passed');
