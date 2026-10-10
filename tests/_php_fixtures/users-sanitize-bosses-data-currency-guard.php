<?php
// 09.10.2026 (аудит по прямому указанию — "переживаю что игроки могут читерить"): bosses_data
// был в $allowed whitelist users.save() БЕЗ какой-либо валидации — keys[] (валюта похода на
// босса, начисляется ТОЛЬКО bosses.php/rewardlinks.php через Gameops::saveUser(), в обход этого
// whitelist) и dailyKills/killsTotal/medalKills (лимит попыток/статистика, которую
// bosses.php.startFight() читает НАПРЯМУЮ из этого же поля) можно было подделать ОДНИМ
// users.save({bosses_data: JSON.stringify({keys:[999,...]})}) прямо из консоли браузера —
// бесконечные ключи боссов и обход дневного лимита атак без единой реальной победы/покупки.
require __DIR__ . '/../../server/core/models/gameops.php';
require __DIR__ . '/../../server/core/controllers/users.php';

$users = new Users([]);

function bd($keys, $dailyKills, $killsTotal, $medalKills, $extra = []){
    return array_merge([
        'keys' => $keys, 'dailyKills' => $dailyKills, 'killsTotal' => $killsTotal, 'medalKills' => $medalKills,
    ], $extra);
}

echo "=== Test 1 (КОРЕНЬ дыры): читер пытается выставить себе 999 ключей всех 8 боссов напрямую ===\n";
$current = bd([0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0]);
$cheatKeys = bd([999,999,999,999,999,999,999,999], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0]);
$result = $users->_sanitizeBossesData($current, $cheatKeys);
echo ($result === null ? "PASS" : "FAIL") . ": попытка выставить keys напрямую (0->999 на всех 8 боссах) отклонена целиком, получено " . var_export($result, true) . "\n";

echo "=== Test 2: читер пытается обнулить dailyKills, чтобы обойти дневной лимит атак ===\n";
$currentWithDaily = bd([1,0,0,0,0,0,0,0], [7,3,0,0,0,0,0,0], [10,2,0,0,0,0,0,0], [10,2,0,0,0,0,0,0]);
$cheatDaily = bd([1,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [10,2,0,0,0,0,0,0], [10,2,0,0,0,0,0,0]);
$result2 = $users->_sanitizeBossesData($currentWithDaily, $cheatDaily);
echo ($result2 === null ? "PASS" : "FAIL") . ": попытка обнулить dailyKills (сброс дневного лимита) отклонена целиком, получено " . var_export($result2, true) . "\n";

echo "=== Test 3: читер пытается занизить killsTotal/medalKills (например, чтобы обратимо снять какой-то порог ачивки) ===\n";
$cheatKillsTotal = bd([1,0,0,0,0,0,0,0], [7,3,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [10,2,0,0,0,0,0,0]);
$result3 = $users->_sanitizeBossesData($currentWithDaily, $cheatKillsTotal);
echo ($result3 === null ? "PASS" : "FAIL") . ": попытка занизить killsTotal отклонена целиком, получено " . var_export($result3, true) . "\n";

$cheatMedalKills = bd([1,0,0,0,0,0,0,0], [7,3,0,0,0,0,0,0], [10,2,0,0,0,0,0,0], [0,0,0,0,0,0,0,0]);
$result3b = $users->_sanitizeBossesData($currentWithDaily, $cheatMedalKills);
echo ($result3b === null ? "PASS" : "FAIL") . ": попытка занизить medalKills отклонена целиком, получено " . var_export($result3b, true) . "\n";

echo "=== Test 4 (честный клиент): bosses-combat.js._saveToUdata() всегда эхом шлёт ТЕ ЖЕ значения keys/dailyKills/killsTotal/medalKills, что уже лежат на сервере — принимается ===\n";
$honestEcho = bd([1,0,0,0,0,0,0,0], [7,3,0,0,0,0,0,0], [10,2,0,0,0,0,0,0], [10,2,0,0,0,0,0,0], [
    'freeWpnCdMs' => ['3' => 123456789], 'bossStartMs' => [[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0]],
]);
$result4 = $users->_sanitizeBossesData($currentWithDaily, $honestEcho);
echo ($result4 !== null ? "PASS" : "FAIL") . ": честное эхо (те же keys/dailyKills/killsTotal/medalKills + новые freeWpnCdMs/bossStartMs) принято, получено " . var_export($result4, true) . "\n";

echo "=== Test 5: остальные поля bosses_data (freeWpnCdMs, hpByDiff, bossStartMs и т.п.) НЕ заморожены — свободно меняются без привязки к current ===\n";
$currentMinimal = bd([0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0]);
$freeFieldsChanged = bd([0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [
    'freeWpnCdMs' => ['0' => 999999999999], 'curCycleDmg' => [500,0,0,0,0,0,0,0], 'dailyDate' => '2026-10-09',
]);
$result5 = $users->_sanitizeBossesData($currentMinimal, $freeFieldsChanged);
echo ($result5 !== null && $result5['curCycleDmg'][0] === 500 ? "PASS" : "FAIL") . ": свободные поля (freeWpnCdMs/curCycleDmg/dailyDate) проходят без привязки к current, получено " . var_export($result5, true) . "\n";

echo "=== Test 6: новый аккаунт (current=[], ничего ещё не сохранено) — честный клиент шлёт все нули, принимается ===\n";
$resultFresh = $users->_sanitizeBossesData([], bd([0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0]));
echo ($resultFresh !== null ? "PASS" : "FAIL") . ": свежий аккаунт без current — все нули приняты, получено " . var_export($resultFresh, true) . "\n";

echo "=== Test 7: если клиент вообще не прислал один из 4 защищённых под-массивов (частичный объект), это НЕ блокирует сохранение остальных полей ===\n";
$partial = ['freeWpnCdMs' => ['1' => 42]]; // ни keys, ни dailyKills, ни killsTotal, ни medalKills не присланы
$result7 = $users->_sanitizeBossesData($currentWithDaily, $partial);
echo ($result7 !== null ? "PASS" : "FAIL") . ": частичный объект без защищённых полей не отклоняется, получено " . var_export($result7, true) . "\n";

echo "=== Test 8 (защита типов): несериализуемый мусор вместо массива для keys — отклоняется, не падает с ошибкой PHP ===\n";
$malformed = ['keys' => 'not-an-array', 'dailyKills' => [0,0,0,0,0,0,0,0], 'killsTotal' => [0,0,0,0,0,0,0,0], 'medalKills' => [0,0,0,0,0,0,0,0]];
$result8 = $users->_sanitizeBossesData($currentMinimal, $malformed);
echo ($result8 === null ? "PASS" : "FAIL") . ": keys не массив — отклонено без фатальной ошибки, получено " . var_export($result8, true) . "\n";
