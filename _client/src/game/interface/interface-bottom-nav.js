/** Нижний HUD — полная замена визуала (6 новых кнопок поверх старой FLA-панели).
 *
 * 17.10.2026 (по прямому указанию — отказ от сигарет, заодно редизайн нижнего HUD): старая
 * панель (`this.down`, FLA-объект `interface_elements.min.js`, правило №2 AGENTS.md запрещает
 * её редактировать) рисует все 6 иконок ОДНОЙ запечённой в атлас текстурой фона
 * (`interface_down_panel_bg`) — поверх неё нельзя просто переставить новые спрайты на других
 * координатах, старые иконки останутся видны в старых местах. Решение: НЕ трогаем `this.down`
 * (хитбоксы `butt_*` там по-прежнему существуют, только `interactive=false` — на случай, если
 * где-то в коде на них всё ещё ссылаются по имени), а поверх неё (добавлена в layer1_mc позже
 * => рендерится выше) строим новый непрозрачный тёмный фон + 6 новых кнопок-спрайтов (в самой
 * картинке уже есть и иконка, и подпись — отдельный PIXI.Text не нужен).
 *
 * Координаты — абсолютные (канвас 1280×720), anchor(0.5,0.5) — как продиктовано пользователем
 * через позиционный обзор макета (та же конвенция, что и везде в проекте для таких снимков).
 *
 * Обработчики кликов — скопированы 1:1 из interface-panels.js.initButtons() (butt_bosses/
 * butt_zone/butt_weapons/butt_shmot/butt_vassilich), не переизобретены — см. комментарии там же
 * для истории багов, которые эта логика уже чинила (загрузка bosses._loadFromUdata() до клика,
 * restoreHud() и т.д.).
 */
