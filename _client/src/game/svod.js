import { attachSvodScroll }       from './svod/svod-scroll.js';
import { attachSvodLeaderboard }  from './svod/svod-leaderboard.js';
import { attachSvodAchievements } from './svod/svod-achievements.js';
import { attachSvodNews }         from './svod/svod-news.js';

/** Сводка (17.09.2026) — ПОЛНОСТЬЮ заменяет старое содержимое (Статистика/Достижения/Звания
 * из FLA-экрана mc.svod_win) на 4 новых вкладки: Новости, Топ по авторитету, Топ по урону,
 * Топ по достижениям — по прямому указанию пользователя. Экран строится с нуля на чистом
 * PIXI, без зависимости от FLA-заготовки (тот же паттерн, что habar.js — "Pre-construct:
 * PIXI-based, no FLA needed"), поэтому конструктор принимает mc для совместимости с
 * module_control.js, но не использует его.
 *
 * Координаты — из PSD-макета «достяги.psd», снятого пользователем 17.09.2026 (см. комментарии
 * в svod/svod-leaderboard.js и svod/svod-achievements.js). Фон и кнопки — точные, внутренняя
 * раскладка списков — расчётная (доводить редактором позиций при необходимости).
 */
export default class Svod{
    constructor(mc){
        this.mc = mc; // не используется — экран строится без FLA, см. комментарий выше
        this._pixiWin = null;
        this.currentTab = null;
    }

    _buildPixiWin(){
        const IMG = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const bg = new PIXI.Sprite(PIXI.Texture.from(IMG + 'сводка фон.png'));
        bg.x = -3; bg.y = 72;
        win.addChild(bg);

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + 'выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1240; exitBtn.y = 83;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ exitBtn.alpha = 0.75; });
        exitBtn.on('pointerout',  ()=>{ exitBtn.alpha = 1; });
        exitBtn.on('pointerdown', ()=>this.close());
        win.addChild(exitBtn);

        // Главные вкладки — координаты из PSD, каждая: активная/пассивная текстура.
        // 17.09.2026: x/y раньше были top-left для НЕ-анкоренного спрайта (anchor 0,0) — работало
        // для news/respect, т.к. их актив/пассив картинки почти одного размера (разница в
        // единицы px), но у damage (155×78 vs 154×69) и особенно у ach (актив 154×66, пассив
        // 154×153 — почти вдвое выше!) разный размер актив/пассив при общем top-left двигал
        // видимую кнопку («отлетает вниз» при пассивном состоянии — репорт пользователя).
        // Теперь x/y — ЦЕНТР кнопки (computed из старого top-left + половина размера АКТИВНОЙ
        // картинки, снятой пользователем) + anchor(0.5,0.5) — актив и пассив центрируются в
        // одной точке независимо от собственного размера каждой картинки.
        // activeDy/passiveDy — точечные поправки по Y для отдельных состояний (снято через
        // редактор позиций 19.09.2026): у "ach" активная и пассивная картинки различаются по
        // высоте почти вдвое (154×66 vs 154×153), поэтому даже после anchor-центрирования
        // (см. комментарий выше) потребовалась независимая докрутка каждого состояния — у
        // "respect"/"damage" пользователь снял поправку только для активного состояния.
        const MAIN_TABS = [
            { key:'news',   activeImg:'новости актив.png',                passiveImg:'новости пассив.png',                x:200,   y:206   },
            { key:'respect',activeImg:'кнопка топ по авторитету актив.png',passiveImg:'кнопка топ по авторитету пассив.png',x:199.5, y:273.5, activeDy:-2 },
            { key:'damage', activeImg:'кнопка топ по урону актив.png',     passiveImg:'кнопка топ по урону пассив.png',     x:197.5, y:337,   activeDy:-4 },
            { key:'ach',    activeImg:'кнопка топ по достижениям актив.png',passiveImg:'кнопка топ по достижения пассив.png',x:201,   y:414,   activeDy:-10, passiveDy:-9 },
        ];

        const tabSprites = {};
        MAIN_TABS.forEach(t => {
            const spr = new PIXI.Sprite(PIXI.Texture.from(IMG + t.passiveImg));
            spr.anchor.set(0.5, 0.5);
            spr.x = t.x; spr.y = t.y + (t.passiveDy || 0);
            spr.interactive = true; spr.buttonMode = true;
            spr.on('pointerdown', ()=>this._selectMainTab(t.key));
            win.addChild(spr);
            tabSprites[t.key] = spr;
        });
        this._svodTabSprites = tabSprites;
        this._svodMainTabs = MAIN_TABS;

        // Панели — строятся лениво при первом переключении на вкладку (см. _selectMainTab).
        this._svodPanels = {};
        this._pixiWin = win;
        return win;
    }

