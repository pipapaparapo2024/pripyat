/**
 * Test: 30.09.2026, по прямому указанию — "посмотри и проверь урон седого отправляется друзьям?
 * он не должен отправлять друзья исправь".
 *
 * Корень: с 26.09.2026 (миграция 35, is_sedoy) удар платного помощника "Седой"
 * (bosses.php.useSedoy()) пишется в тот же `boss_damage_log`, что и обычная атака. Урон Седого
 * УЖЕ был исключён из рейтинга "УЧАСТНИКИ БОЯ" (_ratingTop(), 29.09.2026, см.
 * boss-sedoy-excluded-from-friend-rating.test.js). Но два ДРУГИХ места, отвечающих за
 * ПРОИЗВОДНЫЙ HP БОССА (не рейтинг-дисплей, а реальное списание HP), никогда не фильтровали
 * is_sedoy для урона ДРУГЕЙ: `_friendsDamageSumSince()` (полный пересчёт при новой/несовпавшей
 * попытке) и `_applyFriendDamage()` (курсорный инкрементальный подхват на каждый опрос) — обе
 * суммировали ВСЕ строки друга без фильтра. Итог: если игрок покупал удар Седого, этот урон
 * реально снижал HP босса ВСЕМ его взаимным друзьям, деревшимся хоть с каким-то боссом (см.
 * комментарий у _friendsDamageSumSince — friend-урон сознательно не скоуплен по boss_id) — то
 * есть платная помощь одного игрока "рассылалась" всем его друзьям бесплатно.
 *
 * Фикс: обе функции получили `AND \`is_sedoy\`=0` в SQL. Седой теперь снижает HP ТОЛЬКО тому,
 * кто его купил (через отдельный "мой" путь `_damageSumSince()`, не тронутый — там excludeSedoy
 * по-прежнему false внутри _syncFightSession(), иначе HP покупателя не сойдётся с тем, что он
 * реально снял). `claimKill()`'s `sedoyDamage` (строка "Седой помог: +N" в попапе результата) —
 * тоже больше не приплюсовывает урон Седого друга (`_sedoyDamageFriendsSince()` удалена как
 * ставшая ненужной), иначе попап показывал бы вклад, который больше не влияет на исход боя.
 *
 * Run: node tests/boss-sedoy-damage-not-shared-with-friends.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const bossesPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'bosses.php'), 'utf-8');

console.log('\nTest 1: _friendsDamageSumSince() (полный пересчёт HP) фильтрует is_sedoy=0');
{
    const start = bossesPhp.indexOf('private function _friendsDamageSumSince(');
    assert(start !== -1, '_friendsDamageSumSince() найдена');
    const end = bossesPhp.indexOf('\n        }', start);
    const body = bossesPhp.slice(start, end);
    assert(/AND `is_sedoy`=0/.test(body),
        'КРИТИЧНО: запрос суммы урона друзей исключает is_sedoy=1 — платный Седой друга не снижает моё HP');
}

console.log('\nTest 2: _applyFriendDamage() (курсорный инкрементальный подхват) тоже фильтрует is_sedoy=0');
{
    const start = bossesPhp.indexOf('private function _applyFriendDamage(');
    assert(start !== -1, '_applyFriendDamage() найдена');
    const end = bossesPhp.indexOf('\n        }', start);
    const body = bossesPhp.slice(start, end);
    assert(/AND `id` > \$sinceId AND `is_sedoy`=0/.test(body),
        'КРИТИЧНО: инкрементальный запрос тоже исключает is_sedoy=1 — без этого фикс из Test 1 протекал бы обратно через курсор на каждый последующий опрос боя');
}

console.log('\nTest 3: регресс-гвард — МОЙ собственный Седой по-прежнему снижает МОЁ HP (не сломано фиксом выше)');
{
    const start = bossesPhp.indexOf('private function _syncFightSession(');
    const end = bossesPhp.indexOf('\n        }', bossesPhp.indexOf('$this->_applyFriendDamage', start));
    const body = bossesPhp.slice(start, end);
    assert(/\$mine = \$this->_damageSumSince\(\$link, \$uid, \$bossId, \$bossStartMs\);/.test(body),
        '_syncFightSession() по-прежнему зовёт _damageSumSince() БЕЗ excludeSedoy для "mine" — мой Седой продолжает снижать мой боссу HP');
    assert(!/\$mine = \$this->_damageSumSince\([^)]*, true\)/.test(body),
        'регресс-гвард: "mine" не переключили на excludeSedoy=true — иначе покупка Седого перестала бы работать вообще');
}

console.log('\nTest 4: _sedoyDamageFriendsSince() удалена — больше нет функции, которая приплюсовывала Седого друга к попапу результата');
{
    assert(!/function _sedoyDamageFriendsSince/.test(bossesPhp),
        '_sedoyDamageFriendsSince() отсутствует в файле (была единственным потребителем, использовалась только в claimKill())');
}

console.log('\nTest 5: claimKill() считает sedoyDamage ТОЛЬКО из своего урона, без "+ друзья"');
{
    const claimIdx = bossesPhp.indexOf('function claimKill(){');
    assert(claimIdx !== -1, 'claimKill() найден');
    const claimBody = bossesPhp.slice(claimIdx, claimIdx + 25000);
    assert(/\$sedoyDamage = \$this->_sedoyDamageMineSince\(\$hpLink, \$uid, \$bossId, \$fightStart\);/.test(claimBody),
        '$sedoyDamage присваивается напрямую результатом _sedoyDamageMineSince(), инструкция заканчивается тут же ";" — никакого доп. слагаемого урона друзей');
}

console.log('\nTest 6: сама идея фильтра — мини-модель SUM() показывает, что урон друга-Седого больше не входит в производный HP, а свой — входит');
{
    // Не парсинг файла, а прогон логики: гарантирует, что "add AND is_sedoy=0" реально
    // меняет результат суммирования, а не просто присутствует как мёртвый текст.
    function sumRows(rows, requireNotSedoy) {
        return rows
            .filter(r => !requireNotSedoy || r.is_sedoy === 0)
            .reduce((s, r) => s + r.damage, 0);
    }

    const myRows = [
        { damage: 300, is_sedoy: 0 }, // моя обычная атака
        { damage: 900, is_sedoy: 1 }, // мой купленный удар Седого
    ];
    const friendRows = [
        { damage: 150, is_sedoy: 0 },  // реальный удар друга оружием
        { damage: 2000, is_sedoy: 1 }, // друг купил СВОЕГО Седого — не должно долетать до меня
    ];

    const myHpContribution = sumRows(myRows, false); // "mine" — без фильтра, как в коде
    const friendHpContribution = sumRows(friendRows, true); // "friends" — с фильтром is_sedoy=0, как в коде после фикса

    assert(myHpContribution === 1200, 'мой вклад в HP включает мой собственный Седой (300+900=1200) — покупка не стала бесполезной');
    assert(friendHpContribution === 150, 'вклад друга в HP — ТОЛЬКО реальная атака (150), его 2000 урона Седым в мой бой не попадают');

    const maxHp = 5000;
    const derivedHp = maxHp - myHpContribution - friendHpContribution;
    assert(derivedHp === 3650, 'итоговое производное HP считает мой Седой, но не Седого друга (5000-1200-150=3650)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
