import { applyPatch } from '../modules/patch.js';
import { attachGame2048RulesPopup } from './game2048/game2048-rules-popup.js';
import { attachGame2048TopPopup } from './game2048/game2048-top-popup.js';

// 26.10.2026 (по прямому указанию — новая мини-игра "2048", отдельная вкладка, НЕ часть
// Двора, PIXI-based без FLA — тот же паттерн, что Raznaryadka, см. module_control.js
// constructInterface()). Сервер — server/core/controllers/game2048.php (getState/start/move/
// end/craft/top), вся экономика/RNG/лимиты — там, клиент только рисует и шлёт направление
// хода (см. AGENTS.md правило №9).
//
// ⚠️ Координаты ШЕСТИ значений статус-блока (текущий счёт/макс.плитка/тушёнка/попытка
// сегодня/следующая попытка/тип партии) — пользователь продиктовал ТОЛЬКО шрифт/размер/цвет
// для этой группы, а не x/y каждого конкретного значения (в отличие от всего остального на
// этом экране, где x/y даны точно). Ниже — визуальная прикидка по скриншоту фона "2048
// игра.png", тот же класс допущения, что game/home.js (_leftForearmSpr и т.п.) — требует
// подтверждения/уточнения через универсальный редактор позиций. См. финальный список вопросов.
// 28.10.2026 (найдено при аудите "шрифты не успевают загрузиться" — см. game2048-top-popup.js):
// 'Bebas Neue Pro' (без суффикса) никогда не был зарегистрирован в fonts.css, только
// 'Bebas Neue Pro Middle'/'Bebas Neue Pro Bold'. С момента создания фичи 26.10.2026 весь
// статус-блок 2048 рисовался системным fallback-шрифтом без единой ошибки в консоли.
const FONT_STAT = 'Bebas Neue Pro Middle';
const FONT_RESOURCE = 'Arial Narrow';
const COLOR_STAT = '#e3d0bb';       // изображение 4 из диктовки 26.10.2026
const COLOR_GAMES_COUNT = '#f4b960'; // изображение 5
const COLOR_RANK_PLACE = '#dbbda2';  // изображение 6

const STYLE_STAT = {
    fontFamily: FONT_STAT, fontSize: 18, fontWeight: '400', fill: COLOR_STAT,
    dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
};

// Arial Narrow Bold 14pt — обводка/наложение цвета/тень по трём layer-style скриншотам
// 26.10.2026 ("кол-во рублей"). PIXI.TextStyle не умеет отдельную непрозрачность ТОЛЬКО на
// обводке (Photoshop 56%) — strokeThickness/dropShadow* ниже дают визуально близкий, но не
// пиксель-в-пиксель результат; dropShadowAngle переведён из Photoshop-угла 133° в радианы
// приближённо (математическое соответствие двух систем угла не проверялось).
const STYLE_RESOURCE = {
    fontFamily: FONT_RESOURCE, fontWeight: 'bold', fontSize: 14, fill: COLOR_STAT,
    stroke: '#000000', strokeThickness: 2,
    dropShadow: true, dropShadowColor: '#000000', dropShadowAlpha: 0.75,
    dropShadowAngle: 133 * Math.PI / 180, dropShadowDistance: 2, dropShadowBlur: 8,
};

const STYLE_FRAGMENTS = Object.assign({}, STYLE_STAT, { dropShadowBlur: 0 });

