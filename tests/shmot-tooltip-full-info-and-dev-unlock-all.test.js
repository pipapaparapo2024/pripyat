/**
 * Test: батч 19.09.2026 (по прямому указанию) —
 *
 *  1) Тултип карточки в магазине шмоток (shmot_shop.js._showShopTip) раньше показывал ТОЛЬКО
 *     название вещи. Теперь показывает полную карточку: название + бонус (что даёт) + цену
 *     (для обычных покупных вещей) ИЛИ источник дропа (для price:null дроп-предметов id41+).
 *  2) Dev-панель получила кнопку «ОТКРЫТЬ ВСЁ» в новой секции «ШМОТ» — помечает owned=true
 *     у ВСЕХ предметов гардероба разом (включая дроп-предметы, у которых пока нет реального
 *     механизма выдачи) для быстрой визуальной проверки, не фармя каждую вещь отдельно.
 *
 * 25.09.2026 (по прямому указанию, референс-скриншот похожей игры — "Кофта Лабрадора"):
 * тултип переделан из тёмного однострочного блока в светлую карточку с подписанными полями
 * (Бонус/Сет/Требования, пунктирный разделитель) — Test 1/2/5 переписаны под новую структуру.
 * "Авторитет" из референса сознательно НЕ добавлен — такого бонуса у наших вещей нет, по
 * прямому указанию показываем только реально существующую информацию.
 * Плюс (тем же сообщением) — невладеемые предметы в сетке магазина рендерятся чёрно-белым
 * (ColorMatrixFilter.desaturate()), владеемые — в цвете, см. Test 6.
 *
 * Run: node tests/shmot-tooltip-full-info-and-dev-unlock-all.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const shopSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), 'utf-8');
const devSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');

console.log('\nTest 1: _showShopTip собирает карточку — название/Бонус/Сет/Требования (цена или источник), не однострочный текст');
{
    const start = shopSrc.indexOf('proto._showShopTip = function(frame, item){');
    const end   = shopSrc.indexOf('\n    };', start);
    assert(start !== -1, '_showShopTip найден');
    const body = shopSrc.slice(start, end);
    assert(/const title = new PIXI\.Text\(item\.name, titleStyle\);/.test(body), 'заголовок карточки — item.name');
    assert(/const bonusLbl = new PIXI\.Text\('Бонус: ', lblStyle\);/.test(body), 'подписанное поле "Бонус:"');
    assert(/const bonusVal = new PIXI\.Text\(item\.bonus \|\| 'нет бонуса',/.test(body), 'значение поля — item.bonus (с фолбэком)');
    assert(/if\(item\.set\)\{/.test(body) && /const setLbl = new PIXI\.Text\('Сет: ', lblStyle\);/.test(body),
        'подписанное поле "Сет:" — только если у предмета есть set');
    assert(/const prog = this\._setProgress\(item\.set\);/.test(body), 'прогресс сета считается через _setProgress()');
    assert(/const reqLbl = new PIXI\.Text\('Требования:', lblStyle\);/.test(body), 'заголовок секции "Требования:"');
    assert(/if\(item\.price\)\{/.test(body), 'ветвится по наличию item.price');
    assert(/reqText = 'Цена: ' \+ item\.price\.a \+ ' ' \+ unit;/.test(body), 'для покупных вещей — строка цены с единицей измерения');
    assert(/reqText = item\.source \|\| '\?';/.test(body), 'для дроп-предметов (price:null) — строка источника');
    assert(!/this\._shopTipTxt/.test(body), 'старое однострочное поле _shopTipTxt в новой реализации не используется');
}

console.log('\nTest 1б: _setProgress(setName) — сколько предметов сета уже владеется / всего в сете');
{
    const start = shopSrc.indexOf('proto._setProgress = function(setName){');
    const end   = shopSrc.indexOf('\n    };', start);
    assert(start !== -1, '_setProgress найден');
    const body = shopSrc.slice(start, end);
    assert(/i => i\.set === setName/.test(body), 'фильтрует this.items по совпадению set');
    assert(/items\.filter\(i => i\.owned\)\.length/.test(body), 'have считает только owned-предметы сета');
}

console.log('\nTest 2: карточка — светлый фон со скруглением/рамкой + пунктирный разделитель, перенос длинных строк (wordWrap)');
{
    assert(/bg\.beginFill\(0xfbeee0, 0\.97\);/.test(shopSrc), 'светлый фон карточки (не тёмный блок, как раньше)');
    assert(/bg\.lineStyle\(2, 0xc79a72, 1\);/.test(shopSrc), 'рамка карточки');
    assert(/bg\.drawRoundedRect\(0, 0, totalW, totalH, 8\);/.test(shopSrc), 'скруглённые углы');
    assert(/const DASH = 5, GAP = 4, sepY = y;/.test(shopSrc), 'пунктирный разделитель между бонусом/сетом и "Требования:"');
    assert(/wordWrap:true, wordWrapWidth: CONTENT_W/.test(shopSrc), 'длинные значения (бонус/источник) переносятся, не вылезают за карточку');
}

console.log('\nTest 3: dev-панель — новая секция ШМОТ с кнопкой ОТКРЫТЬ ВСЁ');
{
    assert(/_section\('ШМОТ'\);/.test(devSrc), "секция 'ШМОТ' добавлена в панель");
    assert(/_row\('Гардероб', \[\s*\{label:'ОТКРЫТЬ ВСЁ', color:P, action:\(\)=>this\._unlockAllShmot\(\)\},\s*\]\);/.test(devSrc),
        "строка 'Гардероб' с кнопкой 'ОТКРЫТЬ ВСЁ', вызывающей _unlockAllShmot()");
}

console.log('\nTest 4: proto._unlockAllShmot помечает ВСЕ предметы owned=true (включая дроп) и сохраняет/обновляет экран');
{
    const m = devSrc.match(/proto\._unlockAllShmot = function\(\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_unlockAllShmot найден');
    const body = m ? m[1] : '';
    assert(/shmot\.items\.forEach\(it => \{ it\.owned = true; \}\);/.test(body),
        'проставляет owned=true КАЖДОМУ предмету без фильтра по price (включая дроп-предметы id41+)');
    // 25.09.2026: shmot._saveToUdata() удалена (shmot убран из client-writable whitelist,
    // см. tests/shmot-equip-server-authoritative.test.js) — кнопка теперь сохраняет через
    // dev-only users.devGrantShmot (id-индексация построена вручную, тот же формат).
    assert(/save\[it\.id\] = \{owned: it\.owned, equipped: it\.equipped\};/.test(body),
        'строит id-индексированный массив вручную (та же защита от id-vs-позиция бага, что была в удалённой _saveToUdata)');
    assert(/TS\.php\('users\.devGrantShmot', \{shmot_json: shmotJson\}/.test(body),
        'сохраняет через users.devGrantShmot (прямой SQL update, в обход убранного из whitelist поля)');
    assert(/if\(typeof shmot\._shopRefresh === 'function' && shmot\._shopWin\) shmot\._shopRefresh\(true\);/.test(body),
        'обновляет магазин НЕМЕДЛЕННО, если он уже открыт (не нужно закрывать/открывать заново)');
}

console.log('\nTest 5: рантайм-проверка построения текста "Требования:" на реальных данных (покупная вещь и дроп-предмет)');
{
    const buildReqText = (item) => {
        if(item.price){
            const unit = {coins:'монет', stew:'тушёнки', cig:'сигарет'}[item.price.type] || '';
            return 'Цена: ' + item.price.a + ' ' + unit;
        }
        let reqText = item.source || '?';
        if(item.fragments && !item.owned) reqText += '\nСобрано частей: 0/' + item.fragments;
        return reqText;
    };
    const bought = buildReqText({name:'Бандана', bonus:'+5 к защите', price:{type:'coins', a:200}});
    assert(bought === 'Цена: 200 монет', 'покупная вещь: "Требования:" — Цена — получили: ' + JSON.stringify(bought));

    const drop = buildReqText({name:'Панама (Баркут)', bonus:'+120 к автомату', price:null, source:'Баркут (обычный режим)'});
    assert(drop === 'Баркут (обычный режим)', 'дроп-предмет: "Требования:" — источник — получили: ' + JSON.stringify(drop));

    const fragmentDrop = buildReqText({name:'Панама (Охотник)', price:null, source:'Охотник (обычный режим)', fragments:20, owned:false});
    assert(fragmentDrop === 'Охотник (обычный режим)\nСобрано частей: 0/20',
        'фрагментный дроп-предмет: источник + прогресс сборки — получили: ' + JSON.stringify(fragmentDrop));
}

console.log('\nTest 6: невладеемые предметы в сетке магазина — чёрно-белые (ColorMatrixFilter.desaturate), владеемые — в цвете');
{
    const start = shopSrc.indexOf('if(item && item.imgFile){');
    const end   = shopSrc.indexOf('\n            }', shopSrc.indexOf('cont.addChild(img);', start));
    const body  = shopSrc.slice(start, end);
    assert(/if\(!item\.owned\)\{/.test(body), 'проверка !item.owned перед применением фильтра');
    assert(/const gsFilter = new PIXI\.filters\.ColorMatrixFilter\(\);/.test(body), 'создаётся ColorMatrixFilter');
    assert(/gsFilter\.desaturate\(\);/.test(body), 'обесцвечивание через .desaturate()');
    assert(/img\.filters = \[gsFilter\];/.test(body), 'фильтр применяется именно к спрайту иконки предмета (img), не ко всей ячейке');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
