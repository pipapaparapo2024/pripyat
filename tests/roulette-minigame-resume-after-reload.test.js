/**
 * Test: 12.10.2026, по прямому репорту — "игрок выбил джекпот, ещё не открыл стаканчик, взял,
 * перезагрузил страницу — его игра пропала, прошла. Такого быть не должно."
 *
 * Корень НЕ в сервере: udata['roulette_cups'] — уже server-only поле (см.
 * server-authoritative-архитектура, CLAUDE.md), пишется ТОЛЬКО через Gameops::loadUser()/
 * saveUser() (roulette.php.spin()/claimPrize()/openMinigame()/pickCup()), честно переживает
 * reload в БД и приходит клиенту сырым значением в КАЖДОМ users.get() (users.php::get() делает
 * SELECT * — whitelist $allowed ограничивает только users.save(), не чтение). То есть на сервере
 * состояние НИКУДА не девалось ни разу.
 *
 * Реальный корень — клиент НИКОГДА не проверял udata['roulette_cups'] при повторном открытии
 * экрана рулетки: _openRouletteScreen() просто рисовал обычное колесо, игнорируя то, что у
 * игрока уже лежит незавершённый выбор "забрать/рискнуть" (roulette_cups === ['__prize_choice__'],
 * см. spin()/claimPrize() в roulette.php) либо уже разложенные 9 стаканчиков мини-игры
 * (roulette_cups — настоящий массив из 9 строк, см. openMinigame()). Игрок физически не мог
 * вернуться к уже выигранному кушу — не потому что его смыло, а потому что UI не предлагал пути
 * назад.
 *
 * Фикс — proto._resumeRouletteMinigameIfPending() (dvor-roulette-minigame.js), вызывается из
 * proto._openRouletteScreen() (dvor-roulette.js) при КАЖДОМ открытии экрана рулетки:
 *  - roulette_cups === ['__prize_choice__'] → заново открывает попап выбора (_openJackpotChoice()).
 *  - roulette_cups — массив из 9 строк → заново строит экран мини-игры (_buildRouletteMinigameWin()),
 *    БЕЗ повторного вызова roulette.openMinigame() (это сгенерировало бы НОВую раскладку поверх
 *    уже существующей и зря инкрементировало бы общий kush_counter — есть отдельная функция
 *    _openRouletteMinigame() именно ДЛЯ генерации новой раскладки, resume её не вызывает).
 *
 * Run: node tests/roulette-minigame-resume-after-reload.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const minigameSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-minigame.js'), 'utf-8').replace(/\r\n/g, '\n');
const rouletteSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette.js'), 'utf-8').replace(/\r\n/g, '\n');

console.log('\nTest 1: _resumeRouletteMinigameIfPending() определён и читает именно udata[\'roulette_cups\'] (не локальное состояние экрана)');
{
    const start = minigameSrc.indexOf('proto._resumeRouletteMinigameIfPending = function(){');
    assert(start !== -1, '_resumeRouletteMinigameIfPending определён на proto (доступен как this._resumeRouletteMinigameIfPending из dvor-roulette.js — общий Dvor.prototype)');
    const end = minigameSrc.indexOf('\n    };', start);
    const body = minigameSrc.slice(start, end);

    assert(/let cups = udata\['roulette_cups'\];/.test(body), 'читает именно серверное поле udata[\'roulette_cups\'] — то же, что пишет roulette.php через Gameops::saveUser()');
    assert(/JSON\.parse\(cups\)/.test(body), 'парсит JSON (поле приходит сырой строкой из SELECT *, не автоматически декодированным объектом)');
    assert(/try\s*\{[\s\S]*?JSON\.parse\(cups\)[\s\S]*?\}\s*catch/.test(body), 'парсинг обёрнут в try/catch — битый/отсутствующий JSON не должен ронять открытие экрана рулетки');
}

console.log('\nTest 2: два разных зависших состояния резюмируются по-разному, НЕ через повторный roulette.openMinigame()');
{
    const start = minigameSrc.indexOf('proto._resumeRouletteMinigameIfPending = function(){');
    const end = minigameSrc.indexOf('\n    };', start);
    const body = minigameSrc.slice(start, end);

    assert(/if\(cups\.length === 1 && cups\[0\] === '__prize_choice__'\)\{\s*\n\s*this\._openJackpotChoice\(\);/.test(body),
        'roulette_cups === [\'__prize_choice__\'] (ещё не выбрал забрать/рискнуть) → заново открывает попап выбора _openJackpotChoice()');
    assert(/else if\(cups\.length === 9\)\{\s*\n\s*this\._buildRouletteMinigameWin\(\);/.test(body),
        'roulette_cups — готовая раскладка из 9 стаканчиков (уже рискнул) → заново строит экран мини-игры _buildRouletteMinigameWin()');

    // Критично: НЕ _openRouletteMinigame() (та функция дёргает roulette.openMinigame() на
    // сервере, который сгенерирует НОВую раскладку поверх уже существующей и лишний раз
    // инкрементирует общий kush_counter) — используется именно _buildRouletteMinigameWin()
    // напрямую, тот же приём, что и внутри _openRouletteMinigame() ПОСЛЕ успешного ответа сервера.
    assert(!/this\._openRouletteMinigame\(\);/.test(body), 'resume НЕ вызывает _openRouletteMinigame() — это сгенерировало бы вторую, другую раскладку на сервере поверх уже существующей');
}

console.log('\nTest 3: пустое/отсутствующее состояние — no-op, резюмировать нечего (обычное открытие рулетки не ломается)');
{
    const start = minigameSrc.indexOf('proto._resumeRouletteMinigameIfPending = function(){');
    const end = minigameSrc.indexOf('\n    };', start);
    const body = minigameSrc.slice(start, end);

    assert(/if\(!window\.udata\) return;/.test(body), 'если udata ещё не загружен (не должно случиться к моменту открытия экрана, но защита есть) — no-op');
    assert(/if\(!Array\.isArray\(cups\) \|\| !cups\.length\) return;/.test(body),
        'обычный случай (roulette_cups === null, игрок никогда не выигрывал джек-пот или уже забрал обычную мини-игру) — no-op, экран рулетки открывается как раньше');
}

console.log('\nTest 4: _openRouletteScreen() вызывает resume-проверку при КАЖДОМ открытии экрана (не только один раз за сессию)');
{
    const start = rouletteSrc.indexOf('proto._openRouletteScreen = function(){');
    assert(start !== -1, '_openRouletteScreen() существует');
    const end = rouletteSrc.indexOf('\n    };', start);
    const body = rouletteSrc.slice(start, end);

    assert(/this\._resumeRouletteMinigameIfPending\(\);/.test(body), '_openRouletteScreen() вызывает this._resumeRouletteMinigameIfPending() — при каждом входе на экран, не только при первой постройке this._roulWin');

    // Порядок важен лишь косвенно (resume использует root.layer2_mc.addChild(...) сам по себе,
    // поверх уже добавленного this._roulWin) — просто подтверждаем, что вызов стоит ПОСЛЕ того,
    // как обычный экран рулетки уже добавлен в сцену (иначе resume-попап оказался бы спрятан за
    // ним / addChild что-то перепутал бы по порядку слоёв).
    const addWinIdx = body.indexOf('root.layer2_mc.addChild(this._roulWin);');
    const resumeIdx = body.indexOf('this._resumeRouletteMinigameIfPending();');
    assert(addWinIdx !== -1 && resumeIdx !== -1 && addWinIdx < resumeIdx,
        'resume-проверка стоит ПОСЛЕ добавления обычного экрана рулетки в сцену — попап/мини-игра окажется поверх него, не под ним');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
