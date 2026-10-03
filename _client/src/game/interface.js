import { attachUiKit } from './shell/ui_kit.js';
import { attachConfirmPopup } from './shell/popups/confirm.js';
import { attachRewardPopup } from './shell/popups/reward.js';
import { attachBossResultPopup } from './shell/popups/boss_result.js';
import { attachSoundPopup } from './shell/popups/sound.js';
import { attachNickPopup } from './shell/popups/nick.js';
import { attachCurrencyPopup } from './shell/popups/currency.js';
import { attachLevelUpPopup } from './shell/popups/level_up.js';
import { attachEnergyBuy } from './shell/popups/energy_buy.js';
import { attachZoneScreen } from './shell/overlays/zone_screen.js';
import { attachZoneAmbient } from './shell/overlays/zone-ambient.js';
import { attachPlayerProfile } from './shell/overlays/player_profile.js';
import { attachSidorovich } from './shell/overlays/sidorovich.js';
import { attachRyukzak } from './shell/overlays/ryukzak.js';
import { attachBossesSelect } from './shell/overlays/bosses_select.js';
import { attachBossesFight } from './shell/overlays/bosses_fight.js';
import { attachBossPreFight } from './shell/overlays/bosses_prefight.js';
import { attachBossesSkills } from './shell/overlays/bosses_skills.js';
import { attachYashik } from './shell/overlays/yashik.js';
import { attachInterfacePanels } from './interface/interface-panels.js';
import { attachAchievementDesc } from './interface/interface-achievements.js';
import { attachDevPanel } from './shell/overlays/dev_panel.js';
import { attachUniversalPosEditor } from './shell/overlays/universal_pos_editor.js';

export default class Interface{
	constructor(up_panel, down_panel, left_panel, right_panel){
		window.rootClass = this;

		this.up = up_panel;
		this.down = down_panel;
		this.left = left_panel || null;
		this.right = right_panel || null;

		// ── Декларативный ХУД (24.09.2026, по прямому указанию) ──────────────────────
		// Раньше restoreHud() САМ угадывал, прятать ли нижний HUD, растущей цепочкой ручных
		// проверок конкретных окон (bossOverlayOpen/locationOpen/zoneScreenOpen/ryukzakOpen/
		// weaponsOpen/habarOpen) — с каждым новым экраном легко забыть дописать свою проверку
		// (баг "на Хабаре не видно нижнего ХУДа" — Хабар просто не попал в список). Теперь
		// каждый экран САМ говорит о своей потребности при открытии (pushHud) и снимает её
		// при закрытии (popHud) — восстановленный опрос экрана вообще не нужен. Стек, а не
		// один флаг — потому что экраны могут открываться друг поверх друга (Хабар/Рюкзак/
		// Оружейка поверх боя с боссом): последний открытый выигрывает, что и соответствует
		// порядку наложения окон на экране; при его закрытии автоматически "проступает"
		// требование экрана под ним. Пустой стек = дефолт (оба ХУДа видны).
		this._hudStack = [];
	}

	// opts: {up?: boolean, down?: boolean} — не указанное поле считается true. id — любая
	// уникальная строка (обычно имя экрана), та же строка передаётся в popHud().
	pushHud(id, opts){
		this._hudStack = this._hudStack.filter(e => e.id !== id);
		this._hudStack.push({ id, up: opts && opts.up === false ? false : true, down: opts && opts.down === false ? false : true });
		this.restoreHud();
	}

	popHud(id){
		const before = this._hudStack.length;
		this._hudStack = this._hudStack.filter(e => e.id !== id);
		if(this._hudStack.length !== before) this.restoreHud();
	}

	init(){
		this.upInit();
		this.downInit();
		// 24.09.2026 (найден по репорту "нижний ХУД вообще не кликабельный"): initButtons()
		// (interface-panels.js) — единственное место, где вешаются pointerdown на кнопки
		// нижней панели (weapons/shmot/bosses/zone/vassilich) и части верхней (bank/settings/
		// иконки валют) — нигде не вызывался, вызов потерялся при том же рефакторинге, что и
		// initNickLabel() (см. upInit() ниже). Клики никогда не долетали до обработчиков.
		this.initButtons();
	}

