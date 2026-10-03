/**
 * Dev-режим live-редактирования позиций шмоток на манекене (магазин шмоток).
 *
 * Позволяет тащить мышкой любую надетую вещь прямо на манекене и сразу видеть
 * итоговые manDx/manDy (те самые поля из shmot.js), которые нужно вписать в код —
 * вместо подбора офсета по скриншоту на глаз.
 *
 * Управление:
 *  - drag мышкой   — двигает текущую вещь категории
 *  - стрелки       — точная подгонка на 1px (Shift+стрелка — 10px)
 *  - «КОПИРОВАТЬ»  — копирует все manDx/manDy в буфер обмена + лог в консоль
 */
export function attachShmotPosEditor(proto){

    const CAT_NAMES = { 0:'Голова', 1:'Тело', 2:'Штаны', 3:'Обувь', 4:'Аксессуар', 6:'Рука' };

    // Для штаны_1.png в _updateManSprites() есть спец-компенсация -28px по Y (см. shmot_shop.js) —
    // при чтении/записи manDy её нужно вычитать, иначе значение задвоится при следующей отрисовке.
    const _hackY = (eq) => (eq && eq.imgFile === 'штаны_1.png') ? -28 : 0;

    proto._togglePosEditor = function(){
        this._posEditorOn = !this._posEditorOn;
        console.log('[shmot_pos_editor._togglePosEditor] режим редактора позиций:', this._posEditorOn ? 'ВКЛ' : 'ВЫКЛ');
        if(this._posEditorOn) this._enablePosEditor();
        else this._disablePosEditor();
        if(this._posEditorBtnTxt) this._posEditorBtnTxt.text = this._posEditorOn ? '🛠 РЕДАКТОР: ВКЛ' : '🛠 РЕДАКТОР';
        if(this._posCopyBtn) this._posCopyBtn.visible = this._posEditorOn;
    };

    proto._enablePosEditor = function(){
        if(!this._manSlots || !this._shopWin) return;

        if(!this._posReadout){
            const t = new PIXI.Text('', {
                fontFamily:'Arial', fontSize:12, fill:'#3af0c0', lineHeight: 16,
                dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1,
            });
            t.x = 20; t.y = 112;
            this._shopWin.addChild(t);
            this._posReadout = t;
        }
        this._posReadout.visible = true;

        // Единые move/up на весь экран (а не на каждый спрайт) — стандартный паттерн drag в PIXI,
        // иначе при быстром движении курсор уходит за пределы маленького спрайта и drag обрывается.
        this._posDrag = null;
        if(!this._posMoveHandler){
            this._posMoveHandler = (e) => {
                if(!this._posDrag) return;
                const spr = this._manSlots[this._posDrag.cat];
                if(!spr) return;
                const local = e.data.getLocalPosition(this._shopWin);
                spr.x = Math.round(this._posDrag.sprX0 + (local.x - this._posDrag.startX));
                spr.y = Math.round(this._posDrag.sprY0 + (local.y - this._posDrag.startY));
                this._updatePosReadout();
            };
            this._posUpHandler = () => { this._posDrag = null; };
            this._shopWin.on('pointermove', this._posMoveHandler);
            this._shopWin.on('pointerup', this._posUpHandler);
            this._shopWin.on('pointerupoutside', this._posUpHandler);
        }

        // ВАЖНО: интерактивность вешаем на ВСЕ слоты сразу, а не только на видимые в момент
        // включения редактора. Категория "Рука" (и любая другая) по умолчанию ничего не надела
        // (spr.visible=false) — если проверять visible здесь, слот навсегда останется некликабельным,
        // даже после того как вещь наденут прямо в этом же сеансе редактора (мачете, кукла вуду и т.п.
        // были из-за этого недвигаемы).
        Object.keys(this._manSlots).forEach(cat => {
            const c = parseInt(cat);
            const spr = this._manSlots[c];
            spr.interactive = true; spr.buttonMode = true;
            const onDown = (e) => {
                const local = e.data.getLocalPosition(this._shopWin);
                this._posDrag = { cat: c, startX: local.x, startY: local.y, sprX0: spr.x, sprY0: spr.y };
                this._posEditorSelectedCat = c;
                this._updatePosReadout();
                console.log('[shmot_pos_editor] выбрана категория', CAT_NAMES[c] || c, '— тащите мышкой или стрелками');
            };
            spr.on('pointerdown', onDown);
            spr._posEditorOnDown = onDown;
        });

        this._posKeyHandler = (e) => {
            const c = this._posEditorSelectedCat;
            if(c === undefined || c === null) return;
            const spr = this._manSlots[c];
            if(!spr) return;
            const step = e.shiftKey ? 10 : 1;
            let moved = true;
            if(e.key === 'ArrowLeft')       spr.x -= step;
            else if(e.key === 'ArrowRight') spr.x += step;
            else if(e.key === 'ArrowUp')    spr.y -= step;
            else if(e.key === 'ArrowDown')  spr.y += step;
            else moved = false;
            if(moved){ e.preventDefault(); this._updatePosReadout(); }
        };
        window.addEventListener('keydown', this._posKeyHandler);

        console.log('[shmot_pos_editor._enablePosEditor] включено — тащите мышкой шмотку на манекене, стрелки = 1px, Shift+стрелка = 10px');
        this._updatePosReadout();
    };

    proto._disablePosEditor = function(){
        Object.keys(this._manSlots || {}).forEach(cat => {
            const spr = this._manSlots[cat];
            if(spr._posEditorOnDown){ spr.off('pointerdown', spr._posEditorOnDown); delete spr._posEditorOnDown; }
            spr.interactive = false; spr.buttonMode = false;
        });
        if(this._posMoveHandler){
            this._shopWin.off('pointermove', this._posMoveHandler);
            this._shopWin.off('pointerup', this._posUpHandler);
            this._shopWin.off('pointerupoutside', this._posUpHandler);
            this._posMoveHandler = null; this._posUpHandler = null;
        }
        if(this._posKeyHandler){ window.removeEventListener('keydown', this._posKeyHandler); this._posKeyHandler = null; }
        if(this._posReadout) this._posReadout.visible = false;
        this._posDrag = null;
        console.log('[shmot_pos_editor._disablePosEditor] выключено');
    };

    // Собирает {cat, eq, dx, dy} по всем категориям с надетой вещью — общий код для
    // читаемого лога и для копирования в буфер.
    proto._collectPosEditorValues = function(){
        const out = [];
        Object.keys(this._manSlots || {}).forEach(cat => {
            const c = parseInt(cat);
            const spr  = this._manSlots[c];
            const base = this._manSlotBases && this._manSlotBases[c];
            const eq   = (this.items || []).find(it => it.cat === c && it.equipped);
            if(!eq || !base || !spr.visible) return;
            const dx = Math.round(spr.x - base.x);
            const dy = Math.round(spr.y - base.y - _hackY(eq));
            out.push({ cat: c, eq, dx, dy });
        });
        return out;
    };

    proto._updatePosReadout = function(){
        if(!this._posReadout) return;
        const lines = ['РЕДАКТОР ПОЗИЦИЙ — тащи мышкой / стрелки (Shift=10px)', ''];
        this._collectPosEditorValues().forEach(({cat, eq, dx, dy}) => {
            const mark = (cat === this._posEditorSelectedCat) ? '▶ ' : '   ';
            lines.push(mark + (CAT_NAMES[cat] || cat) + ' «' + eq.name + '» (id' + eq.id + '): manDx:' + dx + ', manDy:' + dy);
        });
        this._posReadout.text = lines.join('\n');
    };

    proto._copyPosEditorValues = function(){
        const text = this._collectPosEditorValues()
            .map(({eq, dx, dy}) => 'id' + eq.id + ' (' + eq.name + '): manDx:' + dx + ', manDy:' + dy)
            .join('\n');
        console.log('[shmot_pos_editor._copyPosEditorValues]\n' + text);
        if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(text).then(
                () => { if(window.notify) notify.showResult({text:'Координаты скопированы в буфер'}, 1); },
                (e) => console.error('[shmot_pos_editor._copyPosEditorValues] буфер обмена недоступен:', e)
            );
        }
    };
}
