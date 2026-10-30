var projectRoot = new File($.fileName).parent.parent.fsName.replace(/\\/g, "/") + "/";
// Файл → Сценарии → Обзор → выбрать этот файл
var doc = app.open(new File(projectRoot + "assets/source/img/psd/ящик.psd"));
var out = "";
for (var i = 0; i < doc.layers.length; i++) {
    out += i + ": [" + (doc.layers[i].visible ? "V" : " ") + "] " + doc.layers[i].name + "\n";
}
doc.close(SaveOptions.DONOTSAVECHANGES);
alert(out);
