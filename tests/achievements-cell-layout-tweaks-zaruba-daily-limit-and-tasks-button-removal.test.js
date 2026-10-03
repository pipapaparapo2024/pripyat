/**
 * Test: батч 22.09.2026 (несколько независимых правок по прямому указанию, один заход) —
 *
 *  1) svod-achievements.js: иконка карточки сдвинута (редактор позиций — x:60→54, y/w/h без
 *     изменений), название карточки сдвинуто (x:102→95, y:14→11), описание уменьшено
 *     (scale 0.965) и центрируется теперь относительно ПРОГРЕСС-БАРА (DESC_CENTER_X, формула
 *     от PROGRESS_BAR_X/W), а не всей ширины карточки — y уточнён 26→29.
 *
 *  2) interface-panels.js: кнопка/картинка "Ежедневные задания" убрана из правой панели HUD
 *     ЦЕЛИКОМ (была уже disabled/затемнена) — по прямому указанию "функционал оставь, а саму
 *     картинку, кнопку убери". Сам модуль Zadaniya не тронут.
 *
 *  3) zaruba.php: дневной лимит зарубы ВОЗВРАЩЁН — раньше в тот же день был убран целиком
 *     (per-target кулдаун), теперь по прямому указанию введён заново как ГЛОБАЛЬНЫЙ лимит один
 *     раз в сутки на любую цель (zaruba_last_ts, НЕ старый per-pair zaruba_cooldowns). Награда
 *     за победу остаётся 100 сигарет / 100 опыта (zaruba_config.json, не менялась).
 *
 * Run: node tests/achievements-cell-layout-tweaks-zaruba-daily-limit-and-tasks-button-removal.test.js
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

const achSrc     = readSrc('_client/src/game/svod/svod-achievements.js');
const panelsSrc  = readSrc('_client/src/game/interface/interface-panels.js');
const zarubaSrc  = readSrc('server/core/controllers/zaruba.php');
const usersSrc   = readSrc('server/core/controllers/users.php');
const profileSrc = readSrc('_client/src/game/shell/overlays/player_profile.js');

console.log('\nTest 1: svod-achievements.js — иконка сдвинута (ICON_X=54, было 60)');
{
    assert(/const ICON_X = 54;/.test(achSrc), 'ICON_X = 54 объявлен');
    assert(/c\._iconSpr\.x = ICON_X; c\._iconSpr\.y = ICON_CENTER_Y;/.test(achSrc), 'иконка-спрайт использует ICON_X');
    assert(/iconTxt\.x = ICON_X; iconTxt\.y = ICON_CENTER_Y;/.test(achSrc), 'фолбэк-эмодзи иконка тоже использует ICON_X (единая позиция для обоих режимов)');
}

console.log('\nTest 2: svod-achievements.js — название сдвинуто (NAME_X=95, NAME_Y=11, было 102/14)');
{
    assert(/const NAME_X = 95;/.test(achSrc), 'NAME_X = 95');
    assert(/const NAME_Y = 11;/.test(achSrc), 'NAME_Y = 11');
}

console.log('\nTest 3: svod-achievements.js — описание уменьшено и центрируется относительно прогресс-бара, не карточки');
{
    assert(/const DESC_SCALE = 0\.965;/.test(achSrc), 'DESC_SCALE = 0.965 (уменьшение размера текста)');
    assert(/const DESC_Y          = 29;/.test(achSrc), 'DESC_Y = 29 (было 26)');
    assert(/const DESC_CENTER_X = PROGRESS_BAR_X \+ PROGRESS_BAR_W \/ 2;/.test(achSrc),
        'DESC_CENTER_X вычислен от PROGRESS_BAR_X/W — центр прогресс-бара, а не CARD_W/2');
    assert(/descTxt\.scale\.set\(DESC_SCALE\);/.test(achSrc), 'scale применяется к самому объекту descTxt');
    assert(/descTxt\.x = DESC_CENTER_X; descTxt\.y = DESC_Y;/.test(achSrc), 'descTxt позиционируется через DESC_CENTER_X/DESC_Y');
    assert(!/descTxt\.x = CARD_W \/ 2;/.test(achSrc), 'старое центрирование по CARD_W/2 (вся карточка) убрано');
}

console.log('\nTest 4: interface-panels.js — «задания» убраны из rightCfg целиком, module Zadaniya не тронут');
{
    const start = panelsSrc.indexOf('const rightCfg = [');
    const end   = panelsSrc.indexOf('];', start);
    const rightCfgBlock = panelsSrc.slice(start, end);
    assert(!/mod:\s*'zadaniya'/.test(rightCfgBlock), 'zadaniya отсутствует в rightCfg — кнопка/картинка не рисуется вообще');
    assert(/'zadaniya'/.test(panelsSrc), "'zadaniya' по-прежнему упомянут где-то в файле (список _closeCurrentModule) — модуль не выпилен из кода целиком");
}

console.log('\nTest 5: zaruba.php.fight() — дневной лимит УБРАН целиком (реверс 25.09.2026, см. zaruba-no-limit-no-reward-and-friend-damage-asymmetry.test.js за подробностями)');
{
    const fightMatch = zarubaSrc.match(/function fight\(\)\{([\s\S]*?)\n        \}/);
    assert(!!fightMatch, 'fight() найден');
    const body = fightMatch ? fightMatch[1] : '';
    // 25.09.2026 (по прямому указанию — "на одного игрока можно нападать без ограничений по
    // количеству раз"): весь блок дневного лимита (Test 5 в исходной версии этого файла)
    // перевёрнут — эти же поля/коды теперь ДОЛЖНЫ отсутствовать.
    assert(!/\$lastFightMs = \$this->ops->i\(\$user, 'zaruba_last_ts', 0\);/.test(body), 'больше НЕ читает zaruba_last_ts');
    assert(!/return \$this->ops->fail\(93\);/.test(body), 'больше НЕ возвращает код 93 (дневной лимит убран)');
    assert(!/\$user\['zaruba_last_ts'\] = strval\(\$nowMs\);/.test(body), 'больше НЕ пишет zaruba_last_ts');
}

console.log('\nTest 6: миграция 27 добавляет zaruba_last_ts, users.php.resetSession() тоже его обнуляет');
{
    const migrateSrc = readSrc('server/migrate27.php');
    assert(/zaruba_last_ts/.test(migrateSrc), 'migrate27.php создаёт колонку zaruba_last_ts');
    assert(/VARCHAR\(32\) DEFAULT '0'/.test(migrateSrc), 'колонка — VARCHAR(32) DEFAULT \'0\' (таймстамп как строка, как остальные server-only ts-поля проекта)');

    assert(/'zaruba_last_ts'\s*=> null,/.test(usersSrc), 'resetSession() обнуляет zaruba_last_ts при полном сбросе аккаунта');
}

console.log('\nTest 7: player_profile.js — обработка кода 93 (дневной лимит) УБРАНА (реверс 25.09.2026)');
{
    const startBoundStart = profileSrc.indexOf('proto._startZaruba = function(win, profile){');
    const startBoundEnd   = profileSrc.indexOf('\n    };', startBoundStart);
    const body = profileSrc.slice(startBoundStart, startBoundEnd);
    assert(!/err && err\.code === 93/.test(body), 'больше НЕ проверяет код ошибки 93 — сервер его никогда не вернёт');
    assert(!/Зарубиться можно только один раз в день/.test(body), 'сообщение про дневной лимит убрано с клиента');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
