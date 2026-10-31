/**
 * Test: 21.10.2026, по прямому указанию — два новых файла от художника:
 *
 * 1) "глаза закрыты.png" (160×54) — мини-анимация моргания персонажа: появляется раз в 15 сек,
 *    держится 0.3 сек, затем пропадает. Применяется на ВСЕХ 3 экранах, где пользователь явно
 *    попросил ("везде где есть персонаж, а именно на главном экране, во вкладке шмотки и на
 *    странице в гостях у другого персонажа") — home.js, shmot_shop.js, player_profile.js.
 *    НЕ на base.js/hata.js (пользователь их не называл, и координаты x:803 туда физически не
 *    влезают — персонаж там в других x/y).
 *
 *    Координаты сняты пользователем через редактор позиций на экране магазина шмоток (там
 *    персонаж в 730,208). Первая версия координат (21.10.2026, тем же днём) — x:803,y:440 без
 *    масштаба (спрайт рисовался в натуральную величину файла, 160×54). ПОЗЖЕ ТЕМ ЖЕ ДНЁМ
 *    пользователь уточнил позицию через редактор ЕЩЁ РАЗ — актуальные координаты x:853,y:234,
 *    scale:0.219 (160×54 → ~35×12 на экране). Разница от персонажа (730,208) = +123x/+26y, та
 *    же разница перенесена на home.js/player_profile.js, где персонаж в 506,204 → 629,230 (тот
 *    же принцип переноса координат между экранами, что уже использован для предплечья/кистей рук).
 *
 *    home.js — персонаж персистентный (this._persSpr создаётся один раз за сеанс), поэтому
 *    таймер моргания заведён ТАК ЖЕ — один раз, под тем же guard'ом (if(!this._eyesClosedSpr)),
 *    иначе повторные init() (смена фона локации и т.п.) плодили бы параллельные setInterval.
 *    shmot_shop.js/player_profile.js — экран пересобирается ЗАНОВО при каждом открытии
 *    (removeChild + полная пересборка win, без кеша) — там обязательно гасить ПРЕДЫДУЩИЙ
 *    таймер перед созданием нового (иначе каждое открытие плодит ещё один параллельный
 *    интервал поверх уже висящих — старый спрайт отсоединён от сцены, но колбэк тикал бы вечно).
 *
 * 2) "правая рука.png" — заменена новым файлом, НО старый файл НЕ удалён с сервера: теперь два
 *    файла. Логика переключения (по прямому указанию): показывать НОВЫЙ файл, когда в руке
 *    (cat:6) ничего не надето ИЛИ надеты часы Poker/цепь Teenager (id 62/92 — носятся НА руке
 *    поверх кожи, см. существующий комментарий "Исключения — часы Poker и цепь Teenager");
 *    показывать СТАРЫЙ файл (текущий, на сервере), когда в руке зажат любой другой предмет
 *    (оружие/инструмент — серп, молоток и т.п.). Новый файл сохранён под ИМЕНЕМ "правая рука
 *    пустая.png" (не "правая рука.png" — коллизия имён, см. правило АГЕНТС.md "Коллизии имён
 *    файлов-ассетов").
 *
 *    Новый файл 389×507 — почти в 4-5 раз крупнее старого (98×97) и с другими пропорциями
 *    (не квадратный). Пользователь явно подтвердил: тот же видимый размер, что сейчас — поэтому
 *    везде, где переключается текстура, стоят явные width:98/height:97 (не scale — пропорции
 *    разные, явные width/height дают именно нужный видимый размер, как у персонажа 17.10.2026).
 *
 *    21.10.2026 (ПОЗЖЕ ТЕМ ЖЕ ДНЁМ, по прямому указанию, редактор позиций): пользователь прислал
 *    отдельную позицию ИМЕННО для "правая рука пустая.png" (x:853,y:379 на экране магазина
 *    шмоток, где старый файл был в x:854,y:373) — две позы руки (пустая кисть / кулак с
 *    предметом) не идеально совпадают по форме, поэтому держат РАЗНЫЕ x/y, переключаются
 *    синхронно с текстурой. Перенесено на home.js/player_profile.js той же разницей от
 *    персонажа: пустая кисть 629,375 (старая поза остаётся 630,369).
 *
 *    Плюс: "глаза закрыты.png" теперь также принудительно показывается при включении
 *    универсального редактора позиций (universal_pos_editor.js) — иначе спрайт с окном
 *    видимости 0.3с/15с физически невозможно было бы выбрать и подвинуть мышкой.
 *
 * Run: node tests/oct21-blink-eyes-and-right-hand-weapon-swap.test.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

for (const file of ['глаза закрыты.png', 'кисть хват.png', 'кисть расслабленная.png']) assert(fs.existsSync(path.join(root, 'assets/images', file)), 'Current character texture: ' + file);

const FILES = {
    home:    '_client/src/game/home.js',
    shop:    '_client/src/game/shell/overlays/shmot_shop.js',
    profile: '_client/src/game/shell/overlays/player_profile.js',
};

console.log('\nTest 2: мигание глаз — все 3 экрана создают спрайт "глаза закрыты.png", изначально invisible, таймер 15000/300мс');
{
    for(const [name, rel] of Object.entries(FILES)){
        const src = readSrc(rel);
        assert(/PIXI\.Texture\.from\('\.\/images\/глаза закрыты\.png'\)/.test(src), `${name}: грузит "глаза закрыты.png"`);
        assert(/\.visible = false;[\s\S]{0,200}setInterval/.test(src) || /setInterval\([\s\S]{0,400}15000\)/.test(src),
            `${name}: спрайт изначально invisible, таймер присутствует`);
        assert(/\}, 15000\);/.test(src), `${name}: интервал моргания — раз в 15 сек`);
        assert(/setTimeout\(\(\) => \{[^}]*visible = false;[^}]*\}, 300\);/.test(src), `${name}: видимость держится 0.3 сек (300мс), затем гасится`);
    }
}

console.log('\nTest 3: координаты + масштаб моргания (уточнены 21.10.2026 повторно через редактор позиций, затем ЕЩЁ РАЗ — "опусти вниз на 2 пикселя") соответствуют положению персонажа на каждом экране');
{
    assert(/eyesClosedSpr\.x = 629;[\s\S]{0,20}eyesClosedSpr\.y = 232;/.test(readSrc(FILES.home)),
        'home.js: персонаж в (506,204) → глаза в (629,232) — то же относительное смещение, что задано на экране-эталоне, +2px вниз по прямому указанию');
    assert(/eyesClosedSpr\.x = 629;[\s\S]{0,20}eyesClosedSpr\.y = 232;/.test(readSrc(FILES.profile)),
        'player_profile.js: персонаж тоже в (506,204) → те же (629,232)');
    assert(/eyesClosedSpr\.x = 853;[\s\S]{0,20}eyesClosedSpr\.y = 236;/.test(readSrc(FILES.shop)),
        'shmot_shop.js: персонаж в (730,208) → глаза в (853,236) — координаты экрана-эталона, заданные пользователем напрямую, +2px вниз');
    for(const [name, rel] of Object.entries(FILES)){
        assert(/eyesClosedSpr\.scale\.set\(0\.219\);/.test(readSrc(rel)),
            `${name}: масштаб 0.219 (160×54 → ~35×12 на экране, как задано в редакторе позиций)`);
    }
}

console.log('\nTest 4: home.js — таймер моргания заводится ОДИН РАЗ за сеанс (persSpr персистентный, см. if(!this._persSpr))');
{
    const src = readSrc(FILES.home);
    assert(/if\(!this\._eyesClosedSpr\)\{[\s\S]*?setInterval/.test(src),
        'блок создания спрайта+таймера под guard if(!this._eyesClosedSpr) — не пересоздаётся при повторных init()');
}

console.log('\nTest 5: shmot_shop.js/player_profile.js — экран пересобирается заново при каждом открытии, поэтому старый таймер гасится ПЕРЕД созданием нового');
{
    assert(/if\(this\._shopBlinkTimer\) clearInterval\(this\._shopBlinkTimer\);/.test(readSrc(FILES.shop)),
        'shmot_shop.js: clearInterval(this._shopBlinkTimer) перед созданием нового — защита от накопления параллельных таймеров при повторных открытиях');
    assert(/if\(this\._profileBlinkTimer\) clearInterval\(this\._profileBlinkTimer\);/.test(readSrc(FILES.profile)),
        'player_profile.js: та же защита при пересборке экрана');
}

console.log('\nTest 6: player_profile.js — _closePlayerProfile() тоже гасит таймер моргания (двойная защита — на пересборке и на закрытии)');
{
    const src = readSrc(FILES.profile);
    const closeIdx = src.indexOf('proto._closePlayerProfile = function()');
    assert(closeIdx !== -1, '_closePlayerProfile найден');
    const closeBody = src.slice(closeIdx, src.indexOf('};', closeIdx));
    assert(/clearInterval\(this\._profileBlinkTimer\)/.test(closeBody), '_closePlayerProfile очищает this._profileBlinkTimer');
    assert(/this\._profileBlinkTimer = null;/.test(closeBody), '_closePlayerProfile обнуляет ссылку на таймер');
}

// ⚠️ Tests 7/8/9/10/12 (ОТМЕНЕНЫ 21.10.2026, ПОЗЖЕ ТЕМ ЖЕ ДНЁМ, по прямому указанию —
// "разделить файл руки на предплечье и кисть, предплечье всегда одно, кисть меняется"):
// вся система "правая рука.png"/"правая рука пустая.png" (один файл, две позы, переключение
// x/y+текстуры) и "фаланги правой руки.png" (мелкий оверлей костяшек, просто
// visible-toggle) заменена на ДВУХСЛОЙНУЮ архитектуру — статичное предплечье
// ("предплечье правое.png", никогда не меняется) + отдельная полная кисть ("кисть
// расслабленная.png"/"кисть хват.png", либо скрыта целиком у предметов с handBuiltIn:true).
// Источник истины для текущей логики — tests/oct21-new-shmot-sets-and-forearm-hand-split.test.js
// (Test 5/6) и ПЕРЕИМЕНОВАНИЕ_АССЕТОВ_21_10_2026.md. Удалять эти 5 Test-блоков не стали
// (принятая в проекте практика — см. докблоки в dvor-wrap-*.test.js), просто выключены.

console.log('\nTest 11: universal_pos_editor.js принудительно показывает "глаза закрыты.png" в режиме редактирования (окно видимости 0.3с/15с иначе не даёт выбрать спрайт мышкой)');
{
    const src = readSrc('_client/src/game/shell/overlays/universal_pos_editor.js');
    assert(/const re = \/актив\|activ\|глаза закрыты\/i;/.test(src),
        '_looksLikeActiveState: регулярка расширена на "глаза закрыты" (та же инфраструктура force-show/restore, что и для "активных" состояний кнопок)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
