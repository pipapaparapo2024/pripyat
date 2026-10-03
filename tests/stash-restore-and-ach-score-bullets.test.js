/**
 * Test: два фикса по прямому указанию (15.09.2026).
 *
 * 1) Заначки были отключены на бете (zone.js._attack: "this._tryDropStash(locIdx);" был
 *    закомментирован с пометкой "вернуть после релиза") — ачивки за сбор заначек уже были
 *    реализованы в achievements.js и корректно срабатывали бы, но сами заначки физически
 *    не выпадали никогда. Строка раскомментирована обратно.
 *
 * 2) yashik.js использует отдельный счётчик udata['ach_score'] как альтернативную "валюту"
 *    для открытия ящика (50 очков = открыть без патрона) — но НИКОГДА не начислялся, только
 *    тратился, прогресс-бар "0/50" в ящике был мёртв. По прямому указанию: патрон для ящика
 *    (udata['bullets']) также можно получить, набрав 50 очков достижений — теперь
 *    achievements._checkAll() копит ach_score вместе с achievement_stars и конвертирует
 *    каждые 50 очков в +1 патрон.
 *
 * Run: node tests/stash-restore-and-ach-score-bullets.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const zoneSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'zone.js'), 'utf-8'
);
const achSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'achievements.js'), 'utf-8'
);

// 17.09.2026 (позже этого батча, перенос Зоны на сервер): _attack() полностью переписан —
// заполнение чекпоинта, награда И решение "выпала ли заначка" (15% шанс) теперь считает
// СЕРВЕР (zone.php.fillCheckpoint) — читер больше не может подделать бросок RNG. Клиент
// получает готовый res.stash в ответе и просто применяет его; _tryDropStash() (старая
// клиентская реализация) стала мёртвым кодом, оставлена как есть (не вызывается нигде).
console.log('\nTest 1: заначки выпадают через сервер (zone.php.fillCheckpoint), а не отключены');
{
    const m = zoneSrc.match(/TS\.php\('zone\.fillCheckpoint', \{loc: locIdx, cp: cpIdx\}, \(res\) => \{([\s\S]*?)\n        \}\);/);
    assert(!!m, 'zone._attack — колбэк fillCheckpoint найден');
    if(m){
        const body = m[1];
        // 25.09.2026 (регресс найден повторным прогоном тестов): классификация/награда/
        // достижения по нычкам убраны целиком (по прямому указанию, до релиза арта нычек) —
        // ответ сервера теперь просто флаг без типа, обрабатывается однострочно.
        assert(/if\(res\.stash && res\.stash\.dropped\) this\._showStashPickup\(\);/.test(body),
            'заначка реально обрабатывается по ответу сервера (не отключена/не закомментирована) — просто показывает "+1"');
        assert(!/if\(window\.achievements\) achievements\.onStashCollect\(res\.stash\.key\);/.test(body),
            'достижение за сбор заначки убрано вместе с классификацией (реального вызова onStashCollect в колбэке больше нет — упоминания в комментариях не в счёт)');
    }
    const zonePhp = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'zone.php'), 'utf-8');
    assert(/mt_rand\(1, 100\) <= 15|rand\(1, ?100\) <= 15/.test(zonePhp) || /0\.15/.test(zonePhp),
        'сервер сам решает 15%-й шанс выпадения заначки (не доверяет клиенту)');
}

// 23.09.2026 (перенос достижений на сервер, репорт "ачивки вылетают как попало" — заодно
// закрыта дыра: ach_score/bullets раньше писал клиент напрямую в client-writable поля).
// Конвертация ach_score→bullets переехала 1-в-1 в achievement_engine.php.checkAll() —
// achievements.js больше не трогает эти поля вовсе, см. achievement-tiers-module-and-
// svod-coords.test.js Test 2 для проверки, что клиент этого не делает.
console.log('\nTest 2: achievement_engine.php.checkAll() начисляет ach_score и конвертирует его в патроны по 50');
{
    const engineSrc = fs.readFileSync(
        path.join(__dirname, '..', 'server', 'core', 'models', 'achievementengine.php'), 'utf-8'
    );
    const m = engineSrc.match(/foreach\(\$catalog as \$a\)\{([\s\S]*?)\n            \}/);
    assert(!!m, 'цикл checkAll по каталогу найден');
    if(m){
        const body = m[1];
        assert(/\$ach = \$ops->i\(\$user, 'ach_score'\) \+ \$pts;/.test(body),
            'ach_score увеличивается на pts КАЖДОЙ новой ачивки (наравне с achievement_stars)');
        assert(/while\(\$ach >= 50\)\{/.test(body),
            'конвертация зациклена — обрабатывает случай, когда одна ачивка сразу даёт 50+ очков');
        assert(/\$ach -= 50;/.test(body),
            'списывает ровно 50 очков достижений за один патрон');
        assert(/\$user\['bullets'\] = \$ops->i\(\$user, 'bullets'\) \+ 1;/.test(body),
            'начисляет ровно +1 патрон (bullets) за списанные 50 очков');
    }
    assert(!/udata\['ach_score'\]/.test(achSrc) && !/udata\['bullets'\]/.test(achSrc),
        'achievements.js на клиенте больше не пишет ach_score/bullets напрямую');
}

console.log('\nTest 3: 50 — то самое число, которым уже пользуется yashik.js (ACH_THRESHOLD/PATRON_COST)');
{
    const yashikSrc = fs.readFileSync(
        path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'yashik.js'), 'utf-8'
    );
    assert(/const ACH_THRESHOLD = 50;/.test(yashikSrc), 'порог "открыть ящик за очки достижений" в yashik.js — тоже 50 (согласовано)');
    assert(/const PATRON_COST = 50;/.test(yashikSrc), 'покупка патрона за тушёнку — тоже 50 (уже было реализовано, не трогали)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
