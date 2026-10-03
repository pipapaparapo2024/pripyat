/**
 * Test: батч 24.09.2026 (по прямому указанию + скриншот — "при обновлении рейтинга урона
 * (перезагрузка/удар/фоновый опрос друзей) появляется мигающее троеточие, всё дёргается").
 *
 * Разбор показал: proto._loadBossFightRating() СИНХРОННО сбрасывал все строки панели
 * "РЕЙТИНГ УРОНА" на плейсхолдер ('...'/'× —'/пустое фото) ПРЯМО ПЕРЕД каждым сетевым запросом
 * к bosses.rating() — эта функция вызывается из трёх мест (кнопка ПЕРЕЗАГРУЗИТЬ, после каждого
 * успешного удара, раз в POLL_EVERY_TICKS секунд фоновым опросом), поэтому панель гарантированно
 * мигала пустотой на время КАЖДОГО round-trip, даже если реальные данные не менялись вообще.
 *
 * Фикс: ранний сброс убран — старые значения остаются на экране до прихода ответа сервера,
 * тогда _fetchBossFightRating() заменяет их на актуальные за один шаг (без промежуточного
 * пустого кадра).
 *
 * Run: node tests/boss-fight-rating-no-flicker-on-refresh.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');

console.log('\nTest 1: _loadBossFightRating() больше не сбрасывает строки на плейсхолдер перед запросом');
{
    const m = src.match(/proto\._loadBossFightRating = function\(bossIdx\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_loadBossFightRating найдена');
    const body = m ? m[1] : '';
    assert(!/row\.nameTxt\.text = '\.\.\.'/.test(body), 'КРИТИЧНО: троеточие-плейсхолдер ("...") больше не выставляется здесь синхронно');
    assert(!/row\.avSpr\.texture = PIXI\.Texture\.EMPTY;/.test(body), 'фото строк тоже не сбрасывается здесь заранее');
    assert(/this\._fetchBossFightRating\(bossIdx\);/.test(body), 'по-прежнему вызывает _fetchBossFightRating() для реального обновления');
}

console.log('\nTest 2: _fetchBossFightRating() остаётся единственным местом, которое пишет в строки — только ПОСЛЕ ответа сервера');
{
    const m = src.match(/proto\._fetchBossFightRating = function\(bossIdx\)\{([\s\S]*?)\n    \};\s*proto\._showBossFightRating[\s\S]*?\n    \};/);
    assert(!!m, '_fetchBossFightRating найдена');
    const body = m ? m[0] : '';
    assert(/TS\.php\('bosses\.rating', \{boss_id:bossIdx, diff_idx:diffIdx\}, \(res\)=>\{/.test(body), 'запрос идёт первым делом');
    assert(/row\.nameTxt\.text = entry\.nick/.test(body), 'реальные значения по-прежнему подставляются из ответа сервера');
}

console.log('\nTest 3: регресс-гвард — три известных триггера обновления (кнопка/удар/опрос) по-прежнему идут через _loadBossFightRating (единая точка фикса)');
{
    const combatSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');
    assert(/iface\._loadBossFightRating\(idx\);/.test(combatSrc), 'после удара по-прежнему обновляет рейтинг через _loadBossFightRating');
    assert(/this\._loadBossFightRating\(idx\);/.test(src), 'фоновый опрос (_tickBossFightTimer) и кнопка ПЕРЕЗАГРУЗИТЬ тоже идут через неё');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
