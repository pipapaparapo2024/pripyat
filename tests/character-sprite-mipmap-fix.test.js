/**
 * Test: 17.10.2026, по прямому указанию — репорт "персонаж пиксельный при отдалении/мелком
 * показе". Корень: images/персонаж который сидит.png — 1224×1737, рисуется принудительными
 * 273×389 (×0.223). Файл не степень двойки → дефолт PIXI MIPMAP_MODES.POW2 мипмапы для него не
 * генерирует → GPU сэмплирует полноразмерную текстуру при сильном уменьшении, алиасинг на
 * лице/надписях.
 *
 * 18.10.2026 (баг найден по прямому указанию — "режется качество одежды и персонажа", разобран
 * через консоль: typeof window.root, !!canvas.getContext('webgl2') и т.д.): фикс от 17.10.2026
 * был нанесён НЕ на все места, где грузится тот же файл тем же способом (ровно тот класс
 * ошибки, что в AGENTS.md описан как "критичные общие функции — проверять ВСЕ вызывающие
 * места"). Реальный охват персонажа на момент репорта — 3 экрана из 5 (главный экран, визитка
 * игрока, магазин шмоток), пропущены База (base.js) и Хата (hata.js, overlays/hata.js) —
 * именно на них пользователь и словил нечёткость, несмотря на подтверждённый WebGL2.
 * Плюс — мипмап НИКОГДА не ставился на текстуры ОДЕЖДЫ (shmot) ни в одном файле (4 места:
 * home.js, shmot_shop.js, player_profile.js, hata.js) и на "элементы персонажа" — кисти рук,
 * предплечье, фаланги пальцев (5 файлов × до 4 спрайтов) — та же проблема, тот же класс
 * исходников (крупные PSD-слои под сильным сжатием). По прямому указанию — "наложи на все
 * шмотки и на самого персонажа и элементы для него мипмап" — закрыто полностью, все вызывающие
 * места найдены через grep по имени файла текстуры, не по памяти о "трёх местах".
 *
 * Фикс — baseTexture.mipmap = PIXI.MIPMAP_MODES.ON + baseTexture.update() на ВСЕХ местах
 * создания текстуры персонажа/одежды/элементов. Безопасно для WebGL1 (NPOT-мипмапы там не
 * поддерживаются спецификацией в принципе, PixiJS сам это учитывает перед вызовом
 * gl.generateMipmap() — no-op без ошибок), выигрыш — на WebGL2.
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

const CHAR_FILES = [
    path.join(root, '_client', 'src', 'game', 'home.js'),
    path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'),
    path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'),
    path.join(root, '_client', 'src', 'game', 'base.js'),
    path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'),
];

console.log('\nTest 1: ВСЕ пять экранов с "персонаж который сидит.png" форсируют mipmap ON и зовут update()');
{
    CHAR_FILES.forEach(file => {
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

console.log('\nTest 2: одежда (shmot) тоже форсирует mipmap ON — манекен на 4 экранах + каталог магазина шмоток');
{
    const CLOTH_SITES = [
        { file: path.join(root, '_client', 'src', 'game', 'home.js'), marker: "spr.texture = PIXI.Texture.from('./images/shmot/' + eq.imgFile);", varExpr: 'spr\\.texture' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), marker: "spr.texture = PIXI.Texture.from('./images/shmot/' + eq.imgFile);", varExpr: 'spr\\.texture' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), marker: "spr.texture = PIXI.Texture.from('./images/shmot/' + eq.imgFile);", varExpr: 'spr\\.texture' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), marker: "spr.texture = PIXI.Texture.from('./images/shmot/' + def.imgFile);", varExpr: 'spr\\.texture' },
        // Каталог магазина (сетка карточек) — отдельная переменная imgTex, не манекен.
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), marker: "const imgTex = PIXI.Texture.from(imgUrl);", varExpr: 'imgTex' },
    ];
    CLOTH_SITES.forEach(({ file, marker, varExpr }) => {
        const content = fs.readFileSync(file, 'utf-8');
        const relName = path.relative(root, file);
        const idx = content.indexOf(marker);
        assert(idx > -1, `${relName}: "${marker.slice(0, 40)}..." найден`);
        if (idx > -1) {
            const window_ = content.slice(idx, idx + 700);
            const mipRe = new RegExp(varExpr + '\\.baseTexture\\.mipmap\\s*=\\s*PIXI\\.MIPMAP_MODES\\.ON');
            const updRe = new RegExp(varExpr + '\\.baseTexture\\.update\\(\\)');
            assert(mipRe.test(window_), `${relName}: mipmap = PIXI.MIPMAP_MODES.ON стоит сразу после "${marker.slice(0, 30)}..."`);
            assert(updRe.test(window_), `${relName}: baseTexture.update() вызван`);
        }
    });
}

console.log('\nTest 3: "элементы персонажа" (кисти/предплечье/фаланги) тоже форсируют mipmap ON');
{
    // 21.10.2026 (по прямому указанию — "предплечье всегда одно, кисть меняется"): система
    // правой руки разделена на предплечье (статичный "предплечье правое.png") + кисть
    // (переключается "кисть расслабленная.png"/"кисть хват.png", выбор — тернарник, поэтому
    // свой marker вместо дефолтного на всех 4 экранах, не только player_profile.js, как было
    // раньше). См. ПЕРЕИМЕНОВАНИЕ_АССЕТОВ_21_10_2026.md и oct21-new-shmot-sets-and-forearm-
    // hand-split.test.js (источник истины для самой логики переключения).
    const ELEMENT_SITES = [
        { file: path.join(root, '_client', 'src', 'game', 'base.js'), varName: 'this\\._leftForearmSpr', textureFile: 'левое предплечье.png' },
        { file: path.join(root, '_client', 'src', 'game', 'home.js'), varName: 'this\\._rightHandSpr', textureFile: 'кисть расслабленная.png' },
        { file: path.join(root, '_client', 'src', 'game', 'home.js'), varName: 'this\\._leftForearmSpr', textureFile: 'левое предплечье.png' },
        { file: path.join(root, '_client', 'src', 'game', 'home.js'), varName: 'this\\._rightForearmSpr', textureFile: 'предплечье правое.png' },
        { file: path.join(root, '_client', 'src', 'game', 'home.js'), varName: 'this\\._leftHandSpr', textureFile: 'левая рука.png' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), varName: 'rightHandSpr', textureFile: 'кисть расслабленная.png' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), varName: 'leftForearmSpr', textureFile: 'левое предплечье.png' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), varName: 'rightForearmSpr', textureFile: 'предплечье правое.png' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'hata.js'), varName: 'leftHandSpr', textureFile: 'левая рука.png' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), varName: 'rightHandSpr', textureFile: 'кисть расслабленная.png' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), varName: 'leftForearmSpr', textureFile: 'левое предплечье.png' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), varName: 'rightForearmSpr', textureFile: 'предплечье правое.png' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'shmot_shop.js'), varName: 'leftHandSpr', textureFile: 'левая рука.png' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), varName: 'leftForearmSpr', textureFile: 'левое предплечье.png' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), varName: 'handSpr', textureFile: 'кисть хват.png',
          marker: "const handSpr = new PIXI.Sprite(PIXI.Texture.from(" },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), varName: 'forearmSpr', textureFile: 'предплечье правое.png' },
        { file: path.join(root, '_client', 'src', 'game', 'shell', 'overlays', 'player_profile.js'), varName: 'leftHandSpr', textureFile: 'левая рука.png' },
    ];
    ELEMENT_SITES.forEach(({ file, varName, textureFile, marker: customMarker }) => {
        const content = fs.readFileSync(file, 'utf-8');
        const relName = path.relative(root, file);
        const marker = customMarker || `new PIXI.Sprite(PIXI.Texture.from('./images/${textureFile}'))`;
        const idx = content.indexOf(marker);
        assert(idx > -1, `${relName}: спрайт "${textureFile}" создаётся`);
        if (idx > -1) {
            const window_ = content.slice(idx, idx + 450);
            const mipRe = new RegExp(varName + '\\.texture\\.baseTexture\\.mipmap\\s*=\\s*PIXI\\.MIPMAP_MODES\\.ON');
            const updRe = new RegExp(varName + '\\.texture\\.baseTexture\\.update\\(\\)');
            assert(mipRe.test(window_), `${relName}: ${varName.replace(/\\\\/g,'')} (${textureFile}) — mipmap ON`);
            assert(updRe.test(window_), `${relName}: ${varName.replace(/\\\\/g,'')} (${textureFile}) — baseTexture.update() вызван`);
        }
    });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
