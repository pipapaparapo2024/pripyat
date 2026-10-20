/**
 * Test: 20.10.2026, по прямому указанию — "хабар покупается на 30 дней. Дни отчитываются от дня
 * покупки, а не от количества сборов. Обнуление хабара идёт раз в сутки по московскому времени,
 * в 00:00. Если игрок не потратил весь допустимый урон Седого до полуночи — остаток сгорает, не
 * копится."
 *
 * Было: срок действия хабара считался по ЧИСЛУ УСПЕШНЫХ СБОРОВ (habar_days_collected >= 30) —
 * игрок, пропустивший часть дней, мог растянуть один хабар на много больше 30 КАЛЕНДАРНЫХ дней.
 * Кулдаун между сборами был скользящим окном "24 часа с момента ПРЕДЫДУЩЕГО сбора"
 * (habar_last_collect_ts + cooldown_ms), а не фиксированной МСК-полночью — собрав в 23:00, игрок
 * не мог собрать снова до следующих 23:00, а не с 00:00.
 *
 * Стало:
 *  1) Новое поле `habar_bought_ts` (момент покупки, мс) — habar.php.buy() проставляет его.
 *     collectDay() отклоняет сбор (код 58), если now >= habar_bought_ts + 30×86400000. Для
 *     аккаунтов, купивших хабар ДО миграции (habar_bought_ts ещё 0) — ленивый бэкфилл на
 *     "сегодня" при первом же collectDay() после деплоя (не мгновенно просрочивает уже
 *     оплаченную покупку); server/migrate50.php делает тот же бэкфилл сразу для всех разом.
 *  2) Кулдаун между сборами — Gameops::mskDailyDate() (тот же источник правды, что у дневных
 *     лимитов боссов/покера/блэкджека): доступно не чаще раза за МСК-календарный день, граница
 *     ровно 00:00 МСК, а не "через 24ч от последнего клика".
 *  3) Пул урона Седого (sedoy_dmg_total/sedoy_dmg_left) — логика НЕ менялась: каждый сбор
 *     перезаполняет его заново (не накапливает остаток с прошлого раза) — то есть "сгорание
 *     неизрасходованного остатка" уже было реализовано корректно, проверяем, что это осталось так.
 *  4) habar_days_collected по-прежнему пишется (статистика/дебаг, нужна заданиям — см.
 *     zadaniya-habar-tasks-unreachable-key-fixed.test.js), но БОЛЬШЕ НЕ участвует в проверке
 *     истечения и не показывается на экране (habar.js — счётчик "N/30" убран целиком).
 *
 * Run: node tests/habar-30-days-from-purchase-msk-daily-reset.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf-8');

const habarPhp = read('server/core/controllers/habar.php');
const usersPhp = read('server/core/controllers/users.php');
const habarJs  = read('_client/src/game/habar.js');
const cfg      = JSON.parse(read('server/json/habar_daily_config.json'));

console.log('\nTest 1: habar.php.buy() — записывает habar_bought_ts (момент покупки)');
{
    assert(/\$lockCols = \['habar_bought', 'habar_bought_ts', 'habar_counts', \$cur\];/.test(habarPhp),
        'habar_bought_ts залочен той же SELECT...FOR UPDATE транзакцией, что и habar_bought');
    assert(/\$lockedUser\['habar_bought_ts'\] = intval\(round\(microtime\(true\) \* 1000\)\);/.test(habarPhp),
        'buy() проставляет habar_bought_ts серверным временем (microtime), не доверяя клиенту');
    assert(/\$patchKeys = array_merge\(\[\$cur, 'habar_counts', 'habar_bought', 'habar_bought_ts'\]/.test(habarPhp),
        'habar_bought_ts возвращается клиенту в patch сразу при покупке');
}

console.log('\nTest 2: habar.php.collectDay() — истечение считается от habar_bought_ts (30 дней), не от числа сборов');
{
    assert(/if\(\$now >= \$boughtTs \+ \$totalDays \* 86400000\)\{[\s\S]{0,120}?return \$this->ops->fail\(58\);/.test(habarPhp),
        'отклоняет сбор, если 30×86400000мс с момента покупки прошли');
    assert(!/\$collected = \$this->ops->i\(\$lockedUser, 'habar_days_collected'\);\s*\n\s*\$totalDays = intval\(\$cfg\['total_days'\]\);\s*\n\s*if\(\$collected >= \$totalDays\)/.test(habarPhp),
        'старая проверка "collected >= totalDays" (лимит по числу сборов) не встречается');
    assert(/\$boughtTs = \$this->ops->i\(\$lockedUser, 'habar_bought_ts'\);/.test(habarPhp), 'читает habar_bought_ts из залоченной копии');
}

console.log('\nTest 3: habar.php.collectDay() — ленивый бэкфилл habar_bought_ts для аккаунтов, купивших ДО миграции');
{
    assert(/if\(\$boughtTs <= 0\)\{[\s\S]{0,400}?\$boughtTs = \$now;[\s\S]{0,100}?\$lockedUser\['habar_bought_ts'\] = \$boughtTs;/.test(habarPhp),
        'если habar_bought_ts ещё 0 (старая покупка) — проставляет "сегодня", не мгновенно просрочивает хабар');
}

console.log('\nTest 4: habar.php.collectDay() — кулдаун сбора стал МСК-календарным днём, не скользящим окном');
{
    assert(/\$this->ops->mskDailyDate\(intval\(\$lastTs \/ 1000\)\) === \$this->ops->mskDailyDate\(intval\(\$now \/ 1000\)\)/.test(habarPhp),
        'сравнивает МСК-дату последнего сбора и текущую (Gameops::mskDailyDate — единственный источник правды)');
    assert(!/\$cooldownMs = intval\(\$cfg\['cooldown_ms'\]\);/.test(habarPhp), 'старое чтение cooldown_ms из конфига убрано');
    assert(cfg.cooldown_ms === undefined, 'cooldown_ms убран из habar_daily_config.json (больше не нужен)');
    assert(cfg.total_days === 30, 'total_days остался 30 — теперь это дни от покупки, а не лимит сборов');
}

console.log('\nTest 5: habar.php.collectDay() — пул урона Седого по-прежнему НЕ накапливается между сборами (сгорает)');
{
    assert(/\$sedoyMax = max\(\$this->ops->i\(\$lockedUser, 'sedoy_dmg_total'\), \$amount\);/.test(habarPhp),
        'sedoy_dmg_total пересчитывается максимумом (не плюсуется к остатку)');
    assert(/\$lockedUser\['sedoy_dmg_left'\]  = \$sedoyMax;/.test(habarPhp),
        'sedoy_dmg_left ПЕРЕЗАПИСЫВАЕТСЯ новым значением (не прибавляется к тому, что осталось от прошлого раза) — непотраченный остаток сгорает');
}

console.log('\nTest 6: server/migrate50.php — ALTER TABLE + бэкфилл для уже купивших хабар');
{
    const migPath = path.join(root, 'server', 'migrate50.php');
    assert(fs.existsSync(migPath), 'server/migrate50.php существует');
    const mig = fs.readFileSync(migPath, 'utf-8');
    assert(/ADD COLUMN `habar_bought_ts` VARCHAR\(64\) DEFAULT '0'/.test(mig), 'добавляет колонку habar_bought_ts');
    assert(/WHERE `habar_bought` > 0 AND \(`habar_bought_ts` IS NULL OR `habar_bought_ts` = '' OR `habar_bought_ts` = '0'\)/.test(mig),
        'бэкфиллит только уже купивших хабар без записанной даты покупки');
    assert(/\$_GET\['key'\] !== 'stalker_migrate50_2026'/.test(mig), 'защищён ключом, как и остальные одноразовые миграции проекта');
}

console.log('\nTest 7: users.php — habar_bought_ts НЕ в client-writable whitelist, сбрасывается вместе с остальными habar-полями');
{
    const allowedIdx = usersPhp.indexOf('$allowed = [');
    const allowedEnd = usersPhp.indexOf('\n            ];', allowedIdx);
    const allowedBody = usersPhp.slice(allowedIdx, allowedEnd);
    assert(!/'habar_bought_ts'/.test(allowedBody), 'habar_bought_ts не в $allowed — клиент не может подделать дату покупки через users.save');

    const resetIdx = usersPhp.indexOf('function resetSession()');
    const resetEnd = usersPhp.indexOf('\n            ];', resetIdx);
    const resetBody = usersPhp.slice(resetIdx, resetEnd);
    assert(/'habar_bought_ts'\s*=>\s*0,/.test(resetBody), 'resetSession() обнуляет habar_bought_ts (одиночный сброс аккаунта)');

    const defIdx = usersPhp.indexOf('private function _defaultResetUdata()');
    const defBody = usersPhp.slice(defIdx, usersPhp.indexOf('\n            ];', defIdx));
    assert(/'habar_bought_ts'=>'0'/.test(defBody), '_defaultResetUdata() тоже обнуляет habar_bought_ts (resetAllPlayers())');
}

console.log('\nTest 8: habar.js — UI больше не использует скользящий кулдаун, считает МСК-день локально для отображения');
{
    assert(!/HABAR_COLLECT_COOLDOWN_MS/.test(habarJs), 'старая константа 24ч-кулдауна убрана');
    assert(/const HABAR_TOTAL_DAYS_MS = 30 \* 24 \* 60 \* 60 \* 1000;/.test(habarJs), 'новая константа — 30 дней в мс (срок действия от покупки)');
    assert(/function _mskDayKey\(tsMs\)\{/.test(habarJs), 'локальный МСК-день хелпер определён (та же формула +3ч, что на сервере/bosses.js._today())');
    assert(/const expired = boughtTs > 0 && now >= boughtTs \+ HABAR_TOTAL_DAYS_MS;/.test(habarJs),
        '_updateHabarTimer вычисляет expired от habar_bought_ts, не от habar_days_collected');
    assert(/const collectedToday = lastTs > 0 && _mskDayKey\(lastTs\) === _mskDayKey\(now\);/.test(habarJs),
        '_updateHabarTimer вычисляет collectedToday сравнением МСК-дат');
    assert(/const canCollect = !expired && !collectedToday;/.test(habarJs), 'кнопка доступна, когда хабар не истёк и сегодня ещё не собирался');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
