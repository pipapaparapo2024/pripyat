/**
 * Test: батч 28.10.2026 (по прямому указанию) — три несвязанных правки:
 *
 * 1) achievements.js — репорт "собрал пару десяток И пару валетов в блэкджеке (crd_tt/crd_jj),
 *    одно из достижений не засчиталось". Найдено: _checkAll() комментарием заявлял "не пишет
 *    earned сам, спрашивает сервер", но КОД делал ровно противоположное — `this.earned[a.id] =
 *    true` выставлялось СРАЗУ, до любого ответа сервера. Если _syncWithServer() не долетала
 *    (ошибка сети achievements.sync) ИЛИ была молча отброшена guard'ом `_syncInFlight` (второй
 *    _checkAll() пришёл, пока первый ещё в полёте — типичная гонка при быстрой игре в Двор),
 *    достижение навсегда застревало "заработанным" ЛОКАЛЬНО, хотя сервер его не засчитал, и ни
 *    один будущий _checkAll() больше не пытался пересинхронизировать (условие
 *    `!this.earned[a.id]` уже ложно) — до перезагрузки страницы целиком. Реальное исполнение
 *    кода через vm (не просто regex) — проверяет, что гонка больше не портит состояние и
 *    достижение реально перепроверяется и засчитывается следующим триггером.
 *
 * 2) interface-currency-purchase.js — "в попапе покупки ресурсов опусти кол-во голосов, которое
 *    нужно для покупки, вниз на 2px" — priceTxt.y: slot.y+170 → slot.y+172.
 *
 * 3) habar.js — "верни кол-во собранных хабаров N/30 как раньше было (убрано 20.10.2026), сдвинь
 *    время влево на 20px, умести время и количество в одну строку" — TIMER_OFFSET_X: 68 → 48,
 *    timer.text снова включает "N/30" (дописан через пробел в ТУ ЖЕ строку, не отдельным
 *    PIXI.Text, как было раньше — см. habar-timer-position-and-days-counter.test.js).
 *
 * 4) dvor.js — "верни картинки 2048 на прод, но сделай некликабельными" — картинки ("ящик"/
 *    "нажать на игру") теперь ВСЕГДА добавляются в сцену (тест и прод одинаково, явные w/h из
 *    редактора позиций вместо scale), интерактивность "нажать на игру" по-прежнему скрыта на
 *    pripyat-game.ru флагом hide_unreleased_features (детальнее — см.
 *    hide-unreleased-features-on-prod-28-10.test.js, здесь только явные w/h).
 *
 * Run: node tests/batch-28-10-achievements-sync-race-and-currency-price-and-habar-counter.test.js
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

let passed = 0, failed = 0;
function assert(cond, msg) {
    if (cond) { console.log('  ✅', msg); passed++; }
    else       { console.error('  ❌ FAIL:', msg); failed++; }
}

const root = path.join(__dirname, '..');
function readSrc(rel){ return fs.readFileSync(path.join(root, rel), 'utf-8'); }

const achSrc = readSrc('_client/src/game/achievements.js');

console.log('\nTest 1: _checkAll() больше НЕ выставляет this.earned[a.id]=true сама (регресс-гвард по тексту)');
{
    const start = achSrc.indexOf('_checkAll(){');
    assert(start !== -1, '_checkAll() найден в achievements.js');
    let depth = 0, i = start + '_checkAll(){'.length - 1, end = -1;
    for(; i < achSrc.length; i++){
        if(achSrc[i] === '{') depth++;
        else if(achSrc[i] === '}'){ depth--; if(depth === 0){ end = i + 1; break; } }
    }
    const body = achSrc.slice(start, end);
    assert(!/this\.earned\[a\.id\]\s*=\s*true/.test(body),
        '_checkAll() не пишет earned напрямую — earned обновляется ТОЛЬКО из _loadFromUdata() после подтверждения сервера');
    assert(/this\._syncWithServer\(\)/.test(body), 'по-прежнему просит синхронизацию при найденном новом условии');
}

console.log('\nTest 2: реальное исполнение (vm) — гонка guard\'а _syncInFlight больше не "съедает" достижение навсегда');
{
    // Собираем исполняемый модуль из реального исходника: убираем ES-import (их нет смысла
    // тащить в vm — зависимости заменяются контролируемыми моками ниже), export default → class,
    // экспортируем класс через module.exports.
    let src = achSrc.replace(/^import .*$\n?/gm, '');
    src = src.replace('export default class Achievements', 'class Achievements');
    src += '\nmodule.exports = Achievements;\n';

    const sandboxUdata = { total_damage: '0' };
    let flushCalls = 0;
    let pendingFlushCb = null; // onDone колбэк "зависшего" flushPlayerSave, чтобы разрешить вручную
    let flushBehavior = 'defer'; // 'defer' — не зовёт onDone сразу (имитирует сетевую задержку), 'immediate' — зовёт сразу

    function flushPlayerSave(reason, onDone){
        flushCalls++;
        if(flushBehavior === 'defer'){ pendingFlushCb = onDone; return false; }
        if(typeof onDone === 'function') onDone();
        return true;
    }

    function applyPatch(patch){ Object.assign(sandboxUdata, patch); }
    function collapseNewlyEarnedForPopup(arr){ return arr; }
    function attachAchievementPopup(proto){ proto._openAchievementPopup = function(){ this._popupsShown = (this._popupsShown || 0) + 1; }; }

    let syncCalls = 0;
    let syncShouldFail = false;
    const TS = {
        php(method, params, onOk, onErr){
            if(method !== 'achievements.sync') return;
            syncCalls++;
            if(syncShouldFail){ onErr({error:'network'}); return; }
            // Сервер — единственный источник правды: реально пересчитывает ПОЛНЫЙ каталог
            // (здесь — упрощённо, одно достижение 'dmg_1k') по текущему состоянию sandboxUdata.
            const alreadyEarned = helperStub.safeParseJSON(sandboxUdata['achievements'], {});
            const newlyEarned = [];
            if(parseInt(sandboxUdata['total_damage'] || 0) >= 1000 && !alreadyEarned['dmg_1k']){
                alreadyEarned['dmg_1k'] = true;
                newlyEarned.push({id:'dmg_1k'});
            }
            onOk({ patch: { achievements: JSON.stringify(alreadyEarned) }, newly_earned: newlyEarned });
        }
    };
    const helperStub = {
        safeParseJSON(value, fallback){
            if(value == null) return fallback;
            if(typeof value === 'object') return value;
            try{ return JSON.parse(value); } catch(e){ return fallback; }
        }
    };

    const sandbox = {
        console,
        window: { TS },
        TS,
        helper: helperStub,
        udata: sandboxUdata,
        flushPlayerSave,
        applyPatch,
        collapseNewlyEarnedForPopup,
        attachAchievementPopup,
        module: { exports: {} },
    };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    const Achievements = sandbox.module.exports;

    const inst = new Achievements();

    // Шаг 1: достигаем условия dmg_1k, запускаем первый _checkAll() — флуш "зависает" (имитация
    // сетевой задержки), _syncInFlight остаётся true.
    sandboxUdata.total_damage = '1000';
    inst._checkAll();
    assert(flushCalls === 1, 'первый _checkAll() запустил flushPlayerSave (попытка синхронизации)');
    assert(inst.earned['dmg_1k'] !== true,
        'ДО ответа сервера this.earned.dmg_1k ещё НЕ true (старый баг выставлял true прямо здесь)');

    // Шаг 2: второй _checkAll() приходит, пока первый ещё "в полёте" (_syncInFlight guard).
    inst._checkAll();
    assert(inst.earned['dmg_1k'] !== true,
        'повторный _checkAll() во время гонки тоже не портит earned — условие остаётся неподтверждённым, а не "забытым"');

    // Шаг 3: первая попытка синхронизации ЗАВЕРШАЕТСЯ ОШИБКОЙ СЕТИ (achievements.sync упал).
    syncShouldFail = true;
    flushBehavior = 'immediate';
    const resolveFirst = pendingFlushCb;
    pendingFlushCb = null;
    resolveFirst();
    assert(syncCalls === 1, 'achievements.sync был реально вызван один раз (и упал с ошибкой)');
    assert(inst.earned['dmg_1k'] !== true,
        'после СЕТЕВОЙ ОШИБКИ достижение по-прежнему НЕ помечено заработанным локально (старый баг тут уже был бы навечно сломан)');

    // Шаг 4: следующий триггер (ЛЮБОЕ другое игровое действие) — должен РЕТРАИТЬ сам, без
    // перезагрузки страницы, и на этот раз сервер успешно подтверждает.
    syncShouldFail = false;
    inst._checkAll();
    assert(syncCalls === 2, 'следующий _checkAll() САМ повторил попытку синхронизации (не ждёт перезагрузки страницы)');
    assert(inst.earned['dmg_1k'] === true, 'после успешного ответа сервера достижение корректно засчитано локально');
    assert(inst._popupsShown === 1, 'попап достижения показан РОВНО один раз, когда сервер реально подтвердил');

    // Шаг 5: ещё один _checkAll() не должен повторно слать sync — условие уже known-earned.
    inst._checkAll();
    assert(syncCalls === 2, 'уже подтверждённое достижение не вызывает повторных sync-запросов');
}

console.log('\nTest 3: interface-currency-purchase.js — priceTxt (цена в голосах) сдвинут вниз на 2px');
{
    const src = readSrc('_client/src/game/interface/interface-currency-purchase.js');
    assert(/priceTxt\.x = slot\.x \+ SLOT_W \/ 2; priceTxt\.y = slot\.y \+ 172;/.test(src),
        'priceTxt.y = slot.y + 172 (было +170, сдвинуто вниз на 2px)');
    assert(!/priceTxt\.y = slot\.y \+ 170;/.test(src), 'старое значение +170 не осталось рядом');
}

console.log('\nTest 4: habar.js — таймер сдвинут влево на 20px, счётчик N/30 снова в той же строке');
{
    const src = readSrc('_client/src/game/habar.js');
    // 28.10.2026 (повторная правка тем же днём, 4 индивидуальных значения x вместо единой формулы,
    // затем исправлено ещё раз тем же днём — x/y используются напрямую, без +w/2,+h/2):
    // Обычный x:279,y:508; Пацанский x:524; Авторитетный x:769; Элитный x:1014.
    assert(/const TIMER_X = \[279, 524, 769, 1014\];/.test(src), 'TIMER_X — 4 индивидуальных значения (строка времени+счётчика)');
    assert(/const collected = parseInt\(udata\['habar_days_collected'\] \|\| 0\);/.test(src), 'habar_days_collected читается снова');
    assert(/const countSuffix = '  ' \+ Math\.min\(collected, 30\) \+ '\/30';/.test(src), 'countSuffix формирует "N/30"');
    assert(/timer\.text = 'ХАБАР ИСТЁК' \+ countSuffix;/.test(src), 'счётчик показывается и в состоянии "ХАБАР ИСТЁК"');
    assert(/timer\.text = hh \+ ':' \+ mm \+ ':' \+ ss \+ countSuffix;/.test(src), 'счётчик дописан в ТУ ЖЕ строку, что и обратный отсчёт (не отдельный текст)');
    assert(!/const daysTxt = /.test(src), 'daysTxt как отдельный PIXI.Text не создаётся — одна строка, один объект');
}

console.log('\nTest 4b: svod-zanachki.js — заголовок/счётчик заначек, новые координаты 28.10.2026 (повторный замер)');
{
    const src = readSrc('_client/src/game/svod/svod-zanachki.js');
    // 28.10.2026 (БАГ, исправлено тем же днём после живой проверки — "расположение собрано
    // коллекций не по тем координатам"): x/y из редактора для anchor(0.5,0) — уже готовые
    // object.x/object.y, без +W/2 (первая версия ошибочно его прибавляла, унеся текст на полсотни
    // пикселей вправо). Хитбокс-константы (LABEL_HITBOX_X/W, COUNT_HITBOX_X/W) убраны целиком —
    // x/y присваиваются напрямую.
    assert(/labelTxt\.anchor\.set\(0\.5, 0\);/.test(src), 'заголовок центрирован по горизонтали (anchor.x=0.5)');
    assert(/fontSize: 16, fill: '#ffffff', fontWeight: 'bold',/.test(src), 'заголовок fontSize:16, fontWeight:bold (было 18, без веса)');
    assert(/labelTxt\.x = 1049; labelTxt\.y = 116;/.test(src), 'заголовок напрямую на x:1049 y:116, без хитбокс-математики');
    assert(/fontSize: 36, fill: '#ffffff', fontWeight: 'bold',/.test(src), 'счётчик fontSize:36, fontWeight:bold (было 28, без веса)');
    assert(/countTxt\.x = 1047; countTxt\.y = 135;/.test(src), 'счётчик N/15 напрямую на x:1047 y:135, без хитбокс-математики');
    assert(!/LABEL_HITBOX_X/.test(src) && !/COUNT_HITBOX_X/.test(src), 'хитбокс-константы убраны — x/y больше не требуют +W/2');
}

console.log('\nTest 5: dvor.js — картинки 2048 получили явные w/h из редактора позиций (конвенция UI-правок)');
{
    const src = readSrc('_client/src/game/dvor.js');
    assert(/spr\.x = 913; spr\.y = 377; spr\.width = 254; spr\.height = 157;/.test(src),
        '"ящик" — w:254 h:157 при x:913 y:377 (scale:1.000)');
    assert(/spr\.x = 999; spr\.y = 284; spr\.width = 121; spr\.height = 105;/.test(src),
        '"нажать на игру" — w:121 h:105 при x:999 y:284 (scale:1.000)');
}

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) console.log(`✅ All ${passed} tests passed`);
else              { console.log(`❌ ${failed} FAILED, ${passed} passed`); process.exit(1); }
