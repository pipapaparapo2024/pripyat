// Запуск: Файл → Сценарии → Обзор → выбрать этот файл
// Экспортирует все нужные спрайты из ящик.psd, худ3,0.psd, Компас.psd

var outDir = "C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/_client/development/images/hud/";

// Создать папку
var folder = new Folder(outDir);
if (!folder.exists) folder.create();

var opts = new ExportOptionsSaveForWeb();
opts.format = SaveDocumentType.PNG;
opts.PNG8 = false;
opts.transparency = true;

// ───────────────────────────────────────────────
// Утилиты
// ───────────────────────────────────────────────

function hideAll(doc) {
    for (var i = 0; i < doc.layers.length; i++)
        doc.layers[i].visible = false;
}

function showOnly(layer) {
    hideAll(layer.parent.parent ? layer.parent.parent : layer.parent);
    var cur = layer;
    while (cur && cur !== app.activeDocument) {
        cur.visible = true;
        cur = cur.parent;
    }
}

function findLayer(layers, name) {
    for (var i = 0; i < layers.length; i++) {
        if (layers[i].name === name) return layers[i];
        if (layers[i].typename === "LayerSet") {
            var found = findLayer(layers[i].layers, name);
            if (found) return found;
        }
    }
    return null;
}

function exportLayer(doc, layerName, filename) {
    var layer = findLayer(doc.layers, layerName);
    if (!layer) { fl.trace("НЕ НАЙДЕН слой: " + layerName); return false; }

    // Скрыть всё, показать только этот слой + его родителей
    for (var i = 0; i < doc.layers.length; i++) doc.layers[i].visible = false;
    var cur = layer;
    while (cur && cur.typename !== "Document") {
        cur.visible = true;
        cur = cur.parent;
    }

    doc.exportDocument(new File(outDir + filename), ExportType.SAVEFORWEB, opts);
    return true;
}

function exportGroupFlattened(doc, groupName, filename) {
    // Показать только группу
    for (var i = 0; i < doc.layers.length; i++) doc.layers[i].visible = false;
    var group = findLayer(doc.layers, groupName);
    if (!group) { return false; }
    group.visible = true;
    doc.exportDocument(new File(outDir + filename), ExportType.SAVEFORWEB, opts);
    return true;
}

var log = "=== Экспорт спрайтов ===\n";

// ───────────────────────────────────────────────
// 1. ящик.psd → прогресс-бары и энергия
// ───────────────────────────────────────────────
var psd1 = new File("C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/ящик.psd");
if (psd1.exists) {
    var doc1 = app.open(psd1);

    // XP бар фон (шкала уровеня): x=86 y=48 w=197 h=13
    if (exportGroupFlattened(doc1, "имя,уровень", "xp_bar_bg.png"))
        log += "OK xp_bar_bg.png\n";

    // Энергия группа целиком (шкала + текст + кнопка +): x=408 y=27 w=261 h=34
    if (exportGroupFlattened(doc1, "энка", "energy_panel.png"))
        log += "OK energy_panel.png\n";

    // Имя/уровень группа целиком (фото+имя+уровень+шкала)
    if (exportGroupFlattened(doc1, "имя,уровень", "name_level_panel.png"))
        log += "OK name_level_panel.png\n";

    // Нижняя панель фон
    if (exportGroupFlattened(doc1, "нижний худ", "down_panel_hud.png"))
        log += "OK down_panel_hud.png\n";

    // Кнопка Назад: x=1090 y=564 w=174 h=48
    if (exportGroupFlattened(doc1, "кнопка Назад", "butt_back_psd.png"))
        log += "OK butt_back_psd.png\n";

    doc1.close(SaveOptions.DONOTSAVECHANGES);
}

// ───────────────────────────────────────────────
// 2. худ3,0.psd → правая и левая панели
// ───────────────────────────────────────────────
var psd2 = new File("C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/худ3,0.psd");
if (psd2.exists) {
    var doc2 = app.open(psd2);

    // Правая панель: кнопки (Двор, База, Хабар, Топы, Сводка, Задания)
    var rightBtns = ["двор", "База", "Хабар", "топы", "Сводка", "Сводка копия"];
    var rightNames = ["right_btn_dvor.png", "right_btn_base.png", "right_btn_habar.png",
                      "right_btn_top.png", "right_btn_svod.png", "right_btn_daily.png"];
    for (var i = 0; i < rightBtns.length; i++) {
        if (exportGroupFlattened(doc2, rightBtns[i], rightNames[i]))
            log += "OK " + rightNames[i] + "\n";
    }

    // Левая панель: кнопки
    var leftBtns = ["скряга", "бот", "бот копия"];
    var leftNames = ["left_btn_hapuga.png", "left_btn_bot.png", "left_btn_bp.png"];
    for (var i = 0; i < leftBtns.length; i++) {
        if (exportGroupFlattened(doc2, leftBtns[i], leftNames[i]))
            log += "OK " + leftNames[i] + "\n";
    }

    doc2.close(SaveOptions.DONOTSAVECHANGES);
}

// ───────────────────────────────────────────────
// 3. Компас.psd → экран загрузки
// ───────────────────────────────────────────────
var psd3 = new File("C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/Компас.psd");
if (psd3.exists) {
    var doc3 = app.open(psd3);

    // Компас целиком (Группа 1)
    if (exportGroupFlattened(doc3, "Группа 1", "compass_loader.png"))
        log += "OK compass_loader.png\n";

    doc3.close(SaveOptions.DONOTSAVECHANGES);
}

// Сохранить лог
var logFile = new File("C:/Users/HONOR/Desktop/export_sprites_log.txt");
logFile.open("w");
logFile.write(log);
logFile.close();

alert("Готово!\n" + log + "\nПапка: " + outDir);
