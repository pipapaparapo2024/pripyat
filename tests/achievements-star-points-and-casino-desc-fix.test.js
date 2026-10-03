/**
 * Test: 04.10.2026, по прямому указанию (повторный репорт).
 *
 * 1) "в звездочках справа пиши сколько очков навыков игрок уже получил (я уже просил тебя это
 *    сделать ты сказал что сделал но там ничего не выводится)" — svod-achievements.js:
 *    earnedStarPts раньше брался из a.pts (очки СЛЕДУЮЩЕГО, ещё не заработанного тира) и
 *    показывался только при starProgress>=1 — для многотировых тем (урон/автоматы/стволы и
 *    т.п., 10+ тиров) это условие почти никогда не выполняется рано, поэтому звезда оставалась
 *    пустой даже когда младшие тиры уже заработаны. Теперь источник — opts.totalPtsEarned
 *    (сумма ВСЕХ уже заработанных тиров темы) для базовой карточки, a.pts (если earned) — для
 *    строки тира.
 *
 * 2) "у тебя например в названии достижения семерки написано "достигни 1 уровня в сорви куш"
 *    а должно быть..." — interface-achievements.js._achievementDesc(): cat 'cards'/'poker'/
 *    'roulette' смешивают уровни/комбинации/спички под одним cat, раньше ВСЕГДА показывали
 *    фразу уровня. Теперь ветвится по виду id (тот же разбор, что уже использует
 *    achievementFamilyKey() в modules/achievement-tiers.js).
 *
 * 3) "в достижения где написано победить босса быстро допиши в скобках (за час)" — cat 'fast'.
 *
 * Run: node tests/achievements-star-points-and-casino-desc-fix.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const svodAch = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'svod', 'svod-achievements.js'), 'utf-8');
const ifaceAch = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface', 'interface-achievements.js'), 'utf-8');
const achList = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'achievements.js'), 'utf-8');

console.log('\nTest 1: звёздочка показывает УЖЕ заработанные очки темы, а не очки следующего тира');
{
    assert(svodAch.includes("const earnedStarPts = isTierRow ? (done ? (a.pts || 0) : 0) : (opts.totalPtsEarned || 0);"),
        'earnedStarPts для базовой карточки = opts.totalPtsEarned, для тира = a.pts только если done');
    assert(!/earnedStarPts = showBar \? \(\(opts\.starProgress \|\| 0\) >= 1/.test(svodAch),
        'старое условие "только при starProgress>=1" убрано');
}

console.log('\nTest 2: описание достижений карт различает уровень игры и комбинацию');
{
    const start = ifaceAch.indexOf("if(a.cat === 'cards'){");
    const body = ifaceAch.slice(start, start + 300);
    assert(/Достигни \$\{_fmtAchNum\(n\)\} уровня в игре в карты/.test(body), 'уровень карт — "в игре в карты", не "в «Сорви куш»"');
    assert(/Собери комбинацию \$\{CARD_COMBO_LABEL\[key\]/.test(body), 'комбинация карт — отдельная фраза "Собери комбинацию X"');
    assert(/const CARD_COMBO_LABEL = \{77:'7\|7', 88:'8\|8', 99:'9\|9', tt:'10\|10', jj:'J\|J', qq:'Q\|Q', kk:'K\|K', aa:'A\|A'\};/.test(ifaceAch),
        'таблица меток комбинаций карт (7|7..A|A) задана');
}

console.log('\nTest 3: описание покера различает уровень/спички/комбинацию');
{
    const start = ifaceAch.indexOf("if(a.cat === 'poker'){");
    const body = ifaceAch.slice(start, start + 400);
    assert(/Получи \$\{_fmtAchNum\(n\)\} уровень в покере/.test(body), 'уровень покера — "Получи X уровень в покере"');
    assert(/Собери \$\{_fmtAchNum\(n\)\} фиолетовых спичек в покере/.test(body), 'спички покера — отдельная фраза');
    assert(/Собери \$\{POKER_COMBO_LABEL\[key\] \|\| key\}, играя в покер/.test(body), 'комбинация покера (Каре/Стрит-Флеш/Роял-Флеш) — отдельная фраза');
}

console.log('\nTest 4: описание рулетки различает уровень колеса и спички');
{
    const start = ifaceAch.indexOf("if(a.cat === 'roulette'){");
    const body = ifaceAch.slice(start, start + 250);
    assert(/Достигни \$\{_fmtAchNum\(n\)\} уровня в колесе фортуны/.test(body), 'уровень рулетки — "в колесе фортуны", не "в рулетке"');
    assert(/Собери \$\{_fmtAchNum\(n\)\} голубых спичек/.test(body), 'спички рулетки — отдельная фраза без привязки к уровню');
}

console.log('\nTest 5: быстрая победа над боссом уточняет "(за час)"');
{
    assert(ifaceAch.includes("return `Победи ${BOSS_NAMES[idx] || 'босса'} быстро (за час)`;"),
        'описание cat fast дописывает "(за час)"');
}

console.log('\nTest 6: названия покерных уровневых достижений исправлены (ё)');
{
    assert(achList.includes("name:'Сегодня везёт'"), 'pkr_l30 — "Сегодня везёт" с ё');
    assert(achList.includes("name:'Опытный картёжник'"), 'pkr_l70 — "Опытный картёжник" с ё');
    assert(!achList.includes("name:'Сегодня везет'"), 'старое написание без ё убрано');
    assert(!achList.includes("name:'Опытный картежник'"), 'старое написание без ё убрано');
}

console.log('\nTest 7: очки/названия казино-достижений совпадают с присланным ТЗ (regression pin)');
{
    const pairs = [
        ["id:'crd_l25',  cat:'cards',  name:'(карты) 25 уровень',   pts:1"],
        ["id:'crd_77',  cat:'cards', name:'Семерки',  pts:1"],
        ["id:'crd_aa',  cat:'cards', name:'Тузы',     pts:3"],
        ["id:'pkr_l10',  cat:'poker', name:'Азартное начало',   pts:5"],
        ["id:'pkr_l100', cat:'poker', name:'Катала',            pts:30"],
        ["id:'pkr_kare',   cat:'poker', name:'(покер) Каре',       pts:20"],
        ["id:'pkr_rf',     cat:'poker', name:'(покер) Роял-Флеш',  pts:60"],
        ["id:'pkr_sp10k', cat:'poker', name:'Поднялся на покере', pts:20"],
        ["id:'rul_l100', cat:'roulette', name:'Легенда фортуны',pts:50"],
        ["id:'rul_sp10k',  cat:'roulette', name:'Пироман',         pts:40"],
    ];
    pairs.forEach(([needle]) => assert(achList.includes(needle), 'найдено: ' + needle));
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
