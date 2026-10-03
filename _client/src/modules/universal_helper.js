import { currencyNames } from './platform.js';

export default class UniHelp{
    constructor(){
        //Регистрация ключевых переменных класса
		
    }

    getJSON(link, complete, error){
        let request = new XMLHttpRequest();
        request.open('GET', link+'?h='+session_hash);
        request.responseType = 'json';
        request.send();

        request.addEventListener('loadend', () => {
            if(request.readyState === 4 && request.status === 200){
                complete(request.response);
            }else{
                error(errors[1]);
            }
        });
    }

    fadeAnimation(mc, type = 'none', time = 100, callback = null){
        let _start = Math.floor(performance.now());//время со старта приложения
        let timeOut = time;//время за которое нужно обновить число

        let interval = setInterval(()=>{
            let percent = (Math.floor(performance.now()) - _start) / timeOut;

            switch(type){
                case 'fadeIn':              // если тип анимации - плавное появление
                    mc.alpha = percent;
                    mc.visible = true;
                    break;
                case 'fadeOut':             // если тип анимации - плавное исчезновение
                    mc.alpha = 1 - percent;
                    break;
            }
            if(percent >= 1 || type == 'none'){               // если весь временной путь пройден
                if(type == 'fadeOut')mc.visible = false;

                if(mc.alpha > 1)mc.alpha = 1;
                if(mc.alpha < 0)mc.alpha = 0;

                clearInterval(interval);// отключаем таймер

                if(callback)callback(); // и вызываем функцию обратного вызова, если она задана
            }
        },1);
    }

    loadPhoto50(id, callback = null, url = null){
        let iof = bitmaps50['id'].indexOf(id);
        if(iof !== -1)url = bitmaps50['bm'][iof];

        if(!url)return bridge.sendPromise("VKWebAppCallAPIMethod", {method:'users.get', params:{fields:'photo_50', user_ids:id,access_token:VK_token, v:VK_version}}).then(data =>{
            this.loadPhoto50(id, callback, data['response'][0]['photo_50'])

            bitmaps50['id'].push(id);
            bitmaps50['bm'].push(data['response'][0]['photo_50']);
        });

        if(url !== null_photo50 && url.indexOf('http') !== 0){
            bitmaps50['id'].push(id);
            bitmaps50['bm'].push(null_photo50);

            return this.loadPhoto50(id, callback, null_photo50);
        }

        if(callback)callback(new PIXI.Sprite.from(url));
        return;
    }

    numberAnimation(tf, val, time, bol = true, txt = '', callback = null, delimiter = ','){
        //bol отвечает за PrettyNumber (числа с запятыми)

        if(tf.text == this.getNumberRazdel(val) + txt){
            if (callback) callback();
            return;
        }

        let _start = Math.floor(performance.now());//время со старта приложения
        let oldval = 0;

        txt == ''?oldval = parseInt(this.getValue(tf.text, delimiter)):oldval = parseInt(this.getValue(tf.text.split(txt)[0], delimiter));

        let newval = parseInt(val);
        let timeOut = time;//время за которое нужно обновить число

        let interval = setInterval(()=>{
            let percent = (Math.floor(performance.now()) - _start) / timeOut;

            /*if(newval<oldval){  
                bol?tf.text = this.getNumber(parseInt(oldval-((oldval-newval)*percent)), delimiter)+txt:tf.text = String(parseInt(oldval-((oldval-newval)*percent)))+txt;
            }else{
                bol?tf.text = this.getNumber(parseInt(oldval+((newval-oldval)*percent)), delimiter)+txt:tf.text = String(parseInt(oldval+((newval-oldval)*percent)))+txt;
            }*/

            if (newval < oldval) {
                bol ? tf.text = this.shortText(parseInt(oldval - ((oldval - newval) * percent)), delimiter) + txt : tf.text = this.getNumberRazdel(parseInt(oldval - ((oldval - newval) * percent))) + txt;
            } else {
                bol ? tf.text = this.shortText(parseInt(oldval + ((newval - oldval) * percent)), delimiter) + txt : tf.text = this.getNumberRazdel(parseInt(oldval + ((newval - oldval) * percent))) + txt;
            }

            if (percent >= 1){
                //bol?tf.text = this.getNumber(newval, delimiter)+txt:tf.text = String(newval)+txt;
                bol ? tf.text = this.shortText(newval, delimiter) + txt : tf.text = this.getNumberRazdel(newval)+txt;
                clearInterval(interval);

                if(callback)callback();
            }
        },1);
    }