    _ensurePanel(key){
        if(this._svodPanels[key]) return this._svodPanels[key];

        let panel;
        if(key === 'news'){
            panel = this._buildNewsPanel();
        } else if(key === 'respect'){
            panel = this._buildLeaderboardPanel({
                cat: 4, bg: 'задний фон топы по авторитету.png', valueLabel: 'АВТОРИТЕТ',
                secondScope: 'friends', secondBtnActive: 'друзья актив.png', secondBtnPassive: 'друзья неактив.png',
            });
        } else if(key === 'damage'){
            panel = this._buildLeaderboardPanel({
                cat: 0, bg: 'задний фон топы по урону.png', valueLabel: 'УРОН',
                secondScope: 'friends', secondBtnActive: 'друзья актив.png', secondBtnPassive: 'друзья неактив.png',
            });
        } else if(key === 'ach'){
            // «Топ по достижениям»: два саб-таба — Общий топ (лидерборд по achievement_stars,
            // та же панель, что у урона/авторитета) и Мои достижения (СОВСЕМ другая панель —
            // см. onSecondTab ниже, переключает видимость между ними внутри win).
            // 19.09.2026 (по прямому указанию): у "Топ по достижениям" раньше не было своего
            // фона — переиспользовался фон "Топ по авторитету" временно. Теперь есть выделенный
            // файл, используется тот же паттерн (фон + переиспользуемая "ячейка.png"), что и
            // у урона/авторитета — см. _buildLeaderboardPanel в svod-leaderboard.js.
            // 21.09.2026 (баг найден, по прямому указанию: "кнопки Общий топ/Мои достижения
            // пропали при открытии Мои достижения") — эти кнопки физически лежат ВНУТРИ окна
            // лидерборда (panel), а переключение на achPanel прятало panel ЦЕЛИКОМ (включая
            // сами кнопки) — обратно на лидерборд стало нечем переключиться. Фикс: achPanel
            // получает СВОИ собственные копии тех же двух кнопок (см. svod-achievements.js),
            // а не полагается на кнопки соседней панели, которая в этот момент скрыта.
            const achPanel = this._buildMyAchievementsPanel({
                bgFile: 'задний фон топы по достижения.png',
                secondBtnActive: 'мои достижения актив.png', secondBtnPassive: 'мои достижения пассив.png',
                onSwitchToGeneral: () => {
                    achPanel.visible = false;
                    panel.visible = true;
                    if(typeof panel._svodDefaultScope === 'function') panel._svodDefaultScope();
                },
            });
            panel = this._buildLeaderboardPanel({
                cat: 5, bg: 'задний фон топы по достижения.png', valueLabel: 'ОЧКИ',
                secondBtnActive: 'мои достижения актив.png', secondBtnPassive: 'мои достижения пассив.png',
                onSecondTab: () => {
                    panel.visible = false;
                    achPanel.visible = true;
                    achPanel._svodRefreshAchievements();
                },
            });
            // Обратный переход (Общий топ) должен снова прятать панель достижений и показывать топ.
            panel._svodAchPanel = achPanel;
            this._pixiWin.addChild(achPanel);
        }

        this._pixiWin.addChild(panel);
        this._svodPanels[key] = panel;
        return panel;
    }

