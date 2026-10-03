import { applyPatch } from '../modules/patch.js';

export default class Base{
	constructor(mc){
		this.mc  = mc;
		this.win = mc.base_win;

		this.currentTab = 0;

		// Здания базы
		this.buildings = [
			{id:0, icon:'🛖', name:'Казарма',     bonus_key:'max_energy', bonus_per_lv:10,  upgrade_cost:{coins:500},  upgrade_xp:100, level:1, max_level:10, xp:0, xp_next:100},
			{id:1, icon:'📦', name:'Склад',        bonus_key:'max_stew',   bonus_per_lv:100, upgrade_cost:{stew:20},    upgrade_xp:80,  level:1, max_level:10, xp:0, xp_next:100},
			{id:2, icon:'🔧', name:'Мастерская',  bonus_key:'repair_cost', bonus_per_lv:-10, upgrade_cost:{coins:800},  upgrade_xp:120, level:1, max_level:10, xp:0, xp_next:100},
			{id:3, icon:'🏥', name:'Медпункт',    bonus_key:'energy_regen',bonus_per_lv:5,   upgrade_cost:{coins:1200}, upgrade_xp:150, level:1, max_level:10, xp:0, xp_next:100},
		];

		// Физические характеристики (качалка)
		this.stats = [
			{id:0, icon:'💪', name:'Сила',        key:'stat_str', bonus:'+1% урон за уровень', xp:0, xp_next:200, level:1, max_level:50, energy_cost:3},
			{id:1, icon:'🫀', name:'Выносливость', key:'stat_end', bonus:'+2 макс. энергии за уровень', xp:0, xp_next:200, level:1, max_level:50, energy_cost:3},
			{id:2, icon:'🏃', name:'Ловкость',    key:'stat_agi', bonus:'+1% уклонение за уровень', xp:0, xp_next:200, level:1, max_level:50, energy_cost:3},
		];

		// Локации (синхронизировано с zone.js)
		this.locations = [
			{id:0, icon:'🌳', name:'Кордон',         desc:'Начальная зона. Спокойно, но бедно.'},
			{id:1, icon:'🏭', name:'Темная Долина',  desc:'Заброшенный завод. Риск и добыча.'},
			{id:2, icon:'☢',  name:'Янтарь',          desc:'Научный лагерь. Аномалии везде.'},
			{id:3, icon:'💎', name:'Припять',         desc:'Бывший город. Мародеры и Монолит.'},
			{id:4, icon:'🔭', name:'ЧАЭС',            desc:'Конечная точка. Самый опасный район.'},
		];

		this.myLocationId = 0;

		if(this.win.butt_close){
			this.win.butt_close.interactive = true;
			this.win.butt_close.buttonMode  = true;
			this.win.butt_close.on('pointerdown', ()=>this.close());
		}
		try{ this._bindTabs();      }catch(e){ console.error('[base] _bindTabs ошибка:', e); }
		try{ this._bindBuildings(); }catch(e){ console.error('[base] _bindBuildings ошибка:', e); }
		try{ this._bindGym();       }catch(e){ console.error('[base] _bindGym ошибка:', e); }
		try{ this._bindLocations(); }catch(e){ console.error('[base] _bindLocations ошибка:', e); }
		try{ this._initLocTextPos();}catch(e){ console.error('[base] _initLocTextPos ошибка:', e); }
	}

	_bindTabs(){
		const tabs = this.win.tabs;
		for(let i = 0; i < 3; i++){
			const idx = i;
			const tab = tabs['tab_'+i];
			if(!tab){ console.warn('[base._bindTabs] tab_'+i+' не найден в FLA'); continue; }
			tab.interactive = true;
			tab.buttonMode  = true;
			tab.on('pointerdown', ()=>this._selectTab(idx));
			console.log('[base._bindTabs] tab_'+i+' interactive установлен:', tab.interactive);
		}
	}

	_selectTab(idx){
		console.log('[base._selectTab] переключение на вкладку', idx);
		this.currentTab = idx;
		const tabs = this.win.tabs;
		for(let i = 0; i < 3; i++){
			const tab = tabs['tab_'+i];
			if(tab && typeof tab.setActive === 'function') tab.setActive(i === idx);
		}
		this.win.base_section.visible = (idx === 0);
		this.win.gym_section.visible  = (idx === 1);
		this.win.loc_section.visible  = (idx === 2);
		console.log('[base._selectTab] секции: base=', this.win.base_section.visible, 'gym=', this.win.gym_section.visible, 'loc=', this.win.loc_section.visible);
		if(idx === 0) this._renderBuildings();
		if(idx === 1) this._renderGym();
		if(idx === 2) this._renderLocations();
	}

