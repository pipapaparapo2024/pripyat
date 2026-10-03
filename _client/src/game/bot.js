export default class Bot{
	constructor(mc){
		this.mc  = mc;
		this.win = mc.bot_win;

		this.isRunning = false;
		this._interval = null;
		this._logLines = [];
		this._sessionStart = null;
		this._sessionTick  = null;

		// Настройки бота
		this.settings = [
			{icon:'⚔',  name:'Авто-бой с боссами',   desc:'Автоматически атаковать текущего босса при наличии энергии', key:'bot_bosses',  enabled:false},
			{icon:'🏕',  name:'Авто-зона',             desc:'Захватывать доступные контрольные точки в Зоне',             key:'bot_zone',    enabled:false},
			{icon:'📦',  name:'Авто-хабар',            desc:'Открывать обычные контейнеры при наличии',                  key:'bot_habar',   enabled:false},
			{icon:'🏋',  name:'Авто-тренировка',       desc:'Тренировать характеристики при наличии энергии',            key:'bot_gym',     enabled:false},
			{icon:'🎰',  name:'Авто-двор',             desc:'Играть в кости на минимальную ставку',                      key:'bot_dvor',    enabled:false},
			{icon:'🥫',  name:'Авто-взнос в банду',    desc:'Делать взносы в банду при наличии ресурсов',                key:'bot_gangs',   enabled:false},
		];

		this.win.butt_close.on('pointerdown', ()=>this.close());
		this.win.butt_start.on('pointerdown', ()=>this._start());
		this.win.butt_stop.on('pointerdown',  ()=>this._stop());
		this._bindSettings();
	}

	_bindSettings(){
		const sets = this.win.settings;
		for(let i = 0; i < 6; i++){
			const s   = this.settings[i];
			const el  = sets['setting_'+i];
			el.icon_txt.text = s.icon;
			el.name_txt.text = s.name;
			el.desc_txt.text = s.desc;
			el.toggle.setValue(s.enabled);
			el.toggle.on('change', v => {
				s.enabled = v;
				this._saveToUdata();
			});
		}
	}

	_start(){
		if(this.isRunning) return;

		const anyEnabled = this.settings.some(s=>s.enabled);
		if(!anyEnabled){
			notify.showResult({text:'Включи хотя бы одну опцию бота!'}, 0);
			return;
		}

		this.isRunning = true;
		this._sessionStart = Date.now();
		this.win.butt_start.visible = false;
		this.win.butt_stop.visible  = true;
		this.win.bot_status.setActive(true);
		this.win.bot_status.state_txt.text  = 'РАБОТАЕТ';
		this.win.bot_status.action_txt.text = 'Инициализация...';

		this._log('🟢 Бот запущен');
		this._startSessionTimer();
		this._saveToUdata();

		// Главный цикл — каждые 3 секунды
		this._interval = setInterval(()=>this._tick(), 3000);
		this._tick();
	}

	_stop(){
		if(!this.isRunning) return;
		this.isRunning = false;
		clearInterval(this._interval);
		this._interval = null;
		clearInterval(this._sessionTick);
		this._sessionTick = null;

		this.win.butt_start.visible = true;
		this.win.butt_stop.visible  = false;
		this.win.bot_status.setActive(false);
		this.win.bot_status.state_txt.text  = 'ОСТАНОВЛЕН';
		this.win.bot_status.action_txt.text = '';
		this.win.bot_status.session_txt.text = '';

		this._log('🔴 Бот остановлен');
		this._saveToUdata();
	}

	_tick(){
		if(!this.isRunning) return;

		const energy = window.TIMERS ? TIMERS.getEnergy() : parseInt(udata['energy']||0);
		let acted = false;

		// Авто-бой с боссами
		if(this.settings[0].enabled && energy >= 5 && window.bosses){
			const b = window.bosses;
			const bd = b.data[b.selected];
			if(bd && bd.hp > 0){
				b._attack();
				this._setAction('⚔ Атакую ' + bd.name);
				acted = true;
			}
		}

		// Авто-зона
		if(!acted && this.settings[1].enabled && energy >= 3 && window.zone){
			const z  = window.zone;
			const cp = z._findAvailableCP();
			if(cp !== null){
				z._attack(cp);
				this._setAction('🏕 Захватываю точку ' + cp);
				acted = true;
			}
		}

		// Авто-хабар
		if(!acted && this.settings[2].enabled && window.habar){
			const h = window.habar;
			const commonCon = h.containers[0];
			if(commonCon.count > 0){
				h._openContainer(0);
				this._setAction('📦 Открываю контейнер');
				acted = true;
			}
		}

		// Авто-тренировка
		if(!acted && this.settings[3].enabled && energy >= 3 && window.base){
			const b = window.base;
			const statIdx = b.stats.findIndex(s=>s.level < s.max_level);
			if(statIdx >= 0){
				b._trainStat(statIdx);
				this._setAction('🏋 Тренирую ' + b.stats[statIdx].name);
				acted = true;
			}
		}

		// Авто-двор (кости)
		if(!acted && this.settings[4].enabled && window.dvor){
			const d    = window.dvor;
			const cost = d._diceUsed === 0 ? 0 : 10;
			if(cost === 0 || parseInt(udata['coins']||0) >= cost){
				d._playDice();
				this._setAction('🎰 Играю в кости');
				acted = true;
			}
		}

		// Авто-взнос в банду
		if(!acted && this.settings[5].enabled && window.gangs){
			const g = window.gangs;
			if(g.myGangId !== null){
				const gang = g.gangs[g.myGangId];
				const hasStew  = !gang.donate_cost.stew  || parseInt(udata['stew']||0)  >= gang.donate_cost.stew;
				const hasCoins = !gang.donate_cost.coins || parseInt(udata['coins']||0) >= gang.donate_cost.coins;
				if(hasStew && hasCoins){
					g._donate(g.myGangId);
					this._setAction('🤝 Взнос в банду ' + gang.name);
					acted = true;
				}
			}
		}

		if(!acted){
			const reasons = [];
			if(energy < 3) reasons.push('нет энергии');
			this._setAction('💤 Ожидание' + (reasons.length ? ' · ' + reasons.join(', ') : ''));
		}
	}

	_setAction(text){
		if(this.win.bot_status && this.win.bot_status.action_txt){
			this.win.bot_status.action_txt.text = text;
		}
		this._log(text);
	}

	_log(text){
		const now  = new Date();
		const time = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
		this._logLines.unshift('[' + time + '] ' + text);
		if(this._logLines.length > 6) this._logLines.length = 6;
		this._renderLog();
	}

	_renderLog(){
		const log = this.win.bot_log.log_entries;
		for(let i = 0; i < 6; i++){
			log['line_'+i].text = this._logLines[i] || '';
			log['line_'+i].style.fill = i === 0 ? '#80c040' : '#3a5a2a';
		}
	}

	_startSessionTimer(){
		if(this._sessionTick) clearInterval(this._sessionTick);
		const tick = () => {
			if(!this._sessionStart || !this.win.bot_status) return;
			const elapsed = Date.now() - this._sessionStart;
			const h = Math.floor(elapsed / 3600000);
			const m = Math.floor((elapsed % 3600000) / 60000);
			const s = Math.floor((elapsed % 60000)   / 1000);
			const p = n => String(n).padStart(2,'0');
			this.win.bot_status.session_txt.text = 'Сессия: ' + p(h)+':'+p(m)+':'+p(s);
		};
		tick();
		this._sessionTick = setInterval(tick, 1000);
	}

	_saveToUdata(){
		udata['bot_running']  = this.isRunning ? '1' : '0';
		udata['bot_settings'] = JSON.stringify(this.settings.map(s=>s.enabled));
	}

	_loadFromUdata(){
		if(!udata) return;
		try{
			const saved = helper.safeParseJSON(udata['bot_settings'], []);
			saved.forEach((v, i)=>{ if(this.settings[i]) this.settings[i].enabled = !!v; });
		} catch(ex){}
	}

	open(){
		this.win.setTransform(40, 19);
		this._loadFromUdata();
		// Синхронизируем тогглы с загруженными настройками
		const sets = this.win.settings;
		for(let i = 0; i < 6; i++){
			sets['setting_'+i].toggle.setValue(this.settings[i].enabled);
		}
		this.win.butt_start.visible = !this.isRunning;
		this.win.butt_stop.visible  = this.isRunning;
		this.win.bot_status.setActive(this.isRunning);
		this.win.bot_status.state_txt.text = this.isRunning ? 'РАБОТАЕТ' : 'ОСТАНОВЛЕН';
		this._renderLog();
		home.openScreen(this.win);
	}

	close(){
		home.closeScreen();
	}
}
