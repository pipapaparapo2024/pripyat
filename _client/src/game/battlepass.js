import { applyPatch } from '../modules/patch.js';

export default class Battlepass{
	constructor(mc){
		this.mc  = mc;
		this.win = mc.battlepass_win;

		this.MAX_LEVEL   = 500;
		this.LEVELS_PAGE = 50;  // 5 строк × 10 ячеек

		this.bpLevel   = 1;
		this.bpXp      = 0;
		this.bpXpNext  = 200;
		this.page      = 0; // страница: 0=1-50, 1=51-100, ...

		// Шаблон наград (повторяется по циклу каждые 10 уровней)
		this._rewardCycle = [
			{icon:'💰', val:'200 монет',   type:'coins',  amount:200},
			{icon:'🥫', val:'5 тушенки',   type:'stew',   amount:5},
			{icon:'⚡', val:'+20 энергии', type:'energy', amount:20},
			{icon:'🚬', val:'2 папироса',  type:'cig',    amount:2},
			{icon:'💰', val:'500 монет',   type:'coins',  amount:500},
			{icon:'🥫', val:'15 тушенки',  type:'stew',   amount:15},
			{icon:'⚡', val:'+50 энергии', type:'energy', amount:50},
			{icon:'🚬', val:'5 папирос',   type:'cig',    amount:5},
			{icon:'💰', val:'1000 монет',  type:'coins',  amount:1000},
			{icon:'👑', val:'БОНУС',       type:'coins',  amount:2000},
		];

		// Какие уровни уже забраны
		this.claimed = {};

		this.win.butt_close.on('pointerdown',     ()=>this.close());
		this.win.butt_prev.on('pointerdown',       ()=>this._prevPage());
		this.win.butt_next.on('pointerdown',       ()=>this._nextPage());
		this.win.butt_claim_all.on('pointerdown',  ()=>this._claimAll());
		this._bindCells();
	}

	_bindCells(){
		const rows = this.win.bp_rows;
		for(let r = 0; r < 5; r++){
			const row = rows['row_'+r];
			for(let c = 0; c < 10; c++){
				const cell    = row['cell_'+c];
				const r_ = r, c_ = c;
				cell.butt_claim.on('pointerdown', ()=>this._claimCell(r_, c_));
			}
		}
	}

	_getReward(level){
		const idx = (level - 1) % 10;
		const base = this._rewardCycle[idx];
		// Масштабируем награду с уровнем
		const mult = 1 + Math.floor((level - 1) / 10) * 0.5;
		return {
			icon:   base.icon,
			val:    base.val,
			type:   base.type,
			amount: Math.floor(base.amount * mult),
		};
	}

	_renderPage(){
		const startLv = this.page * this.LEVELS_PAGE + 1;
		const rows    = this.win.bp_rows;

		for(let r = 0; r < 5; r++){
			const row = rows['row_'+r];
			for(let c = 0; c < 10; c++){
				const lv   = startLv + r * 10 + c;
				const cell = row['cell_'+c];

				if(lv > this.MAX_LEVEL){
					cell.visible = false;
					continue;
				}
				cell.visible = true;

				const reward = this._getReward(lv);
				cell.level_txt.text = lv;
				cell.icon_txt.text  = reward.icon;
				cell.val_txt.text   = reward.val;

				const done    = !!this.claimed[lv];
				const current = !done && lv === this.bpLevel;
				const locked  = !done && lv > this.bpLevel;

				cell.setState(done ? 'done' : current ? 'current' : locked ? 'locked' : 'done');
			}
		}

		const totalPages = Math.ceil(this.MAX_LEVEL / this.LEVELS_PAGE);
		this.win.page_txt.text      = 'Уровни ' + startLv + '–' + Math.min(this.MAX_LEVEL, startLv + this.LEVELS_PAGE - 1) + '  (стр. '+(this.page+1)+' / '+totalPages+')';
		this.win.butt_prev.visible  = this.page > 0;
		this.win.butt_next.visible  = this.page < totalPages - 1;
	}

	_prevPage(){
		if(this.page > 0){ this.page--; this._renderPage(); }
	}

	_nextPage(){
		const totalPages = Math.ceil(this.MAX_LEVEL / this.LEVELS_PAGE);
		if(this.page < totalPages - 1){ this.page++; this._renderPage(); }
	}

	_claimCell(rowIdx, colIdx){
		const lv = this.page * this.LEVELS_PAGE + rowIdx * 10 + colIdx + 1;
		this._claimLevel(lv);
	}

