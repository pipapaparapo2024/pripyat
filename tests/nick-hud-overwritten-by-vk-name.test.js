/**
 * Test: батч 22.09.2026 — репорт пользователя "проблема с выводом имени, часто замечаю, и в
 * Сводке тоже".
 *
 * Найдено ДВА независимых бага:
 *
 *  1) ГЛАВНЫЙ: interface.js.updateNick() ВСЕГДА показывал имя ВКонтакте, полностью игнорируя
 *     udata['nick'] (кастомный позывной, который nick.js._saveNick() корректно сохраняет и
 *     на сервер, и локально). updateNick() вызывается из modules/patch.js.applyPatch() почти
 *     при ЛЮБОМ server-authoritative действии (убийство босса, заруба, качалка, покупки и
 *     т.д.) — первое же такое действие после смены ника молча откатывало HUD-подпись обратно
 *     на имя ВК. Тот же баг найден в game/top.js._renderList() (своя строка "Ты" в топе тоже
 *     показывала имя ВК вместо кастомного ника).
 *
 *  2) ВТОРОСТЕПЕННЫЙ: game/svod/svod-leaderboard.js и shell/overlays/bosses_fight.js рисуют
 *     ник игрока в списках без wordWrap — длинный ник вылезает за пределы узкого блока
 *     (106px в Сводке) и налезает на соседнюю колонку ("каша из букв"). player_profile.js уже
 *     использует wordWrap для похожего поля — паттерн защиты в проекте есть, просто не был
 *     применён везде.
 *
 * 22.09.2026 (повторный репорт ТЕМ ЖЕ ДНЁМ, по прямому указанию — "не переноси имя на вторую
 * строку, пиши подряд в одной строке"): wordWrap в svod-leaderboard.js УБРАН обратно — прямой
 * реверс пункта 2 выше. bosses_fight.js (рейтинг урона боя) не трогали, там wordWrap остался.
 *
 * Run: node tests/nick-hud-overwritten-by-vk-name.test.js
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

const interfaceSrc = readSrc('_client/src/game/interface.js');
const topSrc        = readSrc('_client/src/game/top.js');
const svodLbSrc      = readSrc('_client/src/game/svod/svod-leaderboard.js');
const bossesFightSrc = readSrc('_client/src/game/shell/overlays/bosses_fight.js');

console.log('\nTest 1: interface.js.updateNick() — кастомный ник (udata[\'nick\']) имеет приоритет над именем ВК');
{
    const start = interfaceSrc.indexOf('updateNick(){');
    const end   = interfaceSrc.indexOf('\n\t}', start);
    const body  = interfaceSrc.slice(start, end);

    assert(!!body && start !== -1, 'updateNick() найден');
    // Порядок важен: сначала фолбэк-цепочка 'Сталкер'→имя ВК, ПОТОМ явная перезапись кастомным
    // ником (если он есть) — а не наоборот, иначе пустой udata['nick'] выключал бы имя ВК.
    const vkAssignIdx   = body.indexOf("name = vk_user_info['first_name']");
    const nickAssignIdx = body.indexOf("if(udata['nick']) name = udata['nick'];");
    const textAssignIdx = body.indexOf("this.nick_txt.text = name;");
    assert(vkAssignIdx !== -1, 'имя ВК по-прежнему читается как фолбэк-вариант');
    assert(nickAssignIdx !== -1, 'добавлена проверка udata[\'nick\'] с приоритетной перезаписью');
    assert(vkAssignIdx < nickAssignIdx && nickAssignIdx < textAssignIdx,
        'порядок: сначала имя ВК как фолбэк, потом кастомный ник поверх него, потом присвоение в nick_txt.text — не наоборот');
}

console.log('\nTest 2: game/top.js._renderList() — своя строка "Ты" тоже использует кастомный ник, если он задан');
{
    const start = topSrc.indexOf('_renderList(catIdx){');
    const end   = topSrc.indexOf('\n\t\tconst myVal', start);
    const body  = topSrc.slice(start, end);

    assert(!!body && start !== -1, '_renderList() найден');
    assert(/if\(udata\['nick'\]\) myName = udata\['nick'\];/.test(body),
        'после вычисления myName из VK/udata[\'name\'] — кастомный ник перезаписывает его, если задан');
}

console.log('\nTest 3: svod-leaderboard.js — wordWrap убран обратно 22.09.2026 (по прямому указанию, реверс того же дня — "одна строка, без переноса")');
{
    const start = svodLbSrc.indexOf("const nameTxt = new PIXI.Text('', {");
    const end   = svodLbSrc.indexOf('\n            row.addChild(nameTxt);', start);
    const body  = svodLbSrc.slice(start, end);

    assert(!!body && start !== -1, 'создание nameTxt найдено');
    assert(!/wordWrap/.test(body), 'wordWrap убран — имя всегда одной строкой (может выйти за блок для длинных ников, это осознанный компромисс)');
}

console.log('\nTest 4: bosses_fight.js — ник в рейтинге урона боя тоже защищён wordWrap (доступная ширина до соседней колонки)');
{
    // 26.09.2026: плейсхолдер '—' убран (по прямому указанию — "три черточки"/"белая линия"
    // не нужны, пока в рейтинге ещё никого нет) — стартовое значение теперь пустая строка,
    // wordWrap-защита при этом не тронута.
    const start = bossesFightSrc.indexOf("const nameTxt = new PIXI.Text('', {");
    const end   = bossesFightSrc.indexOf('\n            win.addChild(nameTxt);', start);
    const body  = bossesFightSrc.slice(start, end);

    assert(!!body && start !== -1, 'создание nameTxt найдено');
    assert(/wordWrap:true/.test(body), 'wordWrap включён');
    // 08.10.2026 (фикс пикселизации текста): fontSize вынесен в итоговый размер (14×1.280≈18),
    // scale.set() убран — чтобы перенос строк не стал УЖЕ прежнего визуального, wordWrapWidth
    // домножен на тот же бывший коэффициент scale (×1.280).
    assert(/wordWrapWidth: \(LBL_X - NAME_X - 8\) \* 1\.280/.test(body),
        'ширина переноса вычислена от реального зазора до "Нанесенный урон:" (LBL_X - NAME_X), домножена на бывший scale 1.280');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
