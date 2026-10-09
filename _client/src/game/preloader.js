import { shouldAskFriendsScopeAsync, markFriendsScopeAsked, markFriendsScopeGranted, hasFriendsScopeGrantedLocal } from '../modules/friends-scope-gate.js';
import { applyPatch } from '../modules/patch.js';
import { isVk } from '../modules/platform.js';

export default class Preloader{
	constructor(preloader_movie){
		//Регистрация ключевых переменных класса
		this.preloader = preloader_movie.preloader_mc;

		this.preloader.interactive = true;

		// Старая FLA-заставка (зомби появляется/пропадает в цикле) — по прямому указанию
		// больше не должна показываться вообще. Основная работающая анимация загрузки —
		// Spine-прелоадер (08.10.2026: ./spine/preloader.json, монтируется в index.js через
		// modules/preloader-visual.js — до этого был video ./preloader.mp4) поверх компаса
		// (_clo, index.html) — её не трогаем. Сам preloader_mc не удаляем (нужен error_mc в
		// onError() ниже для показа ошибки загрузки), просто прячем в норме.
		this.preloader.visible = false;
		// Финальное окно обучения уже объясняет, зачем игре нужны друзья. Поэтому его кнопка
		// «Продолжить» может напрямую вызвать Bridge, без второго дублирующего HTML-попапа.
		// Повторный вызов блокируется постоянным флагом из БД.
		window.addEventListener('pripyat:friends-permission-request', () => {
			if(window.udata && String(udata['friends_scope_granted'] || '0') === '1') return;
			this._requestFriendsScope((ok, reason) => {
				if(ok) notify.showResult({text:'Друзья подключены.'}, 1);
				else if(reason !== 'denied') notify.showResult({text:'Не удалось сохранить разрешение. Попробуйте ещё раз.'}, 0);
			});
		});

		const _clo = document.getElementById('_clo');
		if(_clo) _clo.style.display = 'none';
	}

	initTimer(retry = false){
		bridge.sendPromise("VKWebAppCallAPIMethod", {method: "utils.getServerTime", params:{access_token:VK_token, v:VK_version}}).then(e =>{
			window.TIMERS = new Timers(e['response']);
			this.initLinks();
		}).catch(() => {
			// Доступ к друзьям не нужен для запуска. Никаких попыток получить scope здесь
			// быть не должно: системный диалог VK разрешён только после явного клика игрока.
			window.TIMERS = new Timers(Math.floor(Date.now() / 1000));
			this.initLinks();
		});
	}

	initLinks(){
		window.content_links = {notify:'notify'};

		modules.checkFlags(['notify'], ()=>{
			helper.getJSON(my_server + '/json/links.json', (e) => this.onGetLinks(e), (e) => {
				this.onError(e);
			});
		});
	}

	onGetLinks(e){
		window.content_links = e;

		let keys = Object.keys(content_links);

		for(let i = 0; i < keys.length; i++)include('libs/'+content_links[keys[i]]+'.min.js?'+session_hash);

		this.initGame();
	}

	initGame(){
		let keys_vk_params = Object.keys(vk_params), params = {};

		for(let i = 0; i < keys_vk_params.length; i++)if(keys_vk_params[i].indexOf('vk') != -1)params[keys_vk_params[i]] = vk_params[keys_vk_params[i]];

		params['sign'] = vk_params['sign'];

		TS.php('security.getToken', params, (e)=>this.onGetToken(e), (e)=>this.onError(e));
	}

	onGetToken(data){
		if(data['token'])TS.token = data['token'];
		// 26.09.2026 (фикс рассинхрона цен доната — по прямому указанию, аудит перед модерацией
		// VK): раньше клиент читал цены/количества доната из server/json/_bigger.json —
		// отдельного агрегатора, вручную собираемого скриптом _bigger.php и НИКОГДА не
		// обновляемого автоматически при деплое. Локальная копия этого файла оказалась
		// датирована июлем 2025 и содержит структуру совершенно другой игры-шаблона (ключи
		// gold/semki/t_coin вместо stew/coins/cigarettes) — рассинхрон был не гипотетическим.
		// universal_pay.php (серверный вебхук оплаты) всегда читал donuts.json напрямую через
		// Jsonloader — теперь клиент читает ТОТ ЖЕ САМЫЙ файл напрямую, без промежуточного
		// агрегатора: один файл — один источник правды, рассинхрон физически невозможен.
		helper.getJSON(my_server+'/json/donuts.json', (e)=>{this.initJSON(e)}, (e)=>{this.onError(e)});

		// Модерация VK, п.1: на старте вообще не вызываем friends.get и не запрашиваем
		// scope. Игра запускается с личным рейтингом; разрешение можно дать позже в
		// объясняющем окне после онбординга.
		this._continueWithoutFriends();
	}

