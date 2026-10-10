const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const bank = fs.readFileSync(path.join(root, '_client/src/game/bank.js'), 'utf8');
const energy = fs.readFileSync(path.join(root, '_client/src/game/shell/popups/energy_buy.js'), 'utf8');
const index = fs.readFileSync(path.join(root, '_client/src/index.js'), 'utf8');
let failed = 0;
function assert(ok, text){
    if(ok) console.log('✅', text);
    else { console.error('❌', text); failed++; }
}

assert(/canvas\.addEventListener\('pointerdown', this\._bankDomPointerDebug, true\)/.test(bank),
    'банк пишет DOM pointerdown в capture-фазе: видно даже если PIXI не выбрал слот');
assert(/\[bank\.input\] DOM pointerdown при открытом банке/.test(bank),
    'DOM-лог содержит координаты и canvas rect для диагностики попадания');
assert(/if\(window\.isMobile\) helper\.touchPad\(slot, 128\);/.test(bank),
    'слоты банка получают увеличенную touch-area на мобильных');
assert(/\[bank\.genSlots\] PIXI pointerdown по слоту покупки/.test(bank),
    'отдельно логируется попадание PIXI по слоту до запуска оплаты');
assert(/if\(window\.isMobile\) helper\.touchPad\(slot, 128\);/.test(energy),
    'карточки энергии получают увеличенную touch-area на мобильных');
assert(/\[energy_buy\.initButtons\] PIXI pointerdown по карточке энергии/.test(energy),
    'карточка энергии логирует pointerdown до startPurchase');
assert(/window\.ok_payment_diagnostics/.test(index) && /_okDiagnosticOrigins\.includes\('st\.okcdn\.ru'\)/.test(index),
    'на production ОК распознаётся отдельный режим диагностических логов');
assert(/window\.ok_payment_diagnostics_enabled = false;/.test(index),
    'ОК-диагностика выключена переключателем, но код логов сохранён для будущего расследования');
assert(/bank\\\.\(\?:input\|genSlots\)/.test(index) && /iap\(\?:\\\.\|\\\]\)/.test(index),
    'production пропускает только безопасные префиксы оплаты/ввода, а не все внутренние console-логи');
assert(!/\^\\\[\(bank\|iap\|platform/.test(index),
    'широкий префикс [bank] исключён: launch-параметры игрока в production не логируются');

if(failed) process.exit(1);
console.log('✅ Диагностика ввода покупок и touch-area защищены регресс-тестом');
