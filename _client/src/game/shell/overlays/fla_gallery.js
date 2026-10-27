/** 22.10.2026 (по прямому указанию — "хочу посмотреть, что именно скомпилировано из FLA,
 * а не нашу логику"): дев-экран, листающий 18 скомпилированных через PIXI.animate FLA-файлов
 * (_client/development/libs/*_elements.min.js + notify.min.js + preloader.min.js) — те самые,
 * о которых шёл разговор весь вечер при попытке завести плагин PixiAnimate под Adobe Animate
 * пользователя. Показывает КОРНЕВОЙ класс документа каждого файла (X.lib.X, тот же класс,
 * что scene.load() инстанцирует при обычной загрузке экрана — см. "X.stage = X.lib.X" внутри
 * каждого файла, тот же паттерн, что notify.lib.notify в content/animate/notify/notify.js).
 *
 * ⚠️ Инстанс создаётся ОТДЕЛЬНО от того, что использует сама игра (modules.names[key]) —
 * специально НЕ переиспользует общий инстанс: PIXI-объект может быть ребёнком только одного
 * родителя разом, и если бы мы встроили сюда ТОТ ЖЕ объект, который Bosses/Shmot/и т.д. держат
 * у себя для настоящего экрана, add Child сюда вырвал бы его оттуда — настоящий экран сломался
 * бы при следующем открытии. Поэтому здесь всегда свежий "new X.lib.X()".
 *
 * ⚠️ Это НЕ готовые экраны один-в-один — большинство видимого контента (списки, тексты,
 * карточки) добавляет поверх сама игровая логика (bosses.js/shmot.js/...) во время обычной
 * работы экрана. Здесь показывается только то, что реально запечено В САМОМ FLA — у части
 * файлов это может быть почти пустой кадр, это не баг, так и есть "как скомпилировано".
 *
 * Для главного экрана персонажа (home.js) отдельного скомпилированного файла никогда не было —
 * он не использует FLA вообще, целиком написан на чистом PIXI (см. persSpr и т.д.), поэтому в
 * списке ниже только 18 пунктов, без "Главного экрана".
 */

// 25.10.2026 (по прямому указанию — "подключи их, я знаю что это из другой игры"):
// interface_elements.min.js от ДРУГОЙ игры (прислан пользователем через Telegram, сверено
// links.json/размером файла — не наш проект). Он скомпилирован той же связкой Adobe Animate +
// PIXI.animate и экспортирует себя в window.interface_elements — ТО ЖЕ самое имя, что наш
// родной файл. Если просто догрузить его в основной `window`, он молча подменит собой боевой
// window.interface_elements (HUD использует этот модуль постоянно) — следующий `new
// interface_elements.lib.X()` где угодно в игре начал бы строить чужие классы. Поэтому для
// "чужих" пунктов — отдельный путь загрузки (_loadForeignIsolated ниже): скрипт догружается
// динамическим <script>, сразу после загрузки его window[entry.fla] переименовывается в
// window[entry.foreignGlobalKey], а исходное имя возвращается к тому, что было ДО (наш модуль,
// если уже грузился, либо undefined — ничего не ломает: modules.checkFlags() отслеживает
// загрузку через свои внутренние this.flags, не через window[...], см. module_control.js).
// Чужой файл ссылается на СВОИ картинки (images/interface_elements_atlas_1.json и т.п.) —
// их на нашем сервере нет, поэтому показ будет частично/полностью пустым — это ожидаемо,
// не баг (см. тот же докблок про "почти пустой кадр" у обычных пунктов выше).
//
// module_control.js и links.json из той же присылки — НЕ скомпилированные PIXI.animate-
// библиотеки (это их исходный JS-контроллер модулей и манифест имён, аналог НАШИХ
// modules/module_control.js и ссылок fla в этом же файле), поэтому листать их тем же способом
// (инстанцировать X.lib.X) невозможно — показывать здесь нечего, в ENTRIES их нет. Файлы
// сохранены рядом (_client/development/libs/foreign_ref/) для справки.
const FOREIGN_REF_BASE = './libs/foreign_ref/';

