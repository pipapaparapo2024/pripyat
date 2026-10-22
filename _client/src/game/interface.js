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
import { attachTopCurrency } from './interface/interface-top-currency.js';
import { attachCurrencyPurchase } from './interface/interface-currency-purchase.js';
import { attachBottomNav } from './interface/interface-bottom-nav.js';
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

	// 18.10.2026 (найдено по снимку редактора позиций — два элемента "interface_elements_atlas_1.png"
	// без имени, x:-33 y:-199 w:1280 h:158 и x:1 y:157 w:1306 h:73, пользователь: "удали"): FLA-
	// экспорт `up_panel`/`down_panel` кладёт на таймлайн не только именованные instance (val_stew,
	// butt_bosses и т.д.), но и фоновую графику БЕЗ instance name — такой child недоступен по
	// имени из JS вообще, только обходом `children[]` (видно по снимку: `_uFileLabel()` в
	// universal_pos_editor.js смог достать только сырой URL общего атласа, не осмысленное имя
	// файла — только НАЗВАННЫЕ объекты получают распознаваемый textureCacheIds/filename, см.
	// duplicateButtons чуть ниже для сравнения). Матчим по РАЗМЕРУ (в снимке scale:1.000, значит
	// w/h — нативный кадр текстуры в атласе, стабильный идентификатор), не по имени — имени нет.
	// 18.10.2026 (баг найден по прямому указанию — "серый прямоугольник снизу остался, нижний
	// худ старый ещё в проекте?"): первая версия этого метода обходила только ПРЯМЫХ детей
	// container.children — для именованных дублей-кнопок (duplicateButtons в downInit()) этого
	// достаточно, они лежат плоско. Но реальные имена двух "лишних" спрайтов — прочитаны прямо
	// из _client/development/images/interface_elements_atlas_1.json (frames{}) —
	// `interface_up_panel_bg` (1306×73) и `interface_down_panel_bg` (1280×158): это ФОНОВЫЕ
	// подложки старых панелей целиком, которые PIXI.animate оборачивает в собственный
	// MovieClip-контейнер (не голый Sprite на уровне this.up/this.down), значит вложены ещё на
	// уровень глубже — плоский проход их не видел и не находил, отсюда и жалоба "фикс не
	// помог". Теперь обход РЕКУРСИВНЫЙ (тот же принцип, что уже использует _uCollectAt() в
	// universal_pos_editor.js — он-то эти спрайты и находил по клику/наведению, значит обход
	// обязан идти вглубь), удаление — у РЕАЛЬНОГО родителя найденного спрайта (child.parent),
	// не у верхнего container, если спрайт был вложен не на первом уровне.
	_removeStrayAtlasArt(container){
		if(!container) return;
		const STRAY_SIZES = [
			{ w: 1280, h: 158 }, // interface_down_panel_bg — старая подложка нижней панели
			{ w: 1306, h: 73 },  // interface_up_panel_bg — старая подложка верхней панели
			// 18.10.2026 (по прямому указанию, новый снимок редактора позиций — "x:16 y:132
			// w:69 h:69, убери, не нужен"): третий безымянный декоративный остаток того же
			// FLA-экспорта (не одна из двух уже известных фоновых подложек выше).
			{ w: 69, h: 69 },
		];
		const _walk = (node) => {
			if(!node || !node.children) return;
			for(const child of [...node.children]){
				if(child instanceof PIXI.Sprite && child.texture){
					const base = child.texture.baseTexture;
					const url = (base && base.resource && base.resource.url) || '';
					if(/interface_elements_atlas_1\.png(?:[?#]|$)/i.test(url)){
						const w = Math.round(child.width), h = Math.round(child.height);
						if(STRAY_SIZES.some(s => s.w === w && s.h === h)){
							if(child.parent) child.parent.removeChild(child);
							continue; // удалённый узел не обходим дальше
						}
					}
				}
				_walk(child);
			}
		};
		_walk(container);
	}

	init(){
		this.upInit();
		this.downInit();
		this._buildBottomNav();
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
					// 17.10.2026 (по прямому указанию, редактор позиций — "иконка игрока в верхнем
					// попапе" x:4,y:2,scale:0.509,w:55,h:55): было S=69,x=-4,y=-5.
					// 17.10.2026 (повторное указание тем же днём — "сделай его 52 на 52
					// пикселя"): 55 → 52, x/y не менялись.
					// 17.10.2026 (ещё раз тем же днём, редактор позиций — "x:6,y:4,scale:0.481,
					// w:52,h:52"): x 4→6, y 2→4; w/h уже были верными (52).
					// 20.10.2026 (редактор позиций — "x:0,y:0,scale:0.556,w:60,h:60"): S 52→60,
					// x/y 6/4→0/0.
					// 20.10.2026 (ещё раз тем же днём, редактор позиций — "x:-6,y:-8,scale:0.694,
					// w:75,h:75"): S 60→75, x/y 0/0→-6/-8.
					const S = 75, AX = -6, AY = -8;
					bm.width = S; bm.height = S;
					bm.x = AX; bm.y = AY;
					// 18.10.2026 (баг найден по скрину — "иконка обрезается очень некорректно",
					// квадратное фото торчало углами за пределы круглой рамки портала): фото
					// раньше вставлялось без маски — добавлена круглая маска по размеру аватара.
					// 19.10.2026 (по прямому указанию — "убери эту маску под фото, она там не
					// нужна"): маска радиусом S/2=26px оказалась СИЛЬНО меньше декоративного
					// кольца "кольцо верхний худ.png" (его реальный файл 110×108px, выводится БЕЗ
					// scale — см. this._avatarRing ниже), из-за чего видимый кружок фото выглядел
					// крошечным внутри гораздо большей рамки. Убрана целиком — фото показывается
					// как есть (52×52), ограничивающей маски больше нет.
					this.up.ava.icon_mc.addChild(bm);

					// 18.10.2026 (по прямому указанию — новый файл "кольцо верхний худ.png",
					// накладывается ПОВЕРХ иконки игрока, та — поверх верхнего HUD): добавляется
					// один раз (не на каждую перезагрузку фото), т.к. не зависит от bm/avaMask.
					// 20.10.2026 (по прямому указанию — "выводи в натуральном размере, поверх
					// верхнего попапа, координаты по нулям, левый верхний угол"): раньше был
					// child'ом icon_mc (внутри up.ava) с anchor(0.5,0.5) и позицией по центру
					// аватара — наследовал scale up.ava (1.333), эффективный размер на экране
					// съезжал от нативного 110×108. Теперь — независимый child самого `this.up`
					// (не icon_mc/up.ava), anchor по умолчанию (0,0), x=0,y=0 — занимает левый
					// верхний угол HUD нативным размером файла. addChild на `up` добавляет
					// ПОСЛЕДНИМ ребёнком (топ z-order) — к моменту срабатывания этого колбэка
					// (асинхронная загрузка фото) _buildTopCurrencyWidget() уже построил все
					// плашки/кнопки виджета синхронно внутри upInit(), поэтому кольцо гарантированно
					// рендерится поверх них всех.
					if(!this._avatarRing){
						const ring = new PIXI.Sprite(PIXI.Texture.from('./images/кольцо верхний худ.png'));
						ring.x = 0; ring.y = 0;
						this.up.addChild(ring);
						this._avatarRing = ring;
					}
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

		// 18.10.2026 (найдено по живому репорту + снимку редактора позиций — "два элемента
		// interface_elements_atlas_1.png, один висит сверху (нога), удали"): помимо именованных
		// val_stew/val_coins/val_cigarettes, FLA-экспорт `up_panel` кладёт на таймлайн ещё и
		// БЕЗЫМЯННУЮ декоративную графику (без instance name в Animate — такой child недоступен
		// по имени из JS, только обходом children[]) — по тому же принципу, что уже починено для
		// нижней панели ниже (см. duplicateButtons в downInit(), тот же старый экспорт дублирует
		// готовые PNG поверх атласа). Раньше это не мешало — старые val_* перекрывали её ровно в
		// нужном месте; после замены на новый JS-виджет (см. ниже) она ничем не прикрыта.
		// У обеих найденных по снимку фигур нет собственного cache-id/имени — только сырой URL
		// общего атласа, поэтому матчим по РАЗМЕРУ (scale:1.000 в снимке ⇒ w/h = нативный кадр
		// текстуры), а не по строке имени, как у именованных дублей ниже.
		this._removeStrayAtlasArt(this.up);

		// 17.10.2026 (по прямому указанию — сигареты заменены на сухари, модерация VK): новый
		// блок валют (рубли/тушёнка/сухари с аккордеоном) строится поверх старого FLA-объекта,
		// см. interface/interface-top-currency.js — старые val_* выше прячутся внутри этого
		// метода, не трогаем вручную здесь.
		this._buildTopCurrencyWidget();

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
		// Старые FLA-объекты скрыты (см. _buildTopCurrencyWidget), но текст в них всё равно
		// обновляем — дешёво, и подстраховка на случай, если виджет ещё не успел построиться.
		this.up.val_stew.tf_txt.text        = fmt(udata['stew']);
		this.up.val_coins.tf_txt.text       = fmt(udata['coins']);
		this.up.val_cigarettes.tf_txt.text  = fmt(udata['cigarettes']);
		this._updateTopCurrency();
	}

	initNickLabel(){
		// 18.10.2026 (по прямому указанию — прислан реальный .ttf): верхний худ (ник/уровень/
		// энергия) переключён на "Bebas Neue Pro Middle" (см. fonts/fonts.css) — до этого в
		// проекте физически не было нужного начертания, использовалось ближайшее 'AA Bebas Neue'.
		// 18.10.2026 (повторное указание тем же днём — "font size и цвет шрифта у никнейма,
		// энергии и уровня сделай такое же, как количество рублей/тушенки/сухариков"): размер
		// и цвет теперь те же, что TXT_STYLE в interface-top-currency.js (28pt, #d6d5d5) —
		// fontFamily уже совпадал с прошлой правки (Bebas Neue Pro Middle), dropShadow оставлен
		// как было (в задаче явно требовались только шрифт/цвет/размер, не отказ от тени).
		// 20.10.2026 (по прямому указанию, снимок панели "Символ" Photoshop + палитра цвета
		// текста — шрифт Southbank LT Regular, цвет #cec1b8): никнейм и уровень переведены со
		// шрифта верхнего худа (Bebas Neue Pro Middle/#d6d5d5) на этот — и подняты вверх на 3px.
		this.nick_txt = new PIXI.Text('Сталкер', {
			fontFamily: 'Southbank LT', fontSize: 28, fill: '#cec1b8',
			dropShadow: true, dropShadowDistance: 1, dropShadowColor: '#000000'
		});
		// 18.10.2026 (повторное указание, новые координаты со снимка редактора позиций):
		// уровень по-прежнему пишется просто цифрой (без префикса "УР.").
		// 18.10.2026 (по прямому указанию — "хитбокс для никнейма x:146,y:19,w:152,h:42,
		// никнейм центрируется по горизонтали в этом хитбоксе"): ник теперь якорится по
		// центру (anchor.x=0.5) и ставится в середину хитбокса — длина текста (разная у
		// разных игроков) больше не сдвигает видимый центр подписи вправо/влево.
		this.nick_txt.anchor.x = 0.5;
		this.nick_txt.x = 146 + 152 / 2;
		// 20.10.2026 (по прямому указанию — "никнейм и уровень подними вверх на 3px"): 27→24.
		this.nick_txt.y = 24;

		const nickHit = new PIXI.Graphics();
		nickHit.beginFill(0xffffff, 0.001);
		nickHit.drawRect(0, 0, 152, 42);
		nickHit.endFill();
		// 18.10.2026 (по прямому указанию — "хитбокс для никнейма подними вверх на 1 пиксель"): -1.
		nickHit.x = 146; nickHit.y = 19 - 1;
		nickHit.interactive = true;
		nickHit.buttonMode = true;
		if(window.isMobile) helper.touchPad(nickHit);
		nickHit.on('pointerdown', ()=>this._openNickPopup());
		this._nickHit = nickHit;

		// 20.10.2026 (по прямому указанию — тот же шрифт/цвет, что и никнейм; см. коммент выше).
		this.level_txt = new PIXI.Text('1', {
			fontFamily: 'Southbank LT', fontSize: 28, fill: '#cec1b8'
		});
		this.level_txt.x = 396;
		// 20.10.2026 (по прямому указанию — "никнейм и уровень подними вверх на 3px"): 38→35.
		this.level_txt.y = 35;

		this.exp_bar_bg = new PIXI.Graphics();
		this.exp_bar_bg.beginFill(0x111111, 0.8);
		this.exp_bar_bg.drawRect(0, 0, 190, 8);
		this.exp_bar_bg.endFill();
		this.exp_bar_bg.x = 90;
		this.exp_bar_bg.y = 50;

		this.exp_bar = new PIXI.Graphics();
		this.exp_bar.x = 90;
		this.exp_bar.y = 50;

		// 18.10.2026 (по прямому указанию — "при наведении на шкалу уровня трек должен
		// показываться тултип опыта, сейчас какой-то хитбокс стоит, не нужен для этого"):
		// хитбокс тултипа существовал и раньше (ниже, та же логика), но был подогнан под
		// старую плоскую Graphics-полоску уровня (190×20) — реальный спрайт трека
		// (lvl_bar_track, см. выше x:95,y:55,w:261,h:29) шире и выше, часть трека оставалась
		// "мёртвой" зоной без тултипа. Хитбокс теперь занимает ровно область спрайта трека.
		const expHit = new PIXI.Graphics();
		expHit.beginFill(0xffffff, 0.001);
		expHit.drawRect(0, 0, 261, 29);
		expHit.endFill();
		// 18.10.2026 (по прямому указанию — "хитбокс для уровня сдвинь влево на 3 пикселя"): -3.
		expHit.x = 95 - 3; expHit.y = 55;
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

		// 18.10.2026: размер/цвет — те же, что у текстов валют (см. коммент у nick_txt выше).
		// 22.10.2026 (по прямому указанию — "в референсе шрифт выглядит жирнее, чем Regular"):
		// в проекте есть только один файл семейства Bebas Neue Pro Middle (Regular начертание,
		// см. fonts.css) — отдельного Bold-файла нет, поэтому жирность — синтетическая
		// (fontWeight:'bold' поверх Regular-файла, браузер/canvas утолщает буквы программно).
		// Та же правка — у текстов валют верхнего худа, см. interface-top-currency.js.
		this.energy_txt = new PIXI.Text('150/150', {
			fontFamily: 'Bebas Neue Pro Middle', fontSize: 28, fontWeight: 'bold', fill: '#d6d5d5',
			dropShadow: true, dropShadowDistance: 1, dropShadowColor: '#000000'
		});
		// 20.10.2026 (по прямому указанию — "кол-во энергии у игрока подними вверх на 7px"): y 17→10.
		// 20.10.2026 (повторное указание тем же днём, редактор позиций — "x:541,y:13"): y 10→13.
		this.energy_txt.x = 541;
		this.energy_txt.y = 13;
		// 18.10.2026 (по прямому указанию — "попап покупки энергии открывать по нажатию на
		// количество энергии", заодно butt_energy_buy.png убран целиком — см. energy_buy.js):
		// сам текст "20/130" теперь кликабелен.
		this.energy_txt.interactive = true; this.energy_txt.buttonMode = true;
		if(window.isMobile) helper.touchPad(this.energy_txt);
		this.energy_txt.on('pointerdown', () => this._openEnergyPopup());

		this.energy_bar_bg = new PIXI.Graphics();
		this.energy_bar_bg.beginFill(0x111111, 0.8);
		this.energy_bar_bg.drawRect(0, 0, 240, 8);
		this.energy_bar_bg.endFill();
		this.energy_bar_bg.x = 442;
		this.energy_bar_bg.y = 50;

		this.energy_bar = new PIXI.Graphics();
		this.energy_bar.x = 442;
		this.energy_bar.y = 50;

		// 17.10.2026 (по прямому указанию — замена сигарет на сухари, заодно новый визуал шкал):
		// текстурные трек+заливка поверх старых плоских Graphics-полосок (exp_bar/energy_bar
		// выше остаются для расчёта прогресса и скрытого hit-теста тултипа — просто visible=false).
		// Y трека энергии продиктован как 308 — не сходится ни с заливкой (44), ни с остальным
		// рядом (везде ~50); беру 44, как у заливки, чтобы шкала не улетела в середину экрана —
		// при визуальной сверке на тесте поправим через редактор позиций, если понадобится.
		this.exp_bar_bg.visible = false;
		this.exp_bar.visible = false;
		this.energy_bar_bg.visible = false;
		this.energy_bar.visible = false;

		this.lvl_bar_track = new PIXI.Sprite(PIXI.Texture.from('./images/верхний худ шкала уровня трек.png'));
		this.lvl_bar_track.x = 95; this.lvl_bar_track.y = 55;

		this.lvl_bar_fill = new PIXI.Sprite(PIXI.Texture.from('./images/верхний худ шкала уровня заливка.png'));
		this.lvl_bar_fill.x = 103; this.lvl_bar_fill.y = 62;
		this._lvlBarFillMaxW = this.lvl_bar_fill.texture.width;

		this.nrg_bar_track = new PIXI.Sprite(PIXI.Texture.from('./images/верхний худ шкала энергии трек.png'));
		// 20.10.2026 (по прямому указанию, редактор позиций — "x:489,y:37"): было 489,44.
		this.nrg_bar_track.x = 489; this.nrg_bar_track.y = 37;

		this.nrg_bar_fill = new PIXI.Sprite(PIXI.Texture.from('./images/верхний худ шкала энергии заливка.png'));
		// 20.10.2026 (по прямому указанию, редактор позиций — "x:495,y:42"): было 495,49.
		this.nrg_bar_fill.x = 495; this.nrg_bar_fill.y = 42;
		this._nrgBarFillMaxW = this.nrg_bar_fill.texture.width;

		this.energy_timer_txt = new PIXI.Text('', {
			fontFamily: 'Arial', fontSize: 10, fill: '#aaaaaa'
		});
		this.energy_timer_txt.anchor.x = 1;
		// 18.10.2026 (по прямому указанию, редактор позиций — x:665,y:63): было 682,58.
		this.energy_timer_txt.x = 665;
		this.energy_timer_txt.y = 63;

		this.up.addChild(
			this.exp_bar_bg, this.exp_bar,
			this.energy_bar_bg, this.energy_bar,
			this.lvl_bar_track, this.lvl_bar_fill,
			this.nrg_bar_track, this.nrg_bar_fill,
			this.nick_txt, this.level_txt,
			this.energy_txt, this.energy_timer_txt,
			this._expHit, this._nickHit
		);

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
		this.level_txt.text = String(level); // 18.10.2026: просто цифрой, без префикса "УР."

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

		if(this.lvl_bar_fill){
			this.lvl_bar_fill.width = Math.max(0, Math.floor(this._lvlBarFillMaxW * progress));
			this.lvl_bar_fill.visible = progress > 0;
		}
	}

	updateEnergy(){
		if(!window.TIMERS || !this.energy_txt) return;

		let cur = TIMERS.getEnergy();
		let max = TIMERS.ENERGY_MAX;
		this.energy_txt.text = cur + '/' + max;

		let prog = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
		if(this.energy_bar){
			this.energy_bar.clear();
			if(prog > 0){
				this.energy_bar.beginFill(0x7c9868);
				this.energy_bar.drawRect(0, 0, Math.max(4, Math.floor(240 * prog)), 8);
				this.energy_bar.endFill();
			}
		}
		if(this.nrg_bar_fill){
			this.nrg_bar_fill.width = Math.max(0, Math.floor(this._nrgBarFillMaxW * prog));
			this.nrg_bar_fill.visible = prog > 0;
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
		// 18.10.2026 — тот же старый экспорт оставляет на `down_panel` ещё и безымянную
		// декоративную графику без instance name (см. комментарий у вызова этого же хелпера для
		// `this.up` в upInit() — там же объяснение, почему матчим по размеру, а не по имени).
		this._removeStrayAtlasArt(this.down);

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
attachTopCurrency(Interface.prototype);
attachCurrencyPurchase(Interface.prototype);
attachBottomNav(Interface.prototype);
attachAchievementDesc(Interface.prototype);
attachDevPanel(Interface.prototype);
attachUniversalPosEditor(Interface.prototype);
