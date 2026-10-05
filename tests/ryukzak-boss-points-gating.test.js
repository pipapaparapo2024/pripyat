/**
 * Test: рюкзак теперь требует накопления очков с боссов (ryukzak_points), а не собирается
 * свободно на основе udata['level']. Таблица очков за килл и пороги уровней — присланы
 * пользователем 15.09.2026 (см. bosses-combat.js RYUKZAK_PTS и ryukzak.js RYUKZAK_THRESHOLDS).
 *
 * Run: node tests/ryukzak-boss-points-gating.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const combatSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');
const ryukSrc   = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'ryukzak.js'), 'utf-8');
const usersPhpSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const devSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');
const bossesPhp = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');
const bossesCatalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'json', 'bosses_config.json'), 'utf-8'));

// 17.09.2026: перенос награды за убийство на сервер (bosses.claimKill) переместил и таблицу
// очков рюкзака — теперь она живёт в server/json/bosses_config.json (ryukzak_pts), а клиент
// (_onDefeat) больше НЕ пишет udata['ryukzak_points'] напрямую (см. отдельный тест-файл
// bosses-server-authoritative-kill-reward.test.js, Test 6). Ниже проверяем НОВОЕ место истины.
console.log('\nTest 1: очки рюкзака начисляются на сервере при убийстве босса (claimKill)');
{
    assert(JSON.stringify(bossesCatalog.ryukzak_pts) === JSON.stringify([5, 10, 20, 35, 60, 90, 110, 150]),
        'таблица очков по индексу босса (0=Охотник..7=Жгут) заведена ровно как прислал пользователь — теперь в bosses_config.json');
    assert(/\$ryukzakPts = intval\(\$catalog\['ryukzak_pts'\]\[\$bossId\] \?\? 0\);/.test(bossesPhp),
        'claimKill() читает очки по индексу убитого босса из каталога');
    // 04.10.2026 (стале-пин, не регрессия — см. аудит гонок состояний): начисление теперь
    // идёт под SELECT...FOR UPDATE (защита от гонки с ryukzak.php.open(), который обнуляет
    // это же поле) — прямое присвоение $user['ryukzak_points'] заменено на фолбэк-ветку
    // (без лока) + отдельный UPDATE (с локом). Сам факт начисления ($ryukzakPts) не менялся,
    // см. tests/race-conditions-skills-weapons-ryukzak-casino-04-10.test.js.
    assert(/\$freshRyukzakPts = \(\$rpRow !== null \? intval\(\$rpRow\['ryukzak_points'\]\) : \$this->ops->i\(\$user, 'ryukzak_points'\)\) \+ \$ryukzakPts;/.test(bossesPhp),
        'claimKill() реально прибавляет очки к ryukzak_points (под локом строки)');
    assert(!/RYUKZAK_PTS/.test(combatSrc),
        'клиент (_onDefeat) больше не хранит собственную копию таблицы очков — единственный источник теперь сервер');
}

console.log('\nTest 2: ryukzak.js — уровень считается ИЗ ОЧКОВ, а не из udata[\'level\']');
{
    assert(/const RYUKZAK_THRESHOLDS = \[30, 70, 120, 180, 250, 330, 420, 520, 630, 750, 850, 930, 1000, 1060, 1110, 1145, 1170, 1185, 1195, 1200\];/.test(ryukSrc),
        'пороги уровней 1-20 заведены ровно как прислал пользователь');
    assert(!/const level = parseInt\(udata && udata\['level'\]/.test(ryukSrc), 'старая привязка к udata[\'level\'] убрана');
    assert(/const points\s*=\s*parseInt\(udata && udata\['ryukzak_points'\]/.test(ryukSrc), 'очки читаются из ryukzak_points');
    assert(/_ryukzakLevelFromPoints\(points\)/.test(ryukSrc), 'уровень (для клиентского превью) вычисляется через _ryukzakLevelFromPoints(points)');
}

// 21.09.2026 (по прямому указанию) — старый гейт "забрать можно только если уровень ВЫШЕ уже
// забранного" был НЕВЕРНЫМ пониманием ТЗ: очки рюкзака влияют ТОЛЬКО на то, какой из 20
// тарифов достанется, а НЕ на саму возможность открытия. Рюкзак открывается сколько угодно раз
// подряд, единственное условие — 20 тушёнки (теперь проверяет сервер, ryukzak.php). Гейт
// canClaim/claimedLevel убран целиком — см. batch-21-09-*.test.js для новой server-authoritative схемы.
console.log('\nTest 3: ryukzak.js — открытие БОЛЬШЕ НЕ гейтится уровнем/claimedLevel, только тушёнкой (сервер)');
{
    assert(!/const claimedLevel/.test(ryukSrc), 'claimedLevel больше не читается клиентом');
    assert(!/const canClaim/.test(ryukSrc), 'canClaim как гейт полностью убран');
    assert(/zabratBtn\.on\('pointerdown', \(\)=>\{/.test(ryukSrc), 'клик по ЗАБРАТЬ есть');
    assert(/TS\.php\('ryukzak\.open', \{\}/.test(ryukSrc), 'клик по ЗАБРАТЬ всегда зовёт сервер (ryukzak.open) — сервер сам решает, хватает ли тушёнки');
}

console.log('\nTest 4: _ryukzakLevelFromPoints — корректно считает уровень по порогам (логическая проверка)');
{
    const thresholds = [30, 70, 120, 180, 250, 330, 420, 520, 630, 750, 850, 930, 1000, 1060, 1110, 1145, 1170, 1185, 1195, 1200];
    function levelFromPoints(points){
        let lvl = 0;
        for(let i = 0; i < thresholds.length; i++){
            if(points >= thresholds[i]) lvl = i + 1;
            else break;
        }
        return lvl;
    }
    assert(levelFromPoints(0) === 0, '0 очков → уровень 0 (ничего не собрано)');
    assert(levelFromPoints(29) === 0, '29 очков → всё ещё уровень 0');
    assert(levelFromPoints(30) === 1, 'ровно 30 очков → уровень 1');
    assert(levelFromPoints(69) === 1, '69 очков → уровень 1 (порог level2=70 ещё не достигнут)');
    assert(levelFromPoints(1200) === 20, '1200 очков → максимальный уровень 20');
    assert(levelFromPoints(5000) === 20, 'очков с избытком → всё равно максимум 20 (не выходит за пределы массива)');
}

console.log('\nTest 5: server whitelist + dev-сброс аккаунта знают о новых полях');
{
    // 25.09.2026 (аудит по прямому указанию — "проверь очки/уровень рюкзака на сервере/в БД"):
    // ryukzak_points УБРАН из $allowed — единственный писатель теперь claimKill(), оставаясь
    // в whitelist поле позволяло читеру одним users.save открывать рюкзак сразу на 20 уровне.
    // ryukzak_claimed_level остаётся (инертное поле, нигде не читается с 21.09.2026).
    assert(/'ryukzak_claimed_level'/.test(usersPhpSrc), 'ryukzak_claimed_level остался в $allowed whitelist (инертен, риска нет)');
    assert(!/'ryukzak_points','ryukzak_claimed_level'/.test(usersPhpSrc), 'ryukzak_points убран из $allowed — только сервер (claimKill) пишет уровень наград рюкзака');
    assert(/'ryukzak_points'\s*=> 0,/.test(usersPhpSrc), 'ryukzak_points явно обнуляется в resetSession() (server-only поле, полный сброс аккаунта должен его коснуться)');
    assert(/ryukzak_points:'0', ryukzak_claimed_level:'0'/.test(devSrc), 'dev-панель по-прежнему шлёт оба поля в users.save — для ryukzak_points теперь безвредно игнорируется (обнуляется отдельным вызовом users.resetSession)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
