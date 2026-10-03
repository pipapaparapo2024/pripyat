import { attachZonePopup } from './zone/zone-popup.js';
import { attachZoneBiz }   from './zone/zone-biz.js';
import { applyPatch } from '../modules/patch.js';
import { flushPlayerSave } from '../modules/player-save.js';

export default class Zone{
    constructor(mc){
        this.mc = mc;
        this.win = mc.zone_win;
        this.currentLoc = 0;

        // ТЗ стр.15-21: 5 локаций, 6 точек, 5 ячеек
        // reward: cig=сигареты, exp=опыт, resp=уважение (все per cell)
        // businesses: массив бизнесов; Рубеж=2, остальные=3 (ТЗ стр.17-21)
        // cleared: счетчик полных зачисток локации (нужен для открытия боссов)
        this.locations = [
            {
                id:0, name:'Кордон', min_level:1, cleared:0,
                checkpoints:[
                    {name:'Точка 1', cell_cost:4,  cells:5, filled:0, reward:{cig:20,  exp:15,  resp:5 }, art:'cp_art_k1.png', task:'Устраиваем новичкам проверку на смелость'},
                    {name:'Точка 2', cell_cost:5,  cells:5, filled:0, reward:{cig:30,  exp:20,  resp:7 }, art:'cp_art_k2.png', task:'Сопровождаем новичка до деревни'},
                    {name:'Точка 3', cell_cost:6,  cells:5, filled:0, reward:{cig:40,  exp:25,  resp:9 }, art:'cp_art_k3.png', task:'Разводим костер и собираем слухи'},
                    {name:'Точка 4', cell_cost:7,  cells:5, filled:0, reward:{cig:50,  exp:30,  resp:11}, art:'cp_art_k4.png', task:'Отбиваем лагерь от слепых псов'},
                    {name:'Точка 5', cell_cost:8,  cells:5, filled:0, reward:{cig:60,  exp:35,  resp:13}, art:'cp_art_k5.png', task:'Ищем тайник погибшего сталкера'},
                    {name:'Точка 6', cell_cost:9,  cells:5, filled:0, reward:{cig:70,  exp:40,  resp:15}, art:'cp_art_k6.png', task:'Тащим контрабанду через блокпост', final:true},
                ],
                businesses:[
                    {name:'Поставка оружий',     level:0, max_level:10, costs:[150,150,150,150,150,150,150,150,150,150], income_exp: [0,15,20,25,30,35,40,45,50,55,60]},
                    {name:'Скупка награбленного', level:0, max_level:10, costs:[200,200,200,200,200,200,200,200,200,200], income_resp:[0,20,25,30,35,40,45,50,55,60,65]},
                    {name:'Плата за проезд',      level:0, max_level:10, costs:[150,150,150,150,150,150,150,150,150,150], income_cig: [0,5,10,15,20,25,30,35,40,45,50]},
                ],
                currentBizIdx:0,
            },
            {
                id:1, name:'Свалка', min_level:5, cleared:0,
                checkpoints:[
                    {name:'Точка 1', cell_cost:8,  cells:5, filled:0, reward:{cig:25,  exp:20,  resp:8 }, art:'cp_art_s1.png', task:'Разбираем старую технику на детали'},
                    {name:'Точка 2', cell_cost:9,  cells:5, filled:0, reward:{cig:35,  exp:25,  resp:10}, art:'cp_art_s2.png', task:'Прячемся от выброса в куче мусора'},
                    {name:'Точка 3', cell_cost:10, cells:5, filled:0, reward:{cig:45,  exp:30,  resp:12}, art:'cp_art_s3.png', task:'Ищем артефакт среди груды металла'},
                    {name:'Точка 4', cell_cost:10, cells:5, filled:0, reward:{cig:55,  exp:35,  resp:14}, art:'cp_art_s4.png', task:'Выбиваем долг у местного барыги'},
                    {name:'Точка 5', cell_cost:11, cells:5, filled:0, reward:{cig:65,  exp:40,  resp:16}, art:'cp_art_s5.png', task:'Устраиваем засаду у перехода'},
                    {name:'Точка 6', cell_cost:13, cells:5, filled:0, reward:{cig:75,  exp:45,  resp:18}, art:'cp_art_s6.png', task:'Отбиваемся от банды мародеров', final:true},
                ],
                businesses:[
                    {name:'Поставка оружий',     level:0, max_level:10, costs:[250,250,250,250,250,250,250,250,250,250], income_exp: [0,15,25,35,45,55,65,75,85,95,105]},
                    {name:'Скупка награбленного', level:0, max_level:10, costs:[250,250,250,250,250,250,250,250,250,250], income_resp:[0,10,20,30,40,50,60,70,80,90,100]},
                    {name:'Плата за проезд',      level:0, max_level:10, costs:[250,250,250,250,250,250,250,250,250,250], income_cig: [0,10,20,30,40,50,60,70,80,90,100]},
                ],
                currentBizIdx:0,
            },
            {
                id:2, name:'Темная Долина', min_level:15, cleared:0,
                checkpoints:[
                    {name:'Точка 1', cell_cost:9,  cells:5, filled:0, reward:{cig:35,  exp:30,  resp:10}, art:'cp_art_d1.png', task:'Уходим от погони через болота'},
                    {name:'Точка 2', cell_cost:10, cells:5, filled:0, reward:{cig:45,  exp:40,  resp:12}, art:'cp_art_d2.png', task:'Выносим ящики с контрабандой'},
                    {name:'Точка 3', cell_cost:11, cells:5, filled:0, reward:{cig:55,  exp:45,  resp:14}, art:'cp_art_d3.png', task:'Штурмуем базу бандитов'},
                    {name:'Точка 4', cell_cost:13, cells:5, filled:0, reward:{cig:65,  exp:45,  resp:16}, art:'cp_art_d4.png', task:'Перехватываем оружейный караван'},
                    {name:'Точка 5', cell_cost:14, cells:5, filled:0, reward:{cig:75,  exp:50,  resp:18}, art:'cp_art_d5.png', task:'Ищем документы в заброшенном цеху'},
                    {name:'Точка 6', cell_cost:15, cells:5, filled:0, reward:{cig:85,  exp:55,  resp:20}, art:'cp_art_d6.png', task:'Проверяем слухи о тайной лаборатории', final:true},
                ],
                businesses:[
                    {name:'Поставка оружий',     level:0, max_level:10, costs:[300,300,300,300,300,300,300,300,300,300], income_exp: [0,25,30,35,40,45,50,55,60,65,70]},
                    {name:'Скупка награбленного', level:0, max_level:10, costs:[300,300,300,300,300,300,300,300,300,300], income_resp:[0,15,25,35,45,55,65,75,85,95,105]},
                    {name:'Плата за проезд',      level:0, max_level:10, costs:[300,300,300,300,300,300,300,300,300,300], income_cig: [0,15,25,35,45,55,65,75,85,95,105]},
                ],
                currentBizIdx:0,
            },
            {
                id:3, name:'Агропром', min_level:25, cleared:0,
                checkpoints:[
                    {name:'Точка 1', cell_cost:11, cells:5, filled:0, reward:{cig:50,  exp:40,  resp:14}, art:'cp_art_a1.png', task:'Проникаем в подземный комплекс'},
                    {name:'Точка 2', cell_cost:14, cells:5, filled:0, reward:{cig:65,  exp:50,  resp:16}, art:'cp_art_a2.png', task:'Ищем пропавшую группу сталкеров'},
                    {name:'Точка 3', cell_cost:16, cells:5, filled:0, reward:{cig:75,  exp:60,  resp:18}, art:'cp_art_a3.png', task:'Воруем припасы со склада военных'},
                    {name:'Точка 4', cell_cost:18, cells:5, filled:0, reward:{cig:85,  exp:70,  resp:20}, art:'cp_art_a4.png', task:'Отстреливаем мутантов у завода'},
                    {name:'Точка 5', cell_cost:20, cells:5, filled:0, reward:{cig:95,  exp:80,  resp:22}, art:'cp_art_a5.png', task:'Зачищаем тоннель от кровососов'},
                    {name:'Точка 6', cell_cost:22, cells:5, filled:0, reward:{cig:105, exp:90,  resp:24}, art:'cp_art_a6.png', task:'Добываем секретные документы', final:true},
                ],
                businesses:[
                    {name:'Поставка оружий',     level:0, max_level:10, costs:[400,400,400,400,400,400,400,400,400,400], income_exp: [0,70,80,90,100,110,120,130,140,150,160]},
                    {name:'Скупка награбленного', level:0, max_level:10, costs:[400,400,400,400,400,400,400,400,400,400], income_resp:[0,50,60,70,80,90,100,110,120,130,140]},
                    {name:'Плата за проезд',      level:0, max_level:10, costs:[400,400,400,400,400,400,400,400,400,400], income_cig: [0,30,40,50,60,70,80,90,100,110,120]},
                ],
                currentBizIdx:0,
            },
            {
                id:4, name:'Янтарь', min_level:40, cleared:0,
                checkpoints:[
                    {name:'Точка 1', cell_cost:19, cells:5, filled:0, reward:{cig:70,  exp:60,  resp:18}, art:'cp_art_y1.png', task:'Несем ученым редкий артефакт'},
                    {name:'Точка 2', cell_cost:21, cells:5, filled:0, reward:{cig:80,  exp:70,  resp:20}, art:'cp_art_y2.png', task:'Отбиваем волну зомбированных'},
                    {name:'Точка 3', cell_cost:23, cells:5, filled:0, reward:{cig:90,  exp:80,  resp:22}, art:'cp_art_y3.png', task:'Проверяем сигнал SOS у бункера'},
                    {name:'Точка 4', cell_cost:25, cells:5, filled:0, reward:{cig:100, exp:90,  resp:24}, art:'cp_art_y4.png', task:'Прорываемся через пси-излучение'},
                    {name:'Точка 5', cell_cost:28, cells:5, filled:0, reward:{cig:110, exp:100, resp:26}, art:'cp_art_y5.png', task:'Собираем образцы аномальной слизи'},
                    {name:'Точка 6', cell_cost:30, cells:5, filled:0, reward:{cig:120, exp:110, resp:28}, art:'cp_art_y6.png', task:'Ищем сталкера, пропавшего у озера', final:true},
                ],
                businesses:[
                    {name:'Поставка оружий',     level:0, max_level:10, costs:[500,500,500,500,500,500,500,500,500,500], income_exp: [0,100,120,140,160,180,200,220,240,260,280]},
                    {name:'Скупка награбленного', level:0, max_level:10, costs:[500,500,500,500,500,500,500,500,500,500], income_resp:[0,100,110,120,130,140,150,160,170,180,190]},
                    {name:'Плата за проезд',      level:0, max_level:10, costs:[500,500,500,500,500,500,500,500,500,500], income_cig: [0,100,120,140,160,180,200,220,240,260,280]},
                ],
                currentBizIdx:0,
            },
        ];

        // ТЗ: 3 вида заначек на каждой локации, 7 карточек = 1 набор
        this.stashes = [
            // Кордон: +50 сиг +50 опыт
            [{key:'k_lezv', name:'По лезвию',      total:7, reward:{cig:50, exp:50}},
             {key:'k_lyub', name:'Любитель',        total:7, reward:{cig:50, exp:50}},
             {key:'k_avto', name:'Автоматчик',      total:7, reward:{cig:50, exp:50}}],
            // Свалка: +70 сиг +70 опыт
            [{key:'s_yuv',  name:'Ювелир',          total:7, reward:{cig:70, exp:70}},
             {key:'s_sysh', name:'Сыщик',           total:7, reward:{cig:70, exp:70}},
             {key:'s_met',  name:'Металлоискатель', total:7, reward:{cig:70, exp:70}}],
            // Темная Долина: +70 сиг +70 опыт
            [{key:'d_umn',  name:'Умник',           total:7, reward:{cig:70, exp:70}},
             {key:'d_az',   name:'Азартный',        total:7, reward:{cig:70, exp:70}},
             {key:'d_kost', name:'Костолом',        total:7, reward:{cig:70, exp:70}}],
            // Агропром: +70 сиг +70 опыт
            [{key:'a_rast', name:'Растаман',        total:7, reward:{cig:70, exp:70}},
             {key:'a_kur',  name:'Куряга',          total:7, reward:{cig:70, exp:70}},
             {key:'a_pozh', name:'Пожарник',        total:7, reward:{cig:70, exp:70}}],
            // Янтарь: +80 сиг +80 опыт
            [{key:'y_koll', name:'Коллекционер',    total:7, reward:{cig:80, exp:80}},
             {key:'y_muz',  name:'Музыкант',        total:7, reward:{cig:80, exp:80}},
             {key:'y_kegl', name:'Кегля',           total:7, reward:{cig:80, exp:80}}],
        ];
        // Загружаем сохраненные данные
        this._loadFromUdata();

        // Фоновый прогрев артов активных чекпоинтов — попап локации откроется сразу с картинкой
        setTimeout(()=>{
            const CA = './images/layers/popups/location/cp_art/';
            for(const loc of this.locations){
                const cp = loc.checkpoints.find(c => c.filled < c.cells) || loc.checkpoints[0];
                if(cp && cp.art) PIXI.Texture.from(CA + cp.art);
            }
        }, 4000);
    }

