/**
 * Test: 17.10.2026, по прямому указанию — репорт "персонаж пиксельный при отдалении/мелком
 * показе". Корень: images/персонаж который сидит.png — 1224×1737, рисуется принудительными
 * 273×389 (×0.223) на ТРЁХ экранах (главный экран, визит к игроку, магазин шмоток). Файл не
 * степень двойки → дефолт PIXI MIPMAP_MODES.POW2 мипмапы для него не генерирует → GPU
 * сэмплирует полноразмерную текстуру при сильном уменьшении, алиасинг на лице/надписях.
 *
 * Фикс — baseTexture.mipmap = PIXI.MIPMAP_MODES.ON на всех трёх местах создания текстуры.
 * Безопасно для WebGL1 (NPOT-мипмапы там не поддерживаются спецификацией в принципе, PixiJS
 * сам это учитывает перед вызовом gl.generateMipmap() — no-op без ошибок), выигрыш — на WebGL2
 * (подавляющее большинство текущих VK-вебвью/браузеров).
 *
 * Run: node tests/character-sprite-mipmap-fix.test.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');

const FILES = [
    path.join(root, '_client', 'src', 'game', 'home.js'),
    path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'),
    path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'),
];

console.log('\nTest 1: все три экрана с "персонаж который сидит.png" форсируют mipmap ON и зовут update()');
{
    FILES.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        const relName = path.relative(root, file);
        // Берём участок вокруг создания текстуры персонажа — ищем окно текста между упоминанием
        // файла и следующими ~300 символами, где должны стоять обе строки фикса.
        const idx = content.indexOf("Texture.from('./images/персонаж который сидит.png')");
        assert(idx > -1, `${relName}: текстура персонажа всё ещё создаётся (не удалена/не переименована)`);
        if (idx > -1) {
            const window_ = content.slice(Math.max(0, idx - 200), idx + 1200);
            assert(/baseTexture\.mipmap\s*=\s*PIXI\.MIPMAP_MODES\.ON/.test(window_),
                `${relName}: mipmap = PIXI.MIPMAP_MODES.ON стоит рядом с созданием текстуры персонажа`);
            assert(/baseTexture\.update\(\)/.test(window_),
                `${relName}: baseTexture.update() вызван, чтобы фикс применился даже если текстура уже закэширована`);
        }
    });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