	upInit(){
		const _applyAvatar = (url) => {
			if(!this.up || !this.up.ava || !this.up.ava.icon_mc) return;
			const idx = bitmaps50['id'].indexOf(vk_params['vk_user_id']);
			if(idx !== -1){ bitmaps50['id'].splice(idx, 1); bitmaps50['bm'].splice(idx, 1); }
			helper.loadPhoto50(vk_params['vk_user_id'], (bm)=>{
				if(this.up && this.up.ava && this.up.ava.icon_mc){
					const S = 69;
					bm.width = S; bm.height = S;
					bm.x = -4; bm.y = -5;
					this.up.ava.icon_mc.addChild(bm);
				}
			}, url || null);
		};
		if(window.bridge){
			bridge.sendPromise('VKWebAppGetUserInfo', {}).then(info=>{
				window.vk_user_info = info;
			_applyAvatar(info['photo_50'] || info['photo_100'] || info['photo_200'] || null);
			}).catch(()=>_applyAvatar(null));
		} else {
			const photoUrl = (window.vk_user_info && vk_user_info['photo_50']) ? vk_user_info['photo_50'] : null;
			_applyAvatar(photoUrl);
		}

		let keys_val = ['stew', 'coins', 'cigarettes'];
		for(let i = 0; i < keys_val.length; i++) this.up['val_'+keys_val[i]].icon.gotoAndStop(keys_val[i]);

		// 24.09.2026 (найдено при разборе консольной ошибки "Cannot set properties of undefined
		// (setting 'text') at updateNick"): initNickLabel() создаёт nick_txt/level_txt/exp_bar/
		// energy_txt/energy_bar и т.д., но вызов потерялся при рефакторинге — updateNick()/
		// updateEnergy() ниже читали эти поля как уже существующие и падали на undefined.
		this.initNickLabel();

		this.updateUp();
		this.updateNick();
		this.updateEnergy();

		// Явная кнопка друзей: пользователь сам в любой момент открывает понятный диалог
		// согласия; системный VK Bridge не вызывается в фоне.
		const friendsBtn = new PIXI.Sprite(PIXI.Texture.from('./images/Друзья и открытый замок.png'));
		friendsBtn.x = 20; friendsBtn.y = 100; friendsBtn.scale.set(0.040);
		const refreshFriendsButton = () => {
			// Источник истины — сохранённое на сервере согласие конкретного игрока.
			// До загрузки udata считаем, что согласия нет: кнопка не пропадает ошибочно.
			const granted = !!(window.udata && String(udata['friends_scope_granted'] || '0') === '1');
			friendsBtn.visible = !granted;
			friendsBtn.interactive = !granted;
			friendsBtn.buttonMode = !granted;
		};
		refreshFriendsButton();
		friendsBtn.on('pointerdown', () => {
			if(window.pre_control && typeof pre_control._showFriendsScopePrompt === 'function') pre_control._showFriendsScopePrompt({force:true});
		});
		root.layer2_mc.addChild(friendsBtn);
		this._refreshFriendsScopeButton = refreshFriendsButton;
		window.addEventListener('pripyat:friends-scope-granted', refreshFriendsButton);

		setInterval(() => this.updateEnergy(), 1000);

		// 26.09.2026 (по прямому указанию, перед модерацией VK — MODERATION_HANDOFF_PROMPT.md,
		// критичная находка №2: "DEV-кнопка в HUD видна и доступна любому игроку без
		// гейтинга") — кнопка DEV-панели и кнопка универсального редактора позиций были убраны
		// из HUD целиком. 27.09.2026 (по прямому указанию — "верни редактор обратно, но с
		// гейтом по моему uid"): кнопка возвращена, но видна только владельцу проекта — тот же
		// uid, что используется в debug-скриптах check_user_level.py/check_coins_now.py.
		// Остальные игроки её не видят и не могут открыть — window.vk_params устанавливается в
		// index.js из данных VK launch params, подделать его без валидной VK-сессии нельзя.
		// Dev-инструменты доступны только тестовому аккаунту Николай Сиденко / fleeeexim
		// (оба переданных VK URL указывают на uid 1113977365).
		const DEV_UIDS = ['1113977365', '382448269'];
		const _isAdminUid = !!(window.vk_params && DEV_UIDS.includes(String(vk_params['vk_user_id'])));
		console.log('[interface.initInterfaceUp] проверка админ-доступа к DEV-панели | vk_user_id:', window.vk_params && vk_params['vk_user_id'], '| допущен:', _isAdminUid);
		if(_isAdminUid){
			const _devBtn = new PIXI.Graphics();
			_devBtn.beginFill(0x1a1a3a, 0.85);
			_devBtn.lineStyle(1, 0x3ad4a4, 0.8);
			_devBtn.drawRoundedRect(0, 0, 38, 20, 4);
			_devBtn.endFill();
			_devBtn.x = 692; _devBtn.y = 20;
			_devBtn.interactive = true; _devBtn.buttonMode = true;
			_devBtn.on('pointerover', ()=>{ _devBtn.alpha = 0.65; });
			_devBtn.on('pointerout',  ()=>{ _devBtn.alpha = 1; });
			_devBtn.on('pointerdown', ()=>{ if(window.iface) iface._openDevPanel(); });
			const _devTxt = new PIXI.Text('DEV', {fontFamily:'Southbank LT', fontSize:12, fill:'#3af0c0'});
			_devTxt.anchor.set(0.5, 0.5); _devTxt.x=19; _devTxt.y=10;
			_devBtn.addChild(_devTxt);
			this.up.addChild(_devBtn);

			if(typeof this._ensureEditButton === 'function') this._ensureEditButton();
		}

		root.layer1_mc.addChild(this.up);
	}

