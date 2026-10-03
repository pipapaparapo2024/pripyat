/**
 * Test: 28.09.2026, аудит по прямому указанию пользователя ("делай все пункты" по критичным
 * находкам). Класс бага (см. память агента incident_checkall_flush_wipes_server_credits):
 * контроллеры, которые пишут валюту/предметы НАПРЯМУЮ на сервере в обход общего 500мс-автосейва
 * (player-save.js), уязвимы к гонке — независимый автосейв (debounce/periodic/hidden/pagehide)
 * может улететь СО СТАРЫМ udata ровно в окне "клик → ответ сервера" и затереть свежую запись.
 * suspendPlayerSave()/resumePlayerSave() перекрывают это окно — паттерн уже применён у
 * bosses.attack/claimKill, dvor-poker-game.js, habar.js, bank.js. На 28.09.2026 не были
 * защищены: base.js (upgrade/train), vassilich.js (buy/open_loot), weapons.js (upgrade/buy),
 * shmot.js (equip/buy), zone.js (fillCheckpoint/captureLocation/upgradeBusiness/collectIncome).
 *
 * Этот тест проверяет структурно (не текстово-хрупко к деталям reward-логики), что у каждого
 * такого TS.php(...)-вызова: (1) suspendPlayerSave(label) стоит ПЕРЕД вызовом, (2) applyPatch()
 * в успешном колбэке идёт ПЕРЕД resumePlayerSave(label) (порядок важен — см. комментарии в
 * bosses-combat.js), (3) resumePlayerSave(label) вызывается и в ветке "нет patch", и в
 * error-колбэке — иначе suspend "зависает" навсегда при сетевой ошибке/некорректном ответе.
 *
 * Расширено тем же 28.09.2026 (расследование репорта "покупка всё ещё странно себя ведёт", см.
 * SESSION_HANDOFF_27_09_2026.md пункт 4) до ВСЕХ остальных найденных в проекте мест, которые
 * пишут валюту/награду напрямую на сервере: skills.js, dvor-dice-game.js, dvor-roulette-buy.js,
 * hata.js, ryukzak.js, yashik.js. Отдельно: dvor-roulette-buy.js.buyBluePoints() до этой правки
 * ОПТИМИСТИЧНО предсказывал coins/blue_points ДО ответа сервера (тот же класс гонки, что уже
 * чинили для base.js/vassilich.js/shmot.js/weapons.js) — Test "roulette-buy: без оптимистичного
 * предсказания баланса" ниже проверяет, что это убрано.
 *
 * Run: node tests/suspend-playersave-coverage-base-vassilich-weapons-shmot-zone.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game');

// { файл, endpoint (строка первого аргумента TS.php), label (строка suspend/resume) }
const CASES = [
    { file: 'base.js',       endpoint: 'base.upgrade',          label: 'base_upgrade' },
    { file: 'base.js',       endpoint: 'base.train',            label: 'base_train' },
    { file: 'vassilich.js',  endpoint: 'vassilich.buy',          label: 'vassilich_buy' },
    { file: 'vassilich.js',  endpoint: 'vassilich.open_loot',    label: 'vassilich_open_loot' },
    { file: 'weapons.js',    endpoint: 'weapons.upgrade',        label: 'weapons_upgrade' },
    { file: 'weapons.js',    endpoint: 'weapons.buy',            label: 'weapons_buy' },
    { file: 'shmot.js',      endpoint: 'shmot.equip',            label: 'shmot_equip' },
    { file: 'shmot.js',      endpoint: 'shmot.buy',              label: 'shmot_buy' },
    { file: 'zone.js',       endpoint: 'zone.fillCheckpoint',    label: 'zone_fill_checkpoint' },
    { file: 'zone.js',       endpoint: 'zone.captureLocation',   label: 'zone_capture' },
    { file: 'zone.js',       endpoint: 'zone.upgradeBusiness',   label: 'zone_upgrade_business' },
    { file: 'zone.js',       endpoint: 'zone.collectIncome',     label: 'zone_collect_income' },
    { file: 'skills.js',                              endpoint: 'skills.upgrade',       label: 'skills_upgrade' },
    { file: 'dvor/dvor-dice-game.js',                  endpoint: 'dice.start',           label: 'dice_start' },
    { file: 'dvor/dvor-dice-game.js',                  endpoint: 'dice.resolve',         label: 'dice_resolve' },
    { file: 'dvor/dvor-roulette-buy.js',               endpoint: 'roulette.buyPoints',   label: 'roulette_buy_points' },
    { file: 'dvor/dvor-roulette-buy.js',               endpoint: 'roulette.openCase',    label: 'roulette_open_case' },
    { file: 'shell/overlays/hata.js',                  endpoint: 'hata.buy',             label: 'hata_buy' },
    { file: 'shell/overlays/ryukzak.js',               endpoint: 'ryukzak.open',         label: 'ryukzak_open' },
    { file: 'shell/overlays/yashik.js',                endpoint: 'yashik.openBox',       label: 'yashik_open' },
    { file: 'shell/overlays/yashik.js',                endpoint: 'yashik.buyPatron',     label: 'yashik_buy_patron' },
    { file: 'shell/overlays/yashik.js',                endpoint: 'yashik.collect',       label: 'yashik_collect' },
];

const fileCache = {};
function readGameFile(name){
    if (!fileCache[name]) fileCache[name] = fs.readFileSync(path.join(root, name), 'utf-8');
    return fileCache[name];
}

for (const { file, endpoint, label } of CASES) {
    console.log(`\nTest: ${file} — ${endpoint} (label '${label}')`);
    const src = readGameFile(file);

    const callMarker = `TS.php('${endpoint}'`;
    const callIdx = src.indexOf(callMarker);
    assert(callIdx > -1, `вызов TS.php('${endpoint}', ...) найден`);
    if (callIdx === -1) continue;

    // 1) suspendPlayerSave(label) стоит непосредственно перед вызовом (в пределах 600 символов —
    //    достаточно для комментария + одной строки if(...), даже у многострочных комментариев).
    const before = src.slice(Math.max(0, callIdx - 600), callIdx);
    const suspendRe = new RegExp(`suspendPlayerSave\\('${label}'\\)`);
    assert(suspendRe.test(before), `suspendPlayerSave('${label}') вызывается перед запросом`);

    // Тело следующих ~3500 символов после вызова — с запасом покрывает оба колбэка (успех +
    // ошибка) даже у самых длинных проверяемых endpoint'ов в этом проекте.
    const after = src.slice(callIdx, callIdx + 3500);
    const resumeRe = new RegExp(`resumePlayerSave\\('${label}'\\)`, 'g');
    const resumeCount = (after.match(resumeRe) || []).length;
    // Минимум 2 вызова resume: один в успешном пути (после applyPatch либо в ветке "нет patch"),
    // один в error-колбэке. У некоторых endpoint'ов (ранний return при "нет patch") их 3.
    assert(resumeCount >= 2, `resumePlayerSave('${label}') встречается минимум дважды (успех + ошибка), найдено: ${resumeCount}`);

    // 2) applyPatch() идёт ПЕРЕД СВОИМ resumePlayerSave(label) в успешном колбэке — порядок
    //    важен: иначе отложенный автосейв в момент resume может уйти ещё до применения patch.
    //    Ищем НАСТОЯЩИЙ вызов (с аргументом вроде applyPatch(res.patch)), не упоминание в
    //    комментарии (у части файлов в комментарии рядом стоит "applyPatch() ПЕРЕД
    //    resumePlayerSave()" — пустые скобки, без аргумента, не должно матчиться). И берём
    //    ПЕРВЫЙ resumePlayerSave(label) ПОСЛЕ этого вызова — не первый в окне вообще: в ветке
    //    "нет patch" resumePlayerSave() легитимно стоит РАНЬШЕ applyPatch() успешной ветки, и
    //    это не нарушение инварианта (разные ветки, а не один и тот же путь).
    const applyCallMatch = after.match(/applyPatch\(\s*[a-zA-Z_$][\w.]*\s*\)/);
    const applyIdx = applyCallMatch ? applyCallMatch.index : -1;
    const resumeAfterApply = applyIdx > -1 ? after.slice(applyIdx).search(resumeRe) : -1;
    assert(applyIdx > -1 && resumeAfterApply > -1,
        `applyPatch(...) вызывается раньше своего resumePlayerSave('${label}') в успешном колбэке`);
}

console.log('\nTest: dvor-roulette-buy.js.buyBluePoints() — без оптимистичного предсказания баланса');
{
    const src = readGameFile('dvor/dvor-roulette-buy.js');
    const fnStart = src.indexOf('const buyBluePoints = (pkg)=>{');
    const fnEnd = src.indexOf('ROUL_PKGS.forEach((pkg, idx)=>{', fnStart);
    assert(fnStart > -1 && fnEnd > fnStart, 'функция buyBluePoints() найдена');
    const body = src.slice(fnStart, fnEnd);

    // До 28.09.2026 здесь была прямая запись udata['coins']/udata['blue_points'] ДО ответа
    // сервера (см. коммент в файле "по репорту 'покупка всё ещё странно себя ведёт'") — теперь
    // единственное место, где эти поля меняются, — applyPatch() внутри колбэка TS.php.
    assert(!/udata\['coins'\]\s*=\s*coinsAfter/.test(body), 'нет оптимистичной записи udata[\'coins\'] до ответа сервера');
    assert(!/udata\['blue_points'\]\s*=\s*pointsAfter/.test(body), 'нет оптимистичной записи udata[\'blue_points\'] до ответа сервера');
    assert(/suspendPlayerSave\('roulette_buy_points'\)/.test(body), 'suspendPlayerSave окружает запрос');
    assert(/applyPatch\(result\.patch\)/.test(body), 'баланс применяется только через applyPatch(result.patch)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
