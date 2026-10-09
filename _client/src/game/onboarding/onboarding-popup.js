/** Попап обучения (30.09.2026, по прямому указанию) — общая оболочка для трёх текстовых
 * состояний (intro/currency/final), с кнопками "Продолжить"/"Слиться" (hover актив/пассив).
 *
 * Координаты фона/кнопок — даны пользователем напрямую. Область текста справа от портрета —
 * НЕ дана явно (пользователь: "посмотришь на поп-ап, там будет место у него") — подобрана по
 * пропорциям присланного скриншота (752×558 фон, портрет занимает примерно левую треть).
 */
import { POPUP_TEXTS, POPUP_SOUNDS, ONBOARDING_EXTRA_SOUNDS } from './onboarding-data.js';

const BASE = './images/';
const BG_X = 275, BG_Y = 38;
const CONTINUE_X = 667, CONTINUE_Y = 506;
// Общая посадка обоих PNG «Слиться» и hit-area, снята редактором позиций.
const MERGE_X = 391, MERGE_Y = 506;
// 30.09.2026, по прямому указанию (живой тест) — снято "📋 СУПЕР КОПИРОВАТЬ" прямо с текста
// попапа. X и scale общие для всех трёх состояний (замерены одинаковыми в обоих снятиях).
// Y и wordWrapWidth — РАЗНЫЕ по состояниям: тексты разной длины (интро короткий, про валюту —
// в разы длиннее и должен начинаться выше, чтобы поместиться до кнопок).
// 08.10.2026 (фикс пикселизации текста, по прямому указанию дизайнера — PIXI.Text,
// отрисованный под маленький fontSize и растянутый scale'ом, размывается): fontSize/
// lineHeight/wordWrapWidth ниже переведены на прямой конечный размер (той же формулой,
// что редактор позиций уже использовал для вычисления итоговой ширины w — см. историю:
// w = wordWrapWidth × scale, здесь теперь wordWrapWidth СРАЗУ равен прежнему w). scale
// больше не применяется вообще.
//   intro:    x:625, y:312, w:340 (было wordWrapWidth:375 × scale:0.907)
//   currency: x:625, y:232, w:337 (было wordWrapWidth:372 × scale:0.907)
const TEXT_X = 625;
const TEXT_Y_BY_STATE = { intro: 312, currency: 232, final: 312, permission: 255 };
const TEXT_W_BY_STATE  = { intro: 340, currency: 337, final: 340, permission: 337 };

// 30.09.2026 (по прямому указанию — "подсветка для ресурсов на моменте про ресурсы"; ПЕРЕСМОТРЕНО
// тем же днём — "не нужна жёлтая овальная обводка, сделай чтобы элемент фона ресурса просто
// мигал и немного вибрировал"): первая версия рисовала отдельное pulsing-кольцо вокруг
// getBounds() каждой иконки — заменено на мигание alpha + лёгкое дрожание САМИХ объектов
// iface.up.val_stew/val_coins/val_cigarettes (те же, что использует hover-попап валюты в
// interface-panels.js). Он же — практический эквивалент "подсветить задний фон ресурса
// (interface_elements_atlas_1.png)": фон это ребёнок val_* контейнера, двигая/гася alpha
// родителя, двигаем/гасим и его тоже, без необходимости знать имя конкретного child-объекта
// внутри FLA-атласа.
const RESOURCE_KEYS = ['val_stew', 'val_coins', 'val_cigarettes'];

