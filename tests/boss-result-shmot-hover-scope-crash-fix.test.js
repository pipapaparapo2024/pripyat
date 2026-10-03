/**
 * Test: 28.09.2026, репорт игроков — "бой заканчиваешь, пропадает нижняя часть экрана,
 * показана старая хата, а на бой босса не нападёшь, пока не перезагрузишь игру. Победу вроде
 * как зачитывает, а именно напасть не разрешает." + консоль игрока:
 *   Uncaught ReferenceError: shmotHoverEls is not defined
 *       at e._showBossResultPopup (index.js?v=511:1:100841)
 *
 * Расследование: `let shmotHoverEls = null;` был объявлен ВНУТРИ блока `if(isWin){ ... }`
 * (там же, где строится иконка/тултип шмотки-награды), но читался ниже, УЖЕ ВНЕ этого блока —
 * в самом конце _showBossResultPopup(), при подъёме элементов тултипа над аватарами "УЧАСТНИКИ
 * БОЯ" (`if(shmotHoverEls){ win.addChild(...) }`). Из-за block-scope у `let` это
 * ReferenceError НА КАЖДОМ результате боя без исключения — и на победе, и на поражении (при
 * поражении блок if(isWin) вообще не выполняется, так что переменная не объявлялась нигде в
 * достижимой области видимости).
 *
 * Exception вылетало ДО `root.layer2_mc.addChild(win)` и ДО onClose-редиректа
 * (_doRedirect → _closeBossesFight()/_openBossesPopup() в bosses-combat.js) — поэтому попап
 * результата боя никогда не показывался, старый экран боя/хаты оставался висеть на экране
 * (симптом "пропадает нижняя часть, показана старая хата"), а следующий клик "напасть" уходил
 * на уже закрытую сервером сессию боя (bossStartMs сервер обнулял ДО этого попапа, в
 * bosses.claimKill — подтверждено логами сервера, ни одного ошибочного claimKill не найдено) —
 * отсюда "бой не начат" и визуально восстановившееся HP при следующем ударе.
 *
 * Фикс: объявление `let shmotHoverEls = null;` поднято в область видимости всей функции
 * _showBossResultPopup (до `if(isWin){`), а не блока if(isWin).
 *
 * Этот тест — генерик brace-scanner: находит объявление и место использования переменной,
 * проходит исходник от объявления вперёд, считая баланс `{`/`}`, и проверяет, что
 * непосредственно охватывающий объявление блок закрывается ПОСЛЕ места использования (то есть
 * использование остаётся в области видимости). Ловит весь класс таких багов (let/const,
 * объявленные внутри if/for/блока и прочитанные снаружи), а не только конкретные имена/строки —
 * переживёт будущие правки текста вокруг.
 *
 * Run: node tests/boss-result-shmot-hover-scope-crash-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'popups', 'boss_result.js'), 'utf-8');

// Находит индекс, в котором непосредственно охватывающий declIdx блок закрывается (глубина
// открытых-минус-закрытых скобок, считая от declIdx, впервые уходит в -1). -1, если такой
// закрывающей скобки не нашлось до конца файла (весь остаток файла внутри того же блока).
function findEnclosingBlockClose(source, declIdx) {
    let depth = 0;
    for (let i = declIdx; i < source.length; i++) {
        const ch = source[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            if (depth === 0) return i;
            depth--;
        }
    }
    return -1;
}

console.log('\nTest 1: ровно одно объявление `let shmotHoverEls` во всём файле (не дублируется правкой)');
{
    const declMatches = [...src.matchAll(/let shmotHoverEls\s*=\s*null;/g)];
    assert(declMatches.length === 1, 'найдено объявлений: ' + declMatches.length + ' (ожидалось 1)');
}

console.log('\nTest 2: объявление шире области видимости, чем if(isWin) — не должно быть удалено обратно внутрь блока награды');
{
    const declIdx = src.indexOf('let shmotHoverEls = null;');
    const rewardIfIdx = src.indexOf('if(isWin){', src.indexOf('Награда — суммы СПРАВА'));
    assert(declIdx > -1, 'объявление найдено');
    assert(rewardIfIdx > -1, 'блок if(isWin) награды найден');
    assert(declIdx < rewardIfIdx,
        'объявление стоит ДО if(isWin){ — то есть в области видимости всей функции, не внутри блока награды');
}

console.log('\nTest 3: место использования (подъём тултипа над аватарами) остаётся ДОСТУПНЫМ — не выходит из охватывающего блока раньше времени');
{
    const declIdx = src.indexOf('let shmotHoverEls = null;');
    const useIdx  = src.indexOf('if(shmotHoverEls){');
    assert(declIdx > -1 && useIdx > -1, 'и объявление, и использование найдены в файле');
    assert(useIdx > declIdx, 'использование идёт после объявления по тексту');

    const enclosingCloseIdx = findEnclosingBlockClose(src, declIdx);
    // Либо охватывающий блок не закрывается вообще до конца файла (значит это блок функции,
    // use внутри него гарантированно), либо закрывается СТРОГО ПОСЛЕ места использования —
    // в обоих случаях `shmotHoverEls` в момент `if(shmotHoverEls){` находится в области
    // видимости. Если охватывающий блок закрылся ДО useIdx — это ровно баг из репорта
    // (ReferenceError: shmotHoverEls is not defined).
    const inScope = enclosingCloseIdx === -1 || enclosingCloseIdx > useIdx;
    assert(inScope,
        'охватывающий объявление блок ' + (enclosingCloseIdx === -1 ? 'не закрывается до конца файла' : 'закрывается на позиции ' + enclosingCloseIdx)
        + ' — использование на позиции ' + useIdx + (inScope ? ' остаётся в области видимости' : ' УЖЕ ВНЕ области видимости (баг)'));
}

console.log('\nTest 4: присвоение shmotHoverEls (внутри if(isWin), где реально строится тултип) синтаксически валидно — простое присваивание, не redeclare через let/const');
{
    assert(/(?<!let )(?<!const )shmotHoverEls = \{ frame, itemImg, notObtainedOverlay, descCard \};/.test(src),
        'присваивание без let/const перед ним (иначе это было бы отдельное block-scoped объявление, маскирующее внешнее)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