// 28.10.2026 (по прямому указанию — редактор позиций, 16 точек построчно 1-1..4-4,
// подтверждено явно: "это 16 координат для расположения на самой доске... сделай так, как я
// тебе скинул координаты"): заменяет прежнюю формулу равномерной сетки (BOARD/cellCenter) —
// теперь у каждой из 16 ячеек СВОЙ абсолютный центр из таблицы, не вычисляемый. Входные числа
// от редактора — top-left+w/h (w:67,h:68 — нативный размер плитки, тот же приём перевода в
// центр, что у statPositions ниже: center = x+w/2, y+h/2).
//
// 28.10.2026 (повторное указание тем же днём — "редактор позиций показывал 0 и 0 вместо
// координат относительно экрана"): корень — координаты раньше стояли на ОБЁРТКЕ-Container
// (cont.x/y), а не на самом Sprite, который реально находит редактор по клику (см. фикс в
// цикле построения поля ниже — теперь x/y стоят на spr, как у всех остальных спрайтов проекта).
// Из-за этого же редактор показывал локальные (0,0) обёртки, а не экранные координаты — именно
// поэтому прошлые числа "16 точек" ушли не туда, куда ожидалось. Пользователь компенсировал
// координатами доски СНОВА, уже с поправкой: вправо на 383px, вниз на 125px — добавлено прямо
// к каждой точке ниже (видна исходная раскладка + смещение, не просто готовые числа).
// 28.10.2026 (ещё одно указание тем же днём — "опусти все файлы доски вниз на 68px"): +68
// добавлен поверх уже применённого +125.
const CELL_POS = [
    { x: 6 + 33.5 + 383,   y: 7 + 34 + 125 + 68   }, { x: 77 + 33.5 + 383,  y: 8 + 34 + 125 + 68   }, { x: 147 + 33.5 + 383, y: 9 + 34 + 125 + 68   }, { x: 217 + 33.5 + 383, y: 9 + 34 + 125 + 68   },
    { x: 7 + 33.5 + 383,   y: 76 + 34 + 125 + 68  }, { x: 77 + 33.5 + 383,  y: 76 + 34 + 125 + 68  }, { x: 147 + 33.5 + 383, y: 76 + 34 + 125 + 68  }, { x: 216 + 33.5 + 383, y: 76 + 34 + 125 + 68  },
    { x: 8 + 33.5 + 383,   y: 142 + 34 + 125 + 68 }, { x: 78 + 33.5 + 383,  y: 142 + 34 + 125 + 68 }, { x: 147 + 33.5 + 383, y: 141 + 34 + 125 + 68 }, { x: 215 + 33.5 + 383, y: 141 + 34 + 125 + 68 },
    { x: 8 + 33.5 + 383,   y: 210 + 34 + 125 + 68 }, { x: 77 + 33.5 + 383,  y: 209 + 34 + 125 + 68 }, { x: 146 + 33.5 + 383, y: 210 + 34 + 125 + 68 }, { x: 215 + 33.5 + 383, y: 209 + 34 + 125 + 68 },
];

// Награды текущей партии — ряд из 6 иконок УЖЕ нарисован в самом фоне "2048 игра.png"
// (коин/пистолет/автомат/СУХАРИ/XP/фрагмент) — здесь только текст "xN" поверх каждой, шаг 58px
// по X продиктован явно (690→748, коины→пистолет), дальше — та же экстраполяция, что попросил
// пользователь ("поставь так аналогично... понял расстояние между иксами").
// 27.10.2026 (по прямому указанию — "все надписи в игре 2048, которые подписываются, опусти
// вниз на 23 пикселя и сдвинь вправо на 20 пикселей"): применено ко ВСЕМ динамическим PIXI.Text
// на этом экране — награды текущей партии (ниже), прогресс крафта и статус-блок (см. _build()).
// 27.10.2026 (по прямому указанию, тем же днём — точечные докрутки поверх уже применённого
// общего +20x/+23y): рубли +24, стволы +20, автоматы +14, сухари +10, опыт +4 (все вправо),
// фрагмент не трогать; Y всех шести элементов сразу — на 1px вверх.
const REWARD_ROW_Y = 380 + 23 - 1;
const REWARD_ROW_X = {
    coins: 690 + 20 + 24, gun: 748 + 20 + 20, auto: 806 + 20 + 14,
    cig: 864 + 20 + 10, exp: 922 + 20 + 4, fragment: 980 + 20,
};

