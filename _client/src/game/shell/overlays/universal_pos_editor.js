/**
 * Универсальный редактор позиций — одна кнопка, всегда поверх абсолютно всего экрана
 * (держится на верху через PIXI.Ticker, а не через ручной z-order). По нажатию включает
 * режим, в котором ЛЮБОЙ видимый Sprite/Text на экране становится перетаскиваемым мышкой
 * (обычные клики/покупки на это время отключены — двигать можно что угодно, не боясь
 * случайно что-то купить или открыть другой экран). Стрелки — точная подгонка на 1px
 * (Shift = 10px). Координаты каждого объекта — это ровно то же this.x/this.y, что и в
 * исходном коде экрана, так что их можно сразу продиктовать для правки.
 *
 * Отдельно: попапы со скрытыми «активными» состояниями кнопок (файлы с «актив»/«active»
 * в имени, которые обычно invisible и появляются только при hover/нажатии) на время
 * редактирования принудительно показываются — иначе их было бы невозможно найти и подвинуть.
 */
export function attachUniversalPosEditor(proto){

    // 24.09.2026 (по прямому указанию — "опусти кнопку редактирования вниз на 50px"): 62 → 112.
    const BTN_X = 1250, BTN_Y = 112, BTN_W = 26, BTN_H = 18;

    // 18.09.2026 (прямое указание): 1) поворот (раньше Q/E работал только для объектов
    // с флагом _uRotatable — единственный такой объект был клин-подсветка в рулетке) —
    // теперь универсально для ЛЮБОГО выбранного объекта. 2) мышиные "ручки" по 4 углам
    // и 4 серединам граней bounding-box'а выбранного объекта — свободный resize шириной/
    // высотой по отдельности (углы — сразу обе оси, грани — только одна), с сохранением
    // на месте противоположного угла/грани независимо от anchor объекта.
    const HANDLE_DEFS = [
        {type:'tl', gx:(b)=>b.x,               gy:(b)=>b.y},
        {type:'t',  gx:(b)=>b.x+b.width/2,     gy:(b)=>b.y},
        {type:'tr', gx:(b)=>b.x+b.width,       gy:(b)=>b.y},
        {type:'r',  gx:(b)=>b.x+b.width,       gy:(b)=>b.y+b.height/2},
        {type:'br', gx:(b)=>b.x+b.width,       gy:(b)=>b.y+b.height},
        {type:'b',  gx:(b)=>b.x+b.width/2,     gy:(b)=>b.y+b.height},
        {type:'bl', gx:(b)=>b.x,               gy:(b)=>b.y+b.height},
        {type:'l',  gx:(b)=>b.x,               gy:(b)=>b.y+b.height/2},
    ];
    const HANDLE_OPPOSITE = { tl:'br', t:'b', tr:'bl', r:'l', br:'tl', b:'t', bl:'tr', l:'r' };
    const HANDLE_AXIS     = { tl:'both', tr:'both', bl:'both', br:'both', t:'y', b:'y', l:'x', r:'x' };
    const HANDLE_SIZE = 9;

    proto._ensureEditButton = function(){
        if(this._editBtn) return;

        const btn = new PIXI.Graphics();
        btn.beginFill(0x2a1a4a, 0.92);
        btn.lineStyle(1, 0xc09aff, 0.9);
        btn.drawRoundedRect(0, 0, BTN_W, BTN_H, 4);
        btn.endFill();
        btn.x = BTN_X; btn.y = BTN_Y;
        btn.interactive = true; btn.buttonMode = true;
        btn.on('pointerover', ()=>{ btn.alpha = 0.7; });
        btn.on('pointerout',  ()=>{ btn.alpha = 1; });
        btn.on('pointerdown', (e)=>{ e.stopPropagation(); this._toggleUniversalEdit(); });

        const txt = new PIXI.Text('✥', { fontFamily:'Arial', fontSize:14, fill:'#e8d8ff' });
        txt.anchor.set(0.5, 0.5); txt.x = BTN_W/2; txt.y = BTN_H/2 - 1;
        btn.addChild(txt);

        root.addChild(btn);
        this._editBtn = btn;
        this._editBtnTxt = txt;

        // Кнопка держится поверх ВСЕГО на любом экране — на каждый кадр перекидываем
        // её в конец списка детей root (последний addChild = самый верхний слой рендера).
        // Это надёжнее, чем пытаться перехватить все места, где что-то добавляется поверх.
        PIXI.Ticker.shared.add(()=>{ if(this._editBtn && this._editBtn.parent) this._editBtn.parent.addChild(this._editBtn); });

        console.log('[universal_pos_editor._ensureEditButton] кнопка создана, держится поверх всего через Ticker');
    };

    proto._toggleUniversalEdit = function(){
        this._uEditOn = !this._uEditOn;
        console.log('[universal_pos_editor._toggleUniversalEdit] режим:', this._uEditOn ? 'ВКЛ' : 'ВЫКЛ');
        if(this._uEditOn) this._enableUniversalEdit();
        else this._disableUniversalEdit();
        if(this._editBtnTxt) this._editBtnTxt.style.fill = this._uEditOn ? '#80ff80' : '#e8d8ff';
    };

    // Sprite/Text, чей путь текстуры похож на скрытое "активное" состояние кнопки попапа.
    // "activ" (без конечной "e") — по факту частый вариант транслита в этом проекте
    // (banka_activ.png, konserva_activ.png, sig_activ.png, yashik_activ.png, sumka_activ.png
    // у Сидоровича) — раньше не совпадал ни с "актив", ни с "active", поэтому редактор
    // позиций не мог найти и подвинуть эти файлы (репорт: "редактирование у Сидоровича
    // должно цеплять рюкзак актив/ящик актив/консерв актив и т.д.").
    const _looksLikeActiveState = (spr) => {
        try{
            if(!spr.texture) return false;
            const re = /актив|activ/i;
            const url = spr.texture.baseTexture && spr.texture.baseTexture.resource
                ? (spr.texture.baseTexture.resource.url || '') : '';
            if(re.test(url)) return true;
            // resource.url не всегда доступен (общий кэш текстур/атлас) — дублируем проверку
            // по textureCacheIds, куда PIXI кладёт ровно ту строку, что передали в Texture.from().
            const ids = (spr.texture.textureCacheIds || []).concat(
                (spr.texture.baseTexture && spr.texture.baseTexture.textureCacheIds) || []);
            return ids.some(id => re.test(id));
        } catch(e){ return false; }
    };

    // Ищет по всем трём слоям скрытые "актив"-спрайты и принудительно показывает их —
    // вынесено в отдельный переиспользуемый метод, т.к. вызывается не только один раз
    // при включении режима, но и периодически (см. _uActiveScanInterval), чтобы ловить
    // попапы, созданные уже ПОСЛЕ включения редактора.
    proto._uScanForceActive = function(){
        if(!this._uForcedVisible) return;
        const _scanForActive = (node) => {
            if(!node || !node.children) return;
            for(const child of node.children){
                if(child === this._editBtn) continue;
                if(child instanceof PIXI.Sprite && child.visible === false && _looksLikeActiveState(child)){
                    this._uForcedVisible.push(child);
                    child.visible = true;
                }
                // Обводки "что выиграл игрок" (покер/блэкджек/зарики — помечены
                // _uDraggable, гасят себя через gsap-таймлайн затухания через ~3с).
                // Их код сам не запускает затухание, ПОКА редактор уже включён — но
                // если редактор включили В ПРОЦЕССЕ уже идущего затухания (рамка
                // появилась до открытия редактора), этой проверки недостаточно: тут
                // добиваем — останавливаем уже запущенный твин и возвращаем полную
                // видимость на каждом скане (раз в 500мс), пока режим включён.
                if(child._uDraggable === true && child.visible !== false){
                    if(window.gsap) gsap.killTweensOf(child);
                    child.alpha = 1;
                }
                _scanForActive(child);
            }
        };
        if(root.layer0_mc) _scanForActive(root.layer0_mc);
        if(root.layer1_mc) _scanForActive(root.layer1_mc);
        if(root.layer2_mc) _scanForActive(root.layer2_mc);
    };

    proto._enableUniversalEdit = function(){
        // 1) Принудительно показываем скрытые "активные" состояния попапов, запоминая
        //    кого именно трогали, чтобы вернуть как было при выключении режима.
        this._uForcedVisible = [];
        this._uScanForceActive();
        console.log('[universal_pos_editor._enableUniversalEdit] принудительно показано «активных» состояний:', this._uForcedVisible.length);
        // Popup'ы (например "купить патрон для ящика") часто создаются ПОСЛЕ включения
        // режима редактора — разовый скан выше их не увидит. Перепроверяем периодически,
        // пока режим включён, чтобы новые попапы тоже сразу получали видимые актив-состояния.
        this._uActiveScanInterval = setInterval(() => this._uScanForceActive(), 500);

        // 2) Полноэкранный перехватчик кликов — глушит все обычные обработчики под собой.
        const cap = new PIXI.Graphics();
        cap.beginFill(0x8020c0, 0.06);
        cap.drawRect(0, 0, 1280, 720);
        cap.endFill();
        cap.interactive = true;
        root.addChild(cap);
        this._uCapture = cap;
        // Кнопку — снова наверх, чтобы перехватчик её не закрыл (тикер сделал бы это
        // и сам к следующему кадру, но чтобы не мигало — поднимаем сразу).
        if(this._editBtn) root.addChild(this._editBtn);

        // Диагностика: cap ДОЛЖЕН быть предпоследним в root.children (после него — только
        // editBtn/readout/copyBtn/hoverBox, которые мы сами добавим следом). Если после cap
        // в списке всплывает что-то ЧУЖОЕ (например iface.up, повторно добавленный поверх
        // через root.addChild где-то ещё) — вот оно и перехватывает клики вместо cap.
        console.log('[universal_pos_editor._enableUniversalEdit] root.children сразу после добавления cap (' +
            root.children.length + ' шт.):',
            root.children.map((c, i) => i + ':' + (c.constructor ? c.constructor.name : '?') +
                (c === cap ? '[CAP]' : (c === this._editBtn ? '[editBtn]' : ''))).join(', '));

        // 3) Читаемая панель с координатами выбранного объекта.
        const readout = new PIXI.Text('', {
            fontFamily:'Arial', fontSize:13, fill:'#e8d8ff', lineHeight: 17,
            dropShadow:true, dropShadowColor:'#000', dropShadowDistance:1,
        });
        readout.x = 16; readout.y = 64;
        root.addChild(readout);
        this._uReadout = readout;
        this._uUpdateReadout('Режим редактора включён. Кликните и тащите любой объект.');

        // Кнопка "копировать" координаты последнего выбранного объекта.
        const copyBtn = new PIXI.Graphics();
        copyBtn.beginFill(0x1a3a1a, 0.9);
        copyBtn.lineStyle(1, 0x50c050, 0.8);
        copyBtn.drawRoundedRect(0, 0, 130, 22, 4);
        copyBtn.endFill();
        copyBtn.x = 16; copyBtn.y = 720 - 30;
        copyBtn.interactive = true; copyBtn.buttonMode = true;
        copyBtn.on('pointerover', ()=>{ copyBtn.alpha = 0.7; });
        copyBtn.on('pointerout',  ()=>{ copyBtn.alpha = 1; });
        copyBtn.on('pointerdown', ()=>this._uCopySelected());
        const copyTxt = new PIXI.Text('📋 КОПИРОВАТЬ x/y', {fontFamily:'Southbank LT', fontSize:11, fill:'#80e080'});
        copyTxt.anchor.set(0.5, 0.5); copyTxt.x = 65; copyTxt.y = 11;
        copyBtn.addChild(copyTxt);
        root.addChild(copyBtn);
        this._uCopyBtn = copyBtn;

        // 25.09.2026 (по прямому указанию — "ещё сделай кнопку супер копирования, которая
        // копирует ещё угол поворота, высоту и ширину объекта"): та же кнопка "📋 КОПИРОВАТЬ",
        // но в текст дополнительно идут rotation (в градусах) и фактические w/h объекта
        // (уже с учётом scale — как у бокса для текста, только теперь для ЛЮБОГО объекта).
        const superCopyBtn = new PIXI.Graphics();
        superCopyBtn.beginFill(0x3a2a0a, 0.9);
        superCopyBtn.lineStyle(1, 0xe0a030, 0.8);
        superCopyBtn.drawRoundedRect(0, 0, 170, 22, 4);
        superCopyBtn.endFill();
        superCopyBtn.x = 16 + 130 + 8; superCopyBtn.y = 720 - 30;
        superCopyBtn.interactive = true; superCopyBtn.buttonMode = true;
        superCopyBtn.on('pointerover', ()=>{ superCopyBtn.alpha = 0.7; });
        superCopyBtn.on('pointerout',  ()=>{ superCopyBtn.alpha = 1; });
        superCopyBtn.on('pointerdown', ()=>this._uCopySelectedSuper());
        const superCopyTxt = new PIXI.Text('📋 СУПЕР КОПИРОВАТЬ', {fontFamily:'Southbank LT', fontSize:11, fill:'#f0c060'});
        superCopyTxt.anchor.set(0.5, 0.5); superCopyTxt.x = 85; superCopyTxt.y = 11;
        superCopyBtn.addChild(superCopyTxt);
        root.addChild(superCopyBtn);
        this._uSuperCopyBtn = superCopyBtn;

        // 21.09.2026 (по прямому указанию: "можно ли добавить бар для автоцентрирования текста
        // прямо в редакторе?") — кнопка создаёт "текст-бокс": обычный перетаскиваемый/растяжимый
        // прямоугольник (все существующие стрелки/ручки/Q-E уже работают с ним из коробки, см.
        // _uIsTextBox ниже — ловится хит-тестом через _uDraggable), внутри которого висит текст-
        // образец, САМ держащийся по центру при любом перемещении/ресайзе — визуальный аналог
        // window._centerTextIn(text, box) из ui_kit.js. Координаты бокса читаются тем же readout/
        // 📋 КОПИРОВАТЬ, что и у любого объекта — это и есть {x,y,w,h}, который передаётся в
        // _centerTextIn либо просто диктуется мне.
        const boxBtn = new PIXI.Graphics();
        boxBtn.beginFill(0x2a1a4a, 0.9);
        boxBtn.lineStyle(1, 0xc09aff, 0.8);
        boxBtn.drawRoundedRect(0, 0, 150, 22, 4);
        boxBtn.endFill();
        // 25.09.2026: сдвинута правее — освободила место для новой кнопки "📋 СУПЕР КОПИРОВАТЬ"
        // (16+130+8=154..324), которая встала как раз на старую позицию этой кнопки.
        boxBtn.x = 16 + 130 + 8 + 170 + 8; boxBtn.y = 720 - 30;
        boxBtn.interactive = true; boxBtn.buttonMode = true;
        boxBtn.on('pointerover', ()=>{ boxBtn.alpha = 0.7; });
        boxBtn.on('pointerout',  ()=>{ boxBtn.alpha = 1; });
        boxBtn.on('pointerdown', ()=>this._uCreateTextBox());
        const boxTxt = new PIXI.Text('▭ БОКС ДЛЯ ТЕКСТА', {fontFamily:'Southbank LT', fontSize:11, fill:'#c09aff'});
        boxTxt.anchor.set(0.5, 0.5); boxTxt.x = 75; boxTxt.y = 11;
        boxBtn.addChild(boxTxt);
        root.addChild(boxBtn);
        this._uBoxBtn = boxBtn;
        this._uTextBoxes = [];

        // 3.5) Рамка подсветки объекта под курсором — чтобы было видно, что именно
        //      будет схвачено, ДО клика (наведение), а не только после начала драга.
        const hoverBox = new PIXI.Graphics();
        hoverBox.visible = false;
        root.addChild(hoverBox);
        this._uHoverBox = hoverBox;
        this._uHovered  = null;

        // 3.6) Ручки resize (8 шт. — 4 угла + 4 середины граней) вокруг ВЫБРАННОГО объекта.
        // Создаются заново при каждом включении режима (после cap), поэтому автоматически
        // рендерятся и ловят клики ПОВЕРХ полноэкранного перехватчика — как copyBtn/readout.
        this._uCreateHandles();

        // 3.6) Живая диагностика ПРЯМО НА ЭКРАНЕ (не в консоли!) — открытая консоль
        // разработчика сама по себе меняет размер вьюпорта и ломает кликабельность
        // игры, поэтому смотреть логи в консоли одновременно с тестированием клика
        // не получается. Этот текст обновляется на каждый pointermove и показывает,
        // доходит ли событие до перехватчика (cap) и что именно находит хит-тест —
        // видно прямо в игре, без открытия devtools.
        const debugTxt = new PIXI.Text('курсор: —', {
            fontFamily:'Arial', fontSize:12, fill:'#ffe066', lineHeight: 15,
            dropShadow:true, dropShadowColor:'#000', dropShadowDistance:1,
        });
        debugTxt.x = 700; debugTxt.y = 64;
        root.addChild(debugTxt);
        this._uDebugTxt = debugTxt;

        // 4) Drag: down выбирает объект под курсором (кастомный hit-test, минуя capture
        //    и саму кнопку), move/up тащат его. Один набор обработчиков на capture-слое —
        //    так надёжнее, чем вешать drag на каждый найденный объект по отдельности.
        this._uDrag = null;
        this._uSelected = null;

        // Пишет диагностику ПРЯМО НА ЭКРАН (см. debugTxt выше) — не в консоль, чтобы не
        // требовать открытых devtools для проверки.
        const _uSetDebugTxt = (label, g, found) => {
            if(!this._uDebugTxt) return;
            this._uDebugTxt.text = label + ': (' + g.x.toFixed(0) + ',' + g.y.toFixed(0) + ')\n' +
                (found ? ('найдено: ' + found.constructor.name + ' x=' + Math.round(found.x) + ' y=' + Math.round(found.y))
                       : 'ничего не найдено под курсором');
        };

        // Shift+клик — выбрать объект, лежащий ПОД тем, что обычно ловится первым (для
        // случая, когда два объекта в редакторе наложены друг на друга). Повторный
        // Shift+клик В ТОЙ ЖЕ точке циклически идёт ещё глубже (3-й, 4-й... объект), а
        // клик в ДРУГОЙ точке сбрасывает цикл и снова начинает со второго сверху.
        this._uShiftPoint = null;
        this._uShiftIdx = 0;

        const onDown = (e) => {
            // Скан «актив»-спрайтов синхронно перед хит-тестом — не полагаемся только на
            // 500мс интервал, иначе попап, открытый прямо перед кликом, ещё не будет пойман.
            this._uScanForceActive();
            const g = e.data.global;
            const isShift = !!(e.data.originalEvent && e.data.originalEvent.shiftKey);

            let found;
            if(isShift){
                const all = this._uFindAllAt(g.x, g.y);
                const samePoint = this._uShiftPoint &&
                    Math.abs(this._uShiftPoint.x - g.x) < 3 && Math.abs(this._uShiftPoint.y - g.y) < 3;
                this._uShiftIdx = samePoint ? (this._uShiftIdx + 1) % Math.max(1, all.length)
                                             : (all.length > 1 ? 1 : 0);
                this._uShiftPoint = { x: g.x, y: g.y };
                found = all.length ? all[this._uShiftIdx] : null;
                console.log('[universal_pos_editor.onDown] Shift+клик | кандидатов под курсором:', all.length,
                    '| выбран индекс:', this._uShiftIdx);
            } else {
                this._uShiftPoint = null; this._uShiftIdx = 0;
                found = this._uFindTopmost(g.x, g.y);
            }

            _uSetDebugTxt(isShift ? 'shift-клик' : 'клик', g, found);
            console.log('[universal_pos_editor.onDown] pointerdown=('+g.x.toFixed(0)+','+g.y.toFixed(0)+')',
                found ? ('найден: тип='+found.constructor.name+' x='+Math.round(found.x)+' y='+Math.round(found.y)) : 'НИЧЕГО не найдено под курсором');
            if(!found) return;
            const local = found.parent.toLocal(g);
            this._uDrag = { obj: found, startX: local.x, startY: local.y, x0: found.x, y0: found.y };
            this._uSelected = found;
            this._uUpdateReadout();
            this._uShowHandles(found);
        };
        // Троттлим лог по смене результата (не на каждый мышемув) — иначе консоль зальёт спамом.
        // Экранный debugTxt при этом обновляется на КАЖДЫЙ pointermove — это дёшево и не спамит.
        this._uLastHoverLogged = undefined;
        const onMove = (e) => {
            const g = e.data.global;
            if(this._uResizeDrag){
                this._uApplyResize(g);
                _uSetDebugTxt('resize:' + this._uResizeDrag.type, g, this._uResizeDrag.obj);
                return;
            }
            if(this._uDrag){
                const obj = this._uDrag.obj;
                const local = obj.parent.toLocal(g);
                obj.x = Math.round(this._uDrag.x0 + (local.x - this._uDrag.startX));
                obj.y = Math.round(this._uDrag.y0 + (local.y - this._uDrag.startY));
                if(typeof obj._uOnTransform === 'function') obj._uOnTransform(); // текст-бокс держит текст по центру
                this._uUpdateReadout();
                this._uUpdateHoverBox(obj); // рамка следует за объектом, пока его тащат
                this._uShowHandles(obj);    // ручки едут вместе с объектом
                _uSetDebugTxt('тащим', g, obj);
                return;
            }
            // Не тащим — просто подсвечиваем то, что окажется под курсором при клике.
            const found = this._uFindTopmost(g.x, g.y);
            _uSetDebugTxt('наведение', g, found);
            if(found !== this._uLastHoverLogged){
                console.log('[universal_pos_editor.onMove] pointermove=('+g.x.toFixed(0)+','+g.y.toFixed(0)+')',
                    found ? ('под курсором: тип='+found.constructor.name+' x='+Math.round(found.x)+' y='+Math.round(found.y)) : 'ничего не найдено под курсором');
                this._uLastHoverLogged = found;
            }
            this._uUpdateHoverBox(found);
        };
        const onUp = () => { this._uDrag = null; this._uEndResize(); };

        cap.on('pointerdown', onDown);
        cap.on('pointermove', onMove);
        cap.on('pointerup', onUp);
        cap.on('pointerupoutside', onUp);
        this._uCapHandlers = { onDown, onMove, onUp };

        // 5) Стрелки — точная подгонка выбранного объекта. PageUp/PageDown — размер
        //    (масштаб), шаг переведён в "пиксели" через собственную ширину текстуры объекта,
        //    чтобы +1 ощущался одинаково "по пикселю" независимо от исходного разрешения спрайта.
        this._uKeyHandler = (e) => {
            if(!this._uSelected) return;
            const step = e.shiftKey ? 10 : 1;
            const key = e.key.toLowerCase();
            let moved = true;
            if(e.key === 'ArrowLeft')       this._uSelected.x -= step;
            else if(e.key === 'ArrowRight') this._uSelected.x += step;
            else if(e.key === 'ArrowUp')    this._uSelected.y -= step;
            else if(e.key === 'ArrowDown')  this._uSelected.y += step;
            else if(e.key === 'PageUp')     this._uScaleStep(this._uSelected, step);
            else if(e.key === 'PageDown')   this._uScaleStep(this._uSelected, -step);
            // 18.09.2026 (прямое указание): поворот Q/E — раньше только для объектов с
            // флагом _uRotatable (единственный пример — клин-подсветка в рулетке), теперь
            // универсально для ЛЮБОГО выбранного объекта.
            else if(key === 'q') this._uSelected.rotation = (this._uSelected.rotation || 0) - step * Math.PI / 180;
            else if(key === 'e') this._uSelected.rotation = (this._uSelected.rotation || 0) + step * Math.PI / 180;
            // Сужение/расширение угла (,/.) — узкоспециальная штука конкретно для
            // клина-подсветки рулетки (регулирует угол сектора, не ширину картинки),
            // оставлена как есть для тех объектов, что явно её разрешили.
            else if(key === ',' && typeof this._uSelected._uAdjustWidth === 'function') this._uSelected._uAdjustWidth(-step);
            else if(key === '.' && typeof this._uSelected._uAdjustWidth === 'function') this._uSelected._uAdjustWidth(step);
            // Delete — удалить выбранный текст-бокс (и его текст-образец) целиком. Только для
            // боксов (_uIsTextBox) — обычные игровые объекты Delete не трогает, это не общий "удалить".
            else if((e.key === 'Delete' || e.key === 'Backspace') && this._uSelected._uIsTextBox){
                this._uDeleteTextBox(this._uSelected);
                e.preventDefault(); e.stopPropagation();
                return;
            }
            else moved = false;
            if(moved){
                // stopPropagation — буквенные клавиши (Q/E, в отличие от стрелок и
                // PageUp/PageDown) на VK-странице могут перехватываться сторонним
                // обработчиком раньше нас (тип-ахед поиск и т.п.), из-за чего событие до
                // сюда доходило, но какой-то другой код успевал его первым съесть. Слушаем
                // в capture-фазе (см. addEventListener ниже) и глушим всплытие сами.
                e.preventDefault();
                e.stopPropagation();
                if(typeof this._uSelected._uOnTransform === 'function') this._uSelected._uOnTransform();
                this._uUpdateReadout();
                this._uUpdateHoverBox(this._uSelected);
                this._uShowHandles(this._uSelected);
            }
        };
        // capture:true — наш обработчик получает событие ПЕРВЫМ, раньше любых
        // bubble-фазовых перехватчиков буквенных клавиш на странице.
        window.addEventListener('keydown', this._uKeyHandler, true);
    };

    // Создаёт один "текст-бокс" — Graphics-прямоугольник (обычный объект для существующей
    // системы драга/резайза/поворота, ловится хит-тестом через _uDraggable) + независимый
    // PIXI.Text-образец, который сам пересчитывает свою позицию в ЦЕНТР бокса на каждом
    // изменении (см. _uOnTransform ниже, дёргается из onMove/_uApplyResize/стрелок).
    // Текст — СОСЕД бокса в root (не ребёнок), поэтому масштаб бокса при ресайзе НЕ тянет за
    // собой шрифт (в отличие от child-текста внутри Sprite/Container) — размер шрифта всегда
    // читаемый, меняется только позиция.
    let _uTextBoxSeq = 0;
    proto._uCreateTextBox = function(){
        const box = new PIXI.Graphics();
        box.beginFill(0x40c0ff, 0.22);
        box.lineStyle(2, 0x40c0ff, 0.9);
        box.drawRect(0, 0, 150, 40);
        box.endFill();
        box.x = 565; box.y = 300;
        box.interactive = true; box.buttonMode = true;
        box._uDraggable = true;
        box._uIsTextBox = true;

        const label = new PIXI.Text('ПРИМЕР', {
            fontFamily:'Southbank LT', fontSize:18, fill:'#ffffff', fontWeight:'bold',
            dropShadow:true, dropShadowColor:'#000000', dropShadowDistance:1,
        });
        label.anchor.set(0.5, 0.5);
        // Не должен ловиться хит-тестом отдельно от бокса (иначе его можно было бы утащить
        // самого по себе и он рассинхронился бы с центром до следующего _uOnTransform) —
        // управлять центрированным текстом можно только через сам бокс.
        label._uIsCenterTextLabel = true;
        // 21.09.2026 (баг найден, по прямому указанию: "могу сделать бокс для текста, но не
        // могу с ним взаимодействовать") — добавлялся в root НАПРЯМУЮ, а хит-тест редактора
        // (_uCollectAt/_uFindAllAt) сканирует ТОЛЬКО root.layer2_mc/layer1_mc/layer0_mc, сам
        // root не проверяет вообще — клик по боксу физически не мог его найти.
        root.layer2_mc.addChild(label);
        box._uCenterText = label;

        // Пересчитывает позицию текста-образца в ЦЕНТР текущих bounds бокса — та же формула,
        // что window._centerTextIn(text, {x,y,w,h}) в ui_kit.js, только через getBounds()
        // (уже готовые глобальные координаты, учитывающие текущие x/y/scale/rotation бокса).
        box._uOnTransform = () => {
            const b = box.getBounds();
            label.x = b.x + b.width / 2;
            label.y = b.y + b.height / 2;
        };
        box._uOnTransform();

        root.layer2_mc.addChild(box);
        this._uTextBoxes.push(box);
        console.log('[universal_pos_editor._uCreateTextBox] создан бокс #' + (++_uTextBoxSeq) +
            ' | x:', box.x, 'y:', box.y, '| растягивайте/двигайте как обычный объект, текст сам держится по центру');
        if(window.notify) notify.showResult({text:'Бокс создан — тащите/растягивайте как любой объект. Текст сам центрируется. Delete — удалить выбранный бокс.'}, 1);
        return box;
    };

    proto._uDeleteTextBox = function(box){
        if(!box || !box._uIsTextBox) return;
        if(box._uCenterText && box._uCenterText.parent) box._uCenterText.parent.removeChild(box._uCenterText);
        if(box.parent) box.parent.removeChild(box);
        const i = this._uTextBoxes.indexOf(box);
        if(i >= 0) this._uTextBoxes.splice(i, 1);
        if(this._uSelected === box){ this._uSelected = null; this._uShowHandles(null); this._uUpdateHoverBox(null); this._uUpdateReadout(); }
        console.log('[universal_pos_editor._uDeleteTextBox] бокс удалён, осталось:', this._uTextBoxes.length);
    };

    // Меняет равномерный (uniform) масштаб объекта на deltaPx "экранных пикселей" ширины —
    // конвертируем через собственную нативную ширину текстуры объекта (orig), чтобы шаг
    // ощущался как реальные пиксели независимо от того, насколько крупная исходная картинка.
    proto._uScaleStep = function(obj, deltaPx){
        if(!obj || !obj.scale) return;
        const nativeW = (obj.texture && obj.texture.orig && obj.texture.orig.width)
            ? obj.texture.orig.width
            : (obj.scale.x ? obj.width / obj.scale.x : (obj.width || 100));
        const cur  = obj.scale.x || 1;
        const next = Math.max(0.02, cur + deltaPx / Math.max(1, nativeW));
        obj.scale.x = next;
        obj.scale.y = next;
    };

    // Создаёт 8 квадратных "ручек" (жёлтые с чёрной обводкой) — 4 угла + 4 середины
    // граней. Вызывается заново при каждом включении редактора (после cap), поэтому
    // ручки гарантированно рендерятся/ловят клики ПОВЕРХ полноэкранного перехватчика.
    proto._uCreateHandles = function(){
        this._uDestroyHandles();
        this._uHandles = HANDLE_DEFS.map(def => {
            const h = new PIXI.Graphics();
            h.beginFill(0xffcc00, 1);
            h.lineStyle(1, 0x000000, 0.9);
            h.drawRect(-HANDLE_SIZE/2, -HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
            h.endFill();
            h.interactive = true; h.buttonMode = true;
            h.visible = false;
            h._uHandleType = def.type;
            root.addChild(h);
            // 22.09.2026 (баг найден по живому репорту — "тяну ручку, потом не могу отпустить,
            // толкаю бесконечно, ничего больше не тыкается"): ручка и cap (полноэкранный
            // перехватчик) — СОСЕДИ в root, а не родитель/потомок. pointerdown на ручке находит
            // ЕЁ как топ-хит и не доходит до cap.onDown вообще (не из-за stopPropagation ниже —
            // PIXI и так дошёл бы только до реального предка). Значит cap НИКОГДА не получает
            // исходный pointerdown этого драга → не отслеживает его → его pointerup/
            // pointerupoutside для ЭТОГО перетаскивания просто не сработают. Если пользователь
            // отпускает мышь, пока курсор ещё физически над самой ручкой (частый случай при
            // resize) — хит-тест releasa попадает на ручку, а не на cap, а у ручки не было
            // обработчика pointerup — событие проглатывается, _uResizeDrag остаётся висеть
            // навсегда, onMove на cap продолжает тащить резайз бесконечно. Фикс — свой
            // pointerup/pointerupoutside прямо на ручке, тот же _uEndResize, что и у cap.
            h.on('pointerdown', (e) => {
                e.stopPropagation();
                // Доп. защита (по прямому указанию — "при повторном нажатии на этот же
                // квадратик резайз должен останавливаться"): если резайз уже идёт (например,
                // предыдущий pointerup всё же потерялся по любой другой причине) — повторный
                // клик по ЛЮБОЙ ручке гасит его, а не запускает поверх ещё один.
                if(this._uResizeDrag){ this._uEndResize(); return; }
                this._uStartResize(def.type, e);
            });
            h.on('pointerup', () => this._uEndResize());
            h.on('pointerupoutside', () => this._uEndResize());
            return h;
        });
    };

    // Общая точка остановки resize-драга — вызывается и с cap (обычный отпуск мыши над
    // перехватчиком), и с самих ручек (отпуск мыши, пока курсор ещё над ручкой — см. комментарий
    // в _uCreateHandles выше, откуда взялся баг "не могу отпустить квадратик").
    proto._uEndResize = function(){
        this._uResizeDrag = null;
    };

    proto._uDestroyHandles = function(){
        if(!this._uHandles) return;
        this._uHandles.forEach(h => { if(h.parent) h.parent.removeChild(h); });
        this._uHandles = null;
    };

    // Расставляет ручки по bounding-box'у выбранного объекта (obj=null — прячет все).
    // getBounds() уже в глобальных координатах — та же логика, что у hoverBox выше.
    proto._uShowHandles = function(obj){
        if(!this._uHandles) return;
        if(!obj){ this._uHandles.forEach(h => { h.visible = false; }); return; }
        const b = obj.getBounds();
        this._uHandles.forEach((h, i) => {
            const def = HANDLE_DEFS[i];
            h.x = def.gx(b); h.y = def.gy(b);
            h.visible = true;
        });
    };

    // Начало resize-драга по конкретной ручке. Запоминаем ГЛОБАЛЬНУЮ точку противоположного
    // угла/грани (которая должна остаться на месте) и её смещение от obj.x/obj.y В ЕДИНИЦАХ
    // РОДИТЕЛЯ — это смещение линейно масштабируется вместе с scale объекта, поэтому не нужно
    // знать anchor объекта явно (он может быть любым — 0,0 / 0.5,0.5 / что угодно).
    proto._uStartResize = function(type, e){
        const obj = this._uSelected;
        if(!obj) return;
        const b = obj.getBounds();
        const oppDef = HANDLE_DEFS.find(d => d.type === HANDLE_OPPOSITE[type]);
        const fixedGX = oppDef.gx(b), fixedGY = oppDef.gy(b);
        const local = obj.parent.toLocal(new PIXI.Point(fixedGX, fixedGY));
        this._uResizeDrag = {
            type, obj, fixedGX, fixedGY,
            offsetX0: local.x - obj.x, offsetY0: local.y - obj.y,
            scaleX0: obj.scale ? obj.scale.x : 1, scaleY0: obj.scale ? obj.scale.y : 1,
            boundsW0: Math.max(1, b.width), boundsH0: Math.max(1, b.height),
        };
        console.log('[universal_pos_editor._uStartResize] ручка:', type, 'фикс. точка (global):', Math.round(fixedGX), Math.round(fixedGY));
    };

    // Применяет resize на каждый pointermove, пока активен _uResizeDrag. Угловые ручки
    // меняют обе оси сразу, боковые — только свою. Объект перепозиционируется так, чтобы
    // противоположный угол/грань остались там же на экране, где были в начале драга.
    proto._uApplyResize = function(g){
        const rd = this._uResizeDrag;
        if(!rd || !rd.obj) return;
        const obj = rd.obj;
        const axis = HANDLE_AXIS[rd.type];
        let newScaleX = rd.scaleX0, newScaleY = rd.scaleY0;
        if(axis === 'x' || axis === 'both'){
            const newW = Math.max(4, Math.abs(g.x - rd.fixedGX));
            newScaleX = Math.max(0.02, rd.scaleX0 * (newW / rd.boundsW0));
        }
        if(axis === 'y' || axis === 'both'){
            const newH = Math.max(4, Math.abs(g.y - rd.fixedGY));
            newScaleY = Math.max(0.02, rd.scaleY0 * (newH / rd.boundsH0));
        }
        if(obj.scale){ obj.scale.x = newScaleX; obj.scale.y = newScaleY; }

        // Смещение фикс.точки от obj.x/y растёт/падает пропорционально изменению scale —
        // пересчитываем и ставим obj туда, откуда фикс.точка снова окажется на исходном месте.
        const newOffsetX = rd.offsetX0 * (newScaleX / (rd.scaleX0 || 1));
        const newOffsetY = rd.offsetY0 * (newScaleY / (rd.scaleY0 || 1));
        const fixedLocal = obj.parent.toLocal(new PIXI.Point(rd.fixedGX, rd.fixedGY));
        obj.x = Math.round(fixedLocal.x - newOffsetX);
        obj.y = Math.round(fixedLocal.y - newOffsetY);

        if(typeof obj._uOnTransform === 'function') obj._uOnTransform(); // текст-бокс держит текст по центру
        this._uShowHandles(obj);
        this._uUpdateHoverBox(obj);
        this._uUpdateReadout();
    };

    // Кастомный hit-test: ищем самый верхний (последний в дереве, отрисован сверху)
    // видимый Sprite/Text под точкой (gx,gy) — то, что реально можно двигать.
    // Проверяем layer2 (попапы) → layer1 (HUD) → layer0 (игровой мир), т.к. именно
    // в таком порядке они визуально лежат друг на друге.
    //
    // Отдельные объекты, помеченные вручную флагом obj._uDraggable = true (например,
    // Graphics-точки вроде маркера награды в рулетке), тоже считаются целью — иначе
    // редактор видит только Sprite/Text и не даёт двигать произвольные Graphics-метки.
    // Флаг ставится явно на конкретном объекте, а не расширяется на все Graphics подряд —
    // иначе под курсор попадали бы даже полноэкранные blocker'ы.
    // Собирает ВСЕ подходящие объекты под точкой (gx,gy) в ОДНОМ узле дерева, в порядке
    // "сверху вниз" (topmost first) — тот же обход, что раньше был в _uFindTopmost, только
    // вместо return на первом совпадении копит все найденные в results. Нужен для
    // Shift+клика (см. _uFindAllAt/onDown) — выбор объекта, который лежит ПОД тем, что
    // обычно ловится первым.
    // 19.09.2026 (по прямому указанию, репорт "хитбокс кнопки не совпадает с картинкой,
    // клик по надписи КУПИТЬ нажимает ОТМЕНА") — редактор раньше видел только Sprite/Text,
    // поэтому невидимые хит-зоны кнопок (обычный паттерн проекта: `new PIXI.Graphics();
    // beginFill(color, 0.001-0.01); drawRect(0,0,w,h); interactive=true;`, см. bosses_fight.js
    // ._openNoWeaponPopup hitBuy/hitCancel, yashik.js makeHit и т.д.) вообще нельзя было
    // выбрать и подвинуть/растянуть — приходилось чинить рассинхрон хитбокса и картинки
    // вручную по коду. Теперь такие Graphics-хитбоксы тоже ловятся: маленький (не больше
    // типичной кнопки) interactive Graphics без собственных детей — то есть НЕ
    // полноэкранный blocker/capture-слой (те специально исключены по размеру, иначе редактор
    // бы предлагал "двигать" сам перехватчик кликов).
    const HITBOX_MAX_W = 400, HITBOX_MAX_H = 160;
    const _looksLikeHitbox = (child) => child instanceof PIXI.Graphics
        && child.interactive === true
        && !(child.children && child.children.length);

    proto._uCollectAt = function(node, gx, gy, results){
        if(!node || node.visible === false || !node.children) return results;
        for(let i = node.children.length - 1; i >= 0; i--){
            const child = node.children[i];
            if(child === this._uCapture || child === this._editBtn ||
               child === this._uReadout || child === this._uCopyBtn || child === this._uSuperCopyBtn || child === this._uBoxBtn ||
               child === this._uHoverBox) continue;
            if(!child.visible) continue;
            if(child.children && child.children.length) this._uCollectAt(child, gx, gy, results);
            if(child._uIsCenterTextLabel) continue; // текст-образец текст-бокса — двигается только вместе с боксом
            const isHitbox = _looksLikeHitbox(child);
            if(child instanceof PIXI.Sprite || child instanceof PIXI.Text || child._uDraggable === true || isHitbox){
                const b = child.getBounds();
                if(isHitbox && (b.width > HITBOX_MAX_W || b.height > HITBOX_MAX_H)) continue; // похоже на blocker/capture, не кнопка
                if(b.width > 0 && b.height > 0 && gx >= b.x && gx <= b.x + b.width && gy >= b.y && gy <= b.y + b.height){
                    results.push(child);
                }
            }
        }
        return results;
    };

    // Список ВСЕХ объектов под точкой, topmost first, с учётом того же приоритета слоёв
    // и блокировки "сквозь модалку", что и раньше был в _uFindTopmost (см. её комментарий
    // ниже про fullscreen-blocker).
    proto._uFindAllAt = function(gx, gy){
        const l2 = this._uCollectAt(root.layer2_mc, gx, gy, []);
        if(l2.length) return l2;
        if(this._uHasFullscreenBlocker(root.layer2_mc)) return [];
        return this._uCollectAt(root.layer1_mc, gx, gy, []).concat(this._uCollectAt(root.layer0_mc, gx, gy, []));
    };

    // Отдельные объекты, помеченные вручную флагом obj._uDraggable = true (например,
    // Graphics-точки вроде маркера награды в рулетке), тоже считаются целью — иначе
    // редактор видит только Sprite/Text и не даёт двигать произвольные Graphics-метки.
    // Флаг ставится явно на конкретном объекте, а не расширяется на все Graphics подряд —
    // иначе под курсор попадали бы даже полноэкранные blocker'ы.
    //
    // Если в layer2_mc открыт модальный экран (у ЛЮБОГО такого экрана по конвенции
    // проекта первым делом идёт полноэкранный interactive Graphics-"blocker" 1280×720 —
    // см. CLAUDE.md, "Паттерн нового PIXI-экрана"), не пробиваем его взглядом дальше —
    // иначе при промахе мимо всех Sprite/Text ЭТОГО экрана (например, курсор попал на
    // прозрачный/нераспознанный по bounds участок) редактор находит и позволяет
    // утащить объекты СКРЫТОГО ПОЗАДИ экрана (например, задний фон главного меню
    // из-под окна боя с боссом — так и было обнаружено). Если модалки нет вообще
    // (base-экран, HUD) — ищем как обычно в HUD/игровом мире.
    proto._uFindTopmost = function(gx, gy){
        const all = this._uFindAllAt(gx, gy);
        return all.length ? all[0] : null;
    };

    // Ищет хоть один видимый interactive PIXI.Graphics с bounds на весь канвас (1280×720) —
    // признак открытого модального экрана по стандартному паттерну проекта (blocker — всегда
    // первый child любого нового оверлея). Используется, чтобы не пробивать такой экран
    // хит-тестом насквозь до нижних слоёв.
    proto._uHasFullscreenBlocker = function(node){
        if(!node || node.visible === false || !node.children) return false;
        for(const child of node.children){
            if(child.visible === false) continue;
            if(child instanceof PIXI.Graphics && child.interactive){
                const b = child.getBounds();
                if(b.width >= 1270 && b.height >= 710) return true;
            }
            if(this._uHasFullscreenBlocker(child)) return true;
        }
        return false;
    };

    // Рисует рамку вокруг объекта под курсором (или вокруг того, что сейчас тащим) —
    // getBounds() уже в глобальных координатах канваса, а hoverBox лежит прямо в root
    // (без своей трансформации), так что рамку можно рисовать теми же цифрами 1:1.
    proto._uUpdateHoverBox = function(obj){
        if(!this._uHoverBox) return;
        if(!obj){
            this._uHoverBox.visible = false;
            this._uHovered = null;
            return;
        }
        this._uHovered = obj;
        const b = obj.getBounds();
        this._uHoverBox.clear();
        this._uHoverBox.lineStyle(2, 0xffcc00, 0.95);
        if(obj._uHitShape === 'parallelogram' && Array.isArray(obj._uHitPolygon)){
            const outline = [];
            for(let i = 0; i < obj._uHitPolygon.length; i += 2){
                const global = obj.toGlobal(new PIXI.Point(obj._uHitPolygon[i], obj._uHitPolygon[i + 1]));
                outline.push(global.x, global.y);
            }
            this._uHoverBox.drawPolygon(outline);
        } else {
            this._uHoverBox.drawRect(b.x, b.y, b.width, b.height);
        }
        this._uHoverBox.visible = true;
    };

    // Достаёт имя файла текстуры объекта, ЧЕЛОВЕКОЧИТАЕМОЕ (decodeURIComponent) — PIXI грузит
    // кириллические пути через обычный <img>.src, браузер сам URL-кодирует их при чтении
    // обратно (resource.url), поэтому без decode здесь была бы нечитаемая строка вида
    // "%D0%B3%D0%B0%D0%BB..." (баг найден по прямому указанию + скриншот — "название файла
    // нечитаемое"). Общий хелпер — используется и в читаемой панели, и в копировании (см. ниже).
    proto._uFileLabel = function(s){
        try{
            const url = s.texture && s.texture.baseTexture && s.texture.baseTexture.resource
                ? (s.texture.baseTexture.resource.url || '') : '';
            if(!url) return null;
            const raw = url.split('/').pop();
            try{ return decodeURIComponent(raw); } catch(e){ return raw; } // decode может кинуть на битой escape-последовательности — тогда хотя бы сырую строку
        } catch(e){ return null; }
    };

    proto._uUpdateReadout = function(extra){
        if(!this._uReadout) return;
        if(extra){ this._uReadout.text = extra; return; }
        const s = this._uSelected;
        if(!s){ this._uReadout.text = 'Кликните и тащите любой объект.'; return; }
        let label = '(без имени)';
        try{
            if(s._uIsTextBox) label = '▭ Текст-бокс (для _centerTextIn — Delete удаляет)';
            else if(s instanceof PIXI.Text) label = 'Текст: "' + String(s.text).slice(0, 24) + '"';
            else label = this._uFileLabel(s) || '(без текстуры)';
        } catch(e){}
        // Показываем и scale, и итоговый width/height в пикселях — scale у разных объектов
        // законно отличается (зависит от нативного разрешения исходной картинки), а вот
        // width/height — это то, что реально видно на экране, и должно совпадать у одинаковых
        // по смыслу объектов (например, у карт покера — все должны быть одного размера).
        const scaleTxt = s.scale ? '  scale: ' + s.scale.x.toFixed(3) : '';
        const sizeTxt  = '  w: ' + Math.round(s.width) + '  h: ' + Math.round(s.height);
        // 18.09.2026: поворот теперь универсален для любого объекта (раньше — только с
        // флагом _uRotatable), поэтому rot показываем всегда, без условия.
        const rotTxt   = '  rot: ' + Math.round((s.rotation || 0) * 180 / Math.PI) + '°';
        const widthTxt = (typeof s._uAdjustWidth === 'function') ? '  halfAngle: ' + (s._uHalfAngleDeg || 0).toFixed(1) + '°' : '';
        const hint = '\n(стрелки — 1px, Shift — 10px, PageUp/PageDown — размер, Q/E — поворот, мышью за жёлтые квадратики — resize ширины/высоты)'
            + (typeof s._uAdjustWidth === 'function' ? ' , ,/. — угол' : '');
        this._uReadout.text = 'Выбрано: ' + label + '\nx: ' + Math.round(s.x) + '  y: ' + Math.round(s.y) + scaleTxt + sizeTxt + rotTxt + widthTxt + hint;
    };

    // 25.09.2026 (баг найден по прямому указанию — "координаты не копируются, добавь ещё имя
    // файла"): два независимых фикса разом.
    // 1) navigator.clipboard.writeText() тихо не срабатывал — VK Mini App открыт в iframe
    //    ВК-страницы, а async Clipboard API подчиняется Permissions Policy этого iframe; без
    //    явного "clipboard-write" в её allow-списке метод либо отсутствует вовсе
    //    (navigator.clipboard === undefined — тогда старый код просто ничего не делал, даже
    //    console.error не печатался), либо промис молча реджектится. Добавлен синхронный
    //    fallback через document.execCommand('copy') (см. _uTryFallbackCopy ниже) — устаревший
    //    API, но не завязан на ту же Permissions Policy, срабатывает чаще внутри строгих iframe,
    //    ПОКА вызван синхронно в рамках текущего user gesture (клика по кнопке).
    // 2) Имя файла (через новый общий _uFileLabel(), человекочитаемое — см. коммент там) теперь
    //    идёт ПЕРВЫМ в копируемом тексте — то, что как раз нужно, чтобы продиктовать правку без
    //    восстановления по скриншоту, какому предмету принадлежат x/y/scale.
    proto._uCopySelected = function(){
        if(!this._uSelected){ if(window.notify) notify.showResult({text:'Сначала выберите объект'}, 0); return; }
        const s = this._uSelected;
        const fileLabel = s._uIsTextBox ? null : this._uFileLabel(s);
        const filePrefix = fileLabel ? (fileLabel + ' — ') : '';
        // Текст-бокс копируется как готовый {x,y,w,h} — ровно та форма, что принимает
        // window._centerTextIn(text, box) (ui_kit.js), без scale (для боксов не нужен) и без
        // имени файла (у текст-бокса его нет).
        const text = s._uIsTextBox
            ? '{x: ' + Math.round(s.x) + ', y: ' + Math.round(s.y) + ', w: ' + Math.round(s.width) + ', h: ' + Math.round(s.height) + '}'
            : filePrefix + 'x: ' + Math.round(s.x) + ', y: ' + Math.round(s.y) + (s.scale ? ', scale: ' + s.scale.x.toFixed(3) : '');
        console.log('[universal_pos_editor._uCopySelected]', text);

        // Что бы ни случилось с буфером обмена — текст ВСЕГДА виден на панели, его можно
        // перепечатать/сфотографировать, если оба способа копирования не сработали.
        this._uUpdateReadout('Скопировано (или см. текст ниже, если буфер обмена недоступен):\n' + text);

        const _report = (ok) => {
            if(window.notify) notify.showResult({text: (ok ? 'Скопировано: ' : 'Буфер обмена недоступен, текст показан на панели: ') + text}, ok ? 1 : 0);
        };

        if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(text).then(
                () => _report(true),
                (e) => {
                    console.error('[universal_pos_editor._uCopySelected] Clipboard API отклонён (обычно — Permissions Policy VK-iframe), пробую execCommand:', e);
                    _report(this._uTryFallbackCopy(text));
                }
            );
        } else {
            // navigator.clipboard целиком отсутствует — частый случай для встроенного VK-iframe
            // без разрешения на буфер обмена. Сразу пробуем синхронный fallback.
            _report(this._uTryFallbackCopy(text));
        }
    };

    // 25.09.2026 (по прямому указанию — "ещё сделай кнопку супер копирования, которая копирует
    // ещё угол поворота, высоту и ширину объекта"): та же схема, что _uCopySelected() выше
    // (Clipboard API → fallback → readout всегда обновляется), просто в текст добавлены
    // rotation (переведён из радиан в градусы, тот же приём, что TEXT_ROTATION_DEG по всему
    // проекту) и фактические w/h (s.width/s.height — уже с учётом scale, та же формула, что
    // текст-бокс уже использует для себя).
    proto._uCopySelectedSuper = function(){
        if(!this._uSelected){ if(window.notify) notify.showResult({text:'Сначала выберите объект'}, 0); return; }
        const s = this._uSelected;
        const fileLabel = s._uIsTextBox ? null : this._uFileLabel(s);
        const filePrefix = fileLabel ? (fileLabel + ' — ') : '';
        const rotDeg = Math.round((s.rotation || 0) * 180 / Math.PI);
        const text = filePrefix + 'x: ' + Math.round(s.x) + ', y: ' + Math.round(s.y)
            + (s.scale ? ', scale: ' + s.scale.x.toFixed(3) : '')
            + ', rot: ' + rotDeg + '°'
            + ', w: ' + Math.round(s.width) + ', h: ' + Math.round(s.height);
        console.log('[universal_pos_editor._uCopySelectedSuper]', text);

        this._uUpdateReadout('Скопировано (супер, или см. текст ниже, если буфер обмена недоступен):\n' + text);

        const _report = (ok) => {
            if(window.notify) notify.showResult({text: (ok ? 'Скопировано: ' : 'Буфер обмена недоступен, текст показан на панели: ') + text}, ok ? 1 : 0);
        };

        if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(text).then(
                () => _report(true),
                (e) => {
                    console.error('[universal_pos_editor._uCopySelectedSuper] Clipboard API отклонён, пробую execCommand:', e);
                    _report(this._uTryFallbackCopy(text));
                }
            );
        } else {
            _report(this._uTryFallbackCopy(text));
        }
    };

    // Копирование через скрытый <textarea> + document.execCommand('copy') — классический
    // fallback, не зависящий от той же асинхронной Permissions Policy, что и Clipboard API;
    // должен вызываться СИНХРОННО в рамках user gesture (здесь — прямо из клика по кнопке или
    // из rejection-колбэка того же клика), иначе браузер тоже откажет.
    proto._uTryFallbackCopy = function(text){
        try{
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.top = '-9999px';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch(e){
            console.error('[universal_pos_editor._uTryFallbackCopy] execCommand(copy) тоже недоступен:', e);
            return false;
        }
    };

    proto._disableUniversalEdit = function(){
        if(this._uActiveScanInterval){ clearInterval(this._uActiveScanInterval); this._uActiveScanInterval = null; }
        if(this._uForcedVisible){
            this._uForcedVisible.forEach(spr => { spr.visible = false; });
            this._uForcedVisible = null;
        }
        if(this._uCapture){
            if(this._uCapHandlers){
                this._uCapture.off('pointerdown', this._uCapHandlers.onDown);
                this._uCapture.off('pointermove', this._uCapHandlers.onMove);
                this._uCapture.off('pointerup', this._uCapHandlers.onUp);
                this._uCapture.off('pointerupoutside', this._uCapHandlers.onUp);
            }
            if(this._uCapture.parent) this._uCapture.parent.removeChild(this._uCapture);
            this._uCapture = null;
        }
        if(this._uReadout && this._uReadout.parent) this._uReadout.parent.removeChild(this._uReadout);
        if(this._uCopyBtn && this._uCopyBtn.parent) this._uCopyBtn.parent.removeChild(this._uCopyBtn);
        if(this._uSuperCopyBtn && this._uSuperCopyBtn.parent) this._uSuperCopyBtn.parent.removeChild(this._uSuperCopyBtn);
        if(this._uBoxBtn && this._uBoxBtn.parent) this._uBoxBtn.parent.removeChild(this._uBoxBtn);
        if(this._uHoverBox && this._uHoverBox.parent) this._uHoverBox.parent.removeChild(this._uHoverBox);
        if(this._uDebugTxt && this._uDebugTxt.parent) this._uDebugTxt.parent.removeChild(this._uDebugTxt);
        // Текст-боксы — временные разметочные объекты редактора, не часть игры: убираем все
        // разом при выходе из режима, чтобы не оставлять "призраков" на экране после закрытия.
        if(this._uTextBoxes){
            this._uTextBoxes.forEach(box => {
                if(box._uCenterText && box._uCenterText.parent) box._uCenterText.parent.removeChild(box._uCenterText);
                if(box.parent) box.parent.removeChild(box);
            });
            this._uTextBoxes = [];
        }
        this._uReadout = null; this._uCopyBtn = null; this._uSuperCopyBtn = null; this._uBoxBtn = null; this._uHoverBox = null; this._uHovered = null; this._uDebugTxt = null;
        if(this._uKeyHandler){ window.removeEventListener('keydown', this._uKeyHandler, true); this._uKeyHandler = null; }
        this._uDestroyHandles();
        this._uDrag = null; this._uSelected = null; this._uResizeDrag = null;
        console.log('[universal_pos_editor._disableUniversalEdit] выключено');
    };
}
