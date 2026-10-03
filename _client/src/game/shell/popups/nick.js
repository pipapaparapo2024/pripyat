/** Callsign (nick) change popup + DOM input overlay. */
import { makeParallelogramHit } from './popup-hit-shapes.js';

export function attachNickPopup(proto){
	// 30.09.2026 (обучение, по прямому указанию): необязательный onSaved — обучение должно
	// узнать момент реального ПОДТВЕРЖДЕНИЯ ника (не отмены), чтобы перейти к следующему шагу
	// тура. Остальные вызовы (клик по нику в HUD) не передают колбэк — поведение не меняется.
	proto._openNickPopup = function(onSaved, onCancelled){
		this._nickPopupOnSaved = onSaved || null;
		this._nickPopupOnCancelled = onCancelled || null;
		if(this._nickWin){ this._nickWin.visible = true; this._showNickInput(); return; }

		const BASE = './images/layers/popups/nick/';

		const POTV_X=443, POTV_Y=387, POTV_W=221, POTV_H=40;
		const OTMN_X=668, OTMN_Y=387, OTMN_W=221, OTMN_H=40;
		const INP_X=450,  INP_Y=274,  INP_W=420,  INP_H=80;

		const win = new PIXI.Container();

		const overlay = new PIXI.Graphics();
		overlay.beginFill(0x000000, 0.55);
		overlay.drawRect(0, 0, 1280, 720);
		overlay.endFill();
		overlay.interactive = true;
		overlay.on('pointerdown', ()=>this._closeNickPopup());
		win.addChild(overlay);

		const panel = new PIXI.Sprite(PIXI.Texture.from(BASE + 'popup_base.png'));
		panel.interactive = true;
		win.addChild(panel);

		const btnPotv = new PIXI.Sprite(PIXI.Texture.from(BASE + 'btn_potv_active.png'));
		btnPotv.visible = false;
		win.addChild(btnPotv);

		const btnOtmn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'btn_otm_active.png'));
		btnOtmn.x = OTMN_X - 10;
		btnOtmn.y = OTMN_Y - 33;
		btnOtmn.visible = false;
		win.addChild(btnOtmn);

		const potvHit = makeParallelogramHit(win, POTV_X, POTV_Y, POTV_W, POTV_H, 18);
		potvHit.on('pointerdown',     ()=>{ btnPotv.visible = true; });
		potvHit.on('pointerupoutside',()=>{ btnPotv.visible = false; });
		potvHit.on('pointerup', ()=>{
			btnPotv.visible = false;
			const val = (document.getElementById('_nick_input')?.value || '').trim();
			this._closeNickPopup(true);
			if(val){
				this._saveNick(val);
				// 30.09.2026 (обучение): только РЕАЛЬНОЕ подтверждение с непустым ником считается
				// "ник сменён" — пустая строка закрывает попап без сохранения (см. ниже), тур не
				// должен продвигаться в этом случае.
				if(this._nickPopupOnSaved){ const cb = this._nickPopupOnSaved; this._nickPopupOnSaved = null; cb(val); }
			}
		});

		const otmnHit = makeParallelogramHit(win, OTMN_X, OTMN_Y, OTMN_W, OTMN_H, 18);
		otmnHit.on('pointerdown',     ()=>{ btnOtmn.visible = true; });
		otmnHit.on('pointerupoutside',()=>{ btnOtmn.visible = false; });
		otmnHit.on('pointerup', ()=>{ btnOtmn.visible = false; this._closeNickPopup(); });

		this._nickInp = { x: INP_X, y: INP_Y, w: INP_W, h: INP_H };
		this._nickWin = win;
		root.layer2_mc.addChild(win);
		this._showNickInput();
	};

	proto._showNickInput = function(){
		let inp = document.getElementById('_nick_input');
		if(!inp){
			inp = document.createElement('input');
			inp.id = '_nick_input';
			inp.maxLength = 15;
			inp.placeholder = 'СМЕНИТЬ ПОЗЫВНОЙ';
			document.body.appendChild(inp);
		}
		const canvas = document.querySelector('canvas');
		const rect = canvas ? canvas.getBoundingClientRect() : {left:0,top:0,width:1280,height:720};
		const sx = rect.width / 1280, sy = rect.height / 720;
		const { x, y, w, h } = this._nickInp || { x:450, y:270, w:420, h:80 };
		Object.assign(inp.style, {
			position:     'fixed',
			left:         Math.round(rect.left + x * sx) + 'px',
			top:          Math.round(rect.top  + y * sy) + 'px',
			width:        Math.round(w * sx) + 'px',
			height:       Math.round(h * sy) + 'px',
			fontFamily:   'AA Bebas Neue, Arial',
			fontSize:     Math.round(28 * sy) + 'px',
			color:        '#e8c97a',
			background:   'transparent',
			border:       'none',
			outline:      'none',
			textAlign:    'center',
			letterSpacing:'3px',
			caretColor:   '#e8c97a',
			zIndex:       '9999',
			display:      'block',
		});
		inp.value = this.nick_txt ? this.nick_txt.text : '';
		inp.focus();
	};

	proto._closeNickPopup = function(saved = false){
		if(this._nickWin) this._nickWin.visible = false;
		const inp = document.getElementById('_nick_input');
		if(inp) inp.style.display = 'none';
		if(!saved && this._nickPopupOnCancelled){ const cb = this._nickPopupOnCancelled; this._nickPopupOnCancelled = null; cb(); }
	};

	proto._saveNick = function(val){
		console.log('[nick._saveNick] сохраняю ник:', val);
		if(this.nick_txt) this.nick_txt.text = val;
		udata['nick'] = val;
		if(window.api) api.setNick && api.setNick(val);
		// 18.09.2026 (баг найден: "меняю ник, а он не обновляется в топе даже после
		// перезахода") — раньше здесь НЕ было вызова users.save вообще, менялся только
		// локальный udata в браузере, ник никогда не долетал до сервера/БД. Стандартный
		// паттерн сохранения — TS.php('users.save', {udata_json: JSON.stringify(udata)}),
		// как и везде в проекте (dev_panel.js, zone.js, bosses_fight.js и т.д.).
		if(window.TS){
			TS.php('users.save', {udata_json: JSON.stringify(udata)}, (result)=>{
				console.log('[nick._saveNick] users.save OK, ответ:', JSON.stringify(result));
			}, (err)=>{
				console.error('[nick._saveNick] users.save ОШИБКА:', JSON.stringify(err));
			});
		}
	};
}
