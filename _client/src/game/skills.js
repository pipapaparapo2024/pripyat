import { applyPatch } from '../modules/patch.js';

export default class Skills {
	constructor(){
		// 20 скиллов — суммарно 460 очков = 20 млн урона
		this.list = [
			{id:0,  name:'С размашки',           maxLvl:10,  type:'flat',  weapon:'machete', totalBonus:10,  desc:'+урон мачете'},
			{id:1,  name:'Киллер',               maxLvl:20,  type:'flat',  weapon:'gun',     totalBonus:20,  desc:'+урон ствола'},
			{id:2,  name:'Автомата очередь',     maxLvl:10,  type:'flat',  weapon:'auto',    totalBonus:10,  desc:'+урон автомата'},
			{id:3,  name:'Хладнокровный',        maxLvl:10,  type:'crit',  weapon:'machete', totalBonus:10,  desc:'% доп.урон мачете'},
			{id:4,  name:'Меткий глаз',          maxLvl:10,  type:'crit',  weapon:'gun',     totalBonus:10,  desc:'% доп.урон ствол'},
			{id:5,  name:'Отмороженный',         maxLvl:10,  type:'crit',  weapon:'auto',    totalBonus:10,  desc:'% доп.урон автомат'},
			{id:6,  name:'Зверь',                maxLvl:10,  type:'crit',  weapon:'knife',   totalBonus:10,  desc:'% доп.урон нож'},
			{id:7,  name:'Намотал покрепче',     maxLvl:10,  type:'crit',  weapon:'chain',   totalBonus:10,  desc:'% доп.урон цепь'},
			{id:8,  name:'Добавил гвозди',       maxLvl:10,  type:'crit',  weapon:'bat',     totalBonus:10,  desc:'% доп.урон бита'},
			{id:9,  name:'Адреналин',            maxLvl:50,  type:'energy',weapon:null,      totalBonus:50,  desc:'+энергия игрока'},
			{id:10, name:'Повелитель времени',   maxLvl:30,  type:'time',  weapon:null,      totalBonus:60,  desc:'+мин с боссом'},
			{id:11, name:'Уличный боец',         maxLvl:5,   type:'flat',  weapon:'knife',   totalBonus:5,   desc:'+урон ножа'},
			{id:12, name:'Взрывной',             maxLvl:8,   type:'flat',  weapon:'chain',   totalBonus:8,   desc:'+урон цепи'},
			{id:13, name:'Бейсболист',           maxLvl:7,   type:'flat',  weapon:'bat',     totalBonus:7,   desc:'+урон битой'},
			{id:14, name:'Рэмбо',                maxLvl:10,  type:'flat',  weapon:'auto',    totalBonus:20,  desc:'+урон автомата'},
			{id:15, name:'Танец лезвий',         maxLvl:60,  type:'flat',  weapon:'machete', totalBonus:58,  desc:'+урон мачете'},
			{id:16, name:'Стрельба навскидку',   maxLvl:70,  type:'flat',  weapon:'gun',     totalBonus:70,  desc:'+урон ствола'},
			{id:17, name:'Прирожденный охотник', maxLvl:10,  type:'crit',  weapon:'gun',     totalBonus:10,  desc:'% доп.урон ствол'},
			{id:18, name:'Знание стрельбы',      maxLvl:10,  type:'crit',  weapon:'auto',    totalBonus:10,  desc:'% доп.урон автомат'},
			{id:19, name:'Смертельный выстрел',  maxLvl:100, type:'flat',  weapon:'auto',    totalBonus:100, desc:'+урон автомата'},
		];

		// Маппинг типа оружия → ключ в списке скиллов
		this._wpnKey = { 0:'knife', 1:'chain', 2:'bat', 3:'machete', 4:'gun', 5:'auto' };

		// Потраченный урон на прокачку скиллов (хранится в udata)
		this.skillsDmgSpent = 0;

		// Урон ТЕКУЩЕЙ попытки боя с боссом (не персистентный, только в памяти) — см. forfeitSession()
		this._sessionDmgSpent = 0;
		// Сколько очков скиллов было заработано на МОМЕНТ НАЧАЛА текущей попытки боя —
		// нужно, чтобы при выходе понять, был ли за эту попытку получен хотя бы один
		// НОВЫЙ уровень скилла (см. _endSession()).
		this._sessionStartPoints = 0;

		// Распределенные уровни скиллов [20 значений]
		this.levels = new Array(20).fill(0);

		this._loadFromUdata();
	}

