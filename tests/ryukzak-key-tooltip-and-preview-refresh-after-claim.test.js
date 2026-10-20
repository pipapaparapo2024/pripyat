/**
 * Test: 04.10.2026, два отдельных запроса по рюкзаку в одном сообщении.
 *
 * 1) "сделай так чтобы при наведении на ключ в награде с рюкзака писалось на какого босса этот
 *    ключ" — новый тултип на keyIconSpr (pointerover/pointerout), текст берётся из уже
 *    существующего window.bosses.data[bossId].name (не дублируем отдельным массивом имён).
 *
 * 2) Баг — "когда забрал награду с рюкзака то следующая награда визуально никак не меняется по
 *    сравнению с предыдущей, хотя награда другая (даже написано корректно что уровень сбросился
 *    то есть уровень:1)". Корень: после закрытия попапа награды колбэк пересчитывал и обновлял
 *    ТОЛЬКО lvlTxt.text/_renderProgress() (текст уровня и прогресс-бар) — но НЕ перерисовывал
 *    _renderRewardIcons()/_setKeyPreview(). На экране продолжали висеть иконки/суммы ОТ ТОЛЬКО
 *    ЧТО ЗАБРАННОЙ награды, пока игрок не кликал ЗАБРАТЬ ещё раз (тогда ryukzak.open() честно
 *    приходил с новым реальным результатом и обновлял всё разом). Фикс: тот же двухфазный приём,
 *    что и при самом открытии экрана (_renderRewardIcons() с грубым локальным ориентиром СРАЗУ,
 *    затем честный ryukzak.preview() с сервера) — вынесен в отдельную переиспользуемую функцию
 *    _fetchHonestPreview(), которая зовётся и при открытии, и сразу после сброса уровня.
 *
 * 17.10.2026 (по прямому указанию — замена сигарет на сухари, полная переработка грида наград
 * рюкзака, см. sukhari-replace-cigarettes-ui-rebuild.test.js §8): отдельный floating-спрайт
 * ключа (keyIconSpr) с собственным hover-тултипом УДАЛЁН ЦЕЛИКОМ — ключ теперь просто одна из
 * карточек общего грида (KEY_BOSS_CARD), уже подписанная именем босса в самом арте карточки,
 * отдельный тултип избыточен. Тесты 1-3 (ниже) теперь проверяют, что этот код действительно
 * убран, а не оставлен мёртвым. Тесты 4-6 (двухфазный честный-превью фикс) сохранены по сути,
 * обновлены под новую сигнатуру: _setKeyPreview() больше нет (ключ идёт через
 * _renderRewardIcons(reward) вместе со всем остальным), lvlTxt теперь содержит только число
 * (подпись "УРОВЕНЬ РЮКЗАКА :" вшита в новую плашку, не дублируется текстом).
 *
 * Run: node tests/ryukzak-key-tooltip-and-preview-refresh-after-claim.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const ryuk = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'ryukzak.js'), 'utf-8');

console.log('\nTest 1-3: старый отдельный keyIconSpr с hover-тултипом убран целиком (заменён карточкой в общем гриде)');
{
    assert(!/const keyIconSpr = new PIXI\.Sprite/.test(ryuk), 'keyIconSpr больше не создаётся');
    assert(!/const keyTooltip = new PIXI\.Container/.test(ryuk), 'keyTooltip больше не создаётся');
    assert(!/const _setKeyPreview = \(count, bossId\) => \{/.test(ryuk), '_setKeyPreview() больше не определена');
    assert(/KEY_BOSS_CARD = \{ 1:'рюкзак карточка счастливчик\.png', 2:'рюкзак карточка ястреб\.png', 3:'рюкзак карточка меченный\.png' \}/.test(ryuk),
        'вместо этого — карта id→файл карточки (уже подписана именем босса в самом арте, отдельный тултип не нужен)');
}

console.log('\nTest 4: честное превью (ryukzak.preview) вынесено в переиспользуемую функцию _fetchHonestPreview()');
{
    assert(/const _fetchHonestPreview = \(\) => \{/.test(ryuk), '_fetchHonestPreview() объявлена как переиспользуемая функция (не inline-колбэк только для первого открытия)');
    const start = ryuk.indexOf('const _fetchHonestPreview = () => {');
    const end   = ryuk.indexOf('\n\t\t};', start);
    const body  = ryuk.slice(start, end);
    assert(/TS\.php\('ryukzak\.preview', \{\}, \(res\) => \{/.test(body), '_fetchHonestPreview() реально зовёт ryukzak.preview на сервере');
    assert(/_renderRewardIcons\(res\);/.test(body) && /lvlTxt\.text = String\(res\.level\);/.test(body),
        '_fetchHonestPreview() обновляет и иконки награды (включая ключ, уже часть reward), и текст уровня из честного ответа сервера');
}

console.log('\nTest 5: _fetchHonestPreview() вызывается при ПЕРВОМ открытии экрана (не для mock-превью dev-кнопки)');
{
    const roughIdx  = ryuk.indexOf('_renderRewardIcons({');
    const defIdx    = ryuk.indexOf('const _fetchHonestPreview = () => {', roughIdx);
    const firstCall = ryuk.indexOf('if(!mockReward) _fetchHonestPreview();', defIdx);
    assert(roughIdx !== -1 && defIdx !== -1 && firstCall !== -1 && roughIdx < defIdx && defIdx < firstCall,
        'после грубого локального ориентира при открытии экрана объявляется и зовётся _fetchHonestPreview() — но НЕ для mockReward (dev-превью)');
}

console.log('\nTest 6 (сам баг-фикс): после закрытия попапа награды (сброс уровня) экран ЗАНОВО перерисовывает иконки, а не только текст уровня/прогресс-бар');
{
    const resetIdx = ryuk.indexOf('const resetLevel  = Math.max(1, _ryukzakLevelFromPoints(pointsAfter));');
    assert(resetIdx !== -1, 'блок сброса уровня после закрытия попапа найден');
    const nextCallIdx = ryuk.indexOf('if(win.parent) root.layer2_mc.addChild(win);', resetIdx);
    const body = ryuk.slice(resetIdx, nextCallIdx === -1 ? resetIdx + 1500 : nextCallIdx);

    assert(/lvlTxt\.text = String\(resetLevel\);/.test(body), 'sanity: текст уровня по-прежнему сбрасывается (это уже работало верно)');
    assert(/_renderProgress\(resetLevel\);/.test(body), 'sanity: прогресс-бар по-прежнему сбрасывается (это уже работало верно)');
    // Сам фикс — раньше здесь обрывалось, иконки оставались от предыдущей награды.
    assert(/const resetLvIdx = Math\.max\(0, Math\.min\(19, resetLevel - 1\)\);/.test(body),
        'КРИТИЧНО: вычисляется тир НОВОГО (сброшенного) уровня для грубого локального ориентира');
    assert(/_renderRewardIcons\(\{\s*cig: resetTier\.cig, c: resetTier\.c, exp: resetTier\.exp,\s*mach: 0, pist: 0, ak: resetTier\.w,\s*k: resetTier\.k, key_boss: resetTier\.key_boss,\s*\}\);/.test(body),
        'КРИТИЧНО: иконки награды (включая карточку ключа — теперь часть того же вызова, не отдельный _setKeyPreview) перерисовываются грубым ориентиром НОВОГО уровня сразу после сброса');
    assert(/_fetchHonestPreview\(\);/.test(body),
        'КРИТИЧНО: следом запрашивается честное превью с сервера — та же гарантия "превью=реальная награда", что и при открытии экрана');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
