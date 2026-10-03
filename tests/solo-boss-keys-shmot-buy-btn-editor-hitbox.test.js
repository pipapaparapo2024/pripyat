/**
 * Test: батч 19.09.2026 (по прямому указанию) —
 *
 *  1) "в соло-режиме боя с боссом не даются ключи" — bosses.php.claimKill() выдавал ключи
 *     только при `diffIdx < 2`. Реально играбельны только diffIdx 0 (обычный) и 3 (соло) —
 *     опасный/суровый (1/2) заблокированы на клиенте (active:false, bosses_prefight.js), так
 *     что условие "diffIdx < 2" на практике означало "только обычный", соло никогда не давало
 *     ключей. Исправлено на явный список (0 или 3).
 *  2) "в магазине шмоток убери кнопку купить [для недоступных вещей]" — дроп-предметы
 *     (item.price === null, выпадают с боссов/казино/тайника, см. shmot.js) не продаются за
 *     валюту вообще; кнопка "купить" на НЕ ВЛАДЕЕМЫХ дроп-вещах была декоративной ловушкой
 *     (клик лишь показывал "не продаётся", ничего не покупал). Теперь для таких предметов
 *     кнопки нет совсем — владеемые по-прежнему получают надеть/надето как раньше.
 *  3) "хитбокс кнопки не совпадает с картинкой (клик по «купить» жмёт «отмена»)" — редактор
 *     позиций видел только Sprite/Text, невидимые хит-зоны кнопок (interactive Graphics
 *     с почти нулевым alpha, стандартный паттерн проекта) нельзя было выбрать/подвинуть.
 *     Теперь такие маленькие (не blocker-размера) Graphics-хитбоксы тоже ловятся хит-тестом
 *     редактора — можно перетащить/растянуть их так же, как любой спрайт.
 *  4) Позиция/поворот счётчика красных поинтов зариков — снято пользователем через редактор.
 *  5) Таймер "БЕСПЛАТНЫЙ БРОСОК ЧЕРЕЗ..." — позиция снята через редактор (x не менялся,
 *     y=461→468), цвет сделан белым в обоих состояниях (было зелёный "доступно"/серый "ждать").
 *
 * Run: node tests/solo-boss-keys-shmot-buy-btn-editor-hitbox.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const bossesPhp   = readSrc('server/core/controllers/bosses.php');
const shmotShopJs = readSrc('_client/src/game/shell/overlays/shmot_shop.js');
const editorJs    = readSrc('_client/src/game/shell/overlays/universal_pos_editor.js');
const diceScreenJs= readSrc('_client/src/game/dvor/dvor-dice-screen.js');
const prefightJs  = readSrc('_client/src/game/shell/overlays/bosses_prefight.js');

console.log('\nTest 1: bosses_prefight.js — sanity: реально играбельны только обычный (0) и соло (3)');
{
    const m = prefightJs.match(/const MODES_CFG = \[([\s\S]*?)\];/);
    assert(!!m, 'MODES_CFG найден');
    const body = m ? m[1] : '';
    assert(/di:0, active:true/.test(body), 'обычный (0) — активен');
    assert(/di:1, active:false/.test(body), 'опасный (1) — заблокирован (иначе тест 2 ниже не имел бы смысла)');
    assert(/di:2, active:false/.test(body), 'суровый (2) — заблокирован');
    assert(/di:3, active:true/.test(body), 'соло (3) — активен');
}

console.log('\nTest 2: bosses.php.claimKill() — ключи выдаются в обычном (0) И в соло (3), не только "diffIdx < 2"');
{
    const start = bossesPhp.indexOf('function claimKill(){');
    const end   = bossesPhp.indexOf('\n        }', bossesPhp.indexOf('$this->ops->ok(', start));
    const body  = bossesPhp.slice(start, end);

    assert(!/\$diffIdx < 2 && !empty\(\$bossCfg\['gives_keys'\]\)/.test(body),
        'старое условие "diffIdx < 2" (на практике исключавшее СОЛО — единственный второй играбельный режим) убрано');
    assert(/if\(\(\$diffIdx === 0 \|\| \$diffIdx === 3\) && !empty\(\$bossCfg\['gives_keys'\]\)\)\{/.test(body),
        'новое условие явно перечисляет оба реально играбельных режима (0 обычный, 3 соло)');
}

console.log('\nTest 3: shmot_shop.js — кнопка "купить" не рисуется для НЕ владеемых дроп-предметов (price===null)');
{
    const start = shmotShopJs.indexOf('proto._shopRefresh = function');
    const end   = shmotShopJs.indexOf('\n    };', start);
    const body  = shmotShopJs.slice(start, end);

    // 28.09.2026 (пересмотр той же правки тем же днём): "Связка ключей" (id:100) перестала быть
    // псевдо-предметом и стала обычной экипируемой вещью (равно как и другие — см.
    // tests/shmot-keyring-shown-as-item.test.js, обновлено) — исключение item.id!==100 убрано,
    // кнопка купить/надеть/надето теперь рисуется для неё так же, как для любой другой вещи.
    assert(/if\(item && \(item\.owned \|\| item\.price\)\)\{/.test(body),
        'кнопка состояния рисуется только если предмет владеемый ИЛИ у него есть цена (можно купить) — без исключений по id');
    assert(/const stateFile = !item\.owned \? 'купить\.png' : \(item\.equipped \? 'надето\.png' : 'надеть\.png'\);/.test(body),
        'логика выбора файла (купить/надеть/надето) для владеемых/покупаемых предметов не тронута');
}

console.log('\nTest 4: universal_pos_editor.js — редактор теперь ловит невидимые Graphics-хитбоксы кнопок');
{
    assert(/const _looksLikeHitbox = \(child\) => child instanceof PIXI\.Graphics/.test(editorJs),
        '_looksLikeHitbox определён — распознаёт interactive Graphics без собственных детей');
    assert(/child\.interactive === true\s*\n\s*&& !\(child\.children && child\.children\.length\);/.test(editorJs),
        'критерий — interactive=true и нет вложенных детей (типичный паттерн хитбокса кнопки)');
    const start = editorJs.indexOf('proto._uCollectAt = function');
    const end   = editorJs.indexOf('\n    };', start);
    const body  = editorJs.slice(start, end);
    assert(/const isHitbox = _looksLikeHitbox\(child\);/.test(body), '_uCollectAt вычисляет isHitbox для каждого child');
    assert(/child instanceof PIXI\.Sprite \|\| child instanceof PIXI\.Text \|\| child\._uDraggable === true \|\| isHitbox/.test(body),
        'хитбоксы добавлены в общий критерий отбора наравне со Sprite/Text/_uDraggable');
    assert(/if\(isHitbox && \(b\.width > HITBOX_MAX_W \|\| b\.height > HITBOX_MAX_H\)\) continue;/.test(body),
        'полноэкранные blocker/capture-слои (Graphics большого размера) намеренно исключены — иначе редактор предлагал бы "двигать" сам перехватчик кликов');
}

console.log('\nTest 5: dvor-dice-screen.js — позиция/поворот счётчика красных поинтов сняты пользователем');
{
    assert(/pointsTxt\.x = 183; pointsTxt\.y = 443; pointsTxt\.rotation = 3 \* Math\.PI \/ 180;/.test(diceScreenJs),
        '_dicePointsTxt — x=183,y=443, поворот 3° (21.09.2026: скорректирован пользователем с 4° до 3°)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
