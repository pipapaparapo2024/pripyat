/**
 * Test: батч 25.09.2026 (по прямому указанию, скриншот "Мои достижения") —
 *
 * 1) collapseToTopPerFamily() раньше показывала в карточке темы МАКСИМАЛЬНЫЙ УЖЕ ЗАРАБОТАННЫЙ
 *    тир (например "Опасный сталкер", нанеси 10к — уже пройдено), хотя это дублировало ту же
 *    строку, что и так видна в развёрнутом списке тиров темы. По прямому указанию пользователя
 *    ("ты пишешь те достижения, которые уже выполнены, а не те, что сейчас выполняются") —
 *    карточка темы теперь показывает СЛЕДУЮЩИЙ незаработанный тир (текущую цель, "Раздающий
 *    боль", нанеси 50к), а если тема выполнена целиком — последний (максимальный) тир.
 * 2) Ники игроков во всех вкладках Сводки (общий топ/друзья/урон/авторитет/достижения — одна
 *    общая строка-пул в svod-leaderboard.js) уменьшены на 2px: fontSize 15 → 13.
 *
 * Run: node tests/svod-next-achievement-tier-and-nickname-fontsize.test.js
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

const tiersSrc  = readSrc('_client/src/modules/achievement-tiers.js');
const leaderSrc = readSrc('_client/src/game/svod/svod-leaderboard.js');

console.log('\nTest 1: collapseToTopPerFamily — возвращает СЛЕДУЮЩИЙ незаработанный тир, не максимальный заработанный');
{
    const start = tiersSrc.indexOf('export function collapseToTopPerFamily(list, earned){');
    const end   = tiersSrc.indexOf('\n}', start);
    const body  = tiersSrc.slice(start, end);

    assert(/const nextUnearned = items\.find\(a => !earned\[a\.id\]\);/.test(body),
        'ищет первый (по возрастанию threshold, items уже отсортирован) незаработанный тир темы');
    assert(/out\.push\(nextUnearned \|\| items\[items\.length - 1\]\);/.test(body),
        'если незаработанного тира нет (тема выполнена целиком) — берётся последний/максимальный тир как финальное состояние');
    assert(!/earnedItems\[earnedItems\.length - 1\]/.test(body),
        'старая логика "максимальный ЗАРАБОТАННЫЙ" убрана целиком');
}

console.log('\nTest 2: симуляция — тема "damage" с заработанными 1к/10к и целью 50к показывает 50к, не 10к');
{
    // Изолированный ре-имплемент той же функции по актуальному исходнику — без реального импорта
    // ES-модуля в CJS-тестовой среде (тот же приём, что и в остальных тестах этого модуля).
    const famKey = a => a.cat; // упрощённая версия achievementFamilyKey для одной темы cat:'damage'
    function collapse(list, earned){
        const groups = new Map();
        list.forEach(a => { const key = famKey(a); if(!groups.has(key)) groups.set(key, []); groups.get(key).push(a); });
        const out = [];
        groups.forEach(items => {
            items.sort((a, b) => a.threshold - b.threshold);
            const nextUnearned = items.find(a => !earned[a.id]);
            out.push(nextUnearned || items[items.length - 1]);
        });
        return out;
    }
    const list = [
        {id:'dmg_1k',  cat:'damage', name:'Первая кровь',    threshold:1000},
        {id:'dmg_10k', cat:'damage', name:'Опасный сталкер', threshold:10000},
        {id:'dmg_50k', cat:'damage', name:'Раздающий боль',  threshold:50000},
    ];
    const earned = { dmg_1k: true, dmg_10k: true }; // 50к ещё не пройдено
    const result = collapse(list, earned);
    assert(result.length === 1, 'одна карточка на тему damage');
    assert(result[0].id === 'dmg_50k', 'показан следующий незаработанный тир (50к), а не последний заработанный (10к)');

    const allEarned = { dmg_1k: true, dmg_10k: true, dmg_50k: true };
    const resultDone = collapse(list, allEarned);
    assert(resultDone[0].id === 'dmg_50k', 'если тема выполнена целиком — показан последний/максимальный тир');
}

console.log('\nTest 3: ники игроков в Сводке уменьшены на 2px (15 → 13), общая строка-пул для всех вкладок');
{
    const s = leaderSrc.indexOf('const nameTxt = new PIXI.Text(');
    const e = leaderSrc.indexOf('});', s);
    const body = leaderSrc.slice(s, e);
    assert(/fontSize:13,\s*fill:'#ffffff'/.test(body), "nameTxt fontSize:13 (было 15)");
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
