import { isOk } from '../modules/platform.js';
import { startPurchase } from '../modules/iap.js';

export default class Bank{
	constructor(atm_movie){
		//Регистрация ключевых переменных класса
		this.atm = atm_movie;
	
		this.initUnics();
		this.initButtons();

		this.atm.interactive = true;

		this.atm.win.close_mc.on('pointerdown', ()=>this.hideBank());

		// Диагностика окружения на момент создания Bank — один раз, чтобы точно знать
		// КАКОЙ именно VK-аккаунт открыл игру в этой сессии (сверить с "Тестировщики платежей").
		console.log('[bank.constructor] инициализация оплаты | window.bridge существует:', !!window.bridge,
			'| vk_params.vk_user_id:', window.vk_params && vk_params['vk_user_id'],
			'| vk_params.vk_app_id:', window.vk_params && vk_params['vk_app_id'],
			'| vk_params.vk_platform:', window.vk_params && vk_params['vk_platform'],
			'| vk_params.sign присутствует:', !!(window.vk_params && vk_params['sign']),
			'| vk_params полностью:', window.vk_params ? JSON.stringify(vk_params) : null,
			'| VKinit (VKWebAppInit завершён):', window.VKinit,
			'| VK_version (API):', window.VK_version,
			'| navigator.onLine:', navigator.onLine,
			'| userAgent:', navigator.userAgent);

		// Перехватываем bridge.send чтобы знать какой item заказан —
		// в т.ч. из FLA energy-шопа, который минует bank.js кнопки
		this._lastOrderedItem = undefined;
		const _origSend = bridge.send.bind(bridge);
		bridge.send = (method, params, ...rest) => {
			if(method === 'VKWebAppShowOrderBox' && params && params.item){
				const n = parseInt(String(params.item).replace('item',''));
				if(!isNaN(n)) this._lastOrderedItem = n;
				const t0 = performance.now();
				console.log('[bank.bridge.send] запрошена покупка за голоса ВК | item:', params.item, '| numericId:', n,
					'| time:', new Date().toISOString(),
					'| vk_user_id текущей сессии:', window.vk_params && vk_params['vk_user_id'],
					'| vk_platform:', window.vk_params && vk_params['vk_platform'],
					'| method:', method, '| params переданные в bridge.send:', JSON.stringify(params));

				const p = _origSend(method, params, ...rest);
				// Дублируем диагностику через сам промис bridge.send — он может донести
				// error_data чуть в другом виде/раньше, чем событие VKWebAppShowOrderBoxFailed
				// из bridge.subscribe ниже (в консоли уже видели "Uncaught (in promise)" —
				// значит этот reject нигде не обрабатывался и терялся).
				p.then((res) => {
					console.log('[bank.bridge.send] Promise RESOLVED для VKWebAppShowOrderBox | item:', params.item,
						'| прошло мс:', Math.round(performance.now() - t0), '| result:', JSON.stringify(res));
				}).catch((err) => {
					console.error('[bank.bridge.send] Promise REJECTED для VKWebAppShowOrderBox | item:', params.item,
						'| прошло мс:', Math.round(performance.now() - t0),
						'| ЕСЛИ мс близко к 0 — VK отклонил ЛОКАЛЬНО, до реального похода на сервер VK (клиентская валидация: тестировщик/каталог/верификация приложения);',
						'| ЕСЛИ мс заметно больше (сотни/тысячи) — запрос дошёл до серверов VK и отклонён УЖЕ там (кабинет выплат/подпись/сервер) |',
						'| error_type:', err && err.error_type,
						'| error_code:', err && err.error_data && err.error_data.error_code,
						'| error_reason:', err && err.error_data && err.error_data.error_reason,
						'| error_data полностью:', JSON.stringify(err && err.error_data),
						'| err целиком:', JSON.stringify(err));
				});
				return p;
			}
			return _origSend(method, params, ...rest);
		};

		bridge.subscribe((e) => {
			if(e.detail.type == "VKWebAppShowOrderBoxResult") {
				console.log('[bank.bridge.subscribe] VKWebAppShowOrderBoxResult — платёж подтверждён VK | detail:', JSON.stringify(e.detail), '| lastOrderedItem:', this._lastOrderedItem, '| set_donut:', this.set_donut);
				this.successDonat();
			} else if(e.detail.type == "VKWebAppShowOrderBoxFailed") {
				// Платеж отклонен VK — разбиваем detail на отдельные поля, чтобы не выискивать их в JSON вручную
				const d = e.detail.data || {};
				const ed = d.error_data || {};
				console.error('[bank.bridge.subscribe] VKWebAppShowOrderBoxFailed — платёж НЕ прошёл',
					'\n  lastOrderedItem:', this._lastOrderedItem, '(item' + this._lastOrderedItem + ')',
					'\n  vk_user_id текущей сессии:', window.vk_params && vk_params['vk_user_id'],
					'\n  error_type:', d.error_type,
					'\n  error_code:', ed.error_code,
					'\n  error_reason:', ed.error_reason,
					'\n  request_id:', d.request_id,
					'\n  detail полностью:', JSON.stringify(e.detail),
					'\n  причина: пользователь отменил, либо VK отклонил (приложение не верифицировано / регистрация в кабинете выплат не завершена / товар не настроен в кабинете VK / ошибка на стороне VK)');
			}
		});
	}