export default class Game2048{
    constructor(){
        this._win = null;
        this._tileSprs = [];   // 16 PIXI.Container (bg sprite + text), индекс = r*4+c
        this._rewardTxts = {};
        this._statTxts = {};
        this._state = null;    // последний ответ getState/start/move
        this._moveSeq = 0;
        this._moveBusy = false;
        this._keyHandler = null;
        if(this._win){
            if(this._swipeDown) this._win.off('pointerdown', this._swipeDown);
            if(this._swipeUp){ this._win.off('pointerup', this._swipeUp); this._win.off('pointerupoutside', this._swipeUp); }
            if(this._swipeCancel) this._win.off('pointercancel', this._swipeCancel);
        }
        this._swipeStart = null;
        this._swipeStart = null;
    }

    open(){
        if(this._win && this._win.parent){ this.close(); return; }
        try { this._build(); } catch(e){ console.error('[game2048.open] _build() FAILED:', e); return; }
        root.layer2_mc.addChild(this._win);
        if(window.iface){
            if(iface.up)   root.layer2_mc.addChild(iface.up);
            if(iface.down) root.layer2_mc.addChild(iface.down);
        }
        this._attachInput();
        this._fetchState();
    }

    close(){
        this._detachInput();
        if(this._topWin && this._topWin.parent) this._topWin.parent.removeChild(this._topWin);
        if(this._win && this._win.parent) this._win.parent.removeChild(this._win);
    }

    _returnToDvor(){
        this.close();
        if(window.iface) iface.openModule('dvor',{forceOpen:true});
    }

    // ── Сервер ──

    _fetchState(){
        console.log('[game2048._fetchState] → сервер: game2048.getState');
        TS.php('game2048.getState', {}, (e) => {
            console.log('[game2048._fetchState] ← ответ сервера:', JSON.stringify(e));
            if(!e){ console.error('[game2048._fetchState] пустой ответ'); return; }
            this._state = e;
            this._moveSeq = e.session ? intval(e.session.moveSeq) : 0;
            this._render();
        }, (err) => {
            console.error('[game2048._fetchState] ← ошибка сервера:', JSON.stringify(err));
            if(window.notify) notify.showResult({text: 'Раздел временно недоступен'}, 0);
        });
    }

    _startGame(){
        console.log('[game2048._startGame] → сервер: game2048.start');
        TS.php('game2048.start', {}, (e) => {
            console.log('[game2048._startGame] ← ответ сервера:', JSON.stringify(e));
            if(!e || (!e.session && !e.resumed)){
                if(window.notify) notify.showResult({text: 'Не удалось начать партию'}, 0);
                return;
            }
            if(e.patch) applyPatch(e.patch);
            this._state = this._state || {};
            this._state.session = e.session;
            this._state.daily = e.daily || this._state.daily;
            this._moveSeq = e.session ? intval(e.session.moveSeq) : 0;
            this._render();
        }, (err) => {
            console.error('[game2048._startGame] ← ошибка сервера:', JSON.stringify(err));
            const msg = (err && err.code === 70) ? 'Дневной лимит партий исчерпан'
                : (err && err.code === 50) ? 'Недостаточно тушёнки' : 'Не удалось начать партию';
            if(window.notify) notify.showResult({text: msg}, 0);
        });
    }

