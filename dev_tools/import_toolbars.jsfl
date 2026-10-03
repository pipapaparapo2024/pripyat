// Animate: Команды → Запустить команду → выбрать этот файл
var flaPath   = "file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/content/animate/interface_elements/interface_elements.fla";
var upPNG     = "file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/png/toolbars/iface_up.png";
var downPNG   = "file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/png/toolbars/iface_down.png";

// Открываем FLA
var doc = fl.openDocument(flaPath);
fl.setActiveWindow(doc);
var lib = doc.library;
var timeline = doc.getTimeline();

// --- Импортируем PNG в библиотеку ---
doc.importFile(upPNG, true);
doc.importFile(downPNG, true);

// Находим импортированные элементы в библиотеке
function findLibItem(namePart) {
    for (var i = 0; i < lib.items.length; i++) {
        if (lib.items[i].name.indexOf(namePart) !== -1) {
            return lib.items[i];
        }
    }
    return null;
}

// --- Создаём символ iface_up ---
lib.addNewItem("movie clip", "iface_up_new");
lib.editItem("iface_up_new");
var upDoc = fl.getDocumentDOM();
var upTimeline = upDoc.getTimeline();
upTimeline.layers[0].name = "bg";
upDoc.getTimeline().currentLayer = 0;
lib.addItemToDocument({x: 0, y: 0}, "iface_up.png");

// Добавляем именованные контейнеры для игровой логики
upTimeline.addNewLayer("ava_layer");
upTimeline.currentLayer = upTimeline.findLayerIndex("ava_layer")[0];
upDoc.addNewOval({left:6, top:6, right:58, bottom:58});
upDoc.selection = upDoc.selection;
upDoc.convertToSymbol("movie clip", "ava_mc", "top left");
var avaItem = upDoc.selection[0];
avaItem.name = "ava";

// Слой для icon_mc внутри ava
lib.editItem("ava_mc");
var avaDoc = fl.getDocumentDOM();
avaDoc.getTimeline().layers[0].name = "icon";
avaDoc.addNewOval({left:0, top:0, right:52, bottom:52});
avaDoc.convertToSymbol("movie clip", "icon_mc_sym", "top left");
avaDoc.selection[0].name = "icon_mc";
fl.exitEditInPlace();

// Возвращаемся в iface_up_new
lib.editItem("iface_up_new");
upTimeline = fl.getDocumentDOM().getTimeline();

// Контейнеры val_stew, val_coins, val_cigarettes
var valDefs = [
    {name: "val_stew",       x: 758, y: 17},
    {name: "val_coins",      x: 893, y: 17},
    {name: "val_cigarettes", x: 1033, y: 17}
];

for (var v = 0; v < valDefs.length; v++) {
    var vd = valDefs[v];
    upTimeline.addNewLayer(vd.name + "_layer");
    upTimeline.currentLayer = upTimeline.findLayerIndex(vd.name + "_layer")[0];
    fl.getDocumentDOM().addNewRectangle({left: vd.x, top: vd.y, right: vd.x+130, bottom: vd.y+38}, 0);
    fl.getDocumentDOM().convertToSymbol("movie clip", vd.name + "_sym", "top left");
    fl.getDocumentDOM().selection[0].name = vd.name;

    // Добавляем tf_txt внутрь
    lib.editItem(vd.name + "_sym");
    var vDoc = fl.getDocumentDOM();
    vDoc.getTimeline().layers[0].name = "tf";
    vDoc.addNewText({left:30, top:5, right:128, bottom:33});
    var tf = vDoc.selection[0];
    tf.name = "tf_txt";
    tf.setTextAttr("face", "Arial");
    tf.setTextAttr("size", 16);
    tf.setTextAttr("fillColor", 0xFFFFFF);
    tf.setTextString("0");

    // icon внутри val
    vDoc.getTimeline().addNewLayer("icon_layer");
    vDoc.getTimeline().currentLayer = vDoc.getTimeline().findLayerIndex("icon_layer")[0];
    vDoc.addNewOval({left:2, top:5, right:28, bottom:31});
    vDoc.convertToSymbol("movie clip", vd.name + "_icon", "top left");
    vDoc.selection[0].name = "icon";
    fl.exitEditInPlace();
}

// Кнопка bank
lib.editItem("iface_up_new");
upTimeline = fl.getDocumentDOM().getTimeline();
upTimeline.addNewLayer("bank_layer");
upTimeline.currentLayer = upTimeline.findLayerIndex("bank_layer")[0];
fl.getDocumentDOM().addNewRectangle({left:1168, top:20, right:1200, bottom:56}, 0);
fl.getDocumentDOM().convertToSymbol("movie clip", "butt_bank_sym", "top left");
fl.getDocumentDOM().selection[0].name = "butt_bank";

fl.exitEditInPlace();

// --- Создаём символ iface_down ---
lib.addNewItem("movie clip", "iface_down_new");
lib.editItem("iface_down_new");
var downDoc = fl.getDocumentDOM();
var downTimeline = downDoc.getTimeline();
downTimeline.layers[0].name = "bg";
lib.addItemToDocument({x: 0, y: 564}, "iface_down.png");

// Кнопки нижней навигации
var buttDefs = [
    {name: "butt_vassilich", x: 20,  y: 594, w: 155},
    {name: "butt_bosses",    x: 175, y: 594, w: 155},
    {name: "butt_gangs",     x: 330, y: 594, w: 155},
    {name: "butt_weapons",   x: 485, y: 594, w: 155},
    {name: "butt_shmot",     x: 640, y: 594, w: 155},
    {name: "butt_zone",      x: 795, y: 594, w: 155}
];

for (var b = 0; b < buttDefs.length; b++) {
    var bd = buttDefs[b];
    downTimeline.addNewLayer(bd.name + "_layer");
    downTimeline.currentLayer = downTimeline.findLayerIndex(bd.name + "_layer")[0];
    fl.getDocumentDOM().addNewRectangle(
        {left: bd.x, top: bd.y, right: bd.x + bd.w, bottom: bd.y + 126}, 0
    );
    fl.getDocumentDOM().convertToSymbol("movie clip", bd.name + "_sym", "top left");
    fl.getDocumentDOM().selection[0].name = bd.name;
}

fl.exitEditInPlace();

// --- Размещаем iface_up и iface_down на главной сцене ---
// Ищем слои iface_up и iface_down на сцене
timeline = doc.getTimeline();

// Добавляем слой iface_up на сцену
timeline.addNewLayer("iface_up_layer");
timeline.currentLayer = timeline.findLayerIndex("iface_up_layer")[0];
lib.addItemToDocument({x: 0, y: 0}, "iface_up_new");
doc.selection[0].name = "iface_up";

// Добавляем слой iface_down на сцену
timeline.addNewLayer("iface_down_layer");
timeline.currentLayer = timeline.findLayerIndex("iface_down_layer")[0];
lib.addItemToDocument({x: 0, y: 0}, "iface_down_new");
doc.selection[0].name = "iface_down";

// Сохраняем
doc.save(false);

fl.trace("=== ГОТОВО ===");
fl.trace("iface_up и iface_down добавлены в interface_elements.fla");
fl.trace("Именованные инстансы: ava, val_stew, val_coins, val_cigarettes, butt_bank");
fl.trace("Кнопки: butt_vassilich, butt_bosses, butt_gangs, butt_weapons, butt_shmot, butt_zone");