	_continueWithoutFriends(){
		window.my_friends = String(vk_params['vk_user_id'] || '');
		window._friendsScopeReady = false;
		TS.php("users.get", {uid:vk_params['vk_user_id'], users:'skip'}, (e)=>this.onGetUserInfo(e), (e)=>this.onError(e));
	}

	_loadFriends(onDone){
		// Access token с scope=friends живёт только в текущей сессии. Флаг в БД означает
		// «игрок уже согласился», но не означает, что friends.get уже был выполнен после
		// последней перезагрузки — не подменяем эти два разных состояния.
		window._friendsScopeReady = false;
		window.non_app_friends = [];
		let ids = '';
		bridge.sendPromise("VKWebAppCallAPIMethod", {method: "friends.get", params:{fields:'photo_50', access_token:VK_token, v:VK_version}}).then(e =>{
			let all_fr = (e && e['response'] && Array.isArray(e['response']['items'])) ? e['response']['items'] : [];
			console.log('[preloader._loadFriends] friends.get вернул друзей:', all_fr.length);
			bridge.sendPromise("VKWebAppCallAPIMethod", {method:'friends.getAppUsers', params:{access_token:VK_token, v:VK_version}}).then(data =>{
				const appUsers = (data && Array.isArray(data['response'])) ? data['response'] : [];
				for(let i = 0; i < all_fr.length; i++)if(appUsers.indexOf(all_fr[i]['id']) == -1)non_app_friends.push(all_fr[i]);
				vk_params['api_result'] = appUsers;
				vk_params['api_result'].length > 0 ? ids = vk_params['vk_user_id'] + "," + vk_params['api_result'].join(",") : ids = vk_params['vk_user_id'].toString();
				window.my_friends = ids;
				window._friendsScopeReady = true;
				console.log('[preloader._loadFriends] window.my_friends установлен, id:', ids);
				// Сохраняем подтверждённый VK список в БД. При следующих запусках он доступен
				// без нового OAuth-окна и без повторного вызова friends.get.
				TS.php('users.setFriendsCache', {friends:ids}, (res) => {
					if(res && res.patch) applyPatch(res.patch);
					if(onDone) onDone(true);
					else TS.php("users.get", {uid:vk_params['vk_user_id'], users:'skip'}, (e)=>this.onGetUserInfo(e), (e)=>this.onError(e));
				}, () => {
					window._friendsScopeReady = false;
					if(onDone) onDone(false);
					else TS.php("users.get", {uid:vk_params['vk_user_id'], users:'skip'}, (e)=>this.onGetUserInfo(e), (e)=>this.onError(e));
				});
			}).catch(e => {
				window._friendsScopeReady = false;
				console.error('[preloader._loadFriends] ошибка friends.getAppUsers, my_friends останется пустым:', e && e.error_data ? JSON.stringify(e.error_data) : e);
				if(onDone) onDone(false);
				else TS.php("users.get", { uid: vk_params['vk_user_id'], users: 'skip'}, (e) => this.onGetUserInfo(e), (e) => this.onError(e));
			})
		}).catch(e => {
			window._friendsScopeReady = false;
			console.error('[preloader._loadFriends] ошибка friends.get, my_friends останется пустым (топ «Друзья» покажет только себя):', e && e.error_data ? JSON.stringify(e.error_data) : e);
			if(onDone) onDone(false);
			else TS.php("users.get", { uid: vk_params['vk_user_id'], users: 'skip'}, (e) => this.onGetUserInfo(e), (e) => this.onError(e));
		})
	}

	initJSON(data){
		// donuts.json отдаёт структуру доната напрямую (без обёртки {donuts: ...}, в отличие от
		// прежнего _bigger.json) — см. комментарий в onGetToken() выше.
		window.donuts_info = data;
	}