    // seq — ожидаемый СЛЕДУЮЩИЙ moveSeq (см. докблок в game2048.php.move()), защита от
    // двойной отправки одного и того же хода при разрыве сети/повторном клике.
    _sendMove(dir){
        if(this._moveBusy) return;
        if(!this._state || !this._state.session) return;
        this._moveBusy = true;
        const seq = this._moveSeq + 1;
        console.log('[game2048._sendMove] → сервер: game2048.move dir=' + dir + ' seq=' + seq);
        TS.php('game2048.move', { dir, seq }, (e) => {
            this._moveBusy = false;
            console.log('[game2048._sendMove] ← ответ сервера:', JSON.stringify(e));
            if(!e){ console.error('[game2048._sendMove] пустой ответ'); return; }
            if(e.patch) applyPatch(e.patch);
            this._moveSeq = seq;
            this._state.session = e.session;
            if(e.gameOver){
                if(window.notify) notify.showResult({text: 'Партия завершена — нет доступных ходов'}, 0);
                this._fetchState(); // подтянуть обновлённый daily/fragments/gamesCompleted
                return;
            }
            this._render();
        }, (err) => {
            this._moveBusy = false;
            console.error('[game2048._sendMove] ← ошибка сервера:', JSON.stringify(err));
        });
    }

    _endGame(){
        // Подтверждение — на клиенте (ТЗ п.2: "добровольное завершение с подтверждением").
        const run = () => {
            TS.php('game2048.end', {}, (e) => {
                console.log('[game2048._endGame] ← ответ сервера:', JSON.stringify(e));
                if(e && e.patch) applyPatch(e.patch);
                this._fetchState();
            }, (err) => console.error('[game2048._endGame] ← ошибка сервера:', JSON.stringify(err)));
        };
        if(window.iface && typeof iface._showConfirmPopup === 'function'){
            iface._showConfirmPopup('Завершить партию? Прогресс сохранится, попытка не вернётся.', run);
        } else {
            run();
        }
    }

    _buyAttempt(){
        this._startGame(); // стоимость следующей попытки считает и списывает сам start() по attemptIndex
    }

    _craft(){
        TS.php('game2048.craft', {}, (e) => {
            console.log('[game2048._craft] ← ответ сервера:', JSON.stringify(e));
            if(!e) return;
            if(e.patch) applyPatch(e.patch);
            if(e.itemPending && window.notify) notify.showResult({text: 'Награда ещё не добавлена разработчиком'}, 0);
            this._fetchState();
        }, (err) => console.error('[game2048._craft] ← ошибка сервера:', JSON.stringify(err)));
    }

    // ── Ввод: стрелки (десктоп) / свайп (мобильные) ──

    _attachInput(){
        this._detachInput();
        this._keyHandler = (ev) => {
            const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
            if(map[ev.key]){ ev.preventDefault(); this._sendMove(map[ev.key]); }
        };
        if(!window.isMobile) window.addEventListener('keydown', this._keyHandler);

        if(window.isMobile && this._win){
            this._swipeDown = (ev) => {
                if(ev.data.pointerType === 'mouse') return;
                if(this._swipeStart){ this._swipeStart = null; this._swipeBlocked = true; return; }
                if(this._swipeBlocked) return;
                if(this._tileSprs && ev.data.global && !this._tileSprs.some(tile => tile.getBounds().contains(ev.data.global.x, ev.data.global.y))) return;
                this._swipeStart = ev.data.getLocalPosition(this._win);
            };
            this._swipeUp = ev => this._onSwipeEnd(ev);
            this._swipeCancel = () => { this._swipeStart = null; this._swipeBlocked = false; };
            this._win.on('pointerdown', this._swipeDown);
            this._win.on('pointerup', this._swipeUp);
            this._win.on('pointerupoutside', this._swipeUp);
            this._win.on('pointercancel', this._swipeCancel);
        }
    }

    _onSwipeEnd(ev){
        if(this._swipeBlocked){ this._swipeBlocked = false; return; }
        if(!this._swipeStart) return;
        const end = ev.data.getLocalPosition(this._win);
        const dx = end.x - this._swipeStart.x, dy = end.y - this._swipeStart.y;
        this._swipeStart = null;
        const THRESHOLD = 24;
        if(Math.max(Math.abs(dx), Math.abs(dy)) < THRESHOLD) return;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        this._sendMove(dir);
    }

