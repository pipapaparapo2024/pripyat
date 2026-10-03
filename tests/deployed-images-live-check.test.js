/**
 * Test: батч 19.09.2026 — репорт "ты точно грузишь в ту папку и на тот сервер? проверь".
 *
 * Все прошлые проверки картинок в этом проекте сверяли только ЛОКАЛЬНУЮ папку
 * _client/development/images/ — это доказывает, что файл существует у меня на диске, но НЕ
 * доказывает, что он реально долетел до продакшена (см. CLAUDE.md, "Картинки — ТОЛЬКО в
 * .../images/, без /development/" — уже был баг именно такого рода). Этот тест стучится
 * НАПРЯМУЮ на живой прод-URL (HEAD-запрос) и сверяет Content-Length с локальным файлом —
 * так расхождение (не туда залито / залито не то / вообще не залито) видно сразу, а не
 * только когда игрок открывает магазин и видит пустое место.
 *
 * Требует интернет-доступа с машины, где запускается тест. Если сеть недоступна — тест
 * сообщает об этом явно (SKIP), а не падает молча и не считается пройденным.
 *
 * Run: node tests/deployed-images-live-check.test.js
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

let passed = 0, failed = 0, skipped = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const IMAGES_DIR = path.join(__dirname, '..', '_client', 'development', 'images');
const BASE_URL   = 'https://pripyat-game.ru/client/ver0_41/images/';

// dir: '' — файл лежит в корне images/; 'shmot' — код (home.js/shmot_shop.js) грузит
// предметы гардероба ИМЕННО из подпапки images/shmot/, см. shmot-organized-catalog-and-sources.test.js
// (19.09.2026: 32 новых предмета были ошибочно залиты в корень — исправлено там же).
const FILES_TO_CHECK = [
    { dir: '',      file: 'боевка попап фон.png' },
    { dir: '',      file: 'боевка попап охотник.png' },
    { dir: '',      file: 'боевка попап ещё раз.png' },
    { dir: '',      file: 'боевка попап шмотка.png' },
    { dir: 'shmot', file: 'шмот кроссовки спортик2.0.png' },
    { dir: 'shmot', file: 'шмот кепка вольный.png' },
    { dir: 'shmot', file: 'шмот кроссовки вольный.png' },
    { dir: 'shmot', file: 'шмот шорты игроман2.0.png' },
    { dir: 'shmot', file: 'шмот кроссовки игроман2.0.png' },
    { dir: 'shmot', file: 'шмот кроссовки спортик.png' },
    // 23.09.2026: 'шмот бандана игроман2.0.png' убран из проверки — файл намеренно удалён с
    // прода (дублировал старую иконку базового магазина голова_1.png/id0, см. shmot.js и
    // tests/shmot-organized-catalog-and-sources.test.js) вместе с 4 другими такими же дублями.
    // Заменён на 'шмот часы игроман покер.png' — единственный предмет сета "Игроман",
    // оставшийся в каталоге после той же чистки, по-прежнему должен быть на проде.
    { dir: 'shmot', file: 'шмот часы игроман покер.png' },
];

function headRequest(url) {
    return new Promise((resolve) => {
        const req = https.request(url, { method: 'HEAD', timeout: 10000 }, (res) => {
            resolve({ status: res.statusCode, length: parseInt(res.headers['content-length'] || '0', 10) });
        });
        req.on('error', (e) => resolve({ error: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
        req.end();
    });
}

async function main() {
    console.log('\nTest: живой прод-URL отдаёт каждый файл с тем же размером, что и локальный (реальная заливка, не локальная папка)');

    let networkOk = true;
    for (const { dir, file } of FILES_TO_CHECK) {
        const localPath = path.join(IMAGES_DIR, dir, file);
        if (!fs.existsSync(localPath)) {
            assert(false, `${file} — локальный файл не найден (искали в ${dir || '(корень)'}), сверять не с чем`);
            continue;
        }
        const localSize = fs.statSync(localPath).size;
        const urlPath = dir ? dir + '/' + encodeURIComponent(file) : encodeURIComponent(file);
        const url = BASE_URL + urlPath;
        const res = await headRequest(url);

        if (res.error) {
            if (!networkOk) continue; // сеть уже помечена недоступной — не дублируем сообщения
            console.log(`  ⚠️  SKIP ${file} — сеть недоступна (${res.error}), живая проверка невозможна с этой машины`);
            skipped++;
            networkOk = false;
            continue;
        }
        assert(res.status === 200, `${file} — HTTP ${res.status} (ожидался 200) | ${url}`);
        if (res.status === 200) {
            assert(res.length === localSize, `${file} — размер на проде ${res.length} байт совпадает с локальным ${localSize} байт`);
        }
    }

    console.log(`\n${'─'.repeat(50)}`);
    if (skipped > 0 && failed === 0) {
        console.log(`⚠️  ${skipped} проверок пропущено (нет сети), ${passed} прошли — перезапустить с доступом в интернет для полной проверки`);
    } else if (failed === 0) {
        console.log(`✅ All ${passed} tests passed`);
    } else {
        console.log(`❌ ${failed} FAILED, ${passed} passed`);
        process.exit(1);
    }
}

main();
