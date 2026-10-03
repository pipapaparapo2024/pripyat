/** Ryukzak reward overlay. */
import { applyPatch } from '../../../modules/patch.js';
import REWARDS from '../../../data/ryukzak_rewards.json';

// Пороги накопления очков рюкзака (15.09.2026, присланы пользователем) — используется ТОЛЬКО
// для клиентского ПРЕВЬЮ уровня/прогресс-бара ДО открытия; фактический уровень и награду
// считает сервер (server/core/controllers/ryukzak.php, server/json/ryukzak_config.json —
// тот же массив порогов, сверен построчно при переносе 21.09.2026).
const RYUKZAK_THRESHOLDS = [30, 70, 120, 180, 250, 330, 420, 520, 630, 750, 850, 930, 1000, 1060, 1110, 1145, 1170, 1185, 1195, 1200];

function _ryukzakLevelFromPoints(points){
	let lvl = 0;
	for(let i = 0; i < RYUKZAK_THRESHOLDS.length; i++){
		if(points >= RYUKZAK_THRESHOLDS[i]) lvl = i + 1;
		else break;
	}
	return lvl; // 0..20 — не может превышать 20, порогов ровно 20
}

export function attachRyukzak(proto){
	// 21.09.2026 (по прямому указанию, перенос экономики на сервер) — раньше вся эта функция
	// САМА списывала тушёнку (никак — тушёнка не списывалась вообще, баг), катала оружие по
	// весам и начисляла награду напрямую в udata. Теперь: открытие рюкзака (кнопка ЗАБРАТЬ)
	// зовёт ryukzak.open на сервере — сервер сам проверяет 20 тушёнки, сам катает RNG оружия и
	// сам начисляет остальное. Рюкзак теперь можно открывать СКОЛЬКО УГОДНО раз подряд, пока
	// хватает тушёнки — очки рюкзака влияют только на то, КАКОЙ из 20 уровней наград достанется,
	// а не на саму возможность открытия (раньше был неверный гейт "canClaim = level > claimedLevel",
	// разрешавший забрать только ОДИН раз за уровень — убран целиком).
	proto._openRyukzakReward = function(){
		this._compassShow();
		const BASE = './images/layers/popups/sidorovich/';

		const points       = parseInt(udata && udata['ryukzak_points'] ? udata['ryukzak_points'] : 0);
		const previewLevel = Math.max(1, _ryukzakLevelFromPoints(points));
		const lvIdx        = Math.max(0, Math.min(19, previewLevel - 1));
		const previewTier  = REWARDS[lvIdx];

		const win = new PIXI.Container();
		win.interactive = true;

		// Фон 1280×720 (тату-версия отключена в бете — см. старый комментарий ниже)
		// Бета: выпадение тату отключено. const hasTatu = level >= 20 && Math.random() < 0.15;
		const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'nagrada_ryukzak_bez_tatu.png'));
		bg.interactive = true;
		win.addChild(bg);

		// Кнопка НАЗАД (130×44)
		const nazadBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'nagrada_ryukzak_nazad.png'));
		nazadBtn.x = 974; nazadBtn.y = 88;
		nazadBtn.interactive = true; nazadBtn.buttonMode = true;
		nazadBtn.on('pointerover', ()=>{ _sa(nazadBtn, 0.8); });
		nazadBtn.on('pointerout',  ()=>{ _sa(nazadBtn, 1); });
		nazadBtn.on('pointerdown', ()=>{
			win.visible = false;
			this._ryukzakWin = null;
			this.popHud('ryukzak');
		});
		win.addChild(nazadBtn);

		// --- Иконки наград — рендерятся ОДИН РАЗ, по РЕАЛЬНОЙ награде от сервера (после
		// успешного ryukzak.open), а не заранее по превью — иначе набор ненулевых иконок
		// (mach>0/pist>0/ak>0) мог бы разойтись с тем, что реально выпало по RNG сервера.
		const fmtN = (n) => n >= 10000 ? Math.round(n/1000)+'K' : n >= 1000 ? (n/1000).toFixed(1)+'K' : String(n);

		// 02.10.2026 (по прямому указанию — новый арт для ножа/пистолета, координаты даны
		// пользователем напрямую): заменили старые nagrada_ryukzak_nozh.png/_pistolet.png.
		// 04.10.2026 (повторная правка, редактор позиций — пистолет x:275 y:185 scale:0.810,
		// нож x:460 y:350 scale:0.810): scale совпадает с уже заданным глобальным spr.scale.set(0.81)
		// ниже, менять нужно только x/y этих двух записей.
		const FIXED_POS = {
			'награда рюкзак пистолет.png': { x: 275, y: 185 },
			'nagrada_ryukzak_sigi.png':     { x: 404, y: 178 },
			'nagrada_ryukzak_rubli.png':    { x: 544, y: 190 },
			'nagrada_ryukzak_opyt.png':     { x: 682, y: 198 },
			'награда рюкзак нож.png':      { x: 460, y: 350 },
			'nagrada_ryukzak_avtomat.png':  { x: 615, y: 342 },
		};
		const LABEL_OFFSET = {
			'награда рюкзак пистолет.png': { dx:  0, dy: -4 },
			'nagrada_ryukzak_sigi.png':     { dx:  -4, dy: +6 },
			'nagrada_ryukzak_rubli.png':    { dx:  -2, dy: +6 },
			'nagrada_ryukzak_opyt.png':     { dx: +22, dy:  0 },
			'награда рюкзак нож.png':      { dx: +30, dy: -12 },
			'nagrada_ryukzak_avtomat.png':  { dx: +34, dy: -6 },
		};

		const rewardIconsCont = new PIXI.Container();
		win.addChild(rewardIconsCont);

		const _renderRewardIcons = (reward) => {
			rewardIconsCont.removeChildren();
			const iconItems = [];
			if(reward.mach > 0) iconItems.push({f:'награда рюкзак нож.png',      v: reward.mach});
			if(reward.pist > 0) iconItems.push({f:'награда рюкзак пистолет.png', v: reward.pist});
			if(reward.ak   > 0) iconItems.push({f:'nagrada_ryukzak_avtomat.png',  v: reward.ak});
			iconItems.push({f:'nagrada_ryukzak_sigi.png',  v: reward.cig});
			iconItems.push({f:'nagrada_ryukzak_rubli.png', v: reward.c});
			iconItems.push({f:'nagrada_ryukzak_opyt.png',  v: reward.exp});

			iconItems.forEach((item) => {
				const pos = FIXED_POS[item.f];
				if(!pos){ console.warn('[ryukzak] нет позиции для', item.f); return; }
				const spr = new PIXI.Sprite(PIXI.Texture.from(BASE + item.f));
				spr.anchor.set(0, 0);
				spr.scale.set(0.81);
				spr.x = pos.x; spr.y = pos.y;
				rewardIconsCont.addChild(spr);
				const off = LABEL_OFFSET[item.f] || { dx: 0, dy: 0 };
				const lbl = new PIXI.Text(fmtN(item.v), {
					fontFamily: 'Southbank LT', fontSize: 24, fill: '#1a1a1a'
				});
				lbl.anchor.set(0.5, 0.5);
				lbl.rotation = 11 * Math.PI / 180;
				const _setLblPos = () => { lbl.x = pos.x + spr.width/2 + off.dx; lbl.y = pos.y + spr.height * 0.75 + off.dy; };
				if(spr.texture.baseTexture.valid) _setLblPos();
				else spr.texture.baseTexture.once('loaded', _setLblPos);
				rewardIconsCont.addChild(lbl);
			});
		};
		// 02.10.2026 (по прямому указанию — "нужно выводить ключ соответствующего босса, не
		// текст"): раньше здесь был PIXI.Text с числом ("+7 КЛЮЧА ДЛЯ БОССА..."), что не
		// совпадало с ожиданием игрока (ключ персональный и выдаётся штучно, не пачкой) —
		// заменено на иконку конкретного ключа (те же файлы 'ключ <босс>.png', что и в
		// bosses_prefight.js). Без числового лейбла: количество ключей за один розыгрыш
		// рюкзака теперь всегда ровно 1 (см. ryukzak_rewards.json/ryukzak_config.json —
		// значения k>1 на верхних уровнях убраны тем же указанием), так что подписывать
		// количество отдельно избыточно.
		// 04.10.2026 (баг найден по прямому указанию — "ключи боссов не отображаются"):
		// иконка грузилась по BASE ('./images/layers/popups/sidorovich/' + file) — файлов
		// 'ключ *.png' там нет (есть только в './images/' и './images/layers/popups/bosses/'),
		// PIXI.Texture.from() тихо отдавал битую/пустую текстуру, keyIconSpr.visible=true
		// выставлялся корректно, но рисовать было нечего. KEY_BASE — тот же './images/', что
		// и в bosses_prefight.js (откуда и скопирован этот арт).
		const KEY_BASE = './images/';
		const KEY_BOSS_ICON_FILES = { 1:'ключ счастливчик.png', 2:'ключ ястреб.png', 3:'ключ меченный.png' };
		const keyIconSpr = new PIXI.Sprite(PIXI.Texture.EMPTY);
		keyIconSpr.anchor.set(0.5, 0.5);
		// 04.10.2026 (повторная правка, редактор позиций — x:366 y:392 scale:0.331, w:90 h:120):
		// та же физическая высота/ширина, что и раньше (90×120 на нативных 272×362), просто
		// заданы через scale вместо явных width/height — используем именно scale.set(), чтобы
		// соответствовать тому, как редактор позиций сообщает координаты.
		keyIconSpr.x = 366; keyIconSpr.y = 392;
		keyIconSpr.scale.set(0.331);
		keyIconSpr.visible = false;
		keyIconSpr.interactive = true; keyIconSpr.buttonMode = true;
		win.addChild(keyIconSpr);

		// 04.10.2026 (по прямому указанию — "сделай так чтобы при наведении на ключ писалось на
		// какого босса этот ключ"): тот же паттерн тултипа, что уже используется в skills.js —
		// тёмная плашка с текстом, показывается на pointerover рядом с иконкой. Имя босса берём
		// из уже существующего window.bosses.data (та же карта id→name, что рисует список
		// боссов) — не дублируем отдельным массивом имён.
		const keyTooltip = new PIXI.Container();
		keyTooltip.visible = false;
		const keyTooltipBg = new PIXI.Graphics();
		const keyTooltipTxt = new PIXI.Text('', { fontFamily: 'Southbank LT', fontSize: 16, fill: '#ffffff' });
		keyTooltipTxt.anchor.set(0.5, 0.5);
		keyTooltip.addChild(keyTooltipBg);
		keyTooltip.addChild(keyTooltipTxt);
		win.addChild(keyTooltip);
		let keyTooltipBossId = 0;
		keyIconSpr.on('pointerover', () => {
			const bossName = (window.bosses && window.bosses.data && window.bosses.data[keyTooltipBossId])
				? window.bosses.data[keyTooltipBossId].name : null;
			if(!bossName) return;
			keyTooltipTxt.text = 'Ключ босса «' + bossName + '»';
			const padX = 12, padY = 8;
			keyTooltipBg.clear();
			keyTooltipBg.beginFill(0x111111, 0.92); keyTooltipBg.lineStyle(1, 0x5a4a2a);
			keyTooltipBg.drawRoundedRect(-keyTooltipTxt.width/2 - padX, -keyTooltipTxt.height/2 - padY,
				keyTooltipTxt.width + padX*2, keyTooltipTxt.height + padY*2, 4);
			keyTooltipBg.endFill();
			keyTooltip.x = keyIconSpr.x; keyTooltip.y = keyIconSpr.y - 80;
			keyTooltip.visible = true;
		});
		keyIconSpr.on('pointerout', () => { keyTooltip.visible = false; });

		const _setKeyPreview = (count, bossId) => {
			const file = KEY_BOSS_ICON_FILES[bossId];
			keyTooltipBossId = bossId;
			if(count > 0 && file){
				keyIconSpr.texture = PIXI.Texture.from(KEY_BASE + file);
				keyIconSpr.visible = true;
			} else {
				keyIconSpr.visible = false;
				keyTooltip.visible = false;
			}
		};
		// Грубый ориентир СРАЗУ (нет сетевой задержки) — cig/c/exp фиксированы в тарифе, оружие
		// пока показываем суммарным "w" под иконкой автомата, пока не пришёл честный ответ сервера.
		_renderRewardIcons({
			cig: previewTier.cig, c: previewTier.c, exp: previewTier.exp,
			mach: 0, pist: 0, ak: previewTier.w,
		});
		_setKeyPreview(previewTier.k || 0, previewTier.key_boss);

		// 04.10.2026 (по прямому указанию — "должно сразу рассчитываться какое оружие и в каких
		// количествах будет в награде рюкзака, и указываться в рюкзаке"): грубый ориентир выше
		// заменяется ЧЕСТНЫМ сплитом с сервера (ryukzak.preview) — тот же детерминированный
		// бросок, что реально применит open() при клике ЗАБРАТЬ (см. ryukzak.php._rollWeapons()),
		// поэтому превью и фактическая награда гарантированно совпадают, а не просто похожи.
		// 04.10.2026 (баг найден по прямому указанию — "забрал награду, следующая награда
		// визуально никак не меняется, хотя уровень сброшен"): раньше этот запрос делался
		// ТОЛЬКО один раз, при самом открытии экрана. После закрытия попапа награды уровень
		// ОБНУЛЯЛСЯ (текст "УРОВЕНЬ РЮКЗАКА : 1" обновлялся корректно), но иконки/суммы награды
		// на экране оставались от ПРЕДЫДУЩЕГО (уже забранного) розыгрыша — honest-превью для
		// НОВОГО уровня ни разу не запрашивалось повторно. Вынесено в отдельную функцию, чтобы
		// звать и при открытии, и сразу после сброса уровня (см. ниже, в колбэке закрытия попапа).
		const _fetchHonestPreview = () => {
			if(!window.TS) return;
			TS.php('ryukzak.preview', {}, (res) => {
				if(this._ryukzakWin !== win) return; // экран успели закрыть/переоткрыть — чужой ответ не трогаем
				console.log('[ryukzak._openRyukzakReward] ← честное превью сервера:', JSON.stringify(res));
				_renderRewardIcons(res);
				_setKeyPreview(res.k || 0, res.key_boss);
				lvlTxt.text = 'УРОВЕНЬ РЮКЗАКА : ' + res.level;
				_renderProgress(res.level);
			}, (err) => {
				console.error('[ryukzak._openRyukzakReward] ошибка честного превью, остаётся грубый ориентир:', JSON.stringify(err));
			});
		};
		_fetchHonestPreview();

		// --- Прогресс-бар уровня рюкзака ---
		const lvlTxt = new PIXI.Text('УРОВЕНЬ РЮКЗАКА : ' + previewLevel, {
			fontFamily: 'Southbank LT', fontSize: 28, fill: '#ffffff',
			dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 2
		});
		lvlTxt.anchor.set(0.5, 0.5);
		lvlTxt.x = 644; lvlTxt.y = 490;
		win.addChild(lvlTxt);

		const progressCont = new PIXI.Container();
		win.addChild(progressCont);
		const _renderProgress = (level) => {
			progressCont.removeChildren();
			const bagLvl = level >= 20 ? 5 : level >= 15 ? 4 : level >= 10 ? 3 : level >= 5 ? 2 : 1;
			for(let s = 0; s < bagLvl; s++){
				const seg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'nagrada_ryukzak_progress.png'));
				seg.scale.set(0.881);
				seg.x = 473 + s * 73; seg.y = 517;
				progressCont.addChild(seg);
			}
		};
		_renderProgress(previewLevel);

		// Кнопка ЗАБРАТЬ (264×68) — теперь ВСЕГДА кликабельна (сервер сам решает, хватает ли
		// тушёнки); открывает рюкзак заново при каждом клике, награда — реальная, от сервера.
		const zabratBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'nagrada_ryukzak_zabrat.png'));
		zabratBtn.x = Math.round((1280 - 264) / 2) + 14;
		zabratBtn.y = 552;
		zabratBtn.interactive = true; zabratBtn.buttonMode = true;
		zabratBtn.on('pointerover', ()=>{ _sa(zabratBtn, 0.85); });
		zabratBtn.on('pointerout',  ()=>{ _sa(zabratBtn, 1); });
		zabratBtn.on('pointerdown', ()=>{
			if(!window.TS){ console.error('[ryukzak] window.TS недоступен'); return; }
			// 22.09.2026 (по прямому указанию — "не пиши сам надпись, убери надпись"): раньше
			// сюда передавалась динамическая подпись "Открыть рюкзак за 20 тушёнки?", которая
			// дублировалась с уже вшитым в графику попапа текстом "ПОДТВЕРДИТЬ ДЕЙСТВИЕ? ЭТО
			// ДЕЙСТВИЕ БУДЕТ НЕВОЗМОЖНО ОТМЕНИТЬ" — пустая строка (confirm.js рисует текст,
			// только если он truthy) убирает верхнюю строку целиком.
			this._showConfirmPopup('', ()=>{
				console.log('[ryukzak._openRyukzakReward] → сервер ryukzak.open');
				// 28.09.2026 (см. память агента incident_checkall_flush_wipes_server_credits):
				// ryukzak.open() списывает тушёнку и начисляет награду напрямую на сервере.
				if(window.suspendPlayerSave) suspendPlayerSave('ryukzak_open');
				TS.php('ryukzak.open', {}, (res) => {
					console.log('[ryukzak._openRyukzakReward] ← ответ сервера:', JSON.stringify(res));
					if(!res || !res.patch || !res.reward){
						console.error('[ryukzak._openRyukzakReward] некорректный ответ сервера, награда НЕ применена:', JSON.stringify(res));
						if(window.resumePlayerSave) resumePlayerSave('ryukzak_open');
						notify.showResult({text:'Не удалось открыть рюкзак — попробуйте ещё раз'}, 0);
						return;
					}
					applyPatch(res.patch);
					if(window.resumePlayerSave) resumePlayerSave('ryukzak_open');
					// 04.10.2026 (фикс — "ударил босса мачете, попап «оружие не куплено»"):
					// сервер теперь отдаёт weapons в patch (см. ryukzak.php._grantWeaponReward()),
					// подтягиваем его в weapons.data — тот же приём, что уже делают
					// poker.js/habar.js после выдачи оружия.
					if(res.patch.weapons !== undefined && window.weapons) weapons._loadFromUdata();
					const r = res.reward;
					_renderRewardIcons(r);
					_setKeyPreview(r.k || 0, r.key_boss);
					lvlTxt.text = 'УРОВЕНЬ РЮКЗАКА : ' + r.level;
					_renderProgress(r.level);

					const rewards = [];
					if(r.mach > 0) rewards.push({type:'ammo_machete', amount:r.mach});
					if(r.pist > 0) rewards.push({type:'ammo_gun', amount:r.pist});
					if(r.ak   > 0) rewards.push({type:'ammo_auto', amount:r.ak});
					rewards.push({type:'cigarettes', amount:r.cig});
					rewards.push({type:'coins', amount:r.c});
					if(r.k > 0 && r.key_boss >= 1 && r.key_boss <= 4)
						rewards.push({type:'boss_key_'+r.key_boss, amount:r.k});
					rewards.push({type:'exp', amount:r.exp});

					this._showRewardPopup(rewards, () => {
						// 25.09.2026 (по прямому указанию — "рюкзак после забора награды должен
						// обнулять уровень до 0, игроку необходимо заново убивать боссов и копить
						// очки"): applyPatch(res.patch) выше уже обновил udata['ryukzak_points']
						// на 0 (сервер обнулил его сразу после начисления награды, см.
						// ryukzak.php.open()). Пока открыт попап награды, экран рюкзака ЕЩЁ
						// показывает только что полученный уровень (r.level) — это ожидаемо,
						// игрок должен видеть, что он получил. После закрытия попапа —
						// пересчитываем превью с нуля (та же формула _ryukzakLevelFromPoints,
						// что и при первом открытии экрана), иначе цифра "УРОВЕНЬ РЮКЗАКА"
						// осталась бы залипшей на старом (уже сожранном) уровне.
						const pointsAfter = parseInt(udata && udata['ryukzak_points'] ? udata['ryukzak_points'] : 0);
						const resetLevel  = Math.max(1, _ryukzakLevelFromPoints(pointsAfter));
						console.log('[ryukzak._openRyukzakReward] попап награды закрыт, очки после сброса:', pointsAfter, '→ превью уровня:', resetLevel);
						lvlTxt.text = 'УРОВЕНЬ РЮКЗАКА : ' + resetLevel;
						_renderProgress(resetLevel);
						// 04.10.2026 (баг найден по прямому указанию — "следующая награда визуально
						// никак не меняется"): уровень выше уже сброшен, но иконки/суммы награды на
						// экране — всё ещё от ТОЛЬКО ЧТО забранного розыгрыша (_renderRewardIcons/
						// _setKeyPreview с тех пор ни разу не перерисовывались). Тот же двухфазный
						// приём, что и при открытии экрана: сразу грубый локальный ориентир по
						// новому уровню (без сетевой задержки), следом честное превью с сервера.
						const resetLvIdx = Math.max(0, Math.min(19, resetLevel - 1));
						const resetTier  = REWARDS[resetLvIdx];
						_renderRewardIcons({
							cig: resetTier.cig, c: resetTier.c, exp: resetTier.exp,
							mach: 0, pist: 0, ak: resetTier.w,
						});
						_setKeyPreview(resetTier.k || 0, resetTier.key_boss);
						_fetchHonestPreview();

						// 25.09.2026 (баг найден по прямому указанию, скриншот 10/11 — "после
						// открытия рюкзака и принятия награды ХУД появляется поверх попапа
						// рюкзака, должно быть как при обычном открытии"): _showRewardPopup САМА
						// зовёт iface.restoreHud() при закрытии (см. её коммент в reward.js) —
						// restoreHud() всегда делает root.layer2_mc.addChild(this.up/this.down),
						// что кладёт ХУД в КОНЕЦ списка детей layer2_mc — то есть ПОВЕРХ экрана
						// рюкзака (win), который тоже лежит в layer2_mc и никуда не делся (сам
						// рюкзак не закрывался, закрывался только попап награды НАД ним). При
						// обычном открытии рюкзака (клик по иконке) HUD оказывается НИЖЕ, потому
						// что pushHud('ryukzak',...) вызывается ДО addChild(win) — здесь тот же
						// порядок нарушается повторным restoreHud() уже ПОСЛЕ того, как win
						// добавлен. Поднимаем win обратно поверх HUD — тот же приём z-order
						// (addChild на уже присоединённом объекте переносит его в конец списка),
						// что уже используется в проекте (см. universal_pos_editor.js).
						if(win.parent) root.layer2_mc.addChild(win);
					});
					if(window.iface){ iface.updateUp(); iface.updateNick(); }
					// _showRewardPopup сама восстанавливает HUD через iface.restoreHud() при закрытии.
					// 21.09.2026 (аудит "достижения появляются с задержкой") — applyPatch() сама
					// зовёт только iface.updateUp(), достижения не проверяет.
					if(window.achievements) achievements._checkAll();
				}, (err) => {
					if(window.resumePlayerSave) resumePlayerSave('ryukzak_open');
					console.error('[ryukzak._openRyukzakReward] ← ошибка сервера:', JSON.stringify(err));
					if(err && err.code === 46){
						notify.showResult({text:'Недостаточно тушёнки — нужно 20'}, 0);
					} else {
						notify.showResult({text:'Не удалось открыть рюкзак'}, 0);
					}
				});
			});
		});
		win.addChild(zabratBtn);

		// 25.09.2026 (по прямому указанию, скриншот — "открыт поверх Сидоровича, но теряется
		// нижний ХУД, должно быть так что страница рюкзака открывается просто поверх страницы
		// с сидоровичем"): раньше {up:false, down:false} прятал ОБА ХУДа целиком — теперь просто
		// накладываемся сверху, ХУД не трогаем вообще (тот же паттерн, что уже у sidorovich.js
		// pushHud('sidorovich', {})). Фон Сидоровича под попапом остаётся виден, как и раньше —
		// _sidorovichWin по-прежнему не закрывается.
		//
		// 25.09.2026 (по прямому указанию, скриншот — "nagrada_ryukzak_birka.png по z-index
		// должен быть выше кнопки ЗАБРАТЬ"): бирка/иконка тушёнки/число теперь добавляются
		// ПОСЛЕ zabratBtn — в PIXI позже добавленный ребёнок рисуется поверх, раньше кнопка
		// (полноразмерный спрайт 264×68, перекрывающий тот же угол) скрывала бирку под собой.
		const tushenkaTagSpr = new PIXI.Sprite(PIXI.Texture.from(BASE + 'nagrada_ryukzak_birka.png'));
		tushenkaTagSpr.x = 774; tushenkaTagSpr.y = 558;
		tushenkaTagSpr.scale.set(1.162);
		win.addChild(tushenkaTagSpr);

		const tushenkaIconSpr = new PIXI.Sprite(PIXI.Texture.from(BASE + 'nagrada_ryukzak_tushenka.png'));
		tushenkaIconSpr.x = 831; tushenkaIconSpr.y = 599;
		tushenkaIconSpr.scale.set(1.054);
		tushenkaIconSpr.rotation = 52 * Math.PI / 180;
		win.addChild(tushenkaIconSpr);

		const tushenkaQtyTxt = new PIXI.Text('20', {
			fontFamily: 'Southbank LT', fontSize: 24, fill: '#1a1a1a'
		});
		tushenkaQtyTxt.anchor.set(0.5, 0.5);
		tushenkaQtyTxt.x = 810; tushenkaQtyTxt.y = 594;
		tushenkaQtyTxt.scale.set(1.328);
		tushenkaQtyTxt.rotation = 52 * Math.PI / 180;
		win.addChild(tushenkaQtyTxt);

		this.pushHud('ryukzak', {});
		root.layer2_mc.addChild(win);
		this._ryukzakWin = win;
		this._compassWaitTex(BASE + 'nagrada_ryukzak_bez_tatu.png');
	};
}
