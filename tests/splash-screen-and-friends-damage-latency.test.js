/**
 * Test: батч 16.09.2026 —
 *  1) preloader.js — старая FLA-заставка (preloader_mc, "зомби появляется/пропадает")
 *     скрыта по умолчанию (visible=false) и показывается снова только при реальной
 *     ошибке загрузки (onError) — по прямому указанию "заставка должна быть только
 *     анимационная" (video-прелоадер preloader.mp4 в index.js остаётся нетронутым).
 *  2) bosses-combat.js — bossDamage теперь пушится на сервер с дебаунсом 800мс после
 *     каждого удара (_pushBossDamageSoon), а не только раз в 60с автосейвом — раньше
 *     "урон от друзей" (кнопка ПЕРЕЗАГРУЗИТЬ, bosses.friendsDamage) мог быть не виден
 *     другу вплоть до минуты после реального удара.
 *
 * Run: node tests/splash-screen-and-friends-damage-latency.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const preloaderSrc = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'preloader.js'), 'utf-8');
const combatSrc     = fs.readFileSync(path.join(__dirname, '..', '_client', 'src', 'game', 'bosses', 'bosses-combat.js'), 'utf-8');

console.log('\nTest 1: preloader.js — старая FLA-заставка скрыта по умолчанию');
{
    const ctorIdx = preloaderSrc.indexOf('constructor(preloader_movie){');
    assert(ctorIdx !== -1, 'constructor найден');
    // 08.10.2026: окно увеличено 700→900 — комментарий над этой строкой подрос на строку
    // (уточнение про Spine-прелоадер вместо video, см. preloader-visual.js), сама проверяемая
    // строка кода не изменилась.
    const body = preloaderSrc.slice(ctorIdx, ctorIdx + 900);
    assert(/this\.preloader\.visible = false;/.test(body), 'this.preloader.visible=false сразу в конструкторе');
}

console.log('\nTest 2: preloader.js — заставка возвращается видимой при реальной ошибке загрузки');
{
    const errIdx = preloaderSrc.indexOf('onError(e){');
    assert(errIdx !== -1, 'onError найден');
    const body = preloaderSrc.slice(errIdx, errIdx + 400);
    assert(/this\.preloader\.visible = true;/.test(body), 'onError возвращает this.preloader.visible=true (иначе notify.result окажется в невидимом дереве)');
}

console.log('\nTest 3: урон от друзей больше не имеет 60с/800мс задержки — bosses.attack() считает и пишет его на сервере синхронно, за один запрос');
{
    // 22.09.2026 (по прямому указанию — "перенеси весь бой на сервер"): _pushBossDamageSoon()
    // (дебаунсированный пуш udata) убран целиком — bosses.php.attack() сам синхронно и урон
    // считает, и пишет строку в boss_damage_log, и сохраняет bosses_data ДО того, как ответ
    // вообще вернётся клиенту. Задержка "друг не видит мой урон до минуты" структурно
    // невозможна: к моменту, когда клиент вообще получил ответ на СВОЙ удар, урон уже виден
    // всем, кто в этот момент запросит friendsDamage()/rating().
    assert(!/_pushBossDamageSoon/.test(combatSrc), '_pushBossDamageSoon полностью убран из bosses-combat.js');
    const start = combatSrc.indexOf('proto._attack = function');
    const end   = combatSrc.indexOf('\n    };', start);
    const body  = combatSrc.slice(start, end);
    assert(/TS\.php\('bosses\.attack', \{ boss_id: idx, diff_idx: this\._diffIdx, weapon_id: eqWpn\.id, mult: mult \}/.test(body),
        '_attack() шлёт удар одним запросом на bosses.attack (без отдельного дебаунса на сохранение)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