	_bindBuildings(){
		const grid = this.win.base_section.building_grid;
		for(let i = 0; i < 4; i++){
			const idx = i;
			const btn = grid['card_'+i].butt_upgrade;
			if(!btn){ console.warn('[base._bindBuildings] butt_upgrade card_'+i+' не найден'); continue; }
			btn.interactive = true;
			btn.buttonMode  = true;
			btn.on('pointerdown', ()=>this._upgradeBuilding(idx));
			console.log('[base._bindBuildings] butt_upgrade card_'+i+' interactive:', btn.interactive);
		}
	}

	_bindGym(){
		const cards = this.win.gym_section.gym_cards;
		for(let i = 0; i < 3; i++){
			const idx = i;
			const btn = cards['card_'+i].butt_train;
			if(!btn){ console.warn('[base._bindGym] butt_train card_'+i+' не найден'); continue; }
			btn.interactive = true;
			btn.buttonMode  = true;
			btn.on('pointerdown', ()=>this._trainStat(idx));
			console.log('[base._bindGym] butt_train card_'+i+' interactive:', btn.interactive);
		}
	}

	_initLocTextPos(){
		try{
			const cards = this.win.loc_section.loc_cards;
			for(let i = 0; i < 5; i++){
				const c = cards['card_'+i];
				if(c && c.name_txt) c.name_txt.y += 32;
				if(c && c.desc_txt) c.desc_txt.y += 32;
			}
		} catch(e){}
	}

	_bindLocations(){
		const cards = this.win.loc_section.loc_cards;
		for(let i = 0; i < 5; i++){
			const idx = i;
			const btn = cards['card_'+i].butt_move;
			if(!btn){ console.warn('[base._bindLocations] butt_move card_'+i+' не найден'); continue; }
			btn.interactive = true;
			btn.buttonMode  = true;
			btn.on('pointerdown', ()=>this._moveToLocation(idx));
			console.log('[base._bindLocations] butt_move card_'+i+' interactive:', btn.interactive);
		}
	}

	_renderBuildings(){
		console.log('[base._renderBuildings] рендер зданий, base_section visible:', this.win.base_section && this.win.base_section.visible);
		const grid = this.win.base_section.building_grid;
		console.log('[base._renderBuildings] building_grid:', grid, 'children:', grid && grid.children && grid.children.length);
		for(let i = 0; i < 4; i++){
			const b   = this.buildings[i];
			const c   = grid['card_'+i];
			console.log('[base._renderBuildings] card_'+i+':', c, 'level:', b.level);
			c.icon_txt.text  = b.icon;
			c.name_txt.text  = b.name;
			c.level_txt.text = 'Уровень ' + b.level + ' / ' + b.max_level;

			const bVal = b.bonus_per_lv * b.level;
			const bLbl = b.bonus_per_lv > 0 ? '+' + bVal : bVal;
			const bDesc = {
				max_energy: bLbl + ' к макс. энергии',
				max_stew:   bLbl + ' к макс. тушенке',
				repair_cost:bVal + '% к стоимости ремонта',
				energy_regen:bLbl + '% к скорости восст. энергии',
			}[b.bonus_key] || '';
			c.bonus_txt.text = bDesc;

			if(typeof c.setXp === 'function') c.setXp(b.xp, b.xp_next);

			if(b.level >= b.max_level){
				if(c.butt_upgrade._txt) c.butt_upgrade._txt.text = 'МАКС';
				c.butt_upgrade.interactive = false;
				c.butt_upgrade.alpha = 0.5;
			} else {
				const cost = b.upgrade_cost;
				const parts = [];
				if(cost.coins) parts.push('💰' + cost.coins);
				if(cost.stew)  parts.push('🥫' + cost.stew);
				if(c.butt_upgrade._txt) c.butt_upgrade._txt.text = 'УЛУЧШИТЬ\n' + parts.join(' ');
				c.butt_upgrade.interactive = true;
				c.butt_upgrade.alpha = 1;
			}
		}
	}