export function attachOnboardingPopup(Onboarding){
    Onboarding.prototype._buildPopup = function(){
        const win = new PIXI.Container();
        win.interactive = true;

        // Полноэкранный блокер — во время попапа игра за ним не должна быть кликабельна.
        // 30.09.2026, по прямому указанию (живой тест — "экран должен затемняться, сейчас
        // прозрачный"): было 0.001 (чисто перехват кликов, без затемнения) — поднято до 0.6,
        // тот же уровень, что у остальных полноэкранных попапов проекта (level_up.js/reward.js).
        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x000000, 0.6);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'попап обучение.png'));
        bg.x = BG_X; bg.y = BG_Y;
        win.addChild(bg);

        const text = new PIXI.Text('', {
            fontFamily: 'Southbank LT', fontSize: 18, fill: '#ffffff',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
            wordWrap: true, wordWrapWidth: TEXT_W_BY_STATE.intro, lineHeight: 24,
        });
        text.x = TEXT_X; text.y = TEXT_Y_BY_STATE.intro;
        win.addChild(text);
        this._onboardingText = text;

        const mkBtn = (activeFile, passiveFile, x, y, onClick) => {
            const passive = new PIXI.Sprite(PIXI.Texture.from(BASE + passiveFile));
            const active  = new PIXI.Sprite(PIXI.Texture.from(BASE + activeFile));
            passive.x = active.x = x; passive.y = active.y = y;
            active.visible = false;
            win.addChild(passive, active);

            const hit = new PIXI.Graphics();
            hit.beginFill(0xffffff, 0.001);
            hit.drawRect(0, 0, passive.width || 268, passive.height || 70);
            hit.endFill();
            hit.x = x; hit.y = y;
            hit.interactive = true; hit.buttonMode = true;
            hit.on('pointerover', () => { passive.visible = false; active.visible = true; });
            hit.on('pointerout',  () => { active.visible = false; passive.visible = true; });
            hit.on('pointerdown', () => onClick());
            win.addChild(hit);
            return { passive, active, hit, x, y };
        };

        this._continueBtn = mkBtn('продолжить актив.png', 'продолжить пассив.png', CONTINUE_X, CONTINUE_Y, () => this._onContinue());
        this._mergeBtn = mkBtn('слиться актив.png', 'слиться пассив.png', MERGE_X, MERGE_Y, () => this._onMerge());

        this._popupWin = win;
    };

    // state: 'intro' | 'currency' | 'final' — какой текст показать и какой mp3 проиграть.
    Onboarding.prototype._showPopup = function(state){
        if(!this._popupWin) this._buildPopup();
        // После ввода позывного интро-попап временно скрывается, пока поверх него открыт
        // диалог ника. _hidePopup() затем убирает его со сцены, но намеренно не меняет
        // visible. Без явного возврата здесь тот же контейнер на шаге «валюта» добавлялся
        // обратно уже invisible — озвучка шла, а самого попапа игрок не видел.
        this._popupWin.visible = true;
        this._popupState = state;
        if(this._continueBtn){
            const showContinue = true;
            this._continueBtn.passive.visible = showContinue;
            this._continueBtn.active.visible = false;
            this._continueBtn.hit.visible = showContinue;
            this._continueBtn.hit.interactive = showContinue;
        }
        // Оба состояния PNG и hit-area всегда используют одну и ту же заданную позицию.
        if(this._mergeBtn){
            this._mergeBtn.passive.x = this._mergeBtn.active.x = this._mergeBtn.hit.x = MERGE_X;
            this._mergeBtn.passive.y = this._mergeBtn.active.y = this._mergeBtn.hit.y = MERGE_Y;
        }
        this._onboardingText.text = POPUP_TEXTS[state];
        this._onboardingText.y = TEXT_Y_BY_STATE[state] != null ? TEXT_Y_BY_STATE[state] : TEXT_Y_BY_STATE.intro;
        this._onboardingText.style.wordWrapWidth = TEXT_W_BY_STATE[state] != null ? TEXT_W_BY_STATE[state] : TEXT_W_BY_STATE.intro;
        root.layer2_mc.addChild(this._popupWin);
        if(window.iface){
            if(iface.up)   root.layer2_mc.addChild(iface.up);
            if(iface.down) root.layer2_mc.addChild(iface.down);
        }
        if(state === 'currency') this._buildCurrencyHighlights();
        else this._destroyCurrencyHighlights();
        // Описание валюты не должно превращаться в тупик: раньше после длинной реплики
        // игроку нужно было догадаться нажать «Продолжить», а через минуту вместо понятного
        // следующего шага запускалось «ноги болят». После окончания именно этой реплики
        // автоматически показываем финальный экран, где остаётся явный выбор действий.
        const onNarrationComplete = state === 'currency'
            ? () => {
                if(this._popupState !== 'currency') return;
                this._showPopup('final');
                this._setStep('final');
            }
            : undefined;
        this._playNarration(POPUP_SOUNDS[state], onNarrationComplete);
        this._touchOnboardingActivity();
        console.log('[onboarding._showPopup] state=' + state);
    };

    Onboarding.prototype._hidePopup = function(){
        if(this._popupWin && this._popupWin.parent) this._popupWin.parent.removeChild(this._popupWin);
        this._destroyCurrencyHighlights();
        this._stopNarration();
        this._clearIdleTimer();
    };

    // Мигание (alpha) — держится, пока показан попап "про валюту". Модифицирует САМИ объекты
    // val_stew/val_coins/val_cigarettes напрямую (не рисует ничего поверх) — оригинальный alpha
    // запоминается заранее и восстанавливается в _destroyCurrencyHighlights(), иначе ресурсы
    // останутся потускневшими навсегда.
    // 30.09.2026 (второй заход, по прямому указанию — "убери дрожание, пусть просто мигают"):
    // x/y-дрожание (shakeX/shakeY) было и убрано целиком, осталось только колебание alpha.
    Onboarding.prototype._buildCurrencyHighlights = function(){
        this._destroyCurrencyHighlights();
        if(!window.iface || !iface.up) return;

        const original = RESOURCE_KEYS
            .map(key => iface.up[key])
            .filter(Boolean)
            .map(obj => ({ obj, alpha: obj.alpha }));
        if(!original.length) return;

        let t = 0;
        const tick = () => {
            // 30.09.2026 (по прямому указанию — "мигание слишком быстрое, сделай в два раза
            // реже"): было t += 0.12 — частота мигания уменьшена вдвое понижением приращения.
            t += 0.06;
            const blink = 0.55 + 0.45 * Math.sin(t * 3); // колеблется между ~0.1 и 1
            original.forEach(({ obj }) => { obj.alpha = blink; });
        };
        PIXI.Ticker.shared.add(tick);
        this._currencyHighlightTick = tick;
        this._currencyHighlightOriginal = original;
    };

    Onboarding.prototype._destroyCurrencyHighlights = function(){
        if(this._currencyHighlightTick){ PIXI.Ticker.shared.remove(this._currencyHighlightTick); this._currencyHighlightTick = null; }
        if(this._currencyHighlightOriginal){
            this._currencyHighlightOriginal.forEach(({ obj, alpha }) => { obj.alpha = alpha; });
            this._currencyHighlightOriginal = null;
        }
    };

    // "Продолжить" ведёт себя по-разному в зависимости от текущего состояния попапа.
    Onboarding.prototype._onContinue = function(){
        this._touchOnboardingActivity();
        if(this._popupState === 'intro'){
            // Попап обучения НЕ прячем — попап смены ника открывается прямо поверх него (по
            // прямому указанию: если игрок жмёт "Отменить" в нике, должен вернуться СЮДА).
            if(this._popupWin) this._popupWin.visible = false;
            if(window.iface) iface._openNickPopup((nick) => {
                console.log('[onboarding._onContinue] ник подтверждён: ' + nick + ', стартую тур');
                this._hidePopup();
                this._setStep('dvor');
                this._startTourStep('dvor');
            }, () => {
                if(this._popupWin) this._popupWin.visible = true;
                this._touchOnboardingActivity();
            });
            return;
        }
        if(this._popupState === 'currency'){
            this._showPopup('final');
            this._setStep('final');
            return;
        }
        if(this._popupState === 'final'){
            this._mergeArmed = false;
            this._setStep('permission');
            this._showPopup('permission');
            return;
        }
        if(this._popupState === 'permission'){
            // Это уже собственное объясняющее окно игры, поэтому «Продолжить» является
            // явным согласием игрока. Сначала окончательно сохраняем завершение обучения,
            // затем просим VK-разрешение — и только если постоянного согласия ещё нет в БД.
            const needsFriendsPermission = !window.udata || String(udata['friends_scope_granted'] || '0') !== '1';
            this._finish();
            if(needsFriendsPermission) window.dispatchEvent(new Event('pripyat:friends-permission-request'));
            return;
        }
        // Не должно происходить для final (там кнопка скрыта), но оставляем безопасный выход.
        this._finish();
    };

    // 04.10.2026 (репорт — "кнопка слиться не работает", вместе с "обучение запускается по
    // несколько раз"): три из четырёх веток ниже (permission и "остальные экраны" × 2 места)
    // вызывали this._finish() ТОЛЬКО внутри onComplete-колбэка _playNarration() — то есть
    // завершение обучения (udata['onboarding_step']='done') наступало, только если озвучка
    // реально доиграла до конца. _playNarration() не гарантирует это: ошибка загрузки файла
    // (PIXI.sound.add(..., loaded:(err)=>{ if(err){ console.error(...); return; } ... })) молча
    // проглатывает onComplete целиком, а PIXI.sound.play() внутри try/catch — тоже без вызова
    // onComplete при исключении. Единственная ветка, которая РЕАЛЬНО работала надёжно — второй
    // клик на 'final' — потому что там this._finish() вызывается СРАЗУ, а озвучка после неё уже
    // ничего не блокирует. Теперь все 4 ветки это копируют: finish() синхронно по клику,
    // озвучка — fire-and-forget рядом, не на критическом пути завершения урока.
    Onboarding.prototype._onMerge = function(){
        this._touchOnboardingActivity();
        if(this._popupState === 'final'){
            // Первый клик — подтверждение, второй действительно завершает урок.
            if(!this._mergeArmed){
                this._mergeArmed = true;
                this._playNarration(ONBOARDING_EXTRA_SOUNDS.mergeConfirm);
                return;
            }
            this._finish();
            this._playNarration(ONBOARDING_EXTRA_SOUNDS.mergeDone);
            return;
        }
        if(this._popupState === 'permission'){
            this._finish();
            this._playNarration(ONBOARDING_EXTRA_SOUNDS.mergeDone);
            return;
        }
        // На остальных экранах первый клик — подтверждение намерения, второй — выход.
        if(!this._mergeArmed){
            this._mergeArmed = true;
            this._playNarration(ONBOARDING_EXTRA_SOUNDS.mergeConfirm);
            return;
        }
        this._finish();
        this._playNarration(ONBOARDING_EXTRA_SOUNDS.mergeDone);
    };

    Onboarding.prototype._finish = function(){
        console.log('[onboarding._finish] обучение завершено (шаг=' + this._popupState + ')');
        this._hidePopup();
        this._mergeArmed = false;
        this._setStep('done');
    };
}
