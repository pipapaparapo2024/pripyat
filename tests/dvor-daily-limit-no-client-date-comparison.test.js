/**
 * Test: батч 24.09.2026 (по прямому указанию, скриншоты — покер показывает "0/25" платных
 * попыток, но клик по игре сразу отвечает "ЛИМИТ 25 ИГР ЗА ТУШЕНКУ НА СЕГОДНЯ"; пользователь
 * предположил причину — VPN).
 *
 * Аудит показал: dvor.js._loadDaily() сравнивал d.date (дату, которую ПИШЕТ ТОЛЬКО сервер —
 * poker.php.deal(), PHP date('Y-m-d'), серверный часовой пояс) с this._today() (new Date() НА
 * УСТРОЙСТВЕ игрока). VPN/другой часовой пояс на клиенте — и сравнение дат расходится: клиент
 * решает "это не сегодня" и обнуляет ТОЛЬКО свой ОТОБРАЖАЕМЫЙ счётчик (_resetDaily()), а
 * реальный лимит на сервере остаётся как был. _saveDaily() (единственное место, где клиент
 * мог бы записать dvor_daily обратно) НИГДЕ не вызывается — dvor_daily физически пишет только
 * сервер, поэтому сравнивать "актуальность" даты на клиенте вообще не нужно.
 *
 * Run: node tests/dvor-daily-limit-no-client-date-comparison.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor.js'), 'utf-8');

console.log('\nTest 1: _loadDaily() больше не сравнивает d.date с this._today() (клиентским временем)');
{
    const m = src.match(/_loadDaily\(\)\{([\s\S]*?)\n    \}/);
    assert(!!m, '_loadDaily() найдена');
    const body = m ? m[1] : '';
    assert(!/d\.date === this\._today\(\)/.test(body), 'КРИТИЧНО: больше нет сравнения серверной даты с клиентским this._today() (источник бага при VPN/расхождении часовых поясов)');
    assert(/this\._pokerUsed\s*=\s*d\.poker\s*\|\|\s*0;/.test(body), 'pokerUsed читается напрямую из udata[\'dvor_daily\'] без условия на дату');
    assert(/this\._dailyDate\s*=\s*d\.date \|\| '';/.test(body), 'dailyDate просто отражает то, что реально прислал сервер');
}

console.log('\nTest 2: регресс-гвард — _saveDaily() по-прежнему нигде не вызывается (dvor_daily остаётся server-only писателем)');
{
    const callSites = (src.match(/this\._saveDaily\(\)/g) || []).length;
    assert(callSites === 0, '_saveDaily() не вызывается нигде в dvor.js — если это когда-нибудь изменится, нужно заново продумать гонку клиент/сервер для dvor_daily');
}

console.log('\nTest 3: _resetDaily() остаётся как fallback только для битого/отсутствующего JSON (catch), не для расхождения дат');
{
    const m = src.match(/_loadDaily\(\)\{([\s\S]*?)\n    \}/);
    const body = m ? m[1] : '';
    assert(/catch\(e\)\{ this\._resetDaily\(\); \}/.test(body), '_resetDaily() вызывается только при ошибке парсинга JSON, не по сравнению дат');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
