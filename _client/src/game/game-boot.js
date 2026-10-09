/** Инициализация игры после загрузки FLA: endLoadGame + loadGame. */
import { startBackgroundMusic } from '../modules/background-music.js';
import { checkRewardLink } from '../modules/reward-link.js';

export function setupGameBoot(){

    // Глобальный список PNG — доступен сразу при старте (ранняя предзагрузка)
    window._allGamePngs = [
            'char.png','pers.png','otkryt_sumku.png','poker_bag.png','poker_bag_btn.png',
            'smenit_activ.png','smenit_passiv.png','yashik_otkryt.png','yashik_screen.png',
            'yashik_screen_obyskat.png','yashik_activ.png','заполнение шкалы ящика.png','igrat_1.png','igrat_5.png',
            'Выход.png','выход.png','бирка.png','вкладка двор.png','влево.png','выйти актив.png',
            'когда влево больше нельзя.png','когда вправо больше нельзя.png',
            'стрелка вправо.png',
            'монеты эмблема.png','сиги эмблема.png','уважение эмблема.png',
            'двор hover.png','двор.png','двор_фон.png',
            'блекджек кнопка играть.png','блекджек облако.png','блекджек фон v2.png','блекджек ценник.png','уровень блекджек.png','боевка награда Сиги.png',
            'боевка иконка баркут.png','боевка иконка борода.png','боевка иконка жгут.png','боевка иконка крыс.png',
            'боевка иконка меченный.png','боевка иконка охотник.png','боевка иконка счастливчик.png','боевка иконка ястреб.png',
            'боевка кнопка бита.png','боевка кнопка калаш.png','боевка кнопка когда не куплен хабар.png','боевка кнопка мачете.png',
            'боевка кнопка напасть.png','боевка кнопка нож.png','боевка кнопка прокачать.png','боевка кнопка сидорович.png',
            'боевка кнопка ствол.png','боевка кнопка цепь.png','боевка корона эмблема.png','боевка награда Сиги.png','боевка охотник фон.png',
            'боевка прокачка талантов.png','боевка рамка фотки для рейтинга.png',
            'боевка режим обычный.png','боевка режим опасный стоп.png','боевка режим опасный.png',
            'боевка режим соло.png','боевка режим суровый стоп.png','боевка режим суровый.png',
            'боевка с боссом баркут v2.png','боевка с боссом борода v2.png','боевка с боссом жгут v2.png','боевка с боссом крыс v2.png',
            'боевка с боссом меченный v2.png','боевка с боссом охотник v2.png','боевка с боссом счастливчик v2.png','боевка с боссом ястреб v2.png',
            'боевка слоты под оружие v2.png',
            'задний фон боевка.png','награда боевка рамка.png','награда боевка стрелка влево.png','награда боевка стрелка вправо.png',
            'скиллы.png','боевка таланты кнопка прокачать.png',
            '1.png',
            '2.png','2 неактив.png','3 актив.png','3 неактив.png',
            '4 актив.png','4 неактив.png','5 актив.png','5 неактив.png',
            '6 актив.png','6 неактив.png','7 актив.png','7 неактив.png',
            '8 актив.png','8 неактив.png','9 актив.png','9 неактив.png',
            '10 актив.png','10 неактив.png','11 актив.png','11 неактив.png',
            '12 копия 2.png','12 неактив.png','13 актив.png','13 неактив.png',
            '14 актив.png','14 неактив.png','15 актив.png','15 неактив.png',
            '16 актив.png','16 неактив.png','17 актив.png','17 неактив.png',
            '18 актив.png','18 неактив.png','19 актив.png','19 неактив.png',
            '20 актив.png','20 неактив.png',
            'баркут бронзовая медаль.png','баркут золотая медаль.png','баркут серебрянная медаль.png',
            'борода бронзовая медаль.png','борода золотая медаль.png','борода серебрянная медаль.png',
            'жгут бронзовая медаль.png','жгут золотая медаль.png','жгут серебрянная медаль.png',
            'крыс бронзовая медаль.png','крыс золотая медаль.png','крыс серебрянная медаль.png',
            'меченный бронзовая медаль.png','меченный золотая медаль.png','меченный серебрянная медаль.png',
            'охотник бронзовая медаль.png','охотник золотая медаль.png','охотник серебрянная медаль.png',
            'счастливчик бронзовая медаль.png','счастливчик золотая медаль.png','счастливчик серебрянная медаль.png',
            'ястреб бронзовая медаль.png','ястреб золотая медаль.png','ястреб серебрянная медаль.png',
            'ключ баркут.png','ключ борода.png','ключ жгут.png','ключ крыс.png',
            'ключ меченный.png','ключ счастливчик.png','ключ ястреб.png',
            'валет.png','восьмерка.png','дама.png','девятка.png','десятка.png',
            'железка.png','заправка.png','канализация.png','кубрик.png','король.png',
            'мастерская.png','семерка.png','станция.png','туз.png','шлюз.png',
            'кнопка выбрать актив.png','кнопка выбрать пассив.png',
            'кнопка к сидоровичу актив.png','кнопка купить пассив.png',
            'купить актив.png','купить патрон для ящика.png',
            'не хватает оружия.png','окно сообщения.png','отмена актив.png',
            'зарики кнопка бросить.png','зарики кости 1.png','зарики кости 2.png','зарики кости 3.png',
            'зарики кости 4.png','зарики кости 5.png','зарики кости 6.png',
            'зарики купить поинты страница.png','зарики купить поинты.png','зарики облако.png','зарики страница.png',
            'задний фон зарики.png','задний фон зарики новыйй.png',
            'покер облако.png','покер сумка открытая кнопка забрать.png','покер сумка открытая.png',
            'покупка оружия.png','покупка патрона.png','покупка хаты попап.png',
            'poker_100_level.png','poker_20_level.png','poker_60_level.png',
            'poker_bag_btn_activ.png','poker_razresheno.png','poker_screen.png',
            'рулетка 100.png','рулетка 1150.png','рулетка 250.png','рулетка 2500.png','рулетка 550.png','рулетка 5500.png',
            'рулетка галочка автоматически.png','рулетка закрытый кейс кнопка открыть.png','рулетка закрытый кейс.png',
            'рулетка кнопка крутить.png','рулетка колесо v2.png','рулетка купить поинты.png','рулетка облако.png',
            'рулетка открытый кейс без тату.png','рулетка открытый кейс кнопка забрать.png','рулетка открытый кейс с тату.png',
            'рулетка открыть кейс.png','рулетка покупка поинтов.png','рулетка страница.png','рулетка новая страница.png','рулетка описание.png','рулетка описание клик.png','опыт и уровни описание.png','опыт и уровни описание клик.png','рулетка стрелка.png',
            'магазин вещей бегунок.png','магазин вещей все актив.png','магазин вещей все пассив.png',
            'магазин вещей группа голова.png','магазин вещей группа ноги.png','магазин вещей группа обувь.png',
            'магазин вещей группа торс.png','магазин вещей мои актив.png','магазин вещей мои пассив.png',
            'магазин вещей рамка.png','магазин вещей сеты актив.png','магазин вещей сеты пассив.png',
            'магазин вещей скролл.png','магазин вещей.png','экран оружие купить.png',
            'сбор сиг 1.png','сбор сиг 2.png','сбор сиг 3.png','сбор сиг 4.png',
            'cloud_blackjack.png','cloud_dice.png','cloud_poker.png','cloud_roulette.png',
            'cloud_sig_1.png','cloud_sig_2.png','cloud_sig_3.png','cloud_sig_4.png',
            'попап _ТОЧНО__.png','попап звук.png','попап ошибка кнопка понятно.png','попап ошибка.png',
            'ошибочка вышла иди к сидоровичу.png','точно хочешь купить.png',
            'попап награда.png','попап награда кнопка забрать.png',
            'попап награда стрелка влево.png','попап награда стрелка вправо.png',
            'попап награда если 1 награда.png','попап награда если 2 награды.png',
            'попап награда если 3 награды.png','попап награда если 4 награды.png',
            'попап награда опыт.png','попап награда сигареты.png','попап награда автомат.png',
            'попап награда ствол.png','попап награда мачете.png','попап награда красный поинт.png',
            'попап награда заначки.png','попап награда рубли.png','попап награда шмотка.png',
            'попап награда тату.png','попап награда фишка.png','попап награда синий поинт.png','попап награда урон.png',
            'попап награда ключ счастливчик.png','попап награда ключ ястреб.png','попап награда ключ меченный.png','попап награда ключ крыс.png',
            'попап награда ключ баркут.png','попап награда ключ борода.png','попап награда ключ жгут.png',
            'хабар кнопка забрать.png','хабар страница.png',
            'layers/popups/location/локация кордон.png','layers/popups/location/локация свалка.png',
            'layers/popups/location/локация темная долина.png','layers/popups/location/локация агропром.png',
            'layers/popups/location/локация янтарь.png',
            'btn_biz_passiv.png','btn_biz_activ.png',
            'layers/popups/location/чекпоинт актив.png','layers/popups/location/чекпоинт готово.png',
            'layers/popups/location/чекпоинт неготово.png',
            'layers/popups/location/ячейка пройденная.png','layers/popups/location/ячейка непройденная.png',
            'layers/popups/location/кнопка выполнить можно.png',
            'layers/popups/location/награда корона.png','layers/popups/location/награда уважение.png',
            'layers/popups/location/cp_art/cp_art_k1.png','layers/popups/location/cp_art/cp_art_k2.png',
            'layers/popups/location/cp_art/cp_art_k3.png','layers/popups/location/cp_art/cp_art_k4.png',
            'layers/popups/location/cp_art/cp_art_k5.png','layers/popups/location/cp_art/cp_art_k6.png',
            'layers/popups/location/cp_art/cp_art_s1.png','layers/popups/location/cp_art/cp_art_s2.png',
            'layers/popups/location/cp_art/cp_art_s3.png','layers/popups/location/cp_art/cp_art_s4.png',
            'layers/popups/location/cp_art/cp_art_s5.png','layers/popups/location/cp_art/cp_art_s6.png',
            'layers/popups/location/cp_art/cp_art_d1.png','layers/popups/location/cp_art/cp_art_d2.png',
            'layers/popups/location/cp_art/cp_art_d3.png','layers/popups/location/cp_art/cp_art_d4.png',
            'layers/popups/location/cp_art/cp_art_d5.png','layers/popups/location/cp_art/cp_art_d6.png',
            'layers/popups/location/cp_art/cp_art_a1.png','layers/popups/location/cp_art/cp_art_a2.png',
            'layers/popups/location/cp_art/cp_art_a3.png','layers/popups/location/cp_art/cp_art_a4.png',
            'layers/popups/location/cp_art/cp_art_a5.png','layers/popups/location/cp_art/cp_art_a6.png',
            'layers/popups/location/cp_art/cp_art_y1.png','layers/popups/location/cp_art/cp_art_y2.png',
            'layers/popups/location/cp_art/cp_art_y3.png','layers/popups/location/cp_art/cp_art_y4.png',
            'layers/popups/location/cp_art/cp_art_y5.png','layers/popups/location/cp_art/cp_art_y6.png',
            'кордон и свалка.png','долина и агропром.png','янтарь окно.png',
            'кордон.png','свалка.png','долина.png','Агропром.png','янтарь.png',
            'Стрелка вверх.png','стрелка вниз.png','активная стрелка вверх.png','активная стрелка вниз.png',
            'собрать прибыль.png','кнопка захватить.png','кнопка захватить hover.png',
            'кнопка зоны актив.png','кнопка зоны пассив.png','скоро зона.png',
            // 18.09.2026: 'рамка уважение.png' и 'задний фон выбор локаций.png' раньше не
            // прелоадились вообще (в отличие от кордон/свалка/долина/агропром/янтарь выше) —
            // zone_screen.js читал frameTex.width сразу после PIXI.Texture.from(), картинка
            // ещё не успевала загрузиться, .width был плейсхолдером (~1px) — отсюда дикий
            // scale (~70x) и рамка размером 15000×17000px вместо 70×78. Добавлены в общий
            // прелоад — к моменту построения экрана текстуры уже в кэше с реальными размерами.
            // 25.09.2026 (по прямому указанию — "файлы шмоток не сразу прогружаются"):
            // все 58 иконок предметов дропа (game/shmot.js, this.items[].imgFile) раньше НЕ
            // входили в общий прелоад вообще — PIXI.Texture.from() вызывался лениво, только
            // когда игрок реально открывал магазин шмоток/манекен, отсюда заметный попап-ин
            // картинок уже ПОСЛЕ открытия экрана. Путь с префиксом 'shmot/' — та же папка,
            // что и у shmot_shop.js._shopRefresh() ('./images/shmot/' + item.imgFile).
            'shmot/шмот панама ссср охотник.png','shmot/шмот футболка ссср счастливчик.png','shmot/шмот шорты ссср ястреб.png',
            'shmot/шмот кроссовки ссср соло охотник.png','shmot/шмот серп соло счастливчик.png','shmot/шмот молот соло ястреб.png',
            'shmot/шмот кепка вольный.png','shmot/шмот футболка вольный меченный.png','shmot/шмот кроссовки вольный.png',
            'shmot/шмот газета мастер крыс.png','shmot/шмот майка мастер крыс.png','shmot/шмот трико мастер крыс.png',
            'shmot/шмот тапочки мастер крыс.png','shmot/шмот панама спортик баркут.png','shmot/шмот майка спортик баркут.png',
            'shmot/шмот кроссовки спортик.png','shmot/шмот сумочка спортик соло баркут.png','shmot/шмот кукла зумер соло борода.png',
            'shmot/шмот мачете выживший жгут.png','shmot/шмот футболка выживший жгут.png','shmot/шмот бита выживший соло жгут.png',
            'shmot/шмот часы игроман покер.png','shmot/шмот кроссовки игроман покер.png','shmot/шмот бандана игроман2.0 зарики.png',
            'shmot/шмот шорты игроман2.0.png','shmot/шмот кроссовки игроман2.0.png','shmot/шмот колонка картежник блэкджек.png',
            'shmot/шмот шорты картежник блэкджек.png','shmot/шмот ботинки сталкер тайник.png','shmot/шмот футболка спортик2.0.png',
            'shmot/шмот кроссовки спортик2.0.png','shmot/шмот кроссовки тинейджер.png','shmot/шмот шорты вольный меченный.png',
            'shmot/шмот шорты спортик баркут.png','shmot/шмот кроссовки зумер борода.png','shmot/шмот футболка зумер борода.png',
            'shmot/шмот шорты зумер борода.png','shmot/шмот панама игроман покер.png','shmot/шмот шорты игроман покер.png',
            'shmot/шмот дубинка игроман2.0 зарики.png','shmot/шмот повязка сталкер тайник.png','shmot/шмот жилетка сталкер тайник.png',
            'shmot/шмот шорты сталкер тайник.png','shmot/шмот булава сталкер тайник.png','shmot/шмот шорты спортик2.0.png',
            'shmot/шмот панама тинейджер.png','shmot/шмот футболка тинейджер.png','shmot/шмот шорты тинейджер.png',
            'shmot/шмот респиратор картежник блэкджек.png','shmot/шмот респиратор спортик2.0.png','shmot/шмот шокер спортик2.0.png',
            'shmot/шмот цепь тинейджер.png','shmot/шмот обувь новопришедший.png','shmot/шмот футболка новопришедший.png',
            'shmot/шмот панама зумер борода.png','shmot/шмот шорты новопришедший.png','shmot/шмот футболка игроман покер.png',
            'shmot/шмот футболка игроман2.0.png','shmot/связка ключей v2.png',
            'выход попап покупки ключей и кд оружия.png',
            'рамка уважение.png','задний фон выбор локаций.png',
            // 30.09.2026 (обучение, по прямому указанию) — попап и рука-указатель прелоадятся
            // сразу, как и остальной UI: они могут понадобиться уже на первом кадре после
            // загрузки (интро-попап для допущенных uid), не должны попап-ить с задержкой.
            'попап обучение.png','продолжить актив.png','продолжить пассив.png',
            'слиться актив.png','слиться пассив.png','рука указатель.png',
        ];

    // Общий счетчик запускается до FLA/VK-инициализации, чтобы индикатор
    // отражал раннюю загрузку текстур, а не ждал endLoadGame().
    const _earlyPngs = [...new Set(window._allGamePngs)];
    window._pngPreloadState = { total: _earlyPngs.length, done: 0, completed: new Set() };
    window._startEarlyPngPreload = () => {
        const state = window._pngPreloadState;
        if(state.started) return;
        state.started = true;
        const update = () => {
            const pct = state.total ? Math.round(state.done / state.total * 100) : 100;
            const bar = document.getElementById('_prgBar');
            const label = document.getElementById('_prgPct');
            if(bar) bar.style.width = pct + '%';
            if(label) label.textContent = pct + '%';
        };
        const mark = (fname, status) => {
            if(state.completed.has(fname)) return;
            state.completed.add(fname);
            state.done++;
            update();
            if(status === 'error') console.error('[game-boot.earlyPreload] ошибка PNG:', fname);
        };
        _earlyPngs.forEach(fname => {
            const tex = PIXI.Texture.from('./images/' + fname);
            if(tex.baseTexture.valid) mark(fname, 'cached');
            else {
                tex.baseTexture.once('loaded', () => mark(fname, 'loaded'));
                tex.baseTexture.once('error',  () => mark(fname, 'error'));
            }
        });
        update();
    };

    window.endLoadGame = () => {
        while(root.children.length) root.removeChildAt(0);
        for(let i = 0; i < 3; i++){
            root['layer'+i+'_mc'] = new PIXI.Container();
            root.addChild(root['layer'+i+'_mc']);
        }

        // Компас как запасной экран (если видео кончится раньше чем загрузятся PNG)
        const _clo = document.getElementById('_clo');
        if(_clo) _clo.style.display = 'flex';

        // ── Прогресс-бар (элементы в index.html, z-index:10000 поверх видео) ──
        const _prgBar = document.getElementById('_prgBar');
        const _prgTip = document.getElementById('_prgTip');
        const _prgPct = document.getElementById('_prgPct');

        const _TIPS = [
            'Изучаем локации Зоны...',
            'Проверяем снаряжение сталкера...',
            'Читаем ориентировки на боссов...',
            'Считаем патроны на складе...',
            'Наводим контакты во дворе...',
            'Запрашиваем данные у Сидоровича...',
            'Сверяем карту аномалий...',
            'Распределяем снаряжение по тайникам...',
            'Ждём пропуска в Припять...',
            'Инициализируем Зону Отчуждения...',
        ];
        let _tipIdx = 0;
        const _tipInterval = setInterval(()=>{
            _tipIdx = (_tipIdx + 1) % _TIPS.length;
            if(_prgTip) _prgTip.textContent = _TIPS[_tipIdx];
        }, 2500);

        const _updateProgress = (pct) => {
            if(_prgBar) _prgBar.style.width = pct + '%';
            if(_prgPct) _prgPct.textContent = pct + '%';
        };

        // 22.09.2026 (баг найден по прямому указанию — "компас появляется на секунду и
        // пропадает, должен быть до конца загрузки игры"): раньше setTimeout внутри _showGame()
        // сразу прятал компас (#_clo) и вызывал сигнал готовности прелоадера, как только были
        // готовы ТОЛЬКО FLA interface/home + текстуры _allGamePngs. Реальные игровые модули
        // (_bgModules ниже — боссы/зона/оружие/шмот/двор и ещё 12 штук, вся геймплейная логика)
        // в этот момент ещё даже не НАЧИНАЛИ грузиться (стартуют только через 4с, см. _bgNext).
        // Прелоадер доигрывал цикл, показывал компас как fallback — и тут же гасился этим
        // преждевременным сигналом "готово". Теперь компас/прогресс-бар прячутся и
        // window._preloaderVisualReady() (08.10.2026: переименован из _preloaderVideoReady —
        // с этой даты прелоадер не видео, а Spine-анимация, см. preloader-visual.js) вызывается
        // только когда ОБА условия истинны: _gameShown (лёгкая часть готова) И _bgAllLoaded (все
        // 16 фоновых модулей реально догружены, флаг выставляет _bgNext по завершении цикла).
        let _gameShown = false;
        let _bgAllLoaded = false;
        let _loadingFinished = false;
        const _finishLoading = () => {
            if(_loadingFinished || !_gameShown || !_bgAllLoaded) return;
            _loadingFinished = true;
            console.log('[game-boot._finishLoading] вся загрузка завершена (FLA+текстуры+' +
                _bgModules.length + ' фоновых модулей) — прячем компас/прогресс-бар');
            if(_clo) _clo.style.display = 'none';
            const _ui = document.getElementById('_loader_ui');
            if(_ui) _ui.style.display = 'none';
            if(window._preloaderVisualReady) window._preloaderVisualReady();
            // 24.09.2026 (по прямому указанию — "запускается фоновая музыка, как только
            // открывается главный экран"): именно здесь главный экран становится реально
            // видимым игроку (компас/прелоадер только что скрыты строкой выше) — самая ранняя
            // корректная точка запуска, раньше него ЛЮБОЙ игровой контент ещё не отрисован.
            startBackgroundMusic();
            // 25.09.2026 (по прямому указанию — "как только загружается главное меню,
            // высвечивается поп-ап награда"): та же самая точка — первый момент, когда главный
            // экран реально виден и iface/home уже инициализированы (см. _showGame выше).
            checkRewardLink();
        };
        const _showGame = () => {
            if(_gameShown) return;
            _gameShown = true;
            clearInterval(_tipInterval);
            window._simActive = false;
            _updateProgress(100);
            // Инициализируем игру только когда ресурсы загружены — до этого PIXI-контент не создаётся
            modules.constructSkills();
            modules.constructAchievements();
            iface.init();
            home.init();
            // 08.10.2026 (по прямому указанию — "анимация босса грузится ~0.5с при входе в бой,
            // пусть грузится заранее, пока крутится прелоадер"): iface уже гарантированно создан
            // (constructInterface() — часть checkFlags(['interface','home'], ...) ВЫШЕ по стеку
            // endLoadGame(), без него iface.init() строкой выше упал бы) — самая ранняя точка,
            // где можно безопасно начать сетевую загрузку Spine-скелетов боссов, не дожидаясь
            // отдельного входа в бой. Игрок в этот момент всё ещё смотрит на прелоадер (см.
            // startPreloaderVisual()) — загрузка идёт параллельно, никак не продлевая его показ.
            if(typeof iface._spineBossPreloadAll === 'function') iface._spineBossPreloadAll();
            console.log('[game-boot._showGame] FLA+текстуры готовы, ждём фоновые модули (_bgAllLoaded=' + _bgAllLoaded + ') перед скрытием компаса');
            setTimeout(_finishLoading, 300);
        };

        const _allPngs = [...new Set(window._allGamePngs)];
        let _done = 0;
        const _total = _allPngs.length;
        const _completed = new Set();

        // Каждый уникальный PNG учитывается только после ответа загрузчика.
        const _markDone = (fname, status) => {
            if(_completed.has(fname)) return;
            _completed.add(fname);
            _done++;
            _updateProgress(Math.round((_done / _total) * 100));
            if(status === 'error'){
                console.error('[game-boot._startPreload] ошибка загрузки PNG:', fname);
            }
            if(_done >= _total) _showGame();
        };

        // Ждём пока iface/home не поставят текстуры в PIXI, потом стартуем
        const _startPreload = () => {
            console.log('[game-boot._startPreload] preloading', _total, 'textures into PIXI cache');
            window._simActive = false;
            if(_total === 0){ _showGame(); return; }

            _allPngs.forEach(fname => {
                const url = './images/' + fname;
                const tex = PIXI.Texture.from(url);
                if(tex.baseTexture.valid){
                    _markDone(fname, 'cached');
                } else {
                    tex.baseTexture.once('loaded', ()=>_markDone(fname, 'loaded'));
                    tex.baseTexture.once('error',  ()=>_markDone(fname, 'error'));
                }
            });
        };

        let _pollCount = 0;
        const _pollLoader = () => {
            if(!PIXI.Loader.shared.loading || ++_pollCount > 60){
                _startPreload();
            } else {
                setTimeout(_pollLoader, 100);
            }
        };
        setTimeout(_pollLoader, 200);

        const _bgModules = [
            'notify','bosses','zone','vassilich','weapons','shmot',
            'gangs','dvor','base','habar','top','svod',
            'zadaniya','battlepass','hapuga','bot'
        ];
        // 22.09.2026 (по прямому указанию — "стоит ли сделать загрузку не последовательной, а
        // параллельной?"): раньше 16 модулей грузились ОДИН ЗА ДРУГИМ с паузой 300мс между
        // каждым (только паузы — это ~4.5с впустую, не считая реального времени сети/парсинга на
        // каждый). После вчерашнего фикса ("компас гаснет только когда всё реально готово",
        // см. _finishLoading выше) это стало напрямую влиять на то, сколько игрок смотрит на
        // компас — чем дольше грузим, тем дольше ждать. include()/modules.checkFlags() не имеют
        // общего мутируемого состояния между РАЗНЫМИ именами модулей (каждый — свой script-тег,
        // свой window[fla], свой this.flags[name]/this.names[name]) — PIXI.Loader.shared и так
        // уже используется параллельно этим же кодом для ~300 PNG-текстур выше (_startPreload),
        // так что параллельная загрузка 16 модулей безопасна тем же способом. 300мс-паузы между
        // модулями убраны (они были частью именно СЕКВЕНЦИАЛЬНОГО дизайна, сейчас не нужны);
        // стартовая пауза 4000мс перед запуском партии оставлена как есть — не трогаем то, что
        // не спрашивали (даёт видео/текстурам приоритет в первые секунды).
        let _bgDoneCount = 0;
        const _bgModuleDone = (name) => {
            _bgDoneCount++;
            console.log('[game-boot._bgModuleDone] модуль загружен:', name, '(' + _bgDoneCount + '/' + _bgModules.length + ')');
            if(_bgDoneCount >= _bgModules.length){
                _bgAllLoaded = true;
                console.log('[game-boot._bgModuleDone] все', _bgModules.length, 'фоновых модулей загружены (параллельно)');
                _finishLoading();
            }
        };
        setTimeout(() => {
            console.log('[game-boot] запускаю параллельную загрузку', _bgModules.length, 'фоновых модулей');
            _bgModules.forEach(name => {
                if(modules.flags[name]){ _bgModuleDone(name); return; }
                try {
                    modules.checkFlags([name], () => _bgModuleDone(name));
                } catch(e){
                    console.error('[game-boot] ошибка загрузки модуля', name, '— считаем завершённым, чтобы не блокировать остальные:', e);
                    _bgModuleDone(name);
                }
            });
        }, 4000);
    };

    window.loadGame = () => {
        include('libs/pixi-textinput.js');
        const module_list = ['interface', 'home'];
        try{
            modules.checkFlags(module_list, ()=>{ endLoadGame(); });
        } catch (e){
            pre_control.onError({text: "Произошла ошибка при загрузке графона"});
        }
    };
}
