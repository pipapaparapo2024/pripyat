/**
 * Test: батч 23.09.2026 (по прямому указанию — "вставь иконку сталкера как заглушку на новые
 * координаты, туда же вставляй изображение игрока который выбил джекпот, иконку 47×42px").
 *
 * Раньше окошко фото победителя джекпота либо показывало СВОЁ фото (заглушка "чтобы видно было
 * окно/размер, не итоговая логика", комментарий 22.09.2026), либо серый PIXI.Graphics-квадрат,
 * если своего фото не было. Реального победителя roulette_winner не хранил вовсе (только
 * name/amount). Теперь: иконка-заглушка по умолчанию (рулетка иконка сталкера.png, тот же файл,
 * что уже используется у stalkerIconSpr рядом), настоящее фото подставляется по VK id, который
 * roulette_winner теперь тоже хранит — резолвится тем же bosses._resolveVkUsers(), что уже
 * используется для топ-3 участников боя с боссом.
 *
 * Run: node tests/roulette-jackpot-winner-real-photo.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const screenSrc = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-screen.js'), 'utf-8');
const orchSrc   = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette.js'), 'utf-8');

console.log('\nTest 1: winnerPhotoSpr — 03.10.2026: заглушка-иконка убрана, стартует пустым/невидимым; 10.10.2026: новые позиция/размер с редактора позиций');
{
    assert(/const winnerPhotoSpr = new PIXI\.Sprite\(PIXI\.Texture\.EMPTY\);/.test(screenSrc),
        'winnerPhotoSpr по умолчанию — Texture.EMPTY (иконка сталкера больше не используется)');
    // 10.10.2026 (по прямому указанию, редактор позиций — новое расположение иконки победителя):
    // было 47×42 @ (739,279) → стало 44×44 (квадрат) @ (741,265).
    assert(/winnerPhotoSpr\.width = 44; winnerPhotoSpr\.height = 44;/.test(screenSrc), 'размер обновлён на 44×44 (10.10.2026)');
    assert(/winnerPhotoSpr\.x = 741; winnerPhotoSpr\.y = 265;/.test(screenSrc), 'позиция обновлена на x:741 y:265 (10.10.2026)');
    assert(/winnerPhotoSpr\.visible = false;/.test(screenSrc), 'по умолчанию невидим');
    assert(!/winnerPhotoSpr instanceof PIXI\.Graphics/.test(screenSrc), 'старая ветка PIXI.Graphics-заглушки убрана целиком');
}

console.log('\nTest 2: победитель джекпота — id формируется СЕРВЕРОМ в roulette_winner (нужен для резолва настоящего фото)');
{
    // 25.09.2026 (регресс найден повторным прогоном тестов — фикс "ник победителя показывается
    // повреждённым/СТАЛКЕР"): запись roulette_winner убрана из клиента (dvor-roulette-screen.js)
    // целиком — раньше она срабатывала ЗДЕСЬ, ДО решения игрока забрать/рискнуть, JSON.stringify()
    // напрямую в client-writable поле без гарантии кодировки. Теперь пишет roulette.php.claimPrize()
    // на сервере — см. roulette-winner-nickname-server-authoritative.test.js для полной проверки.
    const m = screenSrc.match(/if\(slot\.type === 'super'\)\{([\s\S]*?)\n        \} else if/);
    assert(!!m, 'ветка super (джекпот) найдена');
    const body = m ? m[1] : '';
    assert(!/udata\['roulette_winner'\] = JSON\.stringify\(winner\);/.test(body),
        'клиент больше НЕ пишет roulette_winner напрямую (перенесено на сервер)');
    assert(/this\._openJackpotChoice\(\);/.test(body), 'по-прежнему открывает попап выбора забрать/рискнуть');
}

console.log('\nTest 3: dvor-roulette.js — резолвит настоящее фото победителя по id и подставляет в winnerPhotoSpr');
{
    const m = orchSrc.match(/const w = helper\.safeParseJSON\(udata\['roulette_winner'\], null\);\s*\n\s*if\(w && w\.name\)\{([\s\S]*?)\n            \}\s*\n\s*\} catch/);
    assert(!!m, 'блок применения roulette_winner найден');
    const body = m ? m[1] : '';
    assert(/bosses\._resolveVkUsers\(\[w\.id\], \(users\) => \{/.test(body),
        'КРИТИЧНО: реальное фото резолвится через bosses._resolveVkUsers (тот же приём, что топ-3 боя с боссом)');
    assert(/this\._roulWinnerPhotoSpr\.texture = PIXI\.Texture\.from\(u\.photo\);/.test(body),
        'найденное фото подставляется в winnerPhotoSpr.texture');
    assert(/this\._roulWinnerPhotoSpr\.visible = true;/.test(body),
        '03.10.2026: спрайт становится видимым только при реальном резолве фото (до этого — невидим)');
    assert(/this\._roulWinnerPhotoId !== w\.id/.test(body),
        'кэш по id — не дёргает VK API повторно на каждый _updateRouletteUI(), только при смене победителя');
}

console.log('\nTest 4: декоративный дубль удалён');
assert(!screenSrc.includes('const stalkerIconSpr ='), 'вторая иконка не создаётся');

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
