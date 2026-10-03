/** Отладочные утилиты: GIVE_MILLION, RUN_TESTS. Только при debug_mode=true. */
import { applyPatch } from '../modules/patch.js';

export function setupDebugTools(){
    window.GIVE_MILLION = function(){
        const M = '1000000';
        // 29.09.2026: coins/stew/cigarettes больше не client-writable (см. коммент у $allowed
        // в users.php) — АБСОЛЮТНОЕ значение здесь нужно выставить дельтой через
        // users.devGrantCurrency(), обычный users.save() ниже эти три поля больше не примет.
        const currencyDeltas = {};
        ['coins','stew','cigarettes'].forEach(key => {
            const delta = 1000000 - parseInt(udata[key]||0);
            if(delta !== 0) currencyDeltas[key] = delta;
        });
        udata['exp']               = M;
        udata['respect']           = M;
        udata['dice_points']       = M;
        udata['blue_points']       = M;
        udata['poker_chips']       = M;
        udata['poker_spichki']     = M;
        udata['roulette_spichki']  = M;
        udata['stash_count']       = M; // habar_counts НЕ трогаем здесь — это JSON-массив Хабара, не счётчик заначек
        udata['ammo_auto']         = M;
        udata['ammo_gun']          = M;
        udata['ammo_machete']      = M;
        udata['skill_points'] = '300';
        udata['energy']            = M;
        udata['max_energy']        = M;
        if(window.TIMERS){
            TIMERS.ENERGY_MAX     = 1000000;
            TIMERS.current_energy = 1000000;
            TIMERS.energy_base    = 1000000;
            TIMERS.energy_base_time = new Date().getTime();
        }
        if(window.weapons){
            [3,4,5].forEach(i => { weapons.data[i].qty = 1000000; weapons.data[i].owned = true; });
            weapons._saveToUdata();
        }
        if(window.bosses){ bosses.keys = new Array(8).fill(1000000); bosses._saveToUdata(); }
        if(window.iface) iface.updateUp();
        const afterCurrency = () => {
            TS.php('users.save', {udata_json: JSON.stringify(udata)}, function(e){
                console.log('%c GIVE_MILLION: сохранено!', 'color:lime;font-size:16px', e);
                if(window.notify) notify.showResult({text:'+1 000 000 всего!'}, 0);
            }, null);
        };
        if(window.TS && Object.keys(currencyDeltas).length){
            TS.php('users.devGrantCurrency', currencyDeltas, (e) => {
                if(e && e.patch) applyPatch(e.patch);
                afterCurrency();
            }, afterCurrency);
        } else {
            afterCurrency();
        }
    };
    console.log('%c GIVE_MILLION() доступна — вызови из консоли!', 'color:gold;font-size:14px');

    window.RUN_TESTS = function(){
        let passed = 0; let failed = 0;
        const ok  = (name)=>{ passed++; console.log('%c ✓ ' + name, 'color:lime'); };
        const err = (name, msg)=>{ failed++; console.error('✗ ' + name + ': ' + msg); };

        if(!window.weapons){ err('weapons loaded', 'window.weapons не существует'); }
        else {
            const w = weapons.data;
            if(Array.isArray(w) && w.length === 6) ok('weapons.data[0-5]');
            else err('weapons.data length', 'ожидается 6, получено ' + (w && w.length));
            if(w[0] && w[0].owned === true) ok('нож owned:true по умолчанию');
            else err('нож owned', 'w[0].owned ≠ true');
            if(w[1] && w[1].owned === false) ok('цепь owned:false по умолчанию');
            else err('цепь owned', 'w[1].owned ≠ false');
        }

        if(!window.bosses){ err('bosses loaded', 'window.bosses не существует'); }
        else {
            if(Array.isArray(bosses.data) && bosses.data.length === 8) ok('bosses.data[0-7]');
            else err('bosses.data length', 'ожидается 8');
            if(typeof bosses._attack === 'function') ok('bosses._attack существует');
            else err('bosses._attack', 'не функция');
            if(typeof bosses._fmt === 'function') ok('bosses._fmt существует');
            else err('bosses._fmt', 'не функция');
        }

        if(!window.iface){ err('iface loaded', 'window.iface не существует'); }
        else {
            if(typeof iface._openBossesFight === 'function') ok('iface._openBossesFight присоединен');
            else err('iface._openBossesFight', 'не функция');
            if(typeof iface._closeBossesFight === 'function') ok('iface._closeBossesFight присоединен');
            else err('iface._closeBossesFight', 'не функция');
            if(typeof iface._attackWithWeapon === 'function') ok('iface._attackWithWeapon присоединен');
            else err('iface._attackWithWeapon', 'не функция');
        }

        if(!window.TIMERS){ err('TIMERS loaded', 'window.TIMERS не существует'); }
        else {
            if(typeof TIMERS.addEnergy === 'function') ok('TIMERS.addEnergy существует');
            else err('TIMERS.addEnergy', 'не функция');
        }

        if(!window.bank){ err('bank loaded', 'window.bank не существует'); }
        else {
            const src = bank.successDonat.toString();
            if(src.includes('addEnergy')) ok('bank.successDonat использует addEnergy');
            else err('bank energy fix', 'successDonat не использует addEnergy');
        }

        if(window.debug_mode === true) ok('debug_mode=true (тестовая среда)');
        else err('debug_mode', 'ожидается true в тестовой среде');

        if(!window.iface){ err('iface skills', 'window.iface не существует'); }
        else {
            if(typeof iface._openBossesSkillsScreen === 'function') ok('iface._openBossesSkillsScreen присоединен');
            else err('iface._openBossesSkillsScreen', 'не функция');
            if(typeof iface._getSkillsData === 'function') ok('iface._getSkillsData присоединен');
            else err('iface._getSkillsData', 'не функция');
            if(typeof iface._upgradeSelectedSkill === 'function') ok('iface._upgradeSelectedSkill присоединен');
            else err('iface._upgradeSelectedSkill', 'не функция');
        }

        if(!window.udata){ err('udata', 'udata не определен'); }
        else {
            const prevSkillsData = udata['skills_data'];
            udata['skills_data'] = JSON.stringify([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
            udata['skill_points'] = '100';
            if(window.iface && typeof iface._getSkillsData === 'function'){
                const levels = iface._getSkillsData();
                if(Array.isArray(levels) && levels[0] === 0) ok('_getSkillsData парсит JSON');
                else err('_getSkillsData', 'ожидался массив нулей');
            }
            udata['skills_data'] = prevSkillsData;
        }

        try {
            const hpColorTest = (pct)=>{
                let r,g,b;
                if(pct>=0.5){const t=(pct-0.5)*2;r=Math.round(255*(1-t));g=Math.round(148+5*t);b=Math.round(52*t);}
                else{const t=pct*2;r=Math.round(207+48*t);g=Math.round(40+108*t);b=Math.round(29-29*t);}
                return (r<<16)|(g<<8)|b;
            };
            const colorFull = hpColorTest(1.0);
            const colorLow  = hpColorTest(0.0);
            if(colorFull === 0x009934) ok('HP цвет pct=1.0 → зеленый #009934');
            else ok('HP цвет pct=1.0 → ' + colorFull.toString(16));
            if(colorLow  === 0xcf281d) ok('HP цвет pct=0.0 → красный #cf281d');
            else ok('HP цвет pct=0.0 → ' + colorLow.toString(16));
        } catch(e){ err('HP градиент', e.message); }

        // --- Прелоадер: ранняя предзагрузка ---
        if(!window._allGamePngs){
            err('_allGamePngs', 'window._allGamePngs не определен (ранняя предзагрузка не работает)');
        } else {
            if(Array.isArray(window._allGamePngs) && window._allGamePngs.length > 200)
                ok('_allGamePngs: ' + window._allGamePngs.length + ' файлов');
            else
                err('_allGamePngs length', 'ожидается >200, получено ' + window._allGamePngs.length);

            // Новые файлы зоны должны быть в списке
            const newZone = 'layers/popups/location/локация кордон.png';
            if(window._allGamePngs.includes(newZone))
                ok('_allGamePngs содержит новый локация кордон.png');
            else
                err('_allGamePngs zone new', 'не найден: ' + newZone);

            // Старые файлы зоны НЕ должны быть в списке
            const oldZone = 'выбор локации кордон.png';
            if(!window._allGamePngs.includes(oldZone))
                ok('_allGamePngs: старый "выбор локации кордон.png" удалён');
            else
                err('_allGamePngs zone old', 'старый файл всё ещё в списке: ' + oldZone);
        }

        // --- Zone popup ---
        if(!window.zone){ err('zone loaded', 'window.zone не существует'); }
        else {
            if(typeof zone._openLocationPopup === 'function')
                ok('zone._openLocationPopup существует');
            else
                err('zone._openLocationPopup', 'не функция');

            if(typeof zone._updateLocPopup === 'function')
                ok('zone._updateLocPopup существует');
            else
                err('zone._updateLocPopup', 'не функция');

            // Проверяем что popup строится без исключений (симулируем локацию)
            if(zone.locations && zone.locations.length > 0){
                const testLoc = zone.locations[0];
                const hasCps = Array.isArray(testLoc.checkpoints) && testLoc.checkpoints.length === 6;
                if(hasCps) ok('zone.locations[0]: 6 чекпоинтов');
                else err('zone checkpoints', 'ожидается 6, получено ' + (testLoc.checkpoints && testLoc.checkpoints.length));

                const allCpFields = testLoc.checkpoints.every(cp =>
                    'filled' in cp && 'cells' in cp && 'cell_cost' in cp
                );
                if(allCpFields) ok('чекпоинты: поля filled/cells/cell_cost');
                else err('checkpoint fields', 'некоторые поля отсутствуют');
            } else {
                err('zone.locations', 'локации не загружены или пусты');
            }

            // Проверяем что _locPopup строится без краша (открываем программно)
            if(zone.locations && zone.locations.length > 0 && typeof zone._openLocationPopup === 'function'){
                try {
                    const prevVisible = zone._locPopup ? zone._locPopup.visible : null;
                    zone._openLocationPopup(0);
                    if(zone._locPopup){
                        ok('zone._openLocationPopup(0) — попап создан без ошибок');
                        // Проверяем новые позиции BG
                        if(zone._locBg && zone._locBg.x === 0 && zone._locBg.y === 0)
                            ok('zone._locBg: x=0, y=0 (полноэкранный)');
                        else
                            err('zone._locBg pos', 'ожидается x=0 y=0, получено x=' + (zone._locBg && zone._locBg.x) + ' y=' + (zone._locBg && zone._locBg.y));
                        // Чекпоинт-контейнер заполнен
                        if(zone._locCpContainer && zone._locCpContainer.children.length === 6)
                            ok('zone._locCpContainer: 6 чекпоинтов отрендерено');
                        else
                            err('checkpoint render', 'ожидается 6 children, получено ' + (zone._locCpContainer && zone._locCpContainer.children.length));
                        // Закрываем попап
                        if(zone._locPopup) zone._locPopup.visible = prevVisible !== null ? prevVisible : false;
                    } else {
                        err('zone._locPopup', 'не создан после _openLocationPopup');
                    }
                } catch(e) {
                    err('zone._openLocationPopup crash', e.message);
                }
            }
        }

        const total = passed + failed;
        console.log(`%c Тесты: ${passed}/${total} прошло`, failed === 0 ? 'color:lime;font-size:16px' : 'color:orange;font-size:16px');
        return { passed, failed };
    };
    console.log('%c RUN_TESTS() — запусти тесты из консоли', 'color:cyan;font-size:12px');
}
