/** Общий скролл-лист для вкладок Сводки (топы/достижения) — тот же паттерн перетаскивания
 * бегунка + колесо мыши, что уже используется в bosses_select.js (scroll_track/scroll_thumb),
 * только с ассетами Сводки (шкала скрола.png / скрол.png / свод стрелка вверх.png / свод
 * стрелка вниз.png) и отдельными кнопками пошагового скролла (их не было у боссов).
 *
 * Аудит 17.09.2026: раньше здесь были 'стрелка вверх.png'/'стрелка вниз.png' — те же самые
 * имена, что zone_screen.js использует для пагинации Зоны (неактивное состояние там —
 * стрелка-кнопка в стиле металлической рамки 52×50, как активная, только серая). Обе фичи
 * писали в один и тот же файл на сервере — какая заливалась позже, та и оставалась, поэтому
 * то Зона получала маленькую плоскую иконку скролла Сводки, то наоборот (репорт: "перепутал
 * стрелку, это тот файл, который добавляли для другой фичи"). Переименовано на свои,
 * однозначные имена — переиспользует оригинальные маленькие плоские иконки (то, что здесь
 * и было изначально нужно), Зона получила обратно свою метал-рамку.
 */
export function attachSvodScroll(proto){
    const IMG = './images/';

    // cfg: { parent, contentContainer, viewX, viewY, viewW, viewH, trackX, trackY,
    //        arrowUpY, arrowDownY, stepPx, getTotalH }
    // Возвращает { refresh(), scrollToTop(), destroy() } — refresh() вызывать при изменении общей
    // высоты контента (смена страницы/фильтра), scrollToTop() — когда список заменён другими
    // данными и позицию прокрутки сохранять не нужно.
    proto._buildSvodScroll = function(cfg){
        const { parent, contentContainer, viewX, viewY, viewW, viewH, trackX, arrowX, stepPx, arrowUpY, arrowDownY } = cfg;

        // 22.09.2026 (по прямому указанию — "сверху есть отступ когда начинаешь листать, а
        // снизу ячейки выходят за рамки фона, исправь и добавь редактирование таких блоков,
        // потому что есть такая проблема не только здесь"): маска сделана РЕДАКТИРУЕМОЙ через
        // universal_pos_editor.js — тот же общий механизм _uDraggable, что уже используется
        // для текст-боксов (centerTextIn) и Graphics-хитбоксов, БЕЗ единой правки в самом
        // редакторе (_uCollectAt уже подхватывает любой объект с _uDraggable=true). Геометрия
        // прямоугольника теперь рисуется в (0,0) локальных координат, а не сразу в
        // (viewX,viewY) — сам offset вынесен в maskGfx.x/y, чтобы редактор показывал x/y как
        // ПРЯМОЕ значение viewX/viewY (готовое для копирования в код), а не 0/0 + смещение.
        const maskGfx = new PIXI.Graphics();
        maskGfx.beginFill(0xffffff);
        maskGfx.drawRect(0, 0, viewW, viewH);
        maskGfx.endFill();
        maskGfx.x = viewX; maskGfx.y = viewY;
        // ВАЖНО: interactive НЕ ставим — universal_pos_editor.js._uCollectAt() ищет объекты
        // своим собственным ручным bounds-тестом (проверяет только флаг _uDraggable), а не
        // через штатный PIXI hit-test. Если бы тут стоял interactive=true, маска (добавленная
        // в `parent` ПОСЛЕ cardsContainer — значит выше по z-order) перехватывала бы клики по
        // карточкам НАВСЕГДА, а не только в режиме редактора — сломался бы аккордеон
        // (разворачивание темы по клику).
        maskGfx._uDraggable = true;
        parent.addChild(maskGfx);
        contentContainer.mask = maskGfx;

        const track = new PIXI.Sprite(PIXI.Texture.from(IMG + 'шкала скрола.png'));
        track.x = trackX; track.y = viewY;
        parent.addChild(track);

        // 23.09.2026 (по прямому указанию — репорт "стрелка вниз не отображается" на экране
        // "Топ по авторитету/урону"): формула viewY+viewH+2 давала Y≈480, не совпадающую с
        // измеренной пользователем целевой позицией (X:1034 Y:461) — теперь caller может
        // передать arrowUpY/arrowDownY явно (эти поля уже были в JSDoc cfg выше, но раньше не
        // читались), формула остаётся дефолтом для тех caller'ов, что явно не передали override
        // (см. svod-achievements.js — там формула по-прежнему подходит, отдельно не репортили).
        const arrowUp = new PIXI.Sprite(PIXI.Texture.from(IMG + 'свод стрелка вверх.png'));
        arrowUp.x = arrowX; arrowUp.y = (arrowUpY !== undefined) ? arrowUpY : viewY - 32;
        arrowUp.interactive = true; arrowUp.buttonMode = true;
        parent.addChild(arrowUp);

        const arrowDown = new PIXI.Sprite(PIXI.Texture.from(IMG + 'свод стрелка вниз.png'));
        arrowDown.x = arrowX; arrowDown.y = (arrowDownY !== undefined) ? arrowDownY : viewY + viewH + 2;
        arrowDown.interactive = true; arrowDown.buttonMode = true;
        parent.addChild(arrowDown);

        // 22.09.2026 (по прямому указанию — "сдвинь скролл в сводке влево на 1px"): -1 добавлен
        // к уже центрированной позиции бегунка относительно трека.
        const thumb = new PIXI.Sprite(PIXI.Texture.from(IMG + 'скрол.png'));
        thumb.x = trackX - Math.round((thumb.width - track.width) / 2) - 1;
        thumb.interactive = true; thumb.buttonMode = true;
        parent.addChild(thumb);

        // 22.09.2026 (баг найден по прямому указанию — "скролл должен двигаться строго по
        // шкале скролла, но он выходит за границы"): раньше диапазон движения бегунка считался
        // от viewY/viewH (высота ВИДИМОЙ ОБЛАСТИ СПИСКА, mask-контейнера) — а не от реальных
        // размеров самого трека ("шкала скрола.png", нативная высота 242px). Для лидерборда
        // viewH тоже был 242, поэтому баг был не виден; когда viewH достижений подняли до 332
        // (чтобы вместить 4-ю карточку, см. коммент у LIST_H в svod-achievements.js), бегунок
        // стал уезжать на 90px (332-242) ниже физического низа нарисованного трека. Диапазон
        // теперь считается от track.y/track.height — бегунок гарантированно не выходит за
        // пределы того, что реально нарисовано.
        let trackTop = track.y, trackBottom = track.y + track.height - thumb.height;
        let scrollRange = 0;
        let scrollY = 0;

        const applyScroll = () => {
            contentContainer.y = viewY - scrollY;
            const ratio = scrollRange > 0 ? scrollY / scrollRange : 0;
            thumb.y = trackTop + ratio * Math.max(0, trackBottom - trackTop);
        };

        const setScroll = (val) => {
            scrollY = Math.max(0, Math.min(scrollRange, val));
            applyScroll();
        };

        let dragging = false, dragStartY = 0, thumbStartY = 0;
        thumb.on('pointerdown', (e)=>{
            dragging = true;
            dragStartY = e.data.global.y;
            thumbStartY = thumb.y;
            const dragRoot = window.root || parent;
            dragRoot.on('pointermove', onMove);
            dragRoot.on('pointerup', onUp);
            dragRoot.on('pointerupoutside', onUp);
        });
        const onMove = (e)=>{
            if(!dragging) return;
            let ny = thumbStartY + (e.data.global.y - dragStartY);
            ny = Math.max(trackTop, Math.min(trackBottom, ny));
            const ratio = (trackBottom > trackTop) ? (ny - trackTop) / (trackBottom - trackTop) : 0;
            setScroll(ratio * scrollRange);
        };
        const onUp = ()=>{
            dragging = false;
            const dragRoot = window.root || parent;
            dragRoot.off('pointermove', onMove);
            dragRoot.off('pointerup', onUp);
            dragRoot.off('pointerupoutside', onUp);
        };

        arrowUp.on('pointerdown',   ()=> setScroll(scrollY - stepPx));
        arrowDown.on('pointerdown', ()=> setScroll(scrollY + stepPx));

        const onWheel = (e)=>{
            if(!parent.visible) return;
            setScroll(scrollY + e.deltaY * 0.6);
        };
        const canvas = document.querySelector('canvas');
        if(canvas) canvas.addEventListener('wheel', onWheel, {passive: true});

        // 28.09.2026 (адаптив под мобильные): свайп-прокрутка пальцем прямо по содержимому.
        // До этого список листался ТОЛЬКО колесом мыши (на телефоне колеса нет), стрелками и
        // перетаскиванием бегунка шириной ~20px — то есть пальцем список был почти неюзабелен.
        //
        // Почему это нельзя было сделать раньше: карточки внутри списка реагировали на
        // 'pointerdown', то есть срабатывали в момент касания — любой свайп, начатый с карточки,
        // сначала её нажимал. Сперва карточки переведены на helper.onTap (тап = pointerup без
        // смещения), см. svod-achievements.js/svod-leaderboard.js, и только потом появился этот
        // обработчик.
        //
        // Поверхность drag (прозрачный прямоугольник во всю область списка) добавляется ПЕРВОЙ —
        // то есть лежит НИЖЕ содержимого и не перехватывает нажатия по карточкам: она нужна
        // только чтобы ловить протяжки, начатые в пустом месте между карточками. Протяжки,
        // начатые с карточки, приходят сюда всплытием события до parent.
        //
        // Только для тач-устройств: на десктопе колесо уже работает, а drag мышью по списку
        // конфликтовал бы с привычным поведением и с перетаскиванием бегунка.
        // Снятие слушателей хранится в ЛОКАЛЬНОЙ переменной, а не на this: вкладки Сводки
        // (достижения и топ) строят каждая свой скролл на одном и том же объекте svod —
        // поле на this вторая сборка просто затёрла бы, и слушатели первой остались бы навсегда.
        let dragCleanup = null;
        let dragScrollActive = false, dragStartPointerY = 0, dragStartScrollY = 0;
        if(window.isMobile){
            const dragSurface = new PIXI.Graphics();
            dragSurface.beginFill(0x000000, 0.0001);   // невидимая, но участвует в хит-тесте
            dragSurface.drawRect(viewX, viewY, viewW, viewH);
            dragSurface.endFill();
            dragSurface.interactive = true;
            parent.addChildAt(dragSurface, 0);

            const onDragStart = (e)=>{
                if(!parent.visible || scrollRange <= 0) return;
                // Бегунок и стрелки — дети того же parent, их нажатия ВСПЛЫВАЮТ сюда. Без этой
                // проверки перетаскивание бегунка запускало бы вдобавок протяжку содержимого, и
                // список уезжал бы вдвое быстрее пальца.
                const t = e.target;
                if(t === thumb || t === arrowUp || t === arrowDown) return;
                dragScrollActive   = true;
                dragStartPointerY  = e.data.global.y;
                dragStartScrollY   = scrollY;
            };
            const onDragMove = (e)=>{
                if(!dragScrollActive) return;
                // Содержимое едет ЗА пальцем: палец вниз — список вниз, как в любом нативном списке.
                setScroll(dragStartScrollY - (e.data.global.y - dragStartPointerY));
            };
            const onDragEnd = ()=>{ dragScrollActive = false; };

            dragSurface.on('pointerdown', onDragStart);
            parent.on('pointerdown', onDragStart);
            // move/up слушаем на корне сцены, а не на поверхности: палец во время протяжки
            // почти всегда уезжает за пределы исходного объекта, и события до него уже не дойдут.
            if(window.root){
                root.on('pointermove',      onDragMove);
                root.on('pointerup',        onDragEnd);
                root.on('pointerupoutside', onDragEnd);
            }
            dragCleanup = () => {
                if(!window.root) return;
                root.off('pointermove',      onDragMove);
                root.off('pointerup',        onDragEnd);
                root.off('pointerupoutside', onDragEnd);
            };
        }

        const refresh = () => {
            const totalH = cfg.getTotalH();
            scrollRange = Math.max(0, totalH - viewH);
            trackBottom = track.y + track.height - thumb.height;
            const canScroll = scrollRange > 0;
            track.visible = arrowUp.visible = arrowDown.visible = thumb.visible = canScroll;
            setScroll(Math.min(scrollY, scrollRange));
        };

        // scrollToTop — 27.09.2026 (вместе с подъёмом пула строк топа до 100, см.
        // svod-leaderboard.js): refresh() намеренно СОХРАНЯЕТ текущую позицию (setScroll(min(
        // scrollY, scrollRange))), это верно для достижений (аккордеон разворачивается на месте,
        // список не должен прыгать наверх), но не для перезагрузки списка топа другими данными.
        // Отдельный метод — чтобы не менять поведение refresh() для остальных вызывающих.
        return {
            refresh,
            scrollToTop: () => setScroll(0),
            destroy: () => {
                if(canvas) canvas.removeEventListener('wheel', onWheel);
                // Слушатели свайпа висят на КОРНЕ сцены (см. коммент выше) — без явного снятия
                // они пережили бы закрытие Сводки и продолжили дёргать setScroll уже мёртвого
                // списка при каждом движении пальца по любому экрану игры.
                if(dragCleanup) dragCleanup();
            },
        };
    };
}
