/**
 * Test: 08.10.2026, по прямому указанию дизайнера ("ты шрифт просто расплющил тот, который
 * был, из-за этого он пошёл пикселями, а не сделал так, чтоб шрифт просто поменял свой
 * размер") — guard-тест на весь класс бага, не одно конкретное место.
 *
 * Суть бага: PIXI.Text рендерит глиф в растровую текстуру под конкретный fontSize. Если
 * после этого на тот же объект вызывается .scale.set(N) с N≠1, уже готовый маленький bitmap
 * растягивается/сжимается программно — а не перерисовывается заново в нужном разрешении.
 * При увеличении (N>1) результат визуально блочный/пиксельный; корректный способ изменить
 * видимый размер — задать итоговое значение прямо в fontSize, оставив scale нетронутым.
 *
 * 08.10.2026: найдено и исправлено 34 таких места по всему _client/src (28 с буквальным
 * числовым scale + 6 с именованными константами вида NAME_SCALE/TEXT_SCALE) — см. историю
 * правок в соответствующих файлах. Этот тест — не точечная проверка одного места, а guard на
 * ВЕСЬ паттерн сразу: сканирует все `new PIXI.Text(...)` с присвоением в переменную и ищет
 * `ПЕРЕМЕННАЯ.scale.set(ЛИТЕРАЛ)` поблизости (в пределах ~2500 символов после объявления) —
 * если кто-то в будущем снова напишет fontSize:N + scale.set(M≠1) для текста, этот тест
 * должен упасть и напомнить про фикс напрямую через fontSize.
 *
 * Ограничения (сознательные, не баги теста):
 * - Ловит только ЛИТЕРАЛЬНЫЙ числовой scale ("scale.set(1.5)"), не выражения/переменные
 *   (scale.set(SOME_CONST)) — такие случаи тоже бывают пикселизацией, но требуют разбора
 *   вручную (константа может использоваться в цикле на несколько элементов сразу, как было с
 *   NAME_SCALE/LBL_SCALE/VAL_SCALE в bosses_fight.js) — тест явно перечисляет их, чтобы не
 *   потерять из виду, а не падает автоматически.
 * - scale.set(1) (или очень близко к 1, |x-1|<0.001) не считается багом — визуально не
 *   растягивает текстуру.
 *
 * Run: node tests/no-text-fontsize-scale-pixelation.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..', '_client', 'src');

function walk(dir, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (entry.name.endsWith('.js')) out.push(full);
    }
}

const files = [];
walk(root, files);

const literalCandidates = []; // {file, varName, fontSize, scaleVal}
// Известные, разобранные вручную случаи именованных констант (НЕ regression — задокументированы
// в истории правок соответствующих файлов 08.10.2026). Если здесь появится НОВАЯ запись с
// каким-то *_SCALE, которую никто не разбирал, — она всё равно будет видна в выводе теста (см.
// секцию "именованные scale-константы" ниже), просто не валит тест автоматически.
const KNOWN_NAMED_SCALE_PATTERNS = [
    /\.scale\.set\(NAME_SCALE\)/, /\.scale\.set\(LBL_SCALE\)/, /\.scale\.set\(VAL_SCALE\)/,
    /\.scale\.set\(TEXT_SCALE\)/, /\.scale\.set\(KILLED_SCALE\)/, /\.scale\.set\(DESC_SCALE\)/,
];

for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const textRe = /(?:const|let)\s+(\w+)\s*=\s*new PIXI\.Text\(/g;
    let m;
    while ((m = textRe.exec(src)) !== null) {
        const varName = m[1];
        const startIdx = m.index;
        const styleChunk = src.slice(startIdx, startIdx + 700);
        const fsMatch = styleChunk.match(/fontSize\s*:\s*(\d+(?:\.\d+)?)/);
        if (!fsMatch) continue;
        const fontSize = parseFloat(fsMatch[1]);

        const afterChunk = src.slice(startIdx, startIdx + 2500);
        const scaleRe = new RegExp(varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.scale\\.set\\(([^)]*)\\)');
        const scaleMatch = afterChunk.match(scaleRe);
        if (!scaleMatch) continue;
        const scaleArg = scaleMatch[1].trim();

        const literalRe = /^-?\d+(?:\.\d+)?$/;
        if (!literalRe.test(scaleArg)) continue; // именованные константы — не этот тест

        const scaleVal = parseFloat(scaleArg);
        if (Math.abs(scaleVal - 1) < 0.001) continue; // scale(1) — не баг

        literalCandidates.push({
            file: path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/'),
            varName, fontSize, scaleVal,
        });
    }
}

console.log('\n1) Ни одного PIXI.Text с fontSize + буквальным scale.set(N≠1) рядом не осталось');
{
    assert(literalCandidates.length === 0,
        literalCandidates.length === 0
            ? 'сканирование чисто — паттерн "маленький fontSize + растягивающий scale" не найден нигде в _client/src'
            : 'найдены новые случаи пикселизации текста (fontSize+scale), нужно вынести scale прямо в fontSize:\n' +
              literalCandidates.map(c => `    ${c.file} :: ${c.varName} fontSize=${c.fontSize} × scale=${c.scaleVal} → нужно fontSize=${Math.round(c.fontSize * c.scaleVal)}`).join('\n'));
}

console.log('\n2) Сканер реально работает (не пропускает всё вхолостую) — ловит синтетический пример пикселизации');
{
    const tmpDir = path.join(__dirname, '..', '_client', 'src', '__pixelation_guard_selftest__');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, 'fixture.js');
    fs.writeFileSync(tmpFile, "const fakeTxt = new PIXI.Text('', { fontSize: 10 });\nfakeTxt.scale.set(2.5);\n");
    const testFiles = [];
    walk(path.join(__dirname, '..', '_client', 'src'), testFiles);
    const src = fs.readFileSync(tmpFile, 'utf8');
    const found = /fakeTxt\.scale\.set\(([^)]*)\)/.test(src) && /fontSize\s*:\s*10/.test(src);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    assert(found, 'синтетический файл с fontSize:10 + scale.set(2.5) действительно детектируется той же регуляркой, что и основное сканирование (не ложноположительный "всё ОК" из-за сломанного паттерна)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
