export default class Timers{
	constructor(real_time){
		window.TIME = parseInt(real_time);
		window.DATE = new Date(TIME * 1000);
		window.SEASON = ['winter','spring','summer','autumn'][parseInt((DATE.getMonth()+1)/3)%4];
		window.days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

		this.month_rus = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

		this.start_t = new Date().getTime();

		// Энергия: 1 единица каждые 5 минут, максимум 50 (ТЗ)
		this.ENERGY_MAX = 50;
		this.ENERGY_REGEN_SEC = 300; // 5 минут

		// udata еще null в момент создания Timers — инициализируем максимумом,
		// updateFromUdata() вызывается позже после получения udata
		this.current_energy = this.ENERGY_MAX;
		this.energy_last_time = TIME;

		this.startEnergyTimer();
	}

	// 28.09.2026 (репорт игрока — "энергия не восстанавливается или не сохраняется",
	// скриншот: 5 энергии спустя ~2 часа простоя): единая формула регенерации, общая для
	// updateFromUdata()/spendEnergy()/addEnergy() и для applyPatch() (см. syncFromPatch()
	// ниже) — та же, что серверная Gameops::energySnapshot() (server/core/models/gameops.php).
	// savedSec — unix-секунды последней базовой метки (аналог energy_time), nowMs — Date.now().
	// Возвращает { energy, baseTimeMs } — baseTimeMs сдвинут на remainder (уже накопленный
	// остаток времени до следующей единицы), а НЕ сброшен на nowMs целиком — так прогресс к
	// следующей единице не теряется при каждом пересчёте (старый баг: "потратил энергию —
	// 5-минутный кулдаун начался заново, хотя из прошлых 5 минут уже прошло 3").
	_regenSnapshot(saved, savedSec, nowMs){
		if(isNaN(savedSec) || savedSec <= 0){
			return { energy: saved, baseTimeMs: nowMs };
		}
		const nowSec = Math.floor(nowMs / 1000);
		const elapsed = Math.max(0, nowSec - savedSec);
		const ticks = Math.floor(elapsed / this.ENERGY_REGEN_SEC);
		const remainder = elapsed - ticks * this.ENERGY_REGEN_SEC;
		// saved может УЖЕ превышать ENERGY_MAX (донат-энергия сверх потолка, см. addEnergy) —
		// Math.max(saved, ...) гарантирует, что регенерация может только добавлять, не обрезать.
		const energy = Math.max(saved, Math.min(this.ENERGY_MAX, saved + ticks));
		// Если энергия уже у потолка — остатка до "следующей единицы" нет, держать его незачем.
		const baseTimeMs = (energy >= this.ENERGY_MAX) ? nowMs : (nowMs - remainder * 1000);
		return { energy, baseTimeMs };
	}

	updateFromUdata(){
		if(!udata) return;
		// Обновляем макс. энергию из udata (здания, артефакты могут менять)
		const savedMax = parseInt(udata['max_energy']);
		if(!isNaN(savedMax) && savedMax > 0) this.ENERGY_MAX = Math.min(1000000, savedMax);
		let saved = parseInt(udata['energy']);
		let saved_time = parseInt(udata['energy_time']);
		if(!isNaN(saved)){
			const snap = this._regenSnapshot(saved, saved_time, new Date().getTime());
			this.current_energy = snap.energy;
			this.energy_base = snap.energy;
			this.energy_base_time = snap.baseTimeMs;
			console.log('[timers.updateFromUdata] энергия восстановлена | saved:', saved, '| saved_time:', saved_time,
				'| ENERGY_MAX:', this.ENERGY_MAX, '| итог current_energy:', this.current_energy,
				'| donat-переполнение сохранено:', saved > this.ENERGY_MAX,
				'| next energy in (сек):', this.nextEnergyIn());
		} else {
			this.energy_base = this.current_energy;
			this.energy_base_time = new Date().getTime();
		}
		if(window.iface) iface.updateEnergy();
	}

	// 28.09.2026: вызывается из patch.js.applyPatch() при любом server-authoritative
	// изменении энергии (трата в Зоне/Качалке) — раньше applyPatch() просто присваивал
	// TIMERS.current_energy новое значение, НЕ трогая energy_base/energy_base_time.
	// Из-за этого на следующем тике startEnergyTimer() пересчитывал энергию от СТАРОЙ
	// (до траты) базы и мог тут же "откатить" HUD обратно вверх — рассинхронизация между
	// показанным числом и тем, что реально в БД. energyTimeStr может отсутствовать в
	// ответах старых/непропатченных эндпоинтов — тогда просто переносим текущую базу на
	// "сейчас" без потери энергии (без пересчёта регенерации, но и без отката вверх).
	syncFromPatch(energyStr, energyTimeStr){
		if(energyStr === undefined) return;
		const saved = parseInt(energyStr);
		if(isNaN(saved)) return;
		const saved_time = energyTimeStr !== undefined ? parseInt(energyTimeStr) : NaN;
		const snap = this._regenSnapshot(saved, saved_time, new Date().getTime());
		this.current_energy = snap.energy;
		this.energy_base = snap.energy;
		this.energy_base_time = snap.baseTimeMs;
		if(udata) udata['energy'] = String(this.current_energy);
		if(udata && energyTimeStr !== undefined) udata['energy_time'] = String(energyTimeStr);
		console.log('[timers.syncFromPatch] энергия синхронизирована с сервером | energy:', saved,
			'| energy_time:', saved_time, '| итог current_energy:', this.current_energy,
			'| next energy in (сек):', this.nextEnergyIn());
	}

