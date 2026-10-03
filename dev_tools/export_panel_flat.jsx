// Запуск: Файл → Сценарии → Обзор
// Экспортирует кнопки с flatMerge (учитывает blend modes)

var outDir = "C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/_client/development/images/hud/";
var log = "=== Flat export ===\n";

var psdFile = new File("C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/худ3,0.psd");
var doc = app.open(psdFile);

// Показать ВСЕ слои
function showAll(layers) {
    for (var i = 0; i < layers.length; i++) {
        layers[i].visible = true;
        if (layers[i].typename === "LayerSet") showAll(layers[i].layers);
    }
}
showAll(doc.layers);

function findLayer(layers, name) {
    for (var i = 0; i < layers.length; i++) {
        if (layers[i].name === name) return layers[i];
        if (layers[i].typename === "LayerSet") {
            var r = findLayer(layers[i].layers, name);
            if (r) return r;
        }
    }
    return null;
}

// Правая панель: кнопки с точными координатами из PSD-отчёта
var rightBtns = [
    { group: "двор",         out: "right_btn_dvor.png",  l:1038, t:135, r:1274, b:192 },
    { group: "База",         out: "right_btn_base.png",  l:1038, t:197, r:1274, b:254 },
    { group: "Хабар",        out: "right_btn_habar.png", l:1038, t:259, r:1274, b:316 },
    { group: "топы",         out: "right_btn_top.png",   l:1038, t:322, r:1274, b:379 },
    { group: "Сводка копия", out: "right_btn_daily.png", l:1038, t:452, r:1274, b:509 },
    { group: "Сводка",       out: "right_btn_svod.png",  l:1038, t:386, r:1274, b:443 },
];

// Левая панель
var leftBtns = [
    { group: "скряга",    out: "left_btn_hapuga.png", l:0, t:169, r:233, b:515 },
    { group: "бот",       out: "left_btn_bot.png",    l:0, t:224, r:233, b:563 },
    { group: "бот копия", out: "left_btn_bp.png",     l:0, t:292, r:233, b:631 },
];

var opts = new ExportOptionsSaveForWeb();
opts.format = SaveDocumentType.PNG;
opts.PNG8 = false;
opts.transparency = true;

function exportCrop(bounds, filename) {
    var dup = doc.duplicate();
    // Сгладить в одно изображение с учётом всех blend modes
    dup.flatten();
    dup.crop([bounds.l, bounds.t, bounds.r, bounds.b]);
    dup.exportDocument(new File(outDir + filename), ExportType.SAVEFORWEB, opts);
    dup.close(SaveOptions.DONOTSAVECHANGES);
    log += "OK " + filename + "\n";
}

for (var i = 0; i < rightBtns.length; i++) {
    exportCrop(rightBtns[i], rightBtns[i].out);
}
for (var i = 0; i < leftBtns.length; i++) {
    exportCrop(leftBtns[i], leftBtns[i].out);
}

doc.close(SaveOptions.DONOTSAVECHANGES);

var logFile = new File("C:/Users/HONOR/Desktop/export_flat_log.txt");
logFile.open("w");
logFile.write(log);
logFile.close();

alert("Готово!\n" + log);
