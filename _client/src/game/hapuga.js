import { applyPatch } from '../modules/patch.js';

export default class Hapuga{
	constructor(mc){
		this.mc  = mc;
		this.win = mc.hapuga_win;

		// Полный пул товаров
		this._pool = [
			{icon:'🥫', name:'Тушенка ×20',    desc:'Сытость для долгих вылазок', rarity:'common',   orig:400,  disc:30, type:'stew',  amount:20},
			{icon:'💊', name:'Аптечки ×5',      desc:'Военные, высшего класса',    rarity:'common',   orig:300,  disc:25, type:'heal',  amount:150},
			{icon:'🔋', name:'Энергия ×50',     desc:'Мощный энергопак',           rarity:'rare',     orig:600,  disc:35, type:'energy',amount:50},
			{icon:'🚬', name:'Папиросы ×5',     desc:'Редкая валюта Зоны',         rarity:'rare',     orig:800,  disc:40, type:'cig',   amount:5},
			{icon:'💰', name:'Монеты ×2000',    desc:'Наличка из захоронок',       rarity:'common',   orig:2400, disc:20, type:'coins', amount:2000},
			{icon:'🎁', name:'Хабар «Редкий»',  desc:'Армейский ящик. Сразу откроется', rarity:'rare', orig:500, disc:35, type:'habar', amount:1},
			{icon:'🔮', name:'Артефакт «Душа»', desc:'Повышает макс. энергию навсегда', rarity:'epic', orig:1500, disc:50, type:'max_energy', amount:20},
			{icon:'🛡', name:'Ремкомплект',     desc:'Чинит броню бесплатно',      rarity:'rare',     orig:700,  disc:30, type:'repair',amount:1},
			{icon:'🔫', name:'Патроны ×100',    desc:'Подходят к любому оружию',   rarity:'common',   orig:350,  disc:25, type:'coins', amount:500},
			{icon:'🧪', name:'Антирад ×3',      desc:'Защита от радиации',         rarity:'rare',     orig:900,  disc:40, type:'stew',  amount:10},
			{icon:'👾', name:'Карта аномалий',  desc:'Раскрывает все точки в Зоне',rarity:'epic',     orig:2000, disc:55, type:'coins', amount:5000},
			{icon:'📦', name:'Хабар «Эпик»',    desc:'Секретный тайник. Открыть?', rarity:'epic',     orig:1200, disc:45, type:'habar', amount:2},
		];

		// Текущие 8 товаров
		this.items      = [];
		this.soldOut    = {};  // {itemIdx: true}
		this.refreshes  = 0;
		this._timerInterval = null;
		this._isAvailable   = true;
		this._nextAppearTs  = 0;

		this.win.butt_close.on('pointerdown',   ()=>this.close());
		this.win.butt_refresh.on('pointerdown', ()=>this._refreshShop());
		this._bindItems();
	}

	_bindItems(){
		const grid = this.win.item_grid;
		for(let i = 0; i < 8; i++){
			const idx = i;
			grid['item_'+i].butt_buy.on('pointerdown', ()=>this._buy(idx));
		}
	}

	_generateShop(){
		// Перемешать пул и взять 8
		const shuffled = this._pool.slice().sort(()=>Math.random()-0.5);
		this.items    = shuffled.slice(0, 8);
		this.soldOut  = {};
		this._saveToUdata();
	}

	_render(){
		const grid = this.win.item_grid;
		for(let i = 0; i < 8; i++){
			const it  = this.items[i];
			const el  = grid['item_'+i];
			if(!it){ el.visible = false; continue; }
			el.visible = true;

			el.icon_txt.text   = it.icon;
			el.name_txt.text   = it.name;
			el.desc_txt.text   = it.desc;

			const rLabels = {common:'ОБЫЧНЫЙ', rare:'РЕДКИЙ', epic:'ЭПИЧЕСКИЙ'};
			el.rarity_txt.text = rLabels[it.rarity] || it.rarity.toUpperCase();

			const salePrice = Math.floor(it.orig * (1 - it.disc / 100));
			el.orig_price_txt.text  = '💰 ' + it.orig + ' (цена)';
			el.sale_price_txt.text  = '💰 ' + salePrice;
			el.discount_txt.text    = '-' + it.disc + '%';

			el.sold_out.visible = !!this.soldOut[i];
			el.butt_buy.visible = !this.soldOut[i];
		}

		this.win.refresh_cnt_txt.text = 'Обновлений: ' + this.refreshes;
		this.win.gone_overlay.visible = !this._isAvailable;
	}

