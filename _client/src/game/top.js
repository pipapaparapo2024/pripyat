export default class Top{
	constructor(mc){
		this.mc  = mc;
		this.win = mc.top_win;

		this.currentTab = 0;
		this._serverRows = null;

		// Категории: ключ udata, лейбл значения, иконка
		this.categories = [
			{key:'total_damage', label:'урона нанесено', icon:'⚔'},
			{key:'coins',        label:'монет',          icon:'💰'},
			{key:'bosses_killed',label:'боссов убито',   icon:'🏆'},
			{key:'stew',         label:'тушенки',        icon:'🥫'},
		];

		// Заглушка данных других игроков (до синхронизации с сервером)
		this._mockPlayers = [
			{name:'Меченый',      gang:'Одиночки',  vals:[148200, 92400, 47, 3120]},
			{name:'Сидорович',    gang:'Долг',      vals:[134700, 78300, 39, 2880]},
			{name:'Воронин',      gang:'Долг',      vals:[121500, 65100, 35, 2540]},
			{name:'Лукаш',        gang:'Свобода',   vals:[108900, 54800, 31, 2210]},
			{name:'Клык',         gang:'Монолит',   vals:[97300,  47600, 28, 1980]},
			{name:'Бес',          gang:'Военные',   vals:[84100,  41200, 24, 1740]},
			{name:'Призрак',      gang:'Чистое Небо',vals:[72400, 36500, 21, 1560]},
			{name:'Дядя Яша',     gang:'Одиночки',  vals:[61800, 29300, 17, 1330]},
			{name:'Зулус',        gang:'Долг',      vals:[51200, 23100, 14, 1110]},
			{name:'Стрелок',      gang:'Свобода',   vals:[42700, 18400, 11, 940]},
		];

		this.win.butt_close.on('pointerdown',   ()=>this.close());
		this.win.butt_refresh.on('pointerdown', ()=>this._refresh());
		this._bindTabs();
	}

	_bindTabs(){
		const tabs = this.win.tabs;
		for(let i = 0; i < 4; i++){
			const idx = i;
			tabs['tab_'+i].on('pointerdown', ()=>this._selectTab(idx));
		}
	}

	_selectTab(idx){
		this.currentTab = idx;
		const tabs = this.win.tabs;
		for(let i = 0; i < 4; i++) tabs['tab_'+i].setActive(i === idx);
		this._renderList(idx);
	}

	_renderList(catIdx){
		const cat     = this.categories[catIdx];
		// 22.09.2026 (тот же баг, что в interface.js.updateNick() — "проблема с выводом имени"):
		// кастомный ник (udata['nick']) должен иметь приоритет над именем ВК, иначе игрок,
		// сменивший позывной, видит своё старое имя ВК в собственной строке топа.
		let myName = 'Ты';
		if(window.vk_user_info && vk_user_info['first_name']) myName = vk_user_info['first_name'] + ' ' + (vk_user_info['last_name']||'');
		else if(udata['name']) myName = udata['name'];
		if(udata['nick']) myName = udata['nick'];
		const myVal   = parseInt(udata[cat.key] || 0);

		let all;
		if(this._serverRows && this._serverRows.length){
			all = this._serverRows.map((r) => ({
				name:  'ID ' + r.id,
				sub:   '',
				value: r.value,
				isMe:  String(r.id) === String(vk_params['vk_user_id']),
			}));
			if(!all.some(p => p.isMe)){
				all.push({ name: myName, sub: 'Ты', value: myVal, isMe: true });
			} else {
				const me = all.find(p => p.isMe);
				if(me) me.name = myName;
			}
		} else {
			all = this._mockPlayers.map((p) => ({
				name:  p.name,
				sub:   p.gang,
				value: p.vals[catIdx],
			}));
			all.push({ name: myName, sub: udata['gang_id'] !== '' ? '🫂 Моя банда' : 'Одиночка', value: myVal, isMe: true });
		}
		all.sort((a, b) => b.value - a.value);

		const list = this.win.row_list;
		const topTen = all.slice(0, 10);
		for(let i = 0; i < 10; i++){
			const row  = list['row_'+i];
			const item = topTen[i];
			if(item){
				row.visible = true;
				row.setData(
					i + 1,
					item.name,
					item.sub,
					cat.icon + ' ' + item.value.toLocaleString('ru-RU'),
					!!item.isMe
				);
			} else {
				row.visible = false;
			}
		}

		const myPlace = (this._myPlace > 0) ? this._myPlace : (all.findIndex(p => p.isMe) + 1);
		this.win.my_place_txt.text = 'Твое место: #' + myPlace + ' из ' + Math.max(all.length, myPlace);
	}

	_refresh(){
		TS.php('top.get', {cat: this.currentTab}, (data)=>{
			this._serverRows = (data && data.rows) ? data.rows : null;
			this._myPlace = (data && data.my_place) ? data.my_place : 0;
			notify.showResult({text:'Таблица обновлена'}, 1);
			this._renderList(this.currentTab);
		}, ()=>{
			notify.showResult({text:'Не удалось обновить топ'}, 0);
			this._renderList(this.currentTab);
		});
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
