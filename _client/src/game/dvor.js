import { attachPoker }     from './dvor/dvor-poker.js';
import { attachRoulette }  from './dvor/dvor-roulette.js';
import { attachDice }      from './dvor/dvor-dice.js';
import { attachBlackjack } from './dvor/dvor-blackjack.js';
import { attachCards }     from './dvor/dvor-cards.js';
import { attachDvorMusic } from './dvor/dvor-music.js';
import { applyPatch }      from '../modules/patch.js';

// 27.09.2026 (по прямому указанию — переход с "1 раз в календарные сутки на облачко" на
// индивидуальный кулдаун на КАЖДОЕ облачко, по аналогии с HABAR_COLLECT_COOLDOWN_MS в habar.js):
// держать в синхроне с server/core/controllers/dvor.php::SIG_COOLDOWN_MS — сервер источник
// правды, это значение только для локального отображения (скрыть/показать облачко без ожидания
// ответа сервера).
const SIG_COLLECT_COOLDOWN_MS = 30 * 60 * 1000;

export default class Dvor{
    constructor(mc){
        this.mc  = mc;
        this.win = mc.dvor_win;

        this.currentGame = null;
        this._rolling    = false;
        this._data       = null;
        this._lobbyWin   = null;
        this._dvorCloudSprites = [];
        this._dvorCloudHighlightTick = null;

        this._dailyDate     = '';
        this._pokerUsed     = 0;
        this._cardsFreeUsed = false;
        this._diceFreeUsed  = false;
        this._bjFreeUsed    = false;

        if(this.win.butt_close) this.win.butt_close.on('pointerdown', ()=>this.close());
        if(this.win.butt_back)  this.win.butt_back.on('pointerdown',  ()=>this._backToLobby());
        this._bindGamePanels();

        // 27.09.2026 (по прямому указанию): облачко сигарет должно само стать доступным снова
        // через 30 минут БЕЗ перезахода в казино/повторного открытия экрана — по аналогии с
        // updateEnergy() в interface.js (setInterval(...,1000), тикает независимо от того, какой
        // экран сейчас открыт). Раз в 30 сек достаточно (не секундный таймер — тут нет
        // отображаемого обратного отсчёта, только факт "уже можно/ещё нет"). _refreshCigSprites()
        // сам ничего не делает, пока лобби двора ни разу не построено (this._cigSprites пуст).
        setInterval(() => this._refreshCigSprites(), 30000);
    }

    // ── DATA ──────────────────────────────────────────────────────────────────

    _rand(a, b){ return Math.floor(Math.random()*(b-a+1))+a; }

    _defaultData(){
        const r = this._rand.bind(this);
        return {
            poker:    { exp:0 },
            // aa/kk/qq — скрытый пити-прогресс на партии карт (dvor-blackjack.js — это и есть
            // живая игра "Карты", несмотря на имя файла). Пороги — ровно из ТЗ.
            cards:    { exp:0, aa:0, aa_t:r(90000,110000), kk:0, kk_t:r(70000,90000), qq:0, qq_t:r(8000,12000) },
            dice:     { exp:0 },
            // Джек-пот рулетки — теперь ГЛОБАЛЬНЫЙ серверный счётчик (roulette.spin,
            // общий на всех игроков, см. server/core/controllers/roulette.php), а не
            // локальный per-player pity — здесь остаётся только exp для уровня рулетки.
            roulette: { exp:0 },
        };
    }