    // ── БОЕВЫЕ ДЕЙСТВИЯ ───────────────────────────────────────────────────────

    // Аудит 17.09.2026 (перенос экономики на сервер, шаг 1 — Зона): раньше эта функция сама
    // считала награду (сигареты/опыт/уважение/заначку/захват) и просто слала итог на
    // сохранение — игрок мог вызвать _attack() из консоли в обход энергии в цикле и накрутить
    // себе что угодно в пределах серверного потолка. Теперь клиент только ПРОСИТ сервер
    // (zone.fillCheckpoint, loc+cp — не суммы), сервер сам проверяет энергию/состояние ячейки
    // и сам считает награду по server/json/zone_config.json (сверен построчно с этими же
    // таблицами при переносе). UI/анимации/хуки ачивок-баттлпасса — те же самые, просто
    // используют цифры из ОТВЕТА сервера вместо локального расчёта.
    _attack(locIdx, cpIdx){
        if(Array.isArray(locIdx)){ cpIdx = locIdx[1]; locIdx = locIdx[0]; }
        // Лог СРАЗУ на входе, ДО любых ранних return — по прямому указанию 17.09.2026 ("в
        // консоли ничего не выводилось"). Если клик по клетке молча ничего не делает, отсюда
        // сразу видно, что клик дошёл до _attack(), а причина — в одном из early-return ниже
        // (уже заполнена / не хватает энергии), а не в том, что обработчик клика вообще не сработал.
        console.log('[zone._attack] клик | locIdx:', locIdx, 'cpIdx:', cpIdx);

        const cp = this.locations[locIdx].checkpoints[cpIdx];
        if(cp.filled >= cp.cells){
            console.log('[zone._attack] отмена — ячейка уже заполнена | filled:', cp.filled, '/ cells:', cp.cells);
            return;
        }

        // Быстрая клиентская проверка энергии — только для мгновенной обратной связи (открыть
        // попап покупки энергии без похода на сервер). Финальное решение и списание — на
        // сервере; если к моменту ответа энергии внезапно не хватит (гонка), сервер откажет.
        const energyCost = cp.cell_cost;
        if(TIMERS.getEnergy() < energyCost){
            console.log('[zone._attack] отмена — не хватает энергии | нужно:', energyCost, '| есть:', TIMERS.getEnergy());
            if(window.iface) iface._openEnergyPopup();
            return;
        }

        if(this._fillInFlight){
            console.log('[zone._attack] запрос уже выполняется, повторный клик проигнорирован');
            return;
        }
        this._fillInFlight = true;

        console.log('[zone._attack] → сервер | locIdx:', locIdx, 'cpIdx:', cpIdx, 'energyCost:', energyCost,
            '| энергия сейчас (клиент, для сверки):', TIMERS.getEnergy());

        // 23.09.2026 (баг найден — "прохожу локацию, все точки 5/5, а ВЫПОЛНИТЬ даёт ошибку
        // 61 — не все ячейки заполнены"): 'zone' — client-writable поле (users.php $allowed),
        // как и weapons/bosses_data/dvor_games_data — тот же класс гонки, что уже чинили
        // flushPlayerSave() для старта боя/ящика/блэкджека (см. их комментарии): если где-то
        // в игре уже стоял в очереди 500мс-дебаунс общего автосейва (player-save.js) со
        // СТАРЫМ udata['zone'] (снимок ДО этого клика по ячейке), он мог долететь до сервера
        // ПОСЛЕ того, как zone.fillCheckpoint() уже увеличил cps[cpIdx] в БД напрямую — и
        // молча затереть это увеличение устаревшим значением. Клиент при этом продолжает
        // локально считать cp.filled++ (оптимистично, из ответа fillCheckpoint), не подозревая,
        // что сервер только что откатил прогресс — расхождение накапливается незаметно, пока
        // не сработает fail(61) при попытке захвата. Ждём флаша ПЕРЕД каждым fillCheckpoint —
        // гарантированно никакой устаревший снимок 'zone' не перезапишет свежий прогресс следом.
        // 28.09.2026 (аудит "checkAll → flush затирает серверные начисления", см. память агента
        // incident_checkall_flush_wipes_server_credits): flushPlayerSave() ПЕРЕД запросом (см.
        // коммент выше) защищает только от УЖЕ стоявшего в очереди сейва — не от НОВОГО
        // автосейва, который может запланироваться и сработать, ПОКА сам fillCheckpoint летит
        // туда-обратно. suspendPlayerSave()/resumePlayerSave() перекрывают всё окно запроса
        // целиком — тот же приём, что уже есть у bosses.attack/claimKill.
        flushPlayerSave('zone_fill_checkpoint', () => {
        if(window.suspendPlayerSave) suspendPlayerSave('zone_fill_checkpoint');
        TS.php('zone.fillCheckpoint', {loc: locIdx, cp: cpIdx}, (res) => {
            this._fillInFlight = false;
            console.log('[zone._attack] ← ответ сервера:', JSON.stringify(res));
            if(!res || !res.patch || !res.checkpoint){
                console.error('[zone._attack] некорректный ответ сервера (нет patch/checkpoint), действие не применено:', JSON.stringify(res));
                if(window.resumePlayerSave) resumePlayerSave('zone_fill_checkpoint');
                return;
            }

            applyPatch(res.patch);
            if(window.resumePlayerSave) resumePlayerSave('zone_fill_checkpoint');
            // applyPatch() уже передал и energy, и energy_time в
            // TIMERS.syncFromPatch(). Повторно ставить базу на Date.now() здесь нельзя:
            // это выбрасывает накопленный остаток и визуально начинает 5 минут заново.

            cp.filled++;

            const earned_cig  = res.checkpoint.cig;
            const earned_exp  = res.checkpoint.exp;
            const earned_resp = res.checkpoint.resp;
            this._showCpReward(earned_exp, earned_cig, earned_resp);

            // 25.09.2026 (по прямому указанию — "нычки визуально не готовы, находка сейчас не
            // должна иметь никакого функционала — просто счётчик в БД, без классификации по
            // типу и без награды"): сервер решает, выпала ли заначка (15% шанс, см.
            // zone.php.fillCheckpoint()) и молча инкрементит udata['stash_count'] (значение уже
            // применено вызовом чуть выше, отдельно здесь ничего не читаем/не пишем). Клиенту
            // остаётся только визуальный отклик "+1" — без попапа награды, без классификации по
            // ключу/локации (раньше был per-key объект с наградой за "полную коллекцию" — убран
            // целиком вместе с реальным багом, который он вызывал, см. историю коммита). Старая
            // ачивка-категория "по типу нычки" (achievements.onStashCollect) отключена — типа
            // больше нет, классифицировать нечем; сами достижения оставлены закомментированными
            // в achievements.js на случай будущего оживления.
            if(res.stash && res.stash.dropped) this._showStashPickup();

            // Аудит 17.09.2026 (репорт "достижения показываются с задержкой"): проверка
            // достижений — САМОЙ ПОСЛЕДНЕЙ, после всех начислений и всплывающих наград, чтобы
            // попап ачивки гарантированно рисовался поверх (тот же порядок, что был раньше).
            if(window.achievements) achievements.onEnergySpent(energyCost);
            if(window.battlepass) battlepass.addXp(Math.max(1, Math.floor(earned_exp / 5)));

            if(res.captured){
                const loc = this.locations[locIdx];
                for(const c of loc.checkpoints) c.filled = 0;
                loc.cleared = res.capture.cleared;
                console.log('[zone._attack] локация захвачена | locIdx:', locIdx, '| cleared:', loc.cleared,
                    '| награда:', JSON.stringify(res.capture));
                if(window.achievements) achievements.onZoneClear(locIdx);
                const rewardItems = [
                    {type:'cigarettes', amount:res.capture.cig},
                    {type:'respect',    amount:res.capture.resp},
                    {type:'exp',        amount:res.capture.exp},
                ];
                if(window.iface && typeof iface._showRewardPopup === 'function'){
                    iface._showRewardPopup(rewardItems);
                } else {
                    notify.showResult({text:'Локация "' + loc.name + '" зачищена! +' + res.capture.cig + ' сигарет, +' + res.capture.resp + ' уважения, +' + res.capture.exp + ' опыта'}, 1);
                }
            }

            if(this._locPopup && this._locPopup.visible) this._updateLocPopup(locIdx);
        }, (err) => {
            this._fillInFlight = false;
            if(window.resumePlayerSave) resumePlayerSave('zone_fill_checkpoint');
            console.error('[zone._attack] ← ошибка сервера:', JSON.stringify(err), '| locIdx:', locIdx, 'cpIdx:', cpIdx,
                '| cp.filled на клиенте:', cp.filled, '/', cp.cells, '| энергия на клиенте:', TIMERS.getEnergy());
            // 27.09.2026 (репорт со скриншотом — "при попытке пройти чекпоинт выскакивает
            // ОШИБКА, попробуйте ещё раз"): раньше ЛЮБАЯ ошибка сервера (в т.ч. код 55 "ячейка
            // уже заполнена" и код 56 "не хватает энергии" — оба означают, что клиентское
            // состояние cp.filled/TIMERS-энергия разошлось с БД, тот же класс рассинхрона, что
            // уже чинили для captureLocation()/fail(61) чуть ниже в этом же файле) тонула в
            // одном неинформативном сообщении без какого-либо самоисцеления — повторный клик
            // бил в ту же стену снова и снова, потому что локальный снимок так и оставался
            // устаревшим. Теперь при этих двух кодах подтягиваем актуальные zone+energy с
            // сервера через _resyncFromServer(), чтобы следующий клик уже опирался на правду.
            const code = err && err.code;
            if(code === 55 || code === 56){
                notify.showResult({text:'Данные устарели, обновляю...'}, 0);
                this._resyncFromServer(locIdx);
            } else {
                notify.showResult({text:'Не удалось выполнить действие. Попробуйте ещё раз'}, 0);
            }
        });
        }); // flushPlayerSave('zone_fill_checkpoint', ...) — см. коммент выше
    }

