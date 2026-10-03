/**
 * Test: батч 25.09.2026 (по прямому указанию + скриншот) — "при наведении на кнопку КУПИТЬ
 * (хата, покупка локации) появляется какой-то непонятный файл, должно быть обычное затемнение
 * кнопки, как везде (например ОТМЕНА/выход и т.п.)".
 *
 * Корень: hover показывал отдельный файл-оверлей «купить актив.png», растянутый под размер
 * кнопки (.width=132 .height=24) — визуально прямоугольный блок, не похожий на саму кнопку.
 * Убран целиком — теперь как у btnSelP (соседняя кнопка того же попапа) — просто alpha-
 * затемнение самой кнопки через общий хелпер _sa().
 *
 * Run: node tests/hata-buy-button-standard-hover-theme.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const hataSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), 'utf-8'
);

console.log('\nTest 1: файл-оверлей «купить актив.png» убран из hata.js целиком');
{
    // Строка остаётся в объясняющем комментарии у фикса (история "что было") — проверяем
    // отсутствие именно КОДА (создание текстуры/спрайта), а не строки во всём файле.
    assert(!/PIXI\.Texture\.from\(IMG \+ 'купить актив\.png'\)/.test(hataSrc), 'КРИТИЧНО: текстура «купить актив.png» больше не создаётся кодом');
    assert(!/_buyHover/.test(hataSrc), 'все ссылки на _buyHover (поле конструктора/создание/сброс) убраны');
}

console.log('\nTest 2: кнопка КУПИТЬ использует ту же тему hover, что и остальные кнопки попапа (alpha через _sa)');
{
    const s = hataSrc.indexOf('btnBuy.on(\'pointerover\'');
    const e = hataSrc.indexOf('this._btnBuy = btnBuy;');
    const body = hataSrc.slice(s, e);
    // 29.09.2026 (по прямому указанию — "для всех кнопок небольшой hover эффект увеличения
    // scale"): к alpha-затемнению добавлен scale.set(1.08)/scale.set(1) — тот же приём
    // применён единообразно ко ВСЕМ кнопкам этого попапа (btnBuy/btnSelP/leftSpr/rightSpr),
    // так что btnBuy по-прежнему использует ТУ ЖЕ тему, что и остальные — просто теперь у
    // темы два эффекта (alpha+scale) вместо одного.
    assert(/btnBuy\.on\('pointerover',\s*\(\)=>\{ _sa\(btnBuy, 0\.75\); btnBuy\.scale\.set\(1\.08\); \}\);/.test(body),
        'pointerover затемняет и слегка увеличивает саму кнопку (_sa+scale), без сторонних файлов');
    assert(/btnBuy\.on\('pointerout',\s*\(\)=>\{ _sa\(btnBuy, 1\); btnBuy\.scale\.set\(1\); \}\);/.test(body),
        'pointerout возвращает полную непрозрачность и исходный масштаб той же кнопки');
}

console.log('\nTest 3: регресс-гвард — соседняя кнопка ВЫБРАТЬ (btnSelP) использует ту же тему (alpha+scale), что и КУПИТЬ');
{
    assert(/btnSelP\.on\('pointerover', \(\)=>\{ _sa\(btnSelP, 0\.75\); btnSelP\.scale\.set\(1\.08\); \}\);/.test(hataSrc),
        'sanity: btnSelP — эталон темы, на который равнялся фикс КУПИТЬ, получил тот же hover-scale тем же батчем 29.09.2026');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
