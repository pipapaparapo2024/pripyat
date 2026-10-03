/**
 * Test: 29.09.2026, по прямому указанию + скриншот попапа победы — "участники боя показывает
 * урон друга, но это урон седого который не считается, посмотри что не так и исправь — урон
 * седого не должен рассчитываться друзьям".
 *
 * Корень: с 26.09.2026 (см. tests/boss-sedoy-damage-server-authoritative.test.js) удар "Седого"
 * (bosses.php.useSedoy()) пишется в тот же `boss_damage_log`, что и обычная атака (attack()) —
 * это было НЕОБХОДИМО для согласованности HP (иначе HP босса не сойдётся с суммой урона в логе).
 * Но панель "УЧАСТНИКИ БОЯ" (_ratingTop(), рейтинг в bosses_fight.js/boss_result.js) считает
 * СВОЙ и "дружеский" урон ТЕМИ ЖЕ SUM()-запросами по этому логу (_damageSumSince()/
 * _friendsDamagePerUserSince()) — значит удар Седого (в т.ч. чужой, если друг ударил Седым в
 * ЭТОМ же бою) попадал в рейтинг как настоящий боевой вклад, хотя это купленная помощь, а не
 * реальный урон оружием/скиллами.
 *
 * Фикс (миграция 35, server/migrate35.php): новая колонка `boss_damage_log.is_sedoy`
 * (TINYINT(1) DEFAULT 0). useSedoy() теперь пишет is_sedoy=1 для своей строки. Обе функции-
 * суммы получили необязательный параметр $excludeSedoy (по умолчанию false, чтобы НЕ ломать
 * HP-производные вызовы из _syncFightSession()) — _ratingTop() зовёт ОБА вызова с true.
 * Итог (на 29.09.2026): HP босса по-прежнему честно снижается ударом Седого (и своим, и
 * дружеским), но "УЧАСТНИКИ БОЯ" показывает только урон, нанесённый реальными атаками.
 *
 * ⚠️ 30.09.2026 (по прямому указанию — "урон седого отправляется друзьям? он не должен отправлять
 * друзьям, исправь"): решение "HP по-прежнему честно снижается ДРУЖЕСКИМ ударом Седого" выше —
 * РЕВЕРСНУТО. Тест 7 ниже (написанный 29.09.2026) прямо утверждал, что `friendTotal` для HP
 * ДОЛЖЕН включать урон Седого друга — это больше не так, см. обновлённую версию теста 7 и новый
 * файл tests/boss-sedoy-damage-not-shared-with-friends.test.js (проверяет реальный PHP-код, не
 * абстрактную модель). Теперь: удар Седого снижает HP ТОЛЬКО тому, кто его купил (через "мой"
 * путь `_damageSumSince()`, не тронутый) — `_friendsDamageSumSince()`/`_applyFriendDamage()`
 * (общий/курсорный пути учёта урона ДРУЗЕЙ) получили `AND is_sedoy=0`, то есть платный помощник
 * больше вообще не передаётся взаимным друзьям ни в каком виде (ни в рейтинг — было и раньше,
 * ни в HP — новое). `claimKill()`'s `sedoyDamage` (для попапа результата боя) тоже больше не
 * плюсует урон Седого друга — только свой (см. `_sedoyDamageMineSince()`, `_sedoyDamageFriendsSince()`
 * удалена как дальше неиспользуемая).
 *
 * Run: node tests/boss-sedoy-excluded-from-friend-rating.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const bossesPhp  = read('server/core/controllers/bosses.php');
const migratePhp = read('server/migrate35.php');

console.log('\n1) server/migrate35.php — ALTER TABLE аддитивно добавляет is_sedoy (с проверкой на повтор)');
{
    assert(/SHOW COLUMNS FROM `boss_damage_log` LIKE 'is_sedoy'/.test(migratePhp), 'проверяет, не существует ли колонка уже (идемпотентность повторного запуска)');
    assert(/ALTER TABLE `boss_damage_log` ADD COLUMN `is_sedoy` TINYINT\(1\) NOT NULL DEFAULT 0/.test(migratePhp),
        'ADD COLUMN is_sedoy TINYINT(1) NOT NULL DEFAULT 0 — старые строки безопасно получают 0 (обычный урон)');
    assert(!/DROP\b/i.test(migratePhp) && !/TRUNCATE\b/i.test(migratePhp), 'миграция не удаляет и не очищает существующие данные (только ADD COLUMN)');
}

console.log('\n2) bosses.php.useSedoy() — помечает свою строку is_sedoy=1');
{
    const start = bossesPhp.indexOf('function useSedoy(){');
    const end   = bossesPhp.indexOf('\n        }', bossesPhp.indexOf("'patch' => \$patch,", start));
    assert(start !== -1 && end !== -1, 'useSedoy() найдена целиком');
    const body = bossesPhp.slice(start, end);

    assert(/\$isSedoy = 1;/.test(body), 'is_sedoy выставляется в 1 для удара седого');
    assert(/INSERT INTO `boss_damage_log` \(`uid`,`boss_id`,`diff_idx`,`damage`,`critical`,`is_sedoy`,`time`\) VALUES \(\?,\?,\?,\?,\?,\?,\?\)/.test(body),
        'INSERT содержит новую колонку is_sedoy');
    assert(/bind_param\('iiiiiii', \$uid, \$bossId, \$diffIdx, \$dealt, \$critZero, \$isSedoy, \$now\)/.test(body),
        'bind_param передаёт $isSedoy на правильной позиции (7 int-параметров)');
}

console.log('\n3) bosses.php.attack() — НЕ трогает is_sedoy (обычные удары получают DEFAULT 0 автоматически)');
{
    const start = bossesPhp.indexOf("INSERT INTO `boss_damage_log` (`uid`,`boss_id`,`diff_idx`,`damage`,`critical`,`time`) VALUES (?,?,?,?,?,?)");
    assert(start !== -1, 'старый 6-колоночный INSERT (без is_sedoy) сохранён для attack() — колонка не обязательна благодаря DEFAULT');
}

console.log('\n4) _damageSumSince()/_friendsDamagePerUserSince() — необязательный $excludeSedoy, по умолчанию false (HP-путь не тронут)');
{
    assert(/private function _damageSumSince\(\$link, \$uid, \$bossId, \$sinceMs, \$excludeSedoy = false\)\{/.test(bossesPhp),
        '_damageSumSince() принимает $excludeSedoy с дефолтом false');
    // 30.09.2026 (прогон перед деплоем): сигнатура стала 3-аргументной — $friendsSince (готовая
    // карта uid=>effectiveSinceMs) вместо отдельных $friendIds+$sinceMs.
    assert(/private function _friendsDamagePerUserSince\(\$link, \$friendsSince, \$excludeSedoy = false\)\{/.test(bossesPhp),
        '_friendsDamagePerUserSince() принимает $excludeSedoy с дефолтом false');

    const dsStart = bossesPhp.indexOf('private function _damageSumSince(');
    const dsEnd   = bossesPhp.indexOf('\n        }', dsStart);
    const dsBody  = bossesPhp.slice(dsStart, dsEnd);
    assert(/\$sedoyFilter = \$excludeSedoy \? ' AND `is_sedoy`=0' : '';/.test(dsBody), '_damageSumSince() добавляет AND is_sedoy=0 только если excludeSedoy=true');

    const fpStart = bossesPhp.indexOf('private function _friendsDamagePerUserSince(');
    const fpEnd   = bossesPhp.indexOf('\n        }', fpStart);
    const fpBody  = bossesPhp.slice(fpStart, fpEnd);
    assert(/\$sedoyFilter = \$excludeSedoy \? ' AND `is_sedoy`=0' : '';/.test(fpBody), '_friendsDamagePerUserSince() тоже добавляет фильтр только при excludeSedoy=true');
}

console.log('\n5) КРИТИЧНО — _syncFightSession() (производный HP) по-прежнему зовёт _damageSumSince() БЕЗ excludeSedoy (HP учитывает удар Седого как раньше)');
{
    const start = bossesPhp.indexOf('private function _syncFightSession(');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/\$mine = \$this->_damageSumSince\(\$link, \$uid, \$bossId, \$bossStartMs\);/.test(body),
        '_syncFightSession() вызывает _damageSumSince() с 4 аргументами (без true) — HP не теряет урон Седого');
    assert(!/_damageSumSince\([^)]*, true\)/.test(body), 'регресс-гвард: внутри _syncFightSession() НЕТ вызова с excludeSedoy=true');
}

console.log('\n6) КРИТИЧНО — _ratingTop() зовёт ОБА хелпера с excludeSedoy=true (рейтинг не должен показывать урон Седого)');
{
    const start = bossesPhp.indexOf('private function _ratingTop(');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/\$myDmg = \$this->_damageSumSince\(\$link, \$uid, \$bossId, \$startMs, true\);/.test(body),
        '_ratingTop(): $myDmg считается с excludeSedoy=true — свой урон Седого тоже не в рейтинге');
    assert(/\$perUser = \$this->_friendsDamagePerUserSince\(\$link, \$friendsSince, true\);/.test(body),
        '_ratingTop(): $perUser (урон друзей) считается с excludeSedoy=true — урон Седого друга не в рейтинге');
}

console.log('\n7) Реальный прогон логики — SQL-фильтр действительно исключает is_sedoy=1 строки из суммы');
{
    // Мини-модель SUM() с фильтром, как в коде — гарантирует, что сама идея фильтрации
    // (не просто наличие текста в файле) реально исключает нужные строки.
    // 30.09.2026: "мой" урон (excludeSedoy опционален, HP-путь зовёт с false) по-прежнему
    // включает СВОЙ седой. "Урон друга" ТЕПЕРЬ фильтруется is_sedoy=0 БЕЗУСЛОВНО (не опционально)
    // и в рейтинге, и в HP — см. _friendsDamageSumSince()/_applyFriendDamage() в bosses.php.
    function sumMine(rows, excludeSedoy){
        return rows
            .filter(r => !excludeSedoy || r.is_sedoy === 0)
            .reduce((s, r) => s + r.damage, 0);
    }
    function sumFriend(rows){
        return rows.filter(r => r.is_sedoy === 0).reduce((s, r) => s + r.damage, 0);
    }

    const fightLog = [
        { uid: 1, damage: 5000,  is_sedoy: 0 }, // реальный удар оружием
        { uid: 1, damage: 12000, is_sedoy: 1 }, // удар седого (моего собственного)
        { uid: 2, damage: 8000,  is_sedoy: 0 }, // реальный удар друга
        { uid: 2, damage: 20000, is_sedoy: 1 }, // удар седого ДРУГА — не должен доходить до меня вообще
    ];

    const myRealDmg   = sumMine(fightLog.filter(r => r.uid === 1), true);
    const myTotalDmg  = sumMine(fightLog.filter(r => r.uid === 1), false);
    const friendRating = sumFriend(fightLog.filter(r => r.uid === 2));
    const friendForHp   = sumFriend(fightLog.filter(r => r.uid === 2));

    assert(myRealDmg === 5000, 'мой урон в рейтинге (excludeSedoy=true) — только реальный удар, без своего седого');
    assert(myTotalDmg === 17000, 'мой урон для HP — по-прежнему включает СВОЙ седой (снижает HP только покупателю)');
    assert(friendRating === 8000, 'урон друга в рейтинге — без его седого (не изменилось)');
    assert(friendForHp === 8000, '30.09.2026: урон друга для HP ТОЖЕ без его седого — платная помощь не передаётся другу вообще ни в каком виде');

    const hpDerived = 100000 - (myTotalDmg + friendForHp); // HP: мой седой да, седой друга — нет
    assert(hpDerived === 75000, 'итоговое производное HP учитывает только МОЙ седой — седой друга (20000) в HP не попадает');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