	_claimLevel(lv){
		// 26.09.2026: bp.claim на сервере отклоняется при BETA_LOCKED, но прямой вызов
		// window.battlepass._claimLevel(lv) успевал локально начислить награду и сохранить её
		// через автосейв. Пока пропуск выключен, не меняем udata до ответа сервера.
		notify.showResult({text:'Боевой пропуск пока недоступен'}, 0);
		return;

		if(lv > this.bpLevel || this.claimed[lv]) return;

		const reward = this._getReward(lv);
		this.claimed[lv] = true;

		const rk = {coins:'coins', stew:'stew', cig:'cigarettes', energy:'energy'}[reward.type];
		if(rk === 'energy'){
			if(window.TIMERS){
				TIMERS.current_energy = Math.min(TIMERS.ENERGY_MAX, TIMERS.getEnergy() + reward.amount);
			}
			udata['energy'] = String(window.TIMERS ? TIMERS.getEnergy() : parseInt(udata['energy']||0) + reward.amount);
			if(window.iface) iface.updateEnergy();
		} else {
			udata[rk] = parseInt(udata[rk]||0) + reward.amount;
		}
		iface.updateUp();
		// 21.09.2026 (аудит "достижения появляются с задержкой") — забор награды БП не имел
		// своей проверки вовсе.
		if(window.achievements) achievements._checkAll();

		this._saveToUdata();
		this._renderPage();
		notify.showResult({text:'Уровень ' + lv + ' · ' + reward.icon + ' ' + reward.val}, 1);
		TS.php('bp.claim', {level:lv}, (e)=>{ if(e && e.patch) applyPatch(e.patch); }, null);
	}

	_claimAll(){
		// Тот же безусловный клиентский барьер нужен и для консольного _claimAll(), иначе
		// он покажет успешный массовый забор, хотя все запросы bp.claim отклоняются сервером.
		notify.showResult({text:'Боевой пропуск пока недоступен'}, 0);
		return;

		let count = 0;
		for(let lv = 1; lv <= this.bpLevel; lv++){
			if(!this.claimed[lv]){
				this._claimLevel(lv);
				count++;
			}
		}
		if(count === 0){
			notify.showResult({text:'Нет незабранных наград'}, 0);
		} else {
			notify.showResult({text:'Забрано наград: ' + count}, 1);
		}
	}

	// Вызывается извне при получении XP (из bosses, zone и т.д.)
	addXp(amount){
		// Battle Pass временно отключен: награды и уведомления не выдаются.
		return;
		this.bpXp += amount;
		while(this.bpXp >= this.bpXpNext && this.bpLevel < this.MAX_LEVEL){
			this.bpXp    -= this.bpXpNext;
			this.bpLevel++;
			this.bpXpNext = Math.floor(this.bpXpNext * 1.05);
			notify.showResult({text:'🏆 Бател Пасс: уровень ' + this.bpLevel + '!'}, 1);
		}
		this._updateHeader();
		this._saveToUdata();
	}

	_updateHeader(){
		this.win.season_bar.setProgress(this.bpLevel, this.MAX_LEVEL);
		this.win.xp_txt.text = 'XP до следующего уровня: ' + this.bpXp + ' / ' + this.bpXpNext;
	}

	_saveToUdata(){
		udata['bp_level']   = String(this.bpLevel);
		udata['bp_xp']      = String(this.bpXp);
		udata['bp_xp_next'] = String(this.bpXpNext);
		udata['bp_claimed'] = JSON.stringify(this.claimed);
	}

	_loadFromUdata(){
		if(!udata) return;
		try{
			this.bpLevel  = parseInt(udata['bp_level']  || '1')   || 1;
			this.bpXp     = parseInt(udata['bp_xp']     || '0')   || 0;
			this.bpXpNext = parseInt(udata['bp_xp_next']|| '200') || 200;
			this.claimed  = helper.safeParseJSON(udata['bp_claimed'], {});
		} catch(ex){}
	}

	// Перейти на страницу с текущим уровнем
	_jumpToCurrent(){
		this.page = Math.floor((this.bpLevel - 1) / this.LEVELS_PAGE);
	}

	open(){
		this.win.setTransform(40, 19);
		this._loadFromUdata();
		this._jumpToCurrent();
		this._updateHeader();
		this._renderPage();
		home.openScreen(this.win);
	}

	close(){
		home.closeScreen();
	}
}
