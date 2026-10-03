import { applyPatch } from '../modules/patch.js';

// ── SERVER-AUTHORITATIVE ЕЖЕДНЕВНЫЕ ЗАДАНИЯ (23.09.2026, перенос экономики) ──
// Раньше набор заданий на сегодня генерировался Math.random() ПРЯМО В БРАУЗЕРЕ, прогресс
// читался из udata напрямую, а награда применялась ОПТИМИСТИЧНО (udata[...] += reward_val)
// ДО ответа сервера — читер мог подделать всё целиком через консоль/users.save (см. подробный
// разбор в server/core/controllers/tasks.php). Теперь клиент — тонкий прокси: генерация/
// прогресс/выдача награды считаются только на сервере (tasks.getTasks/tasks.claim), клиент
// лишь отображает то, что пришло в ответе, и применяет patch как обычно.
//
// Раздел временно заблокирован на сервере (BETA_LOCKED в tasks.php, UI-кнопка уже убрана из
// HUD 22.09.2026, см. interface-panels.js) — open()/_claimTask() ниже написаны так, чтобы
// корректно обработать fail(56) (и любую другую ошибку сети), а не упасть с необработанным
// исключением, если экран всё же открыт в обход отсутствующей кнопки (dev-панель и т.п.).
export default class Zadaniya{
	constructor(mc){
		this.mc  = mc;
		this.win = mc.zadaniya_win;

		// Активные задания на сегодня — приходят целиком с сервера (tasks.getTasks), каждый
		// элемент: {idx, id, type, icon, name, desc, reward_lbl, need, prog, claimed}.
		this.tasks = [];

		// Счетчик для таймера обратного отсчета
		this._timerInterval = null;

		this.win.butt_close.on('pointerdown', ()=>this.close());
		this._bindClaims();
	}

	_bindClaims(){
		const cards = this.win.task_cards;
		for(let i = 0; i < 5; i++){
			const idx = i;
			cards['card_'+i].butt_claim.on('pointerdown', ()=>this._claimTask(idx));
		}
	}

	_render(){
		const cards = this.win.task_cards;
		let doneCount = 0;
		const dailyCount = this.tasks.filter(t=>t.type==='daily').length;

		for(let i = 0; i < 5; i++){
			const task = this.tasks[i];
			const card = cards['card_'+i];
			if(!task){ card.visible = false; continue; }

			card.visible = true;
			card.icon_txt.text  = task.icon;
			card.name_txt.text  = task.name;
			card.desc_txt.text  = task.desc;
			card.reward_txt.text = '🎁 ' + task.reward_lbl;
			card.setData(task.type, task.claimed, task.prog, task.need);

			if(task.type === 'daily' && task.claimed) doneCount++;
		}

		// Прогресс дня
		this.win.day_progress.setProgress(doneCount, dailyCount);
	}

	_claimTask(idx){
		const task = this.tasks[idx];
		if(!task || task.claimed) return;
		if(task.prog < task.need){
			notify.showResult({text:'Задание еще не выполнено!'}, 0);
			return;
		}

		console.log('[zadaniya._claimTask] → сервер: tasks.claim | idx:', idx);
		TS.php('tasks.claim', {task_idx: idx}, (e)=>{
			console.log('[zadaniya._claimTask] ← ответ сервера:', JSON.stringify(e));
			if(!e || !e.patch){
				console.error('[zadaniya._claimTask] некорректный ответ сервера (нет patch), награда не выдана:', JSON.stringify(e));
				notify.showResult({text:'Не удалось получить награду'}, 0);
				return;
			}
			applyPatch(e.patch);
			if(window.iface) iface.updateUp();
			if(window.achievements) achievements._checkAll();

			task.claimed = true;
			this._render();
			notify.showResult({text:'Задание «' + task.name + '» выполнено! ' + task.reward_lbl}, 1);
		}, (err)=>{
			console.error('[zadaniya._claimTask] ← ошибка сервера:', JSON.stringify(err));
			// Код 56 — раздел временно заблокирован (BETA_LOCKED в tasks.php).
			if(err && err.code === 56){
				notify.showResult({text:'Раздел временно недоступен'}, 0);
			} else {
				notify.showResult({text:'Не удалось получить награду'}, 0);
			}
		});
	}

	_startTimer(){
		if(this._timerInterval) clearInterval(this._timerInterval);

		const tick = () => {
			const now    = new Date();
			const next   = new Date(now);
			next.setHours(24, 0, 0, 0); // следующая полночь
			const diff   = next - now;
			const h      = Math.floor(diff / 3600000);
			const m      = Math.floor((diff % 3600000) / 60000);
			const s      = Math.floor((diff % 60000) / 1000);
			const pad    = n => String(n).padStart(2,'0');
			if(this.win.reset_timer && this.win.reset_timer.time_txt){
				this.win.reset_timer.time_txt.text = pad(h)+':'+pad(m)+':'+pad(s);
			}
		};
		tick();
		this._timerInterval = setInterval(tick, 1000);
	}

	_stopTimer(){
		if(this._timerInterval){ clearInterval(this._timerInterval); this._timerInterval = null; }
	}

	open(){
		this.win.setTransform(40, 19);
		home.openScreen(this.win);

		console.log('[zadaniya.open] → сервер: tasks.getTasks');
		TS.php('tasks.getTasks', {}, (e)=>{
			console.log('[zadaniya.open] ← ответ сервера:', JSON.stringify(e));
			if(!e || !e.patch || !e.tasks){
				console.error('[zadaniya.open] некорректный ответ сервера (нет patch/tasks):', JSON.stringify(e));
				notify.showResult({text:'Не удалось загрузить задания'}, 0);
				return;
			}
			applyPatch(e.patch);
			this.tasks = e.tasks;
			this._render();
			this._startTimer();
		}, (err)=>{
			console.error('[zadaniya.open] ← ошибка сервера:', JSON.stringify(err));
			if(err && err.code === 56){
				notify.showResult({text:'Раздел временно недоступен'}, 0);
			} else {
				notify.showResult({text:'Не удалось загрузить задания'}, 0);
			}
		});
	}

	close(){
		this._stopTimer();
		home.closeScreen();
	}
}
