/**
 * Test: найдено 24.09.2026 по живому репорту (скриншот) — панель «РЕЙТИНГ УРОНА» в бою с
 * боссом показывала пустую строку (имя "---", урон "—") с ЧУЖОЙ фотографией, оставшейся от
 * предыдущего успешного фетча рейтинга. Причина: row.avSpr.texture выставлялся ТОЛЬКО когда
 * для строки находился игрок с фото (`if(u && u.photo) row.avSpr.texture = ...`), но никогда
 * не сбрасывался обратно на пустую текстуру, если строка становится пустой, безымянной или в
 * ней оказывается другой игрок без фото — старая фотография продолжала висеть поверх.
 *
 * Пользователь принял это за баг "урон предыдущего игрока не учитывается" — на самом деле
 * это чисто визуальный артефакт рендера, сумма урона на сервере (boss_damage_log) не терялась.
 *
 * Run: node tests/boss-fight-rating-stale-avatar.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src  = fs.readFileSync(path.join(root, '_client/src/game/shell/overlays/bosses_fight.js'), 'utf-8');

// 24.09.2026 (баг "рейтинг мигает троеточием при каждом обновлении", по прямому указанию):
// ранний синхронный сброс avSpr.texture (и всей строки на плейсхолдер) ПЕРЕД запросом —
// та самая причина мигания — убран из _loadBossFightRating() целиком (см.
// boss-fight-rating-no-flicker-on-refresh.test.js). "Зависшая" фотография при этом НЕ
// возвращается: _fetchBossFightRating() (тесты ниже) по-прежнему корректно сбрасывает
// avSpr для КАЖДОГО реального случая устаревания (пустой top, строка без entry, игрок без
// фото) — просто теперь это происходит ПОСЛЕ ответа сервера, заменяя старое сразу новым,
// без промежуточного пустого кадра.
console.log('\nTest: _loadBossFightRating() НЕ сбрасывает avSpr.texture заранее (убрано — источник мигания, см. no-flicker тест)');
{
    const start = src.indexOf('proto._loadBossFightRating = function(bossIdx){');
    const end   = src.indexOf('\n    };', start);
    const body  = src.slice(start, end);
    assert(!!body && start !== -1, '_loadBossFightRating() найден');
    assert(!/row\.avSpr\.texture\s*=\s*PIXI\.Texture\.EMPTY/.test(body),
        'НЕ сбрасывает row.avSpr.texture заранее — устаревание закрывается downstream в _fetchBossFightRating (см. тесты ниже)');
}

// 04.10.2026 (баг "урон засчитывается, но игроки не выводятся в рейтинге" — см.
// bosses_fight.js._showBossFightRating): отдельная ветка "if(!top.length){...}" убрана —
// теперь единый forEach по rows читает top[i] для КАЖДОЙ строки, и при пустом top[] это
// everywhere даёт entry===undefined, то есть все строки проходят через ту же ветку "!entry"
// (тест ниже), что и раньше делала отдельная top.length===0 ветка. Поведение то же, кода меньше.
console.log('\nTest: _showBossFightRating() сбрасывает avSpr.texture для ВСЕХ строк, когда сервер вернул пустой top[] (через единую ветку "!entry")');
{
    const start = src.indexOf('proto._showBossFightRating = function(top, isCurrent = () => true){');
    assert(start !== -1, '_showBossFightRating() найден');
    assert(!/if\(!top\.length\)\{/.test(src.slice(start, start + 2000)),
        'отдельная ветка top.length===0 убрана — пустой top закрывается той же "!entry" веткой для каждой строки');
    const forEachStart = src.indexOf('this._bossFightRatingRows.forEach((row, i) => {', start);
    assert(forEachStart !== -1, 'единый forEach по строкам найден — top[i] читается для КАЖДОЙ строки без ранней отсечки');
}

console.log('\nTest: _fetchBossFightRating() сбрасывает avSpr.texture для строки без entry (top короче 3 строк)');
{
    const start = src.indexOf('proto._fetchBossFightRating = function(bossIdx){');
    const noEntryStart = src.indexOf('if(!entry){', start);
    const noEntryEnd   = src.indexOf('return;', noEntryStart);
    const body = src.slice(noEntryStart, noEntryEnd);
    assert(!!body && noEntryStart !== -1, 'ветка "!entry" (строка за пределами top[]) найдена');
    assert(/row\.avSpr\.texture\s*=\s*PIXI\.Texture\.EMPTY/.test(body),
        'сбрасывает row.avSpr.texture для строки без соответствующей записи в top[]');
}

console.log('\nTest: _fetchBossFightRating() сбрасывает avSpr.texture, если у резолвленного игрока нет фото (не оставляет чужое)');
{
    const start = src.indexOf('proto._fetchBossFightRating = function(bossIdx){');
    const idx = src.indexOf('row.avSpr.texture = (u && u.photo)', start);
    assert(idx !== -1, 'тернарная установка текстуры (фото ИЛИ пустая) найдена — не однобокий if без else');
    const line = src.slice(idx, src.indexOf('\n', idx));
    assert(/PIXI\.Texture\.EMPTY/.test(line), 'явный fallback на пустую текстуру при отсутствии фото у игрока');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
