/**
 * Test: два бага, репортнутые после жалобы "нажимаешь ПЕРЕЗАГРУЗИТЬ — сразу даёт награду"
 * и "вместо фото последнего убившего показывается серый кружок".
 *
 * 1) bosses.php friendsDamage() суммировал personalDamageTotal друзей — их ПОЖИЗНЕННЫЙ урон
 *    по ВСЕМ боссам сразу, никак не привязанный к текущему боссу. Клик "ПЕРЕЗАГРУЗИТЬ" вызывает
 *    bosses._syncFriendsDamage(), который списывает это как урон ИМЕННО ТЕКУЩЕМУ боссу — если у
 *    друга миллионы урона по другим боссам, полностью здоровый Охотник (1000 HP) добивается
 *    мгновенно без единой реальной атаки. Для помощи используется curCycleDmg[boss_id],
 *    а пожизненный bossDamage[boss_id] остаётся только метрикой рейтинга.
 *
 * 2) bosses-combat.js._resolveVkUsers для СВОЕГО id брал фото только из
 *    window.vk_user_info['photo_50'] — но VKWebAppGetUserInfo этого поля не возвращает вообще
 *    (только photo_100/200), поэтому photo всегда было null для себя, даже когда убийцей босса
 *    был сам игрок ("УБИВШИЙ" показывал серый кружок-плейсхолдер вместо реального фото).
 *    Исправлено: если своё фото не пришло из vk_user_info, id всё равно докидывается в общий
 *    batch-запрос users.get (который явно поддерживает fields=photo_50) — как уже делается для
 *    остальных (друзей/чужих) id.
 *
 * Run: node tests/boss-reload-instakill-and-killer-photo.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const phpSrc = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'core', 'controllers', 'bosses.php'), 'utf-8'
);
const combatSrc = fs.readFileSync(
    path.join(__dirname, '..', '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8'
);

console.log('\nTest 1: bosses.php friendsDamage() — использует curCycleDmg[boss_id], а не пожизненный рейтинг');
{
    const m = phpSrc.match(/function friendsDamage\(\)\{([\s\S]*?)\n {8}\}/);
    assert(!!m, 'friendsDamage() найден');
    if (m) {
        const body = m[1];
        assert(!/\$data\['personalDamageTotal'\]/.test(body), 'personalDamageTotal больше не читается во friendsDamage() (был баг мгновенного добивания)');
        // 22.09.2026 (по прямому указанию — client-writable curCycleDmg заменён на серверный
        // лог boss_damage_log, затем механика уточнена — боссы вообще не обязаны совпадать) →
        // 24.09.2026 (_derivedHp() заменена на кэш+курсор, см. большой комментарий в bosses.php
        // над _syncFightSession()): "только урон в активном цикле, не пожизненный" по-прежнему
        // гарантируется границей $bossStartMs = момент старта МОЕГО текущего боя (либо в самом
        // бэкфилле кэша, либо через курсор, который заведён от этой же границы при бэкфилле).
        assert(/\$session = \$this->_syncFightSession\(\$link, \$uid, \$this->_loadFightSession\(\$user\), \$diffIdx, \$bossId, \$bossStartMs, \$friendsSince\);/.test(body),
            'синхронизирует кэш HP через _syncFightSession() — урон друга засчитывается только с момента старта МОЕГО боя, не пожизненно');
        assert(!/\$data\['bossDamage'\]\[\$bossId\]/.test(body),
            'пожизненный bossDamage не используется для списания HP');
    }
}

console.log('\nTest 2: bosses-combat.js._resolveVkUsers — своё фото докидывается в batch users.get, если vk_user_info его не дал');
{
    const m = combatSrc.match(/proto\._resolveVkUsers = function\(ids, callback\)\{([\s\S]*?)\n\s{4}\};/);
    assert(!!m, '_resolveVkUsers найден');
    if (m) {
        const body = m[1];
        assert(/if\(!out\[sid\]\.photo && rest\.indexOf\(sid\) === -1\) rest\.push\(sid\);/.test(body),
            'свой id докидывается в rest (batch-запрос), если photo из vk_user_info не пришло');
        assert(/if\(sid === myId && out\[sid\] && out\[sid\]\.name\)\{/.test(body),
            'в ответе batch-запроса имя себя (из vk_user_info/«Ты») не перезатирается VK-именем');
        assert(/if\(!out\[sid\]\.photo\) out\[sid\]\.photo = u\.photo_50 \|\| null;/.test(body),
            'фото себя подставляется из batch-ответа, если раньше было null');
    }
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
