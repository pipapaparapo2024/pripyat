import { applyPatch } from '../modules/patch.js';

export default class Vassilich{
	constructor(mc){
		this.mc  = mc;
		this.win = mc.vassilich_win;
		this.currentTab = 0;
		this._lastFinds = [];

		// Товары магазина
		this.shopItems = [
			{id:0, icon:'💊', name:'Аптечка',          desc:'Восстанавливает 30 ед. энергии',      price:{type:'coins',amount:200},  stock:99, effect:{energy:30}},
			{id:1, icon:'🥫', name:'Тушенка ×5',       desc:'Дает +5 тушенки',                      price:{type:'coins',amount:80},   stock:99, effect:{stew:5}},
			{id:2, icon:'🛡', name:'Броник «Долг»',    desc:'+10% к защите от урона',              price:{type:'coins',amount:1200}, stock:10, effect:{armor:10}},
			// Бател Пасс временно отключён (кнопка "пропуск" неактивна, battlepass.addXp()
			// возвращает сразу) — эти 3 товара напрямую двигали bpLevel в обход addXp(), то
			// есть оставались рабочей лазейкой: игрок мог тратить сигареты на уровни экрана,
			// который физически не может открыть. Закомментировано вместе с _applyEffect
			// ниже — вернуть вместе, когда Бател Пасс снова включат.
			// {id:3, icon:'🏆', name:'БП +5 уровней',   desc:'Купить 5 уровней Бател Пасса',         price:{type:'cigarettes',amount:55},  stock:99, effect:{bp_levels:5}},
			// {id:4, icon:'🏆', name:'БП +11 уровней',  desc:'Купить 11 уровней Бател Пасса',        price:{type:'cigarettes',amount:120}, stock:99, effect:{bp_levels:11}},
			// {id:5, icon:'🏆', name:'БП +24 уровня',   desc:'Купить 24 уровня Бател Пасса',         price:{type:'cigarettes',amount:248}, stock:99, effect:{bp_levels:24}},
		];

		// Таблица потеряшек: [emoji, name, редкость (0=обычн,1=редк,2=эпик), эффект]
		this.lootTable = [
			{icon:'🥫', name:'Тушенка',        rarity:0, effect:{stew:10}},
			{icon:'🥫', name:'Тушенка ×3',     rarity:0, effect:{stew:30}},
			{icon:'💊', name:'Аптечка',         rarity:0, effect:{energy:30}},
			{icon:'💰', name:'100 монет',        rarity:0, effect:{coins:100}},
			{icon:'💰', name:'500 монет',        rarity:1, effect:{coins:500}},
			{icon:'💰', name:'2000 монет',       rarity:2, effect:{coins:2000}},
			{icon:'🔑', name:'Ключ от схрона',  rarity:1, effect:{key:1}},
			{icon:'💎', name:'Артефакт «Медуза»',rarity:2,effect:{max_energy:20}},
			{icon:'🎯', name:'Патроны улучш.',  rarity:1, effect:{damage_boost:15}},
			{icon:'🚬', name:'Папиросы ×3',     rarity:0, effect:{cigarettes:3}},
		];

		this._bindTabs();
		this.win.butt_close.on('pointerdown', ()=>this.close());

		// Кнопки убраны визуально — взаимодействие через хит-зоны
		this.win.loot_section.butt_open.visible = false;
		if(this.win.butt_hide) this.win.butt_hide.visible = false;

		this._initChestHover();
	}

