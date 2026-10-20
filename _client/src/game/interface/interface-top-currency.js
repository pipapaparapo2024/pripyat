/** Верхний HUD — блок валют (рубли/тушёнка/сухари), новый визуал поверх старого FLA-объекта.
 *
 * 17.10.2026 (по прямому указанию — отказ от сигарет, модерация VK): старые val_stew/val_coins/
 * val_cigarettes — скомпилированный FLA-объект (interface_elements.min.js, правило №2 AGENTS.md
 * запрещает его редактировать), три фиксированные плашки без кнопок покупки и без возможности
 * свернуть/развернуть. Полностью заменяется новым виджетом в чистом JS: старые объекты не
 * удаляются (трогать FLA-результат нельзя), а просто прячутся (visible=false, interactive=false).
 *
 * Раскладка (абсолютные координаты iface.up, продиктованы пользователем через позиционный
 * обзор макета):
 *   "Рубли"-плашка (переменные сохранили старое имя, 20.10.2026 стала показывать СУХАРИ —
 *             см. ниже) — плашка (910,5), иконка (909,9) → попап покупки (вкладка "сухари"),
 *             кнопка "+" (1091,12) → то же
 *   Верхняя строка (всегда видна) — плашка (676,5), иконка (683,10) → покупка закреплённой валюты
 *             (this._topCurPinned), кнопка ▼ (857,12) — ЧИСТЫЙ тоггл, только раскрывает/прячет
 *             нижнюю строку.
 *   Нижняя строка (скрыта по умолчанию, раскрывается кнопкой ▼) — плашка (676,53), иконка (691,59),
 *             текст (757,68), кнопка "+" (858,60) → покупка НЕ закреплённой валюты.
 *
 * 20.10.2026 (по прямому указанию — "плашки, которые сменяют друг друга, пусть будут тушёнка и
 * рубли [не тушёнка и сухари], а правая плашка, где просто плюс, пусть будет сухари"):
 * цикл верхней/нижней строки (this._topCurPinned) теперь stew↔coins (CUR_META ниже), а
 * статичная правая плашка (переменные plateRub/iconRub/txtRub/btnRubPlus — имена оставлены
 * историческими, не переименовывались ради минимальной правки) показывает сухари вместо рублей.
 *
 * 18.10.2026 (по прямому указанию — "смысл стрелки не тот: нажал на выдвинувшиеся сухари —
 * шторка закрылась, сухари остались СВЕРХУ"): верхняя/нижняя строка больше не жёстко = тушёнка/
 * сухари — какая валюта где, решает this._topCurPinned ('stew' по умолчанию). Клик по иконке
 * раскрытой (нижней) строки меняет местами закреплённую и раскрытую валюту и сворачивает шторку
 * — вместо открытия покупки (покупка нижней строки осталась на отдельной кнопке "+").
 *
 * 18.10.2026 (по прямому указанию — "пройдись по всему проекту где есть покупка, FLA → обычные
 * изображения"): все 3 точки входа + кнопка "магазин" раньше вели на старое FLA-окно банка
 * (bank.init) — теперь все ведут в один новый 3-вкладочный попап, см.
 * interface-currency-purchase.js (iface._openCurrencyPurchasePopup(tab)).
 *
 * Текст суммы — свой PIXI.Text на каждую плашку, т.к. одна плашка переиспользуется 3 раза без
 * встроенного текстового поля (в отличие от старого Up_panel_val, где text был частью объекта).
 */