    _detachInput(){
        if(this._keyHandler) window.removeEventListener('keydown', this._keyHandler);
        this._keyHandler = null;
        if(this._win){
            if(this._swipeDown) this._win.off('pointerdown', this._swipeDown);
            if(this._swipeUp){ this._win.off('pointerup', this._swipeUp); this._win.off('pointerupoutside', this._swipeUp); }
            if(this._swipeCancel) this._win.off('pointercancel', this._swipeCancel);
        }
        this._swipeStart = null;
    }

    // ── Построение экрана ──

    _build(){
        const IMG = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.001);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const darkBg = new PIXI.Graphics();
        darkBg.beginFill(0x000000, 0.6);
        darkBg.drawRect(0, 0, 1280, 720);
        darkBg.endFill();
        win.addChild(darkBg);

        const backdrop = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 фон.png'));
        backdrop.width=1280;backdrop.height=720;
        win.addChild(backdrop);
        const bg = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 игра.png'));
        bg.x = 279; bg.y = 79;
        win.addChild(bg);

        // Стандартная кнопка выхода экрана (AGENTS.md — "Паттерн нового PIXI-экрана") — файл
        // "2048 выйти.png" пользователь явно зарезервировал за кнопкой ВНУТРИ попапа правил
        // (x944,y102 на ТОЙ странице, см. game2048-rules-popup.js), не за этим экраном.
        const exitBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + 'выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn);
        exitBtn.x = 1040; exitBtn.y = 136;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', () => { exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout',  () => { exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', event => {event.stopPropagation();this._returnToDvor();});
        win.addChild(exitBtn);

        // Поле 4×4 — 16 готовых центров из CELL_POS (см. докблок константы выше). Позиция стоит
        // на spr (не на cont-обёртке) — редактор позиций находит по клику именно спрайт, и
        // только его this.x/this.y считаются "координатами относительно экрана" (см. докблок
        // CELL_POS выше про баг с 0,0).
        for(let r = 0; r < 4; r++){
            for(let c = 0; c < 4; c++){
                const cell = CELL_POS[r * 4 + c];
                const cont = new PIXI.Container();
                cont.visible = false;
                const spr = new PIXI.Sprite(PIXI.Texture.EMPTY);
                spr.anchor.set(0.5);
                spr.x = cell.x; spr.y = cell.y;
                cont.addChild(spr);
                cont._spr = spr;
                cont._fallbackTxt = null;
                cont._cellX = cell.x; cont._cellY = cell.y;
                win.addChild(cont);
                this._tileSprs[r * 4 + c] = cont;
            }
        }

        // 27.10.2026 (по прямому указанию — "сделай hover эффект небольшого скейла при
        // наведении на кнопки запросить/завершить партию/играть/топ/информация о событии"):
        // небольшой scale-бамп ПОВЕРХ уже существующей alpha-дымки (не вместо неё) — простая
        // overlay-функция, anchor по умолчанию (0,0), та же необременительная схема, что
        // dvor.js._ss() у некруглых кнопок.
        const _hoverScale = (spr, scale) => {
            spr.on('pointerover', () => { spr.scale.set(scale); });
            spr.on('pointerout',  () => { spr.scale.set(1); });
        };

        // Информация о событии → попап правил
        const infoBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 Информация о событии.png'));
        if(window.isMobile) helper.touchPad(infoBtn);
        infoBtn.x = 283; infoBtn.y = 486;
        infoBtn.interactive = true; infoBtn.buttonMode = true;
        // 27.10.2026 (по прямому указанию — "при наведении на информацию о событии оно
        // становится полупрозрачным, это убери, должно только чуть увеличиваться по центру"):
        // alpha-дымка убрана, остаётся только центрированный hover-scale (_hoverScale ниже).
        infoBtn.on('pointerdown', () => this._openRulesPopup());
        _hoverScale(infoBtn, 1.05);
        win.addChild(infoBtn);

        // Играть / Завершить партию — взаимоисключающие, одна позиция (как dice throw/confirm)
        const playBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 играть.png'));
        if(window.isMobile) helper.touchPad(playBtn);
        playBtn.x = 519; playBtn.y = 484;
        playBtn.interactive = true; playBtn.buttonMode = true;
        playBtn.on('pointerdown', () => this._startGame());
        _hoverScale(playBtn, 1.05);
        win.addChild(playBtn);
        this._playBtn = playBtn;

        const endBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 завершить партию.png'));
        if(window.isMobile) helper.touchPad(endBtn);
        endBtn.x = 519; endBtn.y = 484;
        endBtn.interactive = true; endBtn.buttonMode = true;
        endBtn.on('pointerdown', () => this._endGame());
        _hoverScale(endBtn, 1.05);
        win.addChild(endBtn);
        this._endBtn = endBtn;

        // Купить попытку / неактив
        const buyBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 купить попытку.png'));
        if(window.isMobile) helper.touchPad(buyBtn);
        buyBtn.x = 854; buyBtn.y = 486;
        buyBtn.interactive = true; buyBtn.buttonMode = true;
        buyBtn.on('pointerdown', () => this._buyAttempt());
        win.addChild(buyBtn);
        this._buyBtn = buyBtn;

        const buyBtnInactive = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 купить попытку инактив.png'));
        buyBtnInactive.x = 854; buyBtnInactive.y = 486;
        win.addChild(buyBtnInactive);
        this._buyBtnInactive = buyBtnInactive;

        // ТОП
        const topBtn = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 ТОП.png'));
        if(window.isMobile) helper.touchPad(topBtn);
        topBtn.x = 764; topBtn.y = 107;
        topBtn.interactive = true; topBtn.buttonMode = true;
        // 28.10.2026 (по прямому указанию — "только хавер эффект увеличения scale без
        // прозрачности"): alpha-дымка убрана, остаётся только _hoverScale ниже.
        topBtn.on('pointerdown', () => this._openTopPopup());
        _hoverScale(topBtn, 1.05);
        win.addChild(topBtn);

        // "×2" при платной партии
        const x2Badge = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 при платной партии.png'));
        x2Badge.x = 945; x2Badge.y = 317;
        x2Badge.visible = false;
        win.addChild(x2Badge);
        this._x2Badge = x2Badge;

        // Прогресс крафта (фон + заполнение)
        const craftBg = new PIXI.Sprite(PIXI.Texture.from(IMG + '2048 прогресс крафта фон.png'));
        craftBg.x = 751; craftBg.y = 431;
        win.addChild(craftBg);
        const craftFillTex = PIXI.Texture.from(IMG + '2048 прогресс крафта заполнение.png');
        const craftFill = new PIXI.Sprite(craftFillTex);
        craftFill.x = 755; craftFill.y = 450;
        win.addChild(craftFill);
        this._craftFill = craftFill;
        this._craftFillFullWidth = null;
        craftFillTex.baseTexture.valid
            ? (this._craftFillFullWidth = craftFillTex.width)
            : craftFillTex.once('update', () => { this._craftFillFullWidth = craftFillTex.width; });
        craftFill.interactive = true; craftFill.buttonMode = true;
        craftFill.on('pointerdown', () => this._craft());

        // Текст наград текущей партии ("xN" — иконки уже в фоне)
        ['coins', 'gun', 'auto', 'cig', 'exp', 'fragment'].forEach((type) => {
            // 27.10.2026 (по прямому указанию — "вместо x маленького напиши X большое").
            const t = new PIXI.Text('X0', STYLE_RESOURCE);
            t.anchor.set(0.5, 0.5);
            t.x = REWARD_ROW_X[type]; t.y = REWARD_ROW_Y;
            win.addChild(t);
            this._rewardTxts[type] = t;
        });

        // Прогресс крафта "n/90" (сдвинут +20x/+23y 27.10, затем ЕЩЁ +30px вправо тем же днём
        // по прямому указанию — "цифру прогресса крафта сдвинь вправо на 30 пикселей").
        const fragTxt = new PIXI.Text('0/90', STYLE_FRAGMENTS);
        fragTxt.anchor.set(0.5, 0.5);
        fragTxt.x = 865 + 20 + 30; fragTxt.y = 417 + 23;
        win.addChild(fragTxt);
        this._fragTxt = fragTxt;

        // 27.10.2026 (по прямому указанию, координаты редактора позиций — заменяют визуальную
        // прикидку из предыдущей правки): хитбоксы {x,y,w,h} — текст центрируется и по
        // горизонтали, и по вертикали внутри каждого (anchor уже 0.5/0.5 ниже), x/y здесь —
        // уже ГОТОВЫЙ центр (box.x+box.w/2, box.y+box.h/2), не исходный top-left хитбокса.
        //   score:    x:700,y:220,w:76,h:31 → центр 738,235.5
        //   maxTile:  x:786,y:220,w:76,h:31 → центр 824,235.5
        //   stew:     x:936,y:220,w:76,h:31 → центр 974,235.5
        //   type:     x:933,y:286,w:76,h:31 → центр 971,301.5
        //   attempts: x:705,y:288,w:76,h:31 → центр 743,303.5
        //   nextCost: x:807,y:287,w:27,h:31 → центр 820.5,302.5
        // 28.10.2026 (по прямому указанию — "текст для попыток сегодня подними вверх на 2px"):
        // attempts.y 303.5 → 301.5.
        const statPositions = {
            score:       { x: 738,   y: 235.5 },
            maxTile:     { x: 824,   y: 235.5 },
            stew:        { x: 974,   y: 235.5 },
            attempts:    { x: 743,   y: 301.5 },
            nextCost:    { x: 820.5, y: 302.5 },
            type:        { x: 971,   y: 301.5 },
        };
        Object.keys(statPositions).forEach((key) => {
            const t = new PIXI.Text('', STYLE_STAT);
            t.anchor.set(0.5, 0.5);
            t.x = statPositions[key].x; t.y = statPositions[key].y;
            win.addChild(t);
            this._statTxts[key] = t;
        });

        this._win = win;
    }

