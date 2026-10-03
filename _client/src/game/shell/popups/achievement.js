/** Попап "Достижение выполнено" — показывается при получении новой ачивки/сбора заначки.
 * Ассеты (15.09.2026): C:\Users\HONOR\Desktop\vk_game\достижения\ →
 * ./images/попап достижения.png (плашка, 457×156), ./images/achievements/*.png (иконки
 * категорий), ./images/stashes/*.png (иконки заначек).
 */
export function attachAchievementPopup(proto){
    const AI = './images/achievements/';
    const SI = './images/stashes/';

    // Плашка PSD: X:438 Y:455 (см. скриншот редактора) — используем как позицию контейнера
    // напрямую, весь остальной контент строится в ЛОКАЛЬНЫХ координатах относительно неё.
    const PLATE_X = 438, PLATE_Y = 455;
    // Слот иконки (достижение/заначка) — PSD: X:484 Y:485 W:79 H:86 → локально относительно
    // плашки: (484-438, 485-455) = (46, 30). Один и тот же слот для ЛЮБОЙ иконки категории.
    const ICON_X = 46, ICON_Y = 30, ICON_W = 79, ICON_H = 86;

    // Иконка по категории — картинки достижений (однозначное соответствие по смыслу).
    const CAT_ICON = {
        damage:     AI + 'нанести урон.png',
        auto:       AI + 'калаш.png',
        gun:        AI + 'ствол.png',
        machete:    AI + 'мачете.png',
        solo:       AI + 'победа соло босса.png',
        kill:       AI + 'победа над боссом.png',
        fast:       AI + 'победа над боссом за час.png',
        skills:     AI + 'прокачка скиллов.png',
        zone_clear: AI + 'зона пройдена.png',
        energy:     AI + 'потратить энку.png',
        // Экономические + прочие (15.09.2026)
        exp:          AI + 'опыт.png',
        cig_hoard:    AI + 'сиги.png',
        coins_hoard:  AI + 'рубли.png',
        stew_hoard:   AI + 'тушенка.png',
        gym:          AI + 'качалка.png',
        strength:     AI + 'сила.png',
        pvp:          AI + 'бой с игроком.png',
        streak:       AI + 'Заход в игру без перерыва.png',
        spend_votes:  AI + 'потратить голоса.png',
        spend_coins:  AI + 'потратить рубли.png',
        spend_stew:   AI + 'потратить тушняк.png',
        friends:      AI + 'набрать друзей.png',
        // bp ("Бател Пасс") и meta ("Пройти достижения") — отдельной иконки в присланном
        // наборе нет, фолбэк на общую (см. return ниже).
    };
    // Заначки — картинки нычек, ключ 1-в-1 совпадает с zone.js this.stashes[].key.
    // ВАЖНО: для 'y_koll' ("Коллекционер", Янтарь) присланной иконки нет — фолбэк на общую.
    const STASH_ICON = {
        k_lezv: SI+'по лезвию.png', k_lyub: SI+'любитель.png',        k_avto: SI+'автоматчик.png',
        s_yuv:  SI+'ювелир.png',    s_sysh: SI+'сыщик.png',           s_met:  SI+'металлоискатель.png',
        d_umn:  SI+'умник.png',     d_az:   SI+'азартный.png',        d_kost: SI+'костолом.png',
        a_rast: SI+'растаман.png',  a_kur:  SI+'куряга.png',          a_pozh: SI+'пожарник.png',
        y_muz:  SI+'музыкант.png',  y_kegl: SI+'кегля.png',
    };

    const BOSS_NAMES = ['Охотник','Счастливчик','Ястреб','Меченный','Крыс','Баркут','Борода','Жгут'];
    const LOC_NAMES  = ['Кордон','Свалка','Темная Долина','Агропром','Янтарь'];
    const ZONE_CLEAR_LOC = {zk_k:0, zk_s:1, zk_d:2, zk_a:3, zk_y:4};
    const STASH_NAMES = {
        k_lezv:'По лезвию', k_lyub:'Любитель',       k_avto:'Автоматчик',
        s_yuv:'Ювелир',     s_sysh:'Сыщик',          s_met:'Металлоискатель',
        d_umn:'Умник',      d_az:'Азартный',         d_kost:'Костолом',
        a_rast:'Растаман',  a_kur:'Куряга',          a_pozh:'Пожарник',
        y_koll:'Коллекционер', y_muz:'Музыкант',     y_kegl:'Кегля',
    };
    const POKER_COMBO_LABEL = {kare:'Каре', sf:'Стрит-Флеш', rf:'Роял-Флеш'};
    const CARD_COMBO_LABEL  = {'77':'Семерки','88':'Восьмерки','99':'Девятки','tt':'Десятки','jj':'Валеты','qq':'Дамы','kk':'Короли','aa':'Тузы'};

    function _fmt(n){
        if(n >= 1000000) return (n % 1000000 === 0 ? n/1000000 : (n/1000000).toFixed(1)) + 'кк';
        if(n >= 1000)    return (n % 1000    === 0 ? n/1000    : (n/1000).toFixed(1))    + 'к';
        return String(n);
    }
    // Порог зашит в самой check-функции (напр. s=>s.dmg>=10000) — вместо дублирования
    // значений отдельным полем вытаскиваем число прямо из исходника функции.
    function _threshold(a){
        const m = a.check.toString().match(/(\d+)/);
        return m ? parseInt(m[1]) : 0;
    }

    proto._achievementIconFor = function(a){
        if(a.cat === 'stash'){
            const key = a.id.replace(/^st_/, '').replace(/(1|10)$/, '');
            return STASH_ICON[key] || (AI + 'достижения.png');
        }
        if(a.cat === 'poker'){
            if(a.id.indexOf('sp') === 0 || /_sp\d/.test(a.id)) return AI + 'покер спички.png';
            if(POKER_COMBO_LABEL[a.id.replace('pkr_','')]) return AI + 'покер комбинации.png';
            return AI + 'покер.png';
        }
        if(a.cat === 'roulette'){
            return /_sp\d/.test(a.id) ? (AI + 'спички в колесе.png') : (AI + 'рулетка.png');
        }
        if(a.cat === 'cards'){
            return AI + 'достижения.png'; // нет отдельной иконки для СОРВИ КУШ в присланном наборе
        }
        return CAT_ICON[a.cat] || (AI + 'достижения.png');
    };

    // Описание "что нужно сделать" — генерируется из категории + порога, зашитого в check().
    proto._achievementDesc = function(a){
        const n = _threshold(a);
        switch(a.cat){
            case 'damage':  return 'Нанеси ' + _fmt(n) + ' суммарного урона';
            case 'auto':    return 'Накопи ' + _fmt(n) + ' автоматов';
            case 'gun':     return 'Накопи ' + _fmt(n) + ' стволов';
            case 'machete': return 'Накопи ' + _fmt(n) + ' мачете';
            case 'skills':  return 'Прокачай суммарно ' + n + ' уровней навыков';
            case 'energy':  return 'Потрать суммарно ' + _fmt(n) + ' энергии';
            case 'exp':         return 'Накопи ' + _fmt(n) + ' опыта';
            case 'cig_hoard':   return 'Накопи ' + _fmt(n) + ' сигарет';
            case 'coins_hoard': return 'Накопи ' + _fmt(n) + ' рублей';
            case 'stew_hoard':  return 'Накопи ' + _fmt(n) + ' тушенки';
            case 'gym':         return 'Потренируйся в качалке ' + n + ' раз';
            case 'strength':    return 'Прокачай характеристику «Сила» суммарно на ' + _fmt(n) + ' опыта';
            case 'pvp':         return 'Победи в ' + n + ' боях с игроками';
            case 'streak':      return 'Заходи в игру ' + n + ' дней подряд без перерыва';
            case 'bp':          return 'Достигни ' + n + ' уровня в Бател Пассе';
            case 'spend_votes': return 'Потрать ' + _fmt(n) + ' голосов';
            case 'spend_coins': return 'Потрать ' + _fmt(n) + ' рублей';
            case 'spend_stew':  return 'Потрать ' + _fmt(n) + ' тушенки';
            case 'friends':     return 'Набери ' + _fmt(n) + ' друзей в игре';
            case 'meta':        return 'Набери ' + _fmt(n) + ' очков достижений суммарно';
            case 'solo': {
                const idx = parseInt(a.id.replace('solo_', ''));
                return 'Победи «' + (BOSS_NAMES[idx] || '?') + '» в СОЛО-режиме';
            }
            case 'kill': {
                const idx = parseInt(a.id.replace('kill_', ''));
                return 'Победи босса «' + (BOSS_NAMES[idx] || '?') + '»';
            }
            case 'fast': {
                const idx = parseInt(a.id.replace('fast_', ''));
                return 'Победи «' + (BOSS_NAMES[idx] || '?') + '» меньше чем за час';
            }
            case 'zone_clear': {
                const prefix = a.id.slice(0, 4); // 'zk_k','zk_s','zk_d','zk_a','zk_y'
                const locIdx = ZONE_CLEAR_LOC[prefix];
                return 'Зачисти локацию «' + (LOC_NAMES[locIdx] || '?') + '» ' + n + ' раз';
            }
            case 'stash': {
                const key = a.id.replace(/^st_/, '').replace(/(1|10)$/, '');
                const tier = a.id.endsWith('10') ? 10 : 1;
                return 'Собери заначку «' + (STASH_NAMES[key] || '?') + '» ' + (tier === 1 ? 'первый раз' : tier + ' раз');
            }
            case 'cards': {
                if(a.id.startsWith('crd_l')) return 'Достигни ' + n + ' уровня в СОРВИ КУШ';
                const combo = a.id.replace('crd_', '');
                return 'Собери комбинацию «' + (CARD_COMBO_LABEL[combo] || combo) + '» в СОРВИ КУШ';
            }
            case 'poker': {
                if(a.id.startsWith('pkr_l'))  return 'Достигни ' + n + ' уровня в покере';
                if(a.id.indexOf('sp') !== -1) return 'Собери ' + _fmt(n) + ' спичек в покере';
                const combo = a.id.replace('pkr_', '');
                return 'Собери комбинацию «' + (POKER_COMBO_LABEL[combo] || combo) + '» в покере';
            }
            case 'roulette': {
                if(a.id.startsWith('rul_l'))  return 'Достигни ' + n + ' уровня в рулетке';
                if(a.id.indexOf('sp') !== -1) return 'Собери ' + _fmt(n) + ' спичек в рулетке';
                return '';
            }
            default: return '';
        }
    };

    // Сумма очков ВСЕХ достижений сегмента (макс. возможное) / уже заработанных в нём.
    proto._achievementSegmentTotal = function(cat){
        return this.list.reduce((s, a) => a.cat === cat ? s + a.pts : s, 0);
    };
    proto._achievementSegmentEarned = function(cat){
        return this.list.reduce((s, a) => (a.cat === cat && this.earned[a.id]) ? s + a.pts : s, 0);
    };

    proto._openAchievementPopup = function(a, opts){
        console.log('[achievement._openAchievementPopup] показ ачивки | id:', a.id, '| name:', a.name, '| cat:', a.cat, '| pts:', a.pts);
        if(this._achPopupWin){
            this._achQueue = this._achQueue || [];
            this._achQueue.push(a);
            console.log('[achievement._openAchievementPopup] попап уже открыт, поставлено в очередь | длина очереди:', this._achQueue.length);
            return;
        }
        this._buildAchievementPopup(a, opts);
    };

    // opts.persistent — попап не гаснет сам (ни через gsap-таймлайн, ни через setTimeout) и
    // закрывается только тапом. Используется ТОЛЬКО из dev-панели (см. dev_panel.js
    // _testAchievementPopup) — раньше тестовый показ пропадал через ~3.8с сам по себе, чего
    // не хватало, чтобы спокойно подвигать элементы плашки через редактор позиций (✥).
    // Обычные боевые попапы (при реальном получении ачивки) opts не передают — ведут себя
    // как раньше (авто-исчезновение).
    proto._buildAchievementPopup = function(a, opts){
        const persistent = !!(opts && opts.persistent);
        const win = new PIXI.Container();
        win.x = PLATE_X; win.y = PLATE_Y;
        win.alpha = 0;
        win.interactive = true;

        const plate = new PIXI.Sprite(PIXI.Texture.from('./images/попап достижения.png'));
        win.addChild(plate);

        const iconPath = this._achievementIconFor(a);
        const icon = new PIXI.Sprite(PIXI.Texture.from(iconPath));
        icon.x = ICON_X; icon.y = ICON_Y; icon.width = ICON_W; icon.height = ICON_H;
        icon._uDraggable = true;
        win.addChild(icon);
        console.log('[achievement._buildAchievementPopup] иконка:', iconPath);

        // Позиции/масштаб (титул/описание/очки/общий счёт) и единый цвет шрифта #c3bcb4 —
        // уточнены пользователем через редактор позиций + Photoshop-пипетку 15.09.2026.
        const ACH_FONT_COLOR = '#c3bcb4';

        // Аудит 16.09.2026: раньше x/scale были подогнаны вручную под конкретные строки —
        // с текстом другой длины съезжало (то влево, то вправо смотрелось криво). Теперь
        // все три строки центрируются относительно текстового блока карточки (справа от
        // рамки иконки ICON_X+ICON_W=125, слева от звезды-медальона у totalTxt.x=400) —
        // anchor(0.5,0) + одинаковый x-центр даёт корректный вид при любой длине текста,
        // а wordWrap+align:'center' центрирует и перенесённые строки, если текст не влезает.
        const TEXT_CENTER_X = 262;
        const TEXT_MAX_WIDTH = 230;

        const titleTxt = new PIXI.Text(a.name.toUpperCase(), {
            fontFamily:'Southbank LT', fontSize:19, fill:ACH_FONT_COLOR, fontWeight:'bold',
            wordWrap:true, wordWrapWidth:TEXT_MAX_WIDTH, align:'center',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1,
        });
        titleTxt.anchor.set(0.5, 0);
        titleTxt.x = TEXT_CENTER_X; titleTxt.y = 61;
        titleTxt._uDraggable = true;
        win.addChild(titleTxt);

        const descStr = this._achievementDesc(a);
        const descTxt = new PIXI.Text(descStr.toUpperCase(), {
            fontFamily:'Southbank LT', fontSize:14, fill:ACH_FONT_COLOR,
            wordWrap:true, wordWrapWidth:TEXT_MAX_WIDTH, align:'center',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1,
        });
        descTxt.anchor.set(0.5, 0);
        descTxt.x = TEXT_CENTER_X; descTxt.y = 81;
        descTxt._uDraggable = true;
        win.addChild(descTxt);

        const segTotal  = this._achievementSegmentTotal(a.cat);
        const segEarned = this._achievementSegmentEarned(a.cat); // уже включает эту ачивку (earned[a.id] проставлен в _checkAll ДО вызова попапа)
        const scoreTxt = new PIXI.Text('ПОЛУЧЕНО ОЧКОВ: ' + segEarned + ' ИЗ ' + segTotal, {
            fontFamily:'Southbank LT', fontSize:13, fill:ACH_FONT_COLOR,
            wordWrap:true, wordWrapWidth:TEXT_MAX_WIDTH, align:'center',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1,
        });
        scoreTxt.anchor.set(0.5, 0);
        scoreTxt.x = TEXT_CENTER_X; scoreTxt.y = 105;
        scoreTxt._uDraggable = true;
        win.addChild(scoreTxt);

        // Общий счёт очков достижений игрока (звезда, зашитая в саму плашку справа).
        const totalTxt = new PIXI.Text(String(this.getTotalStars()), {
            fontFamily:'Southbank LT', fontSize:20, fill:ACH_FONT_COLOR, fontWeight:'bold',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1,
        });
        totalTxt.anchor.set(0.5, 0.5);
        totalTxt.x = 400; totalTxt.y = 75;
        totalTxt._uDraggable = true;
        win.addChild(totalTxt);

        console.log('[achievement._buildAchievementPopup] сегмент', a.cat, '| очков в сегменте:', segEarned, 'из', segTotal,
            '| общий счёт:', this.getTotalStars());

        root.layer2_mc.addChild(win);
        this._achPopupWin = win;

        const _advance = () => {
            if(win.parent) win.parent.removeChild(win);
            this._achPopupWin = null;
            if(this._achQueue && this._achQueue.length){
                const next = this._achQueue.shift();
                this._buildAchievementPopup(next);
            }
        };

        if(persistent){
            // Dev-режим: просто плавно проявляем и оставляем висеть до тапа.
            if(window.gsap){ gsap.killTweensOf(win); gsap.to(win, {alpha:1, duration:0.3}); }
            else win.alpha = 1;
            // Тап закрывает ТОЛЬКО в persistent-режиме — иначе тестовый показ из dev-панели
            // было бы вообще нечем убрать с экрана (нет автотаймера).
            win.on('pointerdown', () => {
                if(window.gsap) gsap.killTweensOf(win);
                _advance();
            });
        } else if(window.gsap){
            // По прямому указанию (16.09.2026) — время показа сокращено вдвое (было
            // 0.3+3.0+0.5=3.8с, стало 0.15+1.5+0.25=1.9с), и попап больше НЕ закрывается
            // по тапу игрока — только сам гаснет по таймеру.
            gsap.killTweensOf(win);
            gsap.timeline()
                .to(win, {alpha:1, duration:0.15})
                .to(win, {alpha:1, duration:1.5}) // держим на экране
                .to(win, {alpha:0, duration:0.25, onComplete:_advance});
        } else {
            win.alpha = 1;
            setTimeout(_advance, 1900);
        }
    };
}