const ENTRIES = [
    { key: 'base',        fla: 'base_elements',        label: 'База' },
    { key: 'battlepass',  fla: 'battlepass_elements',  label: 'Боевой пропуск' },
    { key: 'bosses',      fla: 'bosses_elements',      label: 'Боссы' },
    { key: 'bot',         fla: 'bot_elements',         label: 'Бот' },
    { key: 'dvor',        fla: 'dvor_elements',        label: 'Двор' },
    { key: 'gangs',       fla: 'gangs_elements',       label: 'Группировки' },
    { key: 'habar',       fla: 'habar_elements',       label: 'Хабар' },
    { key: 'hapuga',      fla: 'hapuga_elements',      label: 'Хапуга' },
    { key: 'interface',   fla: 'interface_elements',   label: 'Интерфейс' },
    { key: 'notify',      fla: 'notify',               label: 'Уведомления' },
    { key: null,          fla: 'preloader',            label: 'Прелоадер' },
    { key: 'shmot',       fla: 'shmot_elements',       label: 'Шмотки' },
    { key: 'svod',        fla: 'svod_elements',        label: 'Свод' },
    { key: 'top',         fla: 'top_elements',         label: 'Топ игроков' },
    { key: 'vassilich',   fla: 'vassilich_elements',   label: 'Василич' },
    { key: 'weapons',     fla: 'weapons_elements',     label: 'Оружие' },
    { key: 'zadaniya',    fla: 'zadaniya_elements',    label: 'Задания' },
    { key: 'zone',        fla: 'zone_elements',        label: 'Зона' },
    // 25.10.2026 — чужой референс-файл, см. большой комментарий выше про изоляцию.
    { key: null, fla: 'interface_elements', label: 'Интерфейс (референс, другая игра)',
        foreign: true, foreignSrc: FOREIGN_REF_BASE + 'interface_elements.min.js',
        foreignGlobalKey: '__fla_foreign_interface_elements' },
];