    _openRulesPopup(){ this._openGame2048RulesPopup(); }
    _openTopPopup(){ this._openGame2048TopPopup(); }

    // ── Отрисовка состояния ──

    _render(){
        if(!this._win) return;
        const s = this._state || {};
        const session = s.session;

        this._playBtn.visible = !session;
        this._endBtn.visible = !!session;

        const daily = s.daily || { used: 0, limit: 6 };
        const atLimit = intval(daily.used) >= intval(daily.limit);
        // 28.10.2026 (по прямому указанию — "не должен отображаться, пока доступны бесплатные
        // игры; должен выводиться, когда следующая игра платная"): freeLeft — те же 3
        // бесплатные попытки, что считает nextPaidIdx ниже (daily.used<3 → следующая партия
        // бесплатна). Инактив-кнопка показывает именно это состояние, активная — когда
        // бесплатные исчерпаны, но дневной лимит (6) ещё не достигнут целиком.
        const freeLeft = intval(daily.used) < 3;
        this._buyBtn.visible = !session && !atLimit && !freeLeft;
        this._buyBtnInactive.visible = !session && !atLimit && freeLeft;

        this._statTxts.attempts.text = daily.used + '/' + daily.limit;
        this._statTxts.type.text = session ? (session.type === 'paid' ? 'Платная' : 'Бесплатная') : '—';
        this._statTxts.score.text = session ? String(session.score) : '0';
        this._statTxts.maxTile.text = session ? String(session.maxTile) : '0';
        this._statTxts.stew.text = String(udata && udata['stew'] || 0);

        const costs = [4, 6, 10];
        const nextPaidIdx = intval(daily.used) - 3; // 0..2 после 3 бесплатных
        this._statTxts.nextCost.text = (!session && nextPaidIdx >= 0 && nextPaidIdx < 3) ? String(costs[nextPaidIdx]) : '—';

        this._x2Badge.visible = !!(session && session.type === 'paid');

        const fragments = intval(s.fragments || 0);
        const needed = intval(s.fragmentsNeeded || 90);
        this._fragTxt.text = fragments + '/' + needed;
        if(this._craftFillFullWidth){
            this._craftFill.width = this._craftFillFullWidth * Math.min(1, fragments / needed);
        }

        const earned = { coins: 0, gun: 0, auto: 0, cig: 0, exp: 0, fragment: 0 };
        (session && session.rewardsThisSession || []).forEach((r) => {
            if(earned[r.type] !== undefined) earned[r.type] += intval(r.amt);
        });
        Object.keys(earned).forEach((type) => { this._rewardTxts[type].text = 'X' + earned[type]; });

        const board = (session && session.board) || new Array(16).fill(0);
        board.forEach((v, idx) => this._renderTile(this._tileSprs[idx], v));
    }

