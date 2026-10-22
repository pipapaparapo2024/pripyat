/**
 * Test: батч 16.09.2026 —
 *  1) yashik.js — координаты прогресс-бара (полоса заполнения "N/50") сняты пользователем
 *     напрямую с PSD-слоя "полоса" (ящик.psd): X=448 Y=100 Ш=452 В=44 (было 440/98/680/56).
 *  2) universal_pos_editor.js — редактор позиций не мог "поймать" hover-кнопки Сидоровича
 *     (banka_activ.png, konserva_activ.png, sig_activ.png, yashik_activ.png, sumka_activ.png)
 *     — регексп искал только "актив"/"active", а реальные имена файлов используют транслит
 *     без конечной "e" ("activ"). Теперь регексп ловит и такой вариант.
 *
 * Run: node tests/yashik-bar-psd-and-editor-activ-regex.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const yashikSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'yashik.js'), 'utf-8');
const editorSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8');
const sidSrc    = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'sidorovich.js'), 'utf-8');

console.log('\nTest 1: yashik.js — координаты полосы прогресса по PSD (448/100/452/44)');
{
    // 26.09.2026: X/Y уточнены ещё раз редактором позиций под новый файл заливки
    // (448,100 → 449,99) — W/H (размер бара) не менялись.
    assert(/const BAR_X = 449, BAR_Y = 99, BAR_W = 452, BAR_H = 44;/.test(yashikSrc),
        'BAR_X/Y/W/H обновлены на значения из PSD-слоя "полоса"');
}

console.log('\nTest 2: universal_pos_editor.js — regex ловит файлы "_activ" (без конечной "e")');
{
    // 21.10.2026: regex ещё раз расширен (добавлена "глаза закрыты") — проверяем через
    // includes вместо точного литерала, чтобы не дублировать актуальный список альтернатив здесь.
    assert(/const re = \/актив\|activ\|[^/]*\/i;/.test(editorSrc), 'regex расширен минимум до /актив|activ|.../i (сохраняет обе исходные альтернативы)');
    // Симулируем реальную проверку на именах файлов Сидоровича
    const re = /актив|activ/i;
    for(const fname of ['banka_activ.png', 'konserva_activ.png', 'sig_activ.png', 'yashik_activ.png', 'sumka_activ.png']){
        assert(re.test(fname), `regex теперь матчит реальный файл "${fname}"`);
    }
}

console.log('\nTest 3: sidorovich.js действительно использует именно такие "_activ" имена (подтверждаем, что фикс закрывает реальный кейс)');
{
    // 17.10.2026 (замена сигарет на сухари): sig_activ.png → "сидорович сухари актив.png".
    // 18.10.2026 (тот же батч, новый раунд файлов — банка/консервы/сумка/посылка получили
    // отдельные idle+hover спрайты с новыми именами, см. докблок у bankaIdle в sidorovich.js):
    // banka_activ.png/konserva_activ.png/sumka_activ.png заменены на "сидорович банка
    // актив.png"/"сидорович консервы актив.png"/"сидорович сумка актив.png".
    // 18.10.2026 (повторное указание тем же днём — "yashik_activ.png убери из игры"):
    // hover-оверлей ящика на sidorovich.js убран целиком — больше НЕ ожидаем эту ссылку.
    // 18.10.2026 (ЕЩЁ раз тем же днём — "убери прозрачные отступы у всех файлов Сидоровича"):
    // все 4 файла переобрезаны по альфа-каналу и переименованы с суффиксом "v2" — см.
    // oct18-batch4-sidorovich-crop-energy-relocate-ryukzak-fixes.test.js для полной проверки.
    for(const fname of ['сидорович банка актив v2.png', 'сидорович консервы актив v2.png', 'сидорович сухари актив v2.png', 'сидорович сумка актив v2.png']){
        assert(sidSrc.includes(fname), `sidorovich.js реально ссылается на ${fname}`);
    }
    // Регекс ищет реальный ВЫЗОВ Texture.from(...), не голую подстроку — та легитимно
    // встречается в пояснительном комментарии чуть выше ("yashik_activ.png убери из игры").
    assert(!/Texture\.from\([^)]*yashik_activ\.png/.test(sidSrc), 'sidorovich.js БОЛЬШЕ не создаёт текстуру из yashik_activ.png (убран по прямому указанию)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
