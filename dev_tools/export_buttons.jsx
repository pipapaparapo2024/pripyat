// Файл → Сценарии → Обзор → выбрать этот файл
var doc = app.open(new File("C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/ящик.psd"));
var outDir = "C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/png/buttons/";

var folder = new Folder(outDir);
if (!folder.exists) folder.create();

var opts = new ExportOptionsSaveForWeb();
opts.format = SaveDocumentType.PNG;
opts.PNG8 = false;
opts.transparency = true;

// Скрыть все верхние слои
function hideAll() {
    for (var i = 0; i < doc.layers.length; i++)
        doc.layers[i].visible = false;
}

// Найти группу "нижняя панель"
var bottomGroup = null;
for (var i = 0; i < doc.layers.length; i++) {
    if (doc.layers[i].name.indexOf("нижн") !== -1) {
        bottomGroup = doc.layers[i];
        break;
    }
}

if (!bottomGroup) {
    alert("Группа 'нижняя панель' не найдена!");
    doc.close(SaveOptions.DONOTSAVECHANGES);
}

// Карта: имя слоя → имя файла для игры
var nameMap = {
    "оружейка":    "butt_weapons",
    "шмотки копия":"butt_zone",
    "шмотки":      "butt_shmot",
    "банда":       "butt_gangs",
    "сидорович":   "butt_vassilich",
    "боссы":       "butt_bosses",
    "нижний худ":  "down_bg"
};

// Скрыть все дочерние группы внутри нижней панели
function hideAllChildren() {
    for (var i = 0; i < bottomGroup.layers.length; i++)
        bottomGroup.layers[i].visible = false;
}

var exported = [];

for (var i = 0; i < bottomGroup.layers.length; i++) {
    var layer = bottomGroup.layers[i];
    var lname = layer.name.toLowerCase();

    // Найти соответствие
    var fname = null;
    for (var key in nameMap) {
        if (lname.indexOf(key) !== -1) {
            fname = nameMap[key];
            break;
        }
    }
    if (!fname) continue;

    // Показать только эту дочернюю группу
    hideAll();
    bottomGroup.visible = true;
    hideAllChildren();
    layer.visible = true;

    var file = new File(outDir + fname + ".png");
    doc.exportDocument(file, ExportType.SAVEFORWEB, opts);
    exported.push(fname + ".png");
}

// Восстановить видимость
for (var i = 0; i < doc.layers.length; i++)
    doc.layers[i].visible = true;

doc.close(SaveOptions.DONOTSAVECHANGES);
alert("Готово! Экспортировано:\n" + exported.join("\n") + "\n\nПапка: " + outDir);
