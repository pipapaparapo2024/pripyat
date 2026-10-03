/**
 * Test: 28.09.2026, по прямому указанию — три связанных изменения:
 *
 * 1) Дневной лимит убийств боссов должен сбрасываться в 12:00 по МСК, а не в полночь по
 *    серверным часам (которые нигде явно не выставлены в date_default_timezone_set() — де-факто
 *    UTC-полночь = 03:00 МСК, см. php_errors.log). Фикс — server/core/models/gameops.php.
 *    Gameops::mskDailyDate(): МСК = UTC+3 фиксированно (Россия отменила переход на летнее время
 *    в 2014 — DST не бывает), gmdate() всегда считает от UTC независимо от timezone-настроек
 *    сервера, сдвиг эпохи на 9 часов (12 МСК - 3 смещения) даёт разворот календарной даты ровно
 *    в 09:00 UTC = 12:00 МСК. Применено в bosses.php (startFight/claimKill) — оба места раньше
 *    звали голый date('Y-m-d'). Клиент (_client/src/game/bosses.js._today()) зеркалит ту же
 *    формулу через UTC-геттеры (не локальные getFullYear/getMonth/getDate) — иначе UX-подсказка
 *    "убийств сегодня: N/7" могла бы не совпадать с реальным серверным днём для игроков не в
 *    московском поясе.
 *
 * 2) 28.09.2026 (по прямому указанию, после аудита — "и остальные дневные системы тоже на
 *    12:00 МСК"): та же Gameops::mskDailyDate() применена и к дневному лимиту покера
 *    (poker.php.deal()), дневной бесплатной раздаче блэкджека (blackjack.php._dailyState()) и
 *    дневным заданиям (tasks.php._loadOrGenerateSession()) — раньше каждый использовал СВОЙ
 *    вызов date('Y-m-d')/gmdate('Y-m-d'), теперь единая точка на весь проект. Заодно
 *    blackjack.php.nextFreeAt (обратный отсчёт до бесплатной раздачи, раньше strtotime
 *    ('tomorrow') — полночь по локальным часам сервера) переведён на Gameops::mskNextResetMs() —
 *    синхронизирован с той же границей 12:00 МСК, что и сам сброс, а не с отдельной, теперь не
 *    совпадающей полуночью. (habar.php/dvor.php НЕ тронуты — это роллинг-кулдауны от момента
 *    последнего действия, не привязанные к календарному дню, МСК-граница к ним неприменима.)
 *
 * 3) Кулдаун бесплатного оружия (нож/цепь/бита, 6 часов) стал ОБЩИМ на все три вместо трёх
 *    независимых — удар любым из них теперь блокирует остальные два тоже, а ускорение за 20р
 *    снимает откат сразу у всех троих. См. tests/free-weapon-cd.test.js и
 *    tests/free-weapon-cooldown-not-wiped-on-fight-end.test.js для детальных поведенческих
 *    проверок — этот файл проверяет структуру серверного/клиентского кода целиком (что helper-
 *    функции реально существуют и вызываются в нужных местах), а не только формулу.
 *
 * Run: node tests/boss-daily-reset-msk-and-free-weapon-shared-cd.test.js
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

const gameopsPhp  = readSrc('server/core/models/gameops.php');
const bossesPhp   = readSrc('server/core/controllers/bosses.php');
const pokerPhp    = readSrc('server/core/controllers/poker.php');
const blackjackPhp= readSrc('server/core/controllers/blackjack.php');
const tasksPhp    = readSrc('server/core/controllers/tasks.php');
const bossesJs    = readSrc('_client/src/game/bosses.js');
const combatJs    = readSrc('_client/src/game/bosses/bosses-combat.js');
const popupJs     = readSrc('_client/src/game/shell/overlays/weapon_reload_popup.js');

console.log('\nTest 1: Gameops::mskDailyDate()/mskNextResetMs() — 29.09.2026: разворот дня в 00:00 МСК (21:00 UTC), не в 12:00 МСК');
{
    // 29.09.2026 (по прямому указанию — уточнение "12" изначально означало полночь, не полдень):
    // формула сменилась с "12:00 МСК" (09:00 UTC, сдвиг -9ч) на "00:00 МСК" (21:00 UTC,
    // сдвиг +3ч) — см. tests/boss-daily-limit-reset-at-msk-midnight.test.js для полного
    // покрытия этой правки. Здесь просто актуализирован regex под новую формулу.
    assert(/function mskDailyDate\(\$now = null\)\{/.test(gameopsPhp), 'mskDailyDate() определена в Gameops (единая точка для всех контроллеров)');
    const start = gameopsPhp.indexOf('function mskDailyDate(');
    const end   = gameopsPhp.indexOf('\n    }', start);
    const body  = gameopsPhp.slice(start, end);
    assert(/return gmdate\('Y-m-d', \$now \+ 3 \* 3600\);/.test(body),
        'gmdate() со сдвигом +3 часа — разворот ровно в 21:00 UTC = 00:00 МСК, не зависит от date.timezone сервера');
    assert(!/date\('Y-m-d'\)/.test(body), 'НЕ использует голый date() (зависящий от локальных часов PHP-процесса)');

    assert(/function mskNextResetMs\(\$now = null\)\{/.test(gameopsPhp), 'mskNextResetMs() определена');
    const nStart = gameopsPhp.indexOf('function mskNextResetMs(');
    const nEnd   = gameopsPhp.indexOf('\n    }', nStart);
    const nBody  = gameopsPhp.slice(nStart, nEnd);
    assert(/return strtotime\(\$today \. ' 21:00:00 UTC'\) \* 1000;/.test(nBody),
        'следующая граница — 21:00 UTC текущего игрового ($today) дня, БЕЗ +24ч (см. вывод в комментарии над функцией)');
}

console.log('\nTest 2: bosses.php (startFight/claimKill) больше НЕ держит свою копию формулы — использует $this->ops->mskDailyDate()');
{
    assert(!/private function _mskDailyDate/.test(bossesPhp), 'локальная _mskDailyDate() в bosses.php удалена (централизовано в Gameops)');

    const startFightIdx = bossesPhp.indexOf('function startFight(){');
    const claimKillIdx  = bossesPhp.indexOf('function claimKill(){');
    assert(startFightIdx !== -1 && claimKillIdx !== -1, 'sanity: обе функции найдены');

    const sfBlock = bossesPhp.slice(startFightIdx, bossesPhp.indexOf('daily_kill_limit', startFightIdx) + 400);

    assert(/\$today = \$this->ops->mskDailyDate\(\);/.test(sfBlock), 'startFight(): $today = $this->ops->mskDailyDate()');
    // 29.09.2026 (см. tests/boss-daily-attempt-spent-on-any-outcome.test.js — "лимиты атак не
    // заканчиваются"): dailyDate/dailyKills больше НЕ читаются/не сбрасываются в claimKill() —
    // попытка (и, соответственно, дневной rollover даты) теперь целиком считается в startFight(),
    // claimKill() полагается на уже актуальное значение. Раньше здесь стоял assert, что claimKill()
    // ТОЖЕ держит свою копию $today = mskDailyDate() — это было корректно ДО переноса и осталось
    // задокументированным тут для истории; текущая проверка — что копии там больше НЕТ (не
    // задвоенный источник правды).
    const ckBlock = bossesPhp.slice(claimKillIdx);
    assert(!/\$today = \$this->ops->mskDailyDate\(\);/.test(ckBlock),
        'claimKill(): больше не держит собственную $today = mskDailyDate() — dailyDate целиком управляется в startFight()');
}

console.log('\nTest 3: клиент (bosses.js._today()) зеркалит МСК-полночь через UTC-геттеры, не локальные часы устройства');
{
    const start = bossesJs.indexOf('_today(){');
    const end   = bossesJs.indexOf('\n    }', start);
    const body  = bossesJs.slice(start, end);
    // 29.09.2026: было "-9ч" (МСК-полдень), теперь "+3ч" (МСК-полночь) — см.
    // tests/boss-daily-limit-reset-at-msk-midnight.test.js для полного покрытия этой правки.
    assert(/Date\.now\(\) \+ 3 \* 60 \* 60 \* 1000/.test(body), 'та же формула сдвига на +3 часа, что и на сервере');
    assert(/getUTCFullYear\(\)/.test(body) && /getUTCMonth\(\)/.test(body) && /getUTCDate\(\)/.test(body),
        'использует UTC-геттеры (getUTCFullYear/getUTCMonth/getUTCDate) — не зависит от часового пояса устройства игрока');
    assert(!/getFullYear\(\)/.test(body) && !/getMonth\(\)/.test(body) && !/getDate\(\)/.test(body),
        'КРИТИЧНО: локальные геттеры (getFullYear/getMonth/getDate, часовой пояс устройства) больше не используются');
}

console.log('\nTest 4: poker.php (дневной лимит покера, dvor_daily) — тоже на Gameops::mskDailyDate()');
{
    assert(/\$today = \$this->ops->mskDailyDate\(\);/.test(pokerPhp), 'poker.php.deal(): $today = $this->ops->mskDailyDate()');
    assert(!/\$today = date\('Y-m-d'\);/.test(pokerPhp), 'старый голый date(\'Y-m-d\') не остался');
}

console.log('\nTest 5: blackjack.php._dailyState() — дневная бесплатная раздача И nextFreeAt синхронизированы с той же границей 12:00 МСК');
{
    const start = blackjackPhp.indexOf('private function _dailyState(&$session){');
    const end   = blackjackPhp.indexOf('\n        }', start);
    const body  = blackjackPhp.slice(start, end);
    assert(/\$today = \$this->ops->mskDailyDate\(\);/.test(body), '_dailyState(): $today = $this->ops->mskDailyDate()');
    assert(/'nextFreeAt' => \$this->ops->mskNextResetMs\(\),/.test(body),
        'nextFreeAt берётся из mskNextResetMs() — та же граница, что и сам сброс, а не отдельный strtotime(\'tomorrow\')');
    assert(!/strtotime\('tomorrow'\)/.test(body), 'старый strtotime(\'tomorrow\') (несинхронизированная полночь) не остался');
}

console.log('\nTest 6: tasks.php (дневные задания) — тоже на Gameops::mskDailyDate()');
{
    assert(/\$today = \$this->ops->mskDailyDate\(\);/.test(tasksPhp), '_loadOrGenerateSession(): $today = $this->ops->mskDailyDate()');
    assert(!/\$today = gmdate\('Y-m-d'\);/.test(tasksPhp), 'старый голый gmdate(\'Y-m-d\') (полночь UTC, не 12:00 МСК) не остался');
}

console.log('\nTest 7: сервер — общий кулдаун бесплатного оружия ($FREE_WPN_IDS + _freeWpnSharedLastUse)');
{
    assert(/private \$FREE_WPN_IDS = \[0, 1, 2\];/.test(bossesPhp), '$FREE_WPN_IDS = [0,1,2] объявлен');
    assert(/private function _freeWpnSharedLastUse\(\$cdMap\)\{/.test(bossesPhp), '_freeWpnSharedLastUse() определена');

    const start = bossesPhp.indexOf('private function _freeWpnSharedLastUse(');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/foreach\(\$this->FREE_WPN_IDS as \$fw\) \$lastUse = max\(\$lastUse, intval\(\$cdMap\[\$fw\] \?\? 0\)\);/.test(body),
        'берёт МАКСИМУМ среди всех трёх ключей (не $cdMap[$weaponId])');
}

console.log('\nTest 8: attack() — проверка КД и запись КД используют общий helper/foreach, не точечный $weaponId');
{
    assert(/\$lastUse = \$this->_freeWpnSharedLastUse\(\$cdMap\);/.test(bossesPhp),
        'attack(): проверка КД идёт через _freeWpnSharedLastUse(), не $cdMap[$weaponId]');
    assert(/foreach\(\$this->FREE_WPN_IDS as \$fw\) \$data\['freeWpnCdMs'\]\[\$fw\] = \$now;/.test(bossesPhp),
        'attack(): удар пишет $now во все три ключа сразу');
}

console.log('\nTest 9: rushFreeWeapon() — проверка и сброс КД тоже общие (не только для переданного weapon_id)');
{
    const start = bossesPhp.indexOf('function rushFreeWeapon(){');
    const end   = bossesPhp.indexOf('\n        }', bossesPhp.indexOf('$this->ops->ok(', start));
    const body  = bossesPhp.slice(start, end);
    assert(/\$lastUse = \$this->_freeWpnSharedLastUse\(\$cdMap\);/.test(body),
        'проверка "оружие на кулдауне" — через общий helper');
    assert(/foreach\(\$this->FREE_WPN_IDS as \$fw\) \$cdMap\[\$fw\] = 0;/.test(body),
        'сброс обнуляет ВСЕ три ключа одним запросом, не только $weaponId');
    assert(!/\$cdMap\[\$weaponId\] = 0;/.test(body),
        'КРИТИЧНО: старый точечный сброс единственного $weaponId больше не остался');
}

console.log('\nTest 10: клиент (bosses-combat.js) — _freeWpnSharedLastUse() определена и используется и в проверке, и в записи после удара');
{
    assert(/proto\._freeWpnSharedLastUse = function\(\)\{/.test(combatJs), '_freeWpnSharedLastUse() определена как proto-метод');
    assert(/const lastUse = this\._freeWpnSharedLastUse\(\);/.test(combatJs), '_attack(): проверка КД идёт через общий helper');
    assert(/\['0','1','2'\]\.forEach\(k => \{ this\._freeWpnLastMs\[k\] = now; \}\);/.test(combatJs),
        'после успешного удара обновляются ВСЕ три ключа in-memory снимка, не только id ударившего оружия');
}

console.log('\nTest 11: попап перезарядки (weapon_reload_popup.js) — обратный отсчёт читает общий таймер, а не ключ конкретного оружия');
{
    assert(/const lastUse = this\._freeWpnSharedLastUse\(\);/.test(popupJs),
        '_updateWeaponReloadTimer() использует _freeWpnSharedLastUse(), не this._freeWpnLastMs[String(wid)]');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
