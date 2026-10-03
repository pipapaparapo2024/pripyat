/**
 * Test: батч 24.09.2026 (по прямому указанию + скриншот) — "лимит 7 убийств на сегодня
 * исчерпан, но бой всё равно открылся; атаковать нельзя; выйти можно только через
 * 'ВЫЙТИ ИЗ БОЯ' (форфейт)".
 *
 * Корень: кнопка "ЕЩЁ РАЗ" на попапе результата боя (boss_result.js) звала
 * iface._openBossesFight(bossIdx, diffIdx) НАПРЯМУЮ, в обход тех же проверок (дневной лимит
 * убийств / ключи), которые обычная кнопка НАПАСТЬ делает в bosses_select.js._onNapastClick()
 * ПЕРЕД входом в бой. Сервер bosses.php.startFight() тоже не проверял дневной лимит вообще —
 * лимит проверял только claimKill() при добивании босса. Итог: игрок мог открыть НОВУЮ попытку
 * боя (полный HP, свежий 9-часовой таймер) против босса, лимит по которому уже исчерпан —
 * попытку, которую нельзя ни выиграть (claimKill вернул бы код 62), ни атаковать (клиентский
 * предчек в bosses-combat.js._attack() блокирует), единственным выходом оставался форфейт.
 *
 * Фикс — оба конца одной цепочки:
 *  1) boss_result.js — "ЕЩЁ РАЗ" теперь проверяет дневной лимит и ключи, ДО открытия боя (та же
 *     логика, что bosses_select.js._onNapastClick()).
 *  2) bosses.php.startFight() — сервер как источник истины сам проверяет дневной лимит для
 *     ГЕНУИННО нового старта (ветка $existing<=0), не полагаясь на то, что клиент всегда
 *     спросит первым — защищает от ЛЮБОГО будущего обходного пути, не только этого одного.
 *  3) bosses_fight.js — ошибка код 62 от startFight() показывает точное сообщение о лимите,
 *     а не общий "Не удалось начать бой".
 *
 * Run: node tests/boss-again-button-and-startfight-daily-limit-gate.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const resultSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');
const fightSrc  = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'bosses_fight.js'), 'utf-8');
const bossesPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');

console.log('\nTest 1: boss_result.js — кнопка "ЕЩЁ РАЗ" проверяет дневной лимит ДО открытия боя');
{
    const s = resultSrc.indexOf("againBtn.on('pointerdown', () => {");
    const e = resultSrc.indexOf('win.addChild(againBtn);', s);
    assert(s !== -1 && e !== -1, 'обработчик ЕЩЁ РАЗ найден');
    const body = resultSrc.slice(s, e);
    assert(/const dkills\s*=\s*\(dailyDate === today\) \? parseInt\(bosses\.dailyKills\[bossIdx\] \|\| 0\) : 0;/.test(body),
        'считает dkills той же формулой, что bosses_select.js._onNapastClick()');
    assert(/if\(dkills >= limit\)\{/.test(body), 'блокирует, если лимит уже достигнут');
    // 29.09.2026: текст сообщения сменился с "убийств" на "попыток" — см.
    // tests/boss-daily-attempt-spent-on-any-outcome.test.js (лимит теперь тратится за любой
    // исход попытки, не только за победу), формулировка обновлена вслед за смыслом.
    assert(/notify\.showResult\(\{text:'Лимит ' \+ limit \+ ' попыток на сегодня исчерпан!'\}, 0\);/.test(body),
        'показывает то же сообщение о лимите, что и обычная кнопка НАПАСТЬ');
    // 29.09.2026: bosses._hasKeyring() добавлен ПЕРЕД этим условием во всех клиентских
    // предчеках ключей сразу (см. keyring-client-side-attack-gates.test.js) — владелец
    // "Связки ключей" не должен натыкаться на этот же чек ЕЩЁ РАЗ, раз сервер (bosses.php.
    // startFight()) её уже пропускает для него безусловно.
    assert(/if\(!bosses\._hasKeyring\(\) && need > 0 && have < need\)\{/.test(body), 'дополнительно проверяет ключи (та же дыра могла случиться и для ключей), учитывая Связку ключей');
}

console.log('\nTest 2: boss_result.js — регресс-гвард, что iface._openBossesFight() вызывается ТОЛЬКО после прохождения проверок (не удалён сам функционал)');
{
    const s = resultSrc.indexOf("againBtn.on('pointerdown', () => {");
    const e = resultSrc.indexOf('win.addChild(againBtn);', s);
    const body = resultSrc.slice(s, e);
    assert(/if\(window\.iface && typeof iface\._openBossesFight === 'function'\) iface\._openBossesFight\(bossIdx, diffIdx\);/.test(body),
        'после успешных проверок бой всё равно открывается как раньше');
}

console.log('\nTest 3: bosses.php.startFight() — сервер сам проверяет дневной лимит для генуинно нового старта боя');
{
    const s = bossesPhp.indexOf('function startFight(){');
    const e = bossesPhp.indexOf('\n        }', bossesPhp.indexOf("\$this->ops->ok(['patch' => \$patch, 'bossStartMs' => \$activeStartMs,", s));
    assert(s !== -1, 'startFight() найдена');
    const body = bossesPhp.slice(s, e);

    const existingIdx = body.indexOf('if($existing <= 0){');
    assert(existingIdx !== -1, 'ветка "существующего боя нет" найдена');
    const newFightBody = body.slice(existingIdx, body.indexOf('$data[\'bossStartMs\'][$diffIdx][$bossId] = $now;', existingIdx));

    assert(/\$limit = intval\(\$catalog\['daily_kill_limit'\]\);/.test(newFightBody), 'лимит читается из bosses_config.json (тот же каталог, что claimKill())');
    assert(/if\(intval\(\$data\['dailyKills'\]\[\$bossId\]\) >= \$limit\) return \$this->ops->fail\(62\);/.test(newFightBody),
        'КРИТИЧНО: startFight() отказывает кодом 62, если дневной лимит для этого босса уже исчерпан');
    // Регресс-гвард: проверка лимита стоит ДО списания ключей — не тратим ключи на попытку,
    // которая всё равно будет отклонена.
    // 25.09.2026 (общий ключ Баркута/Бороды, см. tests/bosses-server-authoritative-fight-start.test.js):
    // списание ключей теперь идёт по $keySlot, не по $bossId напрямую.
    const limitPos = newFightBody.indexOf('return $this->ops->fail(62);');
    const keysPos  = newFightBody.indexOf('$data[\'keys\'][$keySlot] = intval($data[\'keys\'][$keySlot]) - $needKeys;');
    assert(limitPos !== -1 && keysPos !== -1 && limitPos < keysPos, 'проверка лимита стоит РАНЬШЕ списания ключей');
}

console.log('\nTest 4: bosses.php.startFight() — регресс-гвард, что УЖЕ идущий бой (ветка $existing>0) НЕ трогается этой проверкой (можно всегда доиграть/просмотреть)');
{
    const s = bossesPhp.indexOf('function startFight(){');
    const e = bossesPhp.indexOf('\n        }', bossesPhp.indexOf("\$this->ops->ok(['patch' => \$patch, 'bossStartMs' => \$activeStartMs,", s));
    const body = bossesPhp.slice(s, e);
    const existingBranchStart = body.indexOf('$existing = intval($data[\'bossStartMs\']');
    const newFightBranchStart = body.indexOf('if($existing <= 0){');
    const resumeSlice = body.slice(existingBranchStart, newFightBranchStart);
    assert(!/fail\(62\)/.test(resumeSlice), 'проверка лимита (fail(62)) физически находится ВНУТРИ ветки нового старта, не затрагивает возврат к уже идущему бою');
}

console.log('\nTest 5: bosses_fight.js — ошибка startFight() с кодом 62 показывает точное сообщение о лимите, а не общий фолбэк');
{
    const s = fightSrc.indexOf("TS.php('bosses.startFight'");
    const e = fightSrc.indexOf('}); // flushPlayerSave', s);
    assert(s !== -1 && e !== -1, 'колбэк TS.php(\'bosses.startFight\', ...) найден');
    const body = fightSrc.slice(s, e);
    assert(/if\(err && err\.code === 62\)\{/.test(body), 'ошибка проверяется на код 62');
    // 29.09.2026: "убийств" → "попыток" (см. tests/boss-daily-attempt-spent-on-any-outcome.test.js).
    assert(/notify\.showResult\(\{text: 'Лимит ' \+ limit \+ ' попыток на сегодня исчерпан!'\}, 0\);/.test(body),
        'показывает точное сообщение о лимите для кода 62');
    assert(/this\._openSidorovichError\('Не удалось начать бой', 'Проверьте ключи и зачистку локации'\);/.test(body),
        'общий фолбэк остался для всех остальных кодов ошибок');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