	onGetUserInfo(data){
		const _raw = data['udata'];
		if(!_raw || typeof _raw !== 'object'){
			// Новый пользователь или ошибка сервера — даём дефолты
			window.udata = window.wrapPlayerData({
				coins:'10', cigarettes:'1000', stew:'0', exp:'0', energy:'50', max_energy:'50',
				respect:'0', ammo_auto:'0', ammo_gun:'0', ammo_machete:'0',
				poker_chips:'0', poker_spichki:'0', roulette_spichki:'0',
				blue_points:'0', dice_points:'0', habar_counts:'0', stash_count:'0',
				dvor_games:'0', dvor_games_data:'{}', dvor_daily:'{}',
				dvor_daily_sigs:'{}', nickname:'', level:'1', stew_spent:'0',
				roulette_winner:'{}',
			});
		} else {
			window.udata = window.wrapPlayerData(_raw);
		}

		// Согласие и последний подтверждённый список друзей живут в БД. После перезапуска
		// этого достаточно для вкладки «Друзья»: повторный VKWebAppGetAuthToken не нужен.
		if(String(udata['friends_scope_granted'] || '0') === '1'){
			const selfId = String(vk_params['vk_user_id'] || '').replace(/\D/g, '');
			const cached = String(udata['friends'] || '').split(',')
				.map(id => String(id).replace(/\D/g, '')).filter(Boolean);
			if(selfId && cached.indexOf(selfId) === -1) cached.unshift(selfId);
			window.my_friends = cached.join(',') || selfId;
			window._friendsScopeReady = true;
			markFriendsScopeGranted();
		}

		// Теперь udata есть — пересчитываем энергию с учетом оффлайна
		if(window.TIMERS) TIMERS.updateFromUdata();

		// 24.09.2026 (по прямому указанию — "настройки звука/музыки не сохраняются после
		// перезагрузки"): восстанавливаем window._sndVol/_musVol из только что пришедших
		// udata['snd_vol']/udata['mus_vol'] (пишутся в sound.js при любом изменении ползунка,
		// сохраняются на сервер обычным дебаунсом). Без этого при каждой перезагрузке громкость
		// откатывалась бы на дефолты (0.7/0.5), т.к. window._sndVol/_musVol сами по себе —
		// только оперативная память вкладки, никогда раньше не читались из udata вообще.
		if(udata['snd_vol'] !== undefined) window._sndVol = parseFloat(udata['snd_vol']);
		if(udata['mus_vol'] !== undefined) window._musVol = parseFloat(udata['mus_vol']);

		// 24.09.2026 (баг найден по прямому указанию + скриншот — "перезагрузил браузер во
		// время боя, слетел рейтинг урона и шкала опыта скиллов"): window.skills/window.bosses
		// создаются в module_control.js ДО этого места — в момент их конструктора window.udata
		// ещё null (см. index.js: new ModuleControl() идёт раньше TS.php('users.get', ...)),
		// поэтому их собственный конструкторский _loadFromUdata()/_loadLevelsFromUdata() молча
		// ничего не находит (levels/skillsDmgSpent остаются на дефолтных нулях). Дальше их
        // ничто не пересинхронизирует — только СЛУЧАЙНО, как побочный эффект действия игрока
        // (атака/прокачка/конец боя, см. bosses-combat.js/skills.js.upgrade). После обычной
        // перезагрузки БЕЗ единого действия skills так и остаётся на 0/1000 — хотя реальный
        // прогресс (skills_levels) уже пришёл в udata прямо здесь, просто skills об этом не
        // узнал. Явно пересинхронизируем оба объекта ровно в момент, когда udata стало реальным
        // (та же идея, что уже стоит в interface-panels.js для bosses при каждом клике по ХУДу —
        // здесь она надёжнее: срабатывает ровно один раз, сразу как данные готовы, не полагаясь
        // на то, что игрок случайно откроет вкладку боссов первым делом).
		if(window.skills && typeof skills._loadFromUdata === 'function') skills._loadFromUdata();
		if(window.bosses && typeof bosses._loadFromUdata === 'function') bosses._loadFromUdata();
		// 25.09.2026 (тот же класс гонки, что чинили выше для skills/bosses 24.09.2026): window.shmot
		// тоже создаётся в module_control.js ДО того, как window.udata становится реальным — его
		// конструкторский _loadFromUdata() тогда молча не находит udata['shmot'] и все предметы
		// остаются на дефолтном owned:false из каталога (shmot.js) до первого выигрыша в казино/у
		// босса (единственные места, где _loadFromUdata() перевызывается позже). Пока этого не
		// произошло — витрина магазина (shmot_shop.js) может показывать реально ВЛАДЕЕМЫЕ вещи как
		// неполученные (чёрно-белыми) сразу после захода в игру.
		if(window.shmot && typeof shmot._loadFromUdata === 'function') shmot._loadFromUdata();

		this._updateLoginStreak();

		bridge.sendPromise("VKWebAppGetUserInfo").then(info => {
			window.vk_user_info = info;
			const savedNick = String(udata['nick'] || '').trim();
			let vkNick = [info.first_name, info.last_name].filter(Boolean).join(' ').trim();
			// 28.09.2026 (по прямому указанию — ограничение ника 15 символов, "Александр
			// Александрович" не влезает): если "Имя Фамилия" длиннее лимита ручного ввода ника
			// (см. maxLength=15 в popups/nick.js), сокращаем ТОЛЬКО фамилию до первой буквы с
			// точкой ("Александр А."), имя всегда пишем полностью. Раньше здесь сохранялась
			// полная "Имя Фамилия" без всякого ограничения длины — при длинных ФИО ник вылезал
			// за размеры HUD/топов, рассчитанные под ручной ввод с лимитом.
			if(vkNick.length > 15 && info.first_name && info.last_name){
				vkNick = info.first_name.trim() + ' ' + info.last_name.trim().charAt(0) + '.';
			}
			// При первом входе игровой ник — имя VK. Собственный позывной, сохранённый через
			// попап, не перезаписываем: он имеет приоритет после первого выбора игрока.
			if(!savedNick && vkNick){
				udata['nick'] = vkNick;
				if(window.TS) TS.php('users.save', {udata_json: JSON.stringify(udata)},
					()=>console.log('[preloader] начальный ник из VK сохранён:', vkNick),
					(err)=>console.error('[preloader] не удалось сохранить начальный ник:', err));
			}
			loadGame();
			this._scheduleFriendsScopePrompt();
		}).catch(() => {
			loadGame();
			this._scheduleFriendsScopePrompt();
		});
	}

