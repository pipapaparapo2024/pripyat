/**
 * Test: батч 19.09.2026 (по прямому указанию, репорт "с телефона не заходит в бой — список
 * боссов светится и всё") — кнопка НАПАСТЬ (bosses_select.js) не реагировала на тап на
 * тач-устройствах.
 *
 * Причина: napP (пассивный спрайт) и napA (активный спрайт) — обычная пара passiv/activ, но
 * клик (pointerdown) висел ТОЛЬКО на napA, который появлялся по pointerover на napP (наведение
 * мышью). На тач-устройствах события pointerover не бывает вообще — палец сразу тапает по
 * napP, у которого обработчика не было, поэтому нажатие ничего не делало. Единственное место
 * в проекте с таким паттерном (проверено grep'ом по всему _client/src).
 *
 * Run: node tests/mobile-napast-button-touch-fix.test.js
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

const selectSrc = readSrc('_client/src/game/shell/overlays/bosses_select.js');

console.log('\nTest 1: кнопка НАПАСТЬ — общий обработчик клика вынесен в переменную и повешен на ОБА спрайта');
{
    assert(/const _onNapastClick = \(\)=>\{/.test(selectSrc), 'обработчик клика вынесен в именованную функцию _onNapastClick');
    // 28.09.2026 (адаптив под мобильные, свайп-прокрутка списка боссов): оба спрайта переведены
    // с .on('pointerdown', ...) на helper.onTap(...) — тап = отпускание без смещения >10px.
    // Смысл этого теста не меняется: клик по-прежнему висит на ОБОИХ спрайтах, а не только на
    // napA (это и был баг 19.09 — на тач-устройствах нет pointerover, палец тапает по napP).
    // Причина перевода: pointerdown срабатывает в момент КАСАНИЯ, поэтому свайп по списку,
    // начатый с этой кнопки, сразу уводил игрока в предпросмотр боя вместо прокрутки.
    assert(/helper\.onTap\(napP, _onNapastClick\);/.test(selectSrc), 'napP (пассивный, видимый по умолчанию — то, по чему реально тапают на мобильном) получает клик');
    assert(/helper\.onTap\(napA, _onNapastClick\);/.test(selectSrc), 'napA (активный, показывается по hover) тоже получает клик — не ломает поведение на десктопе');
    assert(!/napA\.on\('pointerdown', \(\)=>\{/.test(selectSrc), 'старый вариант — pointerdown только на napA — убран');
}

console.log('\nTest 2: наведение мышью по-прежнему переключает картинку passiv/activ (десктопное поведение не сломано)');
{
    // 29.09.2026 (apply_hover_scale.py, одноразовый батч-скрипт — см. корень проекта): ко всем
    // стандартным парам pointerover/pointerout с _sa(...) добавлен парный _ss(...) для
    // hover-scale эффекта. Смысл проверки не меняется — napP/napA по-прежнему переключают
    // видимость друг друга по наведению, просто внутри обработчика появился ещё один вызов.
    assert(/napP\.on\('pointerover', \(\)=>\{ napP\.visible = false; napA\.visible = true;[^{}]*\}\);/.test(selectSrc),
        'hover на napP по-прежнему показывает napA (косметика для мыши)');
    assert(/napA\.on\('pointerout',  \(\)=>\{[^{}]*napA\.visible = false; napP\.visible = true;[^{}]*\}\);/.test(selectSrc),
        'уход курсора с napA по-прежнему возвращает napP');
}

console.log('\nTest 3: sanity — весь остальной _client/src не содержит того же паттерна "клик только на скрытом по умолчанию спрайте, показываемом через pointerover"');
{
    const fs2 = require('fs');
    const globAll = (dir, acc) => {
        for(const f of fs2.readdirSync(dir, {withFileTypes: true})){
            const p = path.join(dir, f.name);
            if(f.isDirectory()) globAll(p, acc);
            else if(f.name.endsWith('.js')) acc.push(p);
        }
        return acc;
    };
    const files = globAll(path.join(root, '_client', 'src'), []);
    const offenders = [];
    for(const f of files){
        const body = fs2.readFileSync(f, 'utf-8');
        // 29.09.2026: регекс ослаблен, чтобы допускать hover-scale довесок (_ss(...)),
        // добавленный apply_hover_scale.py внутри самого обработчика — см. комментарий в Test 2.
        if(/\.on\('pointerover', \(\)=>\{ [a-zA-Z0-9_]+\.visible = false; [a-zA-Z0-9_]+\.visible = true;[^{}]*\}\);/.test(body)){
            offenders.push(path.relative(root, f));
        }
    }
    assert(offenders.length === 1 && offenders[0].endsWith('bosses_select.js'),
        'только bosses_select.js содержит паттерн hover-переключения видимости (уже исправлен выше), нигде больше в проекте того же бага нет: ' + JSON.stringify(offenders));
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