	// --- Арифметическая прогрессия ---
	// Стоимость N-го очка (1-indexed): 1000 + (N-1)*185
	_pointCost(n){ return 1000 + (n - 1) * 185; }

	// Суммарный урон для N очков: N*1000 + 185*N*(N-1)/2
	_totalDmgForPoints(n){
		if(n <= 0) return 0;
		return n * 1000 + Math.floor(185 * n * (n - 1) / 2);
	}

	// Сколько очков заработано из потраченного урона (бинарный поиск)
	_calcPoints(totalDmg){
		if(totalDmg <= 0) return 0;
		let lo = 0, hi = 460;
		while(lo < hi){
			const mid = Math.ceil((lo + hi) / 2);
			if(this._totalDmgForPoints(mid) <= totalDmg) lo = mid;
			else hi = mid - 1;
		}
		return lo;
	}

	// --- Геттеры очков ---
	get earnedPoints(){ return this._calcPoints(this.skillsDmgSpent); }

	// 18.09.2026 (по прямому указанию): бесплатная прокачка первого уровня скилла 0 убрана —
	// раньше он не вычитался из spentPoints (льгота "первый скилл бесплатно"), теперь ВСЕ
	// уровни ВСЕХ скиллов, включая первый уровень скилла 0, стоят полную цену.
	get spentPoints(){
		return this.levels.reduce((s, v) => s + v, 0);
	}

	// 25.09.2026 (по прямому указанию — "может будем сохранять отдельным полем, мне кажется
	// это хорошее решение"): доступные очки теперь читаются из персистентного серверного
	// баланса (skills_levels.points, см. skills.php/bosses.php._syncSkillPoints()) вместо
	// пересчёта earned-spent на клиенте. this._skillPoints выставляется в
	// _loadLevelsFromUdata() из ответа сервера; до первой синхронизации (undefined —
	// теоретически невозможно после _loadFromUdata на старте, но на всякий случай) — старая
	// формула как fallback, тот же результат, что сервер посчитал бы миграцией.
	get availablePoints(){
		return this._skillPoints !== undefined ? this._skillPoints : Math.max(0, this.earnedPoints - this.spentPoints);
	}

	// Сколько урона до следующего очка
	get dmgToNextPoint(){
		const n = this.earnedPoints;
		if(n >= 460) return 0;
		const already = this.skillsDmgSpent - this._totalDmgForPoints(n);
		return this._pointCost(n + 1) - Math.max(0, already);
	}

	get _xp(){
		const n = this.earnedPoints;
		if(n >= 460) return 0;
		return Math.max(0, this.skillsDmgSpent - this._totalDmgForPoints(n));
	}
	get _xpNext(){
		const n = this.earnedPoints;
		if(n >= 460) return 1;
		return this._pointCost(n + 1);
	}
	addFightDamage(dmg){
		// Если все 460 очков уже получены (~20кк урона) — доп.урон не влияет на прокачку,
		// дальше не копим (иначе skillsDmgSpent растёт бесконечно без всякого смысла).
		if(this.earnedPoints >= 460) return;
		const beforePoints = this.earnedPoints;
		this.skillsDmgSpent = (this.skillsDmgSpent || 0) + dmg;
		// Урон ТЕКУЩЕЙ попытки боя — нужен, чтобы откатить именно его при форфейте
		// («ВЫЙТИ ИЗ БОЯ»), не трогая прогресс, уже заработанный в предыдущих боях.
		this._sessionDmgSpent = (this._sessionDmgSpent || 0) + dmg;
		console.log('[skills.addFightDamage] +' + dmg + ' урона | skillsDmgSpent:', this.skillsDmgSpent,
			'| earnedPoints:', beforePoints, '→', this.earnedPoints, '| sessionStartPoints:', this._sessionStartPoints);
		this._saveToUdata();
	}
	// Шкала скиллов сама по себе не сгорает по времени — качается суммарным уроном по
	// всем боссам; полное обнуление прогресса до следующего уровня при выходе БЕЗ левелапа
	// делает _endSession() (вызывается из resetSession()/forfeitSession() ниже).
	endFight(){}