    _showCpReward(xp, cig, resp){
        const win = new PIXI.Container();
        win.x = 640; win.y = 290;
        // Помечен _uDraggable — редактор позиций (universal_pos_editor.js._uScanForceActive)
        // уже умеет "замораживать" такие объекты (глушит gsap-твин затухания, держит
        // alpha=1), пока режим редактора включён, ЕСЛИ этот попап ещё существует в дереве
        // на момент включения/скана — по прямому указанию: "чтобы редактирование также
        // открывало на локации последнее получение опыта/сигарет/уважения для правки".
        win._uDraggable = true;

        // Три одинаковых по типографике блока. Между визуальными строками оставляем
        // ровно 14 px: высота строки 24 px + промежуток 14 px = шаг 38 px.
        const REWARD_FONT_SIZE = 24;
        const REWARD_ROW_GAP = 14;
        const REWARD_ROW_STEP = REWARD_FONT_SIZE + REWARD_ROW_GAP;
        const REWARD_STYLE = {
            fontFamily:'Southbank LT', fontSize:REWARD_FONT_SIZE, fill:'#ffffff',
            fontWeight:'bold', dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:2,
        };
        const xpY = -REWARD_ROW_STEP;
        const cigY = 0;
        const respY = REWARD_ROW_STEP;

        const xpTxt = new PIXI.Text('+' + xp + ' XP', REWARD_STYLE);
        xpTxt.anchor.set(0.5, 0.5);
        xpTxt.x = 0; xpTxt.y = xpY;
        win.addChild(xpTxt);

        const cigTxt = new PIXI.Text('+' + cig, REWARD_STYLE);
        cigTxt.anchor.set(1, 0.5);
        cigTxt.x = -6; cigTxt.y = cigY;
        win.addChild(cigTxt);

        const cigIcon = new PIXI.Sprite(PIXI.Texture.from('./images/сиги эмблема.png'));
        cigIcon.anchor.set(0, 0.5);
        cigIcon.x = 0; cigIcon.y = cigY;
        win.addChild(cigIcon);

        if(resp){
            const respTxt = new PIXI.Text('+' + resp, REWARD_STYLE);
            respTxt.anchor.set(1, 0.5);
            respTxt.x = -6; respTxt.y = respY;
            win.addChild(respTxt);
            const respIcon = new PIXI.Sprite(PIXI.Texture.from('./images/уважение эмблема.png'));
            respIcon.anchor.set(0, 0.5);
            respIcon.x = 0; respIcon.y = respY;
            win.addChild(respIcon);
        }

        root.layer2_mc.addChild(win);

        if(window.gsap){
            gsap.to(win, {
                y: win.y - 90, alpha: 0, duration: 1.6, ease: 'power1.out',
                onComplete: () => { if(win.parent) win.parent.removeChild(win); },
            });
        } else {
            setTimeout(() => { if(win.parent) win.parent.removeChild(win); }, 1600);
        }
    }