	updateUp(){
		const fmt = (v) => helper.formatKK(parseInt(v || 0));
		this.up.val_stew.tf_txt.text        = fmt(udata['stew']);
		this.up.val_coins.tf_txt.text       = fmt(udata['coins']);
		this.up.val_cigarettes.tf_txt.text  = fmt(udata['cigarettes']);
	}

	initNickLabel(){
		this.nick_txt = new PIXI.Text('Сталкер', {
			fontFamily: 'Southbank LT', fontSize: 20, fill: '#ffffff',
			dropShadow: true, dropShadowDistance: 1, dropShadowColor: '#000000'
		});
		this.nick_txt.x = 90;
		this.nick_txt.y = 23;

		this.level_txt = new PIXI.Text('УР.1', {
			fontFamily: 'Southbank LT', fontSize: 18, fill: '#ffffff'
		});
		this.level_txt.x = 245;
		this.level_txt.y = 22;

		this.exp_bar_bg = new PIXI.Graphics();
		this.exp_bar_bg.beginFill(0x111111, 0.8);
		this.exp_bar_bg.drawRect(0, 0, 190, 8);
		this.exp_bar_bg.endFill();
		this.exp_bar_bg.x = 90;
		this.exp_bar_bg.y = 50;

		this.exp_bar = new PIXI.Graphics();
		this.exp_bar.x = 90;
		this.exp_bar.y = 50;

		const expHit = new PIXI.Graphics();
		expHit.beginFill(0xffffff, 0.001);
		expHit.drawRect(0, -6, 190, 20);
		expHit.endFill();
		expHit.x = 90; expHit.y = 50;
		expHit.interactive = true;
		expHit.on('pointerover', ()=>{
			if(this._xpTooltip && this._xpTooltip.parent) return;
			const actualExp   = parseInt(udata['exp'] || 0);
			const levelStart  = this._expCur  || 0;
				const levelEnd    = this._expNext || 0;
				const withinLevel = Math.max(0, actualExp - levelStart);
				const levelRange  = Math.max(0, levelEnd - levelStart);
				const remaining   = Math.max(0, levelEnd - actualExp);
			const fmt  = v => v.toLocaleString('ru');
			const tip = new PIXI.Container();
			// 19.09.2026 (баг найден: "слишком большое расстояние слева/справа, будто
			// фиксированное") — ширина плашки была захардкожена в 260px независимо от длины
			// текста. Теперь считается ПО ФАКТИЧЕСКОЙ ширине самой длинной строки + паддинг,
			// растягиваясь для длинного текста и сжимаясь для короткого.
			const t1 = new PIXI.Text(fmt(withinLevel) + ' / ' + fmt(levelRange) + ' XP', {
				fontFamily: 'Southbank LT', fontSize: 20, fill: '#ffcc44'
			});
			const t2 = new PIXI.Text('ДО СЛ. УР.: ' + fmt(remaining), {
				fontFamily: 'Southbank LT', fontSize: 16, fill: '#aaaaaa'
			});
			const PAD_X = 20, MIN_W = 140;
			const tipW = Math.max(MIN_W, t1.width + PAD_X * 2, t2.width + PAD_X * 2);
			const bg = new PIXI.Graphics();
			bg.beginFill(0x1a1a1a, 0.92);
			bg.lineStyle(1, 0xcc7200, 1);
			bg.drawRoundedRect(0, 0, tipW, 50, 6);
			bg.endFill();
			tip.addChild(bg);
			t1.anchor.set(0.5, 0); t1.x = tipW / 2; t1.y = 6;
			tip.addChild(t1);
			t2.anchor.set(0.5, 0); t2.x = tipW / 2; t2.y = 28;
			tip.addChild(t2);
			const _tipRawX = expHit.x + (this.up.x || 0) - 35;
			tip.x = Math.max(4, Math.min(_tipRawX, 1280 - tipW - 4));
			tip.y = Math.max(78, expHit.y + (this.up.y || 0) + 28);
			this._xpTooltip = tip;
			root.layer2_mc.addChild(tip);
		});
		expHit.on('pointerout', ()=>{
			if(this._xpTooltip && this._xpTooltip.parent) this._xpTooltip.parent.removeChild(this._xpTooltip);
			this._xpTooltip = null;
		});
		this._expHit = expHit;

		this.energy_txt = new PIXI.Text('150/150', {
			fontFamily: 'Southbank LT', fontSize: 20, fill: '#ffffff',
			dropShadow: true, dropShadowDistance: 1, dropShadowColor: '#000000'
		});
		this.energy_txt.x = 442;
		this.energy_txt.y = 27;

		this.energy_bar_bg = new PIXI.Graphics();
		this.energy_bar_bg.beginFill(0x111111, 0.8);
		this.energy_bar_bg.drawRect(0, 0, 240, 8);
		this.energy_bar_bg.endFill();
		this.energy_bar_bg.x = 442;
		this.energy_bar_bg.y = 50;

		this.energy_bar = new PIXI.Graphics();
		this.energy_bar.x = 442;
		this.energy_bar.y = 50;

		this.energy_timer_txt = new PIXI.Text('', {
			fontFamily: 'Arial', fontSize: 10, fill: '#aaaaaa'
		});
		this.energy_timer_txt.anchor.x = 1;
		this.energy_timer_txt.x = 682;
		this.energy_timer_txt.y = 58;

		this.up.addChild(
			this.exp_bar_bg, this.exp_bar,
			this.energy_bar_bg, this.energy_bar,
			this.nick_txt, this.level_txt,
			this.energy_txt, this.energy_timer_txt,
			this._expHit
		);

		this.nick_txt.interactive = true;
		this.nick_txt.buttonMode = true;
		this.nick_txt.on('pointerdown', ()=>this._openNickPopup());

	}