	// Новая попытка боя с боссом начинается «с чистого листа» — фиксируем очки скиллов
	// на старте, чтобы при выходе понять, был ли получен хотя бы один новый уровень.
	beginSession(){
		this._sessionDmgSpent = 0;
		this._sessionStartPoints = this.earnedPoints;
		console.log('[skills.beginSession] новая попытка боя началась | sessionStartPoints зафиксирован:', this._sessionStartPoints,
			'| skillsDmgSpent на момент старта:', this.skillsDmgSpent, '| earnedPoints:', this.earnedPoints);
	}

	// Общий выход из попытки боя (победа / поражение / ручной выход, крестик).
	// 22.09.2026 (по прямому указанию — "хочу чтобы очки скиллов обнулялись всегда, без
	// исключений, когда начинается новый бой"): раньше прогресс до следующего уровня
	// обнулялся, ТОЛЬКО ЕСЛИ за попытку не был получен ни один новый уровень (leveled-check) —
	// если левелап случился, остаток переносился в новый бой. Теперь обнуляется БЕЗУСЛОВНО,
	// даже если левелап был. Это лишь мгновенная оптимистичная реакция UI — реальный сброс
	// делает сервер (см. bosses.php._finalizeSkillSession, вызывается из claimKill()/
	// endFightSession()), applyPatch()+_loadLevelsFromUdata() после ответа сервера — источник
	// правды.
	_endSession(){
		console.log('[skills._endSession] безусловный сброс прогресса до следующего очка | earnedPoints:', this.earnedPoints,
			'| skillsDmgSpent до:', this.skillsDmgSpent);
		this.skillsDmgSpent = this._totalDmgForPoints(this.earnedPoints);
		this._sessionDmgSpent = 0;
		this._saveToUdata();
		this._flushSaveToUdata();
	}

	// Обычный выход из боя (крестик) / победа над боссом.
	resetSession(){
		this._endSession();
	}

	// Форфейт («ВЫЙТИ ИЗ БОЯ», поражение) — та же логика обнуления без левелапа.
	forfeitSession(){
		this._endSession();
	}

