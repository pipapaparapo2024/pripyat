/**
 * Test: 04.10.2026 (репорт — "кнопка слиться не работает" + "обучение запускается по несколько
 * раз у части игроков").
 *
 * Корень: Onboarding.prototype._onMerge() (onboarding-popup.js) для состояний 'permission' и
 * "остальные экраны" (intro/currency, второй клик) вызывал this._finish() ТОЛЬКО внутри
 * onComplete-колбэка _playNarration(url, onComplete) — то есть обучение считалось завершённым
 * (udata['onboarding_step']='done'), только если озвучка-реплика реально доиграла до конца.
 *
 * _playNarration() НЕ гарантирует вызов onComplete при сбое:
 *   - PIXI.sound.add(alias, { url, preload:true, loaded:(err)=>{ if(err){ console.error(...);
 *     return; } start(); } }) — ошибка загрузки файла молча обрывает цепочку, onComplete не
 *     вызывается никогда;
 *   - PIXI.sound.play(...) обёрнут в try/catch — исключение при воспроизведении тоже гасится
 *     без вызова onComplete.
 *
 * Если игрок на экране 'permission' (или на intro/currency, нажав «Слиться» дважды) попадал в
 * любой из этих сценариев — клик по кнопке визуально ничего не делал (попап не закрывался,
 * прогресс не сохранялся), а onboarding_step навсегда застревал на недостигнутом шаге. Хуже —
 * если это происходило на САМОМ ПЕРВОМ экране (intro), шаг оставался 'intro' НАВСЕГДА — при
 * каждом следующем входе start() читает step='intro' и показывает обучение с самого начала,
 * что и объясняет "запускается по несколько раз".
 *
 * Единственная ветка, которая работала надёжно — второй клик на состоянии 'final' — потому что
 * там this._finish() вызывается СИНХРОННО по клику, а озвучка после неё уже ничего не
 * блокирует. Фикс копирует этот рабочий паттерн на все 4 ветки _onMerge().
 *
 * Run: node tests/onboarding-merge-finish-not-gated-on-narration.test.js
 */

const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, '_client', 'src', 'game', 'onboarding', 'onboarding-popup.js'), 'utf-8');

const start = src.indexOf('Onboarding.prototype._onMerge = function(){');
const end   = src.indexOf('\n    };', start);
const body  = src.slice(start, end);

console.log('\nTest 1: ни одна ветка _onMerge() больше не гейтит this._finish() через onComplete-колбэк озвучки');
{
    assert(!/mergeDone, \(\) => this\._finish\(\)\)/.test(body),
        'старый паттерн "mergeDone, () => this._finish())" (finish только если звук доиграл) полностью убран');
    assert(!/_playNarration\([^)]*,\s*\(\)\s*=>\s*this\._finish\(\)/.test(body),
        'нигде в _onMerge this._finish не передаётся колбэком в _playNarration');
}

console.log("\nTest 2: ветка 'permission' вызывает finish() синхронно, озвучка — после, независимо");
{
    const permStart = body.indexOf("if(this._popupState === 'permission'){");
    const permEnd   = body.indexOf('\n        }', permStart);
    const permBody  = body.slice(permStart, permEnd);
    assert(/this\._finish\(\);/.test(permBody), 'this._finish() вызывается внутри ветки permission');
    assert(/this\._playNarration\(ONBOARDING_EXTRA_SOUNDS\.mergeDone\);/.test(permBody),
        'озвучка mergeDone всё ещё проигрывается (просто не блокирует завершение)');
    const finishIdx = permBody.indexOf('this._finish();');
    const soundIdx  = permBody.indexOf('this._playNarration(ONBOARDING_EXTRA_SOUNDS.mergeDone);');
    assert(finishIdx !== -1 && soundIdx !== -1 && finishIdx < soundIdx,
        'finish() идёт ДО запуска озвучки (не наоборот) — завершение не зависит от результата воспроизведения');
}

console.log("\nTest 3: второй клик на 'остальных экранах' (intro/currency) тоже вызывает finish() синхронно");
{
    const tailStart = body.lastIndexOf("if(!this._mergeArmed){");
    const tailBody  = body.slice(tailStart);
    assert(/this\._finish\(\);\s*\n\s*this\._playNarration\(ONBOARDING_EXTRA_SOUNDS\.mergeDone\);\s*$/.test(tailBody.trim() + '\n'),
        'хвост функции (после второй проверки _mergeArmed) завершает это(.finish()) синхронно и ПОСЛЕ него играет озвучку');
}

console.log('\nTest 4: состояние final (уже рабочая эталонная ветка) не тронуто регрессией');
{
    const finalStart = body.indexOf("if(this._popupState === 'final'){");
    const finalEnd   = body.indexOf("if(this._popupState === 'permission'){");
    const finalBody  = body.slice(finalStart, finalEnd);
    assert(/this\._finish\(\);\s*\n\s*this\._playNarration\(ONBOARDING_EXTRA_SOUNDS\.mergeDone\);/.test(finalBody),
        'final: finish() по-прежнему идёт раньше озвучки на втором клике (эталонный, изначально рабочий паттерн)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
