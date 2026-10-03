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
 *    _fetchHonestPreview(), которая теперь зовётся и при открытии, и сразу после сброса уровня.
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

console.log('\nTest 1: keyIconSpr — интерактивен, имеет pointerover/pointerout с тултипом');
{
    assert(/keyIconSpr\.interactive = true; keyIconSpr\.buttonMode = true;/.test(ryuk), 'keyIconSpr интерактивен (иначе pointerover никогда не сработает)');
    assert(/keyIconSpr\.on\('pointerover', \(\) => \{/.test(ryuk), 'pointerover обработчик навешен');
    assert(/keyIconSpr\.on\('pointerout', \(\) => \{ keyTooltip\.visible = false; \}\);/.test(ryuk), 'pointerout скрывает тултип');
}

console.log('\nTest 2: текст тултипа берётся из window.bosses.data (не дублирует отдельный массив имён боссов)');
{
    const start = ryuk.indexOf("keyIconSpr.on('pointerover'");
    const end   = ryuk.indexOf("keyIconSpr.on('pointerout'", start);
    const body  = ryuk.slice(start, end);
    assert(/window\.bosses && window\.bosses\.data && window\.bosses\.data\[keyTooltipBossId\]/.test(body),
        'имя босса читается из общего window.bosses.data (та же карта id→name, что рисует список боссов)');
    assert(/keyTooltipTxt\.text = 'Ключ босса «' \+ bossName \+ '»';/.test(body), 'текст тултипа формируется с реальным именем босса');
}

console.log('\nTest 3: _setKeyPreview() запоминает bossId для тултипа при каждой перерисовке (превью и реальная награда)');
{
    const start = ryuk.indexOf('const _setKeyPreview = (count, bossId) => {');
    const end   = ryuk.indexOf('\n\t\t};', start);
    const body  = ryuk.slice(start, end);
    assert(/keyTooltipBossId = bossId;/.test(body), '_setKeyPreview() обновляет keyTooltipBossId при каждом вызове — тултип не отстаёт от того, какой ключ реально показан');
    assert(/keyTooltip\.visible = false;/.test(body), 'если ключа в награде нет (count<=0) — тултип тоже скрывается вместе с иконкой');
}

console.log('\nTest 4: честное превью (ryukzak.preview) вынесено в переиспользуемую функцию _fetchHonestPreview()');
{
    assert(/const _fetchHonestPreview = \(\) => \{/.test(ryuk), '_fetchHonestPreview() объявлена как переиспользуемая функция (не inline-колбэк только для первого открытия)');
    const start = ryuk.indexOf('const _fetchHonestPreview = () => {');
    const end   = ryuk.indexOf('\n\t\t};', start);
    const body  = ryuk.slice(start, end);
    assert(/TS\.php\('ryukzak\.preview', \{\}, \(res\) => \{/.test(body), '_fetchHonestPreview() реально зовёт ryukzak.preview на сервере');
    assert(/_renderRewardIcons\(res\);/.test(body) && /_setKeyPreview\(res\.k \|\| 0, res\.key_boss\);/.test(body),
        '_fetchHonestPreview() обновляет и иконки награды, и превью ключа из честного ответа сервера');
}

console.log('\nTest 5: _fetchHonestPreview() вызывается при ПЕРВОМ открытии экрана (как и раньше)');
{
    const roughIdx  = ryuk.indexOf('_setKeyPreview(previewTier.k || 0, previewTier.key_boss);');
    const defIdx    = ryuk.indexOf('const _fetchHonestPreview = () => {', roughIdx);
    const firstCall = ryuk.indexOf('_fetchHonestPreview();', defIdx);
    assert(roughIdx !== -1 && defIdx !== -1 && firstCall !== -1 && roughIdx < defIdx && defIdx < firstCall,
        'после грубого локального ориентира при открытии экрана объявляется и сразу зовётся _fetchHonestPreview()');
}

console.log('\nTest 6 (сам баг-фикс): после закрытия попапа награды (сброс уровня) экран ЗАНОВО перерисовывает иконки, а не только текст уровня/прогресс-бар');
{
    const resetIdx = ryuk.indexOf('const resetLevel  = Math.max(1, _ryukzakLevelFromPoints(pointsAfter));');
    assert(resetIdx !== -1, 'блок сброса уровня после закрытия попапа найден');
    const nextCallIdx = ryuk.indexOf('if(win.parent) root.layer2_mc.addChild(win);', resetIdx);
    const body = ryuk.slice(resetIdx, nextCallIdx === -1 ? resetIdx + 1500 : nextCallIdx);

    assert(/lvlTxt\.text = 'УРОВЕНЬ РЮКЗАКА : ' \+ resetLevel;/.test(body), 'sanity: текст уровня по-прежнему сбрасывается (это уже работало верно)');
    assert(/_renderProgress\(resetLevel\);/.test(body), 'sanity: прогресс-бар по-прежнему сбрасывается (это уже работало верно)');
    // Сам фикс — раньше здесь обрывалось, иконки оставались от предыдущей награды.
    assert(/const resetLvIdx = Math\.max\(0, Math\.min\(19, resetLevel - 1\)\);/.test(body),
        'КРИТИЧНО: вычисляется тир НОВОГО (сброшенного) уровня для грубого локального ориентира');
    assert(/_renderRewardIcons\(\{\s*cig: resetTier\.cig, c: resetTier\.c, exp: resetTier\.exp,\s*mach: 0, pist: 0, ak: resetTier\.w,\s*\}\);/.test(body),
        'КРИТИЧНО: иконки награды перерисовываются грубым ориентиром НОВОГО уровня сразу после сброса (раньше не перерисовывались вообще)');
    assert(/_setKeyPreview\(resetTier\.k \|\| 0, resetTier\.key_boss\);/.test(body),
        'КРИТИЧНО: превью ключа тоже перерисовывается под новый уровень (включая возможное исчезновение иконки ключа, если на новом уровне ключей нет)');
    assert(/_fetchHonestPreview\(\);/.test(body),
        'КРИТИЧНО: следом запрашивается честное превью с сервера — та же гарантия "превью=реальная награда", что и при открытии экрана');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
