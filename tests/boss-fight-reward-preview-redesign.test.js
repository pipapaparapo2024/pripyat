/**
 * Test: 26.09.2026, по прямому указанию (большой батч с 14 картинками-координатами) —
 *
 * 1) Попап "ТЫ ПОБЕДИЛ" — при наведении на иконку шмотки-награды открывается "награда
 *    рамка.png" (x:860,y:244) с реальной картинкой выбитой вещи внутри (x:895,y:252),
 *    "награда не получено.png" — если это только прогресс фрагмента (полный предмет ещё не
 *    собран). Заменяет старый текстовый тултип.
 * 2) Экран перед боем (bosses_prefight.js) — фон заменён на "задний фон боевка.png" (было
 *    "боевка страница.png"), добавлена карусель "ВОЗМОЖНАЯ НАГРАДА": рамка (x:952,y:449) +
 *    стрелки вправо (x:1102,y:492) / влево (x:912,y:492), картинка предмета (x:958,y:459),
 *    "не получено" (x:920,y:417) + чёрно-белый фильтр для невыбитых вещей.
 * 3) Баг "сбежал с боя — участники не показываются" (и тот же баг при таймауте, использующем
 *    тот же код) — ранний return при пустом top пропускал подстановку заглушек-аватаров.
 * 4) Dev-кнопка "Попап награды (мок, 10 участников)" — 1 место 11к урона, дальше -1000 на
 *    каждое место, до 10-го (2к).
 *
 * Run: node tests/boss-fight-reward-preview-redesign.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bossResultSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');
const combatSrc       = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');
const prefightSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_prefight.js'), 'utf-8');
const devPanelSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'dev_panel.js'), 'utf-8');
const imagesModSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'modules', 'boss-shmot-images.js'), 'utf-8');
const gameBootSrc     = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'game-boot.js'), 'utf-8');

console.log('\nTest 1: modules/boss-shmot-images.js — общий каталог id->картинка, рамка/оверлей, id96 намеренно отсутствует');
{
    assert(/export const BOSS_SHMOT_REWARD_IMAGE = \{/.test(imagesModSrc), 'BOSS_SHMOT_REWARD_IMAGE экспортирован');
    assert(/41: 'награда панама ссср охотник\.png',/.test(imagesModSrc), 'id41 замаплен на реальный файл');
    assert(!/^\s*96:/m.test(imagesModSrc.split('export const BOSS_SHMOT_REWARD_FRAME')[0]), 'id96 отсутствует в карте (для него нет готового файла)');
    assert(/export const BOSS_SHMOT_REWARD_FRAME = 'награда рамка\.png';/.test(imagesModSrc), 'BOSS_SHMOT_REWARD_FRAME экспортирован');
    assert(/export const BOSS_SHMOT_NOT_OBTAINED = 'награда не получено\.png';/.test(imagesModSrc), 'BOSS_SHMOT_NOT_OBTAINED экспортирован');
}

console.log('\nTest 2: boss_result.js — hover-рамка вместо текстового тултипа, правильные координаты');
{
    assert(/import \{ BOSS_SHMOT_REWARD_IMAGE, BOSS_SHMOT_REWARD_FRAME, BOSS_SHMOT_NOT_OBTAINED \} from '\.\.\/\.\.\/\.\.\/modules\/boss-shmot-images\.js';/.test(bossResultSrc),
        'импортирует общий каталог картинок');
    assert(/const SHMOT_HOVER_FRAME_POS = \{ x: 860, y: 244 \};/.test(bossResultSrc), 'координаты рамки — x:860,y:244');
    // 26.09.2026: координаты картинки предмета уточнены редактором позиций повторно
    // (895,252 → 903,256), плюс фиксированный размер 91×88 для ЛЮБОЙ шмотки (разные исходники
    // разного нативного размера — тот же приём, что и единый scale карусели bosses_prefight.js).
    // Оверлей "не получено" теперь на СВОЕЙ отдельной позиции 867,223 размером 169×142.
    assert(/const SHMOT_HOVER_ITEM_POS  = \{ x: 903, y: 256 \};/.test(bossResultSrc), 'координаты картинки внутри — x:903,y:256');
    assert(/const SHMOT_HOVER_ITEM_W = 91, SHMOT_HOVER_ITEM_H = 88;/.test(bossResultSrc), 'фиксированный размер картинки предмета — 91×88, для любой шмотки');
    assert(/const SHMOT_HOVER_NOT_OBTAINED_POS = \{ x: 867, y: 223 \};/.test(bossResultSrc), 'оверлей "не получено" на своей позиции — x:867,y:223');
    assert(/const SHMOT_HOVER_NOT_OBTAINED_W = 169, SHMOT_HOVER_NOT_OBTAINED_H = 142;/.test(bossResultSrc), 'оверлей "не получено" фиксированного размера 169×142');

    assert(!/const tipLines = \(opts\.shmotAmount > 0 && opts\.shmotWonName\)/.test(bossResultSrc), 'старый текстовый tipLines убран');

    const start = bossResultSrc.indexOf('const hoverItemId =');
    assert(start !== -1, 'логика выбора id для превью существует');
    // 26.09.2026: окно расширено до 9000 символов — между блоком выбора id и обработчиками
    // наведения добавилась карточка-описание (та же стилистика, что и
    // shmot_shop.js._showShopTip, см. boss-result-shmot-hover-frame-end-to-end.test.js).
    const body = bossResultSrc.slice(start, start + 9000);
    assert(/opts\.shmotAmount > 0 && opts\.shmotWonId != null/.test(body), 'полная вещь — берёт id из opts.shmotWonId');
    assert(/opts\.shmotFragment && opts\.shmotFragment\.id != null/.test(body), 'фрагмент — берёт id из opts.shmotFragment.id');
    assert(/const isObtained = opts\.shmotAmount > 0;/.test(body), 'isObtained только при реально полученной вещи (не фрагменте)');
    assert(/frame\.visible = false; itemImg\.visible = false; notObtainedOverlay\.visible = false;/.test(body),
        'изначально рамка/картинка/оверлей скрыты (до первого наведения)');
    // 26.09.2026: в течение дня поведение менялось pointerover/pointerout → click-toggle →
    // ОБРАТНО на pointerover/pointerout (два прямых указания подряд тем же днём). Финал — наведение.
    // 28.09.2026: показ/скрытие вынесены в именованные showTip()/hideTip() (см.
    // boss-result-shmot-tooltip-mobile-tap.test.js) — на десктопе они всё ещё вешаются через
    // pointerover/pointerout, просто как ссылка на функцию, а не инлайн-стрелку.
    assert(/const showTip = \(\) => \{/.test(body), 'showTip() объявлена (десктоп: pointerover, мобильный: тап)');
    assert(/const hideTip = \(\) => \{/.test(body), 'hideTip() объявлена (десктоп: pointerout, мобильный: повторный тап)');
    assert(/shmotIcon\.on\('pointerover', showTip\);/.test(body), 'десктоп: показ по наведению (pointerover)');
    assert(/shmotIcon\.on\('pointerout',\s*hideTip\);/.test(body), 'десктоп: скрытие по уходу курсора (pointerout)');
    assert(/notObtainedOverlay\.visible = !isObtained;/.test(body),
        'оверлей "не получено" показывается при наведении только если вещь не получена');
}

console.log('\nTest 3: bosses-combat.js — shmotWonId передаётся в попап (раньше передавалось только имя)');
{
    assert(/shmotWonId: res\.bossShmotItemId != null \? res\.bossShmotItemId : null,/.test(combatSrc),
        'opts.shmotWonId заполняется из res.bossShmotItemId');
}

console.log('\nTest 4: boss_result.js — баг "сбежал с боя, участники не показываются" исправлен (ранний return убран)');
{
    assert(!/if\(!top\.length\) return;/.test(bossResultSrc), 'ранний return по пустому top убран целиком');
    const start = bossResultSrc.indexOf('const _applyRatingTop = (top) => {');
    // 02.10.2026: между началом _applyRatingTop и объявлением topThree добавился новый код
    // (комментарий про "меньше 3 участников" + сопутствующая логика) — окно 1600 символов
    // больше не дотягивается до строки с topThree (реально ~2336 символов от начала функции).
    // Расширено с запасом, чтобы не ловить тот же сдвиг при следующей мелкой правке рядом.
    const body = bossResultSrc.slice(start, start + 3000);
    assert(/const topThree = top\.slice\(0, 3\);/.test(body), 'topThree считается независимо от длины top (включая 0)');
    assert(/avatarSprs\.forEach\(\(spr, i\) => \{/.test(bossResultSrc), 'цикл подстановки заглушек (PLACEHOLDER_AVATARS) сохранён и теперь всегда достижим');
}

console.log('\nTest 5: bosses_prefight.js — фон заменён на "задний фон боевка.png"');
{
    assert(/const bg = new PIXI\.Sprite\(PIXI\.Texture\.from\(B \+ 'задний фон боевка\.png'\)\);/.test(prefightSrc), 'новый фон подключён');
    assert(!/'боевка страница\.png'/.test(prefightSrc), 'старый фон нигде не остался в этом файле');
}

console.log('\nTest 6: bosses_prefight.js — карусель "ВОЗМОЖНАЯ НАГРАДА" с правильными координатами всех 5 элементов');
{
    assert(/const SHMOT_FRAME_POS  = \{ x: 952, y: 449 \};/.test(prefightSrc), 'рамка — x:952,y:449');
    // 26.09.2026 (точечная правка редактором позиций на живом фоне): x:958→963/y:459→461 и
    // x:920→914/y:417→415, плюс явный единый scale для картинки предмета/оверлея (не auto-fit).
    assert(/const SHMOT_ITEM_POS   = \{ x: 963, y: 461 \};/.test(prefightSrc), 'картинка предмета — x:963,y:461');
    assert(/const SHMOT_ITEM_SCALE = 1\.385;/.test(prefightSrc), 'картинка предмета — единый scale 1.385');
    assert(/const SHMOT_NOT_OBT_POS = \{ x: 914, y: 415 \};/.test(prefightSrc), 'оверлей "не получено" — x:914,y:415');
    assert(/const SHMOT_NOT_OBT_SCALE = 1\.373;/.test(prefightSrc), 'оверлей "не получено" — единый scale 1.373');
    assert(/const ARROW_RIGHT_POS  = \{ x: 1102, y: 492 \};/.test(prefightSrc), 'стрелка вправо — x:1102,y:492');
    assert(/const ARROW_LEFT_POS   = \{ x: 912, y: 492 \};/.test(prefightSrc), 'стрелка влево — x:912,y:492');

    assert(/import \{ BOSS_SHMOT_REWARD_IMAGE, BOSS_SHMOT_NOT_OBTAINED \} from '\.\.\/\.\.\/\.\.\/modules\/boss-shmot-images\.js';/.test(prefightSrc),
        'импортирует общий каталог картинок (тот же, что и попап победы)');
}

console.log('\nTest 7: bosses_prefight.js — обесцвечивание невыбитых предметов, стрелки листают по кругу, сброс при смене режима');
{
    const start = prefightSrc.indexOf('const _renderShmotCarousel = () => {');
    const body = prefightSrc.slice(start, start + 1800);
    assert(/const owned = !!\(window\.shmot && Array\.isArray\(shmot\.items\) && shmot\.items\.some\(it => it\.id === itemId && it\.owned\)\);/.test(body),
        'проверяет владение через window.shmot.items (тот же источник, что и остальной проект)');
    assert(/shmotItemImg\.filters = owned \? null : \[_shmotGrayscale\];/.test(body), 'ч/б фильтр применяется ТОЛЬКО для невыбитых вещей');
    assert(/shmotCarouselIdx = \(\(shmotCarouselIdx % pool\.length\) \+ pool\.length\) % pool\.length;/.test(body),
        'индекс листается по кругу (корректно и для отрицательных значений после клика "влево")');

    assert(/arrowRight\.on\('pointerdown', \(\) => \{ shmotCarouselIdx\+\+; _renderShmotCarousel\(\); \}\);/.test(prefightSrc), 'стрелка вправо увеличивает индекс');
    assert(/arrowLeft\.on\('pointerdown', \(\) => \{ shmotCarouselIdx--; _renderShmotCarousel\(\); \}\);/.test(prefightSrc), 'стрелка влево уменьшает индекс');

    const modeStart = prefightSrc.indexOf("ms.on('pointerdown', ()=>{");
    const modeBody = prefightSrc.slice(modeStart, modeStart + 800);
    assert(/shmotCarouselIdx = 0;/.test(modeBody) && /_renderShmotCarousel\(\);/.test(modeBody),
        'смена режима (обычный/соло) сбрасывает карусель на первый предмет нового пула');
}

console.log('\nTest 8: bosses_prefight.js — старая текстовая подсказка по шмотке (SHMOT_NAMES/_shmotDropTip) убрана, BOSS_SHMOT_DROP_POOL сохранён (переиспользуется каруселью)');
{
    assert(!/const _shmotDropTip = /.test(prefightSrc), '_shmotDropTip удалена');
    assert(!/const SHMOT_NAMES = \{/.test(prefightSrc), 'SHMOT_NAMES удалена (карусель использует картинки, не текст)');
    assert(!/\{ url: B\+'шмотка награда\.png', tip: _shmotDropTip \},/.test(prefightSrc), 'иконка шмотки убрана из общего ряда наград (заменена каруселью)');
    assert(/const BOSS_SHMOT_DROP_POOL = \{/.test(prefightSrc), 'BOSS_SHMOT_DROP_POOL сохранён — источник данных для карусели');
}

console.log('\nTest 9: game-boot.js — новые ключевые ассеты экрана добавлены в предзагрузку, старый фон убран');
{
    assert(/'задний фон боевка\.png','награда боевка рамка\.png','награда боевка стрелка влево\.png','награда боевка стрелка вправо\.png',/.test(gameBootSrc),
        'новые 4 файла добавлены в _allGamePngs');
    assert(!/'боевка страница\.png'/.test(gameBootSrc), 'старый фон убран из предзагрузки (был бы мёртвым запросом)');
}

console.log('\nTest 10: dev_panel.js — кнопка мок-попапа награды с 10 участниками, урон убывает на 1000 с каждым местом');
{
    const start = devPanelSrc.indexOf("_row('Попап награды (мок, 10 участников)', [");
    assert(start !== -1, 'кнопка существует');
    const body = devPanelSrc.slice(start, start + 900);
    assert(/for\(let i = 0; i < 10; i\+\+\)\{/.test(body), 'генерирует ровно 10 участников');
    assert(/damage: 11000 - i \* 1000/.test(body), '1 место 11000, каждое следующее -1000 (2 место 10000 ... 10 место 2000)');
    assert(/isWin: true,/.test(body), 'открывает именно ВЫИГРЫШНЫЙ вариант попапа (для проверки полной раскладки)');
    assert(/iface\._showBossResultPopup\(\{/.test(body), 'вызывает попап напрямую, без реального боя');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
