/**
 * Test: редактор позиций не находил кнопки «купить актив.png»/«отмена актив.png» на
 * попапе «купить патрон для ящика» (yashik.js._openBuyPatronPopup) — клик всегда попадал
 * на полноэкранный фон вместо них. Причина: 500мс интервал-рескан не успевал среагировать
 * на попап, открытый прямо перед кликом. Фикс — синхронный rescan прямо в onDown, плюс
 * более надёжная проверка "актив"-текстур через textureCacheIds (resource.url не всегда
 * доступен для общего кэша текстур).
 *
 * Run: node tests/universal-pos-editor-buy-patron-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const src = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'universal_pos_editor.js'), 'utf-8'
);
const yashikSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'yashik.js'), 'utf-8'
);

console.log('\nTest 1: onDown синхронно пересканирует "актив"-спрайты перед хит-тестом');
{
    const m = src.match(/const onDown = \(e\) => \{([\s\S]*?)\n\s{8}\};/);
    assert(!!m, 'onDown найден');
    if (m) {
        const body = m[1];
        assert(/this\._uScanForceActive\(\);/.test(body),
            'вызывает _uScanForceActive() до _uFindTopmost — не полагается только на 500мс интервал');
        assert(body.indexOf('this._uScanForceActive();') < body.indexOf('this._uFindTopmost('),
            'rescan идёт ДО хит-теста (иначе свежесозданный попап всё равно не будет найден на этом клике)');
    }
}

console.log('\nTest 2: _looksLikeActiveState дублирует проверку через textureCacheIds');
{
    const m = src.match(/const _looksLikeActiveState = \(spr\) => \{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_looksLikeActiveState найден');
    if (m) {
        const body = m[1];
        // 16.09.2026: regex расширен до /актив|activ/i — реальные файлы Сидоровича используют
        // транслит без конечной "e" (banka_activ.png и т.п.), см.
        // tests/yashik-bar-psd-and-editor-activ-regex.test.js для полной проверки.
        assert(/const re = \/актив\|activ\/i;/.test(body), 'общий regex для обеих проверок (включает "activ" без "e")');
        assert(/re\.test\(url\)/.test(body), 'проверка через resource.url сохранена (когда доступен)');
        assert(/spr\.texture\.textureCacheIds/.test(body), 'запасная проверка через texture.textureCacheIds');
        assert(/spr\.texture\.baseTexture\.textureCacheIds/.test(body), 'запасная проверка через baseTexture.textureCacheIds');
    }
}

console.log('\nTest 3: yashik.js — купить/отмена-актив спрайты реально называются "...актив.png" (regex их поймает)');
{
    assert(/'купить актив\.png'/.test(yashikSrc), 'текстура "купить актив.png" на месте');
    assert(/'отмена актив\.png'/.test(yashikSrc), 'текстура "отмена актив.png" на месте');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
