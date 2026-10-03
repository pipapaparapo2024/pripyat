/**
 * Regression test for the two artist-replaced assets.
 * Both web-client roots are live: /client/ver0_41 and /client/ver0_41/development.
 * A deployment must replace the asset in both roots, otherwise one game entry URL
 * continues to show the old art.
 *
 * Run: node tests/replaced-keyring-and-roulette-assets-deployment.test.js
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const image = (...parts) => path.join(root, '_client', 'development', 'images', ...parts);
const deploy = fs.readFileSync(path.join(root, 'deploy_v527_assets_ui.py'), 'utf8');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

let passed = 0;
function test(name, fn) {
    try { fn(); console.log('  OK', name); passed++; }
    catch (error) { console.error('  FAIL', name + ':', error.message); process.exitCode = 1; }
}

const expected = {
    wheel: 'e44a3651188b219749230720384d7b25dc1f724a513290ba8f227cf40d51d588',
    keyring: 'bf030aa2a574729cf64981d49b248e8beb093e5d5c4f9697fc255e25f528193f',
};

test('wheel PNG is the approved replacement', () => {
    assert.strictEqual(sha256(image('рулетка колесо.png')), expected.wheel);
});

test('keyring PNG is the approved replacement', () => {
    assert.strictEqual(sha256(image('shmot', 'связка ключей.png')), expected.keyring);
});

test('client preloader requests the exact PNG paths', () => {
    const boot = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'game-boot.js'), 'utf8');
    // 30.09.2026 (третий заход в тот же день — ?cb=2/?cb=3 query-параметры не помогли: диагностика
    // прямо на экране показала загруженную текстуру, не совпадающую НИ С ОДНИМ файлом в проекте,
    // хотя сервер честно отдавал верный файл с no-cache — кэш живёт между сервером и игрой, вне
    // нашего контроля, и игнорирует смену query. Единственный надёжный способ — сменить сам путь
    // файла: оба переименованы в "... v2.png", без query-маркера.
    assert(boot.includes("'рулетка колесо v2.png'"), 'renamed wheel URL is absent from the preloader');
    assert(boot.includes("'shmot/связка ключей v2.png'"), 'renamed keyring URL is absent from the preloader');
});

test('key purchase callback has an imported patch applier', () => {
    const panel = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf8');
    assert(panel.includes("import { applyPatch } from '../../../modules/patch.js';"), 'dev panel uses applyPatch without importing it');
});

test('deployment replaces each asset in both live client roots', () => {
    for (const remote of [
        'client/ver0_41/libs/index.js',
        'client/ver0_41/development/libs/index.js',
        'client/ver0_41/images/рулетка колесо.png',
        'client/ver0_41/development/images/рулетка колесо.png',
        'client/ver0_41/images/shmot/связка ключей.png',
        'client/ver0_41/development/images/shmot/связка ключей.png',
        'client/ver0_41/images/выход попап покупки ключей и кд оружия.png',
        'client/ver0_41/development/images/выход попап покупки ключей и кд оружия.png',
    ]) assert(deploy.includes(`\"${remote}\"`), `missing deployment destination: ${remote}`);
});

if (!process.exitCode) console.log(`All ${passed} asset deployment tests passed.`);
