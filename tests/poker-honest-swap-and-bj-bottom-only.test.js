/**
 * Test: два прямых указания пользователя, реверсирующих/уточняющих более раннюю логику.
 *
 * 1) Покер — смена карт снова ЧЕСТНАЯ и случайная (может поменять итоговую комбинацию).
 *    Раздача по-прежнему задаётся весовым броском (проценты по ТЗ), но резолв считает
 *    награду по факту финальной руки, а не по зафиксированному при раздаче target.
 *    (Только в покере — карты/зарики остаются под защитой скрытых порогов.)
 *
 * 2) Блэкджек — смена карт возможна ТОЛЬКО на нижних картах (слоты 2/3, формируют
 *    пару) — верхние декоративные карты больше не кликабельны в режиме смены.
 *    Постоянная жёлтая рамка на время смены убрана, вместо неё лёгкий ховер-эффект
 *    (прозрачность) только на нижних картах.
 *
 * 3) Блэкджек — порядок приоритета при одновременном совпадении нескольких порогов:
 *    дамы → короли → тузы (младшая комбинация выпадает первой).
 *
 * 4) Блэкджек — смена честно может СЛОМАТЬ даже уже выбитую сменой гарантированную
 *    пару (по прямому указанию: "игрок должен уметь честно испортить себе уже
 *    выбитую пару неудачной сменой"). Счётчик/порог при этом сбрасывается по факту
 *    того, что было ВЫБИТО и РОЗДАНО в начале партии (this._bjForcedRank), а не по
 *    факту итоговой награды — даже если игрок сломал пару и ничего не получил,
 *    диапазон всё равно считается использованным.
 *
 * 5) Блэкджек — строка "любая непарная комбинация" в таблице выплат поднята чуть выше
 *    по прямой правке, остальные 8 строк не затронуты.
 *
 * Run: node tests/poker-honest-swap-and-bj-bottom-only.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src', 'game', 'dvor');
const pokerGameSrc = fs.readFileSync(path.join(root, 'dvor-poker-game.js'), 'utf-8');
const bjSrc        = fs.readFileSync(path.join(root, 'dvor-blackjack.js'), 'utf-8');
// 18.09.2026: смена/резолв покера переехали на сервер (server/core/controllers/poker.php) —
// RNG больше не в браузере (см. tests/poker-server-authoritative.test.js для полной проверки).
const pokerPhpSrc  = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'poker.php'), 'utf-8');

console.log('\nTest 1: покер — смена честная и случайная, резолв считает по финальной руке (теперь на сервере)');
{
    const swapStart = pokerPhpSrc.indexOf('function swap(){');
    const swapEnd   = pokerPhpSrc.indexOf('\n        }', pokerPhpSrc.indexOf('$this->ops->ok', swapStart));
    const swapBody  = pokerPhpSrc.slice(swapStart, swapEnd);
    assert(!/targetCombo/.test(swapBody), 'смена не сверяется с зафиксированным при раздаче target');
    assert(!/_generateHandForCombo/.test(swapBody), 'смена не перегенерирует руку под target — честный случайный подбор карты');

    const resolveStart = pokerPhpSrc.indexOf('function resolve(){');
    const resolveEnd   = pokerPhpSrc.indexOf('\n        }', pokerPhpSrc.indexOf('$this->ops->ok', resolveStart));
    const resolveBody  = pokerPhpSrc.slice(resolveStart, resolveEnd);
    assert(/\$combo = \$this->_evaluateHand\(\$catalog, \$session\['hand'\]\);/.test(resolveBody),
        'резолв честно пересчитывает итог по факту финальной руки на столе');

    // Клиент — простой прокси, не содержит RNG/оценки руки вовсе.
    assert(/TS\.php\('poker\.swap'/.test(pokerGameSrc), 'клиент шлёт замену на сервер (poker.swap)');
    assert(/TS\.php\('poker\.resolve'/.test(pokerGameSrc), 'клиент шлёт итог на сервер (poker.resolve)');
    assert(!/proto\._evaluatePokerHand\s*=/.test(pokerGameSrc), 'клиент не содержит собственной оценки руки');
}

console.log('\nTest 2: блэкджек — смена только на нижних картах (2/3), верхние декоративные не кликабельны');
{
    const activateBody = bjSrc.match(/proto\._activateSwapMode = function\(\)\{([\s\S]*?)\n    \};/)[1];
    assert(/for\(let i = 2; i <= 3; i\+\+\)\{/.test(activateBody), 'делает кликабельными только слоты 2 и 3');
    assert(/for\(let i = 0; i <= 1; i\+\+\)\{/.test(activateBody), 'явно отключает интерактивность у слотов 0 и 1');
    assert(/spr\.interactive = false;/.test(activateBody), 'верхние декоративные карты не интерактивны в режиме смены');
}

console.log('\nTest 3: блэкджек — постоянная жёлтая рамка убрана, вместо неё ховер-прозрачность');
{
    assert(!/_glow/.test(bjSrc), 'свойство/объект _glow полностью убран из файла (мёртвый код после смены на hover-эффект)');
    const activateBody = bjSrc.match(/proto\._activateSwapMode = function\(\)\{([\s\S]*?)\n    \};/)[1];
    assert(/pointerover.*spr\.alpha = 0\.7/.test(activateBody) || /spr\.on\('pointerover', \(\)=>\{ spr\.alpha = 0\.7; \}\);/.test(activateBody),
        'наведение делает нижнюю карту полупрозрачной (ховер-эффект)');
    assert(/spr\.on\('pointerout',\s*\(\)=>\{ spr\.alpha = 1; \}\);/.test(activateBody), 'уход курсора возвращает непрозрачность');
}

// 18.09.2026 (перенос Блэкджека на сервер, см. tests/blackjack-server-authoritative.test.js для
// полной проверки): вся pity/forcedRank-логика (Test 4-6 ниже) переехала ЦЕЛИКОМ в
// server/core/controllers/blackjack.php — читер мог иначе подделать pity-счётчики через
// users.save (были частью client-writable dvor_games_data) и форсировать гарантированную
// премиум-пару в каждой партии. Поведение не менялось, только переехало на сервер.
const bjPhpSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'core', 'controllers', 'blackjack.php'), 'utf-8');
const bjConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'json', 'blackjack_config.json'), 'utf-8'));

console.log('\nTest 4: блэкджек — приоритет одновременных порогов: дамы → короли → тузы (теперь в blackjack_config.json)');
{
    assert(JSON.stringify(bjConfig.premium_order) === JSON.stringify([['qq','дама'], ['kk','король'], ['aa','туз']]),
        'порядок проверки — qq, затем kk, затем aa (младшая комбинация выпадает первой)');
    assert(/foreach\(\$catalog\['premium_order'\] as \$row\)/.test(bjPhpSrc), 'deal() проверяет пороги строго в этом порядке из каталога, не хардкод');
}

console.log('\nTest 5: блэкджек — смена честно может сломать гарантированную пару (теперь на сервере)');
{
    const start = bjPhpSrc.indexOf('function swap(){');
    const end   = bjPhpSrc.indexOf('\n        }', bjPhpSrc.indexOf('$this->ops->ok', start));
    const swapBody = bjPhpSrc.slice(start, end);
    assert(!/\$rank = \$forcedRank \?: /.test(swapBody),
        'ранг больше НЕ форсируется даже когда порог выбит — смена честная всегда (форсирование только при РАЗДАЧЕ, не при смене)');
    assert(/\$rank === \$otherRank && in_array\(\$rank, \$PREMIUM, true\) && \$rank !== \$forcedRank/.test(swapBody),
        'по-прежнему нельзя случайно СОБРАТЬ чужую (не выбитую) премиум-пару — только сохранить/сломать свою выбитую');
}

console.log('\nTest 6: блэкджек — счётчик сбрасывается по факту РОЗДАЧИ (active.forcedRank), не по факту награды (теперь на сервере)');
{
    const start = bjPhpSrc.indexOf('function resolve(){');
    const end   = bjPhpSrc.indexOf('\n        }', bjPhpSrc.indexOf('$this->ops->ok', start));
    const resolveBody = bjPhpSrc.slice(start, end);
    assert(/\$forcedKey\s*=\s*\$active\['forcedRank'\] \? \(\$catalog\['premium_map'\]\[\$active\['forcedRank'\]\] \?\? null\) : null;/.test(resolveBody),
        'ключ для сброса счётчика берётся из того, что было ВЫБИТО и РОЗДАНО при раздаче (active.forcedRank)');
    assert(!/if\(\$bestRank && \$catalog\['premium_map'\]\[\$bestRank\]\)/.test(resolveBody),
        'больше не привязано к итоговой награде (bestRank) — даже сломанная сменой пара сбрасывает счётчик');
}

console.log('\nTest 7: блэкджек — все 9 строк (включая "любая непарная") на единых точечных координатах (22.09.2026)');
{
    // Раньше подъём __nonpair был вычитанием (BJ_NONPAIR_LIFT), затем отдельными константами
    // (BJ_NONPAIR_W/H/CY, 15.09.2026); после точечного замера редактором позиций для ВСЕХ 9
    // строк разом (22.09.2026) __nonpair стал обычной записью в общем объекте BJ_ROW_Y, без
    // отдельных размеров — см. blackjack-combo-highlight-point-data-and-error-popup-position.test.js.
    assert(!/BJ_NONPAIR_W|BJ_NONPAIR_H|BJ_NONPAIR_CY/.test(bjSrc), 'старые BJ_NONPAIR_* константы убраны целиком');
    assert(/'__nonpair':\s*522,/.test(bjSrc), '__nonpair — обычная запись в BJ_ROW_Y (522, реальный замер всех 9 строк 04.10.2026), та же ширина/высота, что у остальных 8 строк');
    // 26.09.2026: X/W/H уточнены после фикса бага сдвига подсветки вправо на ~140px
    // 03.10.2026: новый фон letterbox-вписан (bg.x=86, bg.width=1108) — X/W пересчитаны (878/241).
    assert(/const BJ_ROW_X = 895, BJ_ROW_W = 279, BJ_ROW_H = 37;/.test(bjSrc), 'единые X/W/H для всех 9 строк таблицы выплат пересчитаны под нативный (не letterbox) размер фона 04.10.2026');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