    // K = тысячи, KK = миллионы (100K = 100 000, 1KK = 1 000 000)
    formatKK(n){
        n = Math.floor(n);
        if(n >= 1000000){
            const v = n / 1000000;
            return (v % 1 === 0 ? v : Math.floor(v * 10) / 10) + 'KK';
        }
        if(n >= 1000){
            const v = n / 1000;
            return (v % 1 === 0 ? v : Math.floor(v * 10) / 10) + 'K';
        }
        return String(n);
    }

    shortText(value, des = true, bigNumber = false){
        let ends = ['', 'K', 'M', 'B', 'T', 'q', 'Q', 's', 'S', 'O'];
        let nums = [1, 1000, 1000000, 1000000000, 1000000000000, 1000000000000000, 1000000000000000000, 1000000000000000000000, 1000000000000000000000000, 1000000000000000000000000000];
        let ind = nums.length - 1;

        if(bigNumber){
            while (BigInt(value) / BigInt(nums[ind]) < 1 && ind > 0) ind--;

            let transit = BigInt(value) / BigInt(nums[ind]);

            let end_num = des ? (Math.trunc(transit.toString() * 100) / 100) + ends[ind] : Math.trunc(transit.toString()) + ends[ind];

            return end_num;
        }

        while (value / nums[ind] < 1 && ind > 0) ind--;

        let transit = value / nums[ind];

        let end_num = des ? (Math.trunc(transit * 10) / 10) + ends[ind] : Math.trunc(transit) + ends[ind];

        return end_num;
    }

    getNumberRazdel(n, delimiter = ','){
        let arr = [];
        let s = '';

        arr = this.noExponents(n).toString().split('');//разбили строку на символы
        

        for(let i = 1; (i*3) < arr.length; i++){
            arr[(arr.length - (i*3))] = delimiter + arr[(arr.length - (i*3))];//впиливаем запятую после каждых 3 символов с конца
        }
        s = arr.join('');//собираем строку

        return s;
    }

    numberEnd(n, mode){
        // Модерация ОК (02.10.2026, п.4): "голос/голоса/голосов" — название VK-валюты
        // доната, жёстко хардкоженное везде. На ОК должно показываться "ОК/ОКа/ОКов" —
        // см. modules/platform.js.currencyNames() (единая точка определения площадки).
        let _names = {votes: currencyNames(),
                      stew: ['тушенка', 'тушенки', 'тушенок'],
                      coins: ['монета', 'монету', 'монет'],
                      cigarettes: ['сига', 'сигу', 'сиг']}
        let arr = [];
        let s = '';
        let s0 = n.toString();
        arr = s0.split(""); //бъем число на массив
        if(((arr[arr.length-1] == 2)||(arr[arr.length-1] == 3)||(arr[arr.length-1] == 4))&&(n!==0)&&(n!==12)&&(n!==13)&&(n!==14)){
            s = _names[mode][1]; //задаем значение строке
        } else if(arr[arr.length-1] == 1 && n!==11){
            s = _names[mode][0];
        } else {
            s = _names[mode][2];
        }

        return s;//выводим строку
    }

    noExponents(num){
		let data = String(num).split(/[eE]/);
		if(data.length == 1)return data[0];
		
		let z = '',
		sign = num < 0 ? '-' : '',
		str = data[0].replace('.', ''),
		mag = parseInt(data[1]) + 1;
		
		if (mag < 0) {
            z = sign + '0.';
            while (mag++) z += '0';
            return z + str.replace(/^\-/, '');
		}
        
		mag -= str.length;
		while (mag--) z += '0';
		return str + z;
	}

