/**
 * Test: батч 22.09.2026 (несколько независимых правок одним заходом, по прямому указанию с
 * референс-скриншотами) —
 *
 *  1) boss_result.js + bosses-combat.js: иконка шмотки на попапе "ТЫ ПОБЕДИЛ" теперь
 *     показывается и на ПРОГРЕСС ФРАГМЕНТА сета "ссср" (opts.shmotFragment), а не только на
 *     полную собранную вещь (opts.shmotAmount>0) — без подписи "+N" для фрагмента (это не
 *     "количество").
 *
 *  2) dev_panel.js: найден и исправлен реальный баг "сбросил БД — патроны не сбросились".
 *     Причина — weapons:''/shmot:'' в _resetAccount() не проходят users.php._sanitizeWeapons()/
 *     _sanitizeShmot() (json_decode('') === null → всё поле молча отклоняется, старый блоб
 *     остаётся в БД) — исправлено на weapons:'[]'/shmot:'[]' (валидный JSON). Плюс: у weapons
 *     (в отличие от shmot/zone/bosses) не было явного in-memory сброса после успешного
 *     сохранения — добавлен.
 *
 *  3) ryukzak.js: бирка/иконка тушёнки/число "20" переставлены на новые координаты (редактор
 *     позиций), попап подтверждения открытия рюкзака больше не дублирует текст, нижний HUD
 *     больше не показывается на экране рюкзака.
 *
 *  4) svod-leaderboard.js: имя игрока в "ОБЩИЙ ТОП" больше не переносится на вторую строку
 *     (wordWrap убран, по прямому указанию — реверс fix'а того же дня).
 *
 * Run: node tests/boss-result-popup-shmot-fragment-icon-and-batch-fixes.test.js
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

const bossResult   = readSrc('_client/src/game/shell/popups/boss_result.js');
const combatSrc     = readSrc('_client/src/game/bosses/bosses-combat.js');
const devPanelSrc   = readSrc('_client/src/game/shell/overlays/dev_panel.js');
const ryukzakSrc     = readSrc('_client/src/game/shell/overlays/ryukzak.js');
const leaderboardSrc = readSrc('_client/src/game/svod/svod-leaderboard.js');

console.log('\nTest 1: bosses-combat.js — передаёт shmotFragment в опции попапа победы');
{
    const start = combatSrc.indexOf('isWin: true,');
    const winStart = combatSrc.lastIndexOf('iface._showBossResultPopup({', start);
    const end   = combatSrc.indexOf('});', winStart);
    const body  = combatSrc.slice(winStart, end);
    assert(/shmotFragment: res\.bossShmotFragment \|\| null,/.test(body), 'shmotFragment прокидывается из res.bossShmotFragment');
}

console.log('\nTest 2: boss_result.js — иконка шмотки показывается на shmotAmount>0 ИЛИ shmotFragment, подпись "+N" только для полной вещи');
{
    const start = bossResult.indexOf('if(opts.shmotAmount > 0 || opts.shmotFragment){');
    assert(start !== -1, 'условие показа иконки расширено на shmotFragment');
    const end = bossResult.indexOf('\n            }', start);
    const body = bossResult.slice(start, end);
    assert(/const shmotIcon = _sprite\('боевка попап шмотка\.png', SHMOT_POS\);/.test(body), 'иконка — тот же файл "боевка попап шмотка.png" (namespaced, без коллизий)');
    assert(/if\(opts\.shmotAmount > 0\) _rewardLabel\(/.test(body), 'подпись количества рисуется ТОЛЬКО для полной вещи (фрагмент — без числа)');
}

console.log('\nTest 3: dev_panel.js._resetAccount() — weapons/shmot сбрасываются валидным JSON \'[]\', не пустой строкой');
{
    const start = devPanelSrc.indexOf('proto._resetAccount = function');
    const end   = devPanelSrc.indexOf('\n    };', start);
    const body  = devPanelSrc.slice(start, end);
    // 26.09.2026: inventory:'' (пустая строка, невалидный JSON) заменено на inventory:'[]' —
    // тот же класс бага, что уже был исправлен здесь для weapons ('' → '[]'), просто пропущен
    // при той правке (см. shmot-equip-cat-field-bug-and-inventory-reset-fix.test.js).
    assert(/gang_id:'0', gang_data:'\[\]', weapons:'\[\]', shmot:'\[\]', inventory:'\[\]',/.test(body),
        // 25.09.2026: shmot убран из whitelist users.php (см. shmot-equip-server-authoritative
        // .test.js) — эта строка в объекте _resetAccount() теперь просто мёртвый параметр (сам
        // сброс shmot идёт отдельным users.devGrantShmot() вызовом рядом), не трогаем — не
        // мешает и документирует прежний формат для сравнения.
        'weapons и inventory — валидный пустой JSON-массив \'[]\' (не \'\'), проходит _sanitizeWeapons/_sanitizeInventory');

    // Явный in-memory сброс weapons.data (тот же класс фикса, что уже был у shmot/zone/bosses).
    const weaponsBlockStart = body.indexOf('if(window.weapons){');
    assert(weaponsBlockStart !== -1, 'добавлен явный in-memory блок сброса window.weapons (аналог shmot/zone/bosses)');
    const weaponsBlockEnd = body.indexOf('\n                }', weaponsBlockStart);
    const weaponsBody = body.slice(weaponsBlockStart, weaponsBlockEnd);
    assert(/w\.owned\s*=\s*i <= 2;/.test(weaponsBody), 'нож/цепь/бита (id 0-2) — owned по умолчанию');
    assert(/w\.equipped = i === 0;/.test(weaponsBody), 'нож (id 0) экипирован по умолчанию');
    assert(/w\.upg\s*=\s*0;/.test(weaponsBody), 'апгрейды обнуляются');
    assert(/w\.qty\s*=\s*0;/.test(weaponsBody), 'боезапас/кол-во обнуляется');
}

console.log('\nTest 4: ryukzak.js — бирка/иконка тушёнки/число "20" на новых координатах (редактор позиций)');
{
    assert(/tushenkaTagSpr\.x = 774; tushenkaTagSpr\.y = 558;/.test(ryukzakSrc), 'бирка — x:774 y:558');
    assert(/tushenkaTagSpr\.scale\.set\(1\.162\);/.test(ryukzakSrc), 'бирка — scale 1.162');
    assert(/tushenkaIconSpr\.x = 831; tushenkaIconSpr\.y = 599;/.test(ryukzakSrc), 'иконка тушёнки — x:831 y:599');
    assert(/tushenkaIconSpr\.scale\.set\(1\.054\);/.test(ryukzakSrc), 'иконка тушёнки — scale 1.054');
    assert(/tushenkaIconSpr\.rotation = 52 \* Math\.PI \/ 180;/.test(ryukzakSrc), 'иконка тушёнки повёрнута на 52°');
    assert(/tushenkaQtyTxt\.x = 810; tushenkaQtyTxt\.y = 594;/.test(ryukzakSrc), 'число "20" — x:810 y:594');
    assert(/tushenkaQtyTxt\.scale\.set\(1\.328\);/.test(ryukzakSrc), 'число "20" — scale 1.328');
    assert(/tushenkaQtyTxt\.rotation = 52 \* Math\.PI \/ 180;/.test(ryukzakSrc), 'число "20" повёрнуто на 52° (в паре с иконкой)');
}

console.log('\nTest 5: ryukzak.js — попап подтверждения открытия рюкзака больше не дублирует текст');
{
    assert(/this\._showConfirmPopup\(''\s*,\s*\(\)=>\{/.test(ryukzakSrc), '_showConfirmPopup вызывается с пустой строкой — динамический текст убран');
    assert(!/_showConfirmPopup\('Открыть рюкзак за 20 тушёнки\?'/.test(ryukzakSrc),
        'старый текст больше не передаётся АРГУМЕНТОМ (может упоминаться только в explanatory-комментарии)');
}

console.log('\nTest 6: ryukzak.js — открывается просто поверх текущего экрана, ХУД не прячет (25.09.2026, см. tests/ryukzak-hud-and-birka-zorder.test.js)');
{
    assert(ryukzakSrc.includes("this.pushHud('ryukzak', {});"),
        "открытие Рюкзака регистрируется через pushHud('ryukzak', {}) — ХУД остаётся видимым, попап просто накладывается сверху");
    assert(!ryukzakSrc.includes('const placeHudUnderRyukzak'), 'старая ручная функция placeHudUnderRyukzak убрана (заменена декларативным стеком)');
}

console.log('\nTest 7: svod-leaderboard.js — имя игрока в ОБЩИЙ ТОП без wordWrap (одна строка)');
{
    const start = leaderboardSrc.indexOf("const nameTxt = new PIXI.Text('', {");
    const end   = leaderboardSrc.indexOf('});', start);
    const body  = leaderboardSrc.slice(start, end);
    assert(!/wordWrap/.test(body), 'wordWrap убран из стиля nameTxt — имя не переносится на вторую строку');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
