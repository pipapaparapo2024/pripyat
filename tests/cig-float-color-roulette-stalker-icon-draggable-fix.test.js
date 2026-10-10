/**
 * Test: батч 22.09.2026 (по прямому указанию) —
 *
 * 1) dvor.js._showFloatingCig — шрифт "+30" сделан белым (было жёлтое #ffdd44), иконка сигарет
 *    сдвинута влево на 8px (было вплотную к тексту).
 * 2) dvor-roulette-screen.js — плейсхолдер фото победителя (_roulWinnerPhotoSpr) получил флаг
 *    _uDraggable (в fallback-случае это PIXI.Graphics — универсальный редактор позиций по
 *    умолчанию хит-тестит только Sprite/Text, без флага Graphics физически не находится).
 * 3) dvor-roulette-screen.js — новый файл "рулетка иконка сталкера.png" добавлен по
 *    координатам из PSD (X=740, Y=265).
 *
 * Run: node tests/cig-float-color-roulette-stalker-icon-draggable-fix.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const dvorSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor.js'), 'utf-8');
const roulSrc    = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'dvor', 'dvor-roulette-screen.js'), 'utf-8');

console.log('\nTest 1: _showFloatingCig — шрифт белый, иконка сдвинута влево на 8px');
{
    const start = dvorSrc.indexOf('_showFloatingCig(x, y){');
    const end   = dvorSrc.indexOf('\n    }', start);
    const body  = dvorSrc.slice(start, end);
    assert(/fill: '#ffffff'/.test(body), "цвет текста '+30' — белый #ffffff (было жёлтое #ffdd44)");
    assert(/icon\.x = txt\.width - 8;/.test(body), 'иконка сигарет сдвинута влево на 8px относительно текста (было icon.x = txt.width)');
}

console.log('\nTest 2: плейсхолдер фото победителя рулетки помечен _uDraggable (иначе редактор его не находит)');
{
    const start = roulSrc.indexOf('const winnerPhotoSpr = ');
    const end   = roulSrc.indexOf('this._roulWinnerPhotoSpr = winnerPhotoSpr;', start);
    const body  = roulSrc.slice(start, end);
    assert(/winnerPhotoSpr\._uDraggable = true;/.test(body),
        '_uDraggable=true выставлен явно (fallback-объект — PIXI.Graphics, не хит-тестится редактором по умолчанию)');
}

console.log('\nTest 3: 03.10.2026 — заглушка-иконка сталкера убрана, спрайт стартует пустым/невидимым; 10.10.2026 — позиция обновлена редактором позиций');
{
    assert(/const winnerPhotoSpr = new PIXI\.Sprite\(PIXI\.Texture\.EMPTY\);/.test(roulSrc),
        'спрайт больше НЕ создаётся из файла "рулетка иконка сталкера.png" — стартует с Texture.EMPTY');
    // 10.10.2026 (по прямому указанию, редактор позиций): было (739,279) → стало (741,265).
    assert(/winnerPhotoSpr\.x = 741; winnerPhotoSpr\.y = 265;/.test(roulSrc), 'позиция обновлена на (741,265) (10.10.2026)');
    assert(/winnerPhotoSpr\.visible = false;/.test(roulSrc), 'по умолчанию невидим — показывается только при резолве реального фото');
    assert(!roulSrc.includes('рулетка иконка сталкера.png'), 'файл "рулетка иконка сталкера.png" больше нигде не используется');
    assert(/win\.addChild\(winnerPhotoSpr\);/.test(roulSrc), 'спрайт по-прежнему добавлен в сцену (станет видимым при резолве)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
