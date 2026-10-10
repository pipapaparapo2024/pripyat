/**
 * 10.10.2026 (по прямому указанию — "когда в базу игрока заходишь через сводку, показывает
 * всех в дефолт базах. Должно быть отображаться в какой он сидит"): попап профиля чужого
 * игрока (player_profile.js, открывается из Сводки/рейтинга урона/визитки) всегда рисовал
 * дефолтный фон "кубрик.png" — чужое поле base_bg_active (индекс купленного/активного фона
 * базы) ни читалось сервером в users.getProfile, ни использовалось клиентом.
 *
 * Фикс — два места:
 * 1) server/core/controllers/users.php::getProfile() — base_bg_active добавлен в SELECT и в
 *    публичный срез ответа (чисто косметическое поле, не экономика/секрет — безопасно отдавать).
 * 2) _client/src/game/shell/overlays/player_profile.js — фон строится по profile.base_bg_active
 *    тем же каталогом файлов/подгонки (y/scale), что Home._bgFiles/_bgAdjust в home.js.
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const usersPhp = fs.readFileSync(path.join(root, 'server', 'core', 'controllers', 'users.php'), 'utf-8');
const profileJs = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), 'utf-8');
const homeJs = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'home.js'), 'utf-8');

console.log('\n1) server: users.getProfile() читает base_bg_active из БД и отдаёт его в ответе');
{
    const start = usersPhp.indexOf('function getProfile(){');
    const end = usersPhp.indexOf('function save(){', start);
    const body = usersPhp.slice(start, end);
    assert(/'base_bg_active'\]\s*,?\s*\n?\s*\],?\s*\n?\s*'id='/.test(body.replace(/\s+/g, ' ')) || /getData\(\s*\$this->registry\['utb'\],\s*\[[^\]]*'base_bg_active'[^\]]*\]/.test(body.replace(/\s+/g, ' ')),
        'base_bg_active присутствует в списке колонок SELECT (getData)');
    assert(/'base_bg_active'\s*=>\s*intval\(\$row\['base_bg_active'\]\s*\?\?\s*0\)/.test(body),
        'base_bg_active присутствует в публичном выходном массиве профиля');
}

console.log('\n2) client: player_profile.js больше не хардкодит "кубрик.png" безусловно');
{
    assert(!/const bg = new PIXI\.Sprite\(PIXI\.Texture\.from\('\.\/images\/кубрик\.png'\)\);/.test(profileJs),
        'жёсткая ссылка на кубрик.png без учёта base_bg_active убрана');
    assert(/const PROFILE_BG_FILES = \['кубрик\.png','шлюз\.png','канализация\.png','двор_фон\.png','мастерская\.png','железка\.png','станция\.png','заправка\.png'\];/.test(profileJs),
        'тот же набор файлов фона базы (8 штук), что и в home.js');
    assert(/const bgIdx = Math\.max\(0, Math\.min\(PROFILE_BG_FILES\.length - 1, parseInt\(profile\.base_bg_active \|\| 0\) \|\| 0\)\);/.test(profileJs),
        'индекс фона вычисляется из profile.base_bg_active (сервер), с тем же клампом, что home.js');
    assert(/bg\.width = 1280 \* bgAdj\.scale; bg\.height = 604 \* bgAdj\.scale; bg\.y = bgAdj\.y;/.test(profileJs),
        'размер/позиция фона учитывают индивидуальную подгонку (bgAdj), как в home.js');
}

console.log('\n3) sanity — список файлов и таблица подгонки совпадают 1-в-1 с home.js (не разошлись вручную)');
{
    const homeFilesMatch = homeJs.match(/_bgFiles = (\[[^\]]+\]);/);
    const profileFilesMatch = profileJs.match(/const PROFILE_BG_FILES = (\[[^\]]+\]);/);
    assert(!!homeFilesMatch && !!profileFilesMatch, 'оба массива файлов найдены в исходниках');
    if (homeFilesMatch && profileFilesMatch) {
        assert(homeFilesMatch[1] === profileFilesMatch[1], 'PROFILE_BG_FILES побайтово совпадает с Home._bgFiles');
    }
}

console.log('\n4) Реальный прогон клампа индекса (та же формула, что в коде) — граничные случаи');
{
    function clampIdx(raw, len){
        return Math.max(0, Math.min(len - 1, parseInt(raw || 0) || 0));
    }
    const LEN = 8;
    assert(clampIdx(undefined, LEN) === 0, 'нет поля (undefined) -> индекс 0 (дефолтный кубрик)');
    assert(clampIdx(0, LEN) === 0, 'явный 0 -> кубрик');
    assert(clampIdx('6', LEN) === 6, 'строка "6" (как приходит из БД VARCHAR) -> станция.png');
    assert(clampIdx(999, LEN) === 7, 'выход за диапазон сверху зажимается до последнего файла (заправка.png), не падает');
    assert(clampIdx(-5, LEN) === 0, 'отрицательное значение зажимается до 0, не уходит в минус индекса массива');
    assert(clampIdx('не число', LEN) === 0, 'мусорная строка -> parseInt NaN -> дефолт 0');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