    _loadData(){
        try {
            // 24.09.2026 (баг "лимит покера сброшен на экране (0/25), но сервер сразу отвечает
            // 'лимит исчерпан'", корень найден при разборе того же репорта — см. большой
            // комментарий у _loadDaily() ниже): raw JSON.parse() здесь падал по ТОЙ ЖЕ причине —
            // Database::trueJSON() на сервере уже раскодировал 'dvor_games_data' в объект сразу
            // после users.get(), JSON.parse(object) кидает SyntaxError, catch ниже молча
            // подставлял _defaultData() (обнулял pity-счётчики двора на каждой самой первой
            // загрузке страницы). helper.safeParseJSON() принимает и строку, и готовый объект.
            this._data = udata['dvor_games_data'] ? helper.safeParseJSON(udata['dvor_games_data'], null) : null;
            // 29.09.2026 (репорт — "уровень/опыт казино не сохраняется, после каждой перезагрузки
            // сбрасывается на 0"): PHP json_decode('{}', true) отдаёт ПУСТОЙ МАССИВ [] — от
            // json_decode('[]', true) он неотличим. У свежего/сброшенного аккаунта колонка
            // dvor_games_data пуста ('', NULL или '{}'), Database::trueJSON() в любом из этих
            // случаев отдаёт клиенту буквально JS-массив []. [] в JS truthy — проверка
            // `if(!this._data)` выше его НЕ ловит, _defaultData() не вызывается. Дальше
            // this._data.poker/.cards/.dice/.roulette дописываются как свойства ЭТОГО массива —
            // для чтения работает (JS не запрещает свойства на массивах), но _saveData() ниже
            // делает JSON.stringify(this._data): у Array сериализуются ТОЛЬКО числовые индексы,
            // все 4 именованных свойства молча отбрасываются — на сервер уходит буквально "[]",
            // подтверждая тот же баг на следующей загрузке. Раз навсегда: результат парсинга,
            // который оказался массивом (а не обычным объектом), для этого поля — испорченное
            // состояние, не валидные данные, — принудительно заменяем на _defaultData().
            if(!this._data || Array.isArray(this._data) || typeof this._data !== 'object') this._data = this._defaultData();
            const def  = this._defaultData();
            if(!this._data.poker)    this._data.poker    = def.poker;
            if(!this._data.cards)    this._data.cards    = def.cards;
            if(!this._data.dice)     this._data.dice     = def.dice;
            if(!this._data.roulette)  this._data.roulette  = def.roulette;
            if(!this._data.cards.aa_t)      this._data.cards.aa_t    = this._rand(90000,110000);
            if(!this._data.cards.kk_t)      this._data.cards.kk_t    = this._rand(70000,90000);
            if(!this._data.cards.qq_t)      this._data.cards.qq_t    = this._rand(8000,12000);
        } catch(e){ this._data = this._defaultData(); }
    }

    _saveData(){ udata['dvor_games_data'] = JSON.stringify(this._data); }

    // ── DAILY ─────────────────────────────────────────────────────────────────

    _today(){
        const d = new Date();
        return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    }

    // 24.09.2026 (баг "лимит покера сброшен на экране (0/25), но сервер сразу отвечает
    // 'лимит исчерпан'", по прямому указанию): раньше здесь сравнивалась дата из
    // udata['dvor_daily'] (её пишет ТОЛЬКО сервер, poker.php.deal() — своим PHP date('Y-m-d'),
    // серверный часовой пояс) с this._today() (new Date() на УСТРОЙСТВЕ игрока). Если часовой
    // пояс/часы клиента расходятся с сервером (обычный случай — сервер и клиент почти никогда
    // не в одном поясе), сравнение даты ложно не совпадает, и клиент молча обнулял ТОЛЬКО
    // отображаемый счётчик через _resetDaily() — реальный лимит на сервере как был исчерпан,
    // так и остаётся, поэтому следующий клик по «Играть» сразу бьёт в fail(80). _saveDaily()
    // (ниже) при этом ни разу не вызывается нигде в клиенте — dvor_daily физически пишет
    // только сервер, поэтому сверять "актуальность" даты на клиенте не нужно вообще: что
    // сервер прислал в удате, то и показываем, без самостоятельных решений о том, "сегодня"
    // это или нет (тот же урок, что уже применили для дневных лимитов боссов/зариков —
    // серверные часы, не клиентские).
    _loadDaily(){
        try{
            // 24.09.2026 (баг "лимит покера сброшен на экране (0/25), но сервер сразу отвечает
            // 'лимит исчерпан'", по прямому указанию + скриншот): комментарий выше уже объяснял
            // РАСХОЖДЕНИЕ ДАТ как причину — эта часть была исправлена, но сам raw JSON.parse()
            // остался и ломался по СОВСЕМ другой, более частой причине: сразу после
            // users.get() (первая загрузка страницы/возврат в игру) 'dvor_daily' приходит от
            // сервера уже РАСКОДИРОВАННЫМ ОБЪЕКТОМ (Database::trueJSON() в php раскодирует все
            // json-поля на каждом SELECT) — JSON.parse(объект) кидает SyntaxError, catch ниже
            // тихо звал _resetDaily() (пишет 0), хотя реальный счётчик на сервере мог быть уже
            // 25/25. Тот же класс бага уже чинили в bosses-combat.js/bosses_select.js/
            // achievements.js через helper.safeParseJSON() (принимает и строку, и объект) — тут
            // просто забыли применить его же.
            const d = helper.safeParseJSON(udata['dvor_daily'], {});
            this._pokerUsed     = d.poker      || 0;
            this._cardsFreeUsed = d.cards_free || false;
            this._diceFreeUsed  = d.dice_free  || false;
            this._bjFreeUsed    = d.bj_free    || false;
            this._dailyDate     = d.date || '';
        } catch(e){ this._resetDaily(); }
    }