	init(tab){
		let keys_slot = ['stew', 'coins', 'cigarettes'];
		const tabNames = {stew: 'тушенка', coins: 'монеты', cigarettes: 'сиги'};
		const defaultTab = (tab && keys_slot.includes(tab)) ? tab : 'stew';

		for(let i = 0; i < keys_slot.length; i++)this.atm.win['active_slot_'+keys_slot[i]].visible = false;

		this.atm.win['active_slot_' + defaultTab].visible = true;

		this.active_slot = defaultTab;

		this.genSlots(this.active_slot);

		this.atm.win.name_slot_txt.text = tabNames[defaultTab];

		for(let i = 0; i < keys_slot.length; i++){
			this.atm.win['butt_slot_'+keys_slot[i]].on('pointerdown', ()=>{
				for(let ii = 0; ii < keys_slot.length; ii++)this.atm.win['active_slot_'+keys_slot[ii]].visible = false;

				this.atm.win.name_slot_txt.text = ['тушенка', 'монеты', 'сиги'][i];

				this.genSlots(keys_slot[i]);

				this.atm.win['active_slot_'+keys_slot[i]].visible = true;
				this.active_slot = keys_slot[i];
			});
		}


		root.layer2_mc.addChild(this.atm);
		if(!this._bankMoved){ this._bankMoved=true; this.atm.y-=20; }
	}

	// 05.10.2026 (модерация ОК, п.4 отказа — "цена не в валюте площадки"): цена в "голосах"
	// (donuts_info[name].price[i] / 7) — формула, специфичная ТОЛЬКО для VK Pay (сам товар
	// item0-23 продаётся по цене, настроенной отдельно в кабинете VK, это число — только для
	// отображения). На ОК реальных "голосов" не существует — показываем price_ok[i] напрямую,
	// без деления на 7 (это уже готовая сумма в ОКах, см. server/json/donuts.json).
	_displayPrice(name, i){
		return isOk() ? donuts_info[name]['price_ok'][i] : donuts_info[name]['price'][i] / 7;
	}

	// 05.10.2026 (по прямому указанию, после разбора живого консольного лога ОК — таблица
	// совместимости apiok.ru оказалась неверной для кросспостинг-приложений, VKWebAppShowOrderBox
	// реально перехватывается и обслуживается "VK Mini App Launcher" площадки ОК): прежний
	// "Вариант А" (прятать покупки на ОК целиком) заменён обычной покупкой — slot'ы показываются
	// на ОК так же, как на VK, клик идёт через тот же startPurchase() (modules/iap.js), который
	// теперь одинаков для обеих площадок (см. докблок iap.js).
	genSlots(name){
		let stew_len = name == 'stew' ? 0 : donuts_info['stew']['price'].length;
		let coins_len = name == 'stew' || name == 'coins' ? 0 : donuts_info['coins']['price'].length;

		for(let i = 0; i < 8; i++){
			this.atm.win['slot'+i].icon.gotoAndStop(name);
			this.atm.win['slot'+i].img.gotoAndStop(name+i);

			const count = donuts_info[name]['default'][i];
			this.atm.win['slot'+i].count_txt.text = count + ' ' + helper.numberEnd(count, name);
			const price = this._displayPrice(name, i);
			this.atm.win['slot'+i].price_txt.text = price + ' ' + helper.numberEnd(price, 'votes');

			helper.clearButton(this.atm.win['slot'+i], true);

			this.atm.win['slot'+i].on('pointerdown', (e) => {
				this.set_donut = stew_len + coins_len + i;
				console.log('[bank.genSlots] клик по слоту покупки | вкладка:', name, '| индекс в вкладке:', i,
					'| итоговый item:', 'item' + this.set_donut, '| цена отображения:', price, '| платформа:', isOk() ? 'ok' : 'vk',
					'| количество товара:', count);

				startPurchase('item' + this.set_donut.toString(), price, count + ' ' + helper.numberEnd(count, name));
			});
		}
	}