    _selectMainTab(key){
        if(this.currentTab === key) return;
        this.currentTab = key;

        this._svodMainTabs.forEach(t => {
            const spr = this._svodTabSprites[t.key];
            const isActive = t.key === key;
            spr.texture = PIXI.Texture.from('./images/' + (isActive ? t.activeImg : t.passiveImg));
            spr.y = t.y + (isActive ? (t.activeDy || 0) : (t.passiveDy || 0));
        });

        Object.keys(this._svodPanels).forEach(k => {
            this._svodPanels[k].visible = false;
            if(this._svodPanels[k]._svodAchPanel) this._svodPanels[k]._svodAchPanel.visible = false;
        });

        const panel = this._ensurePanel(key);
        panel.visible = true;
        if(typeof panel._svodDefaultScope === 'function') panel._svodDefaultScope();
    }

    // 04.10.2026 (по прямому указанию, скриншот — "достижения выполнены, но звёздочка не
    // фулл и не написано кол-во очков"): прогресс-бар карточки достижения считается от live
    // udata на клиенте (моментально показывает 100%), а звезда/очки/галочка — от
    // window.achievements.earned, который обновляется ТОЛЬКО после ответа сервера
    // (achievements.sync, см. achievements.js._syncWithServer()). Если экран "Мои достижения"
    // уже был открыт в момент, когда этот ответ приходит, он не перерисовывается сам — остаётся
    // с устаревшей earned-картой до закрытия/повторного открытия вкладки. Вызывается из
    // achievements.js сразу после применения патча — обновляет экран, только если он сейчас
    // реально виден (панель ещё не построена/не на экране — no-op).
    refreshOpenAchievements(){
        const achPanel = this._svodPanels && this._svodPanels['ach'] && this._svodPanels['ach']._svodAchPanel;
        if(achPanel && achPanel.visible && typeof achPanel._svodRefreshAchievements === 'function'){
            achPanel._svodRefreshAchievements();
        }
    }

    open(){
        if(!this._pixiWin) this._buildPixiWin();
        root.layer2_mc.addChild(this._pixiWin);
        if(this.currentTab === null){
            this._selectMainTab('news');
        } else {
            // 24.09.2026 (по прямому указанию — "поменял ник, зашёл в Сводку, топ по урону
            // показывает старый ник"): _selectMainTab() рано выходит, если currentTab не
            // изменился (`if(this.currentTab === key) return;`) — повторное открытие Сводки на
            // ТОЙ ЖЕ вкладке (без переключения на другую и обратно) никогда не перезапрашивало
            // данные заново, показывая то, что было загружено при самом первом заходе на неё за
            // эту игровую сессию. Здесь принудительно обновляем то, что реально сейчас видно.
            const panel = this._svodPanels[this.currentTab];
            if(panel){
                if(panel.visible && typeof panel._svodDefaultScope === 'function') panel._svodDefaultScope();
                if(panel._svodAchPanel && panel._svodAchPanel.visible
                    && typeof panel._svodAchPanel._svodRefreshAchievements === 'function'){
                    panel._svodAchPanel._svodRefreshAchievements();
                }
            }
        }
        // 29.09.2026 (тот же класс бага, что в shmot_shop.js/dvor.js — см. коммент в
        // shmot_shop.js._openShmotShop): Свод не заявлял свою потребность в декларативный
        // ХУД-стек, наследуя чужую настройку от экрана под ним при открытии через нестандартный
        // путь. close() при этом вообще не трогал ХУД — если Свод открыт поверх экрана,
        // прячущего низ (например боя с боссом), закрытие Свода оставляло низ скрытым навечно.
        if(window.iface) iface.pushHud('svod', {});
    }

    close(){
        if(this._pixiWin && this._pixiWin.parent) this._pixiWin.parent.removeChild(this._pixiWin);
        if(window.iface) iface.popHud('svod');
    }
}

attachSvodScroll(Svod.prototype);
attachSvodLeaderboard(Svod.prototype);
attachSvodAchievements(Svod.prototype);
attachSvodNews(Svod.prototype);
