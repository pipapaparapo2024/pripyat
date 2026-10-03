/**
 * Test: батч 19.09.2026 — репорт "при наведении на шмотку видно только название, бонус
 * (что даёт вещь) не показывается вообще". Код (_renderGrid) уже присваивает
 * card.bonus_txt.text = item.bonus ТОЧНО ТАК ЖЕ, как card.name_txt.text = item.name (обе
 * строки рядом) — а name_txt на экране виден, bonus_txt нет. Раз это не ошибка присвоения
 * текста, добавлена одноразовая диагностика реального состояния bonus_txt (видимость/альфа/
 * позиция/родитель) в консоль — чтобы понять, теряется ли текст из-за FLA-вёрстки карточки
 * (за пределами экрана / alpha=0 / не в дереве), а не гадать вслепую и не трогать FLA
 * (Правило №2 CLAUDE.md — без явного указания).
 *
 * Run: node tests/shmot-bonus-txt-diagnostic-log.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const shmotSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shmot.js'), 'utf-8'
);

console.log('\nTest 1: bonus_txt.text по-прежнему выставляется (данные в коде корректны — не источник бага)');
{
    assert(/card\.name_txt\.text\s*=\s*item\.name;/.test(shmotSrc), 'name_txt.text выставляется из item.name');
    assert(/card\.bonus_txt\.text\s*=\s*item\.bonus;/.test(shmotSrc), 'bonus_txt.text выставляется из item.bonus (та же схема)');
}

console.log('\nTest 2: диагностический лог состояния bonus_txt добавлен и срабатывает только один раз за сессию');
{
    assert(/if\(i === 0 && !this\._bonusTxtDebugLogged\)\{/.test(shmotSrc), 'диагностика гейтится флагом _bonusTxtDebugLogged (не спамит консоль на каждый рендер)');
    assert(/this\._bonusTxtDebugLogged = true;/.test(shmotSrc), 'флаг выставляется сразу после первого срабатывания');
    assert(/\[shmot\._renderGrid\] ДИАГНОСТИКА bonus_txt/.test(shmotSrc), 'лог промаркирован по конвенции проекта [Файл.функция]');
    assert(/visible=', card\.bonus_txt\.visible/.test(shmotSrc), 'логируется visible');
    assert(/alpha=', card\.bonus_txt\.alpha/.test(shmotSrc), 'логируется alpha');
    assert(/x=', card\.bonus_txt\.x, 'y=', card\.bonus_txt\.y/.test(shmotSrc), 'логируются x/y');
    assert(/parent===card\?', card\.bonus_txt\.parent === card/.test(shmotSrc), 'логируется, действительно ли bonus_txt всё ещё дочерний элемент card');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
