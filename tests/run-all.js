/**
 * Агрегатор всех регресс-тестов в tests/*.test.js.
 *
 * run_tests.js (корень проекта) — отдельный монолитный пре-деплойный скрипт со
 * своими ~80 проверками, он НЕ сканирует эту папку и не имеет к ней отношения.
 * Здесь же — 198+ отдельных файлов, каждый со своим набором ✅/❌ и
 * process.exit(1) при провале (см. любой tests/*.test.js как образец паттерна).
 * До этого файла не было способа прогнать их одной командой — этот скрипт
 * закрывает именно это (ПРАВИЛО №10 требует "полный набор", а полного набора
 * не существовало).
 *
 * Каждый файл запускается в ОТДЕЛЬНОМ процессе (spawnSync), поэтому throw/
 * process.exit(1) внутри одного файла не прерывает прогон остальных.
 * Агрегатору достаточно exit code — сами файлы уже печатают свои ✅/❌ в stdout.
 *
 * Run: node tests/run-all.js
 * Exit code: 0 — все файлы прошли; 1 — хотя бы один провалился (годится как gate перед деплоем).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TESTS_DIR = __dirname;

const files = fs.readdirSync(TESTS_DIR)
    .filter(f => f.endsWith('.test.js'))
    .sort();

console.log(`Найдено ${files.length} тестовых файлов в ${TESTS_DIR}\n`);

const passedFiles = [];
const failedFiles = [];

files.forEach((file, i) => {
    const fullPath = path.join(TESTS_DIR, file);
    const result = spawnSync(process.execPath, [fullPath], { encoding: 'utf-8' });

    const ok = result.status === 0 && !result.error;

    if (ok) {
        passedFiles.push(file);
        console.log(`[${i + 1}/${files.length}] ✅ ${file}`);
    } else {
        failedFiles.push(file);
        console.log(`[${i + 1}/${files.length}] ❌ ${file} (exit code: ${result.status === null ? "не запустился" : result.status})`);
        if (result.error) {
            console.log(`         ошибка запуска процесса: ${result.error.message}`);
        }
    }
});

console.log('\n' + '═'.repeat(60));
console.log(`Итог: ${passedFiles.length} файлов прошли, ${failedFiles.length} провалились (всего ${files.length})`);

if (failedFiles.length) {
    console.log('\nПровалившиеся файлы:');
    failedFiles.forEach(f => console.log('  ✗ ' + f));
    process.exit(1);
} else {
    console.log('Все тестовые файлы прошли.');
    process.exit(0);
}
