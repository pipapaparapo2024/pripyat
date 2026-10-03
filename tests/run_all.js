/**
 * Единый агрегатор для tests/*.test.js (независимые регресс-тесты, каждый — свой node-процесс,
 * см. CLAUDE.md "Тесты — ВАЖНО"). Раньше прогонялись вручную циклом
 * (`for f in tests/*.test.js; do node "$f"; done`) — этот скрипт делает то же самое, но
 * с итоговой сводкой и ненулевым exit-кодом при провале (удобно перед словом «деплой»).
 *
 * Критерий провала — ТОЛЬКО код завершения процесса (ненулевой), не текстовый поиск "FAIL"/
 * "ошибка" в выводе: часть тестов легитимно печатает такие слова в успешных строках
 * (например "18 passed, 0 failed"), текстовый grep даёт ложные срабатывания.
 *
 * Запуск: node tests/run_all.js
 * Не запускается автоматически — только вручную, по тому же правилу проекта, что и остальные
 * тесты (прогон только перед «деплой», не после каждой правки).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const testsDir = __dirname;
const files = fs.readdirSync(testsDir)
    .filter(f => f.endsWith('.test.js'))
    .sort();

let passed = 0;
let failed = 0;
const failedFiles = [];
const startedAt = Date.now();

for(const file of files){
    const fullPath = path.join(testsDir, file);
    const result = spawnSync(process.execPath, [fullPath], { encoding: 'utf8' });
    if(result.status === 0){
        passed++;
    } else {
        failed++;
        failedFiles.push({ file, code: result.status, output: (result.stdout || '') + (result.stderr || '') });
    }
}

const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

if(failedFiles.length){
    console.log('\n' + '─'.repeat(60));
    console.log(`ПРОВАЛИЛИСЬ (${failedFiles.length}):`);
    for(const f of failedFiles){
        console.log(`\n✗ ${f.file} (exit ${f.code})`);
        console.log(f.output.split('\n').slice(-15).join('\n'));
    }
}

console.log('\n' + '═'.repeat(60));
console.log(`Итого: ${files.length} файлов, ${passed} прошли, ${failed} провалились (${elapsedSec}с)`);

if(failed > 0){
    console.log('Есть провалы — деплоить нельзя, пока не починены.');
    process.exit(1);
} else {
    console.log('Все тесты прошли — можно деплоить!');
}
