/**
 * Test: батч 23.09.2026 (по прямому указанию, репорт "не сохраняются ключи на боссов, урон
 * сбрасывается после перезагрузки страницы, у игрока ничего нет").
 *
 * Аудит (полный разбор — см. переписку) нашёл подтверждённую гонку: `bosses_data` (keys[],
 * bossStartMs[][], dailyKills[] и т.д.) — client-writable поле в whitelist `$allowed`
 * (server/core/controllers/users.php), без какой-либо anti-rollback защиты (в отличие от
 * weapons/shmot, у которых есть $jsonBlobGuards). Общий 500мс-дебаунс автосейва
 * (_client/src/modules/player-save.js) шлёт ВЕСЬ udata целиком на КАЖДУЮ мутацию любого поля —
 * а каждый удар боссу (bosses-combat.js._attack → this._saveToUdata()) заново взводит этот
 * таймер, значит в момент победы почти всегда есть "готовый выстрелить" автосейв со СТАРЫМ
 * (довоенным) bosses_data.
 *
 * Ровно тот же класс гонки уже был найден и закрыт для СТАРТА боя (bosses_fight.js.
 * _openBossesFight, 22.09.2026, "иногда при обновлении страницы бой пропадает") и для
 * таймаута/форфейта — везде лекарство одно: flushPlayerSave() СИНХРОННО перед запросом к
 * серверу, чтобы гарантированно ни один устаревший снимок bosses_data не долетел ПОСЛЕ того,
 * как сервер уже записал свежее состояние. Единственное место, где начисляются КЛЮЧИ боссов
 * (claimKill(), победа) — было единственным без этой защиты. Починка: та же защита, тот же
 * паттерн, что уже 3 раза доказал себя в этом же файле/соседнем bosses_fight.js.
 *
 * Run: node tests/boss-claim-kill-flush-before-request-race-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const combatSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');
const usersPhp  = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');

console.log('\nTest 1: регресс-гвард — bosses_data подтверждённо client-writable без anti-rollback защиты (документирует ПОЧЕМУ фикс вообще нужен)');
{
    const m = usersPhp.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!m, '$allowed массив найден');
    assert(m && /'bosses_data'/.test(m[1]), "'bosses_data' в whitelist (client-writable) — подтверждает риск гонки");
    assert(!/\$jsonBlobGuards\s*=\s*\[[^\]]*'bosses_data'/.test(usersPhp),
        'bosses_data НЕ имеет anti-rollback guard (в отличие от weapons/shmot) — гонка реальна, не гипотетична');
}

console.log('\nTest 2: _onDefeat() — claimKill() теперь оборачивается в flushPlayerSave (тот же паттерн, что старт/форфейт/таймаут)');
{
    const m = combatSrc.match(/proto\._onDefeat = function\(idx\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_onDefeat найден');
    const body = m ? m[1] : '';
    assert(/flushPlayerSave\('boss_claim_kill', \(\) => \{/.test(body),
        'КРИТИЧНО: flushPlayerSave обёртка добавлена перед TS.php(\'bosses.claimKill\', ...)');
    // Порядок важен — флаш должен идти ПЕРЕД самим запросом, не после.
    const flushIdx = body.indexOf("flushPlayerSave('boss_claim_kill'");
    const claimIdx = body.indexOf("TS.php('bosses.claimKill'");
    assert(flushIdx !== -1 && claimIdx !== -1 && flushIdx < claimIdx,
        'flushPlayerSave вызывается ДО TS.php(\'bosses.claimKill\', ...), не после (иначе гонка не закрыта)');
}

console.log('\nTest 3: регресс-гвард — сама логика claimKill (начисление ключей/наград/сброс боя) не задета этой правкой, только обёрнута');
{
    assert(/TS\.php\('bosses\.claimKill', \{boss_id: idx, diff_idx: diffIdx\}, \(res\) => \{/.test(combatSrc),
        'вызов TS.php(\'bosses.claimKill\', ...) с теми же параметрами, что и раньше');
    assert(/\}, \(err\) => \{/.test(combatSrc), 'error-колбэк claimKill (дневной лимит убийств и т.п.) сохранён');
    // Двойное закрытие скобок — снаружи TS.php(...), снаружи flushPlayerSave(...) — иначе
    // либо синтаксическая ошибка, либо код "утекает" из-под обёртки.
    assert(/\}\);\s*\n\s*\}\); \/\/ flushPlayerSave\('boss_claim_kill', \.\.\.\)/.test(combatSrc),
        'оба вызова (TS.php и flushPlayerSave) закрыты корректно — по одной закрывающей скобке на каждый');
}

console.log('\nTest 4: регресс-гвард — уже существующие 3 места с тем же паттерном не сломаны этой правкой');
{
    const fightSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');
    assert(/flushPlayerSave\('boss_start_fight', \(\) => \{/.test(fightSrc), 'старт боя (_openBossesFight) по-прежнему флашит перед startFight');
    assert(/if\(window\.flushPlayerSave\) flushPlayerSave\('boss_fight_timeout'\);/.test(combatSrc), 'таймаут (_onFightTimeout) по-прежнему флашит перед endFightSession');
    assert(/if\(window\.flushPlayerSave\) flushPlayerSave\('boss_forfeit'\);/.test(fightSrc), 'форфейт (_forfeitBossFight) по-прежнему флашит перед endFightSession');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
