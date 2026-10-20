/**
 * Test: батч 22.09.2026 (по прямому указанию) — баннер "ТЫ КАЧНУЛ СИЛУ / УВАЖЕНИЕ СТАЛКЕР!"
 * показывается при успешном клике "качнуть" на визитке друга (см. zaruba-gym-pump.test.js для
 * серверной части). Картинка добавлена пользователем (качнул силу.png, 1280×524), позиция
 * снята через редактор позиций: X=0, Y=71.
 *
 * 17.10.2026 (по прямому указанию — новый арт): 'качнул силу.png' → 'прокачал бицуху.png'
 * (1280×531), x/y не менялись. Старый файл оставлен на диске неиспользуемым.
 *
 * Run: node tests/gym-pump-banner.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const profileJs = readSrc('_client/src/game/shell/overlays/player_profile.js');

console.log('\nTest 1: файл "прокачал бицуху.png" присутствует в development/images/ (+.webp), старый "качнул силу.png" не удалён');
{
    const imgPath = path.join(root, '_client', 'development', 'images', 'прокачал бицуху.png');
    assert(fs.existsSync(imgPath) && fs.statSync(imgPath).size > 0, 'файл существует в development/images/');
    assert(fs.existsSync(imgPath + '.webp') && fs.statSync(imgPath + '.webp').size > 0, 'lossless-твин .webp существует');
    const oldPath = path.join(root, '_client', 'development', 'images', 'качнул силу.png');
    assert(fs.existsSync(oldPath), 'старый файл не удалён с диска (просто больше не используется)');
}

console.log('\nTest 2: _startGymPump() показывает баннер при успехе, не просто тост');
{
    const start = profileJs.indexOf('proto._startGymPump = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);
    assert(/this\._showGymPumpBanner\(\);/.test(body), 'успешный ответ сервера вызывает _showGymPumpBanner()');
    assert(!/notify\.showResult\(\{text:\(res\.target_nick \|\| 'Игрок'\) \+ ' качнулся!/.test(body),
        'старый текстовый тост заменён баннером, не дублируется');
}

console.log('\nTest 3: _showGymPumpBanner() — позиция X=0,Y=71 (снята редактором позиций), правильный файл');
{
    const start = profileJs.indexOf('proto._showGymPumpBanner = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);
    assert(/PIXI\.Texture\.from\('\.\/images\/прокачал бицуху\.png'\)/.test(body), 'использует правильный файл картинки');
    assert(/banner\.x = 0; banner\.y = 71;/.test(body), 'позиция X=0, Y=71 — как снято пользователем через редактор позиций');
    assert(/root\.layer2_mc\.addChild\(banner\);/.test(body), 'добавляется в layer2_mc (поверх остального интерфейса)');
}

console.log('\nTest 4: _showGymPumpBanner() — не копится при повторных вызовах, гаснет сам (не требует тапа)');
{
    const start = profileJs.indexOf('proto._showGymPumpBanner = function');
    const end   = profileJs.indexOf('\n    };', start);
    const body  = profileJs.slice(start, end);
    assert(/if\(this\._gymPumpBannerWin && this\._gymPumpBannerWin\.parent\)\{/.test(body),
        'убирает предыдущий баннер перед показом нового — не копится при повторных кликах подряд');
    assert(/gsap\.timeline\(\)/.test(body) && /onComplete:_remove/.test(body),
        'использует gsap-таймлайн с авто-удалением по завершении — тот же паттерн, что achievement.js');
    assert(/setTimeout\(_remove, 1900\);/.test(body), 'есть fallback без gsap — не блокирует показ, если gsap недоступен');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
