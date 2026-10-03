/**
 * Test: батч 15.09.2026 —
 *  1) dev_panel.js._resetAccount — payload теперь явно включает КАЖДЫЙ ключ из
 *     server/users.php $allowed (weapons/shmot/bosses_data/achievements/skills_data/
 *     gang_data/inventory и т.д.), а не только ~20 "простых" полей валюты/энергии.
 *     Сервер (users.php.save) сохраняет в БД ТОЛЬКО ключи, реально присутствующие во
 *     входящем JSON — раньше отсутствующие ключи оставались нетронутыми в БД, и "сброшенный"
 *     аккаунт после перезагрузки снова показывал старые шмотки/оружие (репорт подтверждён).
 *  2) achievement.js/dev_panel.js — тестовый показ ачивки из dev-панели теперь передаёт
 *     opts.persistent=true и не исчезает сам по себе.
 *
 * Run: node tests/reset-account-full-wipe-and-dev-popup.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const devSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8'
);
const usersPhpSrc = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'core', 'controllers', 'users.php'), 'utf-8'
);
const achSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'popups', 'achievement.js'), 'utf-8'
);

console.log('\nTest 1: _resetAccount покрывает ВЕСЬ server/users.php $allowed whitelist');
{
    const allowedMatch = usersPhpSrc.match(/\$allowed = \[([\s\S]*?)\];/);
    assert(!!allowedMatch, '$allowed массив найден в users.php');
    // 28.09.2026: вырезаем // PHP-комментарии ПЕРЕД извлечением ключей regex'ом ниже — без
    // этого любое упоминание вида 'roulette'/'poker_chips' в пояснительном комментарии внутри
    // массива (а их там много — история почему поле убрано/оставлено) ложно считалось
    // отдельным ключом whitelist'а, которого нет в _resetAccount.
    const allowedNoComments = allowedMatch[1].replace(/\/\/[^\n]*/g, '');

    const resetIdx = devSrc.indexOf('proto._resetAccount = function(){');
    assert(resetIdx !== -1, '_resetAccount найден в dev_panel.js');
    // 18.09.2026: было фиксированное окно в 3500 символов — с тех пор в _resetAccount
    // добавились блоки явного сброса zone/bosses/shmot в памяти (см. соответствующие миграции
    // экономики), функция выросла за пределы этого окна, и хвостовые поля whitelist (те, что
    // перечислены ПОСЛЕ payload'а wrapPlayerData) ложно считались "отсутствующими". Берём
    // границу до конца самого payload'а (закрывающая "});" вызова wrapPlayerData), а не магическое число.
    const payloadEnd = devSrc.indexOf('});', resetIdx) + 3;
    const resetBody = devSrc.slice(resetIdx, payloadEnd);

    const allowedKeys = [...allowedNoComments.matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]);
    assert(allowedKeys.length >= 60, 'из users.php извлечено разумное число ключей (' + allowedKeys.length + ')');

    const missing = allowedKeys.filter(k => !new RegExp('\\b' + k + ':').test(resetBody));
    assert(missing.length === 0,
        missing.length === 0
            ? 'все ' + allowedKeys.length + ' ключей из whitelist явно перечислены в _resetAccount'
            : 'ОТСУТСТВУЮТ в _resetAccount: ' + missing.join(', '));
}

console.log('\nTest 2: ключевые "проблемные" поля (шмотки/оружие/достижения) обнуляются явно');
{
    for(const key of ['weapons', 'shmot', 'bosses_data', 'achievements', 'achievement_stars',
                       'skills_data', 'gang_data', 'inventory', 'stash_data', 'stash_count']){
        assert(new RegExp('\\b' + key + ":\\s*'").test(devSrc), `поле '${key}' явно задано в reset-объекте`);
    }
}

console.log('\nTest 3: dev-попап достижения теперь persistent (не исчезает сам)');
{
    assert(/achievements\._openAchievementPopup\(a, \{persistent:true\}\);/.test(devSrc),
        '_testAchievementPopup передаёт {persistent:true}');
    assert(/const persistent = !!\(opts && opts\.persistent\);/.test(achSrc),
        '_buildAchievementPopup читает opts.persistent');
    assert(/if\(persistent\)\{/.test(achSrc), 'есть отдельная ветка persistent без авто-исчезновения');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