	_scheduleFriendsScopePrompt(){
		const waitForOnboarding = () => {
			// DB-флаг окончательно решает, нужно ли вообще предлагать доступ.
			if(window.udata && String(udata['friends_scope_granted'] || '0') === '1'){
				markFriendsScopeGranted();
				window.dispatchEvent(new Event('pripyat:friends-scope-granted'));
				// 02.10.2026 (баг найден по прямому репорту — "иконки друзей не отображаются,
				// хотя разрешение вроде бы уже есть"): DB-флаг означает только что VK когда-то
				// УЖЕ разрешил scope 'friends' — но сам access_token с этим scope живёт только
				// в памяти ТЕКУЩЕЙ вкладки (см. коммент в _loadFriends() выше) и после каждой
				// новой загрузки страницы снова undefined (index.js: VK_token = vk_params[
				// 'access_token'], а в launch-параметрах его вообще нет). Раньше здесь только
				// доверяли кэшу из БД и ничего не запрашивали — _resolveVkUsers()/users.get
				// потом видел !window.VK_token и тихо возвращал пустые фото ВСЕМ. Для уже
				// согласившегося игрока VKWebAppGetAuthToken резолвится МГНОВЕННО и БЕЗ
				// системного диалога (VK помнит grant) — поэтому можно звать его тихо, без
				// предупреждения, именно это и восстанавливает рабочий VK_token на сессию.
				//
				// 09.10.2026 (отказ модерации ОК, п.1 — "предложение в фоне на каждой сессии"):
				// ограничено isVk() — предположение "резолвится мгновенно без диалога" верно
				// ТОЛЬКО для настоящего VK (у него есть память о гранте). ОК рендерит это
				// Mini App через СВОЙ Launcher, перехватывающий ВСЕ Bridge-вызовы (см. docblock
				// modules/iap.js — "Launcher v.0.1.136... перехватывает ВСЕ VK Bridge-вызовы") —
				// нет гарантии, что его реализация GetAuthToken помнит прежний grant так же, как
				// настоящий VK; тихий автозапрос БЕЗ клика игрока на КАЖДОЙ сессии — именно то,
				// что запрещает правило 2.6.3. На ОК список друзей просто останется недоступен
				// до явного клика игрока (кнопка «Друзья»/вкладка свода уже зовут
				// _showFriendsScopePrompt({force:true}) — тот путь не затронут).
				if(isVk()) this._requestFriendsScope(() => {});
				return;
			}
			// У игроков, давших согласие до добавления поля в БД, переносим прежнюю
			// локальную отметку один раз. Новый запрос VK Bridge здесь не вызывается.
			if(window.udata && hasFriendsScopeGrantedLocal()) this._persistFriendsScopeGranted();
			// Никаких автоматических предложений при запуске и после события done. Новый игрок
			// принимает решение в финальном окне обучения, остальные могут вызвать Bridge сами
			// кнопкой с друзьями. Это исключает два запроса подряд при завершении урока.
		};
		if(window.onPreloaderHidden) window.onPreloaderHidden(waitForOnboarding);
		else waitForOnboarding();
	}

