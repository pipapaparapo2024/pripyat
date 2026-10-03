import { applyAudioVolumes } from '../../../modules/audio-volumes.js';
/** Sound / music settings popup. */
import { makeParallelogramHit } from './popup-hit-shapes.js';

export function attachSoundPopup(proto){
	proto._openSoundPopup = function(){
		if(this._soundWin){
			this._soundWin.visible = true;
			// 25.09.2026 (баг найден по прямому указанию — "поп-ап настроек открывается только
			// поверх главного экрана"): попап кэшируется и переиспользуется, но при первой
			// постройке добавлялся в root.layer2_mc ОДИН раз (см. ниже) и на повторных открытиях
			// оставался на том же месте в списке детей layer2_mc — если после первого открытия
			// игрок переходил на другой экран (шмотки и т.п.), тот экран добавлял свой контейнер
			// ПОЗЖЕ (выше по z-order), и кэшированный попап настроек оказывался ПОД ним.
			// addChild() на уже присоединённом объекте переносит его в конец списка детей
			// (top z-order) — тот же приём, что и у кнопки редактора позиций (см.
			// universal_pos_editor.js._ensureEditButton) — гарантирует показ поверх ЛЮБОГО
			// текущего экрана, а не только поверх главного меню.
			root.layer2_mc.addChild(this._soundWin);
			// 24.09.2026: попап переиспользуется (кэш), но «снимок на момент открытия» для
			// ОТМЕНЫ (см. коммент у win._openedSoundVol ниже) должен обновляться КАЖДЫЙ раз,
			// когда попап открывается заново — иначе после второго открытия «ОТМЕНА» откатывала
			// бы к значениям с самого первого открытия вообще, а не с текущего сеанса.
			this._soundWin._openedSoundVol = window._sndVol !== undefined ? window._sndVol : 0.7;
			this._soundWin._openedMusicVol = window._musVol !== undefined ? window._musVol : 0.5;
			return;
		}

		const win = new PIXI.Container();

		const overlay = new PIXI.Graphics();
		overlay.beginFill(0x000000, 0.55);
		overlay.drawRect(0, 0, 1280, 720);
		overlay.endFill();
		overlay.interactive = true;
		overlay.on('pointerdown', ()=>{ win.visible = false; });
		win.addChild(overlay);

		const PANEL_X = 381, PANEL_Y = 254;
		const BASE  = './images/layers/popups/sound2/';

		const panel = new PIXI.Sprite(PIXI.Texture.from(BASE + 'popup_default.png'));
		panel.x = PANEL_X; panel.y = PANEL_Y;
		panel.interactive = true;
		win.addChild(panel);

		const btnPotvActive = new PIXI.Sprite(PIXI.Texture.from(BASE + 'btn_potv_active.png'));
		btnPotvActive.x = 439; btnPotvActive.y = 379;
		btnPotvActive.visible = false;
		win.addChild(btnPotvActive);

		const btnOtmenaActive = new PIXI.Sprite(PIXI.Texture.from(BASE + 'btn_otmena_active.png'));
		btnOtmenaActive.x = 666; btnOtmenaActive.y = 384;
		btnOtmenaActive.visible = false;
		win.addChild(btnOtmenaActive);

		let soundVol = window._sndVol !== undefined ? window._sndVol : 0.7;
		let musicVol = window._musVol !== undefined ? window._musVol : 0.5;
		// 24.09.2026 (по прямому указанию — "звук/музыка должны меняться в реальном времени, а
		// не после 'применить'"): запоминаем значения НА МОМЕНТ открытия попапа — нужны, чтобы
		// «ОТМЕНА» могла реально откатить уже применённую (в реальном времени, см. setVol ниже)
		// громкость назад, а не просто закрыть попап, как было раньше (раньше это работало само
		// собой, т.к. громкость применялась только по «ПОДТВЕРДИТЬ» — теперь применяется сразу).
		// Свойство на win (не const в замыкании) — чтобы повторное открытие кэшированного попапа
		// (см. ранний return выше) тоже могло обновить снимок, не пересобирая весь попап заново.
		win._openedSoundVol = soundVol;
		win._openedMusicVol = musicVol;

		// TRK_X/TRK_W подобраны замером реального рисунка дорожки (popup_default.png) —
		// дорожка нарисована 10 "кирпичиками", и их пиксельная ширина (~328px) меньше,
		// чем было в коде раньше (368px). Из-за этого расхождения каждый шаг громкости
		// (снапится к 0.1) сдвигал бегунок на 36.8px, хотя реальный кирпичик — только
		// ~32.8px — ошибка копилась на всех 10 шагах и на максимуме бегунок вылезал
		// за пределы дорожки примерно на 30-40px.
		const TRK_X = 485, TRK_W = 355;
		const SLD1_Y = 311, SLD2_Y = 342;

		const fillGfx = new PIXI.Graphics();
		win.addChild(fillGfx);

		const snapVol = (v) => Math.round(v * 10) / 10;

		const BAR_Y_OFFSETS = [3, 8];
		const drawFills = () => {
			fillGfx.clear();
			[[soundVol, SLD1_Y], [musicVol, SLD2_Y]].forEach(([vol, y], i) => {
				const offX = TRK_X + Math.round(TRK_W * vol);
				const offW = TRK_X + TRK_W - offX;
				if(offW > 0){
					fillGfx.beginFill(0x000000, 1.0);
					fillGfx.drawRoundedRect(offX, y - 2 + BAR_Y_OFFSETS[i], offW, 12, 6);
					fillGfx.endFill();
				}
			});
		};
		drawFills();

		const handles = [SLD1_Y, SLD2_Y].map((y, idx) => {
			const h = new PIXI.Sprite(PIXI.Texture.from(BASE + 'begunok.png'));
			h.anchor.set(0.5);
			h.y = y + (idx === 0 ? 6 : 14);
			h.x = TRK_X + Math.round((idx === 0 ? soundVol : musicVol) * TRK_W);
			h.interactive = true; h.buttonMode = true;
			h.hitArea = new PIXI.Rectangle(-16, -16, 32, 32);
			return h;
		});

		const setVol = (idx, gx) => {
			let v = snapVol(Math.max(0, Math.min(1, (gx - TRK_X) / TRK_W)));
			if(idx === 0) soundVol = v; else musicVol = v;
			handles[idx].x = TRK_X + Math.round(v * TRK_W);
			drawFills();
			// Применяем СРАЗУ, пока тащим ползунок — не дожидаясь «ПОДТВЕРДИТЬ» (см. коммент у
			// openedSoundVol/openedMusicVol выше).
			window._sndVol = soundVol;
			window._musVol = musicVol;
			if(window.PIXI && PIXI.sound) applyAudioVolumes();
			// 24.09.2026 (по прямому указанию — "настройки звука не сохраняются после
			// перезагрузки"): пишем в udata (через Proxy player-save.js — обычный
			// 500мс-дебаунс автосейва подхватит и отправит на сервер), не только в чисто
			// оперативные window._sndVol/_musVol.
			if(window.udata){ udata['snd_vol'] = String(soundVol); udata['mus_vol'] = String(musicVol); }
		};

		let dragIdx = -1;
		const onDragMove = (e) => {
			if(dragIdx < 0) return;
			const canvas = document.querySelector('canvas');
			const rect = canvas ? canvas.getBoundingClientRect() : {left:0, width:1280};
			const scaleX = 1280 / rect.width;
			const gx = (e.clientX - rect.left) * scaleX;
			setVol(dragIdx, gx);
		};
		const resetDrag = () => {
			dragIdx = -1;
			document.removeEventListener('mousemove', onDragMove);
			document.removeEventListener('mouseup', resetDrag);
		};

		handles.forEach((h, idx) => {
			h.on('pointerdown', (e)=>{
				dragIdx = idx;
				document.addEventListener('mousemove', onDragMove);
				document.addEventListener('mouseup', resetDrag);
				e.stopPropagation();
			});
		});

		[SLD1_Y, SLD2_Y].forEach((y, idx) => {
			const hit = new PIXI.Graphics();
			hit.beginFill(0xffffff, 0.001);
			hit.drawRect(TRK_X, y - 14, TRK_W, 28);
			hit.endFill();
			hit.interactive = true;
			hit.on('pointerdown', (e)=>{
				setVol(idx, e.data.global.x);
				e.stopPropagation();
			});
			win.addChild(hit);
		});

		handles.forEach(h => win.addChild(h));

		const potvHit = makeParallelogramHit(win, 443, 387, 221, 40, 18);
		potvHit.on('pointerdown',    ()=>{ btnPotvActive.visible = true; });
		potvHit.on('pointerup',      ()=>{
			btnPotvActive.visible = false;
			window._sndVol = soundVol;
			window._musVol = musicVol;
			if(window.PIXI && PIXI.sound){
				applyAudioVolumes();
			}
			win.visible = false;
		});
		potvHit.on('pointerupoutside', ()=>{ btnPotvActive.visible = false; });

		const otmenaHit = makeParallelogramHit(win, 668, 387, 221, 40, 18);
		otmenaHit.on('pointerdown',    ()=>{ btnOtmenaActive.visible = true; });
		otmenaHit.on('pointerup',      ()=>{
			btnOtmenaActive.visible = false;
			// Громкость теперь применяется в реальном времени (см. setVol) — «ОТМЕНА» должна
			// реально откатить её назад к тому, что было ДО открытия попапа, а не просто закрыть
			// окно (иначе уже прозвучавшее в реальном времени изменение осталось бы в силе).
			window._sndVol = win._openedSoundVol;
			window._musVol = win._openedMusicVol;
			// Ползунки и заливка тоже должны откатиться визуально — иначе при следующем открытии
			// (кэш, early-return выше) они на мгновение показали бы уже отменённое положение.
			soundVol = win._openedSoundVol; musicVol = win._openedMusicVol;
			handles[0].x = TRK_X + Math.round(soundVol * TRK_W);
			handles[1].x = TRK_X + Math.round(musicVol * TRK_W);
			drawFills();
			if(window.PIXI && PIXI.sound) applyAudioVolumes();
			// Откат должен долететь и до сервера — иначе следующая перезагрузка вернёт то, что
			// успело прописаться в udata во время реал-тайм перетаскивания ДО отмены.
			if(window.udata){ udata['snd_vol'] = String(soundVol); udata['mus_vol'] = String(musicVol); }
			win.visible = false;
		});
		otmenaHit.on('pointerupoutside', ()=>{ btnOtmenaActive.visible = false; });

		this._soundWin = win;
		root.layer2_mc.addChild(win);
	};
}
