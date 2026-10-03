/**
 * Test: 18.09.2026 — "после сброса аккаунта на игроке остались надеты Бандана/Майка/Брюки
 * сталкера/Берцы простые".
 *
 * Причина 1: эти 4 предмета были зашиты в конструкторе Shmot как owned:true/equipped:true —
 * "бесплатный стартовый комплект" для КАЖДОГО игрока, включая только что сброшенного (по
 * прямому указанию 18.09.2026 у игрока изначально не должно быть НИКАКОЙ одежды).
 *
 * Причина 2: даже если бы udata['shmot'] был очищен (dev_panel.js._resetAccount() ставит
 * shmot:'' в новый udata), shmot.js._loadFromUdata() при пустой строке делает
 * `if(!udata||!udata['shmot']) return;` — ничего не трогает, оставляя старое состояние
 * this.items (owned/equipped) в памяти как было. Та же причина, что уже была закрыта для
 * bosses/zone в этом же _resetAccount() ранее.
 *
 * Run: node tests/shmot-no-starter-outfit-and-reset.test.js
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

const shmotSrc    = readSrc('_client/src/game/shmot.js');
const devPanelSrc = readSrc('_client/src/game/shell/overlays/dev_panel.js');

console.log('\nTest 1: в конструкторе Shmot больше нет owned:true (стартового бесплатного комплекта)');
{
    assert(!/owned:true/.test(shmotSrc), 'ни один предмет не помечен owned:true по умолчанию');
    // 23.09.2026 (батч "убери все шмотки, которые не выбиваются с боссов"): все 4 предмета из
    // исходного репорта (Бандана/Майка/Брюки сталкера/Берцы простые, все — старый базовый
    // магазин id0-40) удалены из shmot.js целиком — проверять их owned:false больше не на чем,
    // сам вопрос "стартовый комплект" снят вместе с удалением всего покупного магазина.
    ['Бандана', 'Майка', 'Брюки сталкера', 'Берцы простые'].forEach(name => {
        const line = shmotSrc.split('\n').find(l => l.includes(`name:'${name}'`));
        assert(!line, `предмет "${name}" отсутствует в shmot.js (был частью удалённого базового магазина)`);
    });
}

console.log('\nTest 2: _resetAccount() явно снимает и убирает всю одежду в памяти (shmot._loadFromUdata молчаливо не сбрасывает)');
{
    const start = devPanelSrc.indexOf('proto._resetAccount = function(){');
    const end   = devPanelSrc.indexOf('};', devPanelSrc.indexOf("console.error('[devPanel._resetAccount] ошибка сохранения на сервере:'"));
    const body  = devPanelSrc.slice(start, end);

    assert(/if\(window\.shmot\)\{/.test(body), 'блок сброса window.shmot найден в _resetAccount()');
    assert(/shmot\.items\.forEach\(it => \{ it\.owned = false; it\.equipped = false; \}\);/.test(body),
        'все предметы shmot.items принудительно снимаются и убираются из инвентаря в памяти');
    assert(/if\(window\.home && typeof home\.updateClothes === 'function'\) home\.updateClothes\(\);/.test(body),
        'home.updateClothes() вызывается — иначе спрайты старой одежды останутся висеть на персонаже главного экрана');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