	// 27.09.2026 (по репорту "покупка всё ещё странно себя ведёт" — тот же класс гонки, что уже
	// чинили в vassilich.js/shmot.js/weapons.js: два независимых источника правды для одной
	// покупки). Раньше _upgradeBuilding() СРАЗУ списывал coins/stew и применял XP/level-up
	// ЛОКАЛЬНО, плюс this._saveToUdata() сохранял этот предсказанный base_buildings в udata ДО
	// ответа сервера — если периодический автосейв успевал улететь между этим и ответом,
	// base.php.upgrade() на сервере грузил уже "предсказанный" base_buildings из БД и добавлял
	// свой XP/уровень и списание СВЕРХУ ещё раз. Теперь честный запрос→ответ: ничего не меняем
	// локально, применяем ТОЛЬКО patch (включает base_buildings/coins/stew) + перечитываем его
	// через _loadFromUdata().
	_upgradeBuilding(idx){
		if(this._baseUpgradeInFlight){
			console.log('[base._upgradeBuilding] запрос уже выполняется, повторный клик проигнорирован');
			return;
		}
		const b = this.buildings[idx];
		if(b.level >= b.max_level){
			notify.showResult({text:'Здание уже максимального уровня!'}, 0);
			return;
		}

		// Клиентская проверка — только для мгновенного дружелюбного сообщения без похода на
		// сервер; финальное решение и списание валюты — только на сервере (base.php.upgrade()).
		if(b.upgrade_cost.coins && parseInt(udata['coins']||0) < b.upgrade_cost.coins){
			notify.showResult({text:'Недостаточно монет! Нужно ' + b.upgrade_cost.coins}, 0);
			return;
		}
		if(b.upgrade_cost.stew && parseInt(udata['stew']||0) < b.upgrade_cost.stew){
			notify.showResult({text:'Недостаточно тушенки! Нужно ' + b.upgrade_cost.stew}, 0);
			return;
		}

		this._baseUpgradeInFlight = true;
		console.log('[base._upgradeBuilding] → сервер | building_id:', idx, '| cost:', JSON.stringify(b.upgrade_cost));
		// 28.09.2026 (аудит "checkAll → flush затирает серверные начисления", см. память агента
		// incident_checkall_flush_wipes_server_credits): base.upgrade() пишет coins/stew в БД
		// НАПРЯМУЮ через Gameops::saveUser(), в обход общего 500мс-автосейва. Пока запрос летит
		// туда-обратно, независимый автосейв (debounce/periodic/hidden/pagehide) мог отправить
		// СТАРЫЙ снимок udata и, если его ответ придёт ПОСЛЕ прямой записи сервера, тихо затереть
		// её. suspendPlayerSave()/resumePlayerSave() перекрывают именно это окно — тот же приём,
		// что уже есть у bosses.attack/claimKill (player-save.js).
		if(window.suspendPlayerSave) suspendPlayerSave('base_upgrade');
		TS.php('base.upgrade', {building_id:idx}, (e)=>{
			this._baseUpgradeInFlight = false;
			console.log('[base._upgradeBuilding] ← ответ сервера:', JSON.stringify(e));
			if(!e || !e.patch){
				console.error('[base._upgradeBuilding] некорректный ответ сервера (нет patch), улучшение не применено:', JSON.stringify(e));
				if(window.resumePlayerSave) resumePlayerSave('base_upgrade');
				return;
			}
			const prevLevel = b.level;
			const gainedXp  = b.upgrade_xp;
			// applyPatch() ПЕРЕД resumePlayerSave() — иначе отложенный автосейв может уйти со
			// СТАРЫМ udata и затереть то, что upgrade() только что записал напрямую на сервере.
			applyPatch(e.patch);
			if(window.resumePlayerSave) resumePlayerSave('base_upgrade');
			this._loadFromUdata();
			const nb = this.buildings[idx];
			if(window.achievements) achievements._checkAll(); // Потратить рубли/тушенку
			notify.showResult({text: nb.level > prevLevel ? (nb.name + ' улучшена до ' + nb.level + ' уровня!') : (nb.name + ': +' + gainedXp + ' XP')}, 1);
			this._renderBuildings();
		}, (err)=>{
			this._baseUpgradeInFlight = false;
			console.error('[base._upgradeBuilding] ← ошибка сервера | building_id:', idx, '| код:', err && err.code, '| полностью:', JSON.stringify(err));
			if(window.resumePlayerSave) resumePlayerSave('base_upgrade');
			notify.showResult({text:'Не удалось улучшить здание. Попробуй ещё раз'}, 0);
		});
	}

