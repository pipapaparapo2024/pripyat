import { detectPlatform } from './platform.js';

export default class Server{
	constructor(input_data, loading_movie){
		this.arr = input_data;
		this.mc = loading_movie;

		this.scriptURL = this.arr[2] + '/universal.php'; //ссылка на сервер

		this.reqs = [];
		this.wait = false; //чтобы случайно не закончить запрос

		this.reqsJSON = [];

		this.req_key = 'srUjnhko';


		if(!this.mc)return;

		this.mc.visible = false;
		this.mc.interactive = true;
		root.layer2_mc.addChild(this.mc);
	}

	php(method, yourParameters, onC, onE){
		this.reqs.push({"m":method, "p":yourParameters, "c":onC, "e":onE});
		this.nextReq();

		if(window.debug_mode){
			console.log(method);
			console.log(yourParameters);
		}
	}

	nextReq(){
		if(this.reqs.length <= 0 || this.wait)return; //тут же если что завершаем

		this.wait = true;
		
		this.thisReq = this.reqs.shift();
		this.loadReq(this.thisReq['m'], this.thisReq['p']);

		if(!this.mc)return;
		this.mc.visible = true;
		this.mc.compass_mc.gotoAndPlay(0);
	}
		
	loadReq(method, yourParameters){//запрос
		try{
			this.MSS = new XMLHttpRequest();//жрем клиентскую оперативу. КОСТЫЛЬ!

			this.parameters = JSON.stringify(yourParameters);//доп параметры

			this.MSSURL = this.scriptURL+ "?h=" + md5(Math.floor(Math.random() * 1000000).toString());//формируем уникальную ссылку

			// 18.09.2026: КРИТИЧЕСКИЙ БАГ — btoa() кидает InvalidCharacterError на любой строке
			// с символами вне Latin1 (т.е. НА ЛЮБОЙ КИРИЛЛИЦЕ — ник, названия боссов/предметов
			// в udata_json и т.д.). Раньше это исключение вылетало НЕПОЙМАННЫМ прямо здесь,
			// ДО this.MSS.send() — запрос физически не уходил, callback (ни success, ни error)
			// никогда не срабатывал, а хуже всего — this.wait оставался true НАВСЕГДА (сброс
			// происходит только в completeRequest(), которая теперь не вызывается вообще), из-за
			// чего ВСЯ очередь запросов (nextReq()) намертво зависала до перезагрузки страницы.
			// Это объясняло сразу несколько разных на вид багов: бой с боссом "вылетает в
			// главное меню" (bosses.startFight никогда не отвечал), Зарики "молчат при 0
			// поинтов" (ни ошибка, ни бросок) — стоило один раз где-то раньше отправить
			// users.save с кириллицей в udata, и вся сессия отказывала молча.
			// Стандартный fix: encodeURIComponent+unescape переводит UTF-8 строку в
			// Latin1-совместимую перед btoa — сервер (universal.php: base64_decode дважды)
			// на выходе получает те же самые UTF-8-байты, что и раньше для ASCII-строк —
			// формат не меняется, только теперь безопасно работает и с кириллицей.
			const b64safe = btoa(unescape(encodeURIComponent(this.parameters)));
			this.MSSparams = 'method='+method+'&api_id='+this.arr[0]+'&params='+this.spec_encode(btoa(b64safe))+'&token='+this.token+'&uid='+this.arr[1]; //кодируем параметры (оч тупо, надо чот придумать получше)
			this.MSSparams += '&req_key='+this.req_key; //защита от мультизапроса
			// Модерация ОК (02.10.2026, п.6: прогресс не должен синхронизироваться между
			// ОК и VK) — сервер физически не может определить площадку сам: Путь A рендерит
			// тот же бандл внутри обёртки ОК через тот же VK Bridge, и universal.php видит
			// только свой собственный домен в заголовках (AJAX с pripyat-game.ru на
			// pripyat-game.ru), а не ok.ru/vk.com родителя. Единственный, кто знает площадку —
			// клиент (modules/platform.js, по referrer/ancestorOrigins при загрузке iframe),
			// поэтому передаём её явно с КАЖДЫМ запросом; registry.php выбирает БД по этому
			// полю (но не доверяет ему для проверки подписи — api_secret общий для VK/ОК).
			this.MSSparams += '&platform='+detectPlatform();

			this.MSS.open("POST", this.MSSURL, true);//открыли сокет

			this.MSS.setRequestHeader("Content-type", "application/x-www-form-urlencoded");//ВАЖНО! без этого не будет передаваться тело запроса

			this.MSS.send(this.MSSparams);//закрыли сокет

			this.MSS.addEventListener("loadend", ()=>this.completeRequest(this.MSS));
		} catch(e){
			// Второй уровень защиты — даже если тут вылетит что-то ещё не предусмотренное,
			// очередь запросов больше не должна зависать навсегда: откатываем wait и идём дальше.
			console.error('[server.loadReq] запрос не отправлен из-за ошибки:', e.message, '| method:', method);
			this.wait = false;
			const failedReq = this.thisReq;
			if(failedReq && typeof failedReq['e'] === 'function') failedReq['e']({status:'error', text: e.message});
			this.nextReq();
		}
    }
		
