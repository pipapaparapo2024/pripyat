/**
 * Test: старый попап «РЕЗУЛЬТАТ» (FLA this.result, отдельный от «попап ошибка.png») убран
 * по прямому указанию пользователя — showResult() больше никогда его не показывает.
 *
 * НО: сразу после первой правки (замена на единый _showErrorSprite для ЛЮБОГО random_num)
 * пользователь репортнул новую проблему — успех/инфо-сообщения («Локация «Шлюз» куплена!»)
 * стали выглядеть как красная «ОШИБКА» с треугольником-восклицанием, что визуально неверно.
 * Промежуточный фикс (_showInfoSprite на «окно сообщения.png», scale 2.6) тоже отклонён —
 * выглядел как большой пустой бежевый блок. Финально, по прямому указанию: для успеха/инфо
 * (random_num=1) вообще НИЧЕГО не показывать визуально — просто вызвать onClose (на нём
 * завязана дальнейшая логика некоторых экранов).
 *
 * this.result / this.random_name НЕ удалены из конструктора — preloader.js использует их
 * напрямую (window.notify.result) для экрана ошибки загрузки ДО того, как игра вообще
 * поднялась (там root.layer2_mc может ещё не существовать) — это отдельный, легитимный
 * путь использования, не связанный с тем, что просил убрать пользователь.
 *
 * Run: node tests/notifications-unified-popup.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'notifications.js'), 'utf-8'
);
const preloaderSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'preloader.js'), 'utf-8'
);

console.log('\nTest 1: showResult() выбирает стиль по random_num — ни при каком не использует this.result');
{
    const m = src.match(/showResult\(data, random_num = 0, onClose = null\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, 'showResult найден');
    if (m) {
        const body = m[1];
        assert(/if\(random_num === 0\) this\._showErrorSprite\(data\['text'\] \|\| data, onClose\);/.test(body),
            'random_num=0 (ошибка) → _showErrorSprite');
        assert(/else this\._showInfoSprite\(data\['text'\] \|\| data, onClose\);/.test(body),
            'random_num=1 (успех/инфо) → _showInfoSprite, НЕ старый FLA-попап');
        assert(!/this\.result\.shadow_mc\.alpha = 0;/.test(body),
            'внутри showResult нет ветки, показывающей this.result (старый FLA-попап «Результат»)');
    }
}

console.log('\nTest 2: _showInfoSprite — успех/инфо вообще НЕ показывает попап (по прямому указанию)');
{
    const m = src.match(/_showInfoSprite\(text, onClose\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, '_showInfoSprite найден');
    if (m) {
        const body = m[1];
        assert(!/new PIXI\.(Container|Sprite|Text)/.test(body), 'не создаёт никакого визуального попапа');
        assert(!/root\.layer2_mc\.addChild/.test(body), 'ничего не добавляется на сцену');
        assert(/if\(onClose\) onClose\(\);/.test(body), 'onClose всё равно вызывается — на нём завязана логика некоторых экранов');
    }
}

console.log('\nTest 3: this.result/random_name НЕ удалены из конструктора — нужны preloader.js для boot-экрана ошибки');
{
    assert(/this\.result = result_window;/.test(src), 'this.result по-прежнему сохраняется в конструкторе');
    assert(/this\.random_name = \['Ошибка', 'Результат'\];/.test(src), 'random_name по-прежнему сохраняется');
    assert(/notify\.result\.shadow_mc\.alpha = 0;/.test(preloaderSrc),
        'preloader.js напрямую использует notify.result для экрана ошибки загрузки (легитимный отдельный путь)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