	_renderGym(){
		console.log('[base._renderGym] рендер качалки, gym_section visible:', this.win.gym_section && this.win.gym_section.visible);
		const cards = this.win.gym_section.gym_cards;
		console.log('[base._renderGym] gym_cards:', cards);
		for(let i = 0; i < 3; i++){
			const s = this.stats[i];
			const c = cards['card_'+i];
			c.icon_txt.text  = s.icon;
			c.name_txt.text  = s.name;
			c.stat_txt.text  = 'Уровень ' + s.level + ' / ' + s.max_level;
			c.bonus_txt.text = s.bonus;
			if(typeof c.setXp === 'function') c.setXp(s.xp, s.xp_next);
			if(c.cost_txt) c.cost_txt.text = '⚡ -' + s.energy_cost + ' энергии';

			if(s.level >= s.max_level){
				if(c.butt_train._txt) c.butt_train._txt.text = 'МАКС';
				c.butt_train.interactive = false;
				c.butt_train.alpha = 0.5;
			} else {
				if(c.butt_train._txt) c.butt_train._txt.text = 'ТРЕНИРОВАТЬ';
				c.butt_train.interactive = true;
				c.butt_train.alpha = 1;
			}
		}
	}

	// 27.09.2026 (по репорту "покупка всё ещё странно себя ведёт" — тот же класс гонки, что уже
	// чинили в vassilich.js/shmot.js/weapons.js). Раньше _trainStat() СРАЗУ списывал энергию и
	// применял XP/level-up ЛОКАЛЬНО, плюс this._saveToUdata() сохранял предсказанный base_stats
	// в udata ДО ответа сервера — если периодический автосейв успевал улететь между этим и
	// ответом, base.php.train() на сервере грузил уже "предсказанный" base_stats из БД и своим
	// $energyCost=3 списывал энергию СВЕРХУ ещё раз. Теперь честный запрос→ответ для энергии/XP
	// характеристики: применяем ТОЛЬКО patch (energy/base_stats) + _loadFromUdata(). Исключение —
	// str_xp_total: это отдельное, изначально ЦЕЛИКОМ клиент-авторитетное поле (base.php.train()
	// его не трогает вовсе, см. server/core/controllers/base.php — используется только для
	// ачивки "Сила"/Зарубы), поэтому его инкремент остаётся локальным, как и был.
	_trainStat(idx){
		if(this._baseTrainInFlight){
			console.log('[base._trainStat] запрос уже выполняется, повторный клик проигнорирован');
			return;
		}
		const s = this.stats[idx];
		if(s.level >= s.max_level){
			notify.showResult({text:'Характеристика на максимуме!'}, 0);
			return;
		}

		// 28.09.2026 (репорт — визуальный аудит энергии по прямой просьбе): читал СЫРОЕ
		// udata['energy'] — то, что реально сохранено в БД, БЕЗ учёта регенерации, накопленной
		// с последнего сохранения. HUD (interface.js.updateEnergy()) и zone.js._attack() тем
		// временем уже показывают/проверяют через TIMERS.getEnergy() (регенерированное
		// значение) — из-за расхождения игрок мог видеть в HUD, например, 13 энергии, а качалка
		// отказывала с "Недостаточно энергии!", посчитав по устаревшему сырому значению.
		// Тот же приём, что уже используют bot.js/dev_panel.js — TIMERS с фолбэком на udata,
		// если TIMERS почему-то ещё не создан.
		const energy = window.TIMERS ? TIMERS.getEnergy() : parseInt(udata['energy']||0);
		if(energy < s.energy_cost){
			notify.showResult({text:'Недостаточно энергии! Нужно ' + s.energy_cost}, 0);
			return;
		}

		this._baseTrainInFlight = true;
		console.log('[base._trainStat] → сервер | stat_id:', idx, '| energy_cost:', s.energy_cost);
		// 28.09.2026 (та же защита, что в _upgradeBuilding() выше — см. коммент там и память
		// агента incident_checkall_flush_wipes_server_credits): base.train() тоже пишет
		// energy/base_stats напрямую на сервере, окно запроса нужно перекрыть suspend/resume.
		if(window.suspendPlayerSave) suspendPlayerSave('base_train');
		TS.php('base.train', {stat_id:idx}, (e)=>{
			this._baseTrainInFlight = false;
			console.log('[base._trainStat] ← ответ сервера:', JSON.stringify(e));
			if(!e || !e.patch){
				console.error('[base._trainStat] некорректный ответ сервера (нет patch), тренировка не применена:', JSON.stringify(e));
				if(window.resumePlayerSave) resumePlayerSave('base_train');
				return;
			}
			const prevLevel = s.level;
			applyPatch(e.patch);
			if(window.resumePlayerSave) resumePlayerSave('base_train');
			this._loadFromUdata();

			// Ачивка "Сила" — только для характеристики idx===0 ("Сила"), суммарный XP,
			// когда-либо вложенный именно в неё (не текущий s.xp — тот обнуляется на каждом
			// level-up, а достижение про накопленное "иметь N силы" за всё время). См. коммент
			// у функции — сервер это поле не считает, инкремент целиком клиентский.
			if(idx === 0){
				const gainedXp = 40 + Math.floor(Math.random()*20);
				udata['str_xp_total'] = (parseInt(udata['str_xp_total'] || 0) + gainedXp).toString();
			}

			if(window.achievements) achievements._checkAll(); // Качалка/Сила/энергия — уже из patch
			const ns = this.stats[idx];
			notify.showResult({text: ns.level > prevLevel ? (ns.name + ' прокачана до ' + ns.level + ' уровня!') : (ns.name + ': тренировка завершена! ⚡-' + s.energy_cost)}, 1);
			this._renderGym();
		}, (err)=>{
			this._baseTrainInFlight = false;
			console.error('[base._trainStat] ← ошибка сервера | stat_id:', idx, '| код:', err && err.code, '| полностью:', JSON.stringify(err));
			if(window.resumePlayerSave) resumePlayerSave('base_train');
			notify.showResult({text:'Недостаточно энергии! Нужно ' + s.energy_cost}, 0);
		});
	}

