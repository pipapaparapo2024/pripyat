/**
 * Test: батч 24.09.2026 (по прямому указанию — репорт "почини не только для поражения, но и
 * для истечения времени", проверка выявила, что фикс для таймаута из более раннего батча этого
 * же дня физически не мог сработать ни разу).
 *
 * Разбор показал: bosses-combat.js содержал ДВА определения `proto._onFightTimeout` — рабочее
 * (graphical-попап через iface._showBossResultPopup, top/рейтинг, suspendPlayerSave/
 * resumePlayerSave-защита от гонки) в начале файла, и легаси-дубликат (notify.showResult
 * простым текстом, БЕЗ top, БЕЗ suspend/resume, endFightSession({}) без boss_id/diff_idx) ниже.
 * attachBossesCombat(proto) выполняет оба присваивания `proto.X = function` последовательно —
 * второе МОЛЧА ЗАТИРАЛО первое на общем прототипе, независимо от того, кто вызывает
 * this._onFightTimeout(idx). Итог: любой реальный 9-часовой таймаут боя всегда срабатывал по
 * старой, незащищённой от гонки версии — фикс рейтинга/попапа для таймаута был мёртвым кодом
 * с момента написания. Легаси-дубликат удалён (сам код, который мог бы его вызвать —
 * _updateFightTimer()/Bosses.prototype.open() — подтверждённо не используется в реальном UI,
 * см. комментарий 21.09.2026 в bosses.js).
 *
 * Run: node tests/boss-fight-timeout-no-duplicate-handler-shadowing.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const combatSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');

console.log('\nTest 1: ровно ОДНО определение proto._onFightTimeout в файле (регресс-гвард на дублирование/затирание)');
{
    const matches = combatSrc.match(/proto\._onFightTimeout = function/g) || [];
    assert(matches.length === 1, `найдено определений: ${matches.length} (должно быть ровно 1 — второе молча затирало рабочую версию на прототипе)`);
}

console.log('\nTest 2: единственная оставшаяся версия — рабочая (graphical-попап, top, suspend/resume), не легаси');
{
    const m = combatSrc.match(/proto\._onFightTimeout = function\(idx\)\{([\s\S]*?)\n    \};/);
    assert(!!m, '_onFightTimeout найдена');
    const body = m ? m[1] : '';
    assert(/suspendPlayerSave\('boss_end_fight_timeout'\)/.test(body), 'использует suspendPlayerSave (защита от гонки с flushPlayerSave)');
    assert(/resumePlayerSave\('boss_end_fight_timeout'\)/.test(body), 'использует resumePlayerSave');
    assert(/TS\.php\('bosses\.endFightSession', \{boss_id: idx, diff_idx: diffIdxAtLoss\}/.test(body), 'передаёt boss_id/diff_idx в endFightSession (не пустой объект)');
    assert(/iface\._showBossResultPopup\(\{/.test(body), 'открывает graphical-попап через iface._showBossResultPopup, не notify.showResult');
    assert(!/notify\.showResult\(\{text:'Поражение! Бой окончен, ключи потрачены\.'\}, 0\);\s*\n\s*if\(window\.iface && typeof iface\._closeBossesFight/.test(body),
        'регресс-гвард: легаси-паттерн (notify сразу перед closeBossesFight, без попапа) отсутствует');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
