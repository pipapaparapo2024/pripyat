/**
 * Test: батч 22.09.2026 (по прямому указанию) — два репорта про бой с боссами:
 *
 *  1) "Соло бой заходит, но урон не регает" / "при перезагрузке боя HP восстанавливается"
 *     (только в соло-режиме, diff_idx=3). Причина: bosses.php._damageSumSince() жёстко
 *     фильтровал `diff_idx IN (0,1,2)` — исключая соло из суммы СОБСТВЕННОГО урона игрока.
 *     _derivedHp() поэтому всегда считал "мой урон = 0" в соло → HP никогда корректно не
 *     уменьшался (каждый новый запрос видел maxHp - 0 - 0 = maxHp, "восстановление").
 *     Лог УДАРА в boss_damage_log писался корректно всегда (это не баг) — ломалось только
 *     чтение/суммирование. Фикс: diff_idx=3 добавлен в список.
 *  2) "В бою не отображает нанесённый урон" — фичи никогда не было (не регресс): сервер
 *     всегда безусловно логирует каждый удар, просто на экране боя ничего не показывалось.
 *     Добавлен всплывающий "-N" урона (dvor._showFloatingText, тот же хелпер, что уже
 *     используется для облаков сигарет во дворе).
 *
 * Run: node tests/boss-solo-damage-and-floating-dmg-text.test.js
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

const bossesPhp = readSrc('server/core/controllers/bosses.php');
const combatSrc = readSrc('_client/src/game/bosses/bosses-combat.js');

console.log('\nTest 1: _damageSumSince() включает diff_idx=3 (соло) в сумму собственного урона');
{
    const start = bossesPhp.indexOf('private function _damageSumSince(');
    const end   = bossesPhp.indexOf('\n        }', start);
    const body  = bossesPhp.slice(start, end);
    assert(/diff_idx` IN \(0,1,2,3\)/.test(body), 'фильтр расширен до (0,1,2,3) — соло больше не исключается из суммы собственного урона');
    assert(!/diff_idx` IN \(0,1,2\)\)/.test(body), 'старый фильтр (0,1,2) без соло убран целиком');
}

console.log('\nTest 2: _friendsDamageSumSince()/_friendsDamagePerUserSince() — гейт "соло не помогает" остаётся ТОЛЬКО на уровне получателя (friendIds), фильтр diff_idx ДРУГА убран (асимметрия, 25.09.2026)');
{
    // 25.09.2026 (по прямому указанию, подтверждено явным ответом на уточняющий вопрос —
    // "сделать асимметрично, как вы описали"): урон друга, дерущегося В СОЛО, теперь ВСЁ РАВНО
    // засчитывается получателю, если сам получатель не в Соло — раньше здесь стоял фильтр
    // `diff_idx IN (0,1,2)` на СТОРОНЕ ДРУГА (симметричная изоляция в обе стороны), убран.
    const sumStart = bossesPhp.indexOf('private function _friendsDamageSumSince(');
    const sumEnd   = bossesPhp.indexOf('\n        }', sumStart);
    const sumBody  = bossesPhp.slice(sumStart, sumEnd);
    assert(!/diff_idx` IN \(0,1,2\)/.test(sumBody),
        '_friendsDamageSumSince() больше НЕ фильтрует diff_idx друга — урон друга из Соло тоже доходит до получателя-не-Соло');

    // 24.09.2026: _derivedHp() заменена на _syncFightSession() (личный кэш + курсор) — гейт
    // "соло исключает друзей" переехал туда же, в том же виде.
    const syncStart = bossesPhp.indexOf('private function _syncFightSession(');
    const syncEnd   = bossesPhp.indexOf('\n        }', syncStart);
    const syncBody  = bossesPhp.slice(syncStart, syncEnd);
    assert(/\$friends = \(\$diffIdx !== 3 && !empty\(\$friendsSince\)\)/.test(syncBody),
        '_syncFightSession() по-прежнему явно гейтит друзей по diffIdx!==3 — соло остаётся вырожденным (только свой урон)');
}

console.log('\nTest 3: attack() синхронизирует кэш HP через _syncFightSession() (которая при бэкфилле использует ту же _damageSumSince()) — соло теперь тоже корректно накапливает урон между ударами');
{
    const start = bossesPhp.indexOf('function attack(){');
    const end   = bossesPhp.indexOf('function claimKill()');
    const body  = bossesPhp.slice(start, end);
    // 24.09.2026: attack() больше не считает $myDmgSoFar/$friendDmg отдельно — берёт готовый
    // $session['hp'] из _syncFightSession() (фильтр по boss_id живёт внутри неё же, см.
    // boss-rating-hp-scoped-by-boss-id.test.js).
    assert(/\$session = \$this->_syncFightSession\(\$link, \$uid, \$this->_loadFightSession\(\$user\), \$diffIdx, \$bossId, \$bossStartMs, \$friendsSince\);/.test(body),
        'attack() синхронизирует hpBefore через _syncFightSession() (учитывает соло так же, как раньше)');
    assert(/\$hpBefore = intval\(\$session\['hp'\]\);/.test(body),
        'hpBefore читается из session[\'hp\'] — в соло друзья никогда не подмешиваются (гейт внутри _syncFightSession()/_applyFriendDamage())');
}

console.log('\nTest 4: всплывающий урон в бою — реиспользует dvor._showFloatingText, показывает крит и точное значение');
{
    const start = combatSrc.indexOf("det.hp_bar.setPercent(res.hp / this._maxHp(idx));");
    const end   = combatSrc.indexOf('this._saveToUdata();', start);
    const body  = combatSrc.slice(start, end);
    assert(/window\.dvor && typeof dvor\._showFloatingText === 'function'/.test(body),
        'проверяет наличие dvor._showFloatingText перед вызовом (не падает, если dvor ещё не создан)');
    assert(/dvor\._showFloatingText\(136, 120, \(res\.critical \? '💥 ' : ''\) \+ '-' \+ this\._fmt\(res\.damage\)\);/.test(body),
        'показывает "-N" урона (с критической иконкой при крите) над полоской HP боя (x=136 — центр hpBar x=12..262)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