	_renderLocations(){
		console.log('[base._renderLocations] рендер локаций, loc_section visible:', this.win.loc_section && this.win.loc_section.visible);
		const cards = this.win.loc_section.loc_cards;
		console.log('[base._renderLocations] loc_cards:', cards);
		for(let i = 0; i < 5; i++){
			const loc = this.locations[i];
			const c   = cards['card_'+i];
			c.icon_txt.text  = loc.icon;
			c.name_txt.text  = loc.name;
			c.desc_txt.text  = loc.desc;
			if(typeof c.setHere === 'function') c.setHere(this.myLocationId === loc.id);
		}
	}

	_moveToLocation(idx){
		if(this.myLocationId === idx){
			notify.showResult({text:'Ты уже здесь!'}, 0);
			return;
		}
		this.myLocationId = idx;
		this._saveToUdata();
		this._renderLocations();
		notify.showResult({text:'База перенесена: ' + this.locations[idx].name + ' ' + this.locations[idx].icon}, 1);
		TS.php('base.relocate', {location_id:idx}, (e)=>{ if(e && e.patch) applyPatch(e.patch); }, null);
	}

	_saveToUdata(){
		udata['base_buildings'] = JSON.stringify(this.buildings.map(b=>({level:b.level,xp:b.xp,xp_next:b.xp_next,upgrade_cost:b.upgrade_cost})));
		udata['base_stats']     = JSON.stringify(this.stats.map(s=>({level:s.level,xp:s.xp,xp_next:s.xp_next})));
		udata['base_location']  = String(this.myLocationId);
	}

	_loadFromUdata(){
		if(!udata) return;
		try{
			const bb = helper.safeParseJSON(udata['base_buildings'], []);
			bb.forEach((b,i)=>{ if(this.buildings[i]){ Object.assign(this.buildings[i], b); } });
			const bs = helper.safeParseJSON(udata['base_stats'], []);
			bs.forEach((s,i)=>{ if(this.stats[i]){ Object.assign(this.stats[i], s); } });
			this.myLocationId = parseInt(udata['base_location']||'0')||0;
		} catch(ex){}
	}

