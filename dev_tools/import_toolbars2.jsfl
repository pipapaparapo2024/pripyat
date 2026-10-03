// Animate: Команды → Запустить команду
var flaPath = "file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/content/animate/interface_elements/interface_elements.fla";
var upPNG   = "file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/png/toolbars/iface_up.png";
var downPNG = "file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/png/toolbars/iface_down.png";

var doc = fl.openDocument(flaPath);
fl.setActiveWindow(doc);
var lib = doc.library;

// Импортируем PNG
doc.importFile(upPNG,   true);
doc.importFile(downPNG, true);
fl.trace("PNG импортированы");

function makeEmptyMC(name) {
    lib.addNewItem("movie clip", name);
}

function getLastEl(tl) {
    var layer = tl.layers[tl.currentLayer];
    var els = layer.frames[0].elements;
    return els[els.length - 1];
}

// ========== iface_up ==========
makeEmptyMC("iface_up");
lib.editItem("iface_up");
var d = fl.getDocumentDOM();
var tl = d.getTimeline();
tl.layers[0].name = "bg";

// фон
lib.addItemToDocument({x:0, y:0}, "iface_up.png");

// ava container
makeEmptyMC("ava_mc");
makeEmptyMC("icon_mc");
lib.editItem("ava_mc");
lib.addItemToDocument({x:0, y:0}, "icon_mc");
fl.getDocumentDOM().getTimeline().layers[0].frames[0].elements[0].name = "icon_mc";
fl.exitEditInPlace();

lib.editItem("iface_up");
d = fl.getDocumentDOM(); tl = d.getTimeline();
tl.addNewLayer("ava_l"); tl.currentLayer = tl.findLayerIndex("ava_l")[0];
lib.addItemToDocument({x:6, y:6}, "ava_mc");
getLastEl(tl).name = "ava";

// val_stew
makeEmptyMC("val_stew_mc");
makeEmptyMC("vs_icon");
lib.editItem("val_stew_mc");
d = fl.getDocumentDOM(); tl = d.getTimeline();
lib.addItemToDocument({x:2, y:5}, "vs_icon");
tl.layers[0].frames[0].elements[0].name = "icon";
tl.addNewLayer("t"); tl.currentLayer = 1;
d.addNewText({left:30,top:4,right:128,bottom:32},"0");
tl.layers[1].frames[0].elements[0].name = "tf_txt";
fl.exitEditInPlace();

lib.editItem("iface_up");
d = fl.getDocumentDOM(); tl = d.getTimeline();
tl.addNewLayer("vs_l"); tl.currentLayer = tl.findLayerIndex("vs_l")[0];
lib.addItemToDocument({x:758, y:17}, "val_stew_mc");
getLastEl(tl).name = "val_stew";

// val_coins
makeEmptyMC("val_coins_mc");
makeEmptyMC("vc_icon");
lib.editItem("val_coins_mc");
d = fl.getDocumentDOM(); tl = d.getTimeline();
lib.addItemToDocument({x:2, y:5}, "vc_icon");
tl.layers[0].frames[0].elements[0].name = "icon";
tl.addNewLayer("t"); tl.currentLayer = 1;
d.addNewText({left:30,top:4,right:128,bottom:32},"0");
tl.layers[1].frames[0].elements[0].name = "tf_txt";
fl.exitEditInPlace();

lib.editItem("iface_up");
d = fl.getDocumentDOM(); tl = d.getTimeline();
tl.addNewLayer("vc_l"); tl.currentLayer = tl.findLayerIndex("vc_l")[0];
lib.addItemToDocument({x:893, y:17}, "val_coins_mc");
getLastEl(tl).name = "val_coins";

// val_cigarettes
makeEmptyMC("val_cig_mc");
makeEmptyMC("vci_icon");
lib.editItem("val_cig_mc");
d = fl.getDocumentDOM(); tl = d.getTimeline();
lib.addItemToDocument({x:2, y:5}, "vci_icon");
tl.layers[0].frames[0].elements[0].name = "icon";
tl.addNewLayer("t"); tl.currentLayer = 1;
d.addNewText({left:30,top:4,right:128,bottom:32},"0");
tl.layers[1].frames[0].elements[0].name = "tf_txt";
fl.exitEditInPlace();

lib.editItem("iface_up");
d = fl.getDocumentDOM(); tl = d.getTimeline();
tl.addNewLayer("vci_l"); tl.currentLayer = tl.findLayerIndex("vci_l")[0];
lib.addItemToDocument({x:1033, y:17}, "val_cig_mc");
getLastEl(tl).name = "val_cigarettes";

// butt_bank
makeEmptyMC("butt_bank_mc");
lib.editItem("iface_up");
d = fl.getDocumentDOM(); tl = d.getTimeline();
tl.addNewLayer("bb_l"); tl.currentLayer = tl.findLayerIndex("bb_l")[0];
lib.addItemToDocument({x:1168, y:20}, "butt_bank_mc");
getLastEl(tl).name = "butt_bank";

fl.exitEditInPlace();
fl.trace("iface_up OK");

// ========== iface_down ==========
makeEmptyMC("iface_down");
lib.editItem("iface_down");
d = fl.getDocumentDOM(); tl = d.getTimeline();
tl.layers[0].name = "bg";
lib.addItemToDocument({x:0, y:564}, "iface_down.png");

var butts = [
    {name:"butt_vassilich", x:20},
    {name:"butt_bosses",    x:175},
    {name:"butt_gangs",     x:330},
    {name:"butt_weapons",   x:485},
    {name:"butt_shmot",     x:640},
    {name:"butt_zone",      x:795}
];

for (var b = 0; b < butts.length; b++) {
    var bd = butts[b];
    makeEmptyMC(bd.name + "_mc");
    lib.editItem("iface_down");
    d = fl.getDocumentDOM(); tl = d.getTimeline();
    tl.addNewLayer(bd.name);
    tl.currentLayer = tl.findLayerIndex(bd.name)[0];
    lib.addItemToDocument({x:bd.x, y:594}, bd.name + "_mc");
    getLastEl(tl).name = bd.name;
}

fl.exitEditInPlace();
fl.trace("iface_down OK");

// ========== На главную сцену ==========
doc = fl.getDocumentDOM();
tl = doc.getTimeline();

tl.addNewLayer("iface_up_l");
tl.currentLayer = tl.findLayerIndex("iface_up_l")[0];
lib.addItemToDocument({x:0, y:0}, "iface_up");
tl.layers[tl.currentLayer].frames[0].elements[0].name = "iface_up";

tl.addNewLayer("iface_down_l");
tl.currentLayer = tl.findLayerIndex("iface_down_l")[0];
lib.addItemToDocument({x:0, y:0}, "iface_down");
tl.layers[tl.currentLayer].frames[0].elements[0].name = "iface_down";

doc.save(false);
fl.trace("=== ГОТОВО === Сохранено.");