	updateNick(){
		if(!udata) return;

		// 22.09.2026 (баг найден по прямому указанию — "проблема с выводом имени, часто
		// замечаю"): раньше здесь ВСЕГДА показывалось имя ВКонтакте, игнорируя udata['nick'].
		// nick.js._saveNick() сохраняет кастомный позывной мгновенно и локально (this.nick_txt.
		// text = val), но updateNick() вызывается из modules/patch.js.applyPatch() при ПОЧТИ
		// ЛЮБОМ server-authoritative действии (убийство босса, заруба, качалка, покупки и т.д.)
		// — первое же такое действие после смены ника молча откатывало подпись обратно на имя
		// ВК. Теперь кастомный ник (если задан) имеет приоритет над именем ВК — тот же порядок
		// приоритета, что уже использует сервер для ников в топах/профилях (users.php).
		let name = 'Сталкер';
		if(window.vk_user_info && vk_user_info['first_name']){
			name = vk_user_info['first_name'];
			if(vk_user_info['last_name']) name += ' ' + vk_user_info['last_name'];
		}
		if(udata['nick']) name = udata['nick'];
		this.nick_txt.text = name;

		let exp = parseInt(udata['exp'] || 0);
		let level = Math.max(0, Math.floor((-1 + Math.sqrt(1 + exp / 5)) / 2));
		const prevLevel = parseInt(udata['level'] || 0);
		this.level_txt.text = 'УР.' + level;

		if(level > prevLevel && this._nickReady){
			setTimeout(()=>this._openLevelUpPopup(level), 500);
		}
		udata['level'] = String(level);
		this._nickReady = true;

		let exp_cur  = 20 * level * (level + 1);
		let exp_next = 20 * (level + 1) * (level + 2);
		this._expCur  = exp_cur;
		this._expNext = exp_next;
		let progress = exp_next > exp_cur ? (exp - exp_cur) / (exp_next - exp_cur) : 1;
		progress = Math.max(0, Math.min(1, progress));

		this.exp_bar.clear();
		if(progress > 0){
			this.exp_bar.beginFill(0x4caf50);
			this.exp_bar.drawRect(0, 0, Math.max(4, Math.floor(190 * progress)), 8);
			this.exp_bar.endFill();
		}
	}