	_buy(idx){
		// 26.09.2026 (по прямому указанию) — сервер отклоняет любой вызов hapuga.buy (BETA_LOCKED,
		// см. private $BETA_LOCKED в server/core/controllers/hapuga.php), но клиент до этого вызова
		// успевал локально менять валюту (списание salePrice, начисление награды по it.type) без
		// отката при отказе сервера — кнопку входа в раздел убрали из HUD (interface-panels.js),
		// но саму эту логику всё ещё можно было дёрнуть напрямую из консоли браузера
		// (window.hapuga._buy(idx)) и либо испортить себе баланс, либо попытаться начислить
		// валюту локально. Теперь блокируется прямо на клиенте, не только на сервере.
		notify.showResult({text:'Раздел "Хапуга" пока недоступен'}, 0);
		return;

		if(!this._isAvailable) return;
		if(this.soldOut[idx]){
			notify.showResult({text:'Товар уже раскуплен!'}, 0);
			return;
		}

		const it        = this.items[idx];
		const salePrice = Math.floor(it.orig * (1 - it.disc / 100));
		const coins     = parseInt(udata['coins']||0);

		if(coins < salePrice){
			notify.showResult({text:'Недостаточно монет! Нужно ' + salePrice}, 0);
			return;
		}

		udata['coins'] = coins - salePrice;
		// 27.09.2026: coins_spent больше не считается здесь локально — hapuga.php.buy() теперь
		// ведёт эту статистику сам и присылает актуальное значение в patch (тот же приём, что
		// уже применён в base.js/vassilich.js — см. коммент в server/core/controllers/base.php).

		// Начисляем
		switch(it.type){
			case 'coins':  udata['coins']      = parseInt(udata['coins']||0)      + it.amount; break;
			case 'stew':   udata['stew']        = parseInt(udata['stew']||0)        + it.amount; break;
			case 'cig':    udata['cigarettes']  = parseInt(udata['cigarettes']||0)  + it.amount; break;
			case 'energy': udata['energy']      = parseInt(udata['energy']||0)      + it.amount; break;
			case 'heal':   udata['health']      = Math.min(100, parseInt(udata['health']||100)  + it.amount); break;
			case 'habar':
				if(window.habar){
					window.habar.containers[it.amount === 2 ? 2 : 1].count++;
				}
				break;
			case 'max_energy':
				udata['max_energy'] = parseInt(udata['max_energy']||50) + it.amount;
				if(window.TIMERS) TIMERS.ENERGY_MAX = parseInt(udata['max_energy']);
				break;
		}

		iface.updateUp();
		if(window.battlepass) battlepass.addXp(8);
		if(window.achievements) achievements._checkAll(); // Потратить рубли
		this.soldOut[idx] = true;
		this._saveToUdata();
		this._render();
		notify.showResult({text:'Куплено: ' + it.name + ' за 💰' + salePrice}, 1);
		TS.php('hapuga.buy', {item_idx:idx}, (e)=>{ if(e && e.patch) applyPatch(e.patch); }, null);
	}

	_refreshShop(){
		// 26.09.2026 (по прямому указанию) — тот же риск, что и в _buy() выше: раздел "Хапуга"
		// отключён целиком (BETA_LOCKED на сервере), а это обновление ассортимента вообще не
		// проверялось сервером (списывало udata['cigarettes'] чисто локально) — блокируем и
		// здесь, чтобы прямой вызов window.hapuga._refreshShop() из консоли не мог списать
		// сигареты без всякой серверной проверки.
		notify.showResult({text:'Раздел "Хапуга" пока недоступен'}, 0);
		return;

		const cost = 25;
		const cigs = parseInt(udata['cigarettes']||0);
		if(cigs < cost){
			notify.showResult({text:'Нужно 🚬' + cost + ' папирос для обновления!'}, 0);
			return;
		}
		udata['cigarettes'] = cigs - cost;
		this.refreshes++;
		this._generateShop();
		iface.updateUp();
		this._render();
		notify.showResult({text:'Ассортимент обновлен!'}, 1);
	}

	_startTimer(){
		if(this._timerInterval) clearInterval(this._timerInterval);
		const tick = () => {
			if(!this.win.hap_timer || !this.win.hap_timer.time_txt) return;
			if(this._isAvailable){
				this.win.hap_timer.time_txt.text = 'Сейчас у тебя!';
				return;
			}
			const diff = Math.max(0, this._nextAppearTs - Date.now());
			if(diff <= 0){
				this._isAvailable = true;
				this._generateShop();
				this._render();
				this.win.hap_timer.time_txt.text = 'Сейчас у тебя!';
				return;
			}
			const h  = Math.floor(diff / 3600000);
			const m  = Math.floor((diff % 3600000) / 60000);
			const s  = Math.floor((diff % 60000) / 1000);
			const p  = n => String(n).padStart(2,'0');
			this.win.hap_timer.time_txt.text = p(h)+':'+p(m)+':'+p(s);
		};
		tick();
		this._timerInterval = setInterval(tick, 1000);
	}

	_stopTimer(){
		if(this._timerInterval){ clearInterval(this._timerInterval); this._timerInterval = null; }
	}

	_saveToUdata(){
		udata['hapuga_items']    = JSON.stringify(this.items.map(it=>it ? it.name : null));
		udata['hapuga_sold']     = JSON.stringify(this.soldOut);
		udata['hapuga_refreshes']= String(this.refreshes);
		udata['hapuga_avail']    = this._isAvailable ? '1' : '0';
		udata['hapuga_next_ts']  = String(this._nextAppearTs);
	}

	_loadFromUdata(){
		if(!udata) return;
		try{
			const savedNames = helper.safeParseJSON(udata['hapuga_items'], []);
			if(savedNames.length === 8){
				this.items = savedNames.map(name => this._pool.find(p=>p.name===name) || null);
			}
			this.soldOut         = helper.safeParseJSON(udata['hapuga_sold'], {});
			this.refreshes       = parseInt(udata['hapuga_refreshes']  || '0') || 0;
			this._isAvailable    = (udata['hapuga_avail']              || '1') === '1';
			this._nextAppearTs   = parseInt(udata['hapuga_next_ts']    || '0') || 0;
		} catch(ex){}

		// Если нет сохраненных товаров — генерируем
		if(this.items.length === 0 || this.items.every(i=>i===null)){
			this._generateShop();
		}
	}

	// Запустить «уход» торговца на N часов
	scheduleGone(hours){
		this._isAvailable   = false;
		this._nextAppearTs  = Date.now() + hours * 3600000;
		this._saveToUdata();
		this._render();
	}

	open(){
		this.win.setTransform(40, 19);
		this._loadFromUdata();
		this._render();
		this._startTimer();
		home.openScreen(this.win);
	}

	close(){
		this._stopTimer();
		home.closeScreen();
	}
}