export function attachTopCurrency(proto){

    const BASE = './images/';
    // 18.10.2026 (по прямому указанию — прислан реальный .ttf): шрифт верхнего худа.
    const TXT_STYLE = { fontFamily: 'Bebas Neue Pro Middle', fontSize: 28, fill: '#d6d5d5' };

    // 18.10.2026 (по прямому указанию — "смысл стрелки не тот: если нажал на кнопку вниз,
    // появилась плашка снизу, и если нажал на выдвинувшиеся сухари, шторка закрылась, сухари
    // ОСТАЛИСЬ СВЕРХУ"): верхняя (всегда видимая) и нижняя (раскрывающаяся) строки больше не
    // жёстко привязаны к тушёнке/сухарям — какая валюта где показывается, решает
    // this._topCurPinned ('stew' или 'cigarettes', тушёнка по умолчанию). Клик по самой
    // раскрытой строке (не по кнопке "+") меняет местами закреплённую и раскрытую валюту и
    // сворачивает шторку — именно так, как описано.
    // 20.10.2026 (по прямому указанию): цикл верхней/нижней строки сменил вторую валюту с
    // сухарей на рубли (сухари переехали на отдельную статичную плашку справа — см. iconRub
    // ниже) — ключ 'cigarettes' заменён на 'coins'.
    const CUR_META = {
        stew:  { icon: 'верхний худ иконка тушняк.png', field: 'stew' },
        coins: { icon: 'верхний худ иконка рубли.png', field: 'coins' },
    };
    const otherKey = (k) => k === 'stew' ? 'coins' : 'stew';

    proto._buildTopCurrencyWidget = function(){
        const up = this.up;
        if(!up || this._topCurrencyBuilt) return;
        this._topCurrencyBuilt = true;
        this._topCurrencyExpanded = false;
        this._topCurPinned = 'stew';

        // Старые FLA-плашки и кнопка банка — прячем, не удаляем (правило №2 AGENTS.md).
        ['val_stew', 'val_coins', 'val_cigarettes'].forEach(k => {
            if(up[k]){ up[k].visible = false; up[k].interactive = false; }
        });
        if(up.butt_bank){ up.butt_bank.visible = false; up.butt_bank.interactive = false; }
        if(up.butt_settings){ up.butt_settings.visible = false; up.butt_settings.interactive = false; }
        if(up.butt_settings_icon){ up.butt_settings_icon.visible = false; }

        const bg = new PIXI.Sprite(PIXI.Texture.from(BASE + 'верхний худ фон полоса.png'));
        bg.x = 0; bg.y = 0;
        up.addChild(bg);

        const fmt = (v) => helper.formatKK(parseInt(v || 0));

        // ── Сухари (всегда видна; имена переменных исторические — 20.10.2026 эта плашка
        // показывала рубли, теперь показывает сухари, см. докблок файла) ──────────────────
        const plateRub = new PIXI.Sprite(PIXI.Texture.from(BASE + 'верхний худ плашка ресурса.png'));
        plateRub.x = 910; plateRub.y = 5;
        up.addChild(plateRub);

        const iconRub = new PIXI.Sprite(PIXI.Texture.from(BASE + 'верхний худ иконка сухари.png'));
        iconRub.x = 909; iconRub.y = 9;
        up.addChild(iconRub);

        const txtRub = new PIXI.Text('0', TXT_STYLE);
        txtRub.x = 995; txtRub.y = 19;
        up.addChild(txtRub);

        const btnRubPlus = new PIXI.Sprite(PIXI.Texture.from(BASE + 'верхний худ иконка плюс.png'));
        btnRubPlus.x = 1091; btnRubPlus.y = 12;
        btnRubPlus.interactive = true; btnRubPlus.buttonMode = true;
        if(window.isMobile && window.helper && typeof helper.touchPad === 'function') helper.touchPad(btnRubPlus);
        if(typeof this._addHoverBright === 'function') this._addHoverBright(btnRubPlus);
        // 18.10.2026 (по прямому указанию — "FLA → обычные изображения" для всех точек
        // покупки): раньше вело на старое FLA-окно банка (bank.init), теперь — на новый
        // 3-вкладочный попап (interface-currency-purchase.js).
        btnRubPlus.on('pointerdown', () => {
            if(typeof this._openCurrencyPurchasePopup === 'function') this._openCurrencyPurchasePopup('cigarettes');
        });
        up.addChild(btnRubPlus);

        // ── Верхняя строка (всегда видна — показывает this._topCurPinned, по умолчанию
        // тушёнка) ────────────────────────────────────────────────────────────
        const platePrimary = new PIXI.Sprite(PIXI.Texture.from(BASE + 'верхний худ плашка ресурса.png'));
        platePrimary.x = 676; platePrimary.y = 5;
        up.addChild(platePrimary);

        const iconPrimary = new PIXI.Sprite(PIXI.Texture.from(BASE + CUR_META.stew.icon));
        iconPrimary.x = 683; iconPrimary.y = 10;
        // 18.10.2026 (баг найден по прямому указанию — "развернул на сухари, закрыл шторку,
        // сухари остались [висеть развёрнутыми]"): раньше покупка тушёнки была ВТОРЫМ действием
        // кнопки-стрелки (клик по уже развёрнутому состоянию) — из-за этого у стрелки не было
        // отдельного пути просто СВЕРНУТЬ обратно, она не "убиралась". Покупка переехала на
        // клик по самой иконке верхней строки — стрелка теперь ВСЕГДА только раскрывает/прячет.
        iconPrimary.interactive = true; iconPrimary.buttonMode = true;
        if(window.isMobile && window.helper && typeof helper.touchPad === 'function') helper.touchPad(iconPrimary);
        if(typeof this._addHoverBright === 'function') this._addHoverBright(iconPrimary);
        iconPrimary.on('pointerdown', () => {
            if(typeof this._openCurrencyPurchasePopup === 'function') this._openCurrencyPurchasePopup(this._topCurPinned);
        });
        up.addChild(iconPrimary);

        const txtPrimary = new PIXI.Text('0', TXT_STYLE);
        txtPrimary.x = 765; txtPrimary.y = 20;
        up.addChild(txtPrimary);

        const btnToggle = new PIXI.Sprite(PIXI.Texture.from(BASE + 'верхний худ кнопка вниз.png'));
        // 20.10.2026 (по прямому указанию, редактор позиций — "x:857,y:12"): было 855,10.
        btnToggle.x = 857; btnToggle.y = 12;
        btnToggle.interactive = true; btnToggle.buttonMode = true;
        if(window.isMobile && window.helper && typeof helper.touchPad === 'function') helper.touchPad(btnToggle);
        if(typeof this._addHoverBright === 'function') this._addHoverBright(btnToggle);
        up.addChild(btnToggle);

        // ── Нижняя строка (скрыта по умолчанию — показывает "другую" валюту, та что
        // сейчас не закреплена наверху) ──────────────────────────────────────
        const plateSecondary = new PIXI.Sprite(PIXI.Texture.from(BASE + 'верхний худ плашка ресурса.png'));
        plateSecondary.x = 676; plateSecondary.y = 53; plateSecondary.visible = false;
        up.addChild(plateSecondary);

        // 18.10.2026 (по прямому указанию — "нажал на выдвинувшиеся сухари, шторка закрылась,
        // сухари остались сверху"): клик по самой раскрытой строке (не по кнопке "+" ниже)
        // закрепляет её валюту наверху вместо текущей, вместо открытия покупки.
        const _swapToSecondary = () => {
            this._topCurPinned = otherKey(this._topCurPinned);
            this._applyTopCurPinned();
            this._topCurrencyExpanded = false;
            this._applyTopCurrencyExpanded();
        };

        // 18.10.2026 (повторное указание тем же днём — "смена ресурса должна работать не
        // только при наведении на файл иконки, но и при наведении/клике на саму выдвинувшуюся
        // плашку"): раньше реагировала только iconSecondary (одна иконка внутри плашки) — сама
        // плашка-фон (plateSecondary, которая визуально и есть "выдвинувшийся блок") клики не
        // ловила. Теперь оба спрайта вешают один и тот же обработчик.
        plateSecondary.interactive = true; plateSecondary.buttonMode = true;
        if(window.isMobile && window.helper && typeof helper.touchPad === 'function') helper.touchPad(plateSecondary);
        if(typeof this._addHoverBright === 'function') this._addHoverBright(plateSecondary);
        plateSecondary.on('pointerdown', _swapToSecondary);

        const iconSecondary = new PIXI.Sprite(PIXI.Texture.from(BASE + CUR_META.coins.icon));
        iconSecondary.x = 691; iconSecondary.y = 59; iconSecondary.visible = false;
        iconSecondary.interactive = true; iconSecondary.buttonMode = true;
        if(window.isMobile && window.helper && typeof helper.touchPad === 'function') helper.touchPad(iconSecondary);
        if(typeof this._addHoverBright === 'function') this._addHoverBright(iconSecondary);
        iconSecondary.on('pointerdown', _swapToSecondary);
        up.addChild(iconSecondary);

        const txtSecondary = new PIXI.Text('0', TXT_STYLE);
        // 18.10.2026 (по прямому указанию, редактор позиций — "координаты кол-ва ресурсов у
        // плашки, которая выскакивает снизу: x:757,y:68"): было x:725,y:59.
        txtSecondary.x = 757; txtSecondary.y = 68; txtSecondary.visible = false;
        up.addChild(txtSecondary);

        const btnSecondaryPlus = new PIXI.Sprite(PIXI.Texture.from(BASE + 'верхний худ иконка плюс.png'));
        // 20.10.2026 (по прямому указанию, редактор позиций — "x:858,y:60"): было 856,62.
        btnSecondaryPlus.x = 858; btnSecondaryPlus.y = 60; btnSecondaryPlus.visible = false;
        btnSecondaryPlus.interactive = true; btnSecondaryPlus.buttonMode = true;
        if(window.isMobile && window.helper && typeof helper.touchPad === 'function') helper.touchPad(btnSecondaryPlus);
        if(typeof this._addHoverBright === 'function') this._addHoverBright(btnSecondaryPlus);
        btnSecondaryPlus.on('pointerdown', () => {
            if(typeof this._openCurrencyPurchasePopup === 'function') this._openCurrencyPurchasePopup(otherKey(this._topCurPinned));
        });
        up.addChild(btnSecondaryPlus);

        this._topCurRows = { iconPrimary, iconSecondary, plateSecondary, txtSecondary, btnSecondaryPlus };

        // Применяет видимость нижней строки к this._topCurrencyExpanded (используется и
        // тогглом, и свапом выше — свап всегда закрывает шторку после закрепления).
        this._applyTopCurrencyExpanded = function(){
            const expanded = this._topCurrencyExpanded;
            plateSecondary.visible = expanded; iconSecondary.visible = expanded;
            txtSecondary.visible = expanded; btnSecondaryPlus.visible = expanded;
        };

        // Перекрашивает иконки верхней/нижней строки под текущий this._topCurPinned —
        // вызывается при построении и при каждом свапе (иконка — единственное, что реально
        // меняется местами, позиции/плашки общие для обеих валют).
        this._applyTopCurPinned = function(){
            const secondaryKey = otherKey(this._topCurPinned);
            iconPrimary.texture = PIXI.Texture.from(BASE + CUR_META[this._topCurPinned].icon);
            iconSecondary.texture = PIXI.Texture.from(BASE + CUR_META[secondaryKey].icon);
            this._updateTopCurrency();
        };

        // 18.10.2026 (баг найден по прямому указанию — "развернул на сухари, захотел свернуть
        // обратно, нажал — шторка закрылась [попап покупки], а сухари остались висеть
        // развёрнутыми"): раньше второй клик по уже развёрнутой стрелке открывал покупку
        // тушёнки — у неё НЕ БЫЛО пути просто свернуться обратно, поэтому "не убиралась".
        // Покупка переехала на клик по иконке верхней строки (iconPrimary выше) — стрелка
        // теперь ЧИСТЫЙ тоггл, всегда просто показывает/прячет нижнюю строку.
        btnToggle.on('pointerdown', () => {
            this._topCurrencyExpanded = !this._topCurrencyExpanded;
            this._applyTopCurrencyExpanded();
        });

        // ── Магазин / настройки ──────────────────────────────────────────────
        const shopBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'верхний худ кнопка магазин.png'));
        shopBtn.x = 1146; shopBtn.y = 3;
        shopBtn.interactive = true; shopBtn.buttonMode = true;
        if(window.isMobile && window.helper && typeof helper.touchPad === 'function') helper.touchPad(shopBtn);
        if(typeof this._addHoverBright === 'function') this._addHoverBright(shopBtn);
        shopBtn.on('pointerdown', () => {
            if(typeof this._openCurrencyPurchasePopup === 'function') this._openCurrencyPurchasePopup('stew');
        });
        up.addChild(shopBtn);

        const settingsBtn = new PIXI.Sprite(PIXI.Texture.from(BASE + 'верхний худ кнопка настройки.png'));
        settingsBtn.x = 1214; settingsBtn.y = 0;
        settingsBtn.interactive = true; settingsBtn.buttonMode = true;
        if(window.isMobile && window.helper && typeof helper.touchPad === 'function') helper.touchPad(settingsBtn);
        if(typeof this._addHoverBright === 'function') this._addHoverBright(settingsBtn);
        settingsBtn.on('pointerdown', () => this._openSoundPopup());
        up.addChild(settingsBtn);

        // 18.10.2026 (по прямому указанию — "изображение игрока должно быть по z-индексу
        // выше, чем верхний худ"): up.ava — часть исходного FLA-объекта up_panel, значит
        // стала child'ом `up` ДО этого метода (конструктор/upInit() выполняются раньше) — все
        // новые спрайты виджета (фон/плашки/иконки), добавленные выше через up.addChild(),
        // рендерятся ПОВЕРХ неё. addChild на уже существующем child'е того же родителя не
        // клонирует — просто переносит его в конец списка (поверх всего), ничего не плодит.
        if(up.ava){
            up.addChild(up.ava);
            // 18.10.2026 (по прямому указанию — "хитбокс иконки игрока нужно уметь редактировать
            // и двигать в редакторе позиций"): up.ava — MovieClip из FLA-экспорта (не голый
            // Sprite/Text), поэтому universal_pos_editor.js._uCollectAt() не подбирал его
            // автоматически — тот же механизм, что уже используют произвольные Graphics-метки
            // (см. win._uDraggable в zone.js._showCpReward()).
            up.ava._uDraggable = true;
            // 20.10.2026 (по прямому указанию, редактор позиций — "окно/заглушка под иконку
            // игрока" x:12,y:8,scale:1.333,w:76,h:76): позиция/масштаб уточнены относительно
            // нативных FLA-координат.
            up.ava.x = 12; up.ava.y = 8;
            up.ava.scale.set(1.333);
        }

        this._topCur = { txtRub, txtPrimary, txtSecondary, fmt };
        this._applyTopCurPinned(); // ставит иконки под дефолтный pinned ('stew') + зовёт _updateTopCurrency

        // Шторка стартует свёрнутой — выставляем это явно поверх visible=false по умолчанию
        // у элементов нижней строки (на случай будущего пересмотра дефолтов).
        this._applyTopCurrencyExpanded();
    };

    // Вызывается из updateUp() — та же точка, что раньше обновляла val_stew/coins/cigarettes.
    proto._updateTopCurrency = function(){
        if(!this._topCur || !window.udata) return;
        const { txtRub, txtPrimary, txtSecondary, fmt } = this._topCur;
        const secondaryKey = otherKey(this._topCurPinned);
        txtRub.text       = fmt(udata['cigarettes']);
        txtPrimary.text   = fmt(udata[CUR_META[this._topCurPinned].field]);
        txtSecondary.text = fmt(udata[CUR_META[secondaryKey].field]);
    };
}