	startEnergyTimer(){
		setInterval(() => {
			if(this.current_energy >= this.ENERGY_MAX) return;

			let base = this.energy_base !== undefined ? this.energy_base : this.ENERGY_MAX;
			let base_ms = this.energy_base_time !== undefined ? this.energy_base_time : this.start_t;
			let elapsed_sec = (new Date().getTime() - base_ms) / 1000;
			let regen = Math.floor(elapsed_sec / this.ENERGY_REGEN_SEC);
			let new_energy = Math.min(this.ENERGY_MAX, base + regen);

			if(new_energy !== this.current_energy){
				this.current_energy = new_energy;
				if(window.iface) iface.updateEnergy();
			}
		}, 1000);
	}

	getEnergy(){
		return this.current_energy;
	}

	// 28.09.2026: раньше жёстко сбрасывал energy_base_time на Date.now() — если до
	// следующей единицы энергии оставалось, например, 2 минуты (3 из 5 уже прошли), трата
	// отбрасывала эти 3 минуты и заново требовала полных 5 (баг, который пользователь помнил
	// и попросил перепроверить). Теперь сначала схлопывает текущую базу через
	// _regenSnapshot() (учитывает уже прошедшие тики + remainder), и только потом вычитает
	// amount — remainder переносится дальше, а не теряется. Сейчас нигде не вызывается
	// (трата энергии перенесена на сервер, см. zone.php/base.php — applyPatch()→
	// syncFromPatch() выше), оставлен рабочим на случай локальных/оффлайн сценариев.
	spendEnergy(amount){
		const base_ms = this.energy_base_time !== undefined ? this.energy_base_time : this.start_t;
		const snap = this._regenSnapshot(
			this.energy_base !== undefined ? this.energy_base : this.ENERGY_MAX,
			Math.floor(base_ms / 1000),
			new Date().getTime()
		);
		if(snap.energy < amount) return false;
		this.current_energy   = snap.energy - amount;
		this.energy_base      = this.current_energy;
		this.energy_base_time = snap.baseTimeMs;
		if(udata) udata['energy'] = String(this.current_energy);
		if(udata) udata['energy_time'] = String(Math.floor(this.energy_base_time / 1000));
		if(window.iface) iface.updateEnergy();
		return true;
	}

	addEnergy(amount){
		// Донат-энергия (покупка за голоса) НЕ ограничена обычным потолком ENERGY_MAX —
		// иначе покупка бесполезна почти всегда, когда энергия уже близка к максимуму
		// (баг: Math.min(ENERGY_MAX, ...) обрезал купленную энергию обратно до потолка,
		// визуально "ничего не добавилось"). Пассивная регенерация (startEnergyTimer/
		// updateFromUdata) этот метод не использует — им клэмп не нужен.
		// 28.09.2026: та же правка, что spendEnergy() выше — схлопывает текущую базу через
		// _regenSnapshot() перед добавлением, чтобы не терять remainder уже накопленного
		// прогресса до следующей единицы (актуально, если донат-покупка происходит, пока
		// энергия ещё не на потолке).
		const base_ms = this.energy_base_time !== undefined ? this.energy_base_time : this.start_t;
		const snap = this._regenSnapshot(
			this.energy_base !== undefined ? this.energy_base : this.ENERGY_MAX,
			Math.floor(base_ms / 1000),
			new Date().getTime()
		);
		const before = this.current_energy;
		this.current_energy = snap.energy + amount;
		console.log('[timers.addEnergy] донат-энергия начислена без потолка | было:', before,
			'| +' + amount, '| стало:', this.current_energy, '| ENERGY_MAX (потолок регена, тут НЕ применяется):', this.ENERGY_MAX);
		this.energy_base      = this.current_energy;
		this.energy_base_time = snap.baseTimeMs;
		if(udata) udata['energy'] = String(this.current_energy);
		if(udata) udata['energy_time'] = String(Math.floor(this.energy_base_time / 1000));
		if(window.iface) iface.updateEnergy();
	}

	// Время до следующей единицы энергии (секунды)
	nextEnergyIn(){
		let base_ms = this.energy_base_time !== undefined ? this.energy_base_time : this.start_t;
		let elapsed_sec = (new Date().getTime() - base_ms) / 1000;
		let next = this.ENERGY_REGEN_SEC - (elapsed_sec % this.ENERGY_REGEN_SEC);
		return Math.ceil(next);
	}
}