    // Плавающая иконка получения заначки (карточки коллекции) — визуально копирует
    // _showCpReward() (взлёт на 90px вверх + затухание за 1.6с), новая картинка
    // "./images/заначка эмблема.png" (15.09.2026, папка C:\Users\HONOR\Desktop\vk_game).
    _showStashPickup(){
        const win = new PIXI.Container();
        win.x = 640; win.y = 290;

        const bagIcon = new PIXI.Sprite(PIXI.Texture.from('./images/заначка эмблема.png'));
        bagIcon.anchor.set(0, 0.5);
        // Картинка исходно 100×100 — по прямому указанию размер должен совпадать с иконками
        // наград за прохождение локации (сиги эмблема.png 32×42, уважение эмблема.png 35×40,
        // рендерятся БЕЗ явного масштаба, т.е. в нативном размере) — приводим к тем же ~40px.
        bagIcon.width = 40; bagIcon.height = 40;
        bagIcon.x = 0; bagIcon.y = 0;
        win.addChild(bagIcon);

        const plusTxt = new PIXI.Text('+1', {
            fontFamily:'Southbank LT', fontSize:26, fill:'#ffdd44',
            fontWeight:'bold', dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:2,
        });
        plusTxt.anchor.set(1, 0.5);
        plusTxt.x = -8; plusTxt.y = 0;
        win.addChild(plusTxt);

        root.layer2_mc.addChild(win);

        if(window.gsap){
            gsap.to(win, {
                y: win.y - 90, alpha: 0, duration: 1.6, ease: 'power1.out',
                onComplete: () => { if(win.parent) win.parent.removeChild(win); },
            });
        } else {
            setTimeout(() => { if(win.parent) win.parent.removeChild(win); }, 1600);
        }
    }

