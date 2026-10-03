/**
 * Test: батч 23.09.2026 (по прямому указанию, репорт "куплено всё оружие по 1М патронов, но
 * при атаке — 'оружие не куплено'" + console-лог с "bosses-combat.js: Ошибка 89").
 *
 * Аудит показал: dev_panel.js._pushWeaponsGrant() (users.devGrantWeapons — единственный
 * НЕограниченный писатель поля `weapons`) и обычный users.save() (гвардит рост owned/qty через
 * $jsonBlobGuards в users.php, читая ТЕКУЩЕЕ значение из БД) раньше улетали ПАРАЛЛЕЛЬНО из
 * _giveMillion()/_addAmmo()/_buy() — без всякой гарантии порядка ответа сервера. Если
 * guarded users.save() успевал прочитать weapons из БД РАНЬШЕ, чем закоммитится
 * devGrantWeapons(), он видел ещё старое owned:false, отклонял "эскалацию" и сам же следующей
 * записью стирал только что выданное оружие — сервер потом честно отвечал fail(89) на
 * bosses.attack, хотя клиент (оптимистично обновивший weapons.data в памяти) продолжал
 * показывать купленное оружие с 1М патронов.
 *
 * Run: node tests/dev-panel-weapons-grant-no-save-race.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');

console.log('\nTest 1: _pushWeaponsGrant() отменяет отложенный saveDevChanges() перед запросом и принимает callback');
{
    const m = src.match(/proto\._pushWeaponsGrant = function\(afterCb\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_pushWeaponsGrant(afterCb) найдена с новой сигнатурой (принимает callback)');
    const body = m ? m[1] : '';
    assert(/clearTimeout\(saveTimer\);/.test(body), 'КРИТИЧНО: отменяет отложенный debounced saveDevChanges() перед отправкой devGrantWeapons — иначе он может прочитать БД раньше коммита');
    assert(/afterCb \? afterCb\(res\) : saveDevChanges\(\);/.test(body), 'успех: вызывает переданный callback, либо (по умолчанию) перезапускает saveDevChanges() ПОСЛЕ ответа, не до');
    assert(/afterCb \? afterCb\(null\) : saveDevChanges\(\);/.test(body), 'ошибка: тот же принцип — follow-up save только после ответа devGrantWeapons, успешного или нет');
}

console.log('\nTest 2: _giveMillion() больше не зовёт users.save() параллельно с _pushWeaponsGrant() — только внутри его callback');
{
    const m = src.match(/proto\._giveMillion = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_giveMillion найдена');
    const body = m ? m[1] : '';
    assert(!/TS\.php\('users\.save'[\s\S]*?this\._pushWeaponsGrant\(\);/.test(body),
        'регресс-гвард: users.save() больше не идёт ДО отдельного вызова _pushWeaponsGrant() без связи между ними');
    const grantIdx = body.indexOf('this._pushWeaponsGrant(() => {');
    const saveIdx  = body.indexOf("TS.php('users.save'");
    assert(grantIdx !== -1, '_pushWeaponsGrant вызывается с callback-функцией (стрелочной)');
    assert(saveIdx !== -1 && grantIdx !== -1 && saveIdx > grantIdx,
        'КРИТИЧНО: TS.php(\'users.save\', ...) физически находится ВНУТРИ callback\'а _pushWeaponsGrant — не параллельный вызов');
}

console.log('\nTest 3: _addAmmo()/_buy() (точечные кнопки) по-прежнему вызывают saveDevChanges() + _pushWeaponsGrant() без нового callback-аргумента (используют дефолтное поведение)');
{
    const addAmmoMatch = src.match(/const _addAmmo = \(idx, amt\) => \{([\s\S]*?)\n        \};/);
    assert(!!addAmmoMatch, '_addAmmo найдена');
    assert(/this\._pushWeaponsGrant\(\);/.test(addAmmoMatch ? addAmmoMatch[1] : ''), '_addAmmo вызывает _pushWeaponsGrant() без аргумента — сработает дефолтный saveDevChanges()-после-ответа путь');

    const buyMatch = src.match(/const _buy = \(idx\) => \{([\s\S]*?)\n        \};/);
    assert(!!buyMatch, '_buy найдена');
    assert(/this\._pushWeaponsGrant\(\);/.test(buyMatch ? buyMatch[1] : ''), '_buy вызывает _pushWeaponsGrant() без аргумента — тот же дефолтный путь');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