    _resetDaily(){
        this._dailyDate = this._today();
        this._pokerUsed = this._cardsFreeUsed = this._diceFreeUsed = 0;
        this._cardsFreeUsed = this._diceFreeUsed = this._bjFreeUsed = false;
    }

    _saveDaily(){
        udata['dvor_daily'] = JSON.stringify({
            date: this._today(), poker: this._pokerUsed,
            cards_free: this._cardsFreeUsed, dice_free: this._diceFreeUsed,
            bj_free: this._bjFreeUsed,
        });
    }

    // ── СИГАРЕТЫ: кулдаун 30 минут на каждое облачко ─────────────────────────

    // 27.09.2026 (по прямому указанию — замена модели "1 раз в календарные сутки на облачко" на
    // индивидуальный кулдаун 30 минут на КАЖДОЕ из 4 облачков, независимо от суток): формат
    // dvor_daily_sigs сменился с {date, collected:[bool×4]} на {lastMs:[ms|null ×4]} — момент
    // последнего успешного сбора каждого облачка (серверное время, мс). Облачко "собрано"
    // (скрыто), пока не прошло SIG_COLLECT_COOLDOWN_MS с последнего lastMs[idx]; отсутствие
    // записи (null/undefined) — облачко ещё ни разу не собиралось, доступно сразу.
    // Возвращаемый массив — булевы "занято прямо сейчас" (true = кулдаун ещё идёт, спрайт
    // скрыт), та же семантика имени переменной, что и раньше (sigState[i] === true → спрятать).
    _getSigState(){
        try{
            // 24.09.2026: та же причина, что и у _loadDaily()/_loadData() выше — сразу после
            // users.get() поле уже может прийти объектом, не строкой.
            const d = helper.safeParseJSON(udata['dvor_daily_sigs'], {});
            const lastMs = Array.isArray(d.lastMs) ? d.lastMs : [];
            const now = Date.now();
            return [0,1,2,3].map(i => {
                const last = parseInt(lastMs[i]) || 0;
                return last > 0 && (now - last) < SIG_COLLECT_COOLDOWN_MS;
            });
        } catch(e){}
        return [false,false,false,false];
    }

    // 26.09.2026 (перенос на сервер — server/core/controllers/dvor.php.collectCig(), закрывает
    // дыру, задокументированную в tests/dead-code-audit-dvor-fla-roulette-removed-cig-cloud-
    // risk.test.js «Находка 1»): раньше клиент сам решал, можно ли собрать (dvor_daily_sigs
    // было обычным client-writable полем), и сам же дописывал +30 сигарет прямо в udata —
    // читер мог обнулить dvor_daily_sigs консолью браузера и собирать 4×30 сигарет сколько
    // угодно раз за день, либо просто подделать cigarettes напрямую через users.save. Теперь
    // idx (0-3) уходит на сервер, dvor_daily_sigs стало server-only полем (убрано из whitelist
    // users.php) — сервер сам сравнивает СВОЁ время с сохранённым lastMs[idx] и решает, можно
    // ли собрать (кулдаун 30 минут — см. комментарий у SIG_COLLECT_COOLDOWN_MS выше).
    // Локально — только визуальный клик-фидбек (спрятать облачко, всплывающий текст "+30"),
    // итоговое значение cigarettes/dvor_daily_sigs приходит ТОЛЬКО через applyPatch(e.patch) в
    // колбэке — до ответа сервера клиент не считает эти данные истиной.
    _collectCig(idx, spr){
        const state = this._getSigState();
        if(state[idx]) return; // чисто UI-подсказка (спрайт и так уже visible=false для собранных) — не источник правды

        spr.visible     = false;
        spr.interactive = false;
        spr.buttonMode  = false;
        const gp = spr.getGlobalPosition();
        this._showFloatingCig(gp.x, gp.y);

        TS.php('dvor.collectCig', {idx}, (e)=>{
            if(e && e.patch){
                applyPatch(e.patch);
                iface.updateUp();
                // 21.09.2026 (аудит "достижения появляются с задержкой") — сбор облачков
                // сигарет во дворе проверяет достижения ПОСЛЕ applyPatch (до ответа сервера
                // клиент не знает актуальное значение cigarettes).
                if(window.achievements) achievements._checkAll();
            }
        }, (err)=>{
            // Сервер отклонил (уже собрано — fail 52, гонка вкладок/двойной клик, обрыв связи)
            // — локальный оптимистичный фидбек не подтверждён, возвращаем облачко обратно.
            console.error('[dvor._collectCig] сервер отклонил сбор сигарет idx=' + idx + ':', JSON.stringify(err));
            spr.visible     = true;
            spr.interactive = true;
            spr.buttonMode  = true;
        });
    }