    // «Рамка уважения» на карточках локаций (16.09.2026) — кто заработал больше всего
    // уважения именно с ЭТОЙ локации, глобально среди всех игроков. Копит личный итог в
    // udata['loc_respect_N'] (сохраняется штатно через users.save, whitelist users.php) и
    // сообщает НОВЫЙ ИТОГ (не дельту) на сервер (zone.recordRespect) — сервер сам решает,
    // стал ли игрок новым рекордсменом (GREATEST в SQL, см. zone.php), гонки между разными
    // игроками ему не страшны. Fire-and-forget, как bosses-combat.js._resolveVkUsers-соседи —
    // ошибка сети тут не должна мешать основному начислению уважения.
    _addLocRespect(locIdx, amount){
        if(!amount) return;
        const key = 'loc_respect_' + locIdx;
        const total = parseInt(udata[key] || 0) + amount;
        udata[key] = String(total);
        if(window.TS){
            TS.php('zone.recordRespect', {loc: locIdx, amount: total}, ()=>{}, (e)=>{
                console.error('[zone._addLocRespect] ошибка zone.recordRespect | locIdx:', locIdx, '| total:', total, '| error:', e);
            });
        }
    }

    // Вызывается ТОЛЬКО из zone-popup.js (кнопка "ВЫПОЛНИТЬ", когда все 6 ячеек УЖЕ были
    // заполнены раньше) — обычный путь захвата идёт автоматически внутри _attack()/сервера.
    // Аудит 17.09.2026: формула награды (100/10/50 × (locIdx+1)) перенесена на сервер
    // (zone.captureLocation) вместе с остальной Зоной — здесь только запрос+применение ответа.
    _capture(locIdx){
        const loc = this.locations[locIdx];
        if(!loc.checkpoints.every(point => point.filled >= point.cells)) return;

        if(this._captureInFlight) return;
        this._captureInFlight = true;

        // 19.09.2026 (репорт "прохожу локацию (Кордон), а заново не начинается — как будто
        // зависла"): до этой правки и ранний return ниже, и (err)-колбэк вообще ничего не
        // показывали игроку — при любом сбое (в т.ч. серверный fail(61) "не все ячейки
        // заполнены", единственный случай, когда этот эндпоинт вообще должен быть нужен —
        // см. комментарий у captureLocation() в zone.php) кнопка ВЫПОЛНИТЬ выглядела так,
        // будто просто ничего не делает. Живые данные на момент репорта (SELECT zone FROM
        // users) показали, что чекпоинты Кордона у ЭТОГО игрока в итоге сброшены корректно —
        // явного повторяемого бага в самой логике сброса не нашли, но отсутствие обратной
        // связи при сбое — реальная и воспроизводимая проблема сама по себе.
        console.log('[zone._capture] → сервер | locIdx:', locIdx, 'loc:', loc.name,
            '| cps перед отправкой:', JSON.stringify(loc.checkpoints.map(cp => cp.filled + '/' + cp.cells)));
        // 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits):
        // captureLocation() пишет cigarettes/respect/exp напрямую на сервере — окно запроса
        // нужно перекрыть suspend/resume, та же защита, что уже есть у fillCheckpoint() выше.
        if(window.suspendPlayerSave) suspendPlayerSave('zone_capture');
        TS.php('zone.captureLocation', {loc: locIdx}, (res) => {
            this._captureInFlight = false;
            console.log('[zone._capture] ← ответ сервера:', JSON.stringify(res));
            if(!res || !res.patch || !res.capture){
                console.error('[zone._capture] некорректный ответ сервера, действие не применено:', JSON.stringify(res));
                if(window.resumePlayerSave) resumePlayerSave('zone_capture');
                notify.showResult({text:'Не удалось захватить локацию. Попробуйте ещё раз'}, 0);
                return;
            }
            applyPatch(res.patch);
            if(window.resumePlayerSave) resumePlayerSave('zone_capture');

            loc.cleared = res.capture.cleared;
            for(const cp of loc.checkpoints) cp.filled = 0;
            if(window.achievements) achievements.onZoneClear(locIdx);
            if(this._locPopup && this._locPopup.visible) this._updateLocPopup(locIdx);

            const rewardItems = [
                {type:'cigarettes', amount:res.capture.cig},
                {type:'respect',    amount:res.capture.resp},
                {type:'exp',        amount:res.capture.exp},
            ];
            if(window.iface && typeof iface._showRewardPopup === 'function'){
                iface._showRewardPopup(rewardItems);
            } else {
                notify.showResult({text:'Локация "' + loc.name + '" зачищена! +' + res.capture.cig + ' сигарет, +' + res.capture.resp + ' уважения, +' + res.capture.exp + ' опыта'}, 1);
            }
        }, (err) => {
            this._captureInFlight = false;
            if(window.resumePlayerSave) resumePlayerSave('zone_capture');
            console.error('[zone._capture] ← ошибка сервера:', JSON.stringify(err), '| locIdx:', locIdx,
                '| cps на момент ошибки:', JSON.stringify(loc.checkpoints.map(cp => cp.filled + '/' + cp.cells)));
            // Код 61 = "не все ячейки заполнены" (см. zone.php.captureLocation) — сервер и
            // клиент разошлись во мнении, всё ли заполнено; остальные коды — сетевая/серверная
            // ошибка. В обоих случаях раньше игрок не видел НИЧЕГО — кнопка "ВЫПОЛНИТЬ"
            // выглядела зависшей. Обновляем попап, чтобы кнопка отразила актуальное состояние
            // сервера, а не застывший локальный "allDone".
            //
            // 22.09.2026 (баг всё ещё воспроизводится после логирования 19.09.2026, по прямому
            // указанию): расследование НЕ нашло детерминированного бага в самой логике сброса
            // чекпоинтов — значит клиентское `loc.checkpoints` (локальное состояние, которое
            // мутируется вручную в разных местах — cp.filled++/сброс при res.captured) могло
            // где-то разойтись с реальным server-side `zone` до этого клика. Вместо зависшей
            // кнопки — самоисцеляющийся ресинк: перечитываем udata['zone'] СВЕЖИМ с сервера
            // (users.get) и пересобираем this.locations[locIdx] из него, чтобы следующий клик
            // "ВЫПОЛНИТЬ"/по чекпоинту уже опирался на правдивое состояние, а не на протухшее.
            if(err && err.code === 61){
                notify.showResult({text:'Не все точки локации ещё выполнены. Обновляю...'}, 0);
                this._resyncFromServer(locIdx);
            } else {
                notify.showResult({text:'Не удалось захватить локацию. Попробуйте ещё раз'}, 0);
                if(this._locPopup && this._locPopup.visible) this._updateLocPopup(locIdx);
            }
        });
    }

