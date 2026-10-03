import { applyPatch } from '../modules/patch.js';
import { makeParallelogramHit } from './shell/popups/popup-hit-shapes.js';

// Индекс this.data ⇔ ключ скилла/шмота — тот же порядок, что и в
// bosses_fight.js._showWpnTip (WPN_KEYS) и в server/core/controllers/bosses.php:attack()
// ($sk['weapon'] и $weaponShmotKey), сверено построчно, чтобы клиентская подсказка урона
// не расходилась с тем, что реально считает сервер.
const WPN_KEYS = ['knife', 'chain', 'bat', 'machete', 'gun', 'auto'];
const WEAPON_SHMOT_FLAT_KEY = { machete: 'machete_flat', gun: 'gun_flat', auto: 'auto_flat' };

export default class Weapons{
	constructor(mc){
		this.mc  = mc;

		// ТЗ стр.10,25: бесплатные — нож, цепь, бита; донатные — мачете, ствол, автомат
		// 20 тиров апгрейда: стоимость >0=монеты, <0=тушенка
		const _uc = [10,20,10,10,10,10,10,10,10,50,30,-5,80,-7,100,60,70,10,10,100];
		this.data = [
			{id:0, name:'Нож',    type:'Нож',     icon:'🔪', damage:5,   speed:95, level:1,  upg:0, max_upg:20, owned:true,  equipped:true,  cost:0,    donate:false, upg_cost:_uc},
			{id:1, name:'Цепь',   type:'Цепь',    icon:'⛓',  damage:12,  speed:80, level:1,  upg:0, max_upg:20, owned:true,  equipped:false, cost:500,  donate:false, upg_cost:_uc},
			{id:2, name:'Бита',   type:'Бита',    icon:'🏏', damage:20,  speed:70, level:5,  upg:0, max_upg:20, owned:true,  equipped:false, cost:1500, donate:false, upg_cost:_uc},
			{id:3, name:'Мачете', type:'Мачете',  icon:'🪓', damage:40,  speed:60, level:10, upg:0, max_upg:20, owned:false, equipped:false, cost:4,    donate:true,  upg_cost:_uc},
			{id:4, name:'Ствол',  type:'Ствол',   icon:'🔫', damage:50,  speed:55, level:15, upg:0, max_upg:20, owned:false, equipped:false, cost:5,    donate:true,  upg_cost:_uc},
			{id:5, name:'Автомат',type:'Автомат', icon:'🪖', damage:200, speed:40, level:20, upg:0, max_upg:20, owned:false, equipped:false, cost:18,   donate:true,  upg_cost:_uc},
		];
		// Суммарный flat-бонус урона по тирам (индекс = уровень апгрейда)
		this._tierDmg = [0,10,30,30,30,30,30,30,30,30,80,80,85,93,100,120,178,248,248,248,348];

		// PIXI screens — строятся лениво в _buildScreen()
		this._win        = null;
		this._confirmWin = null;
		this._pendingBuyIdx = -1;
		this._cardStatus    = [];  // {statusTxt, priceContainer, idx}

		this._loadFromUdata();
	}

	// 25.09.2026 (по прямому указанию — "убираем эту механику"): бонус "Зала оружия" (+1 урона
	// за каждый пройденный порог накопленного total_damage, ТЗ стр.27) убран целиком —
	// getHallBonus() удалён, все вызывавшие его места больше не добавляют этот бонус.

	// Итоговый урон экипированного оружия (вызывается из bosses/zone)
	static getEquippedDamage(){
		if(!window.weapons) return 50;
		const wp = window.weapons.data.find(w=>w.equipped);
		if(!wp) return 50;
		const tierBonus = (window.weapons._tierDmg || [])[Math.min(20, wp.upg || 0)] || 0;
		return wp.damage + tierBonus;
	}