	// Голоса ВК, потраченные на itemNum — нужно для ачивки "Потратить голосов". Известны
	// только для item0-23 (donuts_info price/7, тот же расчёт, что и в genSlots) и item100-107
	// (фиксированный массив голосов из server/universal_pay.php). Для остального (item24-99,
	// зарики/рулетка-поинты — цены на них на клиенте нет) возвращает null, а не догадку.
	_votesForItem(itemNum){
		if(itemNum >= 100 && itemNum <= 107){
			// 30.09.2026: item100 (50 энергии) — было 7, поправлено на 3 вслед за
			// server/universal_pay.php (см. комментарий там, модерация VK п.5).
			const ENERGY_VOTES = [3, 7, 10, 20, 40, 60, 85, 120];
			return ENERGY_VOTES[itemNum - 100];
		}
		if(itemNum < donuts_info['stew']['price'].length){
			return donuts_info['stew']['price'][itemNum] / 7;
		}
		if(itemNum < donuts_info['stew']['price'].length + donuts_info['coins']['price'].length){
			return donuts_info['coins']['price'][itemNum - donuts_info['stew']['price'].length] / 7;
		}
		if(itemNum < donuts_info['stew']['price'].length + donuts_info['coins']['price'].length + donuts_info['cigarettes']['price'].length){
			return donuts_info['cigarettes']['price'][itemNum - donuts_info['stew']['price'].length - donuts_info['coins']['price'].length] / 7;
		}
		return null;
	}