    _showFloatingText(x, y, text){
        const style = new PIXI.TextStyle({
            fontFamily: 'Southbank LT',
            fontSize: 26,
            fill: '#ffdd44',
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowDistance: 2,
            fontWeight: 'bold',
        });
        const txt = new PIXI.Text(text, style);
        txt.anchor.set(0.5);
        txt.x = x;
        txt.y = y;
        txt.alpha = 1;
        root.layer2_mc.addChild(txt);

        const startY   = y;
        const endY     = y - 130;
        const duration = 1800;
        const startT   = Date.now();

        const tick = () => {
            const t = Math.min((Date.now() - startT) / duration, 1);
            txt.y = startY + (endY - startY) * t;
            if(t > 0.6) txt.alpha = 1 - (t - 0.6) / 0.4;
            if(t >= 1){
                if(txt.parent) txt.parent.removeChild(txt);
                txt.destroy();
            } else {
                requestAnimationFrame(tick);
            }
        };
        requestAnimationFrame(tick);
    }

    _showFloatingCig(x, y){
        // 22.09.2026 (по прямому указанию): шрифт белый (было жёлтое #ffdd44), иконка сигарет
        // сдвинута влево на 8px (было вплотную к тексту, icon.x = txt.width).
        const style = new PIXI.TextStyle({
            fontFamily: 'Southbank LT', fontSize: 26, fill: '#ffffff',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 2, fontWeight: 'bold',
        });
        const txt = new PIXI.Text('+30 ', style);
        txt.anchor.set(0, 0.5);

        const icon = new PIXI.Sprite(PIXI.Texture.from('./images/боевка награда Сиги.png'));
        icon.anchor.set(0, 0.5);
        icon.width = 50;
        icon.height = 50;

        const container = new PIXI.Container();
        container.addChild(txt);
        icon.x = txt.width - 8;
        container.addChild(icon);

        const totalW = txt.width + icon.width;
        container.pivot.x = totalW / 2;
        container.pivot.y = 0;
        container.x = x; container.y = y; container.alpha = 1;
        root.layer2_mc.addChild(container);

        const startY = y, endY = y - 130, duration = 1800, startT = Date.now();
        const tick = () => {
            const t = Math.min((Date.now() - startT) / duration, 1);
            container.y = startY + (endY - startY) * t;
            if(t > 0.6) container.alpha = 1 - (t - 0.6) / 0.4;
            if(t >= 1){
                if(container.parent) container.parent.removeChild(container);
                container.destroy({ children: true });
            } else { requestAnimationFrame(tick); }
        };
        requestAnimationFrame(tick);
    }

    // ── PIXI ЛОББИ ────────────────────────────────────────────────────────────

    _CLOUDS(){
        return [
            { file:'cloud_blackjack.png', game:'cards',    x: 383, y: 241 },
            { file:'cloud_poker.png',     game:'poker',    x: 159, y: 226 },
            { file:'cloud_roulette.png',  game:'roulette', x: 545, y: 285 },
            { file:'cloud_dice.png',      game:'dice',     x:1152, y: 257 },
        ];
    }

    _SIGS(){
        return [
            { file:'cloud_sig_1.png', x: 215, y: 323 },
            { file:'cloud_sig_2.png', x: 591, y: 217 },
            { file:'cloud_sig_3.png', x: 703, y: 220 },
            { file:'cloud_sig_4.png', x: 788, y: 264 },
        ];
    }

