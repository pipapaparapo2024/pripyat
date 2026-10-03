import { applyPatch } from '../modules/patch.js';

export default class Gangs{
	constructor(mc){
		this.mc  = mc;
		this.win = mc.gangs_win;

		this.gangs = [
			{
				id:0, name:'Одиночки',   icon:'🏕', ideology:'Свобода Зоны',
				bonus:'🥫 +10% добыча тушенки · ⚡ +5 макс. энергии',
				color:0x4a7a3a, members:0, level:1, max_level:10, xp:0, xp_next:500,
				donate_cost:{stew:10, coins:0}, donate_xp:20,
			},
			{
				id:1, name:'Долг',       icon:'⚔',  ideology:'Порядок и дисциплина',
				bonus:'🛡 +15 к защите · 💪 +10% урон по боссам',
				color:0x8a2a2a, members:0, level:1, max_level:10, xp:0, xp_next:500,
				donate_cost:{stew:0, coins:300}, donate_xp:30,
			},
			{
				id:2, name:'Свобода',    icon:'🍃', ideology:'Зона для всех',
				bonus:'🎯 +8% скорострельность · 💰 +10% монеты с боев',
				color:0x2a5a2a, members:0, level:1, max_level:10, xp:0, xp_next:500,
				donate_cost:{stew:0, coins:250}, donate_xp:25,
			},
			{
				id:3, name:'Военные',    icon:'🪖', ideology:'Зона под контролем армии',
				bonus:'🔫 +12% урон оружием · 🔧 -20% цена ремонта',
				color:0x3a5a1a, members:0, level:1, max_level:10, xp:0, xp_next:500,
				donate_cost:{stew:15, coins:200}, donate_xp:35,
			},
			{
				id:4, name:'Чистое Небо',icon:'☁',  ideology:'Наука и исследование',
				bonus:'🔬 +15% опыт с боев · 💎 +5% шанс редкого дропа',
				color:0x1a4a6a, members:0, level:1, max_level:10, xp:0, xp_next:500,
				donate_cost:{stew:5, coins:150}, donate_xp:22,
			},
			{
				id:5, name:'Монолит',    icon:'🔮', ideology:'Служение Монолиту',
				bonus:'💥 +20% урон · 🖤 -10% получаемый урон',
				color:0x4a1a6a, members:0, level:1, max_level:10, xp:0, xp_next:500,
				donate_cost:{stew:0, coins:500}, donate_xp:50,
			},
		];

		this.myGangId = null; // id банды игрока (из udata)

		this.win.butt_close.on('pointerdown', ()=>this.close());
		this._bindCards();
	}

	_bindCards(){
		const grid = this.win.gang_grid;
		for(let i = 0; i < 6; i++){
			const card = grid['card_'+i];
			const idx  = i;
			card.butt_join.on('pointerdown',   ()=>this._toggleJoin(idx));
			card.butt_donate.on('pointerdown', ()=>this._donate(idx));
		}
	}

	_render(){
		const grid = this.win.gang_grid;
		for(let i = 0; i < 6; i++){
			const g    = this.gangs[i];
			const card = grid['card_'+i];
			const isMember = (this.myGangId === g.id);

			card.emblem_icon.text  = g.icon;
			card.emblem_bg.clear();
			card.emblem_bg.beginFill(g.color,0.3);card.emblem_bg.lineStyle(2,g.color,0.8);
			card.emblem_bg.drawRoundedRect(0,0,100,100,8);card.emblem_bg.endFill();

			card.name_txt.text     = g.name;
			card.ideology_txt.text = g.ideology;
			card.bonus_txt.text    = g.bonus;
			card.members_txt.text  = '👥 ' + g.members + ' сталкеров · Ур. ' + g.level;
			card.level_txt.text    = 'Опыт банды: ' + g.xp + ' / ' + g.xp_next;
			card.level_bar.setPercent(g.xp / g.xp_next);

			card.setMember(isMember);

			// Текст взноса
			if(isMember){
				const parts = [];
				if(g.donate_cost.stew)  parts.push('🥫 ' + g.donate_cost.stew);
				if(g.donate_cost.coins) parts.push('💰 ' + g.donate_cost.coins);
				card.butt_donate.children[1].text = 'ВЗНОС ' + parts.join(' ');
			}
		}

		this.win.my_gang_txt.text = this.myGangId !== null
			? this.gangs[this.myGangId].icon + ' ' + this.gangs[this.myGangId].name
			: '—  (без банды)';
	}

	_toggleJoin(idx){
		const g = this.gangs[idx];

		if(this.myGangId === g.id){
			// Покинуть банду — убираем бонус max_energy
			this._applyEnergyBonus(false);
			this.myGangId = null;
			this._saveToUdata();
			notify.showResult({text:'Вы покинули банду «' + g.name + '»'}, 0);
		} else {
			// Вступить (автоматически покидаем старую)
			if(this.myGangId !== null){
				notify.showResult({text:'Сначала покиньте текущую банду'}, 0);
				return;
			}
			this.myGangId = g.id;
			g.members++;
			this._applyEnergyBonus(true);
			this._saveToUdata();
			notify.showResult({text:'Вы вступили в «' + g.name + '»! ' + g.bonus}, 1);
			TS.php('gangs.join', {gang_id:g.id}, (e)=>{ if(e && e.patch) applyPatch(e.patch); }, null);
		}
		this._render();
	}