	completeRequest(e){
		if(this.MSS.readyState === 4 && this.MSS.status === 200){
			try{
				this.json = JSON.parse(this.MSS.response.toString().trim());
			} catch(e){
				this.json = errors[2];
				this.json['status'] = 'error';
			}
    	} else {
    		this.json = errors[1];
    		this.json['status'] = 'error';
    	}

    	if(window.debug_mode)console.log(e);

		if(this.json['current_time'])TIME = parseInt(this.json['current_time']);

		this.parseUD();

		// 26.09.2026 (найдено по прямому репорту — 500 на users.setDevCombo вызвал следом
		// "Несовпадение подписи запроса" на РАЗДАЧЕ покера): при HTTP-статусе не 200 или битом
		// JSON completeRequest() выше подставляет errors[1]/errors[2] (window.errors,
		// index.js) — у ЭТИХ объектов нет поля req_key. Раньше строка ниже безусловно
		// перезаписывала this.req_key в undefined, из-за чего СЛЕДУЮЩИЙ любой запрос уходил с
		// буквальной строкой "&req_key=undefined" и гарантированно падал на сервере кодом 4,
		// даже если сам следующий запрос был совершенно не связан со сбойным. Теперь req_key
		// обновляется только если сервер реально его прислал — иначе остаётся последнее
		// известное валидное значение (сервер всё равно уже мог его повернуть на своей стороне
		// при фатальной ошибке ПОСЛЕ checkToken(), тогда следующий запрос один раз получит код 4
		// с уже СВЕЖИМ req_key в ответе и самовосстановится, вместо гарантированного повторного
		// краха на заведомо невалидном "undefined").
		if(this.json['req_key']) this.req_key = this.json['req_key'];
			
		this.json['status'] == "error"?this.onError():this.onComplete();

		if(this.mc)this.mc.visible = false;

		this.wait = false;

		this.nextReq();
	}
	
	onError(){
		// 26.09.2026 (по прямому репорту — "выскакивает ошибка про истёкший токен, откуда она
		// берётся, что происходит?"): коды 0/2/3/5/6 — все про сломанную сессию/токен
		// (checkToken() в universal.php), их текст УЖЕ прямым текстом говорит "обнови
		// страницу" — но раньше это только логировалось в консоль (console.error внутри
		// конкретного места вызова, если оно вообще есть), сам игрок никакого попапа не видел
		// и не понимал, что происходит. Теперь при первом таком коде в текущей сессии —
		// один раз показываем стандартный попап ошибки с ТЕКСТОМ СЕРВЕРА (он уже человеко-
		// читаемый) — дальше игрок явно видит, что нужно обновить страницу. Не показываем
		// повторно на каждый следующий провалившийся запрос (burst из нескольких попыток
		// подряд с одним и тем же сломанным токеном) — это не 5 разных проблем, а одна.
		const authCode = this.json && [0, 2, 3, 5, 6].includes(this.json['code']);
		if(authCode && !this._authErrorShown){
			this._authErrorShown = true;
			console.error('[server.onError] сессия/токен сломаны (код ' + this.json['code'] + '): ' + this.json['text']);
			if(window.iface && typeof iface._openSidorovichError === 'function'){
				iface._openSidorovichError('Сессия сброшена', this.json['text'] || 'Обнови страницу с игрой, чтобы продолжить');
			}
		}
		if(Boolean(this.thisReq['e']))this.thisReq['e'](this.json);
	}

	onComplete(){
		if(Boolean(this.thisReq['c']))this.thisReq['c'](this.json);
	}

	//Функция создана для замещения стандартных значений, которые могут прийти в ответе

	parseUD(){//UD is User Data
		if(this.json['udata']){
			window.udata = window.wrapPlayerData
				? window.wrapPlayerData(this.json['udata'])
				: this.json['udata'];
		}
	}

	spec_encode(text){
		let a = JSON.parse('["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","0","1","2","3","4","5","6","7","8","9"]');
		
		let b = JSON.parse('{"0":"2","1":"6","2":"0","3":"7","4":"5","5":"1","6":"4","7":"8","8":"3","9":"9","a":"b","b":"h","c":"k","d":"d","e":"u","f":"g","g":"t","h":"i","i":"l","j":"a","k":"e","l":"w","m":"r","n":"p","o":"x","p":"y","q":"m","r":"z","s":"c","t":"v","u":"j","v":"s","w":"f","x":"o","y":"q","z":"n","A":"E","B":"G","C":"J","D":"P","E":"L","F":"U","G":"W","H":"S","I":"V","J":"A","K":"N","L":"R","M":"C","N":"Z","O":"X","P":"M","Q":"Y","R":"B","S":"I","T":"H","U":"F","V":"K","W":"Q","X":"O","Y":"D","Z":"T"}');
		
		let c = '';
		
		for(let i = 0; i < text.length; i++){
			if(a.includes(text[i])){
				c = c+b[text[i]];
			} else {
				c = c+text[i];
			}
		}
		
		return c;
	}

	spec_decode(text){
		let a = JSON.parse('["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","0","1","2","3","4","5","6","7","8","9"]');
		
		let b = JSON.parse('{"0":"2","1":"5","2":"0","3":"8","4":"6","5":"4","6":"1","7":"3","8":"7","9":"9","b":"a","h":"b","k":"c","d":"d","u":"e","g":"f","t":"g","i":"h","l":"i","a":"j","e":"k","w":"l","r":"m","p":"n","x":"o","y":"p","m":"q","z":"r","c":"s","v":"t","j":"u","s":"v","f":"w","o":"x","q":"y","n":"z","E":"A","G":"B","J":"C","P":"D","L":"E","U":"F","W":"G","S":"H","V":"I","A":"J","N":"K","R":"L","C":"M","Z":"N","X":"O","M":"P","Y":"Q","B":"R","I":"S","H":"T","F":"U","K":"V","Q":"W","O":"X","D":"Y","T":"Z"}');
		
		let c = '';
		
		for(let i = 0; i < text.length; i++){
			if(a.includes(text[i])){
				c = c+b[text[i]];
			} else {
				c = c+text[i];
			}
		}
		
		return c;
	}

}