    _buildLobby(){
        const w = new PIXI.Container();
        this._dvorCloudSprites = [];

        const bg = new PIXI.Sprite(PIXI.Texture.from('./images/вкладка двор.png'));
        bg.width = 1280;
        bg.height = 546;
        w.addChild(bg);

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1240;
        exitBtn.y = 32;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>this.close());
        w.addChild(exitBtn);

        for(const c of this._CLOUDS()){
            const spr = new PIXI.Sprite(PIXI.Texture.from('./images/' + c.file + '?' + (window.session_hash || '')));
            spr.anchor.set(0.5);
            spr.x = c.x; spr.y = c.y + 28;
            spr.interactive = true; spr.buttonMode = true;
            spr.on('pointerover', ()=>{ _ss(spr, 1.08); });
            spr.on('pointerout', ()=>{ _ss(spr, 1.0); });
            spr.on('pointerdown',  ()=>{ this._setTutorialCloudHighlight(false); spr.scale.set(1.0); this._openGame(c.game); });
            w.addChild(spr);
            this._dvorCloudSprites.push(spr);
        }

        this._cigSprites = [];
        const sigState   = this._getSigState();
        for(let i=0; i<4; i++){
            const s   = this._SIGS()[i];
            const spr = new PIXI.Sprite(PIXI.Texture.from('./images/' + s.file + '?' + (window.session_hash || '')));
            spr.anchor.set(0.5);
            spr.x = s.x; spr.y = s.y + 28;
            spr.visible     = !sigState[i];
            spr.interactive = !sigState[i];
            spr.buttonMode  = !sigState[i];
            const idx = i;
            spr.on('pointerover',  ()=>{ if(spr.visible) spr.scale.set(1.1); });
            spr.on('pointerout', ()=>{ _ss(spr, 1.0); });
            spr.on('pointerdown',  ()=>{ spr.scale.set(1.0); this._collectCig(idx, spr); });
            w.addChild(spr);
            this._cigSprites.push(spr);
        }

