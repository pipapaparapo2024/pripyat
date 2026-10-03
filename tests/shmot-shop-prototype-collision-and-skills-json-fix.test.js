/**
 * Test: батч 19.09.2026 — репорт с живого сайта (скриншот + консоль): "шмотки не выводятся,
 * они даже не покупаются", плюс отдельная консольная ошибка
 * "[skills._loadLevelsFromUdata] не удалось разобрать skills_levels: [object Object] is not
 * valid JSON". Разбор нашёл ТРИ независимых бага:
 *
 *  1) shell/overlays/shmot_shop.js (реальный, открываемый игроком экран "МАГАЗИН ОДЕЖДЫ" —
 *     open() всегда вызывает _openShmotShop()) определял СОБСТВЕННЫЕ proto._buy/_saveToUdata/
 *     _applyMaxEnergyBonus. attachShmotShop(Shmot.prototype) вызывается ПОСЛЕ определения
 *     класса Shmot — значит эти старые, чисто клиентские методы ЗАТИРАЛИ одноимённые
 *     server-authoritative методы из класса (см. shmot-server-authoritative-buy.test.js —
 *     тот батч был полностью мёртвым кодом в проде). Старый _buy() падал с
 *     "Cannot read properties of null (reading 'a')" на любом дроп-предмете (price:null,
 *     см. shmot-organized-catalog-and-sources.test.js) — это и есть строка "dvor-poker.js:91"
 *     из консоли (вебпак-бандл называет чанк по произвольному модулю внутри него, реальный
 *     источник — shmot_shop.js).
 *  2) 32 новых дроп-предмета (id41-72) были скопированы в КОРЕНЬ _client/development/images/,
 *     а код (home.js и shmot_shop.js: './images/shmot/' + item.imgFile) грузит их ИЗ
 *     images/shmot/ — той же папки, где реально лежат картинки старых 41 предметов на проде
 *     (проверено HEAD-запросом: images/shmot/голова_1.png = 200, images/голова_1.png = 404).
 *     Итог — все 32 новых предмета были 404 на живом сайте. Перенесены в images/shmot/,
 *     см. обновлённые shmot-organized-catalog-and-sources.test.js и shmot-assets-identified-batch2.test.js.
 *  3) skills.js._loadLevelsFromUdata()/_loadFromUdata() безусловно вызывали JSON.parse() на
 *     udata['skills_levels']/udata['skills_data'] — но Database::trueJSON() на сервере уже
 *     раскодирует JSON-похожие строковые поля в объект ДО отправки клиенту (см. CLAUDE.md),
 *     так что поле иногда приходит уже объектом, а не строкой, и JSON.parse(object) кидает
 *     ровно то исключение из консоли. Тот же класс бага уже был решён для zone.js —
 *     применён тот же паттерн (`typeof raw === 'string' ? JSON.parse(raw) : raw`).
 *
 * Run: node tests/shmot-shop-prototype-collision-and-skills-json-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const shmotSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shmot.js'), 'utf-8');
const shopSrc      = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), 'utf-8');
const homeSrc      = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'home.js'), 'utf-8');
const skillsSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'skills.js'), 'utf-8');

console.log('\nTest 1: shmot_shop.js больше НЕ определяет _buy/_saveToUdata/_applyMaxEnergyBonus (не затирает server-authoritative методы)');
{
    assert(!/proto\._buy\s*=\s*function/.test(shopSrc), 'proto._buy отсутствует в shmot_shop.js');
    assert(!/proto\._saveToUdata\s*=\s*function/.test(shopSrc), 'proto._saveToUdata отсутствует в shmot_shop.js');
    assert(!/proto\._applyMaxEnergyBonus\s*=\s*function/.test(shopSrc), 'proto._applyMaxEnergyBonus отсутствует в shmot_shop.js');
}

console.log('\nTest 2: _onShmotClick делегирует в единственную настоящую реализацию — _onWear (умеет honest-buy и дроп-предметы)');
{
    const m = shopSrc.match(/proto\._onShmotClick = function\(item\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_onShmotClick найден');
    assert(/this\._onWear\(item\.id\);/.test(m ? m[1] : ''), '_onShmotClick вызывает this._onWear(item.id), не дублирует buy/equip-логику');
}

console.log('\nTest 3: shmot.js._renderGrid защищён от отсутствующего this.win (мёртвый FLA-экран) и всегда обновляет реальный экран (_shopRefresh)');
{
    const m = shmotSrc.match(/\t_renderGrid\(cat\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, '_renderGrid найден');
    const body = m[1];
    assert(/if\(this\.win && this\.win\.item_grid\) this\._renderGridFla\(cat\);/.test(body),
        'обращение к this.win.item_grid защищено проверкой на существование (иначе TypeError, если FLA-экран не инициализирован)');
    assert(/if\(this\._shopWin && typeof this\._shopRefresh === 'function'\) this\._shopRefresh\(true\);/.test(body),
        '_renderGrid всегда дополнительно обновляет реальный экран игрока (shmot_shop.js)');
}

console.log('\nTest 4: shmot.js._renderMannequin аналогично защищён и обновляет манекен реального экрана (_updateManSprites)');
{
    const m = shmotSrc.match(/\t_renderMannequin\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, '_renderMannequin найден');
    const body = m[1];
    assert(/if\(this\.win && this\.win\.equip_slots\) this\._renderMannequinFla\(\);/.test(body),
        'обращение к this.win.equip_slots защищено проверкой на существование');
    assert(/if\(this\._manSlots && typeof this\._updateManSprites === 'function'\) this\._updateManSprites\(\);/.test(body),
        '_renderMannequin всегда дополнительно обновляет манекен реального экрана');
}

console.log('\nTest 5: _onWear синхронизирует персонажа главного экрана после надевания/снятия (home.updateClothes)');
{
    const m = shmotSrc.match(/_onWear\(itemId\)\{([\s\S]*?)\n\t\}/);
    assert(!!m, '_onWear найден');
    assert(/if\(window\.home\) home\.updateClothes\(\);/.test(m[1]),
        '_onWear вызывает home.updateClothes() после equip-toggle (раньше это делал только удалённый дубликат в shmot_shop.js)');
}

console.log('\nTest 6: home.js и shmot_shop.js согласованы по пути к картинкам предметов (images/shmot/, не корень images/)');
{
    assert(/'\.\/images\/shmot\/' \+ eq\.imgFile/.test(homeSrc), "home.js грузит './images/shmot/' + imgFile");
    assert(/'\.\/images\/shmot\/' \+ item\.imgFile/.test(shopSrc), "shmot_shop.js грузит './images/shmot/' + imgFile — тот же путь");
}

console.log('\nTest 7: skills.js — JSON.parse защищён от уже-раскодированного объекта (typeof-проверка), для skills_data И skills_levels');
{
    const loadMatch = skillsSrc.match(/_loadFromUdata\(\)\{([\s\S]*?)this\._loadLevelsFromUdata\(\);\n\t\}/);
    assert(!!loadMatch, '_loadFromUdata найден');
    assert(/const raw = udata\['skills_data'\];\s*\n\s*const s = typeof raw === 'string' \? JSON\.parse\(raw\) : raw;/.test(loadMatch[1]),
        '_loadFromUdata: skills_data парсится только если это строка, иначе используется как есть');

    const levelsMatch = skillsSrc.match(/_loadLevelsFromUdata\(\)\{([\s\S]*?)\n\t\}/);
    assert(!!levelsMatch, '_loadLevelsFromUdata найден');
    assert(/const raw = udata\['skills_levels'\];\s*\n\s*const s = typeof raw === 'string' \? JSON\.parse\(raw\) : raw;/.test(levelsMatch[1]),
        '_loadLevelsFromUdata: skills_levels парсится только если это строка, иначе используется как есть (фикс "[object Object] is not valid JSON")');
}

console.log('\nTest 8: рантайм-проверка — typeof-паттерн реально не падает ни на строке, ни на уже-объекте');
{
    const parseLike = (raw) => { const s = typeof raw === 'string' ? JSON.parse(raw) : raw; return s; };
    let threw = false;
    try {
        const fromString = parseLike('{"levels":[1,2,3]}');
        const fromObject = parseLike({levels:[1,2,3]});
        assert(fromString.levels[1] === 2 && fromObject.levels[1] === 2, 'оба пути (строка и объект) дают одинаковый результат');
    } catch(e) { threw = true; }
    assert(!threw, 'typeof-паттерн не бросает исключение ни на строке, ни на объекте');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
