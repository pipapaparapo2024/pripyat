/**
 * Test: пачка правок экрана ящика (yashik.js) по прямым замерам пользователя через
 * редактор позиций + одна логическая правка сообщения об ошибке.
 *
 * 1) Кнопка «ОБЫСКАТЬ» и кнопка «покупка патрона» — сдвинуты на измеренные пользователем
 *    координаты (obyskat.y 512→499; buyPatronBtn зафиксирован на x:1243,y:90 вместо
 *    прежнего динамического расчёта от exitBtn, который давал чуть другую позицию).
 * 2) «Квадратики прогресса» (10 сегментов рядом с ОБЫСКАТЬ, y=515) визуально пересекали
 *    саму кнопку «ОБЫСКАТЬ» полосой — убраны полностью (дублировали уже существующий
 *    прогресс-бар с текстом "N/50" выше).
 * 3) Сообщение «нет патрона» при попытке открыть ящик без патронов и без достаточного
 *    ach_score раньше показывалось через _showRewardPopup (обычный текстовый попап без
 *    стиля ошибки) — заменено на _openSidorovichError (жёлто-красный стиль «ОШИБКА»,
 *    как везде в игре), плюс явно упомянут патрон в тексте. Плюс: _openSidorovichError
 *    вызывает iface.restoreHud(), из-за чего на экране ящика (который сам скрывает
 *    нижний HUD) HUD снова появлялся — сразу после вызова HUD принудительно скрывается
 *    обратно.
 *
 * Run: node tests/yashik-fixes.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'yashik.js'), 'utf-8'
);

console.log('\nTest 1: obyskat и buyPatronBtn — точные измеренные координаты');
{
    assert(/obyskat\.x = 674;\s*\n\s*obyskat\.y = 499;/.test(src), 'obyskat.y поднят на y=499 (было 512)');
    assert(/buyPatronBtn\.x = 1243; buyPatronBtn\.y = 90;/.test(src),
        'buyPatronBtn — фиксированные координаты (1243,90) вместо динамического расчёта от exitBtn');
    assert(!/_placeBuyPatron/.test(src), 'старая функция динамического позиционирования buyPatronBtn удалена целиком');
}

console.log('\nTest 2: "квадратики прогресса" убраны полностью (визуально пересекали кнопку ОБЫСКАТЬ)');
{
    assert(!/progressSq/.test(src), 'progressSq (Graphics, this._yashikProgressSq, блок отрисовки 10 квадратиков) больше нигде не упоминается');
}

// 18.09.2026, перенос экономики на сервер: проверка "хватает ли патрона/очков достижений"
// переехала в yashik.php.openBox() (fail(70)) — клиент больше не решает это сам, только
// показывает ошибку сервера в error-колбэке TS.php('yashik.openBox', ...).
console.log('\nTest 3: сообщение о нехватке патрона — стиль ОШИБКА, упоминает патрон, не оставляет нижний HUD видимым');
{
    const start = src.indexOf("TS.php('yashik.openBox', {}");
    const end   = src.indexOf('});', start) + 3;
    const body  = src.slice(start, end);
    assert(start !== -1, 'obyskat зовёт yashik.openBox() — проверка нехватки патрона теперь на сервере');
    assert(/this\._openSidorovichError\(undefined,/.test(body),
        'использует _openSidorovichError (единый стиль «ОШИБКА»), не обычный текстовый reward-попап');
    assert(/Нужен патрон для ящика/.test(body), 'текст явно упоминает патрон, а не только очки достижений');
    // 24.09.2026 (декларативный ХУД): ручное скрытие после _openSidorovichError больше не
    // нужно — пока экран Ящика открыт, его 'yashik' запись на стеке (pushHud) переживает ЛЮБОЙ
    // сторонний restoreHud(), в т.ч. вызванный изнутри _openSidorovichError. См.
    // declarative-hud-refactor.test.js.
    assert(!/if\(this\.down\) this\.down\.visible = false;/.test(body),
        'старое ручное скрытие нижнего HUD после _openSidorovichError убрано — декларативный стек сам переживает сторонний restoreHud()');
    assert(!/this\._showRewardPopup\(\['Нужно еще/.test(src), 'старый вызов через _showRewardPopup с текстом про очки достижений убран');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