export function attachBottomNav(proto){

    const BASE = './images/';

    proto._buildBottomNav = function(){
        if(this._bottomNavBuilt) return;
        this._bottomNavBuilt = true;

        // Старые хитбоксы — глушим (они больше не нужны, новые кнопки их дублируют), но не
        // удаляем сам FLA-объект.
        ['butt_bosses', 'butt_zone', 'butt_weapons', 'butt_shmot', 'butt_vassilich', 'butt_gangs'].forEach(k => {
            if(this.down[k]) this.down[k].interactive = false;
        });

        const nav = new PIXI.Container();

        // 18.10.2026 (по прямому указанию — "эту подложку нужно убрать", пользователь поднял
        // кнопки через редактор позиций и показал тёмный прямоугольник под ними): раньше здесь
        // стоял непрозрачный тёмный фон на всю область нижнего HUD — он был нужен, чтобы
        // перекрыть старую запечённую в атлас FLA-подложку панели (interface_down_panel_bg),
        // которую тогда ещё не умели убирать точечно. С 18.10.2026 эту подложку уже реально
        // удаляет _removeStrayAtlasArt(this.down) (см. interface.js, вызывается в downInit()
        // ДО _buildBottomNav()) — рекурсивным поиском по размеру текстуры в атласе, а не грубой
        // закраской прямоугольником. Сама закраска стала лишней и давала собственный видимый
        // тёмный прямоугольник внизу экрана (то, что пользователь описывал как "серый
        // прямоугольник снизу") — убрана, кнопки лежат прямо на фоне комнаты/сцены.

        // 18.10.2026 (ЧЕТВЁРТОЕ указание тем же днём — точный снимок позиционного редактора для
        // всех 6 кнопок разом, x/y/scale): заменяет весь предыдущий накопленный расчёт
        // (+17/+10 и индивидуальные сдвиги) на абсолютные числа из снимка. Порядок слева направо
        // сменился — "банда" и "боссы" поменялись местами относительно предыдущей раскладки.
        const BTN = [
            { key: 'sidorovich', file: 'нижний худ кнопка сидорович.png', x: 98,   y: 662, scale: 1.016, handler: () => this._navSidorovichClick() },
            { key: 'banda',      file: 'нижний худ кнопка банда.png',     x: 293,  y: 664, scale: 1.066, clickable: false },
            { key: 'bosses',     file: 'нижний худ кнопка боссы.png',     x: 511,  y: 665, scale: 1.067, handler: () => this._navBossesClick() },
            { key: 'shmotki',    file: 'нижний худ кнопка шмотки.png',    x: 728,  y: 663, scale: 1.021, handler: () => this.openModule('shmot') },
            { key: 'oruzheika',  file: 'нижний худ кнопка оружейка.png',  x: 947,  y: 664, scale: 1.025, handler: () => this.openModule('weapons') },
            { key: 'zone',       file: 'нижний худ кнопка зона.png',      x: 1163, y: 663, scale: 1.031, handler: () => this._openZoneScreen() },
        ];

        const sprites = {};
        BTN.forEach(b => {
            const spr = new PIXI.Sprite(PIXI.Texture.from(BASE + b.file));
            spr.anchor.set(0.5, 0.5);
            spr.x = b.x; spr.y = b.y;
            spr.scale.set(b.scale);
            nav.addChild(spr);
            sprites[b.key] = spr;
            if(b.clickable === false) return;
            spr.interactive = true; spr.buttonMode = true;
            if(window.isMobile) helper.touchPad(spr);
            // 18.10.2026 (по прямому указанию — "кнопки нижнего худа вообще не должны расти при
            // наведении, только лёгкая прозрачность"): _addHoverGlow (масштаб) заменён на
            // _addHoverAlpha — без роста/смещения, только alpha.
            if(typeof this._addHoverAlpha === 'function') this._addHoverAlpha(spr);
            spr.on('pointerdown', b.handler);
        });

        // Плашка "СКОРО" поверх кнопки "Банда" — существующий файл (interface-panels.js:98),
        // просто центрируем над новой позицией кнопки (старые локальные координаты были
        // привязаны к `this.down`, которая здесь больше не используется для раскладки).
        const soonBadge = new PIXI.Sprite(PIXI.Texture.from(BASE + 'скоро банда.png'));
        soonBadge.anchor.set(0.5, 0.5);
        soonBadge.x = sprites.banda.x;
        soonBadge.y = sprites.banda.y;
        nav.addChild(soonBadge);
        this._bottomNavSoonBadge = soonBadge;

        // 18.10.2026 (по прямому указанию — "fla объект удаляй, может в этом проблема
        // существования этого прямоугольника снизу"): _removeStrayAtlasArt(this.down) в
        // downInit() угадывает старую фоновую подложку ТОЛЬКО по двум заранее известным
        // размерам (1280×158/1306×73) — если в FLA-экспорте есть ЕЩЁ какой-то безымянный
        // визуальный мусор другого размера, этот точечный фикс его не увидит и не уберёт.
        // Надёжнее не гадать размеры — прячем ВСЁ, что уже есть внутри this.down (целиком
        // старый FLA-результат), кроме самого nav, который добавляем сразу следом. Хитбоксы
        // (butt_*) не теряются — PIXI.animate-кнопки без текстуры не рисуют ничего сами по
        // себе, а их клики уже отключены (interactive=false) строкой выше.
        [...this.down.children].forEach(c => { c.visible = false; });

        // Кладём новый блок ДОЧЕРНИМ элементом `this.down`, а не отдельно в layer1_mc — иначе
        // restoreHud() (прячет/показывает/перекладывает `this.down` между слоями для разных
        // экранов) не будет знать о новом блоке, и он останется висеть поверх любого попапа,
        // который должен скрывать нижний HUD. `this.down.y` уже выставлен в downInit() (=596) —
        // компенсируем его здесь, чтобы координаты кнопок выше остались абсолютными canvas-
        // координатами, как продиктовано, а не локальными относительно `this.down`.
        nav.y = -this.down.y;
        this.down.addChild(nav);
        this._bottomNav = nav;
    };

    proto._navBossesClick = function(){
        if(this._bossWin && this._bossWin.visible){ this._closeAllPanels(); return; }
        // Нижняя кнопка может быть нажата раньше, чем состояние Bosses успело восстановиться
        // из udata после загрузки VK iframe — без этой строки _openBossesPopup() видел нулевой
        // bossStartMs и показывал выбор боссов (см. interface-panels.js, тот же комментарий).
        if(window.bosses && typeof bosses._loadFromUdata === 'function') bosses._loadFromUdata();
        this._compassShow();
        this._closeAllPanels();
        this._openBossesPopup();
    };

    proto._navSidorovichClick = function(){
        if(this._sidWin && this._sidWin.visible){ this._closeAllPanels(); return; }
        this._closeAllPanels();
        this._openSidorovichPopup();
    };
}
