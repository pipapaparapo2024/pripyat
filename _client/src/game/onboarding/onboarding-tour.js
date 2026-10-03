/** Фаза "тур по вкладкам" (30.09.2026, по прямому указанию) — рука-указатель с пульсирующим
 * кольцом поверх нужной кнопки HUD, весь остальной экран затемнён и некликабелен, кликабельна
 * только эта одна кнопка. Клик открывает реальный экран штатно (TOUR_TABS[].open()) и включает
 * закадровую озвучку; переход к следующему шагу — ТОЛЬКО когда игрок сам вышел в главное меню
 * (см. _hookScreenClose ниже) — окончание озвучки само по себе шаг не продвигает (01.10.2026).
 */
import { TOUR_TABS } from './onboarding-data.js';

const HAND_FILE = './images/рука указатель.png';
const HIT_SIZE = 90; // радиус кликабельной зоны вокруг руки — с запасом под неточные координаты

export function attachOnboardingTour(Onboarding){
    Onboarding.prototype._startTourStep = function(key){
        const tab = TOUR_TABS.find(t => t.key === key);
        if(!tab){
            console.error('[onboarding._startTourStep] неизвестный шаг тура: ' + key);
            return;
        }
        this._activeTourKey = key;
        this._touchOnboardingActivity();
        this._buildTourOverlay(tab);
        console.log('[onboarding._startTourStep] шаг=' + key + ' | target x=' + tab.target.x + ' y=' + tab.target.y);
    };

    Onboarding.prototype._buildTourOverlay = function(tab){
        this._destroyTourOverlay();

        const win = new PIXI.Container();
        const target = tab.target;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.6);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true; // глотает клики по всему, кроме зоны ниже
        win.addChild(blocker);

        // Пульсирующее кольцо — белая точка в центре + расширяющееся кольцо вокруг, по
        // присланному примеру ("центральная точка белая и вокруг ещё белая линия кружок").
        // Садится на target (реальная HUD-кнопка), не на позицию спрайта руки — они теперь
        // независимы (см. hand ниже).
        const pulse = new PIXI.Graphics();
        win.addChild(pulse);

        // Кликабельная зона — HIT_SIZE вокруг target. Объявлена здесь (без начальной отрисовки),
        // перерисовывается вместе с пульсом в pulseTick ниже, чтобы следовать за target, если
        // его подвинули маркером через редактор позиций (см. marker ниже) — без пересборки шага.
        const hit = new PIXI.Graphics();
        hit.interactive = true; hit.buttonMode = true;

        let pulseT = 0;
        const pulseTick = () => {
            pulseT += 0.04;
            const phase = pulseT % 1;
            pulse.clear();
            pulse.beginFill(0xffffff, 1);
            pulse.drawCircle(target.x, target.y, 5);
            pulse.endFill();
            pulse.lineStyle(2, 0xffffff, 1 - phase);
            pulse.drawCircle(target.x, target.y, 8 + phase * 26);

            hit.clear();
            hit.beginFill(0xffffff, 0.001);
            hit.drawCircle(target.x, target.y, HIT_SIZE);
            hit.endFill();
        };
        pulseTick();
        PIXI.Ticker.shared.add(pulseTick);
        this._tourPulseTick = pulseTick;

        // 30.09.2026, по прямому указанию (живой тест) — рука и target разведены: рука может
        // стоять в стороне от кнопки и быть повёрнута так, чтобы кончиком указывать на target
        // (см. tab.hand в onboarding-data.js, снимается "📋 СУПЕР КОПИРОВАТЬ" прямо с руки на
        // экране). Пока для шага явно не задан tab.hand — старый дефолт (над target, без
        // поворота) сохранён как фолбэк.
        const h = tab.hand || { x: target.x, y: target.y + 10, scale: 1, rot: 0 };
        const hand = new PIXI.Sprite(PIXI.Texture.from(HAND_FILE));
        hand.anchor.set(0.5, 0);
        hand.x = h.x; hand.y = h.y;
        hand.scale.set(h.scale != null ? h.scale : 1);
        hand.rotation = (h.rot || 0) * Math.PI / 180;
        win.addChild(hand);

        hit.on('pointerdown', () => {
            console.log('[onboarding tour] клик по подсвеченной вкладке: ' + tab.key);
            this._destroyTourOverlay();
            this._touchOnboardingActivity();
            tab.open();
            if(tab.key === 'dvor' && window.dvor && typeof dvor._setTutorialCloudHighlight === 'function'){
                dvor._setTutorialCloudHighlight(true);
            }
            this._playNarration(tab.sound);
        });
        win.addChild(hit);

        // 30.09.2026, по прямому указанию ("сделай так, чтобы я мог эту пульсацию передвигать
        // через редактор") — невидимый маркер поверх target, специально для
        // universal_pos_editor.js: Sprite/Text он подхватывает сам, для Graphics нужен явный
        // флаг _uDraggable. Двигая маркер редактором (drag/стрелки/PageUp-Down), _uOnTransform
        // переписывает tab.target.x/y НАПРЯМУЮ (тот же объект, что читает pulseTick выше) —
        // пульс и кликабельная зона едут следом уже на следующем кадре, без пересборки шага.
        // interactive НЕ ставим — editor ловит _uDraggable-объекты своим хит-тестом независимо
        // от PIXI interactive, а обычный клик игрока по этой точке не должен ничего перехватывать
        // (клик по вкладке ловит hit выше, с гораздо большим радиусом).
        const marker = new PIXI.Graphics();
        marker.beginFill(0xffffff, 0.001);
        marker.drawCircle(0, 0, 14);
        marker.endFill();
        marker.x = target.x; marker.y = target.y;
        marker._uDraggable = true;
        marker._uOnTransform = () => {
            target.x = Math.round(marker.x);
            target.y = Math.round(marker.y);
            console.log('[onboarding tour] target шага "' + tab.key + '" сдвинут редактором: x=' + target.x + ' y=' + target.y);
        };
        win.addChild(marker);
        this._tourTargetMarker = marker;

        root.layer2_mc.addChild(win);
        this._tourWin = win;

        // 30.09.2026 (по прямому указанию — "рука должна быть выше по z-index чем верхний и
        // нижний ХУД"; баг найден в паре с этим — "кроме подсвеченной вкладки кликаются и
        // другие"): interface.restoreHud() (interface.js) добавляет iface.up/iface.down в
        // ЭТОТ ЖЕ layer2_mc при любом стороннем pushHud/popHud, ПОСЛЕ того как win уже
        // добавлен — addChild переносит существующего ребёнка в конец списка (=выше по
        // z-order), так HUD мог перекрыть оверлей и разблокировать себя визуально. Тикер
        // каждый кадр возвращает win в конец списка — тот же приём, что уже используется для
        // кнопки редактора позиций (universal_pos_editor.js._ensureEditButton).
        const _keepOnTop = () => { if(win.parent) win.parent.addChild(win); };
        PIXI.Ticker.shared.add(_keepOnTop);
        this._tourKeepOnTopTick = _keepOnTop;

        // Второй, независимый барьер (не полагаемся только на z-order выше) — ХУД физически
        // не реагирует на клики, пока идёт тур, вообще ни при какой перестановке слоёв.
        if(window.iface){
            if(iface.up)   iface.up.interactiveChildren = false;
            if(iface.down) iface.down.interactiveChildren = false;
            if(iface._pngRightPanel) iface._pngRightPanel.interactiveChildren = false;
        }
    };

    Onboarding.prototype._destroyTourOverlay = function(){
        if(this._tourPulseTick){ PIXI.Ticker.shared.remove(this._tourPulseTick); this._tourPulseTick = null; }
        if(this._tourKeepOnTopTick){ PIXI.Ticker.shared.remove(this._tourKeepOnTopTick); this._tourKeepOnTopTick = null; }
        if(this._tourWin && this._tourWin.parent) this._tourWin.parent.removeChild(this._tourWin);
        this._tourWin = null;
        this._tourTargetMarker = null;
        if(window.iface){
            if(iface.up)   iface.up.interactiveChildren = true;
            if(iface.down) iface.down.interactiveChildren = true;
            if(iface._pngRightPanel) iface._pngRightPanel.interactiveChildren = true;
        }
    };

    // Вызывается ТОЛЬКО из хука popHud/hata.close (см. _hookScreenClose ниже) — окончание
    // озвучки само по себе сюда не ведёт (01.10.2026). Идемпотентно — повторный вызов для
    // уже пройденного шага ничего не делает.
    Onboarding.prototype._advanceTour = function(fromKey){
        if(this._activeTourKey !== fromKey) return; // уже продвинулись другим путём
        this._activeTourKey = null;
        if(fromKey === 'dvor' && window.dvor && typeof dvor._setTutorialCloudHighlight === 'function'){
            dvor._setTutorialCloudHighlight(false);
        }
        this._stopNarration();
        const idx = TOUR_TABS.findIndex(t => t.key === fromKey);
        const next = TOUR_TABS[idx + 1];
        if(next){
            this._setStep(next.key);
            this._startTourStep(next.key);
        } else {
            // Сидорович (последний шаг тура) пройден — переходим к попапу про валюту.
            this._setStep('currency');
            this._showPopup('currency');
        }
    };

    // 30.09.2026 (баг найден по живому тесту — "на вкладке зона зависло всё, аудио не
    // выключается при выходе, порядок шагов будто перепутан"): раньше единственной точкой
    // хука был iface._closeAllPanels() — но он вызывается ТОЛЬКО при переключении вкладки
    // (openModule()) или изнутри некоторых экранов; У СОБСТВЕННОЙ кнопки выхода зоны
    // (zone_screen.js exitBtn) он вообще не в цепочке — она сама вызывает
    // this.popHud('zone') напрямую, а значит тур никогда не узнавал о закрытии и не
    // продвигался/не гасил озвучку. Хуже: _closeAllPanels() вызывается ПРИ ОТКРЫТИИ любого
    // модуля тоже (openModule() зовёт её первой строкой) — старый безусловный
    // "if(this._activeTourKey) this._advanceTour(...)" продвигал тур на клик по ЛЮБОЙ
    // вкладке, а не только по целевой — этим и объясняется "порядок перепутан": игрок
    // случайно тыкал в другую (на тот момент ещё некорректно кликабельную, см. фикс
    // interactiveChildren в _buildTourOverlay выше) вкладку, и тур скакал вперёд не туда.
    //
    // Новая точка — iface.popHud(id): ЕДИНСТВЕННое место, которое реально вызывают ВСЕ 8
    // экранов тура при закрытии (декларативный ХУД-стек, см. большой коммент в interface.js),
    // независимо от того, идёт ли закрытие через _closeAllPanels() или напрямую через
    // собственную кнопку выхода экрана. Продвигаем тур, только если id закрывшегося экрана
    // РЕАЛЬНО соответствует активному шагу (не любой чужой popHud типа yashik/ryukzak).
    // Исключение — База (Хата, hata.js): единственный экран тура на старом паттерне без
    // pushHud/popHud вообще, close() просто убирает _win — патчим отдельно.
    Onboarding.prototype._hookScreenClose = function(){
        if(!window.iface || iface._onboardingCloseHooked) return;
        iface._onboardingCloseHooked = true;

        const HUD_ID_TO_TAB_KEY = {
            dvor: 'dvor', zone: 'zone', habar: 'habar', svod: 'svod',
            shmot: 'shmot', sidorovich: 'sidorovich',
            bossSelect: 'bosses', bossFight: 'bosses',
        };

        const originalPopHud = iface.popHud.bind(iface);
        iface.popHud = (id) => {
            // popHud() также вызывается как безопасная уборка уже отсутствующего экрана
            // (например _reallyOpenBossesFight() чистит старый bossFight перед постройкой
            // нового). Это не действие игрока и не должно двигать обучение.
            const hadHud = Array.isArray(iface._hudStack) && iface._hudStack.some(entry => entry.id === id);
            const result = originalPopHud(id);
            // Переход bossSelect -> предварительный экран/бой — это не выход из вкладки
            // «Боссы». Без этой проверки popHud('bossSelect') продвигал обучение и показывал
            // следующую руку поверх боёвки.
            // Закрытие выбора боссов при старте боя — внутренняя смена экранов, а не выход
            // из вкладки. Бой может добавиться кадром позже, поэтому проверка parent здесь
            // была гонкой и рука следующего шага успевала появиться поверх боёвки.
            // Флаг выставляется строго на время технической замены «выбор боссов → бой».
            // Реальный клик игрока по кресту в выборе не выставляет его и продвигает урок.
            if(id === 'bossSelect' && iface._onboardingBossScreenTransition) return result;
            if(hadHud && this._activeTourKey && HUD_ID_TO_TAB_KEY[id] === this._activeTourKey){
                console.log('[onboarding._hookScreenClose] popHud(' + id + ') совпал с активным шагом тура — продвигаю');
                this._advanceTour(this._activeTourKey);
            }
            return result;
        };

        if(window.hata && typeof hata.close === 'function' && !hata._onboardingCloseHooked){
            hata._onboardingCloseHooked = true;
            const originalHataClose = hata.close.bind(hata);
            hata.close = () => {
                const result = originalHataClose();
                if(this._activeTourKey === 'baza'){
                    console.log('[onboarding._hookScreenClose] hata.close() во время шага "baza" — продвигаю');
                    this._advanceTour('baza');
                }
                return result;
            };
        }
    };
}