	updateEnergy(){
		if(!window.TIMERS || !this.energy_txt) return;

		let cur = TIMERS.getEnergy();
		let max = TIMERS.ENERGY_MAX;
		this.energy_txt.text = cur + '/' + max;

		if(this.energy_bar){
			this.energy_bar.clear();
			let prog = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
			if(prog > 0){
				this.energy_bar.beginFill(0x7c9868);
				this.energy_bar.drawRect(0, 0, Math.max(4, Math.floor(240 * prog)), 8);
				this.energy_bar.endFill();
			}
		}

		if(cur < max){
			let sec = TIMERS.nextEnergyIn();
			let mm = String(Math.floor(sec / 60)).padStart(2, '0');
			let ss = String(sec % 60).padStart(2, '0');
			this.energy_timer_txt.text = '+1 через ' + mm + ':' + ss;
		} else {
			this.energy_timer_txt.text = '';
		}
	}

	downInit(){
		this.down.y = 596;
		root.layer1_mc.addChild(this.down);
		// Атлас уже содержит рисунки всех шести кнопок. Старый экспорт добавляет
		// поверх них ещё полноразмерные PNG; при перемещении они дают второй HUD.
		// Убираем только эти спрайты, сохраняя контейнеры с обработчиками кликов.
		const duplicateButtons = /(?:^|\/)butt_(?:bosses|zone|weapons|shmot|gangs|vassilich)\.png(?:[?#]|$)/i;
		for(const child of [...this.down.children]){
			if(!(child instanceof PIXI.Sprite) || !child.texture) continue;
			const texture = child.texture;
			const base = texture.baseTexture;
			const urls = [...(texture.textureCacheIds || []), ...((base && base.textureCacheIds) || [])];
			if(base && base.resource && base.resource.url) urls.push(base.resource.url);
			if(urls.some(url => duplicateButtons.test(String(url)))) this.down.removeChild(child);
		}

		const _hideBack = () => {
			if(this.down.butt_back){ this.down.butt_back.visible = false; this.down.butt_back.interactive = false; }
		};
		setTimeout(_hideBack, 100);
		setTimeout(_hideBack, 500);
		setTimeout(_hideBack, 1500);

		if(typeof this._buildPngSidePanels === 'function') this._buildPngSidePanels();
	}

	// Применяет верхушку стека _hudStack (последний открытый экран побеждает) — экраны сами
	// заявляют требование через pushHud()/popHud(), эта функция ничего не угадывает по
	// конкретным окнам. Пустой стек = дефолт (оба ХУДа видны) — тот же результат, что раньше
	// давала ветка "иначе" в старой цепочке проверок, просто без риска забыть новый экран.
	restoreHud(){
		const top = this._hudStack.length ? this._hudStack[this._hudStack.length - 1] : { up: true, down: true };
		// 24.09.2026 (баг найден по прямому указанию — "почему я через редактор не могу менять
		// расположение файлов в верхнем ХУДе"): раньше верхний ХУД клался прямо в root, минуя
		// layer0_mc/layer1_mc/layer2_mc — а хит-тест universal_pos_editor.js (_uFindAllAt/
		// _uCollectAt) сканирует ТОЛЬКО эти три слоя, бэрый root не проверяет вообще. Нижний
		// ХУД (this.down, ниже) всегда клался в root.layer2_mc и потому был доступен редактору —
		// верхний привели к тому же слою, для симметрии и чтобы редактор его видел.
		if(this.up) root.layer2_mc.addChild(this.up);
		if(this.down){
			if(top.down){
				this.down.visible = true;
				root.layer2_mc.addChild(this.down);
			} else {
				this.down.visible = false;
			}
		}
	}
}

attachUiKit(Interface.prototype);
attachConfirmPopup(Interface.prototype);
attachRewardPopup(Interface.prototype);
attachBossResultPopup(Interface.prototype);
attachSoundPopup(Interface.prototype);
attachNickPopup(Interface.prototype);
attachCurrencyPopup(Interface.prototype);
attachLevelUpPopup(Interface.prototype);
attachEnergyBuy(Interface.prototype);
attachZoneScreen(Interface.prototype);
attachZoneAmbient(Interface.prototype);
attachPlayerProfile(Interface.prototype);
attachSidorovich(Interface.prototype);
attachRyukzak(Interface.prototype);
attachBossesSelect(Interface.prototype);
attachBossesFight(Interface.prototype);
attachBossPreFight(Interface.prototype);
attachBossesSkills(Interface.prototype);
attachYashik(Interface.prototype);
attachInterfacePanels(Interface.prototype);
attachAchievementDesc(Interface.prototype);
attachDevPanel(Interface.prototype);
attachUniversalPosEditor(Interface.prototype);
