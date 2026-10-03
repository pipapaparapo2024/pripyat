/** Bosses select overlay. */

export function attachBossesSelect(proto){
	proto._bringBossHudUp = function(){
		// Попап на layer2 перекрывает HUD на layer1 — поднимаем верхнюю панель поверх
		if(this.up && root && root.layer2_mc) root.layer2_mc.addChild(this.up);
	};
	proto._restoreBossHud = function(){
		this.restoreHud();
		if(this.up && root && root.layer1_mc) root.layer1_mc.addChild(this.up);
		console.log('[bosses_select._restoreBossHud] HUD восстановлен | нижняя панель видима:', !!(this.down && this.down.visible), '| на сцене:', !!(this.down && this.down.parent));
	};

	proto._openBossesPopup = function(){
		// Если уже идёт бой с боссом — сразу переходим в боёвку. Проверяем ВСЕ 4 режима
		// сложности (обычный/опасный/суровый/соло), а не только текущий bosses._diffIdx —
		// баг найден 18.09.2026 (репорт "перезагрузка страницы обрывает бой с боссом"):
		// _diffIdx раньше не сохранялся в bosses_data и после reload всегда сбрасывался на 0
		// (конструктор Bosses), поэтому активный бой, начатый в Опасном/Суровом/Соло, был
		// "невидим" для этой проверки — экран боссов открывался пустым, будто бой сгорел,
		// хотя bossStartMs/hpByDiff/урон на самом деле были целы и на сервере, и в udata.
		// _diffIdx теперь тоже сохраняется (см. bosses-combat.js._saveToUdata/_loadFromUdata),
		// но сканируем все 4 массива всё равно — вторая, независимая линия защиты от той же
		// проблемы (например, если игрок переключал сложность уже ПОСЛЕ старта боя).
		// Редирект в уже идущий бой — просто truthy-проверка bossStartMs (>0 = бой активен),
		// протухание проверяет сервер (bosses.php, MAX_FIGHT_WINDOW_MS).
		//
		// 24.09.2026 (диагностика для репорта "после ПОЛНОЙ перезагрузки браузера бой не
		// резюмируется, снова показывается выбор боссов" — воспроизвести/прочитать состояние
		// в моменте не удалось, статический разбор кода самого редиректа не нашёл дефекта):
		// временный подробный лог ПЕРЕД проверкой — если баг повторится, в консоли будет видно,
		// была ли это гонка загрузки (window.bosses/bossStartMs ещё не готовы) или реальная
		// потеря bossStartMs на сервере/в udata (тогда сама матрица придёт уже нулевой).
		console.log('[bosses_select._openBossesPopup] проверка активного боя | window.bosses:', !!window.bosses,
			'| bossStartMs:', window.bosses ? JSON.stringify(bosses._bossStartMs) : 'н/д',
			'| udata.bosses_data (raw):', (window.udata && udata['bosses_data']) || 'н/д');
		if(window.bosses && bosses._bossStartMs){
			for(let _di = 0; _di < bosses._bossStartMs.length; _di++){
				const _redir_arr = bosses._bossStartMs[_di];
				if(!Array.isArray(_redir_arr)) continue;
				for(let _bi = 0; _bi < _redir_arr.length; _bi++){
					if((_redir_arr[_bi] || 0) > 0){
						console.log('[bosses_select._openBossesPopup] активный бой с боссом', _bi, 'diffIdx', _di, '→ открываем боёвку');
						bosses._diffIdx = _di;
						this._compassHide();
						this._openBossesFight(_bi);
						return;
					}
				}
			}
		}

		// Компас пока грузится контент
		this._compassShow();

		// Пересобираем, чтобы ключи/счетчики были актуальны
		if(this._bossWin && this._bossWin._fightTimerInterval){
			clearInterval(this._bossWin._fightTimerInterval);
			this._bossWin._fightTimerInterval = null;
		}
		if(this._bossWin && this._bossWin.parent){
			this._bossWin.parent.removeChild(this._bossWin);
		}
		this._bossWin = null;

		const openBuilt = ()=>{
		const BB = './images/layers/popups/bosses/';
		const win = new PIXI.Container();
		win.interactive = true;

		// Фон 1280×720
		const bg = new PIXI.Sprite(PIXI.Texture.from(BB + 'bg.png'));
		bg.interactive = true;
		win.addChild(bg);

		// Кнопка Выход — правый верхний угол
		const exitBtn = new PIXI.Sprite(PIXI.Texture.from(BB + 'exit.png'));
		exitBtn.scale.set(0.5);
		if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
		exitBtn.x = 1203; exitBtn.y = 98;
		exitBtn.interactive = true; exitBtn.buttonMode = true;
		exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
		exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
		exitBtn.on('pointerdown', ()=>{
			win.visible = false;
			// 28.09.2026: слушатели свайпа висят на КОРНЕ сцены — снимаем, иначе при повторных
			// открытиях экрана они накапливаются и продолжают жить после закрытия.
			if(this._bossSelectSwipeCleanup) this._bossSelectSwipeCleanup();
			this.popHud('bossSelect');
			this._restoreBossHud();
			if(win._fightTimerInterval){ clearInterval(win._fightTimerInterval); win._fightTimerInterval = null; }
		});
		win.addChild(exitBtn);

		// Левый верхний угол попапа
		const PX = 75;   // левый край
		const PY = 72;   // верхний край

		// Вкладки — сдвинуты вправо на 120px
		const TAB_X = PX + 156;
		const tabStalkerActiv  = new PIXI.Sprite(PIXI.Texture.from(BB + 'tab_stalkers_activ.png'));
		const tabStalkerPassiv = new PIXI.Sprite(PIXI.Texture.from(BB + 'tab_stalkers.png'));
		[tabStalkerActiv, tabStalkerPassiv].forEach(t => { t.x = TAB_X; t.y = PY + 4; });
		tabStalkerActiv.visible = true; tabStalkerPassiv.visible = false;
		win.addChild(tabStalkerActiv, tabStalkerPassiv);

		const tabNechist = new PIXI.Sprite(PIXI.Texture.from(BB + 'tab_nechist.png'));
		tabNechist.x = TAB_X + 174 + 4; tabNechist.y = PY + 4;
		tabNechist.interactive = false;
		win.addChild(tabNechist);

		// Карточки боссов
		const BOSSES = [
			{ key: 'boss_ohotnik',       keys_needed: 0 },
			{ key: 'boss_schastlivchik', keys_needed: 3 },
			{ key: 'boss_yastreb',       keys_needed: 3 },
			{ key: 'boss_mecheniy',      keys_needed: 3 },
			{ key: 'boss_krys',          keys_needed: 3 },
			{ key: 'boss_barkut',        keys_needed: 1 },
			{ key: 'boss_boroda',        keys_needed: 2 },
			{ key: 'boss_zhgut',         keys_needed: 3 },
		];
		const CARD_H   = 182;
		const CARD_GAP = 8;
		const CARD_X   = PX + 158;      // карточки: -10px от предыдущего
		const LIST_TOP = PY + 47 + 6;   // ниже вкладок = начало дорожки скролла
		const LIST_H   = 509;            // высота видимой области = высота дорожки
		const CARD_DY  = 4;              // карточки: было 24, теперь -20px (вверх)

		const cardsContainer = new PIXI.Container();
		cardsContainer.x = CARD_X;
		cardsContainer.y = LIST_TOP;

		const playerKeysFallback = parseInt(udata && udata['boss_keys'] ? udata['boss_keys'] : 0);
		const KEY_SLOTS  = 3;
		const KEY_GAP    = 6;
		const KEY_BASE_X = 240 + 3;
		const KEY_W      = 19;
		const KEY_SLOT_W = 30;   // расстояние между ключами уменьшено ещё на 4px

		// Рамка «ОСОБО ОПАСЕН / УБИВШИЙ» — позиция уточнена пользователем через редактор
		// позиций (✥) 15.09.2026 напрямую на карточке Охотника (cardY=CARD_DY=4): frameSpr
		// x=648 y=12 → относительно верхнего угла карточки (664,40)→(648, 12-4=8).
		const FRAME_REL_X = 648, FRAME_REL_Y = 8;
		// Фото/плейсхолдер «убившего» — тоже уточнено через редактор позиций отдельно от
		// рамки (не как смещение от неё): x=722 y=94 (cardY=4 → относительно карточки y=90),
		// w=106 h=106 (квадрат, было 90×74), rot=-3°.
		const KILLER_CX = 722, KILLER_CY = 90;
		const KILLER_W = 106, KILLER_H = 106;
		const KILLER_ROTATION = -3 * Math.PI / 180;
		// Все подписи привязаны к левому верхнему углу карточки. Значения сняты
		// пользователем с карточки Баркута и применяются к каждому боссу одинаково.
		const KILLED_X = 310, KILLED_DY = 124, KILLED_SCALE = 1.083;
		const DAILY_X = 380, DAILY_DY = 126;
		const TIMER_X = 380, TIMER_DY = 148;

		const fightTimers = [];
		const cardYs = []; // нужны позже, когда придёт bosses.killers, чтобы разместить фото «убившего»
		const frameSprites = []; // рамка каждой карточки — фото убийцы вставляется ПОД неё (addChildAt)
		BOSSES.forEach((boss, i)=>{
			const cardY = CARD_DY + i * (CARD_H + CARD_GAP);
			cardYs.push(cardY);
			const BOSS_SHIFT_X = 0;

			// Карточка босса
			const card = new PIXI.Sprite(PIXI.Texture.from(BB + boss.key + '.png'));
			card.x = BOSS_SHIFT_X; card.y = cardY;
			cardsContainer.addChild(card);

			// Рамка «убившего» — на новых карточках (в отличие от старых) больше НЕ вшита в
			// PNG, накладывается отдельным спрайтом на все 8 карточек одинаково.
			const frameSpr = new PIXI.Sprite(PIXI.Texture.from(BB + 'osobo_opasen.png'));
			frameSpr.x = FRAME_REL_X + BOSS_SHIFT_X; frameSpr.y = cardY + FRAME_REL_Y;
			cardsContainer.addChild(frameSpr);
			frameSprites.push(frameSpr);

			// Единая «связка ключей» для ВСЕХ 8 боссов, включая Охотника (15.09.2026 — раньше
			// для Охотника (i===0) иконка/счётчик не рисовались вовсе в расчёте на то, что
			// ключи «уже нарисованы на PNG карточки», но по факту на его карточке никакого
			// счётчика ключей не было — репорт: «файл связки ключей не выводится на охотника».
			// Показываем иконку+счётчик одинаково на каждой карточке, всегда полной
			// непрозрачности (раньше тускнела до alpha=0.5, если ключей не хватает — по
			// прямому указанию это убрано, иконка больше не должна «гаснуть»).
			{
				const needKeys = (window.bosses && bosses.data[i]) ? (bosses.data[i].keys_needed || 0) : (boss.keys_needed || 0);
				let have = 0;
				if(i === 0) have = 999;
				else if(window.bosses && Array.isArray(bosses.keys)) {
					const keySlot = (bosses.data[i] && bosses.data[i].key_slot != null) ? bosses.data[i].key_slot : i;
					have = parseInt(bosses.keys[keySlot] || 0);
				}
				else have = playerKeysFallback;
				if(!Number.isFinite(have) || have < 0) have = 0;
				const shownKeys = Math.min(999, have);

				const KEYCHAIN_TARGET_H = 50;
				const kcSpr = new PIXI.Sprite(PIXI.Texture.from(BB + 'svyazka_klyuchey.png'));
				const _applyKcScale = (spr, tex) => { if(tex.height > 0) spr.scale.set(KEYCHAIN_TARGET_H / tex.height); };
				const kcTex = kcSpr.texture;
				if(kcTex.baseTexture.valid){ _applyKcScale(kcSpr, kcTex); }
				else { kcTex.baseTexture.once('loaded', ()=>_applyKcScale(kcSpr, kcTex)); }
				kcSpr.x = KEY_BASE_X + BOSS_SHIFT_X - 6;
				kcSpr.y = cardY + 6;
				kcSpr.alpha = 0.7;
				cardsContainer.addChild(kcSpr);
				console.log('[bosses_select] boss='+i+' needKeys='+needKeys+' have='+have+' связка ключей показана без затемнения');

				// Только цифра, без слова "КЛЮЧЕЙ" — по прямому указанию.
				const keysTxt = new PIXI.Text(String(shownKeys), {
					fontFamily: 'Southbank LT', fontSize: 18, fill: '#e8e0d0',
					dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
				});
				// Позиция уточнена пользователем через редактор позиций (15.09.2026) — текст
				// перенесён В САМ блок со связкой ключей (сразу справа от иконки), а не ниже,
				// под "убито/лимит" — по прямому указанию "сделай кол-во ключей в блоке, где
				// блок с ключами".
				// Координаты и масштаб выставлены по правке пользователя на карточке
				// Счастливчика; те же параметры применяются ко всем восьми карточкам.
				const KEY_TEXT_X_BY_DIGITS = { 1: 296, 2: 293, 3: 286 };
				keysTxt.x = KEY_TEXT_X_BY_DIGITS[String(shownKeys).length] || 286;
				keysTxt.y = cardY + 20;
				keysTxt.scale.set(1.333);
				cardsContainer.addChild(keysTxt);
			}

			// Убийств сегодня: X/7
			let dailyKilled = 0;
			let killed = 0;
			let bd = {};
			let fightStartMs = 0;
			try{
				// 24.09.2026 (баг найден по прямому указанию — "УБИТО:0 ЛИМИТ:0/7" сразу после
				// перезагрузки, хотя в БД реально 4): udata['bosses_data'] сразу после users.get
				// приходит уже ОБЪЕКТОМ (сервер сам раскодирует json-поля, Database::trueJSON()),
				// не строкой — голый JSON.parse() кидал исключение, тихо съеденное этим же
				// try/catch, и dailyKilled/killed оставались на 0. helper.safeParseJSON()
				// принимает и то, и другое.
				bd = helper.safeParseJSON(udata && udata['bosses_data'], {});
				if(bd.dailyKills && bd.dailyKills[i] != null) dailyKilled = parseInt(bd.dailyKills[i] || 0);
				else if(window.bosses && bosses.dailyKills) dailyKilled = parseInt(bosses.dailyKills[i] || 0);
				// 29.09.2026 (баг найден по прямому указанию + скриншот — "медаль вроде получена
				// за 10 киллов, но осталась мутной"): killsTotal (единственный источник для
				// alpha медали ниже) не имел того же фолбэка на bosses.killsTotal[i], что
				// dailyKills уже получил в фиксе 24.09.2026 выше (комментарий про "УБИТО:0
				// сразу после перезагрузки") — тот же класс бага: если udata['bosses_data']
				// (JSON-блоб) на момент открытия этого экрана ещё не успел подхватить самый
				// свежий patch от claimKill() (гонка с параллельным автосейвом — тот же класс,
				// что уже чинили для монет/тушёнки, см. память агента
				// incident_checkall_flush_wipes_server_credits), killed молча оставался 0,
				// хотя bosses.killsTotal[i] (in-memory снимок, обновляется в bosses-combat.js
				// сразу по ответу сервера) уже содержал верное значение — медаль визуально "не
				// открывалась" даже после честно набранного порога.
				if(bd.killsTotal && bd.killsTotal[i] != null) killed = parseInt(bd.killsTotal[i] || 0);
				else if(window.bosses && bosses.killsTotal) killed = parseInt(bosses.killsTotal[i] || 0);
				if(window.bosses && bosses._bossStartMs && bosses._diffIdx != null)
					fightStartMs = bosses._bossStartMs[bosses._diffIdx][i] || 0;
			} catch(e){}
			// Медали считают отдельную серию после общего сброса, а надпись «УБИТО» остаётся
			// исторической и не меняет доступность/награды боссов.
			const medalKilled = (bd.medalKills && bd.medalKills[i] != null) ? parseInt(bd.medalKills[i] || 0) : killed;
			const isFightActive = fightStartMs > 0;
			const dailyTxt = new PIXI.Text('ЛИМИТ: ' + dailyKilled + '/7', {
				fontFamily: 'Southbank LT', fontSize: 20, fill: '#e8e0d0',
				dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
			});
			dailyTxt.x = DAILY_X + BOSS_SHIFT_X;
			dailyTxt.y = cardY + DAILY_DY;
			cardsContainer.addChild(dailyTxt);

			const killedTxt = new PIXI.Text(String(killed), {
				fontFamily: 'Southbank LT', fontSize: 20, fill: '#e8e0d0',
				dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
			});
			killedTxt.x = KILLED_X + BOSS_SHIFT_X;
			killedTxt.y = cardY + KILLED_DY;
			killedTxt.scale.set(KILLED_SCALE);
			cardsContainer.addChild(killedTxt);

			const timerTxt = new PIXI.Text('', {
				fontFamily: 'Southbank LT', fontSize: 16, fill: '#ffcc44',
				dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
			});
			timerTxt.x = TIMER_X + BOSS_SHIFT_X;
			timerTxt.y = cardY + TIMER_DY;
			cardsContainer.addChild(timerTxt);
			if(isFightActive) fightTimers.push({ txt: timerTxt, bossIdx: i });

			// Кнопка «Напасть» — всегда кликабельна, ведёт на экран предпросмотра боя
			const napP = new PIXI.Sprite(PIXI.Texture.from(BB + 'napast_passiv.png'));
			const napA = new PIXI.Sprite(PIXI.Texture.from(BB + 'napast_activ.png'));
			napP.x = napA.x = 25 + BOSS_SHIFT_X;
			napP.y = napA.y = cardY + CARD_H - 39 - 10;
			napA.visible = false;

			// 19.09.2026 (баг найден, по прямому указанию: "с телефона не заходит в бой —
			// список боссов светится и всё") — клик висел ТОЛЬКО на napA (активном спрайте),
			// который появлялся по pointerover (наведение мышью). На тач-устройствах события
			// наведения не бывает вообще — палец сразу тапает по napP (пассивному спрайту),
			// у которого обработчика клика не было совсем, поэтому нажатие ничего не делало.
			// Теперь один и тот же обработчик висит на ОБОИХ спрайтах — работает и с мыши
			// (наведение просто меняет картинку), и с тача (тап сразу срабатывает).
			napP.interactive = napA.interactive = true;
			napP.buttonMode  = napA.buttonMode  = true;
			napP.on('pointerover', ()=>{ napP.visible = false; napA.visible = true; _ss(napA, 1.06); });
			napA.on('pointerout',  ()=>{ _ss(napA, 1); napA.visible = false; napP.visible = true; _ss(napP, 1); });
			// 27.09.2026 (по прямому указанию — "хочу перед боем посмотреть какие шмотки даёт
			// босс и награду за убийство, а сейчас проверка условий (дневной лимит/ключи/
			// зачистка локации) блокирует даже вход на экран предпросмотра"): раньше ВСЕ три
			// проверки жили именно здесь и не пускали игрока на _openBossPreFight() дальше —
			// экран с наградой/каруселью возможных шмоток (уже реализован в bosses_prefight.js)
			// был физически недостижим для боссов, к которым игрок ещё не готов. Теперь эта
			// маленькая кнопка карточки только открывает предпросмотр без единой проверки;
			// сами проверки (лимит/ключи/локация) перенесены на большую кнопку "Напасть"
			// (bosses_prefight.js.napBtn) — там они и должны стоять, непосредственно перед
			// реальным стартом боя.
			const _onNapastClick = ()=>{
				console.log('[bosses_select._onNapastClick] открываю предпросмотр боя (без проверок) | bossIdx:', i);
				if(window.iface) iface._openBossPreFight(i);
			};
			// 28.09.2026 (адаптив под мобильные): было napP/napA.on('pointerdown', ...) —
			// предпросмотр боя открывался в момент КАСАНИЯ, поэтому свайп по списку, начатый с
			// этой кнопки, сразу уводил с экрана. helper.onTap = отпускание без смещения >10px.
			helper.onTap(napP, _onNapastClick);
			helper.onTap(napA, _onNapastClick);
			cardsContainer.addChild(napP, napA);

			// Медали за убийства босса (бронзовая, серебрянная, золотая)
			const MEDAL_BOSS_NAMES = ['охотник', 'счастливчик', 'ястреб', 'меченный', 'крыс', 'баркут', 'борода', 'жгут'];
			// Пороги убийств для медалей (уточнить у пользователя)
			const MEDAL_THRESHOLDS = [10, 50, 100];
			const MEDAL_TYPES = ['бронзовая', 'серебрянная', 'золотая'];
			// Позиции медалей в cardsContainer (anchor 0.5,0.5), из Photoshop
			const MEDAL_POS = [{x:521,dy:116}, {x:552,dy:116}, {x:587,dy:116}];
			// У серебряной и золотой медалей Охотника сверху больше прозрачного поля.
			const MEDAL_DY = (i === 0) ? [0, -12, -12] : [0, 0, 0];
			const bossName = MEDAL_BOSS_NAMES[i] || '';
			if(bossName){
				MEDAL_TYPES.forEach((type, mi) => {
					const medalFn = bossName + ' ' + type + ' медаль.png';
					const mSpr = new PIXI.Sprite(PIXI.Texture.from('./images/' + medalFn));
					mSpr.anchor.set(0.5, 0.5);
					mSpr.x = MEDAL_POS[mi].x + BOSS_SHIFT_X;
					mSpr.y = cardY + MEDAL_POS[mi].dy + MEDAL_DY[mi];
					mSpr.alpha = medalKilled >= MEDAL_THRESHOLDS[mi] ? 1.0 : 0.35;
					cardsContainer.addChild(mSpr);
				});
			}
		});

		// Живой таймер боя для каждого босса в списке — обратный отсчёт от bosses._bossStartMs
		// (реальный серверный timestamp старта попытки).
		const _updBossTimers = ()=>{
			fightTimers.forEach(({ txt, bossIdx }) => {
				const startMs = (window.bosses && bosses._bossStartMs) ? (bosses._bossStartMs[bosses._diffIdx][bossIdx] || 0) : 0;
				if(!startMs){ txt.text = ''; return; }
				const bonus = (window.bosses && bosses._fightTimeBonusMs && bosses._fightTimeBonusMs[bosses._diffIdx])
					? (bosses._fightTimeBonusMs[bosses._diffIdx][bossIdx] || 0) : 0;
				const remain = Math.max(0, (bosses.FIGHT_DURATION_MS || 32400000) + bonus - (Date.now() - startMs));
				const s = Math.floor(remain / 1000);
				const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
				txt.text = 'УБИЙСТВО: '+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
			});
		};
		_updBossTimers();
		win._fightTimerInterval = setInterval(_updBossTimers, 1000);

		win.addChild(cardsContainer);

		// Фото «УБИВШЕГО» — того, кто ПОСЛЕДНИМ убил именно этого босса, ГЛОБАЛЬНО среди
		// вообще всех игроков игры (не только друзей — так уточнил пользователь; в отличие
		// от «РЕЙТИНГА УРОНА» в боёвке, который именно про друзей). Источник — отдельная
		// серверная таблица boss_last_kill (bosses.php.recordKill/killers), не связанная с
		// friends. Рамка "ОСОБО ОПАСЕН/УБИВШИЙ" (15.09.2026) — отдельный спрайт над каждой
		// карточкой (frameSprites[i], см. выше), с прозрачным окном под фото — фото/плейсхолдер
		// вставляются через addChildAt ПОД рамку в этом же контейнере, иначе рамка их перекроет.
		// KILLER_CX/CY/W/H заданы вместе с FRAME_REL_X/Y выше. Один запрос bosses.killers на
		// весь список боссов сразу.
		if(window.TS && window.bosses){
			TS.php('bosses.killers', {}, (res)=>{
				let killers = (res && Array.isArray(res.killers)) ? res.killers : [];
				console.log('[bosses_select] bosses.killers вернул записей:', killers.length);

				// 29.09.2026 (по прямому указанию — "моя фотка не всегда сразу первая после
				// победы"): recordKill() на сервере шлётся fire-and-forget при закрытии попапа
				// результата (bosses-combat.js._onDefeat._doRedirect) — если игрок успевает
				// открыть список боссов раньше, чем этот запрос реально долетел и записался,
				// bosses.killers ещё отдаёт СТАРОГО убившего. bosses._lastOwnKill (тот же файл,
				// _doRedirect) хранит {bossId: killed_at в секундах} моих собственных последних
				// побед за текущую сессию — подставляем себя вместо серверной записи, если моя
				// локальная метка не СТАРШЕ присланного killed_at (или для этого босса на
				// сервере вообще ещё нет записи). Как только настоящая запись долетит до
				// сервера, её killed_at сравняется/обгонит мою локальную — подмена перестанет
				// срабатывать сама собой, никакого ручного сброса не нужно.
				const myId = parseInt((window.vk_params && vk_params['vk_user_id']) || 0, 10);
				if(myId > 0 && bosses._lastOwnKill){
					const byBoss = {};
					killers.forEach(k => { byBoss[k.boss_id] = k; });
					Object.keys(bosses._lastOwnKill).forEach(bossIdStr => {
						const bossId = parseInt(bossIdStr, 10);
						const myTs = bosses._lastOwnKill[bossIdStr];
						const serverRec = byBoss[bossId];
						// Локальная подмена нужна только на время доставки fire-and-forget recordKill.
						// Без TTL старая победа текущего игрока могла всю сессию выдавать его за
						// «убившего», даже после проигрыша или более поздней победы другого игрока.
						const stillInFlight = (Math.floor(Date.now() / 1000) - myTs) <= 15;
						if(stillInFlight && (!serverRec || myTs > (serverRec.killed_at || 0))){
							console.log('[bosses_select] локальная метка своей победы новее/отсутствует на сервере — подставляю себя как убившего boss='+bossId);
							byBoss[bossId] = { boss_id: bossId, id: myId, nick: '', killed_at: myTs };
						} else if(!stillInFlight){
							delete bosses._lastOwnKill[bossIdStr];
						}
					});
					killers = Object.values(byBoss);
				}

				if(!killers.length) return;
				bosses._resolveVkUsers(killers.map(k=>k.id), (users)=>{
					killers.forEach(k => {
						const u = users[String(k.id)];
						console.log('[bosses_select] killer boss='+k.boss_id+' id='+k.id+' resolved:', u ? (u.name+', photo='+(u.photo||'НЕТ')) : 'НЕ РЕЗОЛВЛЕН');
						const cardY = cardYs[k.boss_id];
						const frameSpr = frameSprites[k.boss_id];
						if(cardY == null || !frameSpr) return;
						// Фото может отсутствовать (закрытый профиль/dev-окружение без vk_user_info),
						// а САМ пользователь может не зарезолвиться вовсе (users.get не вернул запись —
						// деактивирован/недоступен/ошибка VK API, см. лог выше "НЕ РЕЗОЛВЛЕН") — раньше
						// во ВТОРОМ случае карточка «убившего» молча не показывалась вообще ничего (return
						// до отрисовки), хотя из bosses.killers достоверно известно, что убийца есть.
						// Плейсхолдер вместо полного пропуска в обоих случаях.
						let spr;
						if(u && u.photo){
							spr = new PIXI.Sprite(PIXI.Texture.from(u.photo));
						} else {
							spr = new PIXI.Graphics();
							spr.beginFill(0x3a3a3a, 1); spr.lineStyle(2, 0x8a8a8a);
							spr.drawRect(-KILLER_W/2, -KILLER_H/2, KILLER_W, KILLER_H); spr.endFill();
						}
						spr.pivot.set(0, 0);
						if(spr instanceof PIXI.Sprite) spr.anchor.set(0.5, 0.5);
						spr.width = KILLER_W; spr.height = KILLER_H;
						spr.x = KILLER_CX; spr.y = cardY + KILLER_CY;
						spr.rotation = KILLER_ROTATION;
						spr._uRotatable = true; // доступно вращение Q/E в редакторе позиций
						// 18.09.2026 (по прямому указанию): клик по фото убившего открывает его
						// публичный профиль (персонаж с надетыми шмотками), как и везде в рамках.
						// 28.09.2026 (адаптив): onTap вместо pointerdown — фото лежит внутри
						// прокручиваемого списка, свайп с него открывал чужой профиль.
						spr.interactive = true; spr.buttonMode = true;
						helper.onTap(spr, ()=>{ if(window.iface) iface._openPlayerProfile(k.id, u && u.name); });
						// addChildAt(spr, index рамки) — рисуем ПОД рамкой, чтобы прозрачное окно
						// рамки показывало фото, а непрозрачные части рамки (лента/подпись/рамка)
						// оставались поверх сверху, не срезаясь квадратным фото.
						const frameIdx = cardsContainer.getChildIndex(frameSpr);
						cardsContainer.addChildAt(spr, frameIdx);
					});
				});
			}, (e)=>{ console.error('[bosses_select] ошибка запроса bosses.killers:', e); });
		}

		// Маска: ограничиваем видимую область списка
		const maskGfx = new PIXI.Graphics();
		maskGfx.beginFill(0xffffff);
		maskGfx.drawRect(CARD_X, LIST_TOP, 836, LIST_H - CARD_DY);
		maskGfx.endFill();
		win.addChild(maskGfx);
		cardsContainer.mask = maskGfx;

		// Дорожка скролла (30×509) — правый край
		const SCROLL_X = 1067;
		const scrollTrack = new PIXI.Sprite(PIXI.Texture.from(BB + 'scroll_track.png'));
		scrollTrack.x = SCROLL_X; scrollTrack.y = LIST_TOP - 8;
		win.addChild(scrollTrack);

		// Бегунок (37×52) — перетаскиваемый
		const TOTAL_H      = CARD_DY + BOSSES.length * (CARD_H + CARD_GAP) - CARD_GAP;
		const SCROLL_RANGE = Math.max(0, TOTAL_H - (LIST_H - CARD_DY));
		const TRACK_TOP    = LIST_TOP - 8;
		const TRACK_BOTTOM = LIST_TOP - 8 + LIST_H - 52;

		const scrollThumb = new PIXI.Sprite(PIXI.Texture.from(BB + 'scroll_thumb.png'));
		scrollThumb.x = SCROLL_X - 4; scrollThumb.y = TRACK_TOP;
		scrollThumb.interactive = true; scrollThumb.buttonMode = true;

		let dragging = false, dragStartY = 0, thumbStartY = 0;
		scrollThumb.on('pointerdown', (e)=>{
			dragging    = true;
			dragStartY  = e.data.global.y;
			thumbStartY = scrollThumb.y;
			win.on('pointermove',      onMove);
			win.on('pointerup',        onUp);
			win.on('pointerupoutside', onUp);
		});
		const onMove = (e)=>{
			if(!dragging) return;
			let ny = thumbStartY + (e.data.global.y - dragStartY);
			ny = Math.max(TRACK_TOP, Math.min(TRACK_BOTTOM, ny));
			scrollThumb.y = ny;
			const ratio = (ny - TRACK_TOP) / Math.max(1, TRACK_BOTTOM - TRACK_TOP);
			cardsContainer.y = LIST_TOP - ratio * SCROLL_RANGE + CARD_DY;
		};
		const onUp = ()=>{
			dragging = false;
			win.off('pointermove',      onMove);
			win.off('pointerup',        onUp);
			win.off('pointerupoutside', onUp);
		};
		win.addChild(scrollThumb);

		// Прокрутка колесом мыши
		const onWheel = (e)=>{
			if(!win.visible) return;
			let scrollY = LIST_TOP - cardsContainer.y + CARD_DY;
			scrollY = Math.max(0, Math.min(SCROLL_RANGE, scrollY + e.deltaY * 0.6));
			cardsContainer.y = LIST_TOP - scrollY + CARD_DY;
			const ratio = SCROLL_RANGE > 0 ? scrollY / SCROLL_RANGE : 0;
			scrollThumb.y = TRACK_TOP + ratio * (TRACK_BOTTOM - TRACK_TOP);
		};
		const canvas = document.querySelector('canvas');
		if(canvas) canvas.addEventListener('wheel', onWheel, {passive: true});

		// 28.09.2026 (адаптив под мобильные): свайп-прокрутка списка боссов пальцем. Тот же
		// приём, что в shmot_shop.js (рецепт — в CLAUDE.md, раздел «Адаптив»): отдельная
		// drag-поверхность не нужна, потому что win.interactive=true и нажатие в любой точке
		// экрана всплывает сюда; вместо неё — проверка, что палец опустился внутри списка
		// карточек (иначе протяжка запускалась бы с вкладок и с панели ключей справа).
		// Элементы внутри карточек (кнопка «Напасть», фото убившего) переведены на helper.onTap
		// выше — без этого свайп по списку сразу открывал бы предпросмотр боя.
		if(window.isMobile){
			let swipe = false, swipeY0 = 0, swipeScroll0 = 0;
			const _scrollNow = () => LIST_TOP - cardsContainer.y + CARD_DY;
			const _applyScroll = (val)=>{
				const scrollY = Math.max(0, Math.min(SCROLL_RANGE, val));
				cardsContainer.y = LIST_TOP - scrollY + CARD_DY;
				const ratio = SCROLL_RANGE > 0 ? scrollY / SCROLL_RANGE : 0;
				scrollThumb.y = TRACK_TOP + ratio * (TRACK_BOTTOM - TRACK_TOP);
			};
			const onSwipeStart = (e)=>{
				if(!win.visible || SCROLL_RANGE <= 0) return;
				if(e.target === scrollThumb) return;   // бегунок тащит свой обработчик выше
				const p = win.toLocal(e.data.global);
				if(p.x < CARD_X || p.x > SCROLL_X || p.y < LIST_TOP || p.y > LIST_TOP + LIST_H) return;
				swipe = true; swipeY0 = e.data.global.y; swipeScroll0 = _scrollNow();
			};
			const onSwipeMove = (e)=>{
				if(!swipe) return;
				_applyScroll(swipeScroll0 - (e.data.global.y - swipeY0));
			};
			const onSwipeEnd = ()=>{ swipe = false; };

			win.on('pointerdown', onSwipeStart);
			if(window.root){
				root.on('pointermove',      onSwipeMove);
				root.on('pointerup',        onSwipeEnd);
				root.on('pointerupoutside', onSwipeEnd);
			}
			// Снимается при выходе с экрана вместе с wheel-обработчиком (см. кнопку выхода):
			// иначе слушатели корня переживут закрытие экрана и будут прокручивать мёртвый
			// список при каждом движении пальца в любом месте игры.
			this._bossSelectSwipeCleanup = ()=>{
				if(!window.root) return;
				root.off('pointermove',      onSwipeMove);
				root.off('pointerup',        onSwipeEnd);
				root.off('pointerupoutside', onSwipeEnd);
			};
		}

		this._bossWin = win;
		root.layer2_mc.addChild(win);
		this.pushHud('bossSelect', { down: false });
		this._bringBossHudUp();
		this._compassWaitTex(BB + 'bg.png');
		};

		if(window.bosses) openBuilt();
		else modules.checkFlags(['bosses'], openBuilt);
	};
}
