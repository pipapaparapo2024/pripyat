/** Ryukzak reward overlay. */
import { applyPatch } from '../../../modules/patch.js';
import REWARDS from '../../../data/ryukzak_rewards.json';
import { buildShmotTooltipCard } from '../shmot-tooltip.js';

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
	// 17.10.2026 (по прямому указанию — замена сигарет на сухари, модерация VK, заодно полная
	// переработка визуала): опциональный mockReward — для dev-кнопки "превью шмотки" (см.
	// dev_panel.js), подаёт готовый объект награды в том же формате, что и res.reward с
	// сервера (cig/c/exp/mach/pist/ak/k/key_boss), минуя ryukzak.preview — плюс необязательное
	// поле mockShmotkaName для проверки баннера "шанс на шмотку" с заполненным названием.
	proto._openRyukzakReward = function(mockReward){
		this._compassShow();
		// 17.10.2026: новые ассеты (замена сигарет на сухари) лежат в плоской './images/',
		// старые ('nagrada_ryukzak_*.png' — бирка/иконка тушёнки/прогресс-сегмент, им замена не
		// нужна) — по-прежнему в './images/layers/popups/sidorovich/', переименовывать/
		// перекладывать их не стали, чтобы не трогать работающее.
		const BASE = './images/';
		const OLD_BASE = './images/layers/popups/sidorovich/';

		const points       = parseInt(udata && udata['ryukzak_points'] ? udata['ryukzak_points'] : 0);
		const previewLevel = Math.max(1, _ryukzakLevelFromPoints(points));
		const lvIdx        = Math.max(0, Math.min(19, previewLevel - 1));
		const previewTier  = REWARDS[lvIdx];

		const win = new PIXI.Container();
		win.interactive = true;

		const blocker = new PIXI.Graphics();
		blocker.beginFill(0x000000, 0.001);
		blocker.drawRect(0, 0, 1280, 720);
		blocker.endFill();
		blocker.interactive = true;
		win.addChild(blocker);

		// Фон 900×590 (тату/шмотка-версия отключена в бете — см. старый комментарий ниже)
		// Бета: выпадение тату отключено. const hasTatu = level >= 20 && Math.random() < 0.15;
		// 18.10.2026 (по прямому указанию): файлы без отдельно продиктованных координат —
		// общий сдвиг y+40 (см. также lvlPlate/progressCont/zabratBtn/TOP_ROW/BOTTOM_ROW ниже).
		// 18.10.2026 (по прямому указанию, новый снимок редактора позиций — x:183,y:54,
		// w:900,h:590): нативный размер файла уже 900×590 (сверено), width/height явно не
		// выставляем — совпадают сами по себе.
		const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рюкзак фон награда.png'));
		bg.x = 183; bg.y = 54;
		bg.interactive = true;
		win.addChild(bg);

		// Кнопка НАЗАД — новые координаты сняты редактором позиций.
		const nazadBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рюкзак кнопка назад.png'));
		nazadBtn.x = 893; nazadBtn.y = 80;
		nazadBtn.interactive = true; nazadBtn.buttonMode = true;
		nazadBtn.on('pointerover', ()=>{ _sa(nazadBtn, 0.8); });
		nazadBtn.on('pointerout',  ()=>{ _sa(nazadBtn, 1); });
		nazadBtn.on('pointerdown', ()=>{
			win.visible = false;
			this._ryukzakWin = null;
			this.popHud('ryukzak');
		});
		win.addChild(nazadBtn);

		// 26.10.2026 (по прямому указанию — "тату пока отложили в сторону, вместо них будут
		// шмотки, перенеси шанс и логику тату на шмотки с рюкзака"): фича дропа шмотки из
		// рюкзака теперь РЕАЛЬНА (ryukzak.php.open() — grantShmotFromSource('sidorovich_bag'),
		// 15% только на уровне рюкзака 20) — баннер больше не жёстко false. Место под него
		// СНОВА ЗАРЕЗЕРВИРОВАНО ВСЕГДА (решение 17.10.2026, отменённое 18.10.2026 ровно потому,
		// что фичи тогда не было) — сам баннер просто показывает/скрывает видимость по
		// результату КОНКРЕТНОГО открытия (hasShmotNow/shmotItemNow — mutable, обновляются в
		// колбэке запроса открытия рюкзака ниже, после applyPatch реального ответа сервера).
		// mockReward.forceShmotBanner/mockShmot — только для dev-превью макета (dev_panel.js),
		// работают как стартовое значение до первого реального открытия на этом экране.
		let hasShmotNow  = !!(mockReward && mockReward.forceShmotBanner);
		let shmotItemNow = (mockReward && mockReward.mockShmot) || null;
		const shmotBanner = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рюкзак банер шанс на шмотку.png'));
		shmotBanner.x = 747; shmotBanner.y = 154; // 18.10.2026: снято редактором позиций
		shmotBanner.visible = hasShmotNow;
		win.addChild(shmotBanner);

		// 18.10.2026 (по прямому указанию — "задел на будущее": при наведении на баннер должно
		// выскакивать то же окно с описанием, что и при наведении на шмотку во вкладке
		// «Шмотки») → 26.10.2026: вместо собственной вёрстки карточки используем общий
		// компонент buildShmotTooltipCard (shmot-tooltip.js) — тот же, что уже показывает
		// попап сумки покера/кейса рулетки (dvor-poker-bag.js/popups/reward.js), не дублируем
		// разметку "Бонус:"/"Сет:" в третьем месте.
		const shmotTipCard = new PIXI.Container();
		shmotTipCard.visible = false;
		win.addChild(shmotTipCard);
		const _showShmotBannerTip = () => {
			if(!shmotItemNow) return;
			while(shmotTipCard.children.length) shmotTipCard.removeChildAt(0);
			// showRequirements:false — у баннера рюкзака нижней строки с условием получения быть
			// не должно (в отличие от попапа награды сумки/кейса, где она нужна), см. shmot-tooltip.js.
			const { card } = buildShmotTooltipCard(shmotItemNow, { showRequirements: false });
			shmotTipCard.addChild(card);
			shmotTipCard.x = shmotBanner.x + shmotBanner.width + 8;
			shmotTipCard.y = shmotBanner.y;
			shmotTipCard.visible = true;
		};
		shmotBanner.interactive = true;
		shmotBanner.on('pointerover', _showShmotBannerTip);
		shmotBanner.on('pointerout',  () => { shmotTipCard.visible = false; });

		// Декоративный уголок-ремешок — часть художественного оформления фона. 18.10.2026
		// (по прямому указанию): новые координаты + теперь добавляется ПОСЛЕ баннера "шанс на
		// шмотку" (значит рендерится НАД ним) — раньше был частью самого раннего блока и лежал
		// ПОД баннером, порядок добавления в PIXI и есть z-order.
		const cornerStrap = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рюкзак награда уголок ремешок.png'));
		cornerStrap.x = 952; cornerStrap.y = 545;
		win.addChild(cornerStrap);

		const shmotNameTxt = new PIXI.Text(
			mockReward && mockReward.mockShmotkaName ? mockReward.mockShmotkaName : (shmotItemNow ? (shmotItemNow.name || '') : ''),
			{
				fontFamily: 'Southbank LT', fontSize: 18, fill: '#d4b99c',
				dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
			}
		);
		shmotNameTxt.anchor.set(0.5, 0.5);
		// 20.10.2026 (по прямому указанию — "для текста шмотки сдвинь вправо на 3px и вверх на
		// 12px"): +144→+147, +394→+382.
		shmotNameTxt.x = shmotBanner.x + 147; shmotNameTxt.y = shmotBanner.y + 382;
		shmotNameTxt.visible = hasShmotNow;
		win.addChild(shmotNameTxt);

		// 20.10.2026 (по прямому указанию, редактор позиций — "новый хитбокс для названия
		// шмотки которая выпала" x:785,y:520,scale:1.392,w:212,h:34): раньше подсказку
		// "шанс на шмотку" (_showShmotBannerTip) можно было вызвать только наведением на
		// сам баннер (shmotBanner) — над САМИМ текстом названия (shmotNameTxt) не было
		// отдельной зоны наведения. Добавлена своя hit-зона прямо над текстом названия,
		// тот же тултип, что и у баннера.
		const shmotNameHit = new PIXI.Graphics();
		shmotNameHit.beginFill(0xffffff, 0.001);
		shmotNameHit.drawRect(-106, -17, 212, 34);
		shmotNameHit.endFill();
		shmotNameHit.x = 785; shmotNameHit.y = 520;
		shmotNameHit.interactive = true;
		shmotNameHit.on('pointerover', _showShmotBannerTip);
		shmotNameHit.on('pointerout',  () => { shmotTipCard.visible = false; });
		win.addChild(shmotNameHit);

		// --- Иконки наград — рендерятся ОДИН РАЗ, по РЕАЛЬНОЙ награде от сервера (после
		// успешного ryukzak.open), а не заранее по превью — иначе набор ненулевых иконок
		// (mach>0/pist>0/ak>0) мог бы разойтись с тем, что реально выпало по RNG сервера.
		const fmtN = (n) => n >= 10000 ? Math.round(n/1000)+'K' : n >= 1000 ? (n/1000).toFixed(1)+'K' : String(n);

		// 17.10.2026 (по прямому указанию — полная переработка грида наград, новые файлы вместо
		// старых отдельных иконок): верхний ряд — 3 ячейки, ВСЕГДА заполнены ресурсами (рубли/
		// сухари/опыт, в этом порядке). Нижний ряд — до 4 ячеек, заполняются ПО ПОРЯДКУ тем, что
		// реально выпало (оружие — мачете/макар/калаш по полям mach/pist/ak, последним — ключ
		// босса, если есть) — "фиксировать места под конкретную награду не нужно", см. промпт.
		// Координаты — продиктованы пользователем (шаг между ячейками верхнего ряда 121px,
		// нижнего — 114px). Карточки — уже готовый арт 114×147 (иконка + место под подпись
		// внизу карточки), рисуются в натуральном размере (без 0.81, как у старых иконок).
		// 18.10.2026 (по прямому указанию, общий сдвиг y+40 для файлов без отдельных координат).
		// 26.10.2026: раньше сдвигались на 140px вправо, пока фичи дропа шмотки не было (место
		// под баннер "съедалось" гридом наград) — теперь фича реальна, место снова всегда
		// зарезервировано (см. комментарий у shmotBanner выше), сдвига нет.
		const CARD_X_SHIFT = 0;
		const TOP_ROW    = [{x:334+CARD_X_SHIFT,y:203},{x:455+CARD_X_SHIFT,y:203},{x:576+CARD_X_SHIFT,y:203}];
		const BOTTOM_ROW  = [{x:288+CARD_X_SHIFT,y:345},{x:402+CARD_X_SHIFT,y:345},{x:516+CARD_X_SHIFT,y:345},{x:630+CARD_X_SHIFT,y:345}];
		// 20.10.2026 (по прямому указанию — "количество ключей не отображается и не меняется,
		// должны показываться те ключи, которые игрок выбил"): раньше карта покрывала только
		// 1-3 (Счастливчик/Ястреб/Меченный) — ryukzak.php уже поддерживает key_boss вплоть до 4
		// (Крыс, см. комментарий в ryukzak.php._rollWeapons()/open() — "1=Счастливчик,
		// 2=Ястреб, 3=Меченный, 4=Крыс"), но карты для слота 4 не было — если бы когда-нибудь
		// в ryukzak_config.json появился тир с key_boss:4, карточка ключа просто не
		// нарисовалась бы. Добавлена недостающая карта + родительный падеж для тултипа.
		const KEY_BOSS_CARD = {
			1:'рюкзак карточка счастливчик.png', 2:'рюкзак карточка ястреб.png',
			3:'рюкзак карточка меченный.png', 4:'рюкзак карточка крыс.png',
		};
		const KEY_BOSS_NAME_GEN = { 1:'Счастливчика', 2:'Ястреба', 3:'Меченного', 4:'Крыса' };

		const rewardIconsCont = new PIXI.Container();
		win.addChild(rewardIconsCont);

		// 20.10.2026 (по прямому указанию — "при наведении на ключ показывалось от кого это"):
		// одна общая тултип-карточка (тот же стиль, что у подсказки стоимости биз-улучшения в
		// zone-biz.js) переиспользуется для любой карточки ключа — позиционируется над ней при
		// наведении.
		const keyTip = new PIXI.Container();
		keyTip.visible = false;
		const keyTipBg = new PIXI.Graphics();
		keyTipBg.beginFill(0x1a1a1a, 0.92);
		keyTipBg.lineStyle(1, 0xcc7200, 1);
		keyTipBg.drawRoundedRect(0, 0, 170, 32, 6);
		keyTipBg.endFill();
		keyTip.addChild(keyTipBg);
		const keyTipTxt = new PIXI.Text('', {
			fontFamily: 'Southbank LT', fontSize: 15, fill: '#e8d8b8',
		});
		keyTipTxt.anchor.set(0.5, 0.5);
		keyTipTxt.x = 85; keyTipTxt.y = 16;
		keyTip.addChild(keyTipTxt);
		win.addChild(keyTip);

		const _addCard = (file, value, pos, tipText) => {
			const spr = new PIXI.Sprite(PIXI.Texture.from(BASE + file));
			spr.x = pos.x; spr.y = pos.y;
			rewardIconsCont.addChild(spr);
			if(tipText){
				spr.interactive = true; spr.buttonMode = true;
				spr.on('pointerover', () => {
					keyTipTxt.text = tipText;
					keyTip.x = pos.x - 10; keyTip.y = pos.y - 36;
					keyTip.visible = true;
				});
				spr.on('pointerout', () => { keyTip.visible = false; });
			}
			if(value === undefined) return;
			const lbl = new PIXI.Text(fmtN(value), {
				fontFamily: 'Southbank LT', fontSize: 22, fill: '#ffcc44',
				dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
			});
			lbl.anchor.set(0.5, 0.5);
			// 18.10.2026 (по прямому указанию — "текста кол-ва опусти вниз на 36px вместо 40px"):
			// карточки (pos.y) сдвинуты на +40 целиком (см. TOP_ROW/BOTTOM_ROW выше), подпись
			// должна отстать от них на 4px — компенсируем фиксированным -4.
			const _setLblPos = () => { lbl.x = pos.x + spr.width / 2; lbl.y = pos.y + spr.height - 20 - 4; };
			if(spr.texture.baseTexture.valid) _setLblPos();
			else spr.texture.baseTexture.once('loaded', _setLblPos);
			rewardIconsCont.addChild(lbl);
		};

		const _renderRewardIcons = (reward) => {
			rewardIconsCont.removeChildren();
			keyTip.visible = false;

			const topItems = [
				{f:'рюкзак карточка рублики.png',  v: reward.c},
				{f:'рюкзак карточка сухарики.png', v: reward.cig},
				{f:'рюкзак карточка опыт.png',     v: reward.exp},
			];
			topItems.forEach((item, i) => _addCard(item.f, item.v, TOP_ROW[i]));

			const bottomItems = [];
			if(reward.mach > 0) bottomItems.push({f:'рюкзак карточка мачете.png', v: reward.mach});
			if(reward.pist > 0) bottomItems.push({f:'рюкзак карточка макар.png',  v: reward.pist});
			if(reward.ak   > 0) bottomItems.push({f:'рюкзак карточка калаш.png',  v: reward.ak});
			const keyFile = reward.k > 0 ? KEY_BOSS_CARD[reward.key_boss] : null;
			// 20.10.2026 (по прямому указанию — "не отображается количество ключей, которые
			// выиграл игрок"): раньше value был намеренно undefined ("штучный предмет, без
			// лейбла") — теперь показывает reward.k, как и любая другая карточка награды.
			if(keyFile) bottomItems.push({
				f: keyFile, v: reward.k,
				tip: 'Ключ от ' + (KEY_BOSS_NAME_GEN[reward.key_boss] || 'босса'),
			});

			bottomItems.slice(0, 4).forEach((item, i) => _addCard(item.f, item.v, BOTTOM_ROW[i], item.tip));
			if(bottomItems.length > 4){
				console.warn('[ryukzak._renderRewardIcons] больше 4 позиций в нижнем ряду, лишние не показаны:', bottomItems.length);
			}
		};
		// 17.10.2026 (по прямому указанию — переработка грида наград): ключ босса теперь просто
		// одна из карточек нижнего ряда (см. KEY_BOSS_CARD/_renderRewardIcons выше) — отдельный
		// floating-спрайт keyIconSpr с собственным hover-тултипом ("Ключ босса «X»") убран,
		// карточка уже сама подписана именем босса в арте.
		// Грубый ориентир СРАЗУ (нет сетевой задержки) — cig/c/exp фиксированы в тарифе, оружие
		// пока показываем суммарным "w" под иконкой автомата, пока не пришёл честный ответ сервера.
		_renderRewardIcons({
			cig: previewTier.cig, c: previewTier.c, exp: previewTier.exp,
			mach: 0, pist: 0, ak: previewTier.w,
			k: previewTier.k, key_boss: previewTier.key_boss,
		});

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
				lvlTxt.text = String(res.level);
				_renderProgress(res.level);
			}, (err) => {
				console.error('[ryukzak._openRyukzakReward] ошибка честного превью, остаётся грубый ориентир:', JSON.stringify(err));
			});
		};
		// Dev-превью с mockReward не должен затираться реальным честным превью с сервера.
		if(!mockReward) _fetchHonestPreview();

		// --- Плашка и прогресс-бар уровня рюкзака ---
		const lvlPlate = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рюкзак плашка уровень рюкзака.png'));
		lvlPlate.x = 213; lvlPlate.y = 492; // 18.10.2026: общий сдвиг y+40
		win.addChild(lvlPlate);

		// Цвет/шрифт — по присланной палитре для надписи "УРОВЕНЬ РЮКЗАКА" (#d4b99c,
		// Southbank LT 30pt), текст пишется В УЖЕ ВШИТУЮ В ПЛАШКУ метку "УРОВЕНЬ РЮКЗАКА:"
		// справа от двоеточия — только число, не дублируем подпись целиком.
		// 18.10.2026 (по прямому указанию, редактор позиций — x:432,y:511,scale:0.390): заменяет
		// прежнюю формулу от lvlPlate (443,516) — абсолютные координаты, снятые пользователем.
		// fontSize пересчитан из 30×0.390 напрямую в размер шрифта (12), а не через
		// lvlTxt.scale.set() — канвас-текст, увеличенный/уменьшенный через scale после рендера,
		// пикселизуется (размывается при апскейле / теряет чёткость при даунскейле); рендерить
		// сразу в целевом fontSize — корректный способ, тот же паттерн уже используется по всему
		// проекту (см. tests/no-text-fontsize-scale-pixelation.test.js).
		// 20.10.2026 (по прямому указанию — "сдвинь вправо на 32px, опусти вниз на 12px,
		// увеличь фонт-сайз на 6px"): x 432→464, y 511→523, fontSize 12→18.
		// 20.10.2026 (повторное указание тем же днём — "опусти вниз ещё на 2px, увеличь фонт-сайз
		// ещё на 6px"): y 523→525, fontSize 18→24.
		const lvlTxt = new PIXI.Text(String(previewLevel), {
			fontFamily: 'Southbank LT', fontSize: 24, fill: '#d4b99c',
			dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 2
		});
		lvlTxt.anchor.set(0, 0.5);
		lvlTxt.x = 464; lvlTxt.y = 525;
		win.addChild(lvlTxt);

		// 8 ячеек заполнения (было 1-5 сегментов на старой плашке) — заполненных ячеек
		// пропорционально уровню 0..20 → 0..8.
		const progressCont = new PIXI.Container();
		win.addChild(progressCont);
		const _renderProgress = (level) => {
			progressCont.removeChildren();
			const filled = Math.max(0, Math.min(8, Math.round(level / 20 * 8)));
			for(let s = 0; s < filled; s++){
				const seg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рюкзак уровень ячейка заполнения.png'));
				// 20.10.2026 (по прямому указанию — "сдвинь влево на 1px, первая ячейка x:248"): 249→248.
				seg.x = 248 + s * 50; seg.y = 554; // 18.10.2026: общий сдвиг y+40
				progressCont.addChild(seg);
			}
		};
		_renderProgress(previewLevel);

		// Кнопка ЗАБРАТЬ — теперь ВСЕГДА кликабельна (сервер сам решает, хватает ли
		// тушёнки); открывает рюкзак заново при каждом клике, награда — реальная, от сервера.
		const zabratBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'рюкзак кнопка забрать.png'));
		zabratBtn.x = 460;
		zabratBtn.y = 583; // 18.10.2026: общий сдвиг y+40
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
					// 26.10.2026: см. ryukzak.php.open() — hasShmot/shmotItemId теперь реальные
					// (grantShmotFromSource('sidorovich_bag'), 15% на уровне рюкзака 20), а не
					// жёстко false. shmot._loadFromUdata() нужен ДО поиска по id — applyPatch()
					// выше уже обновил udata['shmot'], но shmot.items (owned/equipped) сам себя
					// не перечитывает.
					if(res.patch.shmot !== undefined && window.shmot && typeof shmot._loadFromUdata === 'function') shmot._loadFromUdata();
					const shmotItemId = (res.shmotItemId !== undefined && res.shmotItemId !== null) ? parseInt(res.shmotItemId) : null;
					hasShmotNow  = !!res.hasShmot && shmotItemId !== null;
					shmotItemNow = (hasShmotNow && window.shmot) ? (shmot.items || []).find(it => it.id === shmotItemId) || null : null;
					shmotBanner.visible = hasShmotNow;
					shmotNameTxt.text = shmotItemNow ? (shmotItemNow.name || '') : '';
					shmotNameTxt.visible = hasShmotNow;
					const r = res.reward;
					_renderRewardIcons(r);
					lvlTxt.text = String(r.level);
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

					// 17.10.2026 (по прямому указанию — "в сумке/рюкзаке при ЗАБРАТЬ поп-ап награды
					// не нужен"): раньше здесь показывался попап награды с onClose-колбэком —
					// теперь сам попап НЕ показывается, но весь onClose-колбэк (сброс уровня
					// рюкзака, честное превью, z-order) нужен ровно как раньше — выполняем его
					// логику напрямую и сразу, не дожидаясь клика по кнопке "ЗАБРАТЬ" внутри
					// (отсутствующего теперь) попапа.
					const _afterRewardClaimed = () => {
						// 25.09.2026 (по прямому указанию — "рюкзак после забора награды должен
						// обнулять уровень до 0, игроку необходимо заново убивать боссов и копить
						// очки"): applyPatch(res.patch) выше уже обновил udata['ryukzak_points']
						// на 0 (сервер обнулил его сразу после начисления награды, см.
						// ryukzak.php.open()). Пересчитываем превью с нуля (та же формула
						// _ryukzakLevelFromPoints, что и при первом открытии экрана), иначе цифра
						// "УРОВЕНЬ РЮКЗАКА" осталась бы залипшей на старом (уже сожранном) уровне.
						const pointsAfter = parseInt(udata && udata['ryukzak_points'] ? udata['ryukzak_points'] : 0);
						const resetLevel  = Math.max(1, _ryukzakLevelFromPoints(pointsAfter));
						console.log('[ryukzak._openRyukzakReward] попап награды подавлен (по прямому указанию), очки после сброса:', pointsAfter, '→ превью уровня:', resetLevel);
						lvlTxt.text = String(resetLevel);
						_renderProgress(resetLevel);
						// 04.10.2026 (баг найден по прямому указанию — "следующая награда визуально
						// никак не меняется"): уровень выше уже сброшен, но иконки/суммы награды на
						// экране — всё ещё от ТОЛЬКО ЧТО забранного розыгрыша. Тот же двухфазный
						// приём, что и при открытии экрана: сразу грубый локальный ориентир по
						// новому уровню (без сетевой задержки), следом честное превью с сервера.
						const resetLvIdx = Math.max(0, Math.min(19, resetLevel - 1));
						const resetTier  = REWARDS[resetLvIdx];
						_renderRewardIcons({
							cig: resetTier.cig, c: resetTier.c, exp: resetTier.exp,
							mach: 0, pist: 0, ak: resetTier.w,
							k: resetTier.k, key_boss: resetTier.key_boss,
						});
						_fetchHonestPreview();
					};
					_afterRewardClaimed();
					if(window.iface) iface.restoreHud();
					// 25.09.2026 (баг найден по прямому указанию, скриншот 10/11 — "после открытия
					// рюкзака и принятия награды ХУД появляется поверх попапа рюкзака, должно быть
					// как при обычном открытии"): iface.restoreHud() всегда делает
					// root.layer2_mc.addChild(this.up/this.down), что кладёт ХУД в КОНЕЦ списка
					// детей layer2_mc — то есть ПОВЕРХ экрана рюкзака (win), который тоже лежит в
					// layer2_mc и никуда не делся. 17.10.2026: раньше этот вызов restoreHud() был
					// внутри onClose попапа награды — попап убран (см. коммент выше), но сам баг
					// с z-order никуда не делся, так что win нужно поднять обратно поверх HUD тем
					// же приёмом (addChild на уже присоединённом объекте переносит его в конец
					// списка), что уже используется в проекте (см. universal_pos_editor.js).
					if(win.parent) root.layer2_mc.addChild(win);
					if(window.iface){ iface.updateUp(); iface.updateNick(); }
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
		// 18.10.2026 (по прямому указанию — "бирку, цифру количества тушёнки и само отображение
		// тушёнки опусти вниз на 40px, сдвинь влево на 20px"):
		const tushenkaTagSpr = new PIXI.Sprite(PIXI.Texture.from(OLD_BASE + 'nagrada_ryukzak_birka.png'));
		tushenkaTagSpr.x = 774 - 20; tushenkaTagSpr.y = 558 + 40;
		tushenkaTagSpr.scale.set(1.162);
		win.addChild(tushenkaTagSpr);

		const tushenkaIconSpr = new PIXI.Sprite(PIXI.Texture.from(OLD_BASE + 'nagrada_ryukzak_tushenka.png'));
		tushenkaIconSpr.x = 831 - 20; tushenkaIconSpr.y = 599 + 40;
		tushenkaIconSpr.scale.set(1.054);
		tushenkaIconSpr.rotation = 52 * Math.PI / 180;
		win.addChild(tushenkaIconSpr);

		const tushenkaQtyTxt = new PIXI.Text('20', {
			fontFamily: 'Southbank LT', fontSize: 32, fill: '#1a1a1a'
		});
		tushenkaQtyTxt.anchor.set(0.5, 0.5);
		tushenkaQtyTxt.x = 810 - 20; tushenkaQtyTxt.y = 594 + 40;
		tushenkaQtyTxt.rotation = 52 * Math.PI / 180;
		win.addChild(tushenkaQtyTxt);

		this.pushHud('ryukzak', {});
		root.layer2_mc.addChild(win);
		this._ryukzakWin = win;
		this._compassWaitTex(BASE + 'рюкзак фон награда.png');

		// Dev-превью (см. dev_panel.js) — сразу отрисовать переданную мок-награду, не дожидаясь
		// честного ответа сервера (которого не будет для синтетических данных).
		if(mockReward){
			_renderRewardIcons(mockReward);
			if(mockReward.level !== undefined){
				lvlTxt.text = String(mockReward.level);
				_renderProgress(mockReward.level);
			}
		}
	};
}