	_applyEnergyBonus(joining){
		const bonus = Gangs.getBonus('max_energy');
		if(!bonus || !window.TIMERS) return;
		const delta = joining ? bonus : -bonus;
		const cur = parseInt(udata['max_energy'] || '50');
		const next = Math.max(50, cur + delta);
		udata['max_energy'] = String(next);
		TIMERS.ENERGY_MAX = next;
		if(window.iface) iface.updateEnergy();
	}

	_donate(idx){
		// 26.09.2026 (по прямому указанию): раздел "Банды" заблокирован на сервере
		// (server/core/controllers/gangs.php — private $BETA_LOCKED = true, gangs.donate
		// безусловно возвращает ошибку 56), но этот метод до вызова сервера успевал локально
		// списать валюту (udata['coins']/udata['stew']) через оптимистичное обновление UI —
		// без отката при отказе сервера. То есть прямой вызов _donate() из консоли браузера
		// (в обход спрятанной кнопки "Банда" в HUD) тратил реальные деньги игрока впустую.
		// Блокируем трату валюты прямо на клиенте, не дожидаясь ответа сервера.
		notify.showResult({text:'Раздел "Банды" пока недоступен'}, 0);
		return;

		if(this.myGangId !== idx){
			notify.showResult({text:'Вы не состоите в этой банде'}, 0);
			return;
		}
		const g = this.gangs[idx];

		// Проверяем ресурсы
		if(g.donate_cost.stew && parseInt(udata['stew']||0) < g.donate_cost.stew){
			notify.showResult({text:'Недостаточно тушенки! Нужно ' + g.donate_cost.stew}, 0);
			return;
		}
		if(g.donate_cost.coins && parseInt(udata['coins']||0) < g.donate_cost.coins){
			notify.showResult({text:'Недостаточно монет! Нужно ' + g.donate_cost.coins}, 0);
			return;
		}

		// Списываем
		// 27.09.2026: coins_spent/stew_spent больше не считаются здесь локально —
		// gangs.php.donate() теперь ведёт эту статистику сам и присылает актуальное значение в
		// patch (тот же приём, что уже применён в base.js/vassilich.js).
		if(g.donate_cost.stew){
			udata['stew']       = parseInt(udata['stew']||0)       - g.donate_cost.stew;
		}
		if(g.donate_cost.coins) udata['coins']  = parseInt(udata['coins']||0) - g.donate_cost.coins;
		iface.updateUp();

		// Начисляем опыт банде
		g.xp += g.donate_xp;
		if(g.xp >= g.xp_next && g.level < g.max_level){
			g.xp -= g.xp_next;
			g.level++;
			g.xp_next = Math.floor(g.xp_next * 1.6);
			notify.showResult({text:'Банда «' + g.name + '» достигла ' + g.level + ' уровня!'}, 1);
		} else {
			notify.showResult({text:'Взнос принят! +' + g.donate_xp + ' опыта банде'}, 1);
		}

		if(window.battlepass) battlepass.addXp(15);
		if(window.achievements) achievements._checkAll(); // Потратить рубли/тушенку
		this._saveToUdata();
		this._render();
		TS.php('gangs.donate', {gang_id:idx}, (e)=>{ if(e && e.patch) applyPatch(e.patch); }, null);
	}

	_saveToUdata(){
		udata['gang_id'] = this.myGangId !== null ? String(this.myGangId) : '';
		const gdata = this.gangs.map(g=>({level:g.level,xp:g.xp,xp_next:g.xp_next,members:g.members}));
		udata['gang_data'] = JSON.stringify(gdata);
	}

	_loadFromUdata(){
		if(!udata) return;
		const gid = udata['gang_id'];
		this.myGangId = (gid !== undefined && gid !== '') ? parseInt(gid) : null;
		if(isNaN(this.myGangId)) this.myGangId = null;
		try{
			const saved = helper.safeParseJSON(udata['gang_data'], []);
			saved.forEach((s,i)=>{
				if(this.gangs[i]){
					this.gangs[i].level   = s.level   || 1;
					this.gangs[i].xp      = s.xp      || 0;
					this.gangs[i].xp_next = s.xp_next || 500;
					this.gangs[i].members = s.members  || 0;
				}
			});
		} catch(e){}
	}

	// Бонус текущей банды по ключу (вызывается из других модулей)
	// Ключи: 'stew_bonus'=10%, 'armor'=15, 'damage'=10%, 'coins_bonus'=10%, 'exp_bonus'=15%, 'max_energy'=5
	static getBonus(key){
		if(!window.gangs || window.gangs.myGangId === null) return 0;
		const bonusMap = {
			0: {max_energy: 5,  stew_bonus: 10},             // Одиночки
			1: {armor: 15,      damage: 10},                  // Долг
			2: {speed: 8,       coins_bonus: 10},             // Свобода
			3: {damage: 12,     repair_cost: -20},            // Военные
			4: {exp_bonus: 15,  drop_bonus: 5},               // Чистое Небо
			5: {damage: 20,     armor: 10},                   // Монолит
		};
		const b = bonusMap[window.gangs.myGangId];
		return b && b[key] !== undefined ? b[key] : 0;
	}

	open(){
		this.win.setTransform(40, 19);
		this._loadFromUdata();
		this._render();
		home.openScreen(this.win);
	}

	close(){
		home.closeScreen();
	}
}
