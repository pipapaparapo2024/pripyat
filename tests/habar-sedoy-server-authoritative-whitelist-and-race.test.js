/**
 * Test: баг найден по прямому указанию — "после повторного сбора хабара урон седого
 * откатывается на старый остаток вместо свежей выдачи".
 *
 * Сценарий из репорта: собрал хабар → получил 500к урона седого, потратил 200к (осталось
 * 300к). Сутки не заходил. На следующий день снова собрал хабар (ожидание: остаток
 * ОБНОВЛЯЕТСЯ на свежую выдачу, а не складывается — см. habar.php.collectDay() ветку
 * type==='damage', она уже была написана правильно: sedoyMax = max(total, amount),
 * sedoy_dmg_left = sedoyMax). Но по факту после повторного сбора оставались старые 300к —
 * потому что 'sedoy_dmg_total'/'sedoy_dmg_left' были ОДНОВРЕМЕННО:
 *   1) server-authoritative полями, которые пишет habar.php.collectDay()/bosses.php.useSedoy()
 *      напрямую через Gameops::saveUser() (в обход обычного 500мс-дебаунса автосейва), И
 *   2) client-writable полями в whitelist users.php $allowed.
 * Из-за (2) ЛЮБОЙ параллельный debounce/periodic/hidden-автосейв (queuePlayerSave
 * триггерится ЛЮБОЙ мутацией udata, не обязательно связанной с хабаром), запланированный
 * ровно в окне полёта запроса collectDay(), уходил со СТАРЫМ udata (снятым ДО applyPatch())
 * и, придя позже, тихо затирал свежую выдачу обратно на старый остаток — тот же класс гонки,
 * что уже чинили для shmot/roulette_winner/ryukzak_points/bosses_data.
 *
 * Фикс — два независимых слоя:
 *   A) 'sedoy_dmg_total'/'sedoy_dmg_left' убраны из users.php $allowed (полностью закрывает
 *      гонку для этих двух полей + анти-чит дыру: клиент больше не может выставить их себе
 *      напрямую через users.save). Whitelist влияет только на save() — get()/patch по-прежнему
 *      показывают клиенту актуальное серверное значение.
 *   B) users.resetSession() и dev_panel.js._resetAccount() по-прежнему должны реально обнулять
 *      эти поля при полном сбросе аккаунта (иначе "СБРОС ВСЕГО" молча перестаёт их сбрасывать —
 *      тот же общий паттерн, что уже применён к habar_bought/ryukzak_points/achievements).
 *   C) habar.js._collectDay() (клиент) обёрнут suspendPlayerSave()/resumePlayerSave() — тот же
 *      приём, что уже стоит вокруг bosses.attack/claimKill/startFight и bosses.useSedoy —
 *      защищает и остальные поля этого же эндпоинта (coins/cigarettes/weapons и т.д.) от той же
 *      гонки, не только седого.
 *
 * Run: node tests/habar-sedoy-server-authoritative-whitelist-and-race.test.js
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

const usersPhp = readSrc('server/core/controllers/users.php');
const habarPhp = readSrc('server/core/controllers/habar.php');
const habarJs  = readSrc('_client/src/game/habar.js');

function sliceFn(src, needle) {
    const start = src.indexOf(needle);
    if (start < 0) return null;
    const end = src.indexOf('\n        }', start);
    return src.slice(start, end);
}

console.log('\nTest 1: users.php $allowed БОЛЬШЕ НЕ содержит sedoy_dmg_total/sedoy_dmg_left как client-writable поля');
{
    const start = usersPhp.indexOf('$allowed = [');
    const end   = usersPhp.indexOf('\n            ];', start);
    assert(start >= 0 && end > start, '$allowed найден в users.php');
    const body = usersPhp.slice(start, end);
    // Старая запись была буквально 'sedoy_dmg_total','sedoy_dmg_left', (без пробелов, одной
    // строкой-элементом массива) — ищем именно эту форму, а не любое упоминание имени поля
    // (оно легитимно встречается в комментариях, объясняющих, почему убрано).
    assert(!/'sedoy_dmg_total','sedoy_dmg_left',/.test(body),
        "'sedoy_dmg_total'/'sedoy_dmg_left' больше не являются элементами массива $allowed");
    assert(/убран.*whitelist[\s\S]{0,400}sedoy_dmg|sedoy_dmg[\s\S]{0,200}убран.*whitelist/i.test(body),
        'причина удаления задокументирована рядом (комментарий объясняет анти-чит + гонку автосейва)');
}

console.log('\nTest 2: users.php.resetSession() всё ещё реально обнуляет оба поля (полный сброс аккаунта не должен молча их пропускать)');
{
    const body = sliceFn(usersPhp, 'function resetSession(){');
    assert(!!body, 'resetSession() найден в users.php');
    assert(!!body && /'sedoy_dmg_total'\s*=>\s*0,/.test(body),
        "resetSession() явно обнуляет 'sedoy_dmg_total' — иначе сброс аккаунта перестал бы его трогать (whitelist на это уже не влияет)");
    assert(!!body && /'sedoy_dmg_left'\s*=>\s*0,/.test(body),
        "resetSession() явно обнуляет 'sedoy_dmg_left' — тот же довод");
}

console.log('\nTest 3: habar.php.collectDay() — семантика "не накапливается, но обновляется" не сломана этой правкой');
{
    const body = sliceFn(habarPhp, "} else if(\$type === 'damage'){");
    // collectDay() — обычная функция, поищем сам блок ветки damage внутри неё текстовым срезом.
    const start = habarPhp.indexOf("else if(\$type === 'damage'){");
    const end   = habarPhp.indexOf('} else if(', start + 10);
    const branch = habarPhp.slice(start, end);
    assert(start >= 0, "ветка type==='damage' найдена в collectDay()");
    assert(/\$sedoyMax = max\(\$this->ops->i\(\$user, 'sedoy_dmg_total'\), \$amount\);/.test(branch),
        'sedoyMax = max(старый общий максимум, новая выдача) — не складывается с накопленным остатком');
    assert(/\$user\['sedoy_dmg_total'\] = \$sedoyMax;/.test(branch) && /\$user\['sedoy_dmg_left'\]\s*=\s*\$sedoyMax;/.test(branch),
        "sedoy_dmg_left ПЕРЕЗАПИСЫВАЕТСЯ на sedoyMax при каждом сборе — старый остаток (например 300к) отбрасывается, а не складывается с новой выдачей (500к => 500к, не 800к)");
}

console.log('\nTest 4: habar.js._collectDay() — защищён от гонки с обычным автосейвом (suspend/resume вокруг запроса)');
{
    const m = habarJs.match(/_collectDay\(\)\{([\s\S]*?)\n    \}/);
    assert(!!m, '_collectDay() найден в habar.js');
    if (m) {
        // Само совпадение уже включает оба колбэка TS.php (успех и ошибка) целиком.
        const body = m[0];
        assert(/suspendPlayerSave\('habar_collect_day'\);\s*\n\s*TS\.php\('habar\.collectDay'/.test(body),
            'suspendPlayerSave() вызывается ПЕРЕД TS.php(\'habar.collectDay\', ...) — закрывает окно гонки на старте запроса');
        assert(/applyPatch\(res\.patch\);\s*\n\s*if\(window\.resumePlayerSave\) resumePlayerSave\('habar_collect_day'\);/.test(body),
            'resumePlayerSave() вызывается СРАЗУ ПОСЛЕ applyPatch() в успешном колбэке (тот же порядок, что у bosses.attack/claimKill — иначе отложенный флаш уйдёт со старым udata)');
        assert((body.match(/resumePlayerSave\('habar_collect_day'\)/g) || []).length >= 3,
            'resumePlayerSave() снимается во ВСЕХ ветках (успех с patch, успех без patch, ошибка сервера) — иначе автосейв замрёт навсегда при любой из них');
    }
}

console.log('\nTest 5: bosses.php.useSedoy() не принимает произвольную сумму урона от клиента (анти-чит — dealt считается только из серверного sedoy_dmg_left)');
{
    const bossesPhp = readSrc('server/core/controllers/bosses.php');
    const body = sliceFn(bossesPhp, 'function useSedoy(){');
    assert(!!body, 'useSedoy() найден в bosses.php');
    assert(!!body && !/user_params'\]\['amount'\]/.test(body) && !/user_params'\]\['dmg/.test(body),
        'useSedoy() не читает никакую сумму урона из user_params — dealt вычисляется только из уже сохранённого на сервере sedoy_dmg_left');
    assert(!!body && /\$sedoyLeft = \$this->ops->i\(\$user, 'sedoy_dmg_left'\);/.test(body),
        'sedoyLeft читается из loadUser() (реальная строка БД), а не из параметров запроса');
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
