// Файл → Сценарии → Обзор → выбрать этот файл
var psdPath = "C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/ящик.psd";
var outDir  = "C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/png/toolbars/";

var folder = new Folder(outDir);
if (!folder.exists) folder.create();

var doc = app.open(new File(psdPath));

var opts = new ExportOptionsSaveForWeb();
opts.format = SaveDocumentType.PNG;
opts.PNG8 = false;
opts.transparency = true;

// Скрыть все слои верхнего уровня
function hideAll() {
    for (var i = 0; i < doc.layers.length; i++)
        doc.layers[i].visible = false;
}

// Показать слой по части имени
function showByName(str) {
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i].name.indexOf(str) !== -1) {
            doc.layers[i].visible = true;
        }
    }
}

// --- iface_up: все слои верхней части ---
hideAll();
showByName("худ");          // худ
showByName("валю");    // валю(та)
showByName("маг");          // маг(аз)
showByName("наст");    // наст(ройки)
showByName("энк");          // энк(а)
showByName("имя");          // имя

doc.exportDocument(new File(outDir + "iface_up.png"), ExportType.SAVEFORWEB, opts);

// --- iface_down: нижняя панель ---
hideAll();
showByName("нижн");    // нижн(яя панель)

doc.exportDocument(new File(outDir + "iface_down.png"), ExportType.SAVEFORWEB, opts);

// Восстанавливаем
for (var i = 0; i < doc.layers.length; i++)
    doc.layers[i].visible = true;

doc.close(SaveOptions.DONOTSAVECHANGES);
alert("Готово! iface_up.png и iface_down.png обновлены.");
