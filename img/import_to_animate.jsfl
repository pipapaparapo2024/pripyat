// ????-?????? PNG ????? ?? PSD ? Adobe Animate
// ??????? -> ????????? ??????? -> ??????? ???? ????

var doc = fl.getDocumentDOM();
if (!doc) { fl.showAlert("??????? ???????? FLA ????!"); } else {
var lib = doc.library;
var imported = 0, skipped = 0, errors = 0;

  // == preloader__2 (16 ??????) ==
  try { lib.addNewItem("folder", "preloader__2"); } catch(e) {}
  if (!lib.itemExists("01_Прямоугольник_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/01_Прямоугольник_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_Прямоугольник_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_Слой_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/02_Слой_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_Слой_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_00_2_стадия_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/03_00_2_стадия_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_00_2_стадия_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_01_2_стадия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/03_01_2_стадия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_01_2_стадия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_02_3_стадия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/03_02_3_стадия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_02_3_стадия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_Прямоугольник_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/04_Прямоугольник_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_Прямоугольник_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_Слой_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/05_Слой_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_Слой_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("06_01_мигание_света")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/06_01_мигание_света.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 06_01_мигание_света: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("06_02_Прямоугольник_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/06_02_Прямоугольник_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 06_02_Прямоугольник_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("06_03_Прямоугольник_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/06_03_Прямоугольник_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 06_03_Прямоугольник_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("06_04_2_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/06_04_2_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 06_04_2_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("06_05_Прямоугольник_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/06_05_Прямоугольник_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 06_05_Прямоугольник_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("06_06_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/06_06_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 06_06_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("06_07_1_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/06_07_1_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 06_07_1_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("06_08_1_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/06_08_1_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 06_08_1_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("06_09_1_копия_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/preloader__2/06_09_1_копия_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 06_09_1_копия_3: "+e); }
  } else { skipped++; }

  // == Барыга (69 ??????) ==
  try { lib.addNewItem("folder", "Барыга"); } catch(e) {}
  if (!lib.itemExists("01_00_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_00_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_01_Слой_82")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_01_Слой_82.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_01_Слой_82: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_03_00_Слой_11")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_03_00_Слой_11.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_03_00_Слой_11: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_03_01_activ")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_03_01_activ.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_03_01_activ: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_03_02_inactive")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_03_02_inactive.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_03_02_inactive: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_03_банка_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_03_банка_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_03_банка_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_04_00_active")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_04_00_active.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_04_00_active: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_04_01_inactive")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_04_01_inactive.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_04_01_inactive: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_04_Консы_на_полке_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_04_Консы_на_полке_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_04_Консы_на_полке_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_05_00_Слой_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_05_00_Слой_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_05_00_Слой_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_05_01_activ")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_05_01_activ.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_05_01_activ: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_05_02_Слой_8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_05_02_Слой_8.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_05_02_Слой_8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_05_03_Слой_9")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_05_03_Слой_9.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_05_03_Слой_9: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_05_04_inactive")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_05_04_inactive.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_05_04_inactive: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_05_сумка_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_05_сумка_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_05_сумка_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_07_Слой_83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_07_Слой_83.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_07_Слой_83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_08_00_inactive")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_08_00_inactive.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_08_00_inactive: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_08_01_active")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_08_01_active.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_08_01_active: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_08_Сиги_на_полке_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_08_Сиги_на_полке_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_08_Сиги_на_полке_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_09_Слой_16")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_09_Слой_16.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_09_Слой_16: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_10_купить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_10_купить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_10_купить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_11_Слой_19")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_11_Слой_19.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_11_Слой_19: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_12_Слой_18")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_12_Слой_18.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_12_Слой_18: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_13_Слой_17")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_13_Слой_17.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_13_Слой_17: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_14_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_14_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_14_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_14_01_Открыть")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_14_01_Открыть.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_14_01_Открыть: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_15_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_15_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_15_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_15_01_купить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_15_01_купить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_15_01_купить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_15_Группа_4_копия_2_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_15_Группа_4_копия_2_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_15_Группа_4_копия_2_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_Группа_1_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/01_Группа_1_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_Группа_1_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Группа 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Группа 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Группа 4 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Группа%204%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Группа 4 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Группа 4 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Группа%204%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Группа 4 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Консы на полке")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Консы%20на%20полке.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Консы на полке: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Сиги на полке")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Сиги%20на%20полке.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Сиги на полке: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Слой%200.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 16")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Слой%2016.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 16: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 17")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Слой%2017.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 17: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 18")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Слой%2018.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 18: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 19")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Слой%2019.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 19: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 82")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Слой%2082.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 82: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("банка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/банка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: банка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("купить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/купить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: купить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("посылка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/посылка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: посылка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("сумка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/сумка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: сумка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("activ")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/банка/activ.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: activ: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("inactive")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/банка/inactive.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: inactive: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 11")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/банка/Слой%2011.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 11: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Открыть")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Группа%204/Открыть.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Открыть: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Группа%204/Слой%2084.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Группа%204%20копия/Слой%2084.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("вскрыть")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Группа%204%20копия/вскрыть.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: вскрыть: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Группа%204%20копия%202/Слой%2084.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("купить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Группа%204%20копия%202/купить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: купить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("active")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Консы%20на%20полке/active.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: active: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("inactive")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Консы%20на%20полке/inactive.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: inactive: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 3 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/посылка/Слой%203%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 3 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/посылка/Слой%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/посылка/Слой%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/посылка/Слой%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/посылка/Слой%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("active")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Сиги%20на%20полке/active.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: active: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("inactive")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/Сиги%20на%20полке/inactive.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: inactive: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("activ")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/сумка/activ.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: activ: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("inactive")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/сумка/inactive.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: inactive: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/сумка/Слой%207.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/сумка/Слой%208.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 9")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Барыга/Группа%201/сумка/Слой%209.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 9: "+e); }
  } else { skipped++; }

  // == Движухи__2 (51 ??????) ==
  try { lib.addNewItem("folder", "Движухи__2"); } catch(e) {}
  if (!lib.itemExists("00_Слой_0_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/00_Слой_0_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_Слой_0_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_00_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_00_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_00_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_00_00_00_Слой_3_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_00_00_00_Слой_3_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_00_00_00_Слой_3_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_00_00_01_Слой_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_00_00_01_Слой_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_00_00_01_Слой_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_00_00_02_Кордон_первая_локация_Зоны__через_которую_новички_попадают__вну")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_00_00_02_Кордон_первая_локация_Зоны__через_которую_новички_попадают__вну.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_00_00_02_Кордон_первая_локация_Зоны__через_которую_новички_попадают__вну: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_00_01_00_Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_00_01_00_Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_00_01_00_Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_00_03_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_00_03_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_00_03_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_00_03_02_Захватить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_00_03_02_Захватить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_00_03_02_Захватить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_01_00_00_Слой_85_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_01_00_00_Слой_85_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_01_00_00_Слой_85_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_01_00_01_Слой_85")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_01_00_01_Слой_85.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_01_00_01_Слой_85: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_01_00_02_Свалка_огромная_территория_из_брошенной_техники__заводских__отх")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_01_00_02_Свалка_огромная_территория_из_брошенной_техники__заводских__отх.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_01_00_02_Свалка_огромная_территория_из_брошенной_техники__заводских__отх: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_01_01_00_Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_01_01_00_Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_01_01_00_Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_01_03_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_01_03_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_01_03_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_01_03_02_Захватить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_01_03_02_Захватить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_01_03_02_Захватить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_02_00_00_Слой_88_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_02_00_00_Слой_88_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_02_00_00_Слой_88_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_02_00_01_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_02_00_01_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_02_00_01_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_02_00_02_теМНАЯ_ДОЛИНА_ЗАБРОШЕННАЯ_ПРОМЫШЛЕННАЯ_ЗОНА_С_ЗАВОДАМИ_И_ПОДЗЕМ")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_02_00_02_теМНАЯ_ДОЛИНА_ЗАБРОШЕННАЯ_ПРОМЫШЛЕННАЯ_ЗОНА_С_ЗАВОДАМИ_И_ПОДЗЕМ.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_02_00_02_теМНАЯ_ДОЛИНА_ЗАБРОШЕННАЯ_ПРОМЫШЛЕННАЯ_ЗОНА_С_ЗАВОДАМИ_И_ПОДЗЕМ: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_02_01_00_Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_02_01_00_Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_02_01_00_Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_02_03_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_02_03_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_02_03_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_02_03_02_Захватить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_02_03_02_Захватить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_02_03_02_Захватить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_03_00_00_Слой_89_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_03_00_00_Слой_89_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_03_00_00_Слой_89_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_03_00_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_03_00_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_03_00_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_03_00_02_АГРОПРОМ_БЫВШИЙ_СЕЛЬСКОХОЗЯЙСТВЕННЫЙ_КОМПЛЕКС_С_ИНСТИТУТАМИ_И_П")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_03_00_02_АГРОПРОМ_БЫВШИЙ_СЕЛЬСКОХОЗЯЙСТВЕННЫЙ_КОМПЛЕКС_С_ИНСТИТУТАМИ_И_П.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_03_00_02_АГРОПРОМ_БЫВШИЙ_СЕЛЬСКОХОЗЯЙСТВЕННЫЙ_КОМПЛЕКС_С_ИНСТИТУТАМИ_И_П: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_03_01_00_Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_03_01_00_Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_03_01_00_Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_03_03_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_03_03_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_03_03_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_03_03_02_Захватить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_03_03_02_Захватить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_03_03_02_Захватить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_04_00_00_Слой_90_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_04_00_00_Слой_90_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_04_00_00_Слой_90_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_04_00_01_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_04_00_01_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_04_00_01_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_04_00_02_ЯНТАРЬ_ТЕРРИТОРИЯ_ВОКРУГ_ЗАБРОШЕННОГО_НАУЧНОГО_КОМПЛЕКСА__ИЗ-ЗА")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_04_00_02_ЯНТАРЬ_ТЕРРИТОРИЯ_ВОКРУГ_ЗАБРОШЕННОГО_НАУЧНОГО_КОМПЛЕКСА__ИЗ-ЗА.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_04_00_02_ЯНТАРЬ_ТЕРРИТОРИЯ_ВОКРУГ_ЗАБРОШЕННОГО_НАУЧНОГО_КОМПЛЕКСА__ИЗ-ЗА: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_04_01_00_Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_04_01_00_Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_04_01_00_Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_04_03_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_04_03_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_04_03_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_04_03_02_Захватить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_02_04_03_02_Захватить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_04_03_02_Захватить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_03_00_Слой_87")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_03_00_Слой_87.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_03_00_Слой_87: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_03_01_Слой_87_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_03_01_Слой_87_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_03_01_Слой_87_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_03_02_когда_нельзя_больше_вниз")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_03_02_когда_нельзя_больше_вниз.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_03_02_когда_нельзя_больше_вниз: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_03_03_когда_нельзя_больше_вверх")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_03_03_когда_нельзя_больше_вверх.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_03_03_когда_нельзя_больше_вверх: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_04_00_00_Слой_88_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_04_00_00_Слой_88_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_04_00_00_Слой_88_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_04_00_02_Собрать_прибыль")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_04_00_02_Собрать_прибыль.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_04_00_02_Собрать_прибыль: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_04_01_00_Когда_показывается_время")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_04_01_00_Когда_показывается_время.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_04_01_00_Когда_показывается_время: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_04_01_01_08_40_57")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_04_01_01_08_40_57.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_04_01_01_08_40_57: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_04_01_02_до_сбора_прибыли")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_04_01_02_до_сбора_прибыли.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_04_01_02_до_сбора_прибыли: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_05_00_00_Зоны_актив")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_05_00_00_Зоны_актив.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_05_00_00_Зоны_актив: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_05_00_01_зоны_пассив")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_05_00_01_зоны_пассив.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_05_00_01_зоны_пассив: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_05_01_00_пасив")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_05_01_00_пасив.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_05_01_00_пасив: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_05_01_01_Скоро")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_05_01_01_Скоро.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_05_01_01_Скоро: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_05_01_02_Слой_86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_05_01_02_Слой_86.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_05_01_02_Слой_86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_05_01_03_активная")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_05_01_03_активная.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_05_01_03_активная: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_05_02_00_актив")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_05_02_00_актив.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_05_02_00_актив: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_05_02_01_пасив")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_05_02_01_пасив.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_05_02_01_пасив: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_05_02_02_Скоро_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_05_02_02_Скоро_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_05_02_02_Скоро_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_05_02_03_Слой_86_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Движухи__2/02_05_02_03_Слой_86_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_05_02_03_Слой_86_копия: "+e); }
  } else { skipped++; }

  // == Компас (14 ??????) ==
  try { lib.addNewItem("folder", "Компас"); } catch(e) {}
  if (!lib.itemExists("00_00_Прямоугольник_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/00_00_Прямоугольник_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_00_Прямоугольник_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/00_01_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_02_Слой_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/00_02_Слой_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_02_Слой_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_03_Слой_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/00_03_Слой_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_03_Слой_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_04_Слой_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/00_04_Слой_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_04_Слой_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_05_Слой_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/00_05_Слой_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_05_Слой_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_Группа_1_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/00_Группа_1_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_Группа_1_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Группа 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/Группа%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Группа 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/Группа%201/Прямоугольник%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/Группа%201/Слой%200.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/Группа%201/Слой%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/Группа%201/Слой%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/Группа%201/Слой%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Компас/Группа%201/Слой%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 5: "+e); }
  } else { skipped++; }

  // == Награда (18 ??????) ==
  try { lib.addNewItem("folder", "Награда"); } catch(e) {}
  if (!lib.itemExists("00_00_Прямоугольник_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/00_00_Прямоугольник_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_00_Прямоугольник_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_Слой_71_копия_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/00_01_Слой_71_копия_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_Слой_71_копия_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_02_Слой_71_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/00_02_Слой_71_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_02_Слой_71_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_03_Слой_71_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/00_03_Слой_71_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_03_Слой_71_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_04_Слой_71")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/00_04_Слой_71.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_04_Слой_71: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_05_Слой_72")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/00_05_Слой_72.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_05_Слой_72: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_06_Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/00_06_Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_06_Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_07_Слой_73")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/00_07_Слой_73.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_07_Слой_73: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_Группа_1_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/00_Группа_1_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_Группа_1_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Группа 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/Группа%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Группа 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/Группа%201/Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/Группа%201/Прямоугольник%207.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 71 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/Группа%201/Слой%2071%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 71 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 71 копия 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/Группа%201/Слой%2071%20копия%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 71 копия 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 71 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/Группа%201/Слой%2071%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 71 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 71")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/Группа%201/Слой%2071.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 71: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 72")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/Группа%201/Слой%2072.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 72: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 73")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Награда/Группа%201/Слой%2073.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 73: "+e); }
  } else { skipped++; }

  // == Районы_от_Движух__2 (51 ??????) ==
  try { lib.addNewItem("folder", "Районы_от_Движух__2"); } catch(e) {}
  if (!lib.itemExists("00_00_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/00_00_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_00_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_Слой_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/00_01_Слой_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_Слой_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_02_Слой_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/00_02_Слой_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_02_Слой_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_03_Янтарь")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/00_03_Янтарь.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_03_Янтарь: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/01_00_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_01_Слой_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/01_01_Слой_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_01_Слой_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_02_Слой_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/01_02_Слой_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_02_Слой_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_03_Агропром")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/01_03_Агропром.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_03_Агропром: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_00_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/02_00_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_00_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_Слой_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/02_01_Слой_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_Слой_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_02_Слой_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/02_02_Слой_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_02_Слой_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_03_Темная_долина")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/02_03_Темная_долина.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_03_Темная_долина: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_00_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/03_00_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_00_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_01_Слой_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/03_01_Слой_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_01_Слой_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_02_Слой_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/03_02_Слой_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_02_Слой_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_03_Свалка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/03_03_Свалка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_03_Свалка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_Свалка_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/03_Свалка_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_Свалка_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_00_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/04_00_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_00_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_01_Слой_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/04_01_Слой_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_01_Слой_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_02_Кордон")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/04_02_Кордон.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_02_Кордон: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_Кордон_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/04_Кордон_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_Кордон_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_Слой_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/05_Слой_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_Слой_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("06_Слой_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/06_Слой_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 06_Слой_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_00_Слой_9")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_00_Слой_9.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_00_Слой_9: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_01_фон")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_01_фон.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_01_фон: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_02_00_name")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_02_00_name.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_02_00_name: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_02_название_движух_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_02_название_движух_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_02_название_движух_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_00_Прогресс_бар")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_03_00_Прогресс_бар.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_00_Прогресс_бар: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_01_00_Слой_16")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_03_01_00_Слой_16.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_01_00_Слой_16: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_01_01_3_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_03_01_01_3_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_01_01_3_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_01_кол-во_ходок_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_03_01_кол-во_ходок_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_01_кол-во_ходок_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_02_00_Шкала_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_03_02_00_Шкала_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_02_00_Шкала_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_02_01_Шкала_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_03_02_01_Шкала_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_02_01_Шкала_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_02_02_Шкала_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_03_02_02_Шкала_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_02_02_Шкала_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_02_03_инактив_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_03_02_03_инактив_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_02_03_инактив_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_02_04_инактив_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_03_02_04_инактив_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_02_04_инактив_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_02_Желтые_элементы_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_03_02_Желтые_элементы_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_02_Желтые_элементы_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_прогресс_бар_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_03_прогресс_бар_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_прогресс_бар_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_04_00_Слой_11")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_04_00_Слой_11.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_04_00_Слой_11: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_04_награда_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_04_награда_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_04_награда_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_05_Слой_8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_05_Слой_8.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_05_Слой_8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_1_задание_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/07_1_задание_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_1_задание_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_00_00_00_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/08_00_00_00_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_00_00_00_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_00_00_01_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/08_00_00_01_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_00_00_01_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_00_00_02_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/08_00_00_02_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_00_00_02_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_00_00_неактив_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/08_00_00_неактив_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_00_00_неактив_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_00_01_актив")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/08_00_01_актив.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_00_01_актив: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_00_02_готово")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/08_00_02_готово.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_00_02_готово: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_00_чекпоинты_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/08_00_чекпоинты_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_00_чекпоинты_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_Кнопки_выполнения_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/08_Кнопки_выполнения_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_Кнопки_выполнения_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("09_Слой_17")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Районы_от_Движух__2/09_Слой_17.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 09_Слой_17: "+e); }
  } else { skipped++; }

  // == Точно (32 ??????) ==
  try { lib.addNewItem("folder", "Точно"); } catch(e) {}
  if (!lib.itemExists("00_00_Прямоугольник_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_00_Прямоугольник_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_00_Прямоугольник_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_Слой_80")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_01_Слой_80.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_Слой_80: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_02_ПОдтвердить_действие")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_02_ПОдтвердить_действие.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_02_ПОдтвердить_действие: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_03_это_действие_будет_невозможно_отменить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_03_это_действие_будет_невозможно_отменить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_03_это_действие_будет_невозможно_отменить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_04_00_Слой_81_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_04_00_Слой_81_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_04_00_Слой_81_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_04_01_актив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_04_01_актив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_04_01_актив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_04_02_неактив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_04_02_неактив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_04_02_неактив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_04_кнопка_2_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_04_кнопка_2_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_04_кнопка_2_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_05_00_Слой_81_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_05_00_Слой_81_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_05_00_Слой_81_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_05_01_актив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_05_01_актив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_05_01_актив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_05_02_неактив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_05_02_неактив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_05_02_неактив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_05_03_подтвердить_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_05_03_подтвердить_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_05_03_подтвердить_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_05_04_подтвердить_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_05_04_подтвердить_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_05_04_подтвердить_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_05_кнопка_1_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_05_кнопка_1_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_05_кнопка_1_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_Группа_2_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/00_Группа_2_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_Группа_2_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Группа 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Группа 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("ПОдтвердить действие_")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/ПОдтвердить%20действие_.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: ПОдтвердить действие_: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/Прямоугольник%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 80")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/Слой%2080.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 80: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кнопка 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/кнопка%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кнопка 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кнопка 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/кнопка%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кнопка 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("это действие будет невозможно отменить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/это%20действие%20будет%20невозможно%20отменить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: это действие будет невозможно отменить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 81 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/кнопка%201/Слой%2081%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 81 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("актив кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/кнопка%201/актив%20кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: актив кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("неактив кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/кнопка%201/неактив%20кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: неактив кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("подтвердить копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/кнопка%201/подтвердить%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: подтвердить копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("подтвердить копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/кнопка%201/подтвердить%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: подтвердить копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 81 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/кнопка%202/Слой%2081%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 81 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("актив кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/кнопка%202/актив%20кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: актив кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("неактив кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/кнопка%202/неактив%20кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: неактив кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("отмена")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/кнопка%202/отмена.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: отмена: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("отмена_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/Точно/Группа%202/кнопка%202/отмена_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: отмена_1: "+e); }
  } else { skipped++; }

  // == магазин__выбор_валюты (153 ??????) ==
  try { lib.addNewItem("folder", "магазин__выбор_валюты"); } catch(e) {}
  if (!lib.itemExists("01_00_00_Слой_87")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_00_Слой_87.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_00_Слой_87: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_01_00_Слой_85")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_01_00_Слой_85.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_01_00_Слой_85: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_01_01_Слой_86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_01_01_Слой_86.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_01_01_Слой_86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_01_02_Слой_101")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_01_02_Слой_101.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_01_02_Слой_101: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_01_Группа_6_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_01_Группа_6_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_01_Группа_6_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_00_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_00_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_00_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_00_01_Слой_112_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_00_01_Слой_112_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_00_01_Слой_112_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_00_02_Слой_112")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_00_02_Слой_112.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_00_02_Слой_112: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_00_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_00_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_00_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_00_04_1_голос")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_00_04_1_голос.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_00_04_1_голос: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_00_05_Слой_92_копия_8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_00_05_Слой_92_копия_8.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_00_05_Слой_92_копия_8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_00_06_1600_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_00_06_1600_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_00_06_1600_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_00_1_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_00_1_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_00_1_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_01_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_01_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_01_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_01_01_Слой_112_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_01_01_Слой_112_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_01_01_Слой_112_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_01_02_Слой_113")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_01_02_Слой_113.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_01_02_Слой_113: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_01_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_01_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_01_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_01_04_2_голоса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_01_04_2_голоса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_01_04_2_голоса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_01_05_Слой_92_копия_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_01_05_Слой_92_копия_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_01_05_Слой_92_копия_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_01_06_3600_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_01_06_3600_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_01_06_3600_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_01_2_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_01_2_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_01_2_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_02_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_02_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_02_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_02_01_Слой_112_копия_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_02_01_Слой_112_копия_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_02_01_Слой_112_копия_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_02_02_Слой_114")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_02_02_Слой_114.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_02_02_Слой_114: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_02_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_02_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_02_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_02_04_3_голоса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_02_04_3_голоса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_02_04_3_голоса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_02_05_Слой_92_копия_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_02_05_Слой_92_копия_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_02_05_Слой_92_копия_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_02_06_6000_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_02_06_6000_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_02_06_6000_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_02_3_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_02_3_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_02_3_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_04_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_04_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_04_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_04_01_Слой_112_копия_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_04_01_Слой_112_копия_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_04_01_Слой_112_копия_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_04_02_Слой_116")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_04_02_Слой_116.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_04_02_Слой_116: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_04_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_04_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_04_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_04_04_5_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_04_04_5_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_04_04_5_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_04_05_Слой_92_копия_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_04_05_Слой_92_копия_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_04_05_Слой_92_копия_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_04_06_11000_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_04_06_11000_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_04_06_11000_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_04_5_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_04_5_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_04_5_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_05_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_05_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_05_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_05_01_Слой_112_копия_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_05_01_Слой_112_копия_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_05_01_Слой_112_копия_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_05_02_Слой_117")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_05_02_Слой_117.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_05_02_Слой_117: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_05_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_05_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_05_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_05_04_10_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_05_04_10_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_05_04_10_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_05_05_Слой_92_копия_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_05_05_Слой_92_копия_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_05_05_Слой_92_копия_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_05_06_22000_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_05_06_22000_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_05_06_22000_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_05_6_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_05_6_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_05_6_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_06_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_06_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_06_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_06_01_Слой_112_копия_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_06_01_Слой_112_копия_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_06_01_Слой_112_копия_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_06_02_Слой_118")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_06_02_Слой_118.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_06_02_Слой_118: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_06_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_06_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_06_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_06_04_50_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_06_04_50_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_06_04_50_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_06_05_Слой_92_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_06_05_Слой_92_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_06_05_Слой_92_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_06_06_125000_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_06_06_125000_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_06_06_125000_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_06_7_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_06_7_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_06_7_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_08_00_name_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_08_00_name_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_08_00_name_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_08_01_активный_слот")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_08_01_активный_слот.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_08_01_активный_слот: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_08_02_активное_нажатие_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_08_02_активное_нажатие_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_08_02_активное_нажатие_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_08_сиги_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_08_сиги_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_08_сиги_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_02_сиги_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_02_сиги_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_02_сиги_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_00_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_00_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_00_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_00_01_Слой_105")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_00_01_Слой_105.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_00_01_Слой_105: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_00_02_Слой_105_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_00_02_Слой_105_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_00_02_Слой_105_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_00_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_00_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_00_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_00_04_1_голос")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_00_04_1_голос.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_00_04_1_голос: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_00_05_Слой_92_копия_8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_00_05_Слой_92_копия_8.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_00_05_Слой_92_копия_8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_00_06_16_руб")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_00_06_16_руб.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_00_06_16_руб: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_01_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_01_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_01_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_01_01_Слой_105_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_01_01_Слой_105_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_01_01_Слой_105_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_01_02_Слой_104")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_01_02_Слой_104.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_01_02_Слой_104: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_01_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_01_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_01_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_01_04_2_голоса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_01_04_2_голоса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_01_04_2_голоса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_01_05_Слой_92_копия_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_01_05_Слой_92_копия_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_01_05_Слой_92_копия_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_01_06_36_руб")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_01_06_36_руб.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_01_06_36_руб: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_02_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_02_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_02_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_02_01_Слой_105_копия_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_02_01_Слой_105_копия_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_02_01_Слой_105_копия_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_02_02_Слой_106")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_02_02_Слой_106.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_02_02_Слой_106: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_02_03_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_02_03_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_02_03_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_02_04_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_02_04_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_02_04_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_02_05_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_02_05_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_02_05_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_02_06_3_голоса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_02_06_3_голоса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_02_06_3_голоса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_02_07_Слой_92_копия_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_02_07_Слой_92_копия_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_02_07_Слой_92_копия_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_04_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_04_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_04_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_04_01_Слой_105_копия_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_04_01_Слой_105_копия_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_04_01_Слой_105_копия_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_04_02_Слой_107")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_04_02_Слой_107.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_04_02_Слой_107: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_04_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_04_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_04_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_04_04_30_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_04_04_30_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_04_04_30_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_04_05_Слой_92_копия_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_04_05_Слой_92_копия_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_04_05_Слой_92_копия_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_04_06_600_руб")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_04_06_600_руб.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_04_06_600_руб: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_05_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_05_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_05_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_05_01_Слой_105_копия_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_05_01_Слой_105_копия_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_05_01_Слой_105_копия_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_05_02_Слой_108")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_05_02_Слой_108.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_05_02_Слой_108: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_05_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_05_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_05_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_05_04_100_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_05_04_100_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_05_04_100_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_05_05_Слой_92_копия_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_05_05_Слой_92_копия_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_05_05_Слой_92_копия_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_05_06_2000_руб")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_05_06_2000_руб.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_05_06_2000_руб: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_06_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_06_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_06_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_06_01_Слой_110")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_06_01_Слой_110.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_06_01_Слой_110: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_06_02_Слой_109")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_06_02_Слой_109.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_06_02_Слой_109: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_06_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_06_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_06_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_06_04_500_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_06_04_500_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_06_04_500_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_06_05_Слой_92_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_06_05_Слой_92_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_06_05_Слой_92_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_06_06_10000_руб")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_06_06_10000_руб.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_06_06_10000_руб: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_07_01_Слой_111")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_07_01_Слой_111.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_07_01_Слой_111: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_08_00_name_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_08_00_name_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_08_00_name_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_08_01_Слой_103")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_08_01_Слой_103.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_08_01_Слой_103: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_08_02_активные_рубли")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_08_02_активные_рубли.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_08_02_активные_рубли: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_03_08_03_активный_слот")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_03_08_03_активный_слот.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_03_08_03_активный_слот: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_00_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_00_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_00_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_00_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_00_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_00_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_00_02_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_00_02_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_00_02_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_00_03_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_00_03_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_00_03_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_00_04_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_00_04_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_00_04_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_00_05_1_голос")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_00_05_1_голос.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_00_05_1_голос: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_01_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_01_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_01_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_01_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_01_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_01_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_01_02_Слой_97")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_01_02_Слой_97.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_01_02_Слой_97: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_01_03_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_01_03_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_01_03_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_01_04_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_01_04_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_01_04_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_01_05_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_01_05_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_01_05_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_01_06_5_голоса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_01_06_5_голоса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_01_06_5_голоса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_02_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_02_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_02_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_02_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_02_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_02_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_02_02_Слой_96")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_02_02_Слой_96.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_02_02_Слой_96: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_02_03_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_02_03_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_02_03_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_02_04_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_02_04_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_02_04_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_02_05_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_02_05_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_02_05_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_02_06_15_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_02_06_15_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_02_06_15_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_04_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_04_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_04_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_04_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_04_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_04_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_04_02_Слой_95")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_04_02_Слой_95.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_04_02_Слой_95: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_04_03_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_04_03_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_04_03_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_04_04_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_04_04_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_04_04_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_04_05_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_04_05_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_04_05_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_04_06_50_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_04_06_50_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_04_06_50_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_05_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_05_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_05_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_05_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_05_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_05_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_05_02_Слой_95")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_05_02_Слой_95.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_05_02_Слой_95: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_05_03_Слой_94")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_05_03_Слой_94.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_05_03_Слой_94: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_05_04_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_05_04_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_05_04_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_05_05_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_05_05_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_05_05_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_05_06_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_05_06_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_05_06_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_05_07_100_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_05_07_100_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_05_07_100_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_06_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_06_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_06_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_06_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_06_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_06_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_06_02_Слой_93")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_06_02_Слой_93.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_06_02_Слой_93: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_06_03_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_06_03_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_06_03_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_06_04_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_06_04_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_06_04_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_06_05_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_06_05_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_06_05_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_06_06_250_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_06_06_250_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_06_06_250_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_08_00_name")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_08_00_name.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_08_00_name: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_08_01_Слой_102")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_08_01_Слой_102.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_08_01_Слой_102: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_04_08_02_активный_слот_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_04_08_02_активный_слот_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_04_08_02_активный_слот_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_background_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_00_background_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_background_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_Группа_5_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/магазин__выбор_валюты/01_Группа_5_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_Группа_5_GROUP: "+e); }
  } else { skipped++; }

  // == облако_с_валютой__2 (3 ??????) ==
  try { lib.addNewItem("folder", "облако_с_валютой__2"); } catch(e) {}
  if (!lib.itemExists("00_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/облако_с_валютой__2/00_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_количество_валюты")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/облако_с_валютой__2/01_количество_валюты.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_количество_валюты: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_Описание_валюты__и_где_ее_взять")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/облако_с_валютой__2/02_Описание_валюты__и_где_ее_взять.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_Описание_валюты__и_где_ее_взять: "+e); }
  } else { skipped++; }

  // == перс__2 (8 ??????) ==
  try { lib.addNewItem("folder", "перс__2"); } catch(e) {}
  if (!lib.itemExists("00_00_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/перс__2/00_00_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_00_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_Слой_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/перс__2/00_01_Слой_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_Слой_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_02_Слой_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/перс__2/00_02_Слой_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_02_Слой_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_03_Слой_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/перс__2/00_03_Слой_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_03_Слой_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_04_Слой_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/перс__2/00_04_Слой_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_04_Слой_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_05_Слой_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/перс__2/00_05_Слой_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_05_Слой_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_06_Слой_6_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/перс__2/00_06_Слой_6_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_06_Слой_6_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_перс_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/перс__2/00_перс_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_перс_GROUP: "+e); }
  } else { skipped++; }

  // == хата (30 ??????) ==
  try { lib.addNewItem("folder", "хата"); } catch(e) {}
  if (!lib.itemExists("00_00_Слой_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_00_Слой_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_00_Слой_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_00_Слой_9")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_01_00_Слой_9.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_00_Слой_9: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_01_Слой_8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_01_01_Слой_8.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_01_Слой_8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_02_Слой_11")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_01_02_Слой_11.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_02_Слой_11: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_03_Слой_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_01_03_Слой_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_03_Слой_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_04_Цветовой_тон_Насыщенность_1_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_01_04_Цветовой_тон_Насыщенность_1_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_04_Цветовой_тон_Насыщенность_1_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_05_Слой_10")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_01_05_Слой_10.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_05_Слой_10: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_06_Слой_157_копия_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_01_06_Слой_157_копия_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_06_Слой_157_копия_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_07_Слой_157_копия_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_01_07_Слой_157_копия_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_07_Слой_157_копия_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_08_Слой_157_копия_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_01_08_Слой_157_копия_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_08_Слой_157_копия_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_09_Слой_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_01_09_Слой_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_09_Слой_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_10_Прямоугольник_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_01_10_Прямоугольник_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_10_Прямоугольник_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_11_Прямоугольник_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_01_11_Прямоугольник_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_11_Прямоугольник_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_01_стенка_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_01_стенка_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_01_стенка_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("00_Фон_копия_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/00_Фон_копия_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_Фон_копия_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фон копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фон копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/Слой%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("стенка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/стенка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: стенка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/стенка/Прямоугольник%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/стенка/Прямоугольник%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 10")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/стенка/Слой%2010.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 10: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 11")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/стенка/Слой%2011.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 11: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 157 копия 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/стенка/Слой%20157%20копия%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 157 копия 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 157 копия 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/стенка/Слой%20157%20копия%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 157 копия 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 157 копия 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/стенка/Слой%20157%20копия%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 157 копия 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/стенка/Слой%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/стенка/Слой%207.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/стенка/Слой%208.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 9")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/стенка/Слой%209.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 9: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Цветовой тон_Насыщенность 1 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/хата/Фон%20копия/стенка/Цветовой%20тон_Насыщенность%201%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Цветовой тон_Насыщенность 1 копия: "+e); }
  } else { skipped++; }

  // == худ3_0__3 (413 ??????) ==
  try { lib.addNewItem("folder", "худ3_0__3"); } catch(e) {}
  if (!lib.itemExists("00_Фон")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/00_Фон.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 00_Фон: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_00_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_00_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_00_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_01_Слой_82")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_01_Слой_82.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_01_Слой_82: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_03_00_Слой_11")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_03_00_Слой_11.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_03_00_Слой_11: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_03_01_activ")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_03_01_activ.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_03_01_activ: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_03_02_inactive")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_03_02_inactive.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_03_02_inactive: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_03_банка_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_03_банка_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_03_банка_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_04_00_active")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_04_00_active.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_04_00_active: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_04_01_inactive")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_04_01_inactive.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_04_01_inactive: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_04_Консы_на_полке_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_04_Консы_на_полке_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_04_Консы_на_полке_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_05_00_Слой_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_05_00_Слой_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_05_00_Слой_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_05_01_activ")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_05_01_activ.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_05_01_activ: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_05_02_Слой_8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_05_02_Слой_8.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_05_02_Слой_8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_05_03_Слой_9")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_05_03_Слой_9.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_05_03_Слой_9: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_05_04_inactive")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_05_04_inactive.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_05_04_inactive: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_05_сумка_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_05_сумка_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_05_сумка_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_07_00_inactive")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_07_00_inactive.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_07_00_inactive: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_07_01_active")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_07_01_active.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_07_01_active: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_07_Сиги_на_полке_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_07_Сиги_на_полке_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_07_Сиги_на_полке_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_08_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_08_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_08_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_08_01_Открыть")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_08_01_Открыть.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_08_01_Открыть: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_09_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_09_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_09_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_09_01_купить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_09_01_купить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_09_01_купить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_09_Группа_4_копия_2_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_09_Группа_4_копия_2_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_09_Группа_4_копия_2_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("01_Группа_1_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/01_Группа_1_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 01_Группа_1_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_00_Слой_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_00_Слой_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_00_Слой_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_00_Слой_9")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_01_00_Слой_9.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_00_Слой_9: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_01_Слой_8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_01_01_Слой_8.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_01_Слой_8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_02_Слой_11")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_01_02_Слой_11.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_02_Слой_11: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_03_Слой_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_01_03_Слой_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_03_Слой_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_04_Цветовой_тон_Насыщенность_1_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_01_04_Цветовой_тон_Насыщенность_1_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_04_Цветовой_тон_Насыщенность_1_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_05_Слой_10")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_01_05_Слой_10.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_05_Слой_10: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_06_Слой_157_копия_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_01_06_Слой_157_копия_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_06_Слой_157_копия_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_07_Слой_157_копия_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_01_07_Слой_157_копия_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_07_Слой_157_копия_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_08_Слой_157_копия_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_01_08_Слой_157_копия_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_08_Слой_157_копия_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_09_Слой_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_01_09_Слой_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_09_Слой_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_10_Прямоугольник_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_01_10_Прямоугольник_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_10_Прямоугольник_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_11_Прямоугольник_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_01_11_Прямоугольник_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_11_Прямоугольник_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_01_стенка_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_01_стенка_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_01_стенка_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("02_Фон_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/02_Фон_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 02_Фон_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_00_00_Слой_32")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_00_00_Слой_32.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_00_00_Слой_32: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_00_01_Слой_41")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_00_01_Слой_41.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_00_01_Слой_41: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_00_03_Слой_43")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_00_03_Слой_43.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_00_03_Слой_43: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_00_нижний_худ_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_00_нижний_худ_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_00_нижний_худ_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_02_00_Фигура_2_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_02_00_Фигура_2_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_02_00_Фигура_2_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_02_01_линия_копия_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_02_01_линия_копия_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_02_01_линия_копия_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_02_02_линия_копия_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_02_02_линия_копия_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_02_02_линия_копия_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_02_03_боссы")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_02_03_боссы.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_02_03_боссы: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_02_04_Слой_35_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_02_04_Слой_35_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_02_04_Слой_35_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_02_05_Слой_37")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_02_05_Слой_37.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_02_05_Слой_37: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_02_Боссы_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_02_Боссы_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_02_Боссы_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_03_00_Фигура_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_03_00_Фигура_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_03_00_Фигура_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_03_01_Слой_35")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_03_01_Слой_35.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_03_01_Слой_35: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_03_02_Сидорович")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_03_02_Сидорович.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_03_02_Сидорович: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_03_03_линия_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_03_03_линия_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_03_03_линия_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_03_04_линия_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_03_04_линия_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_03_04_линия_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_03_05_Слой_68")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_03_05_Слой_68.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_03_05_Слой_68: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_03_07_Слой_34")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_03_07_Слой_34.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_03_07_Слой_34: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_03_Сидорович_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_03_Сидорович_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_03_Сидорович_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_04_00_Слой_35_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_04_00_Слой_35_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_04_00_Слой_35_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_04_01_Фигура_2_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_04_01_Фигура_2_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_04_01_Фигура_2_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_04_02_линия_копия_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_04_02_линия_копия_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_04_02_линия_копия_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_04_03_Банда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_04_03_Банда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_04_03_Банда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_04_04_линия_копия_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_04_04_линия_копия_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_04_04_линия_копия_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_04_05_Слой_38")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_04_05_Слой_38.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_04_05_Слой_38: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_04_Банда_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_04_Банда_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_04_Банда_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_07_00_Слой_35_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_07_00_Слой_35_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_07_00_Слой_35_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_07_02_линия_копия_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_07_02_линия_копия_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_07_02_линия_копия_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_07_03_Оружейка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_07_03_Оружейка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_07_03_Оружейка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_07_04_линия_копия_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_07_04_линия_копия_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_07_04_линия_копия_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_07_05_Слой_39")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_07_05_Слой_39.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_07_05_Слой_39: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_07_оружейка_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_07_оружейка_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_07_оружейка_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("03_нижняя_панель_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/03_нижняя_панель_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 03_нижняя_панель_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_00_Прямоугольник_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_00_Прямоугольник_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_00_Прямоугольник_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_01_Слой_120")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_01_Слой_120.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_01_Слой_120: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_02_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_02_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_02_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_00_00_00_Слой_3_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_00_00_00_Слой_3_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_00_00_00_Слой_3_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_00_00_01_Слой_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_00_00_01_Слой_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_00_00_01_Слой_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_00_00_02_Кордон_первая_локация_Зоны__через_которую_новички_попадают__вну")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_00_00_02_Кордон_первая_локация_Зоны__через_которую_новички_попадают__вну.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_00_00_02_Кордон_первая_локация_Зоны__через_которую_новички_попадают__вну: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_00_01_00_Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_00_01_00_Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_00_01_00_Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_00_03_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_00_03_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_00_03_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_00_03_02_Захватить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_00_03_02_Захватить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_00_03_02_Захватить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_01_00_00_Слой_85_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_01_00_00_Слой_85_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_01_00_00_Слой_85_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_01_00_01_Слой_85")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_01_00_01_Слой_85.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_01_00_01_Слой_85: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_01_00_02_Свалка_огромная_территория_из_брошенной_техники__заводских__отх")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_01_00_02_Свалка_огромная_территория_из_брошенной_техники__заводских__отх.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_01_00_02_Свалка_огромная_территория_из_брошенной_техники__заводских__отх: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_01_01_00_Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_01_01_00_Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_01_01_00_Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_01_03_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_01_03_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_01_03_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_01_03_02_Захватить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_01_03_02_Захватить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_01_03_02_Захватить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_02_00_00_Слой_88_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_02_00_00_Слой_88_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_02_00_00_Слой_88_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_02_00_01_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_02_00_01_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_02_00_01_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_02_00_02_теМНАЯ_ДОЛИНА_ЗАБРОШЕННАЯ_ПРОМЫШЛЕННАЯ_ЗОНА_С_ЗАВОДАМИ_И_ПОДЗЕМ")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_02_00_02_теМНАЯ_ДОЛИНА_ЗАБРОШЕННАЯ_ПРОМЫШЛЕННАЯ_ЗОНА_С_ЗАВОДАМИ_И_ПОДЗЕМ.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_02_00_02_теМНАЯ_ДОЛИНА_ЗАБРОШЕННАЯ_ПРОМЫШЛЕННАЯ_ЗОНА_С_ЗАВОДАМИ_И_ПОДЗЕМ: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_02_01_00_Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_02_01_00_Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_02_01_00_Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_02_03_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_02_03_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_02_03_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_02_03_02_Захватить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_02_03_02_Захватить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_02_03_02_Захватить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_03_00_00_Слой_89_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_03_00_00_Слой_89_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_03_00_00_Слой_89_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_03_00_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_03_00_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_03_00_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_03_00_02_АГРОПРОМ_БЫВШИЙ_СЕЛЬСКОХОЗЯЙСТВЕННЫЙ_КОМПЛЕКС_С_ИНСТИТУТАМИ_И_П")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_03_00_02_АГРОПРОМ_БЫВШИЙ_СЕЛЬСКОХОЗЯЙСТВЕННЫЙ_КОМПЛЕКС_С_ИНСТИТУТАМИ_И_П.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_03_00_02_АГРОПРОМ_БЫВШИЙ_СЕЛЬСКОХОЗЯЙСТВЕННЫЙ_КОМПЛЕКС_С_ИНСТИТУТАМИ_И_П: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_03_01_00_Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_03_01_00_Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_03_01_00_Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_03_03_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_03_03_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_03_03_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_03_03_02_Захватить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_03_03_02_Захватить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_03_03_02_Захватить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_04_00_00_Слой_90_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_04_00_00_Слой_90_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_04_00_00_Слой_90_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_04_00_01_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_04_00_01_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_04_00_01_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_04_00_02_ЯНТАРЬ_ТЕРРИТОРИЯ_ВОКРУГ_ЗАБРОШЕННОГО_НАУЧНОГО_КОМПЛЕКСА__ИЗ-ЗА")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_04_00_02_ЯНТАРЬ_ТЕРРИТОРИЯ_ВОКРУГ_ЗАБРОШЕННОГО_НАУЧНОГО_КОМПЛЕКСА__ИЗ-ЗА.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_04_00_02_ЯНТАРЬ_ТЕРРИТОРИЯ_ВОКРУГ_ЗАБРОШЕННОГО_НАУЧНОГО_КОМПЛЕКСА__ИЗ-ЗА: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_04_01_00_Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_04_01_00_Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_04_01_00_Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_04_03_00_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_04_03_00_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_04_03_00_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_04_04_03_02_Захватить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_04_04_03_02_Захватить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_04_04_03_02_Захватить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_05_00_Слой_87")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_05_00_Слой_87.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_05_00_Слой_87: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_05_01_Слой_87_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_05_01_Слой_87_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_05_01_Слой_87_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_05_02_когда_нельзя_больше_вниз")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_05_02_когда_нельзя_больше_вниз.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_05_02_когда_нельзя_больше_вниз: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_05_03_когда_нельзя_больше_вверх")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_05_03_когда_нельзя_больше_вверх.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_05_03_когда_нельзя_больше_вверх: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_06_00_00_Слой_88_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_06_00_00_Слой_88_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_06_00_00_Слой_88_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_06_00_02_Собрать_прибыль")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_06_00_02_Собрать_прибыль.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_06_00_02_Собрать_прибыль: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_06_01_00_Когда_показывается_время")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_06_01_00_Когда_показывается_время.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_06_01_00_Когда_показывается_время: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_06_01_02_до_сбора_прибыли")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_06_01_02_до_сбора_прибыли.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_06_01_02_до_сбора_прибыли: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_07_00_00_Зоны_актив")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_07_00_00_Зоны_актив.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_07_00_00_Зоны_актив: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_07_00_01_зоны_пассив")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_07_00_01_зоны_пассив.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_07_00_01_зоны_пассив: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_07_01_00_пасив")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_07_01_00_пасив.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_07_01_00_пасив: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_07_01_01_Скоро")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_07_01_01_Скоро.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_07_01_01_Скоро: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_07_01_02_Слой_86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_07_01_02_Слой_86.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_07_01_02_Слой_86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_07_01_03_активная")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_07_01_03_активная.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_07_01_03_активная: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_07_02_00_актив")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_07_02_00_актив.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_07_02_00_актив: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_07_02_01_пасив")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_07_02_01_пасив.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_07_02_01_пасив: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_07_02_02_Скоро_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_07_02_02_Скоро_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_07_02_02_Скоро_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("04_07_02_03_Слой_86_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/04_07_02_03_Слой_86_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 04_07_02_03_Слой_86_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_00_01_Слой_18_копия_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_00_01_Слой_18_копия_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_00_01_Слой_18_копия_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_01_00_Слой_18")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_01_00_Слой_18.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_01_00_Слой_18: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_01_02_Слой_25")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_01_02_Слой_25.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_01_02_Слой_25: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_01_худ_верхний_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_01_худ_верхний_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_01_худ_верхний_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_02_00_01_Слой_18_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_02_00_01_Слой_18_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_02_00_01_Слой_18_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_02_01_01_Слой_18_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_02_01_01_Слой_18_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_02_01_01_Слой_18_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_02_02_01_Слой_18_копия_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_02_02_01_Слой_18_копия_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_02_02_01_Слой_18_копия_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_03_01_Слой_18_копия_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_03_01_Слой_18_копия_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_03_01_Слой_18_копия_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_04_00_шкала")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_04_00_шкала.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_04_00_шкала: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_04_01_кол-во_энки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_04_01_кол-во_энки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_04_01_кол-во_энки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_04_02_00_Прямоугольник__скругл__углы_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_04_02_00_Прямоугольник__скругл__углы_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_04_02_00_Прямоугольник__скругл__углы_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_04_02_01_layer")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_04_02_01_layer.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_04_02_01_layer: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_04_02_кнопка_покупки_энки_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_04_02_кнопка_покупки_энки_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_04_02_кнопка_покупки_энки_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_04_энка_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_04_энка_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_04_энка_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_05_00_шкала_уровеня")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_05_00_шкала_уровеня.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_05_00_шкала_уровеня: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_05_01_линия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_05_01_линия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_05_01_линия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_05_02_уровень")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_05_02_уровень.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_05_02_уровень: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_05_03_Имя")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_05_03_Имя.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_05_03_Имя: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_05_04_00_Эллипс_1_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_05_04_00_Эллипс_1_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_05_04_00_Эллипс_1_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_05_04_01_Слой_15")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_05_04_01_Слой_15.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_05_04_01_Слой_15: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_05_04_фото_перса_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_05_04_фото_перса_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_05_04_фото_перса_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_05_имя_уровень_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_05_имя_уровень_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_05_имя_уровень_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("05_верхняя_панель_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/05_верхняя_панель_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 05_верхняя_панель_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_00_00_Слой_47")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_00_00_Слой_47.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_00_00_Слой_47: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_00_01_Прямоугольник_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_00_01_Прямоугольник_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_00_01_Прямоугольник_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_00_02_Слой_49")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_00_02_Слой_49.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_00_02_Слой_49: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_00_03_Прямоугольник_5_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_00_03_Прямоугольник_5_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_00_03_Прямоугольник_5_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_00_04_Слой_48")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_00_04_Слой_48.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_00_04_Слой_48: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_00_05_Прямоугольник_5_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_00_05_Прямоугольник_5_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_00_05_Прямоугольник_5_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_01_00_Слой_64")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_01_00_Слой_64.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_01_00_Слой_64: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_01_01_Слой_66")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_01_01_Слой_66.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_01_01_Слой_66: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_01_02_Бот")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_01_02_Бот.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_01_02_Бот: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_02_00_Слой_64")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_02_00_Слой_64.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_02_00_Слой_64: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_02_01_Слой_66")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_02_01_Слой_66.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_02_01_Слой_66: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_02_02_Слой_67")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_02_02_Слой_67.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_02_02_Слой_67: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_02_03_Слой_67_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_02_03_Слой_67_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_02_03_Слой_67_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_02_04_Пропуск")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_02_04_Пропуск.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_02_04_Пропуск: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_00_Слой_64")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_03_00_Слой_64.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_00_Слой_64: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_01_Слой_65")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_03_01_Слой_65.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_01_Слой_65: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("07_03_02_Скряга")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/07_03_02_Скряга.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 07_03_02_Скряга: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_00_Слой_69")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/08_00_Слой_69.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_00_Слой_69: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_01_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/08_01_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_01_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_02_Слой_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/08_02_Слой_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_02_Слой_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_03_Слой_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/08_03_Слой_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_03_Слой_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_04_Слой_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/08_04_Слой_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_04_Слой_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_05_Слой_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/08_05_Слой_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_05_Слой_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_06_Слой_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/08_06_Слой_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_06_Слой_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("08_07_Слой_6_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/08_07_Слой_6_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 08_07_Слой_6_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("10_00_Слой_71_копия_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/10_00_Слой_71_копия_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 10_00_Слой_71_копия_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("10_01_Слой_71_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/10_01_Слой_71_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 10_01_Слой_71_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("10_02_Слой_71_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/10_02_Слой_71_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 10_02_Слой_71_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("10_03_Слой_71")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/10_03_Слой_71.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 10_03_Слой_71: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("10_04_Слой_72")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/10_04_Слой_72.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 10_04_Слой_72: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("10_05_Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/10_05_Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 10_05_Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("10_06_Слой_73")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/10_06_Слой_73.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 10_06_Слой_73: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("11_00_Прямоугольник_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/11_00_Прямоугольник_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 11_00_Прямоугольник_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("11_01_Слой_80")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/11_01_Слой_80.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 11_01_Слой_80: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("11_02_ПОдтвердить_действие")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/11_02_ПОдтвердить_действие.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 11_02_ПОдтвердить_действие: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("11_03_это_действие_будет_невозможно_отменить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/11_03_это_действие_будет_невозможно_отменить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 11_03_это_действие_будет_невозможно_отменить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("11_04_00_Слой_81_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/11_04_00_Слой_81_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 11_04_00_Слой_81_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("11_04_01_актив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/11_04_01_актив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 11_04_01_актив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("11_04_02_неактив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/11_04_02_неактив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 11_04_02_неактив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("11_05_00_Слой_81_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/11_05_00_Слой_81_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 11_05_00_Слой_81_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("11_05_01_актив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/11_05_01_актив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 11_05_01_актив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("11_05_02_неактив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/11_05_02_неактив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 11_05_02_неактив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("11_05_03_подтвердить_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/11_05_03_подтвердить_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 11_05_03_подтвердить_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("11_05_04_подтвердить_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/11_05_04_подтвердить_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 11_05_04_подтвердить_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("12_00_Прямоугольник_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/12_00_Прямоугольник_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 12_00_Прямоугольник_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("12_01_00_Слой_0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/12_01_00_Слой_0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 12_01_00_Слой_0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("12_01_01_Слой_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/12_01_01_Слой_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 12_01_01_Слой_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("12_01_02_Слой_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/12_01_02_Слой_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 12_01_02_Слой_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("12_01_03_Слой_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/12_01_03_Слой_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 12_01_03_Слой_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("12_01_04_Слой_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/12_01_04_Слой_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 12_01_04_Слой_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("13_00_Слой_81")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/13_00_Слой_81.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 13_00_Слой_81: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("13_01_количество_валюты")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/13_01_количество_валюты.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 13_01_количество_валюты: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_00_Слой_87")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_00_Слой_87.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_00_Слой_87: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_01_00_Слой_85")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_01_00_Слой_85.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_01_00_Слой_85: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_01_01_Слой_86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_01_01_Слой_86.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_01_01_Слой_86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_01_02_Слой_101")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_01_02_Слой_101.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_01_02_Слой_101: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_00_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_00_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_00_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_00_01_Слой_112_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_00_01_Слой_112_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_00_01_Слой_112_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_00_02_Слой_112")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_00_02_Слой_112.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_00_02_Слой_112: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_00_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_00_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_00_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_00_04_1_голос")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_00_04_1_голос.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_00_04_1_голос: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_00_05_Слой_92_копия_8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_00_05_Слой_92_копия_8.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_00_05_Слой_92_копия_8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_00_06_1600_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_00_06_1600_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_00_06_1600_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_01_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_01_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_01_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_01_01_Слой_112_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_01_01_Слой_112_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_01_01_Слой_112_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_01_02_Слой_113")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_01_02_Слой_113.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_01_02_Слой_113: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_01_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_01_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_01_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_01_04_2_голоса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_01_04_2_голоса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_01_04_2_голоса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_01_05_Слой_92_копия_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_01_05_Слой_92_копия_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_01_05_Слой_92_копия_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_01_06_3600_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_01_06_3600_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_01_06_3600_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_02_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_02_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_02_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_02_01_Слой_112_копия_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_02_01_Слой_112_копия_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_02_01_Слой_112_копия_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_02_02_Слой_114")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_02_02_Слой_114.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_02_02_Слой_114: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_02_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_02_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_02_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_02_04_3_голоса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_02_04_3_голоса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_02_04_3_голоса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_02_05_Слой_92_копия_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_02_05_Слой_92_копия_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_02_05_Слой_92_копия_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_02_06_6000_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_02_06_6000_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_02_06_6000_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_04_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_04_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_04_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_04_01_Слой_112_копия_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_04_01_Слой_112_копия_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_04_01_Слой_112_копия_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_04_02_Слой_116")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_04_02_Слой_116.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_04_02_Слой_116: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_04_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_04_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_04_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_04_04_5_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_04_04_5_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_04_04_5_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_04_05_Слой_92_копия_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_04_05_Слой_92_копия_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_04_05_Слой_92_копия_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_04_06_11000_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_04_06_11000_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_04_06_11000_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_05_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_05_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_05_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_05_01_Слой_112_копия_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_05_01_Слой_112_копия_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_05_01_Слой_112_копия_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_05_02_Слой_117")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_05_02_Слой_117.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_05_02_Слой_117: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_05_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_05_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_05_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_05_04_10_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_05_04_10_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_05_04_10_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_05_05_Слой_92_копия_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_05_05_Слой_92_копия_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_05_05_Слой_92_копия_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_05_06_22000_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_05_06_22000_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_05_06_22000_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_06_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_06_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_06_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_06_01_Слой_112_копия_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_06_01_Слой_112_копия_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_06_01_Слой_112_копия_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_06_02_Слой_118")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_06_02_Слой_118.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_06_02_Слой_118: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_06_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_06_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_06_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_06_04_50_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_06_04_50_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_06_04_50_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_06_05_Слой_92_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_06_05_Слой_92_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_06_05_Слой_92_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_06_06_125000_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_06_06_125000_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_06_06_125000_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_08_00_name_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_08_00_name_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_08_00_name_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_08_01_активный_слот")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_08_01_активный_слот.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_08_01_активный_слот: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_02_08_02_активное_нажатие_сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_02_08_02_активное_нажатие_сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_02_08_02_активное_нажатие_сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_00_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_00_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_00_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_00_01_Слой_105")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_00_01_Слой_105.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_00_01_Слой_105: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_00_02_Слой_105_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_00_02_Слой_105_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_00_02_Слой_105_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_00_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_00_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_00_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_00_04_1_голос")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_00_04_1_голос.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_00_04_1_голос: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_00_05_Слой_92_копия_8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_00_05_Слой_92_копия_8.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_00_05_Слой_92_копия_8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_00_06_16_руб")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_00_06_16_руб.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_00_06_16_руб: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_01_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_01_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_01_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_01_01_Слой_105_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_01_01_Слой_105_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_01_01_Слой_105_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_01_02_Слой_104")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_01_02_Слой_104.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_01_02_Слой_104: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_01_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_01_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_01_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_01_04_2_голоса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_01_04_2_голоса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_01_04_2_голоса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_01_05_Слой_92_копия_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_01_05_Слой_92_копия_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_01_05_Слой_92_копия_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_01_06_36_руб")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_01_06_36_руб.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_01_06_36_руб: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_02_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_02_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_02_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_02_01_Слой_105_копия_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_02_01_Слой_105_копия_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_02_01_Слой_105_копия_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_02_02_Слой_106")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_02_02_Слой_106.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_02_02_Слой_106: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_02_03_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_02_03_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_02_03_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_02_04_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_02_04_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_02_04_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_02_05_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_02_05_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_02_05_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_02_06_3_голоса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_02_06_3_голоса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_02_06_3_голоса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_02_07_Слой_92_копия_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_02_07_Слой_92_копия_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_02_07_Слой_92_копия_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_04_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_04_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_04_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_04_01_Слой_105_копия_5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_04_01_Слой_105_копия_5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_04_01_Слой_105_копия_5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_04_02_Слой_107")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_04_02_Слой_107.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_04_02_Слой_107: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_04_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_04_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_04_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_04_04_30_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_04_04_30_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_04_04_30_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_04_05_Слой_92_копия_4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_04_05_Слой_92_копия_4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_04_05_Слой_92_копия_4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_04_06_600_руб")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_04_06_600_руб.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_04_06_600_руб: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_05_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_05_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_05_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_05_01_Слой_105_копия_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_05_01_Слой_105_копия_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_05_01_Слой_105_копия_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_05_02_Слой_108")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_05_02_Слой_108.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_05_02_Слой_108: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_05_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_05_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_05_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_05_04_100_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_05_04_100_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_05_04_100_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_05_05_Слой_92_копия_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_05_05_Слой_92_копия_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_05_05_Слой_92_копия_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_05_06_2000_руб")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_05_06_2000_руб.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_05_06_2000_руб: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_06_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_06_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_06_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_06_01_Слой_110")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_06_01_Слой_110.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_06_01_Слой_110: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_06_02_Слой_109")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_06_02_Слой_109.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_06_02_Слой_109: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_06_03_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_06_03_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_06_03_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_06_04_500_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_06_04_500_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_06_04_500_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_06_05_Слой_92_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_06_05_Слой_92_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_06_05_Слой_92_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_06_06_10000_руб")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_06_06_10000_руб.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_06_06_10000_руб: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_07_01_Слой_111")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_07_01_Слой_111.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_07_01_Слой_111: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_08_00_name_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_08_00_name_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_08_00_name_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_08_01_Слой_103")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_08_01_Слой_103.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_08_01_Слой_103: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_08_02_активные_рубли")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_08_02_активные_рубли.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_08_02_активные_рубли: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_03_08_03_активный_слот")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_03_08_03_активный_слот.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_03_08_03_активный_слот: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_00_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_00_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_00_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_00_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_00_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_00_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_00_02_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_00_02_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_00_02_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_00_03_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_00_03_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_00_03_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_00_04_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_00_04_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_00_04_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_00_05_1_голос")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_00_05_1_голос.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_00_05_1_голос: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_01_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_01_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_01_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_01_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_01_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_01_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_01_02_Слой_97")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_01_02_Слой_97.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_01_02_Слой_97: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_01_03_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_01_03_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_01_03_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_01_04_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_01_04_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_01_04_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_01_05_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_01_05_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_01_05_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_01_06_5_голоса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_01_06_5_голоса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_01_06_5_голоса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_02_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_02_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_02_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_02_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_02_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_02_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_02_02_Слой_96")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_02_02_Слой_96.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_02_02_Слой_96: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_02_03_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_02_03_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_02_03_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_02_04_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_02_04_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_02_04_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_02_05_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_02_05_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_02_05_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_02_06_15_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_02_06_15_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_02_06_15_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_04_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_04_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_04_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_04_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_04_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_04_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_04_02_Слой_95")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_04_02_Слой_95.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_04_02_Слой_95: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_04_03_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_04_03_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_04_03_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_04_04_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_04_04_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_04_04_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_04_05_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_04_05_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_04_05_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_04_06_50_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_04_06_50_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_04_06_50_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_05_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_05_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_05_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_05_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_05_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_05_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_05_02_Слой_95")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_05_02_Слой_95.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_05_02_Слой_95: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_05_03_Слой_94")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_05_03_Слой_94.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_05_03_Слой_94: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_05_04_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_05_04_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_05_04_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_05_05_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_05_05_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_05_05_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_05_06_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_05_06_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_05_06_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_05_07_100_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_05_07_100_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_05_07_100_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_06_00_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_06_00_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_06_00_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_06_01_Слой_89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_06_01_Слой_89.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_06_01_Слой_89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_06_02_Слой_93")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_06_02_Слой_93.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_06_02_Слой_93: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_06_03_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_06_03_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_06_03_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_06_04_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_06_04_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_06_04_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_06_05_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_06_05_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_06_05_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_06_06_250_голосов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_06_06_250_голосов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_06_06_250_голосов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_08_00_name")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_08_00_name.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_08_00_name: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_08_01_Слой_102")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_08_01_Слой_102.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_08_01_Слой_102: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("14_00_04_08_02_активный_слот_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/14_00_04_08_02_активный_слот_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 14_00_04_08_02_активный_слот_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_00_Прямоугольник_1_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_00_Прямоугольник_1_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_00_Прямоугольник_1_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_01_Слой_82")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_01_Слой_82.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_01_Слой_82: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_01_00_Слой_83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_01_00_Слой_83.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_01_00_Слой_83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_01_01_Слой_92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_01_01_Слой_92.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_01_01_Слой_92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_01_02_2000")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_01_02_2000.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_01_02_2000: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_01_03_Слой_86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_01_03_Слой_86.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_01_03_Слой_86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_01_04_85")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_01_04_85.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_01_04_85: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_02_00_Слой_83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_02_00_Слой_83.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_02_00_Слой_83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_02_01_Слой_91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_02_01_Слой_91.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_02_01_Слой_91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_02_02_1300")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_02_02_1300.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_02_02_1300: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_02_03_Слой_86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_02_03_Слой_86.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_02_03_Слой_86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_02_04_60")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_02_04_60.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_02_04_60: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_03_00_Слой_83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_03_00_Слой_83.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_03_00_Слой_83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_03_01_Слой_90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_03_01_Слой_90.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_03_01_Слой_90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_03_02_850")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_03_02_850.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_03_02_850: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_03_03_Слой_86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_03_03_Слой_86.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_03_03_Слой_86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_03_04_40")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_03_04_40.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_03_04_40: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_05_00_Слой_83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_05_00_Слой_83.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_05_00_Слой_83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_05_02_180")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_05_02_180.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_05_02_180: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_05_03_Слой_88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_05_03_Слой_88.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_05_03_Слой_88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_05_04_Слой_85")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_05_04_Слой_85.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_05_04_Слой_85: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_05_05_Слой_86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_05_05_Слой_86.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_05_05_Слой_86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_05_06_10")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_05_06_10.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_05_06_10: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_06_00_Слой_83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_06_00_Слой_83.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_06_00_Слой_83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_06_01_Слой_87")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_06_01_Слой_87.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_06_01_Слой_87: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_06_02_110")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_06_02_110.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_06_02_110: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_06_03_Слой_86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_06_03_Слой_86.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_06_03_Слой_86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_06_04_7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_06_04_7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_06_04_7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_07_00_Слой_83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_07_00_Слой_83.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_07_00_Слой_83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_07_01_Слой_84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_07_01_Слой_84.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_07_01_Слой_84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_07_02_50")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_07_02_50.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_07_02_50: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_07_03_Слой_85")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_07_03_Слой_85.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_07_03_Слой_85: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_07_04_Слой_86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_07_04_Слой_86.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_07_04_Слой_86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("16_03_07_05_3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/16_03_07_05_3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 16_03_07_05_3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_00_Прямоугольник_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_00_Прямоугольник_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_00_Прямоугольник_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_01_Слой_80")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_01_Слой_80.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_01_Слой_80: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_02_Прямоугольник_8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_02_Прямоугольник_8.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_02_Прямоугольник_8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_03_Слой_121")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_03_Слой_121.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_03_Слой_121: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_05_Сменить_Позывной")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_05_Сменить_Позывной.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_05_Сменить_Позывной: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_06_Ты_должен_понять_каким_будет_твой_позывной")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_06_Ты_должен_понять_каким_будет_твой_позывной.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_06_Ты_должен_понять_каким_будет_твой_позывной: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_07_00_Слой_81_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_07_00_Слой_81_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_07_00_Слой_81_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_07_01_актив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_07_01_актив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_07_01_актив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_07_02_неактив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_07_02_неактив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_07_02_неактив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_08_00_Слой_81_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_08_00_Слой_81_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_08_00_Слой_81_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_08_01_актив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_08_01_актив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_08_01_актив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_08_02_неактив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_08_02_неактив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_08_02_неактив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_08_03_подтвердить_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_08_03_подтвердить_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_08_03_подтвердить_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("17_08_04_подтвердить_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/17_08_04_подтвердить_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 17_08_04_подтвердить_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_00_Прямоугольник_6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_00_Прямоугольник_6.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_00_Прямоугольник_6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_01_Слой_80")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_01_Слой_80.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_01_Слой_80: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_02_Настройка_Звука")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_02_Настройка_Звука.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_02_Настройка_Звука: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_03_01_шкала")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_03_01_шкала.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_03_01_шкала: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_03_02_заполнение")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_03_02_заполнение.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_03_02_заполнение: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_03_03_линии")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_03_03_линии.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_03_03_линии: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_03_04_бегунок")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_03_04_бегунок.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_03_04_бегунок: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_03_музыка_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_03_музыка_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_03_музыка_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_04_01_шкала")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_04_01_шкала.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_04_01_шкала: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_04_02_заполнение")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_04_02_заполнение.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_04_02_заполнение: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_04_03_линии")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_04_03_линии.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_04_03_линии: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_04_04_бегунок")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_04_04_бегунок.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_04_04_бегунок: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_04_звук_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_04_звук_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_04_звук_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_05_00_Слой_81_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_05_00_Слой_81_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_05_00_Слой_81_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_05_01_актив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_05_01_актив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_05_01_актив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_05_02_неактив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_05_02_неактив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_05_02_неактив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_05_кнопка_2_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_05_кнопка_2_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_05_кнопка_2_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_06_00_Слой_81_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_06_00_Слой_81_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_06_00_Слой_81_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_06_01_актив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_06_01_актив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_06_01_актив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_06_02_неактив_кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_06_02_неактив_кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_06_02_неактив_кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_06_03_подтвердить_копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_06_03_подтвердить_копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_06_03_подтвердить_копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_06_04_подтвердить_копия_2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_06_04_подтвердить_копия_2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_06_04_подтвердить_копия_2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_06_кнопка_1_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_06_кнопка_1_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_06_кнопка_1_GROUP: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("18_попап_звук_GROUP")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/худ3_0__3/18_попап_звук_GROUP.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 18_попап_звук_GROUP: "+e); }
  } else { skipped++; }

  // == ящик (3) (340 ??????) ==
  try { lib.addNewItem("folder", "ящик (3)"); } catch(e) {}
  if (!lib.itemExists("Фон")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фон: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фон_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фон_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("валюта")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: валюта: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("имя,уровень")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/имя,уровень.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: имя,уровень: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("левая часть")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: левая часть: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("магаз")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/магаз.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: магаз: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("настройки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/настройки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: настройки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("нижняя панель")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: нижняя панель: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("перс")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/перс.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: перс: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("правая сторона кнопки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: правая сторона кнопки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("рюкзак")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: рюкзак: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("худ верхний")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/худ%20верхний.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: худ верхний: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("энка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/энка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: энка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("монеты")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/монеты.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: монеты: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("сиги")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/сиги.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: сиги: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("тушняк")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/тушняк.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: тушняк: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("201,487")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/монеты/201,487.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 201,487: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник, скругл. углы 1 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/монеты/Прямоугольник,%20скругл.%20углы%201%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник, скругл. углы 1 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 18 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/монеты/Слой%2018%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 18 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("монеты")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/монеты/монеты.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: монеты: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник, скругл. углы 1 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/сиги/Прямоугольник,%20скругл.%20углы%201%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник, скругл. углы 1 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Сиги")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/сиги/Сиги.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Сиги: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 18 копия 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/сиги/Слой%2018%20копия%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 18 копия 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во Сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/сиги/кол-во%20Сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во Сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("201,487")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/тушняк/201,487.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 201,487: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник, скругл. углы 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/тушняк/Прямоугольник,%20скругл.%20углы%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник, скругл. углы 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 18 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/тушняк/Слой%2018%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 18 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 19")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/валюта/тушняк/Слой%2019.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 19: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Имя")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/имя,уровень/Имя.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Имя: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/имя,уровень/линия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("уровень")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/имя,уровень/уровень.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: уровень: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("фото перса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/имя,уровень/фото%20перса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: фото перса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("шкала уровеня")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/имя,уровень/шкала%20уровеня.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: шкала уровеня: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 15")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/имя,уровень/фото%20перса/Слой%2015.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 15: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Эллипс 1 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/имя,уровень/фото%20перса/Эллипс%201%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Эллипс 1 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Компас/Прямоугольник%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Компас/Группа%203/Слой%200.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Компас/Группа%203/Слой%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Компас/Группа%203/Слой%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Компас/Группа%203/Слой%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Компас/Группа%203/Слой%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бот копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/бот%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бот копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бот")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/бот.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бот: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("скряга")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/скряга.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: скряга: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Бот")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/бот/Бот.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Бот: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 64")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/бот/Слой%2064.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 64: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 66")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/бот/Слой%2066.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 66: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Пропуск")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/бот%20копия/Пропуск.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Пропуск: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 64")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/бот%20копия/Слой%2064.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 64: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 66")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/бот%20копия/Слой%2066.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 66: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 67 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/бот%20копия/Слой%2067%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 67 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 67")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/бот%20копия/Слой%2067.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 67: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Скряга")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/скряга/Скряга.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Скряга: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 64")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/скряга/Слой%2064.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 64: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 65")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/скряга/Слой%2065.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 65: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 5 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/старая%20версия/Прямоугольник%205%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 5 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 5 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/старая%20версия/Прямоугольник%205%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 5 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/старая%20версия/Прямоугольник%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 47")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/старая%20версия/Слой%2047.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 47: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 48")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/старая%20версия/Слой%2048.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 48: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 49")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/старая%20версия/Слой%2049.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 49: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/левая%20часть/старая%20версия/линия%20копия%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник, скругл. углы 1 копия 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/магаз/Прямоугольник,%20скругл.%20углы%201%20копия%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник, скругл. углы 1 копия 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 18 копия 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/магаз/Слой%2018%20копия%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 18 копия 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 29")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/магаз/Слой%2029.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 29: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/награда(недоработано)/Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 71 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/награда(недоработано)/Слой%2071%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 71 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 71 копия 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/награда(недоработано)/Слой%2071%20копия%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 71 копия 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 71 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/награда(недоработано)/Слой%2071%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 71 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 71")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/награда(недоработано)/Слой%2071.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 71: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 72")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/награда(недоработано)/Слой%2072.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 72: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 73")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/награда(недоработано)/Слой%2073.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 73: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник, скругл. углы 1 копия 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/настройки/Прямоугольник,%20скругл.%20углы%201%20копия%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник, скругл. углы 1 копия 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 18 копия 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/настройки/Слой%2018%20копия%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 18 копия 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 28")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/настройки/Слой%2028.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 28: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Банда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Банда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Банда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Боссы")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Боссы.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Боссы: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Сидорович")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Сидорович.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Сидорович: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кнопка Назад")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/кнопка%20Назад.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кнопка Назад: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("нижний худ")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/нижний%20худ.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: нижний худ: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("оружейка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/оружейка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: оружейка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("шмотки копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: шмотки копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("шмотки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: шмотки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Банда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Банда/Банда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Банда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 35 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Банда/Слой%2035%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 35 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 38")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Банда/Слой%2038.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 38: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 2 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Банда/Фигура%202%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 2 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Банда/линия%20копия%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Банда/линия%20копия%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 35 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Боссы/Слой%2035%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 35 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 37")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Боссы/Слой%2037.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 37: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 2 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Боссы/Фигура%202%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 2 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("боссы")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Боссы/боссы.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: боссы: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Боссы/линия%20копия%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Боссы/линия%20копия%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 33")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/кнопка%20Назад/Слой%2033.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 33: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 32")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/нижний%20худ/Слой%2032.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 32: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 41")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/нижний%20худ/Слой%2041.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 41: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 42")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/нижний%20худ/Слой%2042.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 42: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 43")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/нижний%20худ/Слой%2043.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 43: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Оружейка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/оружейка/Оружейка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Оружейка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 35 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/оружейка/Слой%2035%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 35 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 39")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/оружейка/Слой%2039.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 39: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 2 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/оружейка/Фигура%202%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 2 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/оружейка/линия%20копия%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/оружейка/линия%20копия%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Сидорович")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Сидорович/Сидорович.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Сидорович: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 34")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Сидорович/Слой%2034.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 34: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 35")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Сидорович/Слой%2035.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 35: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 68")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Сидорович/Слой%2068.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 68: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Сидорович/Фигура%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Сидорович/линия%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/Сидорович/линия%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 35 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки/Слой%2035%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 35 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 39")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки/Слой%2039.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 39: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 40")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки/Слой%2040.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 40: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 2 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки/Фигура%202%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 2 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Шмотки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки/Шмотки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Шмотки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки/линия%20копия%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки/линия%20копия%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Зона")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки%20копия/Зона.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Зона: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 35 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки%20копия/Слой%2035%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 35 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 45")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки%20копия/Слой%2045.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 45: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 46")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки%20копия/Слой%2046.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 46: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 2 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки%20копия/Фигура%202%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 2 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/нижняя%20панель/шмотки%20копия/линия%20копия%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/перс/Слой%200.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/перс/Слой%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/перс/Слой%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/перс/Слой%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/перс/Слой%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 6 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/перс/Слой%206%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 6 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/перс/Слой%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 69")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/перс/Слой%2069.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 69: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("ПОдтвердить действие_")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/ПОдтвердить%20действие_.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: ПОдтвердить действие_: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/Прямоугольник%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 80")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/Слой%2080.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 80: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("это действие будет невозможно отменить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/это%20действие%20будет%20невозможно%20отменить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: это действие будет невозможно отменить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 81 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/кнопка%201/Слой%2081%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 81 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("актив кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/кнопка%201/актив%20кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: актив кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("неактив кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/кнопка%201/неактив%20кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: неактив кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("подтвердить копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/кнопка%201/подтвердить%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: подтвердить копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("подтвердить копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/кнопка%201/подтвердить%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: подтвердить копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 81 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/кнопка%202/Слой%2081%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 81 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("актив кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/кнопка%202/актив%20кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: актив кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("неактив кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/кнопка%202/неактив%20кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: неактив кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("отмена")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/кнопка%202/отмена.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: отмена: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("отмена_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Подтвердить_/кнопка%202/отмена_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: отмена_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("База")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/База.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: База: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Сводка копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Сводка%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Сводка копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Сводка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Сводка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Сводка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Хабар")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Хабар.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Хабар: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("двор")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/двор.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: двор: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("топы")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/топы.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: топы: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("База")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/База/База.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: База: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 53")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/База/Слой%2053.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 53: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 59")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/База/Слой%2059.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 59: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Двор")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/двор/Двор.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Двор: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 53")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/двор/Слой%2053.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 53: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 56")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/двор/Слой%2056.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 56: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 57")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/двор/Слой%2057.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 57: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 58")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/двор/Слой%2058.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 58: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 53")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Сводка/Слой%2053.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 53: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 61")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Сводка/Слой%2061.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 61: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 63")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Сводка/Слой%2063.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 63: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("сводка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Сводка/сводка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: сводка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Ежедневные задания")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Сводка%20копия/Ежедневные%20задания.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Ежедневные задания: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 53")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Сводка%20копия/Слой%2053.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 53: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 70")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Сводка%20копия/Слой%2070.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 70: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 53")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/топы/Слой%2053.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 53: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 62")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/топы/Слой%2062.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 62: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Топы")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/топы/Топы.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Топы: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 53")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Хабар/Слой%2053.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 53: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 59")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Хабар/Слой%2059.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 59: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 60")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Хабар/Слой%2060.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 60: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Хабар")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/правая%20сторона%20кнопки/Хабар/Хабар.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Хабар: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/Прямоугольник%207.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 120")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/Слой%20120.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 120: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кнопки назад_забрать")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/кнопки%20назад_забрать.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кнопки назад_забрать: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("прогресс")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/прогресс.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: прогресс: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("тату")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/тату.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: тату: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("фон_")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/фон_.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: фон_: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("цена")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/цена.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: цена: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("забрать копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/кнопки%20назад_забрать/забрать%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: забрать копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("назад копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/кнопки%20назад_забрать/назад%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: назад копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("автомат")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/автомат.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: автомат: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("макар")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/макар.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: макар: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("нож")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/нож.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: нож: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("опыт")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/опыт.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: опыт: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("рублики")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/рублики.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: рублики: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("сиги")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/сиги.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: сиги: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("автомат")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/автомат/автомат.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: автомат: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бейдж")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/автомат/бейдж.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бейдж: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во автомата")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/автомат/кол-во%20автомата.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во автомата: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бейдж")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/макар/бейдж.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бейдж: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во стволов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/макар/кол-во%20стволов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во стволов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("ствол")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/макар/ствол.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: ствол: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бейдж")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/нож/бейдж.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бейдж: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во ножей")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/нож/кол-во%20ножей.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во ножей: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("нож")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/нож/нож.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: нож: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бейдж")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/опыт/бейдж.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бейдж: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("иконка опыта")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/опыт/иконка%20опыта.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: иконка опыта: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во опыта")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/опыт/кол-во%20опыта.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во опыта: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бейдж")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/рублики/бейдж.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бейдж: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("иконка рублей")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/рублики/иконка%20рублей.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: иконка рублей: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во рубликов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/рублики/кол-во%20рубликов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во рубликов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 121 копия 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/сиги/Слой%20121%20копия%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 121 копия 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во награды сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/сиги/кол-во%20награды%20сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во награды сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("сиги")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/награда/сиги/сиги.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: сиги: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Уровень рюкзака _ 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/прогресс/Уровень%20рюкзака%20_%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Уровень рюкзака _ 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("квадратик прогресса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/прогресс/квадратик%20прогресса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: квадратик прогресса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("квадратик прогресса_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/прогресс/квадратик%20прогресса_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: квадратик прогресса_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линии")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/прогресс/линии.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линии: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("прогресс бар")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/прогресс/прогресс%20бар.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: прогресс бар: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("тень")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/прогресс/тень.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: тень: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("выпала")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/тату/выпала.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: выпала: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 113 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/тату/в%20след%20раз/Слой%20113%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 113 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 118")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/тату/в%20след%20раз/Слой%20118.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 118: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("в следуцющий раз")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/тату/в%20след%20раз/в%20следуцющий%20раз.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: в следуцющий раз: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 118 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/тату/выпала/Слой%20118%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 118 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 119")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/тату/выпала/Слой%20119.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 119: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Цветовой тон_Насыщенность 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/фон_/Цветовой%20тон_Насыщенность%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Цветовой тон_Насыщенность 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("рамка рюкзака")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/фон_/рамка%20рюкзака.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: рамка рюкзака: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("тряпка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/фон_/тряпка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: тряпка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("фон")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/рюкзак/фон_/фон.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: фон: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("стол")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/стол.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: стол: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("тень")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/тень.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: тень: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("фон")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/фон.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: фон: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кейс")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/кейс/кейс.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кейс: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("обыскать")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/кейс/обыскать.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: обыскать: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("табличка стоимости")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/кейс/табличка%20стоимости.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: табличка стоимости: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("50")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/количество%20патрон/50.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 50: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Количество_")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/количество%20патрон/Количество_.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Количество_: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 105")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/количество%20патрон/Слой%20105.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 105: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("брелок")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/полоса/брелок.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: брелок: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("заполнение")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/полоса/заполнение.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: заполнение: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("обод полосы")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/полоса/обод%20полосы.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: обод полосы: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("полоса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/полоса/полоса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: полоса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("0_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/0_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 0_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("дробь")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/дробь.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: дробь: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 109")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/Слой%20109.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 109: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кейс")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/кейс/кейс.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кейс: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("фон")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/кейс/фон.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: фон: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("50к")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/кейс/награда%20в%20кейсе/50к.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 50к: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("количество нычек")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/кейс/награда%20в%20кейсе/количество%20нычек.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: количество нычек: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("количество сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/кейс/награда%20в%20кейсе/количество%20сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: количество сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("нычки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/кейс/награда%20в%20кейсе/нычки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: нычки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("рублит")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/кейс/награда%20в%20кейсе/рублит.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: рублит: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("сиги")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/кейс/награда%20в%20кейсе/сиги.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: сиги: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("забрать")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/кнопки/забрать.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: забрать: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("назад")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/кнопки/назад.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: назад: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("табличка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/табличка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: табличка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("100к")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/если%20не%20падает%20шмот/100к.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 100к: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Держи опыта _")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/если%20не%20падает%20шмот/Держи%20опыта%20_.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Держи опыта _: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("в следующий раз")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/если%20не%20падает%20шмот/в%20следующий%20раз.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: в следующий раз: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("опыт")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/если%20не%20падает%20шмот/опыт.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: опыт: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("увы брат")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/если%20не%20падает%20шмот/увы%20брат.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: увы брат: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 111")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/когда%20выпала%20шмотка/Слой%20111.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 111: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("название вещи")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/когда%20выпала%20шмотка/название%20вещи.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: название вещи: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/Слой%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("стенка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/стенка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: стенка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/стенка/Прямоугольник%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/стенка/Прямоугольник%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 10")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/стенка/Слой%2010.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 10: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 11")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/стенка/Слой%2011.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 11: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 157 копия 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/стенка/Слой%20157%20копия%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 157 копия 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 157 копия 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/стенка/Слой%20157%20копия%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 157 копия 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 157 копия 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/стенка/Слой%20157%20копия%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 157 копия 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/стенка/Слой%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/стенка/Слой%207.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/стенка/Слой%208.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 9")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/стенка/Слой%209.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 9: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Цветовой тон_Насыщенность 1 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Фон/стенка/Цветовой%20тон_Насыщенность%201%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Цветовой тон_Насыщенность 1 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 18")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/худ%20верхний/Слой%2018.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 18: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 22")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/худ%20верхний/Слой%2022.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 22: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 24")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/худ%20верхний/Слой%2024.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 24: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 25")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/худ%20верхний/Слой%2025.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 25: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 26")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/худ%20верхний/Слой%2026.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 26: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 27")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/худ%20верхний/Слой%2027.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 27: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 31")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/худ%20верхний/Слой%2031.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 31: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Клан")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/эмблемы%20кланов/Клан.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Клан: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/эмблемы%20кланов/Фигура%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 1 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/Прямоугольник%201%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 1 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 82")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/Слой%2082.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 82: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+50")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%201/+50.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +50: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%201/3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%201/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%201/Слой%2084.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 85")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%201/Слой%2085.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 85: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%201/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+110")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%202/+110.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +110: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%202/7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%202/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%202/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 87")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%202/Слой%2087.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 87: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+180")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%203/+180.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +180: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("10")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%203/10.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 10: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%203/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%203/Слой%2084.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 85")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%203/Слой%2085.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 85: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%203/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%203/Слой%2088.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+400")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%204/+400.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +400: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("20")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%204/20.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 20: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%204/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%204/Слой%2084.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%204/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%204/Слой%2089.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+850")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%205/+850.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +850: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("40")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%205/40.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 40: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%205/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%205/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%205/Слой%2090.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+1300")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%206/+1300.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +1300: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("60")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%206/60.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 60: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%206/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%206/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%206/Слой%2091.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+2000")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%207/+2000.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +2000: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("85")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%207/85.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 85: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%207/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%207/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%207/Слой%2092.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+3500")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%208/+3500.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +3500: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("120")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%208/120.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 120: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%208/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%208/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 93")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/Энергия/кнопки/кнопка%208/Слой%2093.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 93: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кнопка покупки энки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/энка/кнопка%20покупки%20энки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кнопка покупки энки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во энки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/энка/кол-во%20энки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во энки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("шкала")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/энка/шкала.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: шкала: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/энка/кнопка%20покупки%20энки/+.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник, скругл. углы 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(3)/энка/кнопка%20покупки%20энки/Прямоугольник,%20скругл.%20углы%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник, скругл. углы 2: "+e); }
  } else { skipped++; }

  // == ящик (4) (340 ??????) ==
  try { lib.addNewItem("folder", "ящик (4)"); } catch(e) {}
  if (!lib.itemExists("Фон")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фон: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фон_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фон_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("валюта")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: валюта: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("имя,уровень")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/имя,уровень.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: имя,уровень: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("левая часть")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: левая часть: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("магаз")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/магаз.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: магаз: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("настройки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/настройки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: настройки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("нижняя панель")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: нижняя панель: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("перс")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/перс.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: перс: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("правая сторона кнопки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: правая сторона кнопки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("рюкзак")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: рюкзак: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("худ верхний")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/худ%20верхний.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: худ верхний: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("энка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/энка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: энка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("монеты")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/монеты.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: монеты: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("сиги")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/сиги.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: сиги: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("тушняк")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/тушняк.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: тушняк: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("201,487")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/монеты/201,487.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 201,487: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник, скругл. углы 1 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/монеты/Прямоугольник,%20скругл.%20углы%201%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник, скругл. углы 1 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 18 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/монеты/Слой%2018%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 18 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("монеты")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/монеты/монеты.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: монеты: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник, скругл. углы 1 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/сиги/Прямоугольник,%20скругл.%20углы%201%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник, скругл. углы 1 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Сиги")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/сиги/Сиги.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Сиги: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 18 копия 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/сиги/Слой%2018%20копия%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 18 копия 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во Сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/сиги/кол-во%20Сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во Сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("201,487")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/тушняк/201,487.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 201,487: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник, скругл. углы 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/тушняк/Прямоугольник,%20скругл.%20углы%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник, скругл. углы 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 18 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/тушняк/Слой%2018%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 18 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 19")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/валюта/тушняк/Слой%2019.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 19: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Имя")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/имя,уровень/Имя.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Имя: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/имя,уровень/линия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("уровень")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/имя,уровень/уровень.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: уровень: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("фото перса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/имя,уровень/фото%20перса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: фото перса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("шкала уровеня")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/имя,уровень/шкала%20уровеня.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: шкала уровеня: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 15")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/имя,уровень/фото%20перса/Слой%2015.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 15: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Эллипс 1 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/имя,уровень/фото%20перса/Эллипс%201%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Эллипс 1 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Компас/Прямоугольник%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Компас/Группа%203/Слой%200.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Компас/Группа%203/Слой%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Компас/Группа%203/Слой%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Компас/Группа%203/Слой%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Компас/Группа%203/Слой%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бот копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/бот%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бот копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бот")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/бот.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бот: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("скряга")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/скряга.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: скряга: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Бот")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/бот/Бот.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Бот: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 64")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/бот/Слой%2064.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 64: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 66")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/бот/Слой%2066.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 66: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Пропуск")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/бот%20копия/Пропуск.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Пропуск: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 64")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/бот%20копия/Слой%2064.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 64: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 66")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/бот%20копия/Слой%2066.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 66: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 67 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/бот%20копия/Слой%2067%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 67 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 67")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/бот%20копия/Слой%2067.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 67: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Скряга")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/скряга/Скряга.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Скряга: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 64")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/скряга/Слой%2064.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 64: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 65")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/скряга/Слой%2065.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 65: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 5 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/старая%20версия/Прямоугольник%205%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 5 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 5 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/старая%20версия/Прямоугольник%205%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 5 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/старая%20версия/Прямоугольник%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 47")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/старая%20версия/Слой%2047.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 47: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 48")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/старая%20версия/Слой%2048.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 48: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 49")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/старая%20версия/Слой%2049.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 49: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/левая%20часть/старая%20версия/линия%20копия%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник, скругл. углы 1 копия 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/магаз/Прямоугольник,%20скругл.%20углы%201%20копия%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник, скругл. углы 1 копия 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 18 копия 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/магаз/Слой%2018%20копия%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 18 копия 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 29")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/магаз/Слой%2029.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 29: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/награда(недоработано)/Награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 71 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/награда(недоработано)/Слой%2071%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 71 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 71 копия 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/награда(недоработано)/Слой%2071%20копия%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 71 копия 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 71 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/награда(недоработано)/Слой%2071%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 71 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 71")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/награда(недоработано)/Слой%2071.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 71: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 72")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/награда(недоработано)/Слой%2072.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 72: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 73")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/награда(недоработано)/Слой%2073.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 73: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник, скругл. углы 1 копия 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/настройки/Прямоугольник,%20скругл.%20углы%201%20копия%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник, скругл. углы 1 копия 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 18 копия 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/настройки/Слой%2018%20копия%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 18 копия 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 28")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/настройки/Слой%2028.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 28: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Банда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Банда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Банда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Боссы")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Боссы.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Боссы: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Сидорович")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Сидорович.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Сидорович: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кнопка Назад")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/кнопка%20Назад.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кнопка Назад: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("нижний худ")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/нижний%20худ.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: нижний худ: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("оружейка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/оружейка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: оружейка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("шмотки копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: шмотки копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("шмотки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: шмотки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Банда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Банда/Банда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Банда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 35 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Банда/Слой%2035%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 35 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 38")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Банда/Слой%2038.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 38: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 2 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Банда/Фигура%202%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 2 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Банда/линия%20копия%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Банда/линия%20копия%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 35 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Боссы/Слой%2035%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 35 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 37")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Боссы/Слой%2037.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 37: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 2 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Боссы/Фигура%202%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 2 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("боссы")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Боссы/боссы.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: боссы: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Боссы/линия%20копия%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Боссы/линия%20копия%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 33")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/кнопка%20Назад/Слой%2033.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 33: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 32")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/нижний%20худ/Слой%2032.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 32: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 41")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/нижний%20худ/Слой%2041.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 41: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 42")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/нижний%20худ/Слой%2042.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 42: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 43")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/нижний%20худ/Слой%2043.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 43: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Оружейка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/оружейка/Оружейка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Оружейка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 35 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/оружейка/Слой%2035%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 35 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 39")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/оружейка/Слой%2039.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 39: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 2 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/оружейка/Фигура%202%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 2 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/оружейка/линия%20копия%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/оружейка/линия%20копия%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Сидорович")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Сидорович/Сидорович.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Сидорович: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 34")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Сидорович/Слой%2034.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 34: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 35")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Сидорович/Слой%2035.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 35: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 68")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Сидорович/Слой%2068.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 68: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Сидорович/Фигура%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Сидорович/линия%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/Сидорович/линия%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 35 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки/Слой%2035%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 35 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 39")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки/Слой%2039.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 39: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 40")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки/Слой%2040.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 40: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 2 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки/Фигура%202%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 2 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Шмотки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки/Шмотки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Шмотки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки/линия%20копия%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки/линия%20копия%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Зона")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки%20копия/Зона.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Зона: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 35 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки%20копия/Слой%2035%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 35 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 45")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки%20копия/Слой%2045.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 45: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 46")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки%20копия/Слой%2046.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 46: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 2 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки%20копия/Фигура%202%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 2 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линия копия 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/нижняя%20панель/шмотки%20копия/линия%20копия%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линия копия 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/перс/Слой%200.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/перс/Слой%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/перс/Слой%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/перс/Слой%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/перс/Слой%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 6 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/перс/Слой%206%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 6 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/перс/Слой%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 69")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/перс/Слой%2069.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 69: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("ПОдтвердить действие_")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/ПОдтвердить%20действие_.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: ПОдтвердить действие_: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/Прямоугольник%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 80")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/Слой%2080.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 80: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("это действие будет невозможно отменить")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/это%20действие%20будет%20невозможно%20отменить.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: это действие будет невозможно отменить: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 81 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/кнопка%201/Слой%2081%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 81 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("актив кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/кнопка%201/актив%20кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: актив кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("неактив кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/кнопка%201/неактив%20кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: неактив кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("подтвердить копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/кнопка%201/подтвердить%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: подтвердить копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("подтвердить копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/кнопка%201/подтвердить%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: подтвердить копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 81 копия 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/кнопка%202/Слой%2081%20копия%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 81 копия 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("актив кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/кнопка%202/актив%20кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: актив кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("неактив кнопка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/кнопка%202/неактив%20кнопка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: неактив кнопка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("отмена")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/кнопка%202/отмена.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: отмена: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("отмена_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Подтвердить_/кнопка%202/отмена_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: отмена_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("База")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/База.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: База: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Сводка копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Сводка%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Сводка копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Сводка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Сводка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Сводка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Хабар")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Хабар.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Хабар: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("двор")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/двор.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: двор: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("топы")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/топы.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: топы: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("База")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/База/База.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: База: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 53")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/База/Слой%2053.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 53: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 59")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/База/Слой%2059.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 59: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Двор")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/двор/Двор.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Двор: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 53")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/двор/Слой%2053.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 53: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 56")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/двор/Слой%2056.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 56: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 57")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/двор/Слой%2057.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 57: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 58")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/двор/Слой%2058.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 58: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 53")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Сводка/Слой%2053.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 53: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 61")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Сводка/Слой%2061.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 61: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 63")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Сводка/Слой%2063.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 63: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("сводка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Сводка/сводка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: сводка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Ежедневные задания")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Сводка%20копия/Ежедневные%20задания.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Ежедневные задания: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 53")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Сводка%20копия/Слой%2053.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 53: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 70")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Сводка%20копия/Слой%2070.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 70: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 53")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/топы/Слой%2053.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 53: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 62")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/топы/Слой%2062.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 62: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Топы")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/топы/Топы.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Топы: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 53")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Хабар/Слой%2053.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 53: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 59")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Хабар/Слой%2059.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 59: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 60")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Хабар/Слой%2060.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 60: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Хабар")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/правая%20сторона%20кнопки/Хабар/Хабар.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Хабар: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/Прямоугольник%207.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 120")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/Слой%20120.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 120: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кнопки назад_забрать")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/кнопки%20назад_забрать.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кнопки назад_забрать: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("награда")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: награда: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("прогресс")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/прогресс.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: прогресс: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("тату")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/тату.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: тату: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("фон_")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/фон_.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: фон_: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("цена")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/цена.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: цена: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("забрать копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/кнопки%20назад_забрать/забрать%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: забрать копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("назад копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/кнопки%20назад_забрать/назад%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: назад копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("автомат")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/автомат.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: автомат: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("макар")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/макар.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: макар: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("нож")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/нож.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: нож: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("опыт")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/опыт.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: опыт: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("рублики")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/рублики.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: рублики: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("сиги")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/сиги.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: сиги: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("автомат")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/автомат/автомат.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: автомат: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бейдж")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/автомат/бейдж.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бейдж: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во автомата")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/автомат/кол-во%20автомата.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во автомата: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бейдж")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/макар/бейдж.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бейдж: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во стволов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/макар/кол-во%20стволов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во стволов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("ствол")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/макар/ствол.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: ствол: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бейдж")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/нож/бейдж.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бейдж: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во ножей")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/нож/кол-во%20ножей.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во ножей: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("нож")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/нож/нож.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: нож: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бейдж")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/опыт/бейдж.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бейдж: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("иконка опыта")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/опыт/иконка%20опыта.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: иконка опыта: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во опыта")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/опыт/кол-во%20опыта.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во опыта: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("бейдж")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/рублики/бейдж.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: бейдж: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("иконка рублей")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/рублики/иконка%20рублей.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: иконка рублей: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во рубликов")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/рублики/кол-во%20рубликов.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во рубликов: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 121 копия 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/сиги/Слой%20121%20копия%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 121 копия 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во награды сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/сиги/кол-во%20награды%20сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во награды сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("сиги")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/награда/сиги/сиги.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: сиги: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Уровень рюкзака _ 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/прогресс/Уровень%20рюкзака%20_%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Уровень рюкзака _ 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("квадратик прогресса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/прогресс/квадратик%20прогресса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: квадратик прогресса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("квадратик прогресса_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/прогресс/квадратик%20прогресса_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: квадратик прогресса_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("линии")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/прогресс/линии.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: линии: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("прогресс бар")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/прогресс/прогресс%20бар.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: прогресс бар: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("тень")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/прогресс/тень.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: тень: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("выпала")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/тату/выпала.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: выпала: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 113 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/тату/в%20след%20раз/Слой%20113%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 113 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 118")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/тату/в%20след%20раз/Слой%20118.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 118: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("в следуцющий раз")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/тату/в%20след%20раз/в%20следуцющий%20раз.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: в следуцющий раз: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 118 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/тату/выпала/Слой%20118%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 118 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 119")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/тату/выпала/Слой%20119.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 119: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Цветовой тон_Насыщенность 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/фон_/Цветовой%20тон_Насыщенность%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Цветовой тон_Насыщенность 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("рамка рюкзака")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/фон_/рамка%20рюкзака.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: рамка рюкзака: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("тряпка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/фон_/тряпка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: тряпка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("фон")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/рюкзак/фон_/фон.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: фон: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("стол")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/стол.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: стол: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("тень")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/тень.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: тень: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("фон")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/фон.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: фон: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кейс")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/кейс/кейс.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кейс: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("обыскать")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/кейс/обыскать.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: обыскать: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("табличка стоимости")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/кейс/табличка%20стоимости.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: табличка стоимости: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("50")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/количество%20патрон/50.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 50: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Количество_")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/количество%20патрон/Количество_.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Количество_: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 105")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/количество%20патрон/Слой%20105.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 105: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("брелок")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/полоса/брелок.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: брелок: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("заполнение")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/полоса/заполнение.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: заполнение: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("обод полосы")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/полоса/обод%20полосы.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: обод полосы: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("полоса")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/полоса/полоса.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: полоса: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("0")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/0.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 0: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("0_1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/0_1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 0_1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/1.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/2.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 2: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/4.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/5.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("дробь")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/Закрытый%20кейс/полоса/цифры/дробь.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: дробь: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 109")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/Слой%20109.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 109: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кейс")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/кейс/кейс.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кейс: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("фон")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/кейс/фон.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: фон: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("50к")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/кейс/награда%20в%20кейсе/50к.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 50к: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("количество нычек")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/кейс/награда%20в%20кейсе/количество%20нычек.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: количество нычек: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("количество сиг")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/кейс/награда%20в%20кейсе/количество%20сиг.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: количество сиг: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("нычки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/кейс/награда%20в%20кейсе/нычки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: нычки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("рублит")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/кейс/награда%20в%20кейсе/рублит.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: рублит: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("сиги")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/кейс/награда%20в%20кейсе/сиги.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: сиги: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("забрать")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/кнопки/забрать.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: забрать: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("назад")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/кнопки/назад.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: назад: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("табличка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/табличка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: табличка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("100к")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/если%20не%20падает%20шмот/100к.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 100к: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Держи опыта _")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/если%20не%20падает%20шмот/Держи%20опыта%20_.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Держи опыта _: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("в следующий раз")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/если%20не%20падает%20шмот/в%20следующий%20раз.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: в следующий раз: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("опыт")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/если%20не%20падает%20шмот/опыт.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: опыт: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("увы брат")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/если%20не%20падает%20шмот/увы%20брат.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: увы брат: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 111")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/когда%20выпала%20шмотка/Слой%20111.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 111: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("название вещи")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/страница%20с%20кейсом/открытый%20кейс/шмот_опыт%20табличка/когда%20выпала%20шмотка/название%20вещи.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: название вещи: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/Слой%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("стенка")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/стенка.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: стенка: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/стенка/Прямоугольник%203.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/стенка/Прямоугольник%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 10")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/стенка/Слой%2010.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 10: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 11")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/стенка/Слой%2011.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 11: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 157 копия 4")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/стенка/Слой%20157%20копия%204.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 157 копия 4: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 157 копия 5")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/стенка/Слой%20157%20копия%205.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 157 копия 5: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 157 копия 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/стенка/Слой%20157%20копия%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 157 копия 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 6")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/стенка/Слой%206.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 6: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/стенка/Слой%207.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 8")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/стенка/Слой%208.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 8: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 9")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/стенка/Слой%209.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 9: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Цветовой тон_Насыщенность 1 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Фон/стенка/Цветовой%20тон_Насыщенность%201%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Цветовой тон_Насыщенность 1 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 18")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/худ%20верхний/Слой%2018.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 18: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 22")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/худ%20верхний/Слой%2022.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 22: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 24")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/худ%20верхний/Слой%2024.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 24: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 25")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/худ%20верхний/Слой%2025.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 25: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 26")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/худ%20верхний/Слой%2026.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 26: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 27")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/худ%20верхний/Слой%2027.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 27: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 31")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/худ%20верхний/Слой%2031.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 31: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Клан")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/эмблемы%20кланов/Клан.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Клан: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Фигура 1")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/эмблемы%20кланов/Фигура%201.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Фигура 1: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник 1 копия")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/Прямоугольник%201%20копия.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник 1 копия: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 82")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/Слой%2082.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 82: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+50")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%201/+50.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +50: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("3")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%201/3.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 3: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%201/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%201/Слой%2084.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 85")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%201/Слой%2085.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 85: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%201/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+110")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%202/+110.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +110: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("7")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%202/7.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 7: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%202/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%202/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 87")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%202/Слой%2087.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 87: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+180")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%203/+180.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +180: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("10")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%203/10.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 10: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%203/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%203/Слой%2084.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 85")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%203/Слой%2085.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 85: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%203/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 88")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%203/Слой%2088.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 88: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+400")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%204/+400.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +400: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("20")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%204/20.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 20: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%204/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 84")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%204/Слой%2084.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 84: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%204/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 89")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%204/Слой%2089.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 89: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+850")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%205/+850.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +850: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("40")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%205/40.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 40: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%205/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%205/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 90")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%205/Слой%2090.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 90: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+1300")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%206/+1300.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +1300: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("60")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%206/60.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 60: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%206/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%206/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 91")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%206/Слой%2091.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 91: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+2000")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%207/+2000.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +2000: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("85")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%207/85.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 85: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%207/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%207/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 92")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%207/Слой%2092.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 92: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+3500")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%208/+3500.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +3500: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("120")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%208/120.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: 120: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 83")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%208/Слой%2083.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 83: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 86")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%208/Слой%2086.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 86: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Слой 93")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/Энергия/кнопки/кнопка%208/Слой%2093.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Слой 93: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кнопка покупки энки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/энка/кнопка%20покупки%20энки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кнопка покупки энки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("кол-во энки")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/энка/кол-во%20энки.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: кол-во энки: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("шкала")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/энка/шкала.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: шкала: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("+")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/энка/кнопка%20покупки%20энки/+.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: +: "+e); }
  } else { skipped++; }
  if (!lib.itemExists("Прямоугольник, скругл. углы 2")) {
    try { doc.importFile("file:///C:/Users/HONOR/Desktop/vk_game/projects_2026/pripat/img/layers/ящик%20(4)/энка/кнопка%20покупки%20энки/Прямоугольник,%20скругл.%20углы%202.png", true); imported++; }
    catch(e) { errors++; fl.trace("ERR: Прямоугольник, скругл. углы 2: "+e); }
  } else { skipped++; }

  fl.showAlert("??????!\n?????????????: " + imported + "\n??? ????: " + skipped + "\n??????: " + errors);
}