    duplicate(obj){
        return new obj.constructor();
    }
    
    encode64(text){
        return  btoa(unescape(encodeURIComponent(text)));
    }

    decode64(text){
        try{
            return decodeURIComponent(escape(window.atob(text)));
        }catch(e){
            return text;
        }
    }

    parse(json){
        let arr = [];

        try{
            arr = JSON.parse(json);
        }catch(e){}

        return arr;
    }

    hitTest(obj1,obj2){
      let XColl, YColl = false;

      if((obj1.x + obj1.width >= obj2.x) && (obj1.x <= obj2.x + obj2.width))XColl = true;
      if((obj1.y + obj1.height >= obj2.y) && (obj1.y <= obj2.y + obj2.height))YColl = true;

      if(XColl&YColl)return true;
      return false;
    }

    mouseTest(obj){
        let XColl, YColl = false;
        if(mouseXY.x >= obj.worldTransform.tx && mouseXY.x <= obj.worldTransform.tx + obj.width)XColl = true;
        if(mouseXY.y >= obj.worldTransform.ty && mouseXY.y <= obj.worldTransform.ty + obj.height)YColl = true;

        if(XColl&YColl)return true;
        return false;
    }

    isComplete(code, learn){//возвращает true для битовой маски, которая содержит число кратное 2 (прим. learn 11 = 1+2+8 вернет true при code = 1,2 или 8)
        let res = learn & code;
        if(res !== code)return false;
        return true;
    }

    objects(a,b){
        let key;
        for (key in b) {
            a[key] = b[key];
        }

        for (key in a) {
            a[key] = b[key];
        }
        return a;
    }

    getValue(s, delimiter = ','){    
        return parseInt(s.split(delimiter).join(''));
    }

    clearButton(button, set = false){
        button.buttonMode = false;
		button._events = {};
        if(set)setButton(button);
    }

    // 24.09.2026 (баг найден по прямому указанию — "не сохраняются ключи/лимиты боссов",
    // подтверждено прямым запросом к БД: dailyKills/keys на сервере были верны, проблема
    // только в отображении): поля с php_type='json' в схеме БД (server/core/models/database.php
    // .trueJSON()) сервер САМ раскодирует в объект при чтении (users.get) — то есть СРАЗУ
    // после загрузки страницы udata['bosses_data'] приходит уже ОБЪЕКТОМ, а не строкой.
    // JSON.parse(объект) кидает SyntaxError, которую весь код в проекте (bosses-combat.js/
    // bosses_select.js/achievements.js) молча глотал в try/catch{} — в результате dailyKills/
    // keys/killsTotal читались как несуществующие и тихо показывались нулями, хотя реальные
    // значения на сервере были целы. После ПЕРВОГО же успешного действия с боссом (attack/
    // startFight/claimKill) поле само "чинилось" обратно в строку через applyPatch() — баг
    // был виден только при заходе на экран боссов СРАЗУ после перезагрузки, до первого удара.
    // Эта функция — единая безопасная точка разбора: принимает и строку (JSON.parse), и уже
    // готовый объект/массив (отдаёт как есть), не бросает исключение ни в каком случае.
    safeParseJSON(value, fallback){
        if(value == null) return fallback;
        if(typeof value === 'object') return value;
        try{ return JSON.parse(value); } catch(e){ return fallback; }
    }