	successDonat(){
		// Определяем item: либо из FLA energy-шопа (lastOrderedItem), либо из bank кнопки
		const itemNum = (this._lastOrderedItem !== undefined) ? this._lastOrderedItem : this.set_donut;
		this._lastOrderedItem = undefined;
		console.log('[bank.successDonat] обрабатываем подтверждённую покупку | itemNum:', itemNum,
			'| источник: ', itemNum === this.set_donut ? 'set_donut (кнопка bank.js)' : 'lastOrderedItem (FLA energy-шоп/другой вызов)');

		// 27.09.2026 (КРИТИЧЕСКИЙ репорт — "покупка валюты не начисляет валюту: достижение по
		// трате голосов считается, а рубли не добавляются"): РАНЬШЕ здесь стояло локальное
		// udata['votes_spent'] += votes и СРАЗУ ЖЕ achievements._checkAll(). Это и был баг.
		// _checkAll() при пересечении любого порога зовёт _syncWithServer(), а тот —
		// flushPlayerSave('achievement_earned') (см. achievements.js), который отправляет
		// users.save с ПОЛНЫМ снимком udata НЕМЕДЛЕННО, синхронно, ещё ДО того, как ниже
		// вызовется _refreshBalanceAfterPurchase() со своим suspendPlayerSave(). В этом снимке
		// coins/stew/cigarettes — СТАРЫЕ (клиент их специально больше не считает сам, начисляет
		// только вебхук VK, см. коммент у _refreshBalanceAfterPurchase ниже). Вебхук VK
		// (universal_pay.php, order_status_change) прилетает на сервер практически
		// одновременно с событием VKWebAppShowOrderBoxResult у клиента — и этот users.save
		// затирал уже честно начисленную сервером валюту обратно на старое значение. Ровно тот
		// же класс гонки, что 26.09 нашли для dev_panel.saveDevChanges() (см. коммент у
		// isPlayerSaveSuspended в player-save.js) — но здесь он лежал на ОСНОВНОМ пути КАЖДОЙ
		// покупки, а не в дев-панели. Симптом совпадает 1-в-1: votes_spent (новый) сохранялся
		// тем же запросом, поэтому ачивка «Потратить голосов» честно засчитывалась, а валюта
		// пропадала.
		//
		// Фикс: клиент больше НЕ пишет votes_spent и НЕ дёргает достижения до того, как
		// подтянет баланс с сервера. votes_spent теперь начисляет тот же вебхук, что начисляет
		// и саму валюту (universal_pay.php — он знает цену товара в голосах, $registry['donats']),
		// ОДНОЙ И ТОЙ ЖЕ записью в БД, поэтому рассинхрона между ними быть не может. Поле убрано
		// из whitelist users.save (server/core/controllers/users.php) — клиент его больше не
		// может ни затереть, ни подделать. Достижения проверяются в колбэке users.get внутри
		// _refreshBalanceAfterPurchase(), уже по свежим серверным данным.
		const votes = this._votesForItem(itemNum);
		console.log('[bank.successDonat] цена в голосах (только для лога — votes_spent начисляет сервер):', votes);

		// Энергия: item100..item107 (FLA built-in energy shop)
		if(itemNum >= 100 && itemNum <= 107){
			const energyAmounts = [50, 110, 180, 400, 850, 1300, 2000, 3500];
			const gained = energyAmounts[itemNum - 100];
			console.log('[bank.successDonat] ветка ЭНЕРГИЯ | itemNum:', itemNum, '| gained:', gained);
			if(gained){
				if(window.TIMERS) TIMERS.addEnergy(gained);
				else udata['energy'] = (parseInt(udata['energy'] || 0) + gained).toString();
				if(window.iface) iface.updateUp();
				console.log('[bank.successDonat] энергия начислена | +' + gained, '| новое udata.energy:', udata['energy']);
			} else {
				console.error('[bank.successDonat] itemNum в диапазоне энергии, но gained не найден (индекс вне energyAmounts) | itemNum:', itemNum);
			}
			return;
		}

		// Зарики поинты (item24..29)
		if(itemNum >= 24 && itemNum <= 29){
			const diceAmounts = [10, 25, 55, 115, 250, 550];
			const gained = diceAmounts[itemNum - 24];
			console.log('[bank.successDonat] ветка ПОИНТЫ ЗАРИКИ | itemNum:', itemNum, '| gained:', gained);
			if(gained !== undefined){
				udata['dice_points'] = (parseInt(udata['dice_points'] || 0) + gained).toString();
				if(window.iface) iface.updateUp();
				console.log('[bank.successDonat] поинты начислены | +' + gained, '| новое udata.dice_points:', udata['dice_points']);
			} else {
				console.error('[bank.successDonat] itemNum в диапазоне зариков, но gained не найден | itemNum:', itemNum);
			}
			return;
		}

		// Тушенка (item0..7)
		if(itemNum < donuts_info['stew']['price'].length) {
			let count = parseInt(donuts_info['stew']['default'][itemNum]);
			console.log('[bank.successDonat] ветка ТУШЕНКА | itemNum:', itemNum, '| ожидается +' + count, '| начисление делает ТОЛЬКО сервер (universal_pay.php) — подтягиваю свежий баланс');
			this._refreshBalanceAfterPurchase('stew', count);

		// Монеты (item8..15)
		} else if(itemNum < donuts_info['stew']['price'].length + donuts_info['coins']['price'].length){
			let count = parseInt(donuts_info['coins']['default'][itemNum - donuts_info['stew']['price'].length]);
			console.log('[bank.successDonat] ветка МОНЕТЫ | itemNum:', itemNum, '| ожидается +' + count, '| начисление делает ТОЛЬКО сервер (universal_pay.php) — подтягиваю свежий баланс');
			this._refreshBalanceAfterPurchase('coins', count);

		// Сигареты (item16..23)
		} else if(itemNum < donuts_info['stew']['price'].length + donuts_info['coins']['price'].length + donuts_info['cigarettes']['price'].length){
			let count = parseInt(donuts_info['cigarettes']['default'][itemNum - donuts_info['stew']['price'].length - donuts_info['coins']['price'].length]);
			console.log('[bank.successDonat] ветка СИГАРЕТЫ | itemNum:', itemNum, '| ожидается +' + count, '| начисление делает ТОЛЬКО сервер (universal_pay.php) — подтягиваю свежий баланс');
			this._refreshBalanceAfterPurchase('cigarettes', count);

		} else {
			console.error('[bank.successDonat] itemNum не попал ни в одну известную ветку — начисление НЕ произошло | itemNum:', itemNum,
				'| это баг: товар куплен в VK, но игра не знает, что выдать за него');
		}
	}