	_showFriendsScopePrompt(options = {}){
		const hasSavedConsent = !!(window.udata && String(udata['friends_scope_granted'] || '0') === '1');
		// 02.10.2026 (тот же баг, что в _scheduleFriendsScopePrompt() выше): сохранённое
		// согласие НЕ означает, что VK_token этой сессии уже получен — только что VK когда-то
		// разрешил scope. Раньше здесь просто врали "готово" без реального запроса, из-за чего
		// _resolveVkUsers() работал без access_token. _requestFriendsScope() сам ничего не
		// покажет игроку (VK отдаёт токен для уже разрешённого scope без диалога) и сам
		// продублирует событие pripyat:friends-connected при успехе.
		if(hasSavedConsent){
			this._requestFriendsScope(() => {});
			return;
		}
		if(document.getElementById('friends-scope-prompt')) return;
		// 04.10.2026 (модерация ОК, п.1): клик игрока (force:true — HUD-кнопка «Друзья»,
		// вкладка «Друзья» в своде) показывает попап немедленно, без кулдауна — правило 2.6.3
		// ограничивает только АВТОМАТИЧЕСКИЕ предложения. Для них — асинхронная проверка через
		// VK Storage (см. friends-scope-gate.js), не localStorage напрямую.
		if(options.force){ this._buildFriendsScopeModal(); return; }
		shouldAskFriendsScopeAsync().then(should => {
			if(!should) return;
			if(document.getElementById('friends-scope-prompt')) return; // на случай гонки за время await
			this._buildFriendsScopeModal();
		});
	}

	_buildFriendsScopeModal(){
		const modal = document.createElement('div');
		modal.id = 'friends-scope-prompt';
		modal.style.cssText = 'position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.7);font-family:Arial,sans-serif';
		const title = 'Подключить друзей?';
		const body = 'Разрешите доступ к списку друзей, чтобы видеть их в рейтинге и узнавать, кто уже играет в «Припять». Мы не публикуем записи от вашего имени.';
		const yesLabel = 'Разрешить';
		modal.innerHTML = '<div role="dialog" aria-modal="true" style="max-width:440px;padding:28px;border:2px solid #8a7348;border-radius:12px;background:#24211b;color:#fff;box-shadow:0 16px 50px #000;text-align:center"><h2 style="margin:0 0 14px;font-size:22px">'+title+'</h2><p style="margin:0 0 22px;line-height:1.45;color:#e6dfd0">'+body+'</p><div style="display:flex;gap:12px;justify-content:center"><button data-friends-no type="button" style="padding:11px 17px;border:0;border-radius:7px;background:#6b6253;color:#fff;font-weight:bold;cursor:pointer">Не сейчас</button><button data-friends-yes type="button" style="padding:11px 17px;border:0;border-radius:7px;background:#4b82be;color:#fff;font-weight:bold;cursor:pointer">'+yesLabel+'</button></div></div>';
		const close = () => modal.remove();
		modal.querySelector('[data-friends-no]').addEventListener('click', () => {
			markFriendsScopeAsked();
			close();
		});
		modal.querySelector('[data-friends-yes]').addEventListener('click', () => {
			const yes = modal.querySelector('[data-friends-yes]');
			yes.disabled = true; yes.textContent = 'Подключаем…';
			this._requestFriendsScope((ok, reason) => {
				if(ok){
					close();
					notify.showResult({text:'Список друзей подключён. Откройте рейтинг «Друзья».'}, 1);
					return;
				}
				if(reason === 'denied'){
					close();
					notify.showResult({text:'Доступ к друзьям не предоставлен.'}, 0);
					return;
				}
				yes.disabled = false; yes.textContent = 'Разрешить';
				notify.showResult({text:'Не удалось сохранить согласие. Попробуйте ещё раз.'}, 0);
			});
		});
		document.body.appendChild(modal);
	}

