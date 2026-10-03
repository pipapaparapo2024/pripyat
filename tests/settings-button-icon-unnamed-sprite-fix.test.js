/**
 * Test: 04.10.2026, найдено по прямому указанию — "кнопка иконка настроек никак не хочет
 * принимать эти характеристики (в прошлом промпте я просил опустить её на 2px вниз), что не
 * так?" — редактор позиций продолжал сообщать базовые координаты (x:1237 y:23) даже после уже
 * применённого 03.10.2026 нуджа `this.up.butt_settings.y += 2;`.
 *
 * Корень: в interface_elements.min.js для кнопки настроек создаются ДВА отдельных объекта в
 * одном месте конструктора Up_panel:
 *   1. `_bst` — РЕАЛЬНО ВИДИМЫЙ спрайт (PIXI.Texture.from("images/butt_settings.png"),
 *      x=1237, y=23), который игрок физически видит на экране.
 *   2. `f` (экспортируется как `this.up.butt_settings`) — ОТДЕЛЬНЫЙ невидимый хитбокс
 *      (прозрачная Graphics-заглушка 35×35, alpha≈0.01), используемый ТОЛЬКО для
 *      interactive/pointerdown — он и правда стоит на x=1237,y=23 тоже, но это другой объект.
 *
 * `_bst` НИКОГДА не получал `.name` и не экспортировался на `this` — значит код вне этого
 * конструктора (interface-panels.js, редактор позиций) физически не мог его найти и подвинуть.
 * `this.up.butt_settings.y += 2;` сдвигал ТОЛЬКО хитбокс `f` — клик-зона смещалась на 2px вниз
 * (невидимо для игрока), а реальная картинка `_bst` оставалась на месте. Редактор позиций,
 * судя по всему, визуально идентифицирует ИМЕННО видимый пиксель (т.е. `_bst`), поэтому после
 * правки продолжал сообщать немзменённые x:1237 y:23.
 *
 * Фикс: `_bst` теперь тоже получает имя (`this[_bst.name="butt_settings_icon"]=_bst;` — сразу
 * после уже существующей строки, что экспортирует `f` как `butt_settings`) — после этого
 * `_client/src/*.js` может его найти и подвинуть (двигаем хитбокс и иконку ВМЕСТЕ, одним и тем
 * же нуджем, чтобы клик-зона не разъехалась с картинкой).
 *
 * Run: node tests/settings-button-icon-unnamed-sprite-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const libSrc = fs.readFileSync(path.join(root, '_client', 'development', 'libs', 'interface_elements.min.js'), 'utf-8');
const panelsSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'interface', 'interface-panels.js'), 'utf-8');

console.log('\nTest 1: interface_elements.min.js — видимый спрайт _bst теперь экспортируется с именем сразу после хитбокса butt_settings');
{
    const idx = libSrc.indexOf('this[f.name="butt_settings"]=f;');
    assert(idx !== -1, 'строка, экспортирующая хитбокс f как butt_settings, найдена (якорь для поиска правки рядом)');
    const after = libSrc.slice(idx, idx + 200);
    assert(/if\(_bst\)this\[_bst\.name="butt_settings_icon"\]=_bst;/.test(after),
        '_bst (реальный видимый спрайт иконки) экспортируется сразу следом как butt_settings_icon');
}

console.log('\nTest 2: interface_elements.min.js — регресс-гвард, _bst по-прежнему создаётся на базовой позиции (1237,23) из images/butt_settings.png');
{
    assert(/_bst=new s\(_bstTex\);_bst\.x=1237;_bst\.y=23;/.test(libSrc),
        '_bst по-прежнему создаётся на (1237,23) — позиционную логику самого спрайта не трогали, только экспорт имени');
}

console.log('\nTest 3: interface-panels.js — нудж применяется к ОБОИМ объектам (хитбоксу и видимой иконке), не только к хитбоксу');
{
    const start = panelsSrc.indexOf('if(this.up.butt_settings){');
    const end   = panelsSrc.indexOf('\n        }', start);
    const body  = panelsSrc.slice(start, end);

    assert(/this\.up\.butt_settings\.y \+= 2;/.test(body), 'хитбокс (butt_settings) по-прежнему сдвигается на 2px — клик-зона остаётся актуальной');
    assert(/if\(this\.up\.butt_settings_icon\) this\.up\.butt_settings_icon\.y \+= 2;/.test(body),
        'КРИТИЧНО (сам фикс): видимая иконка (butt_settings_icon) теперь ТОЖЕ сдвигается на 2px — именно её раньше не трогали');
}

console.log('\nTest 4: регресс-гвард — defensive-проверка существования объекта перед сдвигом (на случай если PIXI.Texture.from когда-нибудь вернёт EMPTY и _bst окажется null)');
{
    assert(/if\(this\.up\.butt_settings_icon\)/.test(panelsSrc),
        'сдвиг иконки обёрнут проверкой на существование — защита от TypeError, если _bst не создался (см. guard `if(m&&m!==PIXI.Texture.EMPTY)` в interface_elements.min.js)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