    // См. комментарий в _capture() (код 61) — читает АКТУАЛЬНЫЙ udata['zone'] прямо с сервера
    // (не из локального кэша) и пересобирает this.locations[locIdx].checkpoints/cleared через
    // уже существующий _loadFromUdata(). Тот же приём восстановления, что при обычной загрузке
    // игры, просто вызванный повторно посреди сессии.
    _resyncFromServer(locIdx){
        if(!window.TS || !window.vk_params) return;
        console.log('[zone._resyncFromServer] → сервер: users.get | locIdx:', locIdx);
        TS.php('users.get', {uid: vk_params['vk_user_id'], users: 'skip'}, (res) => {
            const fresh = res && res.udata;
            if(!fresh || fresh.zone === undefined){
                console.error('[zone._resyncFromServer] некорректный ответ сервера, ресинк пропущен:', JSON.stringify(res));
                return;
            }
            console.log('[zone._resyncFromServer] ← свежий zone с сервера:', JSON.stringify(fresh.zone), '| energy:', fresh.energy);
            udata['zone'] = fresh.zone;
            this._loadFromUdata();
            // 27.09.2026: заодно подтягиваем энергию — иначе TIMERS остаётся со старым (возможно
            // ошибочным) значением, и следующий клик по чекпоинту может снова упереться в код 56
            // "не хватает энергии" (см. _attack()), хотя сама причина рассинхрона уже устранена.
            if(window.TIMERS && fresh.energy !== undefined){
                // У users.get есть energy_time: синхронизируем его тем же путём, что и
                // обычный ответ fillCheckpoint, не сбрасывая отображаемый остаток КД.
                TIMERS.syncFromPatch(fresh.energy, fresh.energy_time);
                if(window.iface) iface.updateEnergy();
            }
            if(this._locPopup && this._locPopup.visible) this._updateLocPopup(locIdx);
        }, (e) => { console.error('[zone._resyncFromServer] ошибка users.get:', JSON.stringify(e)); });
    }

    // ── БИЗНЕС ────────────────────────────────────────────────────────────────

    // Аудит 17.09.2026: стоимость/уровень теперь проверяет и применяет сервер
    // (zone.upgradeBusiness) — клиентская проверка cigarettes<cost ниже оставлена ТОЛЬКО
    // для мгновенного дружелюбного сообщения без похода на сервер, финальное решение за ним.
    _upgradeBusiness(locIdx, bizIdx){
        const biz = this.locations[locIdx].businesses[bizIdx];
        if(biz.level >= biz.max_level) return;
        const cost = biz.costs[biz.level];

        if(parseInt(udata['cigarettes'] || 0) < cost){
            notify.showResult({text:'Недостаточно сигарет! Нужно ' + cost}, 0);
            return;
        }

        console.log('[zone._upgradeBusiness] → сервер | locIdx:', locIdx, 'bizIdx:', bizIdx, 'currentLevel:', biz.level, 'cost:', cost);
        // 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits):
        // upgradeBusiness() списывает cigarettes напрямую на сервере — окно запроса нужно
        // перекрыть suspend/resume, та же защита, что уже есть у fillCheckpoint/captureLocation.
        if(window.suspendPlayerSave) suspendPlayerSave('zone_upgrade_business');
        TS.php('zone.upgradeBusiness', {loc: locIdx, biz: bizIdx}, (res) => {
            console.log('[zone._upgradeBusiness] ← ответ сервера:', JSON.stringify(res));
            if(!res || !res.patch){
                console.error('[zone._upgradeBusiness] некорректный ответ сервера, уровень не применён:', JSON.stringify(res));
                if(window.resumePlayerSave) resumePlayerSave('zone_upgrade_business');
                return;
            }
            applyPatch(res.patch);
            if(window.resumePlayerSave) resumePlayerSave('zone_upgrade_business');
            biz.level = res.newLevel;
            if(this._bizPopup && this._bizPopup.parent) this._openBizPopup();
        }, (err) => {
            if(window.resumePlayerSave) resumePlayerSave('zone_upgrade_business');
            console.error('[zone._upgradeBusiness] ← ошибка сервера:', JSON.stringify(err));
            notify.showResult({text:'Не удалось прокачать бизнес'}, 0);
        });
    }