	// --- Апгрейд скилла ---
	// 18.09.2026 — SERVER-AUTHORITATIVE СКИЛЛЫ: раньше levels[20] хранился ВНУТРИ
	// udata['skills_data'] — поля, которое ВСЕГДА было в client-writable whitelist
	// users.php (это нужно для skillsDmgSpent, который остаётся client-reported). Значит
	// читер мог одним users.save с поддельным skills_data мгновенно прокачать ВСЕ 20
	// скиллов до максимума бесплатно — эта функция для него просто никогда не вызывалась
	// бы. Теперь levels хранятся в НОВОМ служебном поле skills_levels (НЕ в whitelist, как
	// dice_session/yashik_session) — читает и пишет только сервер. 18.09.2026 (по прямому
	// указанию): бесплатная прокачка первого уровня скилла 0 убрана целиком — все уровни
	// всех скиллов теперь стоят полную цену очками, льготы больше нет.
	// Раньше эта функция возвращала true/false синхронно — теперь асинхронный запрос,
	// весь UI-отклик (попап успеха/ошибки) обрабатывается прямо здесь же, единообразно
	// для обоих вызывающих мест (кнопка "ПРОКАЧАТЬ" и "+1 уровень" на карточке). Необязательный
	// onDone(ok) — для внешних вызывающих мест со своим экраном (см. bosses_skills.js
	// ._upgradeSelectedSkill(), которому нужно обновить СВОЙ отдельный UI уже после того,
	// как асинхронный ответ реально пришёл, а не сразу же синхронно).
	upgrade(idx, onDone){
		if(this._skillReqInFlight){
			console.log('[skills.upgrade] запрос уже выполняется, повторный клик проигнорирован');
			if(onDone) onDone(false);
			return;
		}
		const sk = this.list[idx];
		if(this.levels[idx] >= sk.maxLvl){
			notify.showResult({ text: 'Скилл «' + sk.name + '» уже на максимуме!' }, 0);
			if(onDone) onDone(false);
			return;
		}

		console.log('[skills.upgrade] → сервер | skill:', idx, '| level:', this.levels[idx],
			'| earned (клиент, для сверки):', this.earnedPoints, '| available (клиент, для сверки):', this.availablePoints);

		if(!window.TS){
			console.error('[skills.upgrade] window.TS недоступен, запрос не отправлен');
			if(onDone) onDone(false);
			return;
		}
		this._skillReqInFlight = true;

		// 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits):
		// skills.upgrade() пишет skills_levels/max_energy напрямую на сервере — окно запроса
		// нужно перекрыть suspend/resume, та же защита, что уже есть у bosses.attack/claimKill.
		if(window.suspendPlayerSave) suspendPlayerSave('skills_upgrade');
		TS.php('skills.upgrade', {skill_id: idx}, (res) => {
			this._skillReqInFlight = false;
			console.log('[skills.upgrade] ← ответ сервера:', JSON.stringify(res));
			if(!res || !res.patch){
				console.error('[skills.upgrade] некорректный ответ сервера (нет patch), апгрейд не применён:', JSON.stringify(res));
				if(window.resumePlayerSave) resumePlayerSave('skills_upgrade');
				if(onDone) onDone(false);
				return;
			}
			applyPatch(res.patch);
			if(window.resumePlayerSave) resumePlayerSave('skills_upgrade');
			this._loadLevelsFromUdata();
			// 28.09.2026 (по прямому указанию — перенос источников max_energy на сервер):
			// "Адреналин" (id:9, +1 макс. энергии за уровень) теперь считает и пишет СЕРВЕР
			// (skills.php.upgrade()) — patch уже содержит обновлённый max_energy, applyPatch()
			// выше сам обновит TIMERS.ENERGY_MAX. Раньше клиент пересчитывал TIMERS.ENERGY_MAX
			// НАПРЯМУЮ здесь — тот же класс дыры (и тот же риск затирания бонусов из других
			// источников), что уже был у shmot.js (см. gameops.php.applyShmotOwnBonus()).
			// 27.10.2026: UI-рефреш убран отсюда — вызывающий экран (bosses_skills.js) сам
			// обновляется через свой onDone-колбэк (см. _upgradeSelectedSkill() там).
			if(window.achievements) achievements.onSkillUnlock();
			notify.showResult({ text: 'Скилл «' + sk.name + '» ур.' + res.newLevel + '!' }, 1);
			if(onDone) onDone(true);
		}, (err) => {
			this._skillReqInFlight = false;
			if(window.resumePlayerSave) resumePlayerSave('skills_upgrade');
			console.error('[skills.upgrade] ← ошибка сервера:', JSON.stringify(err));
			// Коды: 77 — уже максимальный уровень (гонка — клиент отстал от сервера),
			// 78 — недостаточно очков скиллов, 76 — некорректный id (не должно случаться из UI).
			if(err && err.code === 77){
				notify.showResult({ text: 'Скилл «' + sk.name + '» уже на максимуме!' }, 0);
			} else if(err && err.code === 78){
				this._showNoPointsPopup();
			} else {
				notify.showResult({ text: 'Не удалось прокачать скилл' }, 0);
			}
			if(onDone) onDone(false);
		});
	}

	// --- Бонусы (используются в bosses / zone) ---
	getFlatBonus(weapon){
		let b = 0;
		this.list.forEach((sk, i) => {
			if(sk.type === 'flat' && sk.weapon === weapon && this.levels[i] > 0)
				b += Math.floor(sk.totalBonus * this.levels[i] / sk.maxLvl);
		});
		return b;
	}

	getCritChance(weapon){
		let c = 0;
		this.list.forEach((sk, i) => {
			if(sk.type === 'crit' && sk.weapon === weapon && this.levels[i] > 0)
				c += Math.floor(sk.totalBonus * this.levels[i] / sk.maxLvl);
		});
		return c;
	}

	getEnergyBonus(){
		return this.levels[9] > 0 ? Math.floor(50 * this.levels[9] / 50) : 0;
	}

	getTimeBonus(){
		return this.levels[10] > 0 ? Math.floor(60 * this.levels[10] / 30) : 0;
	}

