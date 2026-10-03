// Запуск: Файл → Сценарии → Обзор → этот файл
// Экспортирует кнопки правой и левой панелей, обрезая до границ каждой группы

var outDir = "C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/_client/development/images/hud/";
var folder = new Folder(outDir);
if (!folder.exists) folder.create();

var log = "=== Экспорт кнопок панелей ===\n";

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

function exportGroupCropped(doc, groupName, filename) {
    var group = findLayer(doc.layers, groupName);
    if (!group) { log += "FAIL: " + groupName + "\n"; return; }

    // Скрыть все, показать только группу
    for (var i = 0; i < doc.layers.length; i++) doc.layers[i].visible = false;
    group.visible = true;

    // Получить границы группы
    var b = group.bounds;
    var left   = Math.max(0, Math.round(b[0]));
    var top    = Math.max(0, Math.round(b[1]));
    var right  = Math.min(doc.width.value, Math.round(b[2]));
    var bottom = Math.min(doc.height.value, Math.round(b[3]));
    var w = right - left;
    var h = bottom - top;

    if (w <= 0 || h <= 0) { log += "SKIP (empty): " + groupName + "\n"; return; }

    // Дублировать документ и обрезать
    var dup = doc.duplicate();
    dup.crop([left, top, right, bottom]);

    var opts = new ExportOptionsSaveForWeb();
    opts.format = SaveDocumentType.PNG;
    opts.PNG8 = false;
    opts.transparency = true;

    dup.exportDocument(new File(outDir + filename), ExportType.SAVEFORWEB, opts);
    dup.close(SaveOptions.DONOTSAVECHANGES);

    log += "OK " + filename + " (" + w + "x" + h + " at " + left + "," + top + ")\n";
}

// ── Открыть худ3,0.psd ──
var psdFile = new File("C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/худ3,0.psd");
if (!psdFile.exists) {
    alert("Файл не найден: худ3,0.psd");
} else {
    var doc = app.open(psdFile);

    // Правая панель
    exportGroupCropped(doc, "двор",         "right_btn_dvor.png");
    exportGroupCropped(doc, "База",         "right_btn_base.png");
    exportGroupCropped(doc, "Хабар",        "right_btn_habar.png");
    exportGroupCropped(doc, "топы",         "right_btn_top.png");
    exportGroupCropped(doc, "Сводка",       "right_btn_svod.png");
    exportGroupCropped(doc, "Сводка копия", "right_btn_daily.png");

    // Левая панель
    exportGroupCropped(doc, "скряга",    "left_btn_hapuga.png");
    exportGroupCropped(doc, "бот",       "left_btn_bot.png");
    exportGroupCropped(doc, "бот копия", "left_btn_bp.png");

    doc.close(SaveOptions.DONOTSAVECHANGES);
}

// Сохранить лог
var logFile = new File("C:/Users/HONOR/Desktop/export_panels_log.txt");
logFile.open("w");
logFile.write(log);
logFile.close();

alert("Готово!\n" + log);