	_initChestHover(){
		const ls = this.win.loot_section;

		// Оверлей «ящик актив.png» при наведении
		this._chestActiv = null;
		if(typeof BASE !== 'undefined'){
			this._chestActiv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'yashik_activ.png'));
			this._chestActiv.visible = false;
			this._chestActiv.interactive = false;
			ls.addChild(this._chestActiv);
		}

		// Невидимая хит-зона над сундуком (координаты подобрать по FLA)
		const hit = new PIXI.Graphics();
		hit.beginFill(0xffffff, 0.001);
		hit.drawRect(260, 60, 320, 260);
		hit.endFill();
		hit.interactive = true;
		hit.buttonMode  = true;
		hit.on('pointerover',  ()=>{ if(this._chestActiv) this._chestActiv.visible = true; });
		hit.on('pointerout',   ()=>{ if(this._chestActiv) this._chestActiv.visible = false; });
		hit.on('pointerdown',  ()=>this._openLoot());
		ls.addChild(hit);
	}

	_bindTabs(){
		const tabs = this.win.tabs;
		for(let i = 0; i < 3; i++){
			const idx = i;
			tabs['tab_'+i].on('pointerdown', ()=>this._selectTab(idx));
		}
	}

	_selectTab(idx){
		this.currentTab = idx;
		const tabs = this.win.tabs;
		for(let i = 0; i < 3; i++) tabs['tab_'+i].setActive(i === idx);
		this.win.shop_section.visible = (idx === 0);
		this.win.loot_section.visible = (idx === 1);
		this.win.bp_section.visible   = (idx === 2);
		if(idx === 0) this._renderShop();
		if(idx === 2) this._renderBackpack();
	}

	_renderShop(){
		const section = this.win.shop_section;
		for(let i = 0; i < this.shopItems.length; i++){
			const item = this.shopItems[i];
			const card = section['item_'+i];

			card.icon_txt.text  = item.icon;
			card.name_txt.text  = item.name;
			card.desc_txt.text  = item.desc;
			card.stock_txt.text = 'В наличии: ' + item.stock;

			const priceLabel = {
				coins:      '💰 ' + item.price.amount + ' монет',
				stew:       '🥫 ' + item.price.amount + ' тушенки',
				cigarettes: '🚬 ' + item.price.amount + ' папирос',
			}[item.price.type] || String(item.price.amount);
			card.price_txt.text = priceLabel;

			card.butt_buy.visible = false;
			card.interactive = true;
			card.buttonMode  = true;
			card.removeAllListeners('pointerdown');
			const idx = i;
			card.on('pointerdown', ()=>this._buy(idx));
		}
	}

	// 27.09.2026 (по репорту "покупка всё ещё странно себя ведёт" — тот же класс гонки, что уже
	// чинили для bank.js/shmot.js/weapons.js/zone.js: два независимых источника правды для
	// одной покупки). Раньше _buy() СРАЗУ списывал валюту и применял item.effect ЛОКАЛЬНО
	// (плюс _saveToUdata() ниже по стеку через генерик-автосейв), а vassilich.buy на сервере
	// НЕЗАВИСИМО делал то же самое второй раз по своей копии из БД (vassilich.php.buy() —
	// $this->ops->deduct()+$this->_applyEffect()) — итоговый баланс мог задвоиться, если
	// автосейв успевал улететь между локальным списанием и ответом сервера. Теперь честный
	// запрос→ответ (как shmot.js._buy()/weapons.js._buy()): ничего не меняем локально, пока
	// сервер не подтвердит, применяем ТОЛЬКО patch.
	_buy(idx){
		if(this._vassilichBuyInFlight){
			console.log('[vassilich._buy] запрос уже выполняется, повторный клик проигнорирован');
			return;
		}
		const item = this.shopItems[idx];
		if(!udata || !window.TS) return;

		const currency = item.price.type;
		const cost     = item.price.amount;
		const have     = parseInt(udata[currency] || 0);

		// Клиентская проверка — только для мгновенного дружелюбного сообщения без похода на
		// сервер (тот же приём, что и в zone.js._upgradeBusiness()); финальное решение и
		// списание валюты — только на сервере.
		if(have < cost){
			const label = {coins:'монет', stew:'тушенки', cigarettes:'папирос'}[currency];
			notify.showResult({text:'Недостаточно ' + label + '! Нужно ' + cost}, 0);
			return;
		}

		this._vassilichBuyInFlight = true;
		console.log('[vassilich._buy] → сервер | item_id:', item.id, '| price:', JSON.stringify(item.price));
		// 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits): vassilich.buy()
		// пишет валюту напрямую через Gameops::saveUser(), в обход общего автосейва — пока запрос
		// летит, независимый flushPlayerSave мог отправить старый снимок udata и затереть свежую
		// запись сервера. suspend/resume перекрывают окно запроса (тот же приём, что у боссов).
		if(window.suspendPlayerSave) suspendPlayerSave('vassilich_buy');
		TS.php('vassilich.buy', {item_id:item.id}, (e)=>{
			this._vassilichBuyInFlight = false;
			console.log('[vassilich._buy] ← ответ сервера:', JSON.stringify(e));
			if(!e || !e.patch){
				console.error('[vassilich._buy] некорректный ответ сервера (нет patch), покупка не применена:', JSON.stringify(e));
				if(window.resumePlayerSave) resumePlayerSave('vassilich_buy');
				return;
			}
			applyPatch(e.patch);
			if(window.resumePlayerSave) resumePlayerSave('vassilich_buy');
			if(window.battlepass) battlepass.addXp(5);
			if(window.achievements) achievements._checkAll(); // Потратить рубли/тушенку
			notify.showResult({text:'Куплено: ' + item.name}, 1);
			this._renderShop();
		}, (err)=>{
			this._vassilichBuyInFlight = false;
			console.error('[vassilich._buy] ← ошибка сервера | item_id:', item.id, '| код:', err && err.code, '| полностью:', JSON.stringify(err));
			if(window.resumePlayerSave) resumePlayerSave('vassilich_buy');
			const label = {coins:'монет', stew:'тушенки', cigarettes:'папирос'}[currency];
			notify.showResult({text:'Недостаточно ' + label + '! Нужно ' + cost}, 0);
		});
	}

	_applyEffect(effect){
		if(effect.energy)      TIMERS.current_energy = Math.min(TIMERS.ENERGY_MAX, TIMERS.getEnergy() + effect.energy);
		if(effect.max_energy)  TIMERS.ENERGY_MAX += effect.max_energy;
		if(effect.stew)        udata['stew']       = parseInt(udata['stew']       || 0) + effect.stew;
		if(effect.coins)       udata['coins']       = parseInt(udata['coins']      || 0) + effect.coins;
		if(effect.cigarettes)  udata['cigarettes']  = parseInt(udata['cigarettes'] || 0) + effect.cigarettes;
		if(effect.random_loot) this._giveRandomLoot(effect.random_loot);
		// Бател Пасс временно отключён — см. комментарий у shopItems выше. Товары,
		// использующие bp_levels, сейчас закомментированы, так что эта ветка не должна
		// вызываться вовсе; оставлена закомментированной на случай, если effect.bp_levels
		// придёт откуда-то ещё, чтобы не молча проигнорировать эффект без объяснения.
		// if(effect.bp_levels && window.battlepass){
		//     const maxBp = battlepass.MAX_LEVEL;
		//     for(let i = 0; i < effect.bp_levels && battlepass.bpLevel < maxBp; i++){
		//         battlepass.bpLevel++;
		//     }
		//     battlepass._updateHeader();
		//     battlepass._saveToUdata();
		//     notify.showResult({text:'🏆 Куплено уровней БП: +' + effect.bp_levels + ' (теперь ур.' + battlepass.bpLevel + ')'}, 1);
		// }
		if(window.iface) iface.updateUp();
		if(window.iface) iface.updateEnergy();
	}

	// 27.09.2026 (по репорту "покупка всё ещё странно себя ведёт"): раньше клиент РАНЬШЕ сервера
	// сам списывал 5 сигарет и сам катал RNG по своему this.lootTable (_rollLoot()) — тут же
	// показывал этот результат игроку и применял item.effect ЛОКАЛЬНО. Сервер (vassilich.php.
	// open_loot()) НЕЗАВИСИМО катает СВОЙ RNG по server/json/vassilich_loot.json и списывает
	// сигареты ЕЩЁ РАЗ по своей копии из БД — это ДВА независимых броска одной и той же
	// "покупки": игрок видел один приз во всплывающем уведомлении и в "последних находках", а
	// реальный прирост валюты (patch, который приходит чуть позже) соответствовал СОВСЕМ
	// другому, отдельно выпавшему предмету. Плюс тот же класс двойного списания, что уже чинили
	// для bank.js/shmot.js/weapons.js — тот же паттерн, что и в _buy() выше: ничего не решаем и
	// не показываем локально, ждём честный ответ сервера и показываем РЕАЛЬНО выпавший приз.
	_openLoot(){
		if(this._vassilichLootInFlight){
			console.log('[vassilich._openLoot] запрос уже выполняется, повторный клик проигнорирован');
			return;
		}
		const cost = 5;
		if(!window.TS) return;
		if(parseInt(udata['cigarettes'] || 0) < cost){
			notify.showResult({text:'Нужно ' + cost + ' папирос для открытия ящика!'}, 0);
			return;
		}

		this._vassilichLootInFlight = true;
		console.log('[vassilich._openLoot] → сервер: vassilich.open_loot');
		// 28.09.2026 (тот же класс гонки, что в _buy() выше — см. коммент там и память агента
		// incident_checkall_flush_wipes_server_credits): open_loot() тоже списывает сигареты
		// напрямую на сервере.
		if(window.suspendPlayerSave) suspendPlayerSave('vassilich_open_loot');
		TS.php('vassilich.open_loot', {}, (e)=>{
			this._vassilichLootInFlight = false;
			console.log('[vassilich._openLoot] ← ответ сервера:', JSON.stringify(e));
			if(!e || !e.patch || !e.loot){
				console.error('[vassilich._openLoot] некорректный ответ сервера (нет patch/loot), открытие не применено:', JSON.stringify(e));
				if(window.resumePlayerSave) resumePlayerSave('vassilich_open_loot');
				return;
			}
			applyPatch(e.patch);
			if(window.resumePlayerSave) resumePlayerSave('vassilich_open_loot');
			if(window.achievements) achievements._checkAll();

			// icon — сервер отдаёт только name/rarity (см. vassilich_loot.json), иконку
			// подбираем по совпадающему имени из клиентской lootTable (только для отображения,
			// на эффект/баланс не влияет — та уже применена сервером через patch).
			const known = this.lootTable.find(it => it.name === e.loot.name);
			const icon  = known ? known.icon : '🎁';
			const rarityLabel = ['Обычно','Редко','Эпик'][e.loot.rarity] || 'Обычно';
			notify.showResult({text:icon + ' ' + e.loot.name + '  [' + rarityLabel + ']'}, e.loot.rarity > 0 ? 1 : 0);

			this._lastFinds.unshift(icon + ' ' + e.loot.name + ' [' + rarityLabel + ']');
			if(this._lastFinds.length > 5) this._lastFinds.pop();
			this.win.loot_section.last_txt.text = this._lastFinds.join('   ·   ');
		}, (err)=>{
			this._vassilichLootInFlight = false;
			console.error('[vassilich._openLoot] ← ошибка сервера | код:', err && err.code, '| полностью:', JSON.stringify(err));
			if(window.resumePlayerSave) resumePlayerSave('vassilich_open_loot');
			notify.showResult({text:'Нужно ' + cost + ' папирос для открытия ящика!'}, 0);
		});
	}

	_rollLoot(){
		// Веса: обычный×60, редкий×30, эпик×10
		const pool = [];
		for(const item of this.lootTable){
			const weight = [60, 30, 10][item.rarity];
			for(let i = 0; i < weight; i++) pool.push(item);
		}
		return pool[Math.floor(Math.random() * pool.length)];
	}

	_giveRandomLoot(count){
		for(let i = 0; i < count; i++) this._applyEffect(this._rollLoot().effect);
	}

	_renderBackpack(){
		const bp = this.win.bp_section;
		// Инвентарь из udata (JSON строка)
		let inv = [];
		inv = helper.safeParseJSON(udata['inventory'], []);

		for(let i = 0; i < 18; i++){
			const slot = bp['slot_'+i];
			const item = inv[i];
			if(item){
				slot.icon_txt.text  = item.icon || '📦';
				slot.name_txt.text  = item.name;
				slot.count_txt.text = item.count > 1 ? '×' + item.count : '';
				slot.butt_use.visible = !!item.effect;
				slot.butt_use.removeAllListeners('pointerdown');
				if(item.effect){
					const ef = item.effect;
					slot.butt_use.on('pointerdown', ()=>{
						this._applyEffect(ef);
						inv.splice(i, 1);
						udata['inventory'] = JSON.stringify(inv);
						this._renderBackpack();
					});
				}
			} else {
				slot.setEmpty();
			}
		}
	}

	open(){
		this.win.setTransform(40, 19);
		this._selectTab(0);
		home.openScreen(this.win);
	}

	close(){
		home.closeScreen();
	}
}