export default function attachFlaGallery(proto){

    proto._openFlaGallery = function(){
        if(!this._flaGalleryWin) this._buildFlaGallery();
        root.layer2_mc.addChild(this._flaGalleryWin);
        if(this._dvorWrap) this._dvorWrap.interactiveChildren = false;
        if(window.iface){
            if(iface.up)   root.layer2_mc.addChild(iface.up);
            if(iface.down) root.layer2_mc.addChild(iface.down);
        }
        this._flaGalleryShow(0);
    };

    proto._buildFlaGallery = function(){
        const win = new PIXI.Container();
        win.interactive = true;

        const blocker = new PIXI.Graphics();
        blocker.beginFill(0x0a0a0a, 0.95);
        blocker.drawRect(0, 0, 1280, 720);
        blocker.endFill();
        blocker.interactive = true;
        win.addChild(blocker);

        const titleTxt = new PIXI.Text('', {
            fontFamily: 'Southbank LT', fontSize: 22, fill: '#ffcc44',
            dropShadow: true, dropShadowColor: '#000000', dropShadowDistance: 1
        });
        titleTxt.anchor.set(0.5, 0);
        titleTxt.x = 640; titleTxt.y = 16;
        win.addChild(titleTxt);
        this._flaGalleryTitleTxt = titleTxt;

        const content = new PIXI.Container();
        win.addChild(content);
        this._flaGalleryContent = content;

        const leftArrow = new PIXI.Graphics();
        leftArrow.beginFill(0xffffff);
        leftArrow.drawPolygon([50, 360, 90, 330, 90, 390]);
        leftArrow.endFill();
        leftArrow.interactive = true; leftArrow.buttonMode = true;
        if(window.isMobile) helper.touchPad(leftArrow);
        leftArrow.on('pointerdown', () => this._flaGalleryStep(-1));
        win.addChild(leftArrow);

        const rightArrow = new PIXI.Graphics();
        rightArrow.beginFill(0xffffff);
        rightArrow.drawPolygon([1230, 360, 1190, 330, 1190, 390]);
        rightArrow.endFill();
        rightArrow.interactive = true; rightArrow.buttonMode = true;
        if(window.isMobile) helper.touchPad(rightArrow);
        rightArrow.on('pointerdown', () => this._flaGalleryStep(1));
        win.addChild(rightArrow);

        const exitBtn = new PIXI.Sprite(PIXI.Texture.from('./images/выход.png'));
        exitBtn.scale.set(0.5);
        if(window.isMobile) helper.touchPad(exitBtn);
        exitBtn.x = 1240; exitBtn.y = 83;
        exitBtn.interactive = true; exitBtn.buttonMode = true;
        exitBtn.on('pointerover', () => { exitBtn.alpha = 0.75; });
        exitBtn.on('pointerout',  () => { exitBtn.alpha = 1; });
        exitBtn.on('pointerdown', () => this._closeFlaGallery());
        win.addChild(exitBtn);

        this._flaGalleryWin = win;
        this._flaGalleryIdx = 0;
    };

    proto._flaGalleryStep = function(dir){
        const next = (this._flaGalleryIdx + dir + ENTRIES.length) % ENTRIES.length;
        this._flaGalleryShow(next);
    };

    proto._flaGalleryShow = function(idx){
        this._flaGalleryIdx = idx;
        const entry = ENTRIES[idx];
        this._flaGalleryTitleTxt.text = (idx + 1) + '/' + ENTRIES.length + ' — ' + entry.label +
            ' (' + entry.fla + '.min.js)';
        while(this._flaGalleryContent.children.length) this._flaGalleryContent.removeChildAt(0);

        const render = () => {
            if(this._flaGalleryIdx !== idx) return; // уже перелистнули дальше, пока грузилось
            // "Чужие" пункты (см. FOREIGN_REF_BASE выше) хранят загруженную библиотеку под
            // изолированным именем (foreignGlobalKey), НЕ под обычным window[entry.fla] —
            // то имя зарезервировано за нашим собственным одноимённым модулем.
            const lib = entry.foreign ? window[entry.foreignGlobalKey] : window[entry.fla];
            const RootClass = lib && lib.lib && lib.lib[entry.fla];
            if(!RootClass){
                console.error('[fla_gallery._flaGalleryShow] корневой класс не найден:', entry.fla);
                return;
            }
            const inst = new RootClass();
            this._flaGalleryContent.addChild(inst);
        };

        if(entry.foreign){
            this._flaGalleryLoadForeign(entry, idx, render);
        } else if(entry.key === null){
            // preloader грузится отдельно, напрямую в index.js при старте игры — к моменту,
            // когда вообще можно открыть главный экран, он уже 100% загружен.
            render();
        } else {
            modules.checkFlags([entry.key], render);
        }
    };

    // 25.10.2026 — изолированная загрузка "чужого" файла (другая игра, см. большой комментарий
    // у ENTRIES). Скрипт догружается динамическим <script>, его экспорт (window[entry.fla])
    // сразу переносится под window[entry.foreignGlobalKey], а исходное имя возвращается к
    // значению ДО загрузки — иначе чужой файл молча подменил бы собой боевой window.X,
    // которым пользуется настоящий игровой модуль с тем же именем.
    proto._flaGalleryLoadForeign = function(entry, idx, render){
        if(window[entry.foreignGlobalKey]){ render(); return; }
        const existing = document.querySelector('script[data-fla-foreign="' + entry.foreignSrc + '"]');
        if(existing){
            existing.addEventListener('load', () => { if(this._flaGalleryIdx === idx) render(); }, {once: true});
            return;
        }
        const before = window[entry.fla];
        const s = document.createElement('script');
        s.src = entry.foreignSrc;
        s.dataset.flaForeign = entry.foreignSrc;
        s.onload = () => {
            window[entry.foreignGlobalKey] = window[entry.fla];
            window[entry.fla] = before;
            console.log('[fla_gallery._flaGalleryLoadForeign] чужой файл загружен и изолирован:', entry.foreignSrc, '| global:', entry.foreignGlobalKey);
            if(this._flaGalleryIdx === idx) render();
        };
        s.onerror = () => {
            console.error('[fla_gallery._flaGalleryLoadForeign] не удалось загрузить чужой файл:', entry.foreignSrc);
        };
        document.head.appendChild(s);
    };

    proto._closeFlaGallery = function(){
        if(this._flaGalleryWin && this._flaGalleryWin.parent) this._flaGalleryWin.parent.removeChild(this._flaGalleryWin);
        if(this._dvorWrap){ this._dvorWrap.visible = true; this._dvorWrap.interactiveChildren = true; }
    };
}