	// 25.09.2026 (по прямому указанию — "оружейка должна показывать уже модифицированный урон,
	// учитывая скиллы и шмотки; шмотки не дают бонуса, посмотри что не так"): бонус шмота
	// (bk:'damage' — % ко всему урону, bk:'machete_flat'/'gun_flat'/'auto_flat' — флэт к
	// конкретному донатному оружию) на самом деле УЖЕ применяется в реальном бою — считает
	// сервер, bosses.php:attack() (сверено построчно ниже). Не применялся только на ЭКРАНЕ —
	// оружейка (_renderStatus) и подсказка урона в бою (bosses_fight.js._showWpnTip) показывали
	// голый damage+tierBonus+flatSkill, без шмота, из-за чего экипировка вещи визуально ничего
	// не меняла — отсюда и ощущение "шмотки не дают бонуса". Единая формула вынесена сюда, чтобы
	// оба экрана считали одинаково и не расходились с сервером.
	// 28.09.2026 (по прямому указанию — новая экономика бонусов шмота): фильтр по it.equipped
	// заменён на it.owned — бонус даёт сам факт владения вещью, надевать необязательно (см.
	// тот же переход в bosses.php:attack()).
	computeModifiedDamage(idx){
		const wp = this.data[idx];
		if(!wp) return 0;
		const baseDmg = wp.damage || 0;
		const tierBonus = (this._tierDmg || [])[Math.min(20, wp.upg || 0)] || 0;
		const wKey = WPN_KEYS[idx] || '';
		const flatSkill = window.skills ? skills.getFlatBonus(wKey) : 0;
		const weaponShmotKey = WEAPON_SHMOT_FLAT_KEY[wKey] || null;
		let shmotDmgPct = 0, shmotFlat = 0;
		if(window.shmot && Array.isArray(shmot.items)){
			shmot.items.forEach(it => {
				if(!it.owned) return;
				if(it.bk === 'damage') shmotDmgPct += (it.bv || 0);
				if(weaponShmotKey && it.bk === weaponShmotKey) shmotFlat += (it.bv || 0);
			});
		}
		const shmotDmgMult = 1 + shmotDmgPct / 100;
		return Math.floor((baseDmg + tierBonus + flatSkill + shmotFlat) * shmotDmgMult);
	}

	open(){
		if(this._win && this._win.parent){
			this._win.parent.removeChild(this._win);
		}
		this._win = null;
		this._buildScreen();
		this._loadFromUdata();
		this._renderStatus();
		// layer2 — поверх боковых HUD; верхний/нижний HUD поднимаем поверх
		this._win.interactive = true;
		root.layer2_mc.addChild(this._win);
		// Оружейка держит оба ХУДа видимыми всегда, даже если открыта поверх боя с боссом
		// (24.09.2026, декларативный ХУД — см. Interface.pushHud/popHud в interface.js).
		if(window.iface) iface.pushHud('weapons', { down: true });
		// Компас пока грузится фон оружейки
		if(window.iface && typeof iface._compassWaitTex === 'function'){
			iface._compassWaitTex('./images/покупка оружия.png');
		}
	}

	close(){
		if(this._win && this._win.parent){
			this._win.parent.removeChild(this._win);
		}
		this._win = null;
		if(window.iface) iface.popHud('weapons');
		try{ home.closeScreen(); } catch(e){}
	}