    _renderTile(cont, value){
        cont.visible = value > 0;
        if(value <= 0) return;
        const IMG = './images/';
        const file = IMG + '2048 ' + value + '.png';
        const tex = PIXI.Texture.from(file);
        if(tex.baseTexture.valid && tex.width > 1){
            cont._spr.texture = tex;
            cont._spr.visible = true;
            // 27.10.2026 (баг найден по прямому указанию — "бери прозрачный отступ по бокам и
            // выводи в натуральном размере"): файлы плиток (2..16384) у alpha-канала НЕ имеют
            // прозрачных полей (проверено PIL getbbox() — bbox = весь canvas у всех 14 файлов).
            //
            // 28.10.2026 (повторный репорт — "всё ещё маленькие, сделай 62×62", затем, после
            // объяснения про cellSize=46 — "выводи их, как они должны быть, БЕЗ СКЕЙЛА ВООБЩЕ"):
            // промежуточная версия вписывала текстуру в cellSize=46 (BOARD 208px/4 колонки-6px
            // зазор) через Math.min(1, cellSize/tex.width, cellSize/tex.height) — визуально
            // корректно (без искажения пропорций), но игрок явно потребовал БЕЗ какого-либо
            // масштабирования. scale всегда 1 — плитка рендерится в точности в своём нативном
            // пиксельном размере (66-71px по сторонам, см. docblock теста game2048.js), даже
            // если это немного перекрывает соседние ячейки доски (BOARD-сетка рассчитана на
            // ~46px) — осознанный выбор по прямому указанию, не упущенный краевой случай.
            cont._spr.scale.set(1);
            if(cont._fallbackTxt) cont._fallbackTxt.visible = false;
        } else {
            // Нет готового арта для значения (>16384, за пределами присланных файлов 2..16384)
            // — текстовый фолбэк вместо сломанной текстуры.
            cont._spr.visible = false;
            if(!cont._fallbackTxt){
                cont._fallbackTxt = new PIXI.Text('', STYLE_STAT);
                cont._fallbackTxt.anchor.set(0.5);
                // cont сам стоит на (0,0) — позиция теперь на spr (см. докблок CELL_POS), фолбэк
                // нужно позиционировать явно той же точкой, иначе уедет в левый верхний угол.
                cont._fallbackTxt.x = cont._cellX; cont._fallbackTxt.y = cont._cellY;
                cont.addChild(cont._fallbackTxt);
            }
            cont._fallbackTxt.text = String(value);
            cont._fallbackTxt.visible = true;
        }
    }
}

function intval(v){ return parseInt(v, 10) || 0; }

attachGame2048RulesPopup(Game2048.prototype);
attachGame2048TopPopup(Game2048.prototype);