    // 27.09.2026 (адаптив под мобильные): расширяет ЗОНУ НАЖАТИЯ объекта, не меняя его
    // картинку. Нужно потому, что интерфейс размечен под мышь: стандартная кнопка выхода —
    // файл 62×58 при scale 0.5, то есть 31×29 логических пикселя. Логические 1280×720
    // вписываются в экран телефона с коэффициентом ~0.31 (портрет) — ~0.67 (ландшафт), значит
    // физически кнопка выходит 9–20 CSS-пикселей при рекомендованном минимуме ~44. Пальцем
    // такое попадается через раз.
    //
    // minLogical задаётся в ЛОГИЧЕСКИХ пикселях сцены (не в CSS): hitArea живёт в локальных
    // координатах объекта и не пересчитывается при изменении размера окна, поэтому привязывать
    // её к текущему масштабу экрана нельзя — берём запас, которого хватает в обеих ориентациях.
    // Зона расширяется симметрично от центра объекта, картинка/scale/позиция не трогаются.
    // Вызывать ПОСЛЕ того, как выставлены scale и текстура (нужен фактический размер).
    // 28.09.2026 (адаптив под мобильные): замена паттерну obj.on('pointerdown', fn) для всего,
    // что лежит ВНУТРИ прокручиваемых списков.
    //
    // Проблема: по всему проекту клик — это 'pointerdown', то есть действие срабатывает в момент
    // КАСАНИЯ. Мышью это незаметно, пальцем — фатально: любой свайп, начатый с карточки, сразу
    // её нажимает, поэтому свайп-прокрутку в списки нельзя было добавить в принципе.
    // onTap ждёт 'pointerup' и срабатывает, только если палец не уехал дальше threshold
    // логических пикселей — то есть отличает тап от протяжки. Порог 10 px: меньше — срабатывает
    // на дрожании пальца, больше — тап начинает ощущаться «вязким».
    //
    // Переводить на onTap ВСЁ подряд не нужно и вредно: кнопкам вне списков (выход, вкладки,
    // стрелки) реакция на pointerdown ощущается быстрее, и на них этот баг не проявляется.
    onTap(obj, fn, threshold = 10){
        if(!obj) return obj;
        obj.interactive = true;
        obj.buttonMode  = true;
        let active = false, moved = false, sx = 0, sy = 0;
        obj.on('pointerdown', (e)=>{
            active = true; moved = false;
            sx = e.data.global.x; sy = e.data.global.y;
        });
        obj.on('pointermove', (e)=>{
            if(!active || moved) return;
            if(Math.abs(e.data.global.x - sx) > threshold || Math.abs(e.data.global.y - sy) > threshold) moved = true;
        });
        obj.on('pointerup', (e)=>{
            const wasTap = active && !moved;
            active = false;
            // Флаг для вызывающего кода: иногда нужно знать, что жест был протяжкой, а не тапом.
            obj._lastGestureWasDrag = !wasTap;
            if(wasTap) fn(e);
        });
        // Палец ушёл с объекта — это точно не тап по нему.
        obj.on('pointerupoutside', ()=>{ active = false; obj._lastGestureWasDrag = true; });
        return obj;
    }

    touchPad(obj, minLogical = 72){
        if(!obj || !window.PIXI) return obj;
        const sx = Math.abs(obj.scale ? obj.scale.x : 1) || 1;
        const sy = Math.abs(obj.scale ? obj.scale.y : 1) || 1;
        // Требуемый размер в ЛОКАЛЬНЫХ координатах объекта: hitArea применяется до scale.
        const needW = minLogical / sx;
        const needH = minLogical / sy;
        let w = 0, h = 0;
        if(obj.texture && obj.texture.orig){ w = obj.texture.orig.width; h = obj.texture.orig.height; }
        if(!w || !h){ const b = obj.getLocalBounds(); w = b.width; h = b.height; }
        if(!w || !h) return obj;
        const ax = (obj.anchor ? obj.anchor.x : 0);
        const ay = (obj.anchor ? obj.anchor.y : 0);
        const padX = Math.max(0, (needW - w) / 2);
        const padY = Math.max(0, (needH - h) / 2);
        if(padX === 0 && padY === 0) return obj;
        obj.hitArea = new PIXI.Rectangle(-w * ax - padX, -h * ay - padY, w + padX * 2, h + padY * 2);
        return obj;
    }
}