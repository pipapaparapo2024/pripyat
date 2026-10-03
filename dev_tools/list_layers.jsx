// Файл → Сценарии → Обзор → выбрать этот файл
var doc = app.open(new File("C:/Users/HONOR/Desktop/vk_game/projects_2026/stalker/img/psd/ящик.psd"));
var out = "";
for (var i = 0; i < doc.layers.length; i++) {
    out += i + ": [" + (doc.layers[i].visible ? "V" : " ") + "] " + doc.layers[i].name + "\n";
}
doc.close(SaveOptions.DONOTSAVECHANGES);
alert(out);