	// Бонус здания для других модулей
	static getBuildingBonus(key){
		if(!window.base) return 0;
		const b = window.base.buildings.find(b=>b.bonus_key===key);
		return b ? b.bonus_per_lv * b.level : 0;
	}

	open(){
		console.log('[base.open] открытие вкладки базы');
		console.log('[base.open] win:', this.win, 'children:', this.win && this.win.children && this.win.children.length);
		console.log('[base.open] base_section:', this.win && this.win.base_section);
		console.log('[base.open] gym_section:', this.win && this.win.gym_section);
		console.log('[base.open] loc_section:', this.win && this.win.loc_section);
		console.log('[base.open] tabs:', this.win && this.win.tabs);
		this.win.setTransform(40, 19);
		this._loadFromUdata();
		this._selectTab(0);
		home.openScreen(this.win);
		// Персонаж и кнопка закрытия — добавляем в layer1_mc поверх FLA (не внутрь FLA)
		// win.setTransform(40,19) → экранные координаты = winCoord + offset
		// 24.09.2026 (по прямому указанию — "в пропущенных местах тоже замени на новый файл"):
		// та же замена, что и в home.js — pers.png -> "персонаж который сидит.png", явные
		// width/height=273×389 сохраняют прежний видимый размер.
		if(!this._persSpr){
			const persTex = PIXI.Texture.from('./images/персонаж который сидит.png');
			console.log('[base.open] загрузка персонаж который сидит.png, texture valid:', persTex && !persTex.noFrame);
			persTex.on('loaded', ()=>{ console.log('[base.open] персонаж который сидит.png ЗАГРУЖЕНА успешно, width:', persTex.width, 'height:', persTex.height); });
			persTex.on('error', (e)=>{ console.error('[base.open] персонаж который сидит.png ОШИБКА загрузки:', e); });
			this._persSpr = new PIXI.Sprite(persTex);
			this._persSpr.anchor.set(0, 0);
			this._persSpr.x = 546; // 40 + 506
			this._persSpr.y = 223; // 19 + 204
			this._persSpr.width = 273;
			this._persSpr.height = 389;
		}
		console.log('[base.open] persSpr texture:', this._persSpr.texture && this._persSpr.texture.valid, 'size:', this._persSpr.width, 'x', this._persSpr.height);
		root.layer1_mc.addChild(this._persSpr);
		// Левое предплечье (24.09.2026, уточнено пользователем через редактор позиций на
		// home.js — x:515 y:327 scale:0.197 при persSpr там на 506,204, т.е. смещение
		// +9x/+123y от персонажа), пересчитано под сдвиг этого экрана (+40,+19).
		if(!this._leftForearmSpr){
			this._leftForearmSpr = new PIXI.Sprite(PIXI.Texture.from('./images/левое предплечье.png'));
			this._leftForearmSpr.anchor.set(0, 0);
			this._leftForearmSpr.x = 554; // 40 + 514
			this._leftForearmSpr.y = 343; // 19 + 324
			this._leftForearmSpr.scale.set(0.197);
		}
		root.layer1_mc.addChild(this._leftForearmSpr);
		if(!this._closePixiBtn){
			this._closePixiBtn = new PIXI.Sprite(PIXI.Texture.from('./images/layers/zone/btn_exit.png'));
			this._closePixiBtn.scale.set(0.5);
			this._closePixiBtn.x = 1240;
			this._closePixiBtn.y = 38;
			this._closePixiBtn.interactive = true;
			this._closePixiBtn.buttonMode = true;
			this._closePixiBtn.on('pointerover', ()=>{ _sa(this._closePixiBtn, 0.75); this._closePixiBtn.scale.set(0.54); });
			this._closePixiBtn.on('pointerout', ()=>{ _sa(this._closePixiBtn, 1); this._closePixiBtn.scale.set(0.5); });
			this._closePixiBtn.on('pointerdown', ()=>this.close());
		}
		root.layer1_mc.addChild(this._closePixiBtn);
	}

	close(){
		if(this._persSpr && this._persSpr.parent) this._persSpr.parent.removeChild(this._persSpr);
		if(this._leftForearmSpr && this._leftForearmSpr.parent) this._leftForearmSpr.parent.removeChild(this._leftForearmSpr);
		if(this._closePixiBtn && this._closePixiBtn.parent) this._closePixiBtn.parent.removeChild(this._closePixiBtn);
		home.closeScreen();
	}
}