	// 27.10.2026 (по прямому указанию — "зачем тут левая боевка с АТАКОВАТЬ/ПРОКАЧАТЬ, у нас
	// только бой с боссами"): старый самодельный экран скиллов (open()/_buildWin()/_buildCard()/
	// _cardSkillIdx(), включая фейковую кнопку "АТАКОВАТЬ" — см. удалённый ранее _attack()/
	// _getAttackDamage()) удалён целиком. Реальный экран прокачки — bosses_skills.js
	// (iface._openBossesSkillsScreen()), уже использующий новый арт и настоящий upgrade() ниже;
	// все вызывающие места (вкладка "Скиллы" в Сводке, кнопка в bosses-combat.js, кнопки ТАЛАНТЫ/
	// ПРОКАЧАТЬ в bosses_fight.js) переведены на него.
	_showNoPointsPopup(){
		const dmgNeeded = this.dmgToNextPoint;
		const popup = new PIXI.Container();

		const bg = new PIXI.Graphics();
		bg.beginFill(0x000000, 0.65);
		bg.drawRect(0, 0, 1280, 720);
		bg.endFill();
		bg.interactive = true;
		bg.on('pointerdown', () => { if(popup.parent) popup.parent.removeChild(popup); });
		popup.addChild(bg);

		const box = new PIXI.Graphics();
		box.beginFill(0x0d0d0d, 0.97);
		box.lineStyle(2, 0xaa2222);
		box.drawRoundedRect(480, 278, 320, 164, 8);
		box.endFill();
		popup.addChild(box);

		const title = new PIXI.Text('Недостаточно очков!', {
			fontFamily: 'Southbank LT', fontSize: 18, fill: '#ff6666', fontWeight: 'bold',
			dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
		});
		title.anchor.set(0.5, 0);
		title.x = 640; title.y = 296;
		popup.addChild(title);

		const sub = new PIXI.Text(
			dmgNeeded > 0 ? 'До следующего очка: ' + dmgNeeded + ' урона' : 'Атакуй боссов!',
			{ fontFamily: 'Southbank LT', fontSize: 14, fill: '#cccccc',
			  dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1 }
		);
		sub.anchor.set(0.5, 0);
		sub.x = 640; sub.y = 326;
		popup.addChild(sub);

		const okBg = new PIXI.Graphics();
		okBg.beginFill(0x2a2a2a); okBg.lineStyle(1, 0x888888);
		okBg.drawRoundedRect(0, 0, 90, 30, 5); okBg.endFill();
		okBg.x = 595; okBg.y = 376;
		okBg.interactive = true; okBg.buttonMode = true;
		okBg.on('pointerdown', () => { if(popup.parent) popup.parent.removeChild(popup); });
		popup.addChild(okBg);

		const okTxt = new PIXI.Text('ОК', { fontFamily: 'Southbank LT', fontSize: 14, fill: '#ffffff' });
		okTxt.anchor.set(0.5, 0.5);
		okTxt.x = 640; okTxt.y = 391;
		popup.addChild(okTxt);

		root.layer2_mc.addChild(popup);
	}


	// Прогресс скиллов (skillsDmgSpent, levels) раньше писался только в память (udata) —
	// на сервер это реально уходит либо раз в 60 секунд (автосейв), либо через
	// beforeunload (ненадёжно в вебвью VK Mini App: асинхронный запрос часто не успевает
	// долететь до закрытия вкладки). Баг: игрок наносит урон боссу (например 1000/2000 до
	// следующего очка), сразу закрывает вкладку — прогресс не долетает до сервера и при
	// следующем заходе снова 0/2000, хотя killsTotal/hpByDiff у соседних систем сохраняются
	// нормально именно потому, что там сейв идёт немедленно (см. bosses_skills.js._saveSkillsData).
	// Дебаунс 800мс — не долбим сервер запросом на каждый отдельный удар при быстрой серии атак,
	// но гарантированно сохраняем скоро после того, как игрок остановился.
	// 18.09.2026 — SERVER-AUTHORITATIVE СКИЛЛЫ: levels больше НЕ пишутся сюда — это поле
	// (skills_data) client-writable, а реальная прокачка теперь хранится в служебном
	// skills_levels (пишет только сервер, см. upgrade() выше). skillsDmgSpent остаётся
	// здесь — он и раньше был client-reported (как и сам урон по боссам).
	// 03.10.2026 (аудит "обходные users.save в обход player-save.js" — тот же класс гонки,
	// что чинили у onboarding.js._setStep()): оба метода ниже слали СВОЙ TS.php('users.save',
	// ...) в обход общего revision/suspend-механизма player-save.js, при этом срабатывая на
	// КАЖДЫЙ удар по боссу (горячий путь — bosses-combat.js._attack() как раз использует
	// suspendPlayerSave('boss_attack') вокруг своего прямого Gameops-сейва именно для защиты от
	// такой гонки, но эта защита не действует на вызовы МИМО player-save.js). Теперь оба метода
	// используют общий flushPlayerSave() под suspend/resume — ставит в очередь вместе со всеми
	// остальными автосейвами и не может прилететь на сервер СТАРЫМ снимком поверх свежей
	// серверной записи.
	_saveToUdata(){
		udata['skills_data'] = JSON.stringify({
			skillsDmgSpent: this.skillsDmgSpent
		});
		clearTimeout(this._saveDebounce);
		this._saveDebounce = setTimeout(() => {
			this._flushSaveToUdata();
		}, 800);
	}