    // Аудит 17.09.2026: суммы дохода и сам кулдаун теперь считает и проверяет сервер
    // (zone.collectIncome) — заодно вскрылась отдельная давняя проблема: zone_collect_N
    // никогда не было в whitelist сервера, кулдаун не переживал перезагрузку страницы (см.
    // migrate16.php). Клиентская проверка кулдауна ниже — только для мгновенного сообщения
    // "следующий сбор через ЧЧ:ММ" без похода на сервер.
    //
    // 29.09.2026 (репорт — "прокачал бизнес на двух локациях на максимум (50 сиг + 100 сиг),
    // а получил суммарно только 70"): добавлен опциональный onDone(), чтобы вызывающий код мог
    // ДОЖДАТЬСЯ ответа сервера перед следующим сбором — см. _collectIncome() ниже, где раньше
    // все локации собирались параллельно без ожидания, что и приводило к потере части начисления.
    collectLocIncome(locIdx, onDone){
        const loc = this.locations[locIdx];
        if(!loc){ if(typeof onDone === 'function') onDone(); return; }

        const now  = Math.floor(Date.now() / 1000);
        const key  = 'zone_collect_' + locIdx;
        const last = parseInt(udata[key] || '0') || 0;
        const COOLDOWN = 8 * 3600;

        if(last > 0 && (now - last) < COOLDOWN){
            const left = COOLDOWN - (now - last);
            const hh = String(Math.floor(left / 3600)).padStart(2, '0');
            const mm = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
            notify.showResult({text:'Прибыль собрана. Следующий сбор через ' + hh + ':' + mm}, 0);
            if(typeof onDone === 'function') onDone();
            return;
        }

        console.log('[zone.collectLocIncome] → сервер | locIdx:', locIdx);
        // 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits):
        // collectIncome() начисляет cigarettes/exp/respect напрямую на сервере — окно запроса
        // нужно перекрыть suspend/resume, та же защита, что уже есть у соседних методов Зоны.
        if(window.suspendPlayerSave) suspendPlayerSave('zone_collect_income');
        TS.php('zone.collectIncome', {loc: locIdx}, (res) => {
            console.log('[zone.collectLocIncome] ← ответ сервера:', JSON.stringify(res));
            if(!res || !res.patch){
                if(window.resumePlayerSave) resumePlayerSave('zone_collect_income');
                notify.showResult({text:'Бизнес не прокачан — дохода нет'}, 0);
                if(typeof onDone === 'function') onDone();
                return;
            }
            applyPatch(res.patch);
            if(window.resumePlayerSave) resumePlayerSave('zone_collect_income');
            // 21.09.2026 (аудит "достижения появляются с задержкой") — applyPatch() зовёт только
            // iface.updateUp(), достижения не проверяет; сбор прибыли бизнеса раньше не имел
            // собственной проверки вовсе (тот же экран, где недавно чинили краш кнопки "Собрать").
            if(window.achievements) achievements._checkAll();

            const rewardItems = [];
            if(res.cig)  rewardItems.push({type:'cigarettes', amount: res.cig});
            if(res.exp)  rewardItems.push({type:'exp',        amount: res.exp});
            if(res.resp) rewardItems.push({type:'respect',    amount: res.resp});
            if(window.iface && typeof iface._showRewardPopup === 'function'){
                iface._showRewardPopup(rewardItems);
            } else {
                const msg = [];
                if(res.cig)  msg.push('+' + res.cig  + ' сиг');
                if(res.exp)  msg.push('+' + res.exp  + ' опыта');
                if(res.resp) msg.push('+' + res.resp + ' уважения');
                notify.showResult({text:'Прибыль с "' + loc.name + '": ' + msg.join('  ')}, 1);
            }
            if(typeof onDone === 'function') onDone();
        }, (err) => {
            if(window.resumePlayerSave) resumePlayerSave('zone_collect_income');
            console.error('[zone.collectLocIncome] ← ошибка сервера:', JSON.stringify(err));
            // Баг найден 18.09.2026 ("прокачал бизнес, а пишет что не прокачан") — эта ветка
            // раньше показывала ОДИН И ТОТ ЖЕ текст для ЛЮБОЙ ошибки сервера, включая код 59
            // (кулдаун 8ч ещё не истёк — совершенно не связано с уровнем бизнеса). Различаем
            // по err.code (см. zone.php.collectIncome: fail(59)=кулдаун, fail(60)=реально
            // нечего собирать — все уровни бизнесов на локации равны 0).
            const code = err && err.code;
            if(code === 59) notify.showResult({text:'Прибыль уже собрана — попробуйте позже'}, 0);
            else if(code === 60) notify.showResult({text:'Бизнес не прокачан — дохода нет'}, 0);
            else notify.showResult({text:'Не удалось собрать прибыль'}, 0);
            if(typeof onDone === 'function') onDone();
        });
    }

    getCollectCooldown(locIdx){
        const now  = Math.floor(Date.now() / 1000);
        const key  = 'zone_collect_' + locIdx;
        const last = parseInt(udata[key] || '0') || 0;
        const left = 8 * 3600 - (now - last);
        return last > 0 ? Math.max(0, left) : 0;
    }

    _locHasBizIncome(loc){
        if(!loc || !loc.businesses) return false;
        return loc.businesses.some(b => (b.level || 0) > 0);
    }

    // Одна кнопка — один серверный запрос. Сервер суммирует доход всех готовых бизнесов по
    // всем локациям и сохраняет баланс один раз, поэтому итог не зависит от порядка локаций
    // и показывается одним общим попапом.
    _collectIncome(onAllDone){
        if(!window.TS){ if(typeof onAllDone === 'function') onAllDone(); return; }
        if(this._collectAllIncomeInFlight) return;
        this._collectAllIncomeInFlight = true;
        if(window.suspendPlayerSave) suspendPlayerSave('zone_collect_all_income');
        TS.php('zone.collectAllIncome', {}, (res) => {
            this._collectAllIncomeInFlight = false;
            if(window.resumePlayerSave) resumePlayerSave('zone_collect_all_income');
            if(!res || !res.patch){
                notify.showResult({text:'Бизнес не прокачан или прибыль ещё на кулдауне'}, 0);
                if(typeof onAllDone === 'function') onAllDone();
                return;
            }
            applyPatch(res.patch);
            if(window.achievements) achievements._checkAll();
            const rewardItems = [];
            if(res.cig)  rewardItems.push({type:'cigarettes', amount:res.cig});
            if(res.exp)  rewardItems.push({type:'exp', amount:res.exp});
            if(res.resp) rewardItems.push({type:'respect', amount:res.resp});
            if(window.iface && typeof iface._showRewardPopup === 'function') iface._showRewardPopup(rewardItems);
            else notify.showResult({text:'Собрана общая прибыль: +' + (res.cig || 0) + ' сиг, +' + (res.exp || 0) + ' опыта, +' + (res.resp || 0) + ' уважения'}, 1);
            if(typeof onAllDone === 'function') onAllDone();
        }, (err) => {
            this._collectAllIncomeInFlight = false;
            if(window.resumePlayerSave) resumePlayerSave('zone_collect_all_income');
            console.error('[zone._collectIncome] ← ошибка сервера:', JSON.stringify(err));
            notify.showResult({text:'Не удалось собрать прибыль'}, 0);
            if(typeof onAllDone === 'function') onAllDone();
        });
    }

