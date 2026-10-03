/** Промежуточный экран: задний фон боевка.png + иконка босса + режимы + кнопка НАПАСТЬ. */
import { BOSS_SHMOT_REWARD_IMAGE, BOSS_SHMOT_NOT_OBTAINED } from '../../../modules/boss-shmot-images.js';

export function attachBossPreFight(proto){

    const BOSS_ICON = ['охотник','счастливчик','ястреб','меченный','крыс','баркут','борода','жгут'];

    // 26.09.2026: позиции сняты редактором точечно на новом фоне ("задний фон боевка.png") —
    // больше не единая формула 645+m*155, у каждой кнопки свой x/y (мелкая ручная поправка).
    const MODES_CFG = [
        { file:'боевка режим обычный.png',      di:0, active:true,  x:637,  y:224 },
        { file:'боевка режим опасный стоп.png', di:1, active:false, x:786,  y:227 },
        { file:'боевка режим суровый стоп.png', di:2, active:false, x:931,  y:226 },
        { file:'боевка режим соло.png',         di:3, active:true,  x:1081, y:225 },
    ];

    proto._openBossPreFight = function(bossIdx){
        this._closeBossPreFight();
        const B = './images/';
        const win = new PIXI.Container();
        win.interactive = true;

        // Blocker
        const bl = new PIXI.Graphics();
        bl.beginFill(0x000000, 0.001); bl.drawRect(0,0,1280,720); bl.endFill();
        bl.interactive = true;
        win.addChild(bl);

        // Фон — 26.09.2026 (по прямому указанию): заменён на новый файл с выделенной зоной
        // "ВОЗМОЖНАЯ НАГРАДА" (карусель шмоток ниже), вместо старого "боевка страница.png".
        const bg = new PIXI.Sprite(PIXI.Texture.from(B + 'задний фон боевка.png'));
        bg.width = 1280; bg.height = 720;
        win.addChild(bg);

        // HP текст на красной полоске
        const _fmtHp = hp => hp >= 1000000 ? (hp/1000000).toFixed(1)+'М' : hp >= 1000 ? Math.floor(hp/1000)+'К' : String(hp);
        const _getHpTxt = (diff) => (window.bosses && bosses.BOSS_HP && bosses.BOSS_HP[bossIdx])
            ? _fmtHp(bosses.BOSS_HP[bossIdx][diff]) + ' HP'
            : '— HP';
        // 26.09.2026 (по прямому указанию, палитра цветов Photoshop #cbc9c9 — "весь текст в
        // выборе режима битвы с боссом сделай цвета как на 2 картинке"): весь текст на этом
        // экране, лежащий прямо на фоне (не карточка-тултип шмотки — у неё свой стиль,
        // повторяющий магазин шмоток), переведён с белого/золотого на #cbc9c9.
        const xpTxt = new PIXI.Text(
            _getHpTxt(0),
            { fontFamily:'Southbank LT', fontSize:22, fill:'#cbc9c9',
              fontWeight:'bold', dropShadow:true, dropShadowColor:'#000', dropShadowDistance:2 }
        );
        xpTxt.anchor.set(0.5, 0.5); xpTxt.x = 866; xpTxt.y = 175;
        xpTxt.scale.set(1.240);
        win.addChild(xpTxt);

        // Кнопка выход
        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/layers/popups/bosses/exit.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn); // 27.09.2026: зона нажатия под палец, см. universal_helper.touchPad
        exitBtn.x = 1197; exitBtn.y = 82;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', ()=>{ _sa(exitBtn, 0.75); exitBtn.scale.set(0.54); });
        exitBtn.on('pointerout', ()=>{ _sa(exitBtn, 1); exitBtn.scale.set(0.5); });
        exitBtn.on('pointerdown', ()=>this._closeBossPreFight());
        win.addChild(exitBtn);

        // Иконка босса (левая часть) — позиция снята через редактор, единая для всех боссов
        const icon = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка иконка ' + BOSS_ICON[bossIdx] + '.png'));
        icon.x = 116; icon.y = 154; icon.scale.set(0.937);
        win.addChild(icon);

        // Режимы
        let selectedDiff = 0;
        const modeSps = [];

        for(let m = 0; m < 4; m++){
            const cfg = MODES_CFG[m];
            const ms = new PIXI.Sprite(PIXI.Texture.from(B + cfg.file));
            ms.anchor.set(0.5, 0);
            ms.x = cfg.x; ms.y = cfg.y;
            ms.alpha = (m === 0) ? 1 : (cfg.active ? 0.6 : 0.45);
            if(cfg.active){
                ms.interactive = true; ms.buttonMode = true;
                const di = cfg.di; const mi = m;
                ms.on('pointerdown', ()=>{
                    selectedDiff = di;
                    xpTxt.text = _getHpTxt(selectedDiff);
                    modeSps.forEach((s, si)=>{
                        s.alpha = MODES_CFG[si].active ? (si === mi ? 1 : 0.6) : 0.45;
                    });
                    // 26.09.2026: смена режима меняет пул возможных дропов (обычный/соло) —
                    // карусель "ВОЗМОЖНАЯ НАГРАДА" сбрасывается на первый предмет нового пула,
                    // не остаётся на индексе, который мог не существовать в другом пуле.
                    shmotCarouselIdx = 0;
                    _renderShmotCarousel();
                });
            }
            win.addChild(ms);
            modeSps.push(ms);
        }

        // Иконки ВОЗМОЖНАЯ НАГРАДА (сиги + опыт + ключи)
        const BOSS_NAMES = ['охотник','счастливчик','ястреб','меченный','крыс','баркут','борода','жгут'];
        const bData      = window.bosses ? bosses.data[bossIdx] : null;
        const givesKeys  = bData ? (bData.gives_keys || []) : [];
        const _fmtN = n => n >= 1000000 ? (n/1000000).toFixed(1)+'М' : n >= 1000 ? Math.round(n/1000)+'К' : String(n);

        // Очки рюкзака за убийство — RYUKZAK_PTS в bosses-combat.js._onDefeat (по индексу
        // босса, 0=Охотник..7=Жгут), новая иконка "очки рюкзака.png" (16.09.2026).
        const RYUKZAK_PTS = [5, 10, 20, 35, 60, 90, 110, 150];

        // Персональный пул возможных дропов шмоток этого босса — зеркало
        // server/json/bosses_config.json (boss_shmot_drop_pool, см. bosses.php.claimKill()) —
        // сервер остаётся источником истины для самого дропа (RNG на сервере), здесь только
        // копия id для карусели "ВОЗМОЖНАЯ НАГРАДА" ниже.
        const BOSS_SHMOT_DROP_POOL = {
            0:{normal:[41],        solo:[44]}, 1:{normal:[42],        solo:[45]},
            2:{normal:[43],        solo:[46]}, 3:{normal:[47,48,73],  solo:[49]},
            4:{normal:[50,51,52],  solo:[53]}, 5:{normal:[54,55,74,56], solo:[57]},
            6:{normal:[96,75,76,77], solo:[58]}, 7:{normal:[59,60],   solo:[61]},
        };

        // 26.09.2026 (повторный замер редактором позиций — точные координаты по каждой
        // иконке отдельно вместо формулы центрирования). Сиги/опыт/рюкзак — всегда одни и те
        // же 3 файла с фиксированным нативным размером, поэтому им положен фиксированный
        // scale. Иконки ключей (7 файлов "ключ *.png") все одного размера (проверено), значит
        // один и тот же REWARD_KEY_SCALE подходит для любого ключа, не только "счастливчик" —
        // тот, что был на экране во время замера. Второй ключ (у Баркута gives_keys:[5,6]) идёт
        // тем же шагом REWARD_KEY_STEP_X правее первого — отдельно не замерялся, но шаг взят из
        // разницы между рюкзаком и первым ключом (791→872).
        //
        // 27.09.2026 (адаптив под мобильные, экономия памяти): нативный размер файлов ключей
        // уменьшен 1086×1448 → 272×362 (ровно ÷4), чтобы в память не грузилось в 16 раз больше
        // пикселей, чем рисуется (7 файлов = 42 МБ распакованного RGBA на мобильном устройстве).
        // Оригиналы лежат в _originals_before_downscale_27_09_2026/.
        // 28.09.2026 (повторный замер редактором позиций — ключ решили сделать чуть крупнее,
        // 65×87 → 71×94): REWARD_KEY_SCALE пересчитан под УЖЕ уменьшенный файл (272×362), не
        // под оригинал — 272×0.26 = 70.7 ≈ 71, 362×0.26 = 94.1 ≈ 94. ВАЖНО: если файлы ключей
        // когда-нибудь перезалить оригинальными (крупными, 1086×1448) — scale надо пересчитать
        // заново (тогда это будет 0.26/4 ≈ 0.065), а не оставлять как есть.
        const REWARD_SIGI_POS    = { x: 617, y: 520, scale: 0.800 };
        const REWARD_EXP_POS     = { x: 697, y: 521, scale: 0.810 };
        const REWARD_RYUKZAK_POS = { x: 791, y: 521, scale: 0.897 };
        const REWARD_KEY_SCALE   = 0.260;
        const REWARD_KEY_START_X = 872;
        const REWARD_KEY_STEP_X  = 81;
        const REWARD_KEY_Y       = 521;

        const rewardItems = [
            { url: B+'боевка награда Сиги.png', pos: REWARD_SIGI_POS, tip: ()=>{ const m=window.bosses?bosses.DIFF_MULT[selectedDiff].cig:1; return _fmtN(Math.floor((bData?bData.reward.cig:0)*m))+' сигарет'; } },
            { url: B+'опыт эмблема.png', pos: REWARD_EXP_POS, tip: ()=>{ const m=window.bosses?bosses.DIFF_MULT[selectedDiff].exp:1; return _fmtN(Math.floor((bData?bData.reward.exp:0)*m))+' опыта'; } },
            { url: B+'очки рюкзака.png', pos: REWARD_RYUKZAK_POS, tip: ()=>(RYUKZAK_PTS[bossIdx]||0)+' очков рюкзака' },
            ...givesKeys.map((ki, ki_i) => ({
                url: B+'ключ '+(BOSS_NAMES[ki]||'')+'.png',
                pos: { x: REWARD_KEY_START_X + ki_i * REWARD_KEY_STEP_X, y: REWARD_KEY_Y, scale: REWARD_KEY_SCALE },
                tip: () => ki === 5 ? 'Ключ Баркут / Борода' : ('Ключ ' + (window.bosses&&bosses.data[ki]?bosses.data[ki].name:BOSS_NAMES[ki]||'')),
            })),
        ];

        const tipTxt = new PIXI.Text('', {
            fontFamily:'Southbank LT', fontSize:18, fill:'#cbc9c9',
            dropShadow:true, dropShadowColor:'#000', dropShadowDistance:1
        });
        tipTxt.anchor.set(0.5, 1);
        tipTxt.visible = false;
        const tipBg = new PIXI.Graphics();
        tipBg.visible = false;

        const _showTip = (spr, getText) => {
            tipTxt.text = getText();
            tipTxt.x = spr.x;
            tipTxt.y = spr.y - spr.height/2 - 8;
            tipBg.clear();
            tipBg.beginFill(0x000000, 0.72);
            const pad = 7;
            tipBg.drawRoundedRect(tipTxt.x - tipTxt.width/2 - pad, tipTxt.y - tipTxt.height - pad, tipTxt.width + pad*2, tipTxt.height + pad*2, 4);
            tipBg.endFill();
            tipBg.visible = true;
            tipTxt.visible = true;
        };
        const _hideTip = () => { tipTxt.visible=false; tipBg.visible=false; };

        rewardItems.forEach(item => {
            const tex = PIXI.Texture.from(item.url);
            const spr = new PIXI.Sprite(tex);
            spr.anchor.set(0.5, 0.5);
            spr.x = item.pos.x; spr.y = item.pos.y;
            spr.scale.set(item.pos.scale);
            spr.interactive = true;
            spr.on('pointerover', ()=>_showTip(spr, item.tip));
            spr.on('pointerout',  _hideTip);
            win.addChild(spr);
        });
        win.addChild(tipBg);
        win.addChild(tipTxt);
        console.log('[bosses_prefight] награды boss='+bossIdx+' иконок='+rewardItems.length+' givesKeys='+JSON.stringify(givesKeys));

        // 26.09.2026 (по прямому указанию) — карусель "ВОЗМОЖНАЯ НАГРАДА": рамка + картинка
        // текущего предмета из пула этого босса/режима + стрелки листания. Если предмет ещё
        // не выбит игроком — картинка обесцвечивается (ColorMatrixFilter.desaturate(), тот же
        // приём, что и в shmot_shop.js для неоткрытых вещей) и поверх неё показывается
        // "награда не получено.png". Координаты — снятые редактором позиций x/y слоя.
        // 26.09.2026: точечная правка редактором позиций — картинка предмета/оверлей
        // "не получено" получили единый scale (применяется к ЛЮБОЙ картинке шмотки в этой
        // карусели, независимо от natural-размера конкретного файла — не auto-fit).
        const SHMOT_FRAME_POS  = { x: 952, y: 449 };
        const SHMOT_ITEM_POS   = { x: 963, y: 461 };
        const SHMOT_ITEM_SCALE = 1.385;
        const SHMOT_NOT_OBT_POS = { x: 914, y: 415 };
        const SHMOT_NOT_OBT_SCALE = 1.373;
        const ARROW_RIGHT_POS  = { x: 1102, y: 492 };
        const ARROW_LEFT_POS   = { x: 912, y: 492 };

        let shmotCarouselIdx = 0;
        let currentShmotItemId = null;
        const _getShmotPool = () => {
            const isSolo = selectedDiff === 3;
            return (BOSS_SHMOT_DROP_POOL[bossIdx] || {})[isSolo ? 'solo' : 'normal'] || [];
        };

        const shmotFrame = new PIXI.Sprite(PIXI.Texture.from(B + 'награда боевка рамка.png'));
        shmotFrame.x = SHMOT_FRAME_POS.x; shmotFrame.y = SHMOT_FRAME_POS.y;
        shmotFrame.interactive = true; shmotFrame.buttonMode = true;
        win.addChild(shmotFrame);

        // 26.09.2026 (по прямому указанию — "при наведении на шмотку в карусели показывай то
        // же описание, что и на вкладке шмотки"): карточка-тултип с тем же набором полей и тем
        // же стилем, что и shmot_shop.js._showShopTip() (заголовок/Бонус/Сет/пунктир/
        // Требования) — переиспользовать саму функцию нельзя (она рисует в this._shopTipCard,
        // контейнере экрана магазина, которого здесь нет), поэтому контент воспроизведён здесь
        // же, в win этого экрана, по тому же item-каталогу window.shmot.items.
        const bossShmotTipCard = new PIXI.Container();
        bossShmotTipCard.visible = false;
        // addChild — в самом конце сборки win (см. ниже, перед this._bossPreWin = win), чтобы
        // карточка гарантированно рисовалась поверх всех остальных элементов экрана.

        const _showBossShmotTip = (itemId) => {
            const item = window.shmot && Array.isArray(shmot.items) ? shmot.items.find(it => it.id === itemId) : null;
            if(!item) return;
            const card = bossShmotTipCard;
            while(card.children.length) card.removeChildAt(0);

            const PAD = 12;
            const CONTENT_W = 250;
            const titleStyle = { fontFamily:'Southbank LT', fontSize:17, fontWeight:'bold', fill:'#ac3b26',
                wordWrap:true, wordWrapWidth:CONTENT_W };
            const lblStyle   = { fontFamily:'Southbank LT', fontSize:14, fontWeight:'bold', fill:'#2a2118' };
            const valStyle   = { fontFamily:'Southbank LT', fontSize:14, fill:'#ac5238' };

            let y = PAD;
            const title = new PIXI.Text(item.name, titleStyle);
            title.x = PAD; title.y = y;
            card.addChild(title);
            y += title.height + 8;

            const bonusLbl = new PIXI.Text('Бонус: ', lblStyle);
            bonusLbl.x = PAD; bonusLbl.y = y;
            card.addChild(bonusLbl);
            const bonusVal = new PIXI.Text(item.bonus || 'нет бонуса',
                Object.assign({}, valStyle, { wordWrap:true, wordWrapWidth: CONTENT_W - bonusLbl.width }));
            bonusVal.x = PAD + bonusLbl.width; bonusVal.y = y;
            card.addChild(bonusVal);
            y += Math.max(bonusLbl.height, bonusVal.height) + 6;

            if(item.set){
                const setLbl = new PIXI.Text('Сет: ', lblStyle);
                setLbl.x = PAD; setLbl.y = y;
                card.addChild(setLbl);
                const prog = shmot._setProgress(item.set);
                const setVal = new PIXI.Text(item.set + ' (' + prog.have + '/' + prog.total + ')',
                    Object.assign({}, valStyle, { wordWrap:true, wordWrapWidth: CONTENT_W - setLbl.width }));
                setVal.x = PAD + setLbl.width; setVal.y = y;
                card.addChild(setVal);
                y += Math.max(setLbl.height, setVal.height) + 10;
            }

            const sep = new PIXI.Graphics();
            sep.lineStyle(1, 0x9c8770, 0.9);
            const DASH = 5, GAP = 4, sepY = y;
            for(let dx = 0; dx < CONTENT_W; dx += DASH + GAP){
                sep.moveTo(PAD + dx, sepY);
                sep.lineTo(Math.min(PAD + dx + DASH, PAD + CONTENT_W), sepY);
            }
            card.addChild(sep);
            y += 10;

            const reqLbl = new PIXI.Text('Требования:', lblStyle);
            reqLbl.x = PAD; reqLbl.y = y;
            card.addChild(reqLbl);
            y += reqLbl.height + 4;

            let reqText;
            if(item.price){
                const unit = {coins:'монет', stew:'тушёнки', cig:'сигарет'}[item.price.type] || '';
                reqText = 'Цена: ' + item.price.a + ' ' + unit;
            } else {
                reqText = item.source || '?';
                if(item.fragments && !item.owned){
                    const have = (shmot.fragmentsProgress && shmot.fragmentsProgress[item.id]) || 0;
                    reqText += '\nСобрано частей: ' + have + '/' + item.fragments;
                }
            }
            const INDENT = 14;
            const reqVal = new PIXI.Text(reqText,
                Object.assign({}, valStyle, { wordWrap:true, wordWrapWidth: CONTENT_W - INDENT }));
            reqVal.x = PAD + INDENT; reqVal.y = y;
            card.addChild(reqVal);
            y += reqVal.height;

            const totalW = CONTENT_W + PAD * 2;
            const totalH = y + PAD;
            const bg = new PIXI.Graphics();
            bg.beginFill(0xfbeee0, 0.97);
            bg.lineStyle(2, 0xc79a72, 1);
            bg.drawRoundedRect(0, 0, totalW, totalH, 8);
            bg.endFill();
            card.addChildAt(bg, 0);

            // Слева от рамки (справа не хватит места до края экрана — рамка уже в правой части).
            card.x = SHMOT_FRAME_POS.x - totalW - 8;
            card.y = SHMOT_FRAME_POS.y - totalH / 2;
            card.visible = true;
        };
        const _hideBossShmotTip = () => { bossShmotTipCard.visible = false; };
        shmotFrame.on('pointerover', () => { if(currentShmotItemId != null) _showBossShmotTip(currentShmotItemId); });
        shmotFrame.on('pointerout',  () => _hideBossShmotTip());

        const shmotItemImg = new PIXI.Sprite(PIXI.Texture.EMPTY);
        shmotItemImg.x = SHMOT_ITEM_POS.x; shmotItemImg.y = SHMOT_ITEM_POS.y;
        shmotItemImg.scale.set(SHMOT_ITEM_SCALE);
        win.addChild(shmotItemImg);

        const shmotNotObtainedOverlay = new PIXI.Sprite(PIXI.Texture.from(B + BOSS_SHMOT_NOT_OBTAINED));
        shmotNotObtainedOverlay.x = SHMOT_NOT_OBT_POS.x; shmotNotObtainedOverlay.y = SHMOT_NOT_OBT_POS.y;
        shmotNotObtainedOverlay.scale.set(SHMOT_NOT_OBT_SCALE);
        win.addChild(shmotNotObtainedOverlay);

        const _shmotGrayscale = new PIXI.filters.ColorMatrixFilter();
        _shmotGrayscale.desaturate();

        const _renderShmotCarousel = () => {
            const pool = _getShmotPool();
            if(!pool.length){
                shmotItemImg.visible = false; shmotNotObtainedOverlay.visible = false;
                currentShmotItemId = null; _hideBossShmotTip();
                return;
            }
            shmotCarouselIdx = ((shmotCarouselIdx % pool.length) + pool.length) % pool.length;
            const itemId = pool[shmotCarouselIdx];
            const imgFile = BOSS_SHMOT_REWARD_IMAGE[itemId];
            if(!imgFile){
                // Предмет ещё не имеет готовой картинки (см. комментарий у id96 в
                // modules/boss-shmot-images.js) — молча скрываем слот, не показываем мусор.
                shmotItemImg.visible = false; shmotNotObtainedOverlay.visible = false;
                currentShmotItemId = null; _hideBossShmotTip();
                return;
            }
            currentShmotItemId = itemId;
            // Смена предмета в карусели (стрелками) должна освежить уже открытый тултип, не
            // оставлять описание предыдущей вещи висеть под курсором до следующего pointerout.
            if(bossShmotTipCard.visible) _showBossShmotTip(itemId);
            shmotItemImg.texture = PIXI.Texture.from(B + imgFile);
            shmotItemImg.visible = true;
            const owned = !!(window.shmot && Array.isArray(shmot.items) && shmot.items.some(it => it.id === itemId && it.owned));
            shmotNotObtainedOverlay.visible = !owned;
            shmotItemImg.filters = owned ? null : [_shmotGrayscale];
        };
        _renderShmotCarousel();

        const arrowRight = new PIXI.Sprite(PIXI.Texture.from(B + 'награда боевка стрелка вправо.png'));
        arrowRight.x = ARROW_RIGHT_POS.x; arrowRight.y = ARROW_RIGHT_POS.y;
        arrowRight.interactive = true; arrowRight.buttonMode = true;
        arrowRight.on('pointerdown', () => { shmotCarouselIdx++; _renderShmotCarousel(); });
        win.addChild(arrowRight);

        const arrowLeft = new PIXI.Sprite(PIXI.Texture.from(B + 'награда боевка стрелка влево.png'));
        arrowLeft.x = ARROW_LEFT_POS.x; arrowLeft.y = ARROW_LEFT_POS.y;
        arrowLeft.interactive = true; arrowLeft.buttonMode = true;
        arrowLeft.on('pointerdown', () => { shmotCarouselIdx--; _renderShmotCarousel(); });
        win.addChild(arrowLeft);

        // Кнопка НАПАСТЬ
        const napBtn = new PIXI.Sprite(PIXI.Texture.from(B + 'боевка кнопка напасть.png'));
        napBtn.anchor.set(0.5, 0.5);
        napBtn.x = 880; napBtn.y = 663;
        napBtn.interactive = true; napBtn.buttonMode = true;
        napBtn.on('pointerover', ()=>{ _sa(napBtn, 0.8); napBtn.scale.set(1.08); });
        napBtn.on('pointerout', ()=>{ _sa(napBtn, 1); napBtn.scale.set(1); });
        napBtn.on('pointerdown', ()=>{
            // 27.09.2026 (по прямому указанию — перенесено сюда из bosses_select.js.napast_passiv,
            // см. комментарий там же): дневной лимит убийств и зачистка локации раньше проверялись
            // на маленькой кнопке карточки босса, из-за чего экран предпросмотра (эта самая награда/
            // карусель шмоток) был недостижим для боссов, к которым игрок ещё не готов. Теперь ВСЕ
            // три проверки (лимит/ключи/локация) стоят непосредственно перед стартом боя, здесь —
            // предпросмотр открывается всегда, а блокировка срабатывает только на реальном клике
            // "Напасть". Проверка ключей была и раньше, лимит и локация — новые здесь.
            const isFightActive = !!(window.bosses && bosses._bossStartMs && bosses._bossStartMs[selectedDiff] && bosses._bossStartMs[selectedDiff][bossIdx]);
            if(window.bosses && !isFightActive){
                const bData = bosses.data[bossIdx];

                // Дневной лимит
                const today = bosses._today ? bosses._today() : '';
                const dailyDate = bosses.dailyDate || '';
                const limit = bosses.DAILY_KILL_LIMIT || 7;
                const dkills = (dailyDate === today) ? parseInt(bosses.dailyKills[bossIdx] || 0) : 0;
                if(dkills >= limit){
                    // 29.09.2026: было "Лимит убийств" — теперь тратится за любой исход попытки.
                    if(window.iface) iface._openSidorovichError('Лимит попыток исчерпан!', 'Лимит ' + limit + ' на сегодня уже достигнут');
                    return;
                }

                // Ключи
                const keysNeed = bData ? (bData.keys_needed || 0) : 0;
                const keySlot = (bData && bData.key_slot != null) ? bData.key_slot : bossIdx;
                const keysHave = Array.isArray(bosses.keys) ? parseInt(bosses.keys[keySlot]||0) : 0;
                console.log('[bosses_prefight.napBtn] bossIdx:', bossIdx, 'keysNeed:', keysNeed, 'keysHave:', keysHave, 'hasKeyring:', bosses._hasKeyring());
                if(!bosses._hasKeyring() && keysNeed > 0 && keysHave < keysNeed){
                    // 29.09.2026 (по прямому указанию, тот же приём, что в bosses-combat.js._attack()/
                    // bosses_fight.js._openBossesFight() — см. комментарии там): боссы с продажей
                    // ключей (buy_key>0 — Счастливчик/Ястреб/Меченный) открывают попап покупки.
                    if(bData && bData.buy_key > 0) bosses._openBuyKeyPopup(bossIdx);
                    else if(window.iface) iface._openSidorovichError('Нужно '+keysNeed+' ключей!', 'У вас: '+keysHave);
                    return;
                }

                // Зачистка локации — тот же переход в Зону, что раньше был на карточке боссов
                // (клик "ПОНЯТНО" сразу ведёт на нужную локацию, не нужно искать её среди 5 карточек).
                const locIdx = (bData && bData.boss_loc != null) ? bData.boss_loc : -1;
                if(locIdx >= 0 && window.zone && !zone.getCleared(locIdx)){
                    const LOC_NAMES = ['Кордон','Свалка','Тёмная Долина','Агропром','Янтарь'];
                    notify.showResult({text:'Зачисти ' + (LOC_NAMES[locIdx] || 'локацию') + '!'}, 0, () => {
                        this._closeBossPreFight();
                        if(this._bossWin) this._bossWin.visible = false;
                        this.popHud('bossSelect');
                        this._restoreBossHud();
                        if(window.iface) iface._openZoneScreen(locIdx);
                    });
                    return;
                }
            }
            modules.checkFlags(['bosses'], ()=>{
                this._lastBossFightIdx  = bossIdx;
                this._lastBossPreFightDiff = selectedDiff;
                this._closeBossPreFight();
                if(this._bossWin) this._bossWin.visible = false;
                if(window.iface) iface._openBossesFight(bossIdx, selectedDiff);
            });
        });
        win.addChild(napBtn);

        win.addChild(bossShmotTipCard); // поверх всего — см. комментарий у объявления выше.

        this._bossPreWin = win;
        root.layer2_mc.addChild(win);
        this.pushHud('bossPrefight', { down: false });
        if(this.up) root.layer2_mc.addChild(this.up);
    };

    proto._closeBossPreFight = function(){
        if(this._bossPreWin && this._bossPreWin.parent)
            this._bossPreWin.parent.removeChild(this._bossPreWin);
        this._bossPreWin = null;
        this.popHud('bossPrefight');
    };
}