        this._lobbyWin = w;
    }

    // Первый шаг обучения во Дворе: четыре игровых облака заметно пульсируют и чуть
    // увеличиваются, тем же способом, что ресурсы в шаге «Валюта». Это не меняет hover и
    // не делает облака некликабельными.
    _setTutorialCloudHighlight(enabled){
        if(this._dvorCloudHighlightTick){
            PIXI.Ticker.shared.remove(this._dvorCloudHighlightTick);
            this._dvorCloudHighlightTick = null;
        }
        const clouds = this._dvorCloudSprites || [];
        if(!enabled){
            clouds.forEach(s => { if(s && !s.destroyed){ s.alpha = 1; s.scale.set(1); } });
            return;
        }
        let t = 0;
        const tick = () => {
            t += 0.06;
            const pulse = (Math.sin(t * 3) + 1) / 2;
            clouds.forEach(s => {
                if(!s || s.destroyed) return;
                s.alpha = 0.58 + pulse * 0.42;
                s.scale.set(1.03 + pulse * 0.07);
            });
        };
        tick();
        PIXI.Ticker.shared.add(tick);
        this._dvorCloudHighlightTick = tick;
    }

    _refreshCigSprites(){
        if(!this._cigSprites) return;
        const state = this._getSigState();
        for(let i=0;i<4;i++){
            const spr       = this._cigSprites[i];
            spr.visible     = !state[i];
            spr.interactive = !state[i];
            spr.buttonMode  = !state[i];
        }
    }

    // ── НАВИГАЦИЯ ─────────────────────────────────────────────────────────────

    _openGame(name){
        if(name === 'poker'){ this._openPokerScreen(); return; }
        if(name === 'cards'){ this._openBlackjackScreen(); return; }
        if(name === 'dice'    ){ this._openDiceScreen();      return; }
        if(name === 'roulette'){ this._openRouletteScreen(); return; }
        this.currentGame = name;
        home.closeScreen();

        const panels = ['dice','poker','cards','roulette'];
        panels.forEach(g => { if(this.win[g+'_panel']) this.win[g+'_panel'].visible = g === name; });
        if(this.win.tiles)     this.win.tiles.visible     = false;
        if(this.win.butt_back) this.win.butt_back.visible = true;

        this.win.setTransform(40, 19);
        home.openScreen(this.win);
        this._initPanel(name);
    }

    _backToLobby(){
        if(this.currentGame && this.win[this.currentGame+'_panel'])
            this.win[this.currentGame+'_panel'].visible = false;
        this.currentGame = null;
        home.closeScreen();
        this._refreshCigSprites();
        home.openScreen(this._lobbyWin);
    }

    _bindGamePanels(){
        const dp = this.win.dice_panel;
        if(dp && dp.butt_roll)  dp.butt_roll.on('pointerdown',  ()=>this._playDice());

        // 26.09.2026 (аудит "мёртвый vs живой код перед миграцией экономики двора"):
        // roulette_panel.butt_red/butt_spin убраны — вели на _playRoulette() (старая FLA
        // рулетка с client-side RNG/pity/начислением), которая сама удалена как мёртвый
        // эксплойт (см. подробный разбор в dvor-roulette.js — недостижима через UI по той же
        // причине, что и cards_panel/poker_panel ниже, и не вызывается программно нигде,
        // в отличие от dice_panel.butt_roll выше, который нужен авто-боту bot.js).

        // 18.09.2026 (аудит безопасности): cards_panel.butt_deal убран — эта кнопка никогда
        // не была доступна кликом (см. _openGame ниже: 'cards' всегда уходит на
        // _openBlackjackScreen() раньше, чем cards_panel становится visible), а привязанные
        // _playCards()/_resolveCards() были удалены из dvor-cards.js как мёртвый, но
        // вызываемый из консоли (dvor._playCards()) необсчитываемый сервером генератор
        // наград — см. dvor-cards.js для подробностей.

        // 18.09.2026 (перенос Покера на сервер): poker_panel.butt_deal убран — эта кнопка
        // никогда не была доступна кликом (см. _openGame ниже: 'poker' всегда уходит на
        // _openPokerScreen() раньше, чем poker_panel становится visible), а привязанный
        // _playPoker() был удалён вместе со старой FLA-панелью (dvor-poker.js).
    }

    _setTxt(c, f, v){ if(c && c[f] && c[f].text !== undefined) c[f].text = v; }

    _initPanel(name){
        this._rolling = false;
        const p   = this.win[name+'_panel'];
        if(!p) return;
        const lvl = this._getLevelInfo(name);
        this._setTxt(p, 'result_txt', '');
        this._setTxt(p, 'level_txt',  'Уровень: ' + lvl.level);
        this._setTxt(p, 'exp_txt',    lvl.maxed ? 'МАКС' : lvl.cur + '/' + lvl.next);

        if(name === 'dice'){
            ['p_die1','p_die2','e_die1','e_die2'].forEach(k=>this._setTxt(p,k,'?'));
            this._setTxt(p,'bet_txt', !this._diceFreeUsed ? 'Бесплатно' : '1 🔴 поинт (10р)');
        }
        // 'cards' — ветка убрана 18.09.2026 (тот же аудит, что удаление _playCards из
        // dvor-cards.js): _initPanel('cards') недостижима по той же причине, что и 'poker'
        // ниже (_openGame уводит на _openBlackjackScreen() раньше этого вызова).
        // 'poker' — ветка убрана 18.09.2026: _initPanel('poker') недостижима (см. _openGame
        // ниже, 'poker' всегда уходит на _openPokerScreen() раньше этого вызова), а
        // _getPokerSlots() удалена вместе со старой FLA-панелью покера.
        if(name === 'roulette'){
            this._setTxt(p,'num_txt','?');
            this._setTxt(p,'color_txt','Крути!');
            this._setTxt(p,'bet_txt','1 🔵 поинт (10р)');
        }
    }

    // ── УРОВНИ ────────────────────────────────────────────────────────────────

    _pokerExpPerStep(lv){
        if(lv<=10)return 6; if(lv<=20)return 8;  if(lv<=30)return 10;
        if(lv<=40)return 11;if(lv<=50)return 13; if(lv<=60)return 15;
        if(lv<=70)return 16;if(lv<=80)return 18; if(lv<=90)return 20;
        return 22;
    }

    _pokerLevelInfo(exp){
        let lv=0, used=0;
        while(lv<100){ const s=this._pokerExpPerStep(lv+1); if(used+s>exp)break; used+=s; lv++; }
        // На макс. уровне (100) цикл выше останавливается, но exp продолжает копиться дальше
        // бесконечно (игра не запрещает играть после 100) — cur=exp-used рос бы неограниченно
        // (напр. "98613/22", т.к. _pokerExpPerStep(101) просто падает в ветку "return 22"),
        // хотя реального следующего уровня не существует. maxed:true — экран показывает "МАКС".
        if(lv >= 100) return {level:100, cur:0, next:1, maxed:true};
        return {level:lv, cur:exp-used, next:this._pokerExpPerStep(lv+1), maxed:false};
    }

    _simpleLevelInfo(exp){
        return {level:Math.min(100,Math.floor(exp/10)), cur:exp%10, next:10};
    }

    _getLevelInfo(game){
        if(!this._data) return {level:0,cur:0,next:10};
        const exp = this._data[game].exp||0;
        return game==='poker' ? this._pokerLevelInfo(exp) : this._simpleLevelInfo(exp);
    }

    _addExp(game, n){
        if(!this._data) return;
        this._data[game].exp = (this._data[game].exp||0)+n;
        this._saveData();
        // 28.09.2026 (по прямому репорту — "поиграл в казино, вышел, зашёл снова, уровень/опыт
        // не сохранился"): _saveData() только кладёт свежий JSON в udata['dvor_games_data'] —
        // реальная отправка на сервер шла ИСКЛЮЧИТЕЛЬНО через общий 500мс-дебаунс автосейва
        // (player-save.js), без единого форс-флаша здесь. Если игрок закрывал Mini App раньше,
        // чем дебаунс успевал сработать (или в этом окне что-то ещё приостанавливало автосейв —
        // например bank.js._refreshBalanceAfterPurchase(), см. фикс там же), свежая экспа
        // терялась молча — visibilitychange/pagehide уже задокументированы в проекте (skills.js)
        // как ненадёжные в VK-вебвью. flushPlayerSave() форсирует отправку сразу же, тем же
        // паттерном, что уже используется перед boss/zone/yashik-запросами.
        if(window.flushPlayerSave) flushPlayerSave('dvor_addExp:' + game);
        const {level} = this._getLevelInfo(game);
        if(window.achievements && typeof achievements.onDvorLevel === 'function') achievements.onDvorLevel(game, level);
    }

    // ── НАЧИСЛЕНИЕ НАГРАД ─────────────────────────────────────────────────────

    _give(type, amount){
        switch(type){
            case 'stew':    udata['stew']=(parseInt(udata['stew']||0)+amount).toString(); break;
            case 'cig':     udata['cigarettes']=(parseInt(udata['cigarettes']||0)+amount).toString(); break;
            case 'exp':
                udata['exp']=(parseInt(udata['exp']||0)+amount).toString();
                if(window.battlepass) battlepass.addXp(Math.max(1,Math.floor(amount/100)));
                break;
            case 'coins':
                udata['coins']=(parseInt(udata['coins']||0)+amount).toString();
                udata['coins_earned']=(parseInt(udata['coins_earned']||0)+amount).toString();
                break;
            case 'respect': udata['respect']=(parseInt(udata['respect']||0)+amount).toString(); break;
            case 'energy':{
                const mx=parseInt(udata['max_energy']||50)+150;
                udata['energy']=Math.min(mx,parseInt(udata['energy']||0)+amount).toString(); break;
            }
            case 'red_points':        udata['dice_points']=(parseInt(udata['dice_points']||0)+amount).toString(); break;
            case 'blue_points':       udata['blue_points']=(parseInt(udata['blue_points']||0)+amount).toString(); break;
            case 'chips':             udata['poker_chips']=(parseInt(udata['poker_chips']||0)+amount).toString(); break;
            case 'auto':              if(window.weapons) weapons.grantAmmo('auto', amount); else udata['ammo_auto']=(parseInt(udata['ammo_auto']||0)+amount).toString(); break;
            case 'gun':               if(window.weapons) weapons.grantAmmo('gun', amount); else udata['ammo_gun']=(parseInt(udata['ammo_gun']||0)+amount).toString(); break;
            case 'machete':           if(window.weapons) weapons.grantAmmo('machete', amount); else udata['ammo_machete']=(parseInt(udata['ammo_machete']||0)+amount).toString(); break;
            case 'roulette_spichki':
                udata['roulette_spichki']=(parseInt(udata['roulette_spichki']||0)+amount).toString();
                if(window.achievements) achievements.onDvorGame('roulette_spichki',{total:parseInt(udata['roulette_spichki'])});
                break;
            // 17.09.2026: было udata['habar_counts'] — коллизия с JSON-массивом контейнеров
            // Хабара в habar.php, см. комментарий в yashik.js. Переименовано в stash_count.
            case 'stash': udata['stash_count']=(parseInt(udata['stash_count']||0)+amount).toString(); break;
        }
        udata['dvor_games']=(parseInt(udata['dvor_games']||0)+1).toString();
        iface.updateUp();
        // 21.09.2026 (аудит "достижения появляются с задержкой") — единая точка наград Двора
        // (казино-игры, включая джекпот рулетки — dvor-roulette-minigame.js._give('coins', ...))
        // не имела общей проверки — только 2 частных onDvorGame() для спичек покера/рулетки.
        // Одна проверка здесь разом закрывает ВСЕ типы наград, идущие через _give().
        if(window.achievements) achievements._checkAll();
    }

    // ── OPEN / CLOSE ──────────────────────────────────────────────────────────

    open(){
        this._startDvorMusic();
        this._loadData();
        this._loadDaily();
        if(this._lobbyWin && this._lobbyWin.parent){
            this._lobbyWin.parent.removeChild(this._lobbyWin);
        }
        this._lobbyWin = null;
        this._buildLobby();

        const TOP_HUD = 58;
        const BOT_HUD = 604;

        const wrap = new PIXI.Container();
        wrap.interactive = true;

        const midBlock = new PIXI.Graphics();
        midBlock.beginFill(0x000000, 0.001);
        midBlock.drawRect(0, TOP_HUD, 1280, BOT_HUD - TOP_HUD);
        midBlock.endFill();
        midBlock.interactive = true;
        wrap.addChild(midBlock);

        this._lobbyWin.y = 58;
        this._lobbyWin.interactive = true;
        if(this._lobbyWin.children[0]){
            this._lobbyWin.children[0].interactive = true;
            this._lobbyWin.children[0].height = 546;
        }
        wrap.addChild(this._lobbyWin);

        const maskGfx = new PIXI.Graphics();
        maskGfx.beginFill(0xffffff);
        maskGfx.drawRect(0, TOP_HUD, 1280, BOT_HUD - TOP_HUD);
        maskGfx.endFill();
        wrap.addChild(maskGfx);
        this._lobbyWin.mask = maskGfx;

        this._dvorWrap = wrap;
        root.layer2_mc.addChild(wrap);

        // 29.09.2026 (тот же класс бага, что в shmot_shop.js — см. коммент там): раньше здесь
        // стоял просто iface.restoreHud(), Двор не заявлял свою потребность в декларативный
        // ХУД-стек (interface.js.pushHud/popHud) и на открытие поверх экрана, который прячет
        // низ ХУДа (например боя с боссом), наследовал эту чужую настройку вместо своего
        // дефолта (оба ХУДа видны — Двор обычный экран нижней панели).
        if(window.iface) iface.pushHud('dvor', {});
    }

    close(){
        this._setTutorialCloudHighlight(false);
        this._stopDvorMusic();
        this._stopDiceTimer();
        if(this._roulWin && this._roulWin.parent)       this._roulWin.parent.removeChild(this._roulWin);
        if(this._diceWin && this._diceWin.parent)       this._diceWin.parent.removeChild(this._diceWin);
        this._diceWin = null;
        if(this._blackjackWin && this._blackjackWin.parent) this._blackjackWin.parent.removeChild(this._blackjackWin);
        this._blackjackWin = null;
        if(this._pokerWin && this._pokerWin.parent) this._pokerWin.parent.removeChild(this._pokerWin);
        if(this._lobbyWin) this._lobbyWin.mask = null;
        if(this._dvorWrap && this._dvorWrap.parent){
            this._dvorWrap.parent.removeChild(this._dvorWrap);
        }
        this._dvorWrap = null;
        this._lobbyWin = null;

        // 29.09.2026: popHud вместо ручного форсированного addChild — снимает СВОЮ запись из
        // стека и восстанавливает требование экрана ПОД Двором, если он был открыт поверх
        // экрана, скрывающего низ ХУДа (см. коммент в open() выше).
        if(window.iface) iface.popHud('dvor');
        try{ home.closeScreen(); } catch(e){}
    }
}

attachPoker(Dvor.prototype);
attachRoulette(Dvor.prototype);
attachDice(Dvor.prototype);
attachBlackjack(Dvor.prototype);
attachCards(Dvor.prototype);
attachDvorMusic(Dvor.prototype);