	// Немедленный (без 800мс debounce) сейв — вызывать в момент выхода из боя с боссом
	// (крестик и «ВЫЙТИ ИЗ БОЯ»): если игрок бьёт боссa короткой серией ударов и сразу же
	// полностью закрывает приложение, обычный debounce может не успеть сработать вообще
	// (каждый новый удар откладывает таймер ещё на 800мс) — прогресс терялся именно так.
	_flushSaveToUdata(){
		clearTimeout(this._saveDebounce);
		this._saveDebounce = null;
		if(window.suspendPlayerSave) suspendPlayerSave('skills_save_to_udata');
		const _resume = () => { if(window.resumePlayerSave) resumePlayerSave('skills_save_to_udata'); };
		if(window.flushPlayerSave) flushPlayerSave('skills_save_to_udata', _resume);
		else if(window.TS) TS.php('users.save', {udata_json: JSON.stringify(udata)}, _resume, _resume);
		else _resume();
	}

	_loadFromUdata(){
		if(udata && udata['skills_data']){
			try{
				// 19.09.2026 (репорт из консоли: '"[object Object]" is not valid JSON') —
				// Database::trueJSON() на сервере уже раскодирует JSON-похожие строковые поля
				// в массив/объект ДО отправки клиенту (см. CLAUDE.md), так что udata['skills_data']
				// может прийти уже готовым объектом, а не строкой. Тот же паттерн, что и в
				// zone.js._loadFromUdata() для zone-поля.
				const raw = udata['skills_data'];
				const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
				if(s.skillsDmgSpent !== undefined) this.skillsDmgSpent = s.skillsDmgSpent;
				// 18.09.2026 (обратная совместимость при переносе на сервер): у СУЩЕСТВУЮЩИХ
				// игроков levels жили ВНУТРИ этого поля до переноса. Пока
				// сервер ещё не "усыновил" прогресс в skills_levels (это происходит при первом
				// же upgrade() ПОСЛЕ деплоя — см. skills.php._loadLevels()), показываем то, что
				// реально накоплено, а не нули — иначе игрок увидит "все скиллы обнулились" до
				// первого клика по прокачке. Как только skills_levels появится — следующая
				// строка (_loadLevelsFromUdata) перезапишет эти значения актуальными.
				if(s.levels) s.levels.forEach((v, i) => { if(i < 20) this.levels[i] = v || 0; });
			} catch(e){}
		}
		this._loadLevelsFromUdata();
	}

	// Читает levels/dmgSpent/sessionStartPoints из служебного skills_levels (пишет только
	// сервер) — вызывается и при старте (_loadFromUdata), и сразу после применения патча
	// любого серверного ответа, который мог изменить прогресс скиллов (upgrade(),
	// bosses.attack()/startFight()/claimKill()/endFightSession()).
	// 22.09.2026 (по прямому указанию — "читеры могут делать себе огромное кол-во очков через
	// консоль"): skillsDmgSpent переехал сюда же, из client-writable skills_data — теперь это
	// ЕДИНСТВЕННОЕ место, откуда клиент узнаёт свой реальный прогресс, сам он его не считает.
	_loadLevelsFromUdata(){
		if(!udata || !udata['skills_levels']) return;
		try{
			// 19.09.2026: см. комментарий в _loadFromUdata() выше — тот же случай, поле может
			// прийти уже раскодированным объектом (Database::trueJSON() на сервере).
			const raw = udata['skills_levels'];
			const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
			if(s.levels) s.levels.forEach((v, i) => { if(i < 20) this.levels[i] = v || 0; });
			if(s.dmgSpent !== undefined) this.skillsDmgSpent = parseInt(s.dmgSpent) || 0;
			if(s.sessionStartPoints !== undefined) this._sessionStartPoints = parseInt(s.sessionStartPoints) || 0;
			// 25.09.2026: персистентный баланс доступных очков (см. availablePoints выше).
			if(s.points !== undefined) this._skillPoints = parseInt(s.points) || 0;
		} catch(e){
			console.error('[skills._loadLevelsFromUdata] не удалось разобрать skills_levels:', e.message);
		}
	}
}
