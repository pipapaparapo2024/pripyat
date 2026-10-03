// Файл → Сценарии → Обзор → выбрать этот файл
var doc = app.open(new File("C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/ящик.psd"));
var outDir = "C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/png/buttons/";

var opts = new ExportOptionsSaveForWeb();
opts.format = SaveDocumentType.PNG;
opts.PNG8 = false;
opts.transparency = true;

function hideAll() {
    for (var i = 0; i < doc.layers.length; i++)
        doc.layers[i].visible = false;
}

// --- кнопка Назад из "нижняя панель" группы ---
hideAll();
var bottomGroup = null;
for (var i = 0; i < doc.layers.length; i++) {
    if (doc.layers[i].name.indexOf("нижн") !== -1) {
        bottomGroup = doc.layers[i];
        break;
    }
}
if (bottomGroup) {
    bottomGroup.visible = true;
    for (var i = 0; i < bottomGroup.layers.length; i++)
        bottomGroup.layers[i].visible = false;
    for (var i = 0; i < bottomGroup.layers.length; i++) {
        if (bottomGroup.layers[i].name.toLowerCase().indexOf("назад") !== -1) {
            bottomGroup.layers[i].visible = true;
            break;
        }
    }
    doc.exportDocument(new File(outDir + "butt_back.png"), ExportType.SAVEFORWEB, opts);
}

// --- настройки (settings) из главных слоёв ---
hideAll();
for (var i = 0; i < doc.layers.length; i++) {
    if (doc.layers[i].name.toLowerCase().indexOf("наст") !== -1) {
        doc.layers[i].visible = true;
        break;
    }
}
doc.exportDocument(new File(outDir + "butt_settings.png"), ExportType.SAVEFORWEB, opts);

// --- энергия "+" кнопка ---
hideAll();
for (var i = 0; i < doc.layers.length; i++) {
    if (doc.layers[i].name.toLowerCase().indexOf("энк") !== -1 ||
        doc.layers[i].name.toLowerCase().indexOf("энер") !== -1) {
        doc.layers[i].visible = true;
    }
}
doc.exportDocument(new File(outDir + "butt_energy_plus.png"), ExportType.SAVEFORWEB, opts);

for (var i = 0; i < doc.layers.length; i++)
    doc.layers[i].visible = true;

doc.close(SaveOptions.DONOTSAVECHANGES);
alert("Готово!\nbutt_back.png\nbutt_settings.png\nbutt_energy_plus.png\n\nПапка: " + outDir);