	_requestFriendsScope(done){
		if(this._friendsScopeRequestPending) return;
		this._friendsScopeRequestPending = true;
		markFriendsScopeAsked();
		bridge.sendPromise('VKWebAppGetAuthToken', {app_id:parseInt(vk_params['vk_app_id']), scope:'friends'})
			.then(tokenRes => {
				VK_token = tokenRes['access_token'];
				this._persistFriendsScopeGranted((saved) => {
					if(!saved){ this._friendsScopeRequestPending = false; if(done) done(false, 'save'); return; }
					this._loadFriends((ok) => {
						this._friendsScopeRequestPending = false;
						if(ok) window.dispatchEvent(new Event('pripyat:friends-connected'));
						if(done) done(ok, ok ? 'ok' : 'friends');
					});
				});
			})
			.catch(() => {
				this._friendsScopeRequestPending = false;
				if(done) done(false, 'denied');
			});
	}

	// Пишется только ПОСЛЕ успешного ответа VK Bridge. Метод не принимает uid и
	// устанавливает флаг исключительно текущему авторизованному игроку.
	_persistFriendsScopeGranted(done = null){
		if(!window.TS){ if(done) done(false); return; }
		TS.php('users.setFriendsScopeGranted', {}, (res) => {
			if(!res || !res.ok){ if(done) done(false); return; }
			if(res.patch) applyPatch(res.patch);
			else if(window.udata) udata['friends_scope_granted'] = '1';
			markFriendsScopeGranted();
			window.dispatchEvent(new Event('pripyat:friends-scope-granted'));
			if(done) done(true);
		}, () => { if(done) done(false); });
	}

	// Ачивка "Заход в игру без перерыва" — реальный стрик подряд идущих календарных дней,
	// не "дней с момента регистрации" (то, чем de-facto является udata['days_played'] в
	// svod.js — просто floor((now-create_time)/86400), растёт даже если игрок вообще не
	// заходил). Считается ОДИН раз за сессию, здесь — сразу как только udata доступна.
	_updateLoginStreak(){
		if(!udata) return;
		const todayStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD', UTC
		const lastStr  = udata['last_login_day'] || '';
		if(lastStr === todayStr){
			console.log('[preloader._updateLoginStreak] уже заходили сегодня (' + todayStr + '), стрик не трогаем:', udata['login_streak']);
			return;
		}
		let diffDays = null;
		if(lastStr){
			const lastMs  = Date.parse(lastStr + 'T00:00:00Z');
			const todayMs = Date.parse(todayStr + 'T00:00:00Z');
			diffDays = Math.round((todayMs - lastMs) / 86400000);
		}
		if(diffDays === 1){
			udata['login_streak'] = String((parseInt(udata['login_streak'] || 0)) + 1);
		} else {
			// Первый вход вообще, либо разрыв (пропущен день, либо часы съехали) — стрик с 1.
			udata['login_streak'] = '1';
		}
		udata['last_login_day'] = todayStr;
		console.log('[preloader._updateLoginStreak] сегодня:', todayStr, '| было:', lastStr || '(нет)',
			'| разница дней:', diffDays, '| новый стрик:', udata['login_streak']);
	}

	

	onError(e){
		try {
			// Заставка (preloader_mc) скрыта по умолчанию (см. конструктор) — но при
			// реальной ошибке загрузки нужно её показать обратно, иначе notify.result
			// (добавляемый ниже в this.preloader.error_mc) окажется внутри невидимого дерева.
			this.preloader.visible = true;
			if(this.preloader && this.preloader.anim) this.preloader.anim.stop();
			if(window.notify && notify.result){
				notify.result.shadow_mc.alpha = 0;
				notify.result.win.title_txt.text = notify.random_name[0];
				notify.result.win.info_txt.text = e['text'] || 'Ошибка загрузки';
				helper.fadeAnimation(notify.result.shadow_mc, 'fadeIn', 300);
				this.preloader.error_mc.addChild(notify.result);
			}
		} catch(err){
			console.error('[Preloader] onError crashed:', err, 'original:', e);
		}
	}

}
