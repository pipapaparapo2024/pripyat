/** Yashik (lootbox) overlays.
 *
 * ── SERVER-AUTHORITATIVE (18.09.2026, перенос экономики) ──
 * Раньше списание патрона/очков достижений, RNG наград и само начисление считал клиент —
 * читер мог вызвать _openOtkrytYashik() напрямую из консоли без единого патрона, либо просто
 * присвоить себе валюту. Теперь: yashik.openBox (сервер списывает патрон/очки, катает и
 * ОТКЛАДЫВАЕТ награду) → yashik.collect (начисляет отложенное). Кнопка "НАЗАД" по-прежнему
 * может сжечь уже выпавшую, но не забранную награду — collect() просто не вызывается, то же
 * поведение, что было. См. server/core/controllers/yashik.php.
 */
import { applyPatch } from '../../../modules/patch.js';
import { flushPlayerSave } from '../../../modules/player-save.js';
import { makeParallelogramHit } from '../popups/popup-hit-shapes.js';

export function attachYashik(proto){
	proto._openYashikScreen = function(){
		if(this._yashikWin){
			this._yashikWin.visible = true;
			root.layer2_mc.addChild(this._yashikWin);
			this._updateYashikScreen();
			// 24.09.2026 (по прямому указанию, декларативный ХУД): раньше Ящик прятал оба ХУДа
			// целиком — теперь оба видны на всём протяжении экрана Ящика (выбор/поиск/награда).
			this.pushHud('yashik', {});
			return;
		}

		const BASE = './images/';
		const _bgTex = PIXI.Texture.from(BASE + 'yashik_screen.png?' + (window.session_hash || ''));
		if(!_bgTex.baseTexture.valid){
			this._compassShow();
			_bgTex.baseTexture.once('loaded', ()=>{ this._compassHide(); this._openYashikScreen(); });
			_bgTex.baseTexture.once('error',  ()=>{ this._compassHide(); this._openYashikScreen(); });
			return;
		}
		const ACH_THRESHOLD = 50;

		const win = new PIXI.Container();
		win.interactive = true;

		// Темный фон-заглушка (всегда виден, PNG накладывается поверх)
		const bgDark = new PIXI.Graphics();
		bgDark.beginFill(0x0a0a0a, 1);
		bgDark.drawRect(0, 0, 1280, 720);
		bgDark.endFill();
		bgDark.interactive = true;
		win.addChild(bgDark);

		// Полноэкранный фон с ящиком и декором
		const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'yashik_screen.png?' + (window.session_hash || '')));
		bg.interactive = true;
		win.addChild(bg);

		// --- Прогресс-бар достижений (поверх рамки в фоне) ---
		// Рамка нарисована в PNG, заливка динамическая. Координаты сняты пользователем
		// напрямую с PSD-слоя "полоса" (ящик.psd) 16.09.2026: X=448 Y=100 Ш=452 В=44.
		// 26.09.2026 (по прямому указанию — новый файл "заполнение шкалы ящика.png",
		// координаты уточнены x:449 y:99): плоская заливка Graphics заменена на PNG-спрайт +
		// маска — тот же приём, что уже используется для прогресс-бара достижений
		// (svod-achievements.js: статичный на всю ширину Sprite + растущая по ширине
		// Graphics-маска поверх него), вместо прямого перекрашивания прямоугольника.
		const BAR_X = 449, BAR_Y = 99, BAR_W = 452, BAR_H = 44;

		const barFill = new PIXI.Sprite(PIXI.Texture.from(BASE + 'заполнение шкалы ящика.png'));
		barFill.x = BAR_X; barFill.y = BAR_Y;
		barFill.width = BAR_W; barFill.height = BAR_H;
		win.addChild(barFill);

		const barFillMask = new PIXI.Graphics();
		barFillMask.x = BAR_X; barFillMask.y = BAR_Y;
		win.addChild(barFillMask);
		barFill.mask = barFillMask;

		const barTxt = new PIXI.Text('0/' + ACH_THRESHOLD, {
			fontFamily: 'Southbank LT', fontSize: 36, fill: '#f3f0ee',
			dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
		});
		barTxt.anchor.set(0.5, 0.5);
		// Позиция подписи уточнена пользователем через редактор позиций (16.09.2026).
		barTxt.x = 669;
		barTxt.y = 124;
		win.addChild(barTxt);

		// --- Количество патронов (левый блок, текст поверх панели в PNG) ---
		const bulletCountTxt = new PIXI.Text('0', {
			fontFamily: 'Southbank LT', fontSize: 48, fill: '#f3f0ee',
			dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 2
		});
		bulletCountTxt.anchor.set(0.5, 0);
		bulletCountTxt.x = 111;
		bulletCountTxt.y = 150;
		win.addChild(bulletCountTxt);

		// --- Кнопка ОБЫСКАТЬ ---
		const obyskat = new PIXI.Sprite(PIXI.Texture.from(BASE + 'yashik_screen_obyskat.png'));
		obyskat.anchor.set(0.5, 0);
		obyskat.x = 674;
		obyskat.y = 499;
		obyskat.interactive = true; obyskat.buttonMode = true;
		obyskat.on('pointerover', ()=>{ obyskat.tint = 0xFFDD88; });
		obyskat.on('pointerout',  ()=>{ obyskat.tint = 0xFFFFFF; });
		obyskat.on('pointerdown', ()=>{
			if(this._yashikOpening) return;
			this._yashikOpening = true;
			// 22.09.2026 (баг найден по живому репорту — "зашёл в ящик, было мало патронов,
			// купил — стало сразу намного больше, потому что нет перерендера"): корень —
			// achievements.js начисляет патрон за очки достижений ЛОКАЛЬНО в udata, а
			// сохраняется он общим 500мс-дебаунсом (player-save.js). Если игрок жмёт ОБЫСКАТЬ
			// ДО того, как этот дебаунс успел отправиться, yashik.php.openBox() читает из БД
			// ещё СТАРОЕ значение bullets/ach_score своим loadUser() — локальный ещё не
			// сохранённый прирост тихо перезаписывается ответом сервера. Флашим сохранение
			// СИНХРОННО перед запросом — сервер гарантированно видит актуальные патроны.
			flushPlayerSave('yashik_open', () => {
				console.log('[yashik.obyskat] → сервер: yashik.openBox');
				// 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits):
				// flushPlayerSave() выше защищает только от УЖЕ стоявшего в очереди сейва — не
				// от НОВОГО автосейва, который может сработать, ПОКА сам openBox летит
				// туда-обратно (он пишет bullets/reward напрямую на сервере). suspend/resume
				// перекрывают всё окно запроса целиком — та же защита, что у bosses.attack.
				if(window.suspendPlayerSave) suspendPlayerSave('yashik_open');
				TS.php('yashik.openBox', {}, (res)=>{
					this._yashikOpening = false;
					console.log('[yashik.obyskat] ← ответ сервера:', JSON.stringify(res));
					applyPatch(res.patch);
					if(window.resumePlayerSave) resumePlayerSave('yashik_open');
					this._updateYashikScreen();
					// 22.09.2026 (по прямому указанию — "Потерянный тайник... 100-150 открытий
					// ящика") — lostStashItemId приходит НЕЗАВИСИМО от обычной награды (reward),
					// выдаётся сразу (не через collect/НАЗАД, см. комментарий yashik.php.openBox())
					// — резолвим название по локальному каталогу game/shmot.js, id — общий
					// источник правды с сервером.
					if(res.lostStashItemId != null && window.shmot && Array.isArray(shmot.items)){
						const it = shmot.items.find(x => x.id === res.lostStashItemId);
						// applyPatch() выше уже обновил udata['shmot'] (JSON-строку), но НЕ
						// перечитывает window.shmot.items в память — тот же паттерн, что
						// collectReward() ниже использует для res.shmotGranted.
						if(it){
							it.owned = true;
							if(window.notify) notify.showResult({text: 'Потерянный тайник: ' + it.name}, 1);
						}
					}
					this._openOtkrytYashik(res.reward);
				}, (err)=>{
					this._yashikOpening = false;
					if(window.resumePlayerSave) resumePlayerSave('yashik_open');
					console.error('[yashik.obyskat] ← ошибка сервера:', JSON.stringify(err));
					const cur = parseInt(udata['ach_score'] || 0);
					this._openSidorovichError(undefined,
						'Нужен патрон для ящика! Либо наберите ещё ' + Math.max(0, ACH_THRESHOLD - cur) + ' очков достижений.');
				});
			});
		});
		win.addChild(obyskat);

		// --- Кнопка закрытия (выход) — правый верхний угол ---
		const exitBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'выход.png?' + (window.session_hash || '')));
		exitBtn.scale.set(0.5);
		if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
		exitBtn.x = 1184;
		exitBtn.y = 112;
		exitBtn.interactive = true; exitBtn.buttonMode = true;
		exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
		exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
		exitBtn.on('pointerdown', ()=>{
			win.visible = false;
			this.popHud('yashik');
		});
		win.addChild(exitBtn);

		// --- Кнопка «покупка патрона» — позиция снята вручную через редактор позиций ---
		const buyPatronBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'покупка патрона.png?' + (window.session_hash || '')));
		buyPatronBtn.x = 1243; buyPatronBtn.y = 90;
		buyPatronBtn.interactive = true; buyPatronBtn.buttonMode = true;
		buyPatronBtn.on('pointerover', ()=>{ buyPatronBtn.tint = 0xFFDD88; });
		buyPatronBtn.on('pointerout',  ()=>{ buyPatronBtn.tint = 0xFFFFFF; });
		buyPatronBtn.on('pointerdown', ()=>{ this._openBuyPatronPopup(); });
		win.addChild(buyPatronBtn);

		this._yashikWin        = win;
		this._yashikBarFill    = barFill;
		this._yashikBarFillMask = barFillMask;
		this._yashikBarTxt     = barTxt;
		this._yashikBulletTxt  = bulletCountTxt;
		this._yashikObyskat    = obyskat;
		this._yashikBarX = BAR_X; this._yashikBarY = BAR_Y;
		this._yashikBarW = BAR_W; this._yashikBarH = BAR_H;
		this._yashikThreshold  = ACH_THRESHOLD;

		root.layer2_mc.addChild(win);
		this.pushHud('yashik', {});
		this._updateYashikScreen();
	};

	proto._openBuyPatronPopup = function(){
		const BASE = './images/';
		if(this._buyPatronWin && this._buyPatronWin.parent){
			this._buyPatronWin.parent.removeChild(this._buyPatronWin);
		}
		this._buyPatronWin = null;

		const win = new PIXI.Container();
		win.interactive = true;

		const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'купить патрон для ящика.png?' + (window.session_hash || '')));
		bg.interactive = true;
		win.addChild(bg);

		// 25.09.2026 (баг найден по прямому указанию + скриншот — "странный хотбар у КУПИТЬ"):
		// x=16,y=8 были никак не связаны с реальной позицией кнопки (hitBuy ниже — 448,359) —
		// в отличие от cancelActiv, которая корректно смещена от hitCancel той же компенсацией
		// (см. ниже). copy-paste остаток, спрайт подсветки КУПИТЬ рисовался в левом верхнем
		// углу попапа вместо самой кнопки.
		// 25.09.2026 (повторный репорт тем же днём, скриншот — "нет варианта Актив, вернулась
		// старая ошибка"): файл 'купить актив.png' на сервере оказался СТАРЫМ битым ассетом —
		// полноэкранный холст 1280×720 с крошечной кнопкой где-то внутри (перепутан с похожим по
		// имени, но другим файлом), а не сама кнопка вплотную обрезанная. Заменён на верный файл
		// (пользователь: C:\Users\HONOR\Desktop\vk_game\попапы\кнопки для попапов (актив пассив)\
		// кнопка купить актив.png, 236×105, видимый контент внутри почти по центру канваса —
		// проверено побайтово по альфа-каналу). Позиционирование переведено на anchor(0.5,0.5) +
		// центр hitBuy — не зависит от точных внутренних отступов файла, в отличие от старой
		// компенсации "-10/-32-N", подобранной под ДРУГОЙ (отмена актив.png) файл.
		// 25.09.2026 (уточнение тем же днём, редактор позиций — "купить актив.png x:564 y:413
		// scale:1.000"): центр hitBuy формулой давал 566,383 — близко, но неточно; снятые
		// напрямую координаты точнее (видимый файл слегка смещён внутри канваса).
		const buyActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'купить актив.png'));
		buyActiv.anchor.set(0.5, 0.5);
		buyActiv.x = 564; buyActiv.y = 413; buyActiv.scale.set(1.000);
		buyActiv.visible = false;
		win.addChild(buyActiv);

		const cancelActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'отмена актив.png'));
		cancelActiv.x = 683 - 10; cancelActiv.y = 393 - 32 - 2; // компенсация внутреннего отступа отмена актив.png
		cancelActiv.visible = false;
		win.addChild(cancelActiv);

		const PATRON_COST = 50;

		// 24.09.2026 (по прямому указанию — единый стиль хит-зон попапов, как уже сделано для
		// попапа настройки звука): те же x/y/width/height, что были у прежних прямоугольников,
		// форма — параллелограмм.
		// 25.09.2026: высота была 105 (в 2 раза больше, чем у соседней ОТМЕНА — 48px) — хит-зона
		// накрывала текст "ПАТРОН СТОИТ..." над самой кнопкой. Приведена к той же высоте, что и
		// ОТМЕНА (единая форма, как и попросил пользователь).
		const hitBuy = makeParallelogramHit(win, 448, 359, 236, 48, 18);
		// 25.09.2026 (уточнение тем же днём, редактор позиций — "хотбокс x:457 y:393
		// scale:0.932"): точная подгонка под реальную кнопку "КУПИТЬ" на фоне попапа — поверх
		// геометрии makeParallelogramHit() выше (та же форма, просто сдвинута/чуть уменьшена).
		hitBuy.x = 457; hitBuy.y = 393; hitBuy.scale.set(0.932);
		hitBuy.on('pointerdown', () => { buyActiv.visible = true; });
		hitBuy.on('pointerup', () => {
			buyActiv.visible = false;
			win.visible = false;
			if(this._yashikBuyingPatron) return;
			this._yashikBuyingPatron = true;
			// 22.09.2026 — та же гонка, что и в obyskat выше (см. комментарий там): флашим
			// сохранение перед buyPatron, иначе сервер может списать тушёнку и начислить +1
			// патрон от УСТАРЕВШЕГО bullets, перезаписав ещё не сохранённый локальный прирост.
			flushPlayerSave('yashik_buy_patron', () => {
				console.log('[yashik._openBuyPatronPopup] → сервер: yashik.buyPatron');
				// 28.09.2026 (та же защита, что в obyskat выше — см. память агента
				// incident_checkall_flush_wipes_server_credits): buyPatron() тоже пишет
				// stew/bullets напрямую на сервере.
				if(window.suspendPlayerSave) suspendPlayerSave('yashik_buy_patron');
				TS.php('yashik.buyPatron', {}, (res)=>{
					this._yashikBuyingPatron = false;
					console.log('[yashik._openBuyPatronPopup] ← ответ сервера:', JSON.stringify(res));
					applyPatch(res.patch);
					if(window.resumePlayerSave) resumePlayerSave('yashik_buy_patron');
					if(this._yashikWin && this._yashikWin.visible) this._updateYashikScreen();
				}, (err)=>{
					this._yashikBuyingPatron = false;
					if(window.resumePlayerSave) resumePlayerSave('yashik_buy_patron');
					console.error('[yashik._openBuyPatronPopup] ← ошибка сервера:', JSON.stringify(err));
					// 24.09.2026 (баг найден по прямому указанию — "ошибка: нужно 50, у меня 104"):
					// сервер теперь отдаёт РЕАЛЬНЫЙ остаток (need/have) в самом ответе ошибки —
					// показываем именно их, а не локальный PATRON_COST/udata['stew'] (могли быть
					// устаревшими относительно БД на момент отказа, см. коммент в yashik.php).
					const need = (err && err.need !== undefined) ? err.need : PATRON_COST;
					const have = (err && err.have !== undefined) ? err.have : parseInt(udata['stew'] || 0);
					this._openSidorovichError('Недостаточно тушёнки!', 'Нужно: ' + need + ' • У вас: ' + have);
				});
			});
		});
		hitBuy.on('pointerupoutside', () => { buyActiv.visible = false; });

		const hitCancel = makeParallelogramHit(win, 683, 393, 227, 48, 18);
		hitCancel.on('pointerdown',    () => { cancelActiv.visible = true; });
		hitCancel.on('pointerup',      () => { cancelActiv.visible = false; win.visible = false; });
		hitCancel.on('pointerupoutside', () => { cancelActiv.visible = false; });

		this._buyPatronWin = win;
		root.layer2_mc.addChild(win);
	};

	proto._openSidorovichError = function(title, subtitle){
		const BASE = './images/';
		if(this._sidErrorWin && this._sidErrorWin.parent){
			this._sidErrorWin.parent.removeChild(this._sidErrorWin);
		}
		this._sidErrorWin = null;

		console.log('[yashik._openSidorovichError] title:', title, 'subtitle:', subtitle);

		const win = new PIXI.Container();
		win.interactive = true;

		const bgBlock = new PIXI.Graphics();
		bgBlock.beginFill(0x000000, 0.6);
		bgBlock.drawRect(0, 0, 1280, 720);
		bgBlock.endFill();
		bgBlock.interactive = true;
		win.addChild(bgBlock);

		// Попап 1429x1077 → scale 0.5 → отображается 714x538, центр канваса
		const popup = new PIXI.Container();
		popup.x = 283; popup.y = 91;
		win.addChild(popup);

		const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'попап ошибка.png'));
		bg.scale.set(0.5);
		// 22.09.2026 (по прямому указанию, редактор позиций — новое расположение попапа
		// ошибки): фон поднят на 20px (y:0→-20), заголовок/подзаголовок/кнопка ПОНЯТНО не
		// трогались — их координаты (300/350/442) подтверждены редактором как прежние.
		bg.y = -20;
		bg.interactive = true;
		popup.addChild(bg);

		// Текст ошибки: центр по x=357 (714/2), y≈310 (image y≈620, *0.5)
		const t1 = title || 'ОШИБКА';
		const titleTxt = new PIXI.Text(t1, {
			fontFamily: 'Southbank LT', fontSize: 26, fill: '#cc4411',
			align: 'center', wordWrap: true, wordWrapWidth: 520,
			dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 2
		});
		titleTxt.anchor.set(0.5, 0);
		titleTxt.x = 357; titleTxt.y = 300;
		popup.addChild(titleTxt);

		if(subtitle){
			const subTxt = new PIXI.Text(subtitle, {
				fontFamily: 'Southbank LT', fontSize: 19, fill: '#e8c088',
				align: 'center', wordWrap: true, wordWrapWidth: 520,
				dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
			});
			subTxt.anchor.set(0.5, 0);
			subTxt.x = 357; subTxt.y = 350;
			popup.addChild(subTxt);
		}

		// Кнопка ПОНЯТНО: PSD X=477,Y=837 центр=(727,923) → *0.5=(364,462), y сдвинута
		// на -20 через редактор позиций (16.09.2026, единый попап на все 16 мест использования).
		const okBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'попап ошибка кнопка понятно.png'));
		okBtn.anchor.set(0.5, 0.5);
		okBtn.scale.set(0.55);
		okBtn.x = 364; okBtn.y = 442;
		popup.addChild(okBtn);

		// Хит-зона — параллелограмм (24.09.2026, по прямому указанию — единый стиль хит-зон
		// попапов, как уже сделано для попапа настройки звука), отдельным элементом поверх
		// спрайта: у спрайта anchor(0.5,0.5) и масштаб, а makeParallelogramHit ожидает
		// top-left-координаты — bounding box пересчитан из тех же x/y/scale, что и okBtn
		// (native 501×172 * scale 0.55 = 275.55×94.6, центр 364/442 → top-left 226/395).
		const okHit = makeParallelogramHit(popup, 226, 395, 276, 95, 18);
		okHit.on('pointerover', ()=>{ okBtn.alpha = 0.8; });
		okHit.on('pointerout',  ()=>{ okBtn.alpha = 1; });
		okHit.on('pointerdown', ()=>{ if(win.parent) win.parent.removeChild(win); this._sidErrorWin = null; });

		this._sidErrorWin = win;
		root.layer2_mc.addChild(win);
		if(window.iface) iface.restoreHud();
	}

	// reward — {stash,cig,coins,exp,shmotId} уже откатан сервером (yashik.openBox, см. шапку
	// файла) — эта функция только показывает его и, при ЗАБРАТЬ/крестике, просит сервер
	// начислить (yashik.collect). Локального RNG здесь больше нет.
	proto._openOtkrytYashik = function(reward){
		const BASE = './images/';

		const stashGain = reward.stash;
		const cigsGain  = reward.cig;
		const coinsGain = reward.coins;
		const expGain   = reward.exp;
		const shmotItem = (reward.shmotId !== null && reward.shmotId !== undefined && window.shmot)
			? shmot.items.find(it => it.id === reward.shmotId)
			: null;

		const fmt = n => n >= 1000 ? Math.floor(n / 1000) + 'K' : String(n);
		let rewardGiven = false;
		const STYLE = { fontFamily:'Southbank LT', fontSize:26, fill:0xffffff, align:'center' };

		const win = new PIXI.Container();
		win.interactive = true;

		// Фон
		const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'yashik_otkryt.png'));
		bg.interactive = true;
		win.addChild(bg);

		// --- Левая панель: шмотка или "УВЫ БРАТ" ---
		if(shmotItem){
			const iconTxt = new PIXI.Text(shmotItem.icon, { fontFamily:'Southbank LT', fontSize:80, fill:0xffffff });
			iconTxt.anchor.set(0.5, 0.5);
			iconTxt.x = 260; iconTxt.y = 330;
			win.addChild(iconTxt);

			const nameTxt = new PIXI.Text(shmotItem.name, {
				fontFamily:'Southbank LT', fontSize:24, fill:0xffffff,
				align:'center', wordWrap:true, wordWrapWidth:220,
			});
			nameTxt.anchor.set(0.5, 0.5);
			nameTxt.x = 260; nameTxt.y = 460;
			win.addChild(nameTxt);

			const shmLbl = new PIXI.Text('ШМОТКА', { fontFamily:'Southbank LT', fontSize:30, fill:0xffd700 });
			shmLbl.anchor.set(0.5, 0.5);
			shmLbl.x = 260; shmLbl.y = 550;
			win.addChild(shmLbl);
		} else {
			const uwyaTxt = new PIXI.Text(
				'УВЫ БРАТ\nВ СЛЕДУЮЩИЙ РАЗ\nДЕРЖИ ОПЫТА :\n' + fmt(expGain),
				{ fontFamily:'Southbank LT', fontSize:36, fill:0xffffff, align:'center', wordWrap:true, wordWrapWidth:253 }
			);
			uwyaTxt.anchor.set(0.5, 0.5);
			uwyaTxt.x = 236; uwyaTxt.y = 351;
			win.addChild(uwyaTxt);

			const expLbl = new PIXI.Text('ОПЫТ', { fontFamily:'Southbank LT', fontSize:42, fill:0xffffff });
			expLbl.anchor.set(0.5, 0.5);
			expLbl.x = 236; expLbl.y = 532;
			win.addChild(expLbl);
		}

		// --- Количества в ячейках кейса (позиции из Photoshop) ---
		const _addItemTxt = (label, _x, _y) => {
			const t = new PIXI.Text(label, { ...STYLE, fontSize:24 });
			t.anchor.set(0.5, 0); t.x = _x; t.y = _y;
			win.addChild(t);
		};
		// Координаты из PSD, дополнительный сдвиг вниз на 32 px + ручная коррекция по месту.
		_addItemTxt('+' + coinsGain,     532, 451);
		_addItemTxt('+' + fmt(cigsGain), 688, 451);
		_addItemTxt('+' + stashGain,     835, 451);

		// Общий колбэк для крестика И "ЗАБРАТЬ" — оба зовут yashik.collect(), начисляющий
		// ранее откатанную (yashik.openBox) награду. "НАЗАД" этот колбэк не вызывает вообще —
		// награда сгорает вместе с yashik_session при следующем открытии ящика (тот же UX,
		// что был у клиента: rewardGiven здесь только защищает от двойного клика/начисления).
		const collectReward = () => {
			if(rewardGiven) return;
			rewardGiven = true;
			console.log('[yashik._openOtkrytYashik] → сервер: yashik.collect');
			// 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits):
			// collect() начисляет coins/cigarettes/exp/shmot напрямую на сервере.
			if(window.suspendPlayerSave) suspendPlayerSave('yashik_collect');
			TS.php('yashik.collect', {}, (res)=>{
				console.log('[yashik._openOtkrytYashik] ← ответ сервера:', JSON.stringify(res));
				applyPatch(res.patch);
				if(window.resumePlayerSave) resumePlayerSave('yashik_collect');
				if(res.shmotGranted !== null && res.shmotGranted !== undefined && window.shmot){
					const found = shmot.items.find(it => it.id === res.shmotGranted);
					if(found) found.owned = true;
				}
				if(window.iface){
					const _items = [
						{type:'stash', amount:stashGain},
						{type:'cigarettes', amount:cigsGain},
						{type:'coins', amount:coinsGain},
						{type:'exp', amount:expGain},
					];
					if(shmotItem) _items.push({type:'shmot', amount:1});
					iface._showRewardPopup(_items);
					iface.updateUp();
				}
				// 21.09.2026 (аудит "достижения появляются с задержкой") — applyPatch() сама
				// зовёт только iface.updateUp(), достижения не проверяет; ящик раньше не имел
				// собственной проверки вовсе.
				if(window.achievements) achievements._checkAll();
			}, (err)=>{
				if(window.resumePlayerSave) resumePlayerSave('yashik_collect');
				console.error('[yashik._openOtkrytYashik] ← ошибка сервера (collect):', JSON.stringify(err));
			});
		};

		// --- X-кнопка (крестик) --- закрыть + начислить + попап
		const xCloseBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png?' + (window.session_hash || '')));
		xCloseBtn.anchor.set(0.5, 0.5);
		xCloseBtn.scale.set(0.5);
		xCloseBtn.x = 1240; xCloseBtn.y = 52;
		xCloseBtn.interactive = true; xCloseBtn.buttonMode = true;
		xCloseBtn.on('pointerover', ()=>{ xCloseBtn.alpha = 0.75; });
		xCloseBtn.on('pointerout',  ()=>{ xCloseBtn.alpha = 1; });
		xCloseBtn.on('pointerdown', ()=>{
			collectReward();
			win.visible = false;
			if(win.parent) win.parent.removeChild(win);
		});
		win.addChild(xCloseBtn);

		// --- Кнопка НАЗАД (правый верхний угол) ---
		const nazadBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'btn_nazad_otkryt.png'));
		nazadBtn.x = 1100; nazadBtn.y = 138;
		nazadBtn.interactive = true; nazadBtn.buttonMode = true;
		nazadBtn.on('pointerover', ()=>{ _sa(nazadBtn, 0.8); nazadBtn.scale.set(1.08); });
		nazadBtn.on('pointerout', ()=>{ _sa(nazadBtn, 1); nazadBtn.scale.set(1); });
		nazadBtn.on('pointerdown', ()=>{
			win.visible = false;
			if(win.parent) win.parent.removeChild(win);
		});
		win.addChild(nazadBtn);

		// --- Кнопка ЗАБРАТЬ (под кейсом) ---
		const zabratBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'btn_zabrat_otkryt.png'));
		zabratBtn.x = 510; zabratBtn.y = 570;
		zabratBtn.interactive = true; zabratBtn.buttonMode = true;
		zabratBtn.on('pointerover', ()=>{ _sa(zabratBtn, 0.85); zabratBtn.scale.set(1.08); });
		zabratBtn.on('pointerout', ()=>{ _sa(zabratBtn, 1); zabratBtn.scale.set(1); });
		zabratBtn.on('pointerdown', ()=>{
			this._showConfirmPopup('Забрать награду?', ()=>{
				collectReward();
				win.visible = false;
				if(win.parent) win.parent.removeChild(win);
			});
		});
		win.addChild(zabratBtn);

		root.layer2_mc.addChild(win);
	};

	proto._updateYashikScreen = function(){
		if(!this._yashikWin) return;
		const ACH = this._yashikThreshold || 50;
		const cur     = Math.min(parseInt(udata['ach_score'] || 0), ACH);
		const bullets = parseInt(udata['bullets'] || 0);

		// 26.09.2026: заливка прогресс-бара теперь — маска поверх статичного PNG-спрайта
		// (this._yashikBarFill), а не перекрашенный прямоугольник Graphics. Маска в
		// ЛОКАЛЬНЫХ координатах спрайта (0,0 = левый край бара, см. barFillMask.x/y при
		// создании), растёт по ширине слева направо по мере накопления очков достижений.
		const fillW = Math.max(0, Math.floor(this._yashikBarW * cur / ACH));
		this._yashikBarFillMask.clear();
		if(fillW > 0){
			this._yashikBarFillMask.beginFill(0xffffff);
			this._yashikBarFillMask.drawRect(0, 0, fillW, this._yashikBarH);
			this._yashikBarFillMask.endFill();
		}

		this._yashikBarTxt.text    = cur + '/' + ACH;
		this._yashikBulletTxt.text = String(bullets);

		// Кнопка всегда видима и кликабельна
		if(this._yashikObyskat){
			this._yashikObyskat.alpha       = 1;
			this._yashikObyskat.interactive = true;
			this._yashikObyskat.buttonMode  = true;
		}
	};
}
