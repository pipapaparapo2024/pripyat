/** Экран топа (Общий топ / Друзья) — общий для вкладок «Топ по авторитету», «Топ по урону»
 * и («Общий топ» внутри «Топ по достижениям»). Данные — top.php (cat: 0=урон, 4=авторитет,
 * 5=achievement_stars), scope: 'all'|'friends' (друзья — тот же window.my_friends, что уже
 * используется для рейтинга друзей по опыту в preloader.js).
 *
 * Координаты сняты пользователем из PSD-макета «достяги.psd» 17.09.2026 — фон панели и кнопки
 * табов, а также позиция первой ячейки списка (ROW_X/первая строка ROW_TOP) — точные; шаг между
 * ячейками — ширина ячейки (36px, см. ячейка.png) + зазор ROW_GAP, как явно указано пользователем
 * (19.09.2026: зазор поднят с 3 до 6px).
 */
export function attachSvodLeaderboard(proto){
    const IMG = './images/';

    const PANEL_X = 284, PANEL_Y = 65, PANEL_W = 851, PANEL_H = 546;
    const SUBTAB_Y = 173;
    const SUBTAB_ALL_X    = 542; // «Общий топ» — общая позиция для всех 3 экранов топа
    // 19.09.2026 (по прямому указанию): раньше x/y правой кнопки высчитывались из ширины/высоты
    // КОНКРЕТНОГО актив-файла для этой вкладки (secondActiveW/H в svod.js) — «друзья» и «мои
    // достижения» из-за этого садились в разные точки. Теперь единая абсолютная точка ЦЕНТРА
    // кнопки для всех трёх экранов (урон/авторитет/достижения), снятая редактором позиций —
    // anchor(0.5,0.5) уже сам центрирует любой ассет вокруг неё независимо от его размера.
    // 22.09.2026: X сдвинут на +12 (789→801) через редактор позиций — по прямому указанию.
    const SUBTAB_SECOND_X = 801, SUBTAB_SECOND_Y = 191;

    const ROW_W = 669, CELL_H = 36, ROW_GAP = 6;
    const ROW_H = CELL_H + ROW_GAP; // шаг между ячейками — высота ячейки + зазор
    const ROW_X = 356;
    const LIST_TOP = 236; // = позиция первой ячейки (ячейка.png), снята из PSD
    const LIST_H   = 242; // = высота дорожки скролла (шкала скрола.png)

    // 19.09.2026 (по прямому указанию) — новая система суб-блоков внутри ячейки: под иконку/
    // место/ник/уровень/значение добавлены отдельные декоративные подложки (файлы присланы
    // пользователем, папка «сводка»). x/y — АБСОЛЮТНЫЕ координаты из редактора позиций
    // Photoshop минус ROW_X/LIST_TOP (перевод в систему координат, относительную ряду — точно
    // так же, как остальные элементы ячейки ниже). w/h — реальный размер PNG (прочитан из
    // IHDR), нужен только для центрирования текста внутри блока (см. centerX ниже) — при
    // изменении текста/языка x пересчитывать вручную не нужно.
    const CELL_BLOCKS = {
        icon:  { file: 'блок под иконку игрока.png',  x: 452 - ROW_X, y: 238 - LIST_TOP, w: 31,  h: 30 },
        place: { file: 'блок под место игрока.png',   x: 372 - ROW_X, y: 239 - LIST_TOP, w: 47,  h: 25 },
        name:  { file: 'блок под никнейм игрока.png', x: 504 - ROW_X, y: 242 - LIST_TOP, w: 106, h: 22 },
        level: { file: 'блок под уровень.png',        x: 774 - ROW_X, y: 243 - LIST_TOP, w: 51,  h: 20 },
        value: { file: 'блок под урон авторитет.png', x: 859 - ROW_X, y: 244 - LIST_TOP, w: 137, h: 18 },
    };
    // Центр блока по X — любой текст, вписываемый в блок, центрируется по горизонтали
    // относительно НЕГО (anchor.x=0.5, x=centerX(...)), а не позиционируется абсолютным числом.
    const centerX = (block) => block.x + block.w / 2;

    proto._buildLeaderboardPanel = function(tabCfg){
        const win = new PIXI.Container();
        win.visible = false;
        // 25.09.2026 (баг найден по прямому указанию — "могу листать колесом, но не могу
        // тащить сам ползунок скролла"): _buildSvodScroll (svod-scroll.js) вешает
        // pointermove/pointerup на `parent` (=win) для перетаскивания бегунка — PIXI
        // доставляет эти события только объектам с interactive=true. win никогда не получал
        // этот флаг (в отличие от bosses_select.js, где тот же паттерн скролла работает именно
        // потому, что там win.interactive=true стоит явно) — колесо мыши работало (слушатель
        // висит прямо на DOM canvas, в обход PIXI), а drag тихо не запускался вообще.
        win.interactive = true;

        const bg = new PIXI.Sprite(PIXI.Texture.from(IMG + tabCfg.bg));
        bg.x = PANEL_X; bg.y = PANEL_Y;
        win.addChild(bg);

        // Только для недельного топа урона: до ближайшего понедельника 00:00 по Москве.
        // Координаты заданы пользователем для блока на вкладке «Топ по урону».
        if(tabCfg.cat === 0){
            const resetTxt = new PIXI.Text('', {
                fontFamily:'Southbank LT', fontSize:18, fill:'#e8d9b8', fontWeight:'bold', align:'center',
            });
            resetTxt.anchor.set(0.5, 0);
            resetTxt.x = 462; resetTxt.y = 496;
            resetTxt.style.fill = '#000000';
            const refreshReset = () => {
                const now = new Date();
                const msk = new Date(now.toLocaleString('en-US', {timeZone:'Europe/Moscow'}));
                const days = (8 - msk.getDay()) % 7 || 7;
                const next = new Date(msk); next.setDate(msk.getDate() + days); next.setHours(0,0,0,0);
                const left = Math.max(0, next.getTime() - msk.getTime());
                const hours = Math.floor(left / 3600000), mins = Math.floor((left % 3600000) / 60000);
                resetTxt.text = 'До сброса: ' + Math.floor(hours / 24) + 'д ' + (hours % 24) + 'ч ' + mins + 'м';
            };
            refreshReset();
            PIXI.Ticker.shared.add(refreshReset);
            win.addChild(resetTxt);
        }

        // 17.09.2026: заголовки МЕСТО/ИГРОК/значение убраны — уже нарисованы в самом фоне
        // панели (tabCfg.bg), самодельный текст поверх них только дублировался (репорт
        // пользователя — "самостоятельно не пиши место, игрок, очки, авторитет").

        // Позиция саб-табов — ЦЕНТР кнопки + anchor(0.5,0.5), тот же принцип, что у главных
        // вкладок (svod.js) — «общий топ»/«друзья»/«мои достижения» актив/пассив разного
        // размера, из-за чего при top-left-анкоре кнопка заметно прыгала при выборе (репорт
        // пользователя). 19.09.2026: «друзья актив.png» дополнительно обрезан от прозрачного
        // поля слева (257×50 → 160×35, вплотную к «друзья неактив.png» 159×35) — anchor уже не
        // обязан был это компенсировать, но избавляет от лишнего доверия к размеру файла.
        const subAll = new PIXI.Sprite(PIXI.Texture.from(IMG + 'общий топ актив.png'));
        subAll.anchor.set(0.5, 0.5);
        subAll.x = SUBTAB_ALL_X + 79; subAll.y = SUBTAB_Y + 17.5; // 158×35 (общий топ актив.png) / 2
        subAll.interactive = true; subAll.buttonMode = true;
        win.addChild(subAll);

        const subSecond = new PIXI.Sprite(PIXI.Texture.from(IMG + tabCfg.secondBtnActive));
        subSecond.anchor.set(0.5, 0.5);
        subSecond.x = SUBTAB_SECOND_X;
        subSecond.y = SUBTAB_SECOND_Y;
        subSecond.interactive = true; subSecond.buttonMode = true;
        win.addChild(subSecond);

        const rowsContainer = new PIXI.Container();
        rowsContainer.x = ROW_X; rowsContainer.y = LIST_TOP;
        win.addChild(rowsContainer);

        // 27.09.2026 (по прямому указанию — «топ по авторитету показывает только 10 человек,
        // листаться должен до 100; с достягами та же херня»): пул ячеек 10 → 100. Сервер
        // отдаёт до 100 строк для cat:4 (авторитет) и cat:5 (достижения) — см. _rowsLimit() в
        // server/core/controllers/top.php; лишние ячейки остаются visible=false и в расчёт
        // высоты скролла не попадают (getTotalH ниже считает только видимые), поэтому у топа
        // урона/друзей, где строк меньше, список визуально не меняется. Пул строится сразу
        // целиком, как CARD_POOL=130 в svod-achievements.js — тот же паттерн одного экрана.
        const ROWS_POOL = 100;
        const rows = [];
        for(let i = 0; i < ROWS_POOL; i++){
            const row = new PIXI.Container();
            row.y = i * ROW_H;
            row.visible = false;
            // 18.09.2026 (по прямому указанию): клик по строке топа открывает профиль этого
            // игрока (персонаж с надетыми шмотками) — row._playerId/_playerNick проставляются
            // при каждом обновлении списка в _loadLeaderboard() ниже.
            // 28.09.2026 (адаптив под мобильные): было row.on('pointerdown', ...) — профиль
            // открывался в момент касания, то есть свайп по списку топа гарантированно улетал
            // в чужой профиль вместо прокрутки. helper.onTap = отпускание без смещения (>10px
            // считается протяжкой, не тапом); interactive/buttonMode выставляет он сам.
            helper.onTap(row, ()=>{ if(row._playerId && window.iface) iface._openPlayerProfile(row._playerId, row._playerNick); });

            const cell = new PIXI.Sprite(PIXI.Texture.from(IMG + 'ячейка.png'));
            row.addChild(cell);

            // Суб-блоки — ПОД содержимым (иконка/тексты добавляются ниже и рисуются поверх).
            Object.values(CELL_BLOCKS).forEach(b => {
                const blockSpr = new PIXI.Sprite(PIXI.Texture.from(IMG + b.file));
                blockSpr.x = b.x; blockSpr.y = b.y;
                row.addChild(blockSpr);
            });

            // Координаты ниже — точный снимок пользователя через редактор позиций (17.09.2026),
            // применены одинаково к каждой строке пула. X теперь = центр блока «место»
            // (см. CELL_BLOCKS выше) — anchor.x=0.5 центрирует число по горизонтали внутри блока.
            const placeTxt = new PIXI.Text('', { fontFamily:'Southbank LT', fontSize:19, fill:'#e8d9b8', fontWeight:'bold' });
            placeTxt.anchor.set(0.5, 0);
            placeTxt.x = centerX(CELL_BLOCKS.place); placeTxt.y = 6;
            row.addChild(placeTxt);

            // 22.09.2026 (баг найден по живому репорту — "иконки игроков вообще не выводятся,
            // ни в одном из 3 топов Сводки"): предыдущий фикс 19.09.2026 убрал avatarMask из
            // display-list ЦЕЛИКОМ (не только row.addChild, а вообще никуда не добавлял),
            // решая проблему "белый квадрат виден поверх аватарки". Но PIXI обновляет
            // worldTransform объекта только если он часть дерева сцены (рекурсивный обход от
            // stage вниз) — у полностью "осиротевшего" avatarMask (без родителя) transform
            // так и оставался единичным (x=0,y=0), а не (AVATAR_X,4), из-за чего маска
            // применялась не там, где аватарка, и вырезала её ЦЕЛИКОМ (0 видимых пикселей).
            // Правильный паттерн — тот же, что уже РАБОТАЕТ в player_profile.js._buildVisitCard
            // (card.addChild(avatarSpr); card.addChild(avatarMask);) — маску ДОБАВЛЯТЬ в сцену
            // (PIXI и так не рендерит объект, пока он активно используется как чей-то .mask,
            // белого квадрата не будет), это и даёт ей нужный обновляемый transform.
            // 22.09.2026 (по прямому указанию, редактор позиций): позиция/размер уточнены
            // (было x=96,y=4,28×28 → x=99,y=4,25×25), плюс небольшое скругление углов —
            // drawRoundedRect вместо drawRect на маске (сама аватарка по-прежнему квадратная
            // текстура, скругляет именно маска).
            const AVATAR_X = 99, AVATAR_Y = 4, AVATAR_SIZE = 25, AVATAR_RADIUS = 5;
            const avatarMask = new PIXI.Graphics();
            avatarMask.beginFill(0xffffff); avatarMask.drawRoundedRect(0, 0, AVATAR_SIZE, AVATAR_SIZE, AVATAR_RADIUS); avatarMask.endFill();
            avatarMask.x = AVATAR_X; avatarMask.y = AVATAR_Y;
            const avatar = new PIXI.Sprite(PIXI.Texture.EMPTY);
            avatar.x = AVATAR_X; avatar.y = AVATAR_Y; avatar.width = AVATAR_SIZE; avatar.height = AVATAR_SIZE;
            avatar.mask = avatarMask;
            row.addChild(avatar);
            row.addChild(avatarMask);

            // 22.09.2026 (повторный репорт тем же днём — по прямому указанию: "не переноси имя
            // на вторую строку, пиши подряд в одной строке"): wordWrap убран — раньше был
            // добавлен как раз чтобы длинный ник не вылезал за блок-подложку (106px, см.
            // CELL_BLOCKS.name) и не налезал на соседнюю колонку "уровень"; теперь имя всегда
            // одной строкой, даже если это означает выход за пределы блока для длинных ников.
            // 25.09.2026 (по прямому указанию — "ники игроков уменьши на их фонт-сайз на 2
            // пикселя"): 15 → 13, общая строка-пул для всех вкладок Сводки (Общий топ/Друзья/
            // Топ по урону/Топ по авторитету/Топ по достижениям — одна и та же функция).
            const nameTxt = new PIXI.Text('', {
                fontFamily:'Southbank LT', fontSize:12, fill:'#ffffff',
                align:'center',
            });
            nameTxt.anchor.set(0.5, 0);
            nameTxt.x = centerX(CELL_BLOCKS.name); nameTxt.y = 10;
            row.addChild(nameTxt);

            // «Уровень» — центр блока «уровень» (см. CELL_BLOCKS). Цвет/шрифт — редактор позиций
            // 19.09.2026 (было ОЦЕНКОЙ по заголовку «УРОВЕНЬ» в фоне панели — #c9a877/436,9).
            const levelTxt = new PIXI.Text('', { fontFamily:'Southbank LT', fontSize:15, fill:'#ffffff' });
            levelTxt.anchor.set(0.5, 0);
            levelTxt.x = centerX(CELL_BLOCKS.level); levelTxt.y = 11;
            row.addChild(levelTxt);

            // Значение (урон/авторитет/очки достижений) — раньше было право-выровнено (anchor 1,0)
            // у правого края ячейки; теперь центрируется в своём блоке «урон авторитет».
            const valTxt = new PIXI.Text('', { fontFamily:'Southbank LT', fontSize:16, fill:'#ffcc44', fontWeight:'bold' });
            valTxt.anchor.set(0.5, 0);
            valTxt.x = centerX(CELL_BLOCKS.value); valTxt.y = 9; valTxt.scale.set(1.000);
            row.addChild(valTxt);

            rowsContainer.addChild(row);
            rows.push({ row, placeTxt, avatar, avatarMask, nameTxt, levelTxt, valTxt });
        }

        // 23.09.2026 (по прямому указанию, репорт "стрелка вниз не отображается", координаты
        // X:1034 Y:480 сняты пользователем): arrowX сдвинут с 1033 на 1034, arrowDownY задан
        // явно вместо формулы viewY+viewH+2 (которая давала 480) — см. коммент в svod-scroll.js.
        const scroll = this._buildSvodScroll({
            parent: win,
            contentContainer: rowsContainer,
            viewX: ROW_X, viewY: LIST_TOP, viewW: ROW_W, viewH: LIST_H,
            trackX: 1035, arrowX: 1034, arrowDownY: 480,
            stepPx: ROW_H,
            getTotalH: () => rows.filter(r => r.row.visible).length * ROW_H,
        });

        // «Второй саб-таб» — либо ещё один scope этого же топа (Друзья), либо у вкладки «Топ
        // по достижениям» это вообще ДРУГАЯ панель (Мои достижения) — тогда tabCfg.onSecondTab
        // решает, что показать, а сам топ ничего не грузит и не подсвечивается как активный.
        const setActiveVisual = (isSecond) => {
            subAll.texture    = PIXI.Texture.from(IMG + (!isSecond ? 'общий топ актив.png'   : 'общий топ неактив.png'));
            subSecond.texture = PIXI.Texture.from(IMG + (isSecond  ? tabCfg.secondBtnActive  : tabCfg.secondBtnPassive));
        };
        const setScope = (s) => {
            setActiveVisual(s !== 'all');
            this._loadLeaderboard(tabCfg, s, rows, scroll);
        };
        subAll.on('pointerdown', ()=> setScope('all'));
        subSecond.on('pointerdown', ()=>{
            if(typeof tabCfg.onSecondTab === 'function'){
                setActiveVisual(true);
                rows.forEach(r => { r.row.visible = false; });
                tabCfg.onSecondTab();
                return;
            }
            // Launch-token существует почти всегда, но не содержит friends-scope после новой
            // сессии. Поэтому проверяем не факт существования VK_token, а реальный успешный
            // результат friends.get/getAppUsers. Запрос Bridge — только после клика игрока.
            if(tabCfg.secondScope === 'friends' && !window._friendsScopeReady){
                const refreshFriends = () => setScope('friends');
                window.addEventListener('pripyat:friends-connected', refreshFriends, {once:true});
                if(window.pre_control && typeof pre_control._showFriendsScopePrompt === 'function'){
                    pre_control._showFriendsScopePrompt({force:true, reconnect:true});
                }
                return;
            }
            setScope(tabCfg.secondScope);
        });

        win._svodDefaultScope = () => { setActiveVisual(false); setScope('all'); };
        return win;
    };

    // Та же формула, что interface.js.updateNick() — не дублируем расчёт на сервере, exp
    // приходит сырым из top.get (см. server/core/controllers/top.php).
    const levelFromExp = (exp) => Math.max(0, Math.floor((-1 + Math.sqrt(1 + exp / 5)) / 2));

    proto._loadLeaderboard = function(tabCfg, scope, rows, scroll){
        if(!window.TS) return;
        const params = { cat: tabCfg.cat, scope };
        if(scope === 'friends') params.friends = window.my_friends || '';
        TS.php('top.get', params, (res)=>{
            const list = (res && Array.isArray(res.rows)) ? res.rows : [];
            console.log('[svod.leaderboard] top.get cat='+tabCfg.cat+' scope='+scope+' → строк:', list.length);
            rows.forEach(r => { r.row.visible = false; r.row._playerId = null; r.row._playerNick = null; });
            // 27.09.2026: со 100 строками список реально длинный — если игрок пролистал вниз до
            // ~80 места, а потом переключил вкладку/scope или заново открыл Сводку (см.
            // svod.js.open → _svodDefaultScope), прежняя позиция скролла сохранялась и новый
            // список открывался с середины без видимой причины. Каждая загрузка данных начинается
            // сверху, с 1 места.
            if(scroll && typeof scroll.scrollToTop === 'function') scroll.scrollToTop();

            if(window.bosses && typeof bosses._resolveVkUsers === 'function'){
                bosses._resolveVkUsers(list.map(r=>r.id), (users)=>{
                    list.forEach((entry, i) => {
                        const r = rows[i];
                        if(!r) return;
                        const u = users[String(entry.id)];
                        r.row.visible = true;
                        r.placeTxt.text = String(i + 1);
                        // Игровой ник (entry.nick, с сервера) — приоритет над именем VK, по
                        // прямому указанию 17.09.2026 показываем везде именно его.
                        // 21.09.2026 (баг найден, по прямому указанию: "у одного игрока имя
                        // сломано/пустое") — .trim() на КАЖДОМ варианте: ник из одних пробелов
                        // (или пустая строка после подрезки) раньше проходил как "истинный" (не
                        // пустая строка технически) и давал ВИДИМО пустую ячейку вместо явного
                        // резервного варианта ("ID N").
                        r.nameTxt.text = (entry.nick && entry.nick.trim()) || (u && u.name && u.name.trim()) || ('ID ' + entry.id);
                        r.levelTxt.text = String(levelFromExp(entry.exp || 0));
                        r.valTxt.text  = Number(entry.value || 0).toLocaleString('ru');
                        if(u && u.photo) r.avatar.texture = PIXI.Texture.from(u.photo);
                        else r.avatar.texture = PIXI.Texture.EMPTY;
                        r.row._playerId = entry.id;
                        r.row._playerNick = entry.nick || (u && u.name) || null;
                    });
                    if(scroll) scroll.refresh();
                });
            } else {
                list.forEach((entry, i) => {
                    const r = rows[i];
                    if(!r) return;
                    r.row.visible = true;
                    r.placeTxt.text = String(i + 1);
                    r.nameTxt.text = entry.nick || ('ID ' + entry.id);
                    r.levelTxt.text = String(levelFromExp(entry.exp || 0));
                    r.valTxt.text  = Number(entry.value || 0).toLocaleString('ru');
                    r.row._playerId = entry.id;
                    r.row._playerNick = entry.nick || null;
                });
                if(scroll) scroll.refresh();
            }
        }, (e)=>{ console.error('[svod.leaderboard] ошибка top.get:', e); });
    };
}