    // ── ЗАНАЧКИ ───────────────────────────────────────────────────────────────
    //
    // 25.09.2026 (по прямому указанию — "нычки визуально не готовы, находка сейчас не должна
    // иметь никакого функционала — просто счётчик в БД, без классификации по типу и без
    // награды; когда появится арт, тогда включим полную логику обмена"): вся per-key логика
    // (сбор коллекции из stash.total карточек одного типа → награда сигаретами/опытом) убрана.
    // Заодно устранён реальный баг: per-key объект {cards,completed} писался сервером в то же
    // udata['stash_data'], которое achievements.js.onStashCollect() ОДНОВРЕМЕННО использовало
    // как плоский счётчик {key: number} — коллизия форматов роняла клиент TypeError'ом
    // ("Cannot create property 'cards' on string '[object Object]1'") при повторном сборе.
    // Текущее поведение: сервер (zone.php.fillCheckpoint) сам решает, выпала ли заначка (тот
    // же 15% шанс) и молча инкрементит плоский udata['stash_count'] — без типа/темы ("нычка
    // есть нычка"). Клиент только показывает "+1" (_showStashPickup(), см. zone.js._attack()).
    // _tryDropStash()/_renderStashPanel()/_saveStash()/_loadStash() (весь этот блок) были
    // клиент-авторитетным путём (или дублировали legacy/zone_panel_legacy.js, который сам
    // удалён 28.09.2026 как полностью мёртвый — его win/tabs никогда не добавлялись в stage)
    // — удалены как мёртвый/устаревший код, не серверная логика. _stashProgress тоже удалён
    // из конструктора Zone тем же батчем — последний его читатель (legacy-панель) исчез.

    // ── СОХРАНЕНИЕ / ЗАГРУЗКА ─────────────────────────────────────────────────

    getCleared(locIdx){
        return this.locations[locIdx] ? (this.locations[locIdx].cleared || 0) : 0;
    }

    _saveToUdata(){
        const data = {};
        for(let li = 0; li < this.locations.length; li++){
            data[li] = {
                cps:     this.locations[li].checkpoints.map(cp => cp.filled),
                biz:     this.locations[li].businesses.map(b => b.level),
                cleared: this.locations[li].cleared || 0,
            };
        }
        udata['zone'] = JSON.stringify(data);

		// 03.10.2026 (аудит "обходные users.save в обход player-save.js" — см. список в памяти
		// агента/AGENTS.md: zone.js был явно отмечен НЕ обёрнутым suspend/resume ещё 28.09.2026).
		// Раньше здесь был прямой TS.php('users.save', ...) мимо общего revision-механизма —
		// тот же класс гонки, что уже чинили у onboarding.js/skills.js: случайный конкурентный
		// автосейв со СТАРЫМ снимком udata мог прилететь позже и затереть свежий прогресс.
		// Прогресс ячеек/зачисток по-прежнему критичен (сохраняем сразу, не ждём минутного
		// autosave) — flushPlayerSave() под suspend/resume даёт и то, и другое: немедленную
		// отправку И защиту от гонки.
		if(window.suspendPlayerSave) suspendPlayerSave('zone_save_to_udata');
		const _resume = () => { if(window.resumePlayerSave) resumePlayerSave('zone_save_to_udata'); };
		if(window.flushPlayerSave){
			flushPlayerSave('zone_save_to_udata', (err) => {
				_resume();
				if(err) console.error('[zone._saveToUdata] ошибка сохранения прогресса локаций', err);
				else console.log('[zone._saveToUdata] прогресс локаций сохранён в БД');
			});
		} else if(window.TS && typeof TS.php === 'function'){
			TS.php('users.save', {udata_json: JSON.stringify(udata)},
				()=>{ _resume(); console.log('[zone._saveToUdata] прогресс локаций сохранён в БД'); },
				(err)=>{ _resume(); console.error('[zone._saveToUdata] ошибка сохранения прогресса локаций', err); });
		} else {
			_resume();
		}
    }

    _loadFromUdata(){
        if(!udata || !udata['zone']) return;
        try{
            // Database::trueJSON может вернуть JSON-поле уже декодированным объектом.
            // Раньше JSON.parse(object) падал, пустой catch скрывал ошибку и весь
            // сохранённый прогресс локаций визуально сбрасывался при новом входе.
            const raw = udata['zone'];
            const saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if(!saved || typeof saved !== 'object') throw new Error('zone progress has invalid format');
            for(let li = 0; li < this.locations.length; li++){
                if(!saved[li]) continue;
                const loc = this.locations[li];

                const cps = saved[li].cps;
                if(cps) for(let ci = 0; ci < 6; ci++){
                    if(cps[ci] !== undefined) loc.checkpoints[ci].filled = cps[ci];
                }

                const savedBiz = saved[li].biz;
                if(Array.isArray(savedBiz)){
                    savedBiz.forEach((lv, bi) => { if(loc.businesses[bi]) loc.businesses[bi].level = lv; });
                } else if(typeof savedBiz === 'number'){
                    if(loc.businesses[0]) loc.businesses[0].level = savedBiz;
                }

                if(saved[li].cleared !== undefined){
                    loc.cleared = saved[li].cleared;
                } else {
                    const allFull = loc.checkpoints.every(cp => cp.filled >= cp.cells);
                    if(allFull) loc.cleared = 1;
                }
            }
        } catch(err){
            console.error('[zone._loadFromUdata] не удалось восстановить прогресс локаций', err, udata['zone']);
        }
    }
}

attachZonePopup(Zone.prototype);
attachZoneBiz(Zone.prototype);