	// 26.09.2026 (фикс двойного начисления доната — по прямому указанию, аудит перед
	// модерацией VK): тушенка/монеты/сигареты раньше начислялись ЗДЕСЬ, локально в клиенте,
	// ПАРАЛЛЕЛЬНО с серверным вебхуком (universal_pay.php.start(), case 'order_status_change') —
	// он начисляет то же самое количество независимо, читая цены/количества из ТОГО ЖЕ
	// donuts.json. Два несинхронизированных источника правды для одного платежа означали, что
	// итоговый баланс мог задвоиться (клиент прибавил локально, сервер прибавил в БД, ближайший
	// автосейв отправил уже удвоенное клиентское значение поверх уже увеличенного серверного).
	// Теперь клиент НЕ считает валюту сам — только запрашивает у сервера актуальный баланс через
	// users.get() (тот же вызов и тот же формат ответа, что при обычном входе в игру, см.
	// preloader.js.onGetUserInfo()) с небольшой задержкой: вебхук VK — отдельный серверный запрос
	// от VK, независимый от клиентского события VKWebAppShowOrderBoxResult, и может долететь
	// чуть позже него.
	// 26.09.2026 (по прямому репорту — "платёж проходит, но награда не начисляется", со
	// скриншотом консоли "было: 3 | стало: 3"): единственная проверка через 1500мс иногда
	// срабатывала РАНЬШЕ, чем вебхук VK (order_status_change) успевал долететь до сервера и
	// реально начислить — подтверждено живыми логами: сервер честно начислил (item=15,
	// field=coins, after=20003), но клиентский users.get() опросил баланс ДО этого момента и
	// увидел старое значение. Фиксированной задержки недостаточно — задержка вебхука не
	// гарантирована. Теперь опрашиваем баланс НЕСКОЛЬКО раз (1.5с, 3с, 5с, 8с) и
	// останавливаемся, как только валюта реально изменилась — не полагаемся на одну попытку.
	//
	// 26.09.2026 (повторный репорт тем же днём — "покупка то выдаёт, то не выдаёт, в
	// основном не выдаёт"): проверка "изменилось хоть на что-то" (udata[currency] !== before)
	// была ложноположительной при параллельной игре — тот же currency (например coins) мог
	// измениться от СОВЕРШЕННО другого действия (ставка в блэкджеке/зарики) в течение того же
	// окна ожидания, и опрос останавливался, решив, что покупка долетела, хотя реальный вебхук
	// VK для ЭТОЙ покупки мог прилететь позже и его результат никто уже не проверял. Теперь
	// требуем реального РОСТА минимум на expectedCount от снимка ДО покупки — трата валюты
	// параллельно лишь отложит подтверждение (что честно и корректно), а не даст ложный "ОК"
	// раньше времени; случайный чужой ПРИРОСT той же валюты (например награда за босса) не
	// мешает — порог всё равно будет достигнут, как только придёт и наш вебхук.
	_refreshBalanceAfterPurchase(currency, expectedCount){
		const before = window.udata ? parseInt(udata[currency] || 0) : 0;
		const delays = [1500, 3000, 5000, 8000];

		// 26.09.2026 (по прямому репорту, подтверждено логами — "оплата прошла, а начисленное
		// потом пропало"): пока этот баланс ещё не подтянут с сервера, window.udata[currency]
		// остаётся СТАРЫМ (намеренно — клиент больше не считает сам, см. комментарий выше про
		// фикс двойного начисления). Если в этом окне сработает ЛЮБОЕ users.save (автосейв ИЛИ
		// dev_panel.js.saveDevChanges() — отдельная реализация, не знающая про suspend) — оно
		// отправит этот старый снимок и затрёт то, что сервер уже честно начислил по вебхуку
		// VK. suspendPlayerSave() блокирует автосейв этого модуля; dev_panel.js сам проверяет
		// window.isPlayerSaveSuspended() перед отправкой (см. saveDevChanges() там же).
		// 28.09.2026 (по прямому репорту — "поиграл в казино, потом опыт/уровень не сохранился"):
		// suspendPlayerSave() ниже только БЛОКИРУЕТ будущие автосейвы — уже НАКОПЛЕННЫЕ, но ещё не
		// отправленные локальные изменения (например, свежий udata['dvor_games_data'] от только
		// что сыгранной партии в казино) при этом НЕ отправляются, а через несколько строк ниже
		// window.udata ЦЕЛИКОМ заменяется серверным снимком (users.get) и помечается markPlayerDataFresh
		// — то есть эти изменения теряются безвозвратно, а не просто откладываются. flushPlayerSave()
		// здесь, ДО suspend, гарантированно отправляет всё, что накопилось к этому моменту.
		if(window.flushPlayerSave) flushPlayerSave('bank_purchase_pending:' + currency);
		if(window.suspendPlayerSave) suspendPlayerSave('bank_purchase_pending:' + currency);
		const _finish = () => { if(window.resumePlayerSave) resumePlayerSave('bank_purchase_pending:' + currency); };

		const attempt = (attemptIdx) => {
			TS.php('users.get', {uid: vk_params['vk_user_id'], users: 'skip'}, (e) => {
				if(e && e.udata && typeof e.udata === 'object'){
					window.udata = window.wrapPlayerData(e.udata);
					// udata только что заменён полным снимком с сервера — локальных несохранённых
					// изменений больше нет по определению. Снимаем «грязный» флаг автосейва, иначе
					// resumePlayerSave() в _finish() увидит revision > savedRevision и немедленно
					// отправит этот снимок обратно на сервер. Если вебхук VK долетит РОВНО в это окно
					// (позже последней попытки опроса) — такой «эхо-сейв» снова затрёт свежую валюту
					// старым значением, то есть тот же баг, только на 8 секунд позже.
					if(window.markPlayerDataFresh) markPlayerDataFresh('bank_purchase_refresh');
					if(window.iface) iface.updateUp();
					const after = parseInt(udata[currency] || 0);
					const changed = (after - before) >= expectedCount;
					console.log('[bank._refreshBalanceAfterPurchase] баланс обновлён с сервера | currency:', currency,
						'| попытка:', attemptIdx + 1, '/', delays.length, '| было:', before, '| стало:', after,
						'| ожидалось минимум +' + expectedCount, '| реальный прирост:', after - before, '| засчитано:', changed);
					if(window.achievements) achievements._checkAll();
					if(!changed && attemptIdx + 1 < delays.length){
						console.warn('[bank._refreshBalanceAfterPurchase] баланс ещё не вырос на ожидаемую сумму (вебхук VK, вероятно, ещё не долетел, либо валюта параллельно тратилась) — повторю через', delays[attemptIdx + 1], 'мс');
						setTimeout(() => attempt(attemptIdx + 1), delays[attemptIdx + 1]);
					} else {
						if(!changed) console.error('[bank._refreshBalanceAfterPurchase] баланс так и не вырос на ожидаемую сумму после всех попыток — начисление могло реально не пройти | currency:', currency, '| было:', before, '| стало:', after, '| ожидалось минимум +' + expectedCount);
						_finish();
					}
				} else {
					console.error('[bank._refreshBalanceAfterPurchase] users.get не вернул udata после покупки | currency:', currency, '| ответ:', JSON.stringify(e));
					_finish();
				}
			}, (err) => {
				console.error('[bank._refreshBalanceAfterPurchase] ошибка запроса users.get после покупки | currency:', currency, '| ошибка:', JSON.stringify(err));
				_finish();
			});
		};

		setTimeout(() => attempt(0), delays[0]);
	}

	hideBank(){
		if(this.atm.parent) this.atm.parent.removeChild(this.atm);
	}

	initButtons(){
		setButton(this.atm.win.close_mc);
		if(this.atm.win.close_mc){ this.atm.win.close_mc.scale.set(0.5); this.atm.win.close_mc.y += 20; }
		setButton(this.atm.win.butt_slot_stew);
		setButton(this.atm.win.butt_slot_coins);
		setButton(this.atm.win.butt_slot_cigarettes);
	}

	initUnics() {
	
	}
}