	// --- Построить PIXI-экран оружейки ---
	_buildScreen(){
		const BASE = './images/';
		const win = new PIXI.Container();
		win.interactive = true;

		// Фон — покупка оружия.png (1280×720). Позиция/масштаб сняты через редактор позиций
		// (25.09.2026, по прямому указанию; X уточнён тем же днём повторно: -11 → -7).
		const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'покупка оружия.png'));
		bg.x = -7; bg.y = 0; bg.scale.set(1.006);
		win.addChild(bg);

		// Множители покупки по карточкам
		this._buyMult = { 3: 1, 4: 1, 5: 1 };
		this._cardStatus = [];

		// 3 донатных оружия: Мачете / Пистолет / Автомат
		// dmg/price/tag/stock — базовые + правки из ТЗ
		const CARDS = [
			{ // мачете
				dataIdx: 3, centerX: 310 + 40 - 12,
				dmgX: 310 + 32, dmgY: 400 - 20 - 12,
				priceX: 310 + 40 - 2, priceY: 500 - 12 + 12 - 6,
				buyY: 545 - 40 + 8,
				tagX: 400 + 40 + 18 + 4, tagY: 510 + 24 + 9 - 4,
				stockX: 1200, stockY: 289,
			},
			{ // пистолет
				dataIdx: 4, centerX: 628 - 10 + 2,
				dmgX: 628, dmgY: 400 - 24 - 12,
				priceX: 628 + 12, priceY: 500 - 12 + 12 - 6,
				buyY: 545 - 40 + 8,
				tagX: 718 + 20 + 2 + 2, tagY: 510 + 24 + 2 + 2,
				stockX: 1200, stockY: 219,
			},
			{ // автомат
				dataIdx: 5, centerX: 920 - 12 - 2,
				dmgX: 920, dmgY: 364,
				priceX: 920 + 12, priceY: 500 - 10 + 12 - 6,
				buyY: 545 - 40 + 8,
				tagX: 1010 + 20 - 2, tagY: 510 + 24 + 2 - 1,
				stockX: 1200, stockY: 146,
			},
		];

		const TAG_ROT = Math.PI / 4 + (5 * Math.PI / 180) + (2 * Math.PI / 180); // 45°+5°+2°

		CARDS.forEach((card) => {
			const idx = card.dataIdx;
			const wp  = this.data[idx];

			// Урон над описанием
			const dmgTxt = new PIXI.Text('', {
				fontFamily: 'Southbank LT', fontSize: 18, fill: '#e8e0d0',
				dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
			});
			dmgTxt.anchor.set(0.5, 0.5);
			dmgTxt.x = card.dmgX;
			dmgTxt.y = card.dmgY;
			win.addChild(dmgTxt);

			// Цена в блоке у монет: «N РУБ»
			const priceTxt = new PIXI.Text('', {
				fontFamily: 'Southbank LT', fontSize: 22, fill: '#ffee88',
				dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
			});
			priceTxt.anchor.set(0.5, 0.5);
			priceTxt.x = card.priceX;
			priceTxt.y = card.priceY;
			win.addChild(priceTxt);

			// Кнопка КУПИТЬ — под биркой, чтобы не перекрывала клик по X
			const buyBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'экран оружие купить.png'));
			buyBtn.anchor.set(0.5, 0);
			buyBtn.x = card.centerX;
			buyBtn.y = card.buyY;
			buyBtn.interactive = true;
			buyBtn.buttonMode  = true;
			buyBtn.on('pointerover', ()=>{ _sa(buyBtn, 0.85); buyBtn.scale.set(1.08); });
			buyBtn.on('pointerout', ()=>{ _sa(buyBtn, 1); buyBtn.scale.set(1); });
			buyBtn.on('pointerdown', () => {
				buyBtn.alpha = 1;
				this._showConfirm(idx);
			});
			win.addChild(buyBtn);

			const cycleMult = () => {
				const cur = this._buyMult[idx] || 1;
				this._buyMult[idx] = cur === 1 ? 10 : cur === 10 ? 100 : 1;
				this._renderStatus();
			};

			// Бирка — отдельный спрайт (3 шт.), как на макете
			const birka = new PIXI.Sprite(PIXI.Texture.from(BASE + 'бирка.png'));
			birka.anchor.set(0.5, 0.5);
			birka.x = card.tagX;
			birka.y = card.tagY;
			birka.interactive = true;
			birka.buttonMode  = true;
			birka.on('pointerdown', cycleMult);
			win.addChild(birka);

			// Тег X1 / X10 / X100 поверх бирки
			const tagTxt = new PIXI.Text('X1', {
				fontFamily: 'Southbank LT', fontSize: 18 + 8, fill: '#000000',
				fontWeight: 'bold',
			});
			tagTxt.anchor.set(0.5, 0.5);
			tagTxt.x = card.tagX;
			tagTxt.y = card.tagY;
			tagTxt.rotation = TAG_ROT;
			tagTxt.interactive = true;
			tagTxt.buttonMode  = true;
			tagTxt.on('pointerdown', cycleMult);
			win.addChild(tagTxt);

			// Статус (КУПЛЕНО / ЭКИПИРОВАНО) — под кнопкой
			const statusTxt = new PIXI.Text('', {
				fontFamily: 'Southbank LT', fontSize: 16, fill: '#aaaaaa',
				dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
				align: 'center'
			});
			statusTxt.anchor.set(0.5, 0.5);
			statusTxt.x = card.centerX;
			statusTxt.y = card.buyY + 55;
			statusTxt.interactive = true;
			statusTxt.buttonMode = true;
			statusTxt.on('pointerdown', () => {
				const wp = this.data[idx];
				if(wp.owned || parseInt(wp.qty||0) > 0){
					this._equip(idx);
					notify.showResult({text: wp.name + ' экипировано!'}, 1);
				}
			});
			win.addChild(statusTxt);

			// Сток справа
			const stockTxt = new PIXI.Text('0', {
				fontFamily: 'Southbank LT', fontSize: 20, fill: '#ffee88',
				dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1,
			});
			stockTxt.anchor.set(0.5, 0.5);
			stockTxt.x = card.stockX;
			stockTxt.y = card.stockY;
			win.addChild(stockTxt);

			this._cardStatus.push({ statusTxt, priceTxt, dmgTxt, tagTxt, stockTxt, dataIdx: idx });
		});

		// Крестик выхода — правый верхний угол
		const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/layers/zone/btn_exit.png'));
		exitBtn.scale.set(0.5);
		if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
		exitBtn.x = 1240;
		exitBtn.y = 79;
		exitBtn.interactive = true;
		exitBtn.buttonMode  = true;
		exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
		exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
		exitBtn.on('pointerdown', ()=>{ this.close(); });
		win.addChild(exitBtn);

		// --- Окно подтверждения покупки ---
		this._confirmWin = this._buildConfirmWin();
		win.addChild(this._confirmWin);

		this._win = win;
	}

	_buildConfirmWin(){
		const BASE = './images/';
		const cw = new PIXI.Container();
		cw.interactive = true;
		cw.visible = false;

		// PNG с вопросом (1280×720, серый фон включен в PNG)
		const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'точно хочешь купить.png'));
		cw.addChild(bg);

		// Оверлей "КУПИТЬ актив" — мигает при нажатии.
		// 25.09.2026 (по прямому указанию, скриншот — "нет варианта Актив, вернулась старая
		// ошибка"): 'купить актив.png' на сервере был битым файлом (полноэкранный холст 1280×720
		// с кнопкой где-то внутри), заменён на верную вплотную обрезанную кнопку (236×105, см.
		// подробный коммент в yashik.js._buildBuyPatronWin — тот же файл, тот же фикс). Раньше
		// спрайт полагался на то, что кнопка в PNG УЖЕ нарисована в нужном месте полноэкранного
		// холста — с маленьким файлом это больше не так, позиция теперь явная: anchor(0.5,0.5) +
		// центр hitBuy ниже (430,352,236,105).
		const купитьActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'купить актив.png'));
		купитьActiv.anchor.set(0.5, 0.5);
		купитьActiv.x = 430 + 236 / 2; купитьActiv.y = 352 + 105 / 2;
		купитьActiv.visible = false;
		cw.addChild(купитьActiv);

		// Оверлей "ВЫЙТИ/ОТМЕНА актив"
		const выйтиActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'отмена актив.png'));
		// 22.09.2026 (по прямому указанию, редактор позиций): поднято ещё на 1px (354→353).
		выйтиActiv.x = 665 - 10; выйтиActiv.y = 386 - 32 - 1; // компенсация внутреннего отступа отмена актив.png
		выйтиActiv.visible = false;
		cw.addChild(выйтиActiv);

		const _flash = (spr, cb) => {
			spr.visible = true;
			setTimeout(() => { spr.visible = false; if(cb) cb(); }, 180);
		};

		// Хит-зона КУПИТЬ (левая кнопка) — 26.09.2026 (баг найден по прямому указанию,
		// 2 скриншота хитбоксов из редактора позиций): раньше 236×105 — заметно выше и шире
		// самой кнопки, залезала в текст "ТЫ ТОЧНО ХОЧЕШЬ КУПИТЬ?" над ней. Приведена к ТОЙ ЖЕ
		// форме/размеру, что и хитбокс ОТМЕНА (227×48, slant 18, тот же Y — обе кнопки на одной
		// визуальной строке), меняется только X (своя горизонтальная позиция левой кнопки).
		const hitBuy = makeParallelogramHit(cw, 430, 386, 227, 48, 18);
		hitBuy.on('pointerdown', () => {
			_flash(купитьActiv, () => {
				cw.visible = false;
				if(this._pendingBuyIdx >= 0) this._buy(this._pendingBuyIdx);
				this._pendingBuyIdx = -1;
			});
		});

		// Хит-зона ОТМЕНА (правая кнопка) — параллелограмм, те же x/y/width/height, что и у
		// прежнего прямоугольника (см. коммент у hitBuy выше).
		const hitCancel = makeParallelogramHit(cw, 665, 386, 227, 48, 18);
		hitCancel.on('pointerdown', () => {
			_flash(выйтиActiv, () => { cw.visible = false; this._pendingBuyIdx = -1; });
		});

		return cw;
	}

	_showConfirm(idx){
		this._pendingBuyIdx = idx;
		if(this._confirmWin) this._confirmWin.visible = true;
	}

	_renderStatus(){
		if(!this._cardStatus) return;
		this._cardStatus.forEach(({ statusTxt, priceTxt, dmgTxt, tagTxt, stockTxt, dataIdx }) => {
			const wp = this.data[dataIdx];
			const mult = (this._buyMult && this._buyMult[dataIdx]) || 1;
			// Урон не зависит от X1/X10/X100 — множитель только на цену. Число включает тир
			// прокачки + бонус скиллов + бонус экипированных шмоток (computeModifiedDamage).
			const dmg = this.computeModifiedDamage(dataIdx);
			if(dmgTxt) dmgTxt.text = 'УРОН: ' + dmg + ' ЕД.';
			if(priceTxt) priceTxt.text = (wp.cost * mult) + ' РУБ';
			if(tagTxt){
				tagTxt.text = 'X' + mult;
				tagTxt.style.fill = '#000000';
			}
			// 03.10.2026 (репорт игрока — "висит 1 автомат, по факту его у меня нет, либо я им не
			// могу воспользоваться"): `parseInt(wp.qty || 0) || (wp.owned ? 1 : 0)` — классическая
			// ловушка `||` с нулём. Когда патроны реально закончились (wp.qty === 0, настоящий,
			// явный ноль — не "ещё не задано"), `wp.qty || 0` даёт 0, `parseInt(0)` тоже 0, а 0 —
			// falsy, поэтому выражение проваливалось в правую часть `(wp.owned ? 1 : 0)`. owned
			// остаётся true навсегда с момента первого получения оружия (_loadFromUdata() его
			// никогда не сбрасывает обратно при qty=0, это по замыслу — "однажды открытое не
			// теряется") — в итоге оружейка ПОКАЗЫВАЛА "1", хотя патронов реально 0, и в бою
			// _attackWithWeapon()/_attack() (которые читают wp.qty напрямую, без этой же ошибки)
			// честно отказывали как "нет оружия". Фикс — различать "qty явно задан (в т.ч. 0)" и
			// "qty ещё не задан вовсе" (undefined/null, старые аккаунты без миграции) — только во
			// втором случае применяется легаси-фолбэк "owned без qty ⇒ считать за 1".
			const qty = (wp.qty !== undefined && wp.qty !== null) ? (parseInt(wp.qty) || 0) : (wp.owned ? 1 : 0);
			if(stockTxt) stockTxt.text = String(qty);
			if(statusTxt) statusTxt.text = '';
		});
	}

	_equip(idx){
		this.data.forEach(w=>w.equipped=false);
		this.data[idx].equipped = true;
		this._renderStatus();
		this._saveToUdata();
	}

	// 18.09.2026 — SERVER-AUTHORITATIVE ОРУЖИЕ: раньше _upgrade()/_buy() сами проверяли цену
	// и списывали рубли/тушёнку прямо в браузере — читер мог вызвать weapons._buy(5,100) или
	// weapons._upgrade(0) из консоли без единого рубля (или просто заранее подменить
	// udata['coins']) и получить оружие/прокачку бесплатно. Теперь обе операции — только
	// запрос к серверу (weapons.buy/weapons.upgrade), сервер сам проверяет цену по каталогу
	// server/json/weapons_config.json и сам решает, хватает ли рублей/тушёнки. Клиент лишь
	// применяет патч и перечитывает свою локальную копию this.data из обновлённого udata.
	_upgrade(idx){
		if(this._weaponReqInFlight){
			console.log('[weapons._upgrade] запрос уже выполняется, повторный клик проигнорирован');
			return;
		}
		this._weaponReqInFlight = true;
		console.log('[weapons._upgrade] → сервер | weapon_id:', idx);

		if(!window.TS){
			this._weaponReqInFlight = false;
			console.error('[weapons._upgrade] window.TS недоступен, запрос не отправлен');
			return;
		}

		// 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits): weapons.upgrade()
		// пишет coins/stew напрямую на сервере, окно запроса нужно перекрыть suspend/resume —
		// та же защита, что уже есть у bosses.attack/claimKill.
		if(window.suspendPlayerSave) suspendPlayerSave('weapons_upgrade');
		TS.php('weapons.upgrade', {weapon_id: idx}, (res) => {
			this._weaponReqInFlight = false;
			console.log('[weapons._upgrade] ← ответ сервера:', JSON.stringify(res));
			if(!res || !res.patch){
				console.error('[weapons._upgrade] некорректный ответ сервера (нет patch), апгрейд не применён:', JSON.stringify(res));
				if(window.resumePlayerSave) resumePlayerSave('weapons_upgrade');
				return;
			}
			applyPatch(res.patch);
			if(window.resumePlayerSave) resumePlayerSave('weapons_upgrade');
			this._loadFromUdata();
			iface.updateUp();
			this._renderStatus();
			notify.showResult({text: this.data[idx].name + ' улучшено до ур.' + res.newUpg + '/20!'}, 1);
		}, (err) => {
			this._weaponReqInFlight = false;
			console.error('[weapons._upgrade] ← ошибка сервера:', JSON.stringify(err));
			if(window.resumePlayerSave) resumePlayerSave('weapons_upgrade');
			// Коды: 74 — недостаточно рублей/тушёнки, 75 — уже максимальный уровень.
			if(err && err.code === 75){
				notify.showResult({text: 'Уже максимальный уровень прокачки!'}, 0);
			} else {
				const wp = this.data[idx];
				const rawCost = wp.upg_cost[wp.upg];
				const useStew = rawCost < 0;
				const cost = Math.abs(rawCost);
				notify.showResult({text: 'Нужно ' + cost + (useStew ? '🥫' : '💰') + ' для улучшения'}, 0);
			}
		});
	}

	_buy(idx){
		if(this._weaponReqInFlight){
			console.log('[weapons._buy] запрос уже выполняется, повторный клик проигнорирован');
			return;
		}
		const wp = this.data[idx];
		const mult = (this._buyMult && this._buyMult[idx]) || 1;
		this._weaponReqInFlight = true;
		console.log('[weapons._buy] → сервер | weapon_id:', idx, 'mult:', mult);

		if(!window.TS){
			this._weaponReqInFlight = false;
			console.error('[weapons._buy] window.TS недоступен, запрос не отправлен');
			return;
		}

		// 28.09.2026 (та же защита, что в _upgrade() выше — см. память агента
		// incident_checkall_flush_wipes_server_credits): weapons.buy() тоже пишет coins/stew
		// напрямую на сервере.
		if(window.suspendPlayerSave) suspendPlayerSave('weapons_buy');
		TS.php('weapons.buy', {weapon_id: idx, mult: mult}, (res) => {
			this._weaponReqInFlight = false;
			console.log('[weapons._buy] ← ответ сервера:', JSON.stringify(res));
			if(!res || !res.patch){
				console.error('[weapons._buy] некорректный ответ сервера (нет patch), покупка не применена:', JSON.stringify(res));
				if(window.resumePlayerSave) resumePlayerSave('weapons_buy');
				return;
			}
			applyPatch(res.patch);
			if(window.resumePlayerSave) resumePlayerSave('weapons_buy');
			this._loadFromUdata();
			iface.updateUp();
			this._renderStatus();

			if(window.achievements){
				const typeMap = {Мачете:'machete', Ствол:'gun', Автомат:'auto'};
				const t = typeMap[wp.type];
				if(t) achievements.onWeaponBuy(t, mult);
			}
		}, (err) => {
			this._weaponReqInFlight = false;
			console.error('[weapons._buy] ← ошибка сервера:', JSON.stringify(err));
			if(window.resumePlayerSave) resumePlayerSave('weapons_buy');
			// 18.09.2026 (баг найден: попап "ТОРМОЗИ! ОРУЖИЯ НЕТУ У ТЕБЯ, ЕГО НУЖНО КУПИТЬ" при
			// нехватке ДЕНЕГ на покупку) — этот текст/картинка ("не хватает оружия.png") были
			// сделаны для СОВСЕМ другого сценария (нет экипированного оружия в бою), а тут
			// показывались вместо нормальной ошибки нехватки средств. Код 74 — недостаточно
			// рублей — показываем нормальную ошибку (iface._openSidorovichError), как везде
			// в проекте при нехватке валюты.
			const totalCost = wp.cost * mult;
			const curCoins = parseInt(udata['coins'] || 0);
			if(window.iface) iface._openSidorovichError('Недостаточно рублей!', 'Нужно: ' + totalCost + ' • У вас: ' + curCoins);
		});
	}

	// Расход патронов/зарядов (вызывается из боссов для донат-оружия)
	consumeQty(id, amount){
		const wp = this.data.find(w => w.id === id);
		if(!wp) return;
		wp.qty = Math.max(0, (parseInt(wp.qty) || 0) - amount);
		this._saveToUdata();
		if(wp.qty === 0) notify.showResult({text: wp.name + ' закончились! Купите еще в магазине.'}, 0);
	}

	_saveToUdata(){
		const save = this.data.map(w=>({owned:w.owned,equipped:w.equipped,upg:w.upg,qty:w.qty||0}));
		udata['weapons'] = JSON.stringify(save);
		udata['ammo_machete'] = String(this.data[3].qty || 0);
		udata['ammo_gun']     = String(this.data[4].qty || 0);
		udata['ammo_auto']    = String(this.data[5].qty || 0);
	}

	grantAmmo(type, amount){
		const idx = {machete:3, gun:4, auto:5}[type];
		const qty = Math.max(0, parseInt(amount) || 0);
		if(idx === undefined || qty <= 0) return;
		const wp = this.data[idx];
		wp.qty = (parseInt(wp.qty) || 0) + qty;
		wp.owned = true;
		this._saveToUdata();
	}

	_loadFromUdata(){
		if(!udata || !udata['weapons']) return;
		try{
			const saved = helper.safeParseJSON(udata['weapons'], null);
			saved.forEach((s,i)=>{
				if(this.data[i]){
					this.data[i].owned    = s.owned;
					this.data[i].equipped = s.equipped;
					this.data[i].upg      = s.upg    || 0;
					this.data[i].qty      = s.qty !== undefined ? s.qty : (s.owned ? 1 : 0);
				}
			});
		} catch(e){}
		const legacyAmmo = [null, null, null,
			parseInt(udata && udata['ammo_machete'] || 0) || 0,
			parseInt(udata && udata['ammo_gun'] || 0) || 0,
			parseInt(udata && udata['ammo_auto'] || 0) || 0,
		];
		for(let i = 3; i <= 5; i++){
			if(legacyAmmo[i] > (parseInt(this.data[i].qty) || 0)) this.data[i].qty = legacyAmmo[i];
			if((parseInt(this.data[i].qty) || 0) > 0) this.data[i].owned = true;
		}
		this._saveToUdata();
		// Бесплатное оружие всегда доступно независимо от сохранённых данных
		this.data[0].owned = true;
		this.data[1].owned = true;
		this.data[2].owned = true;
	}
}
