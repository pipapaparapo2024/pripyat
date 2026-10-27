<?php
require __DIR__ . '/../../server/core/models/zanachkimodel.php';

// Fake Gameops — duck-typing только i()/j()/add() (то, что реально использует ZanachkiModel),
// тот же приём, что FakeOps в tests/_php_fixtures/raznaryadka-core.php.
class FakeOps {
    function i($user, $key, $default = 0){ return intval(isset($user[$key]) ? $user[$key] : $default); }
    function j($user, $key, $default = []){
        if(!isset($user[$key]) || $user[$key] === '' || $user[$key] === null) return $default;
        if(is_array($user[$key])) return $user[$key];
        $d = json_decode($user[$key], true);
        return is_array($d) ? $d : $default;
    }
    function add(&$user, $currency, $amount){ $amount = intval($amount); if($amount === 0) return; $user[$currency] = $this->i($user, $currency) + $amount; }
}

$ops = new FakeOps();

echo "=== Test 1: grantRandomCards() — распределение и диапазоны ===\n";
$user = [];
$granted = ZanachkiModel::grantRandomCards($ops, $user, 1000);
echo (count($granted) === 1000 ? "PASS" : "FAIL") . ": вернуло ровно 1000 записей выдачи, получено " . count($granted) . "\n";
$sum = 0;
$allValid = true;
$stashData = ZanachkiModel::getStashData($ops, $user);
foreach($stashData as $col => $positions){
    foreach($positions as $pos => $count){
        $sum += intval($count);
        if(intval($col) < 1 || intval($col) > 15 || intval($pos) < 1 || intval($pos) > 7) $allValid = false;
    }
}
echo ($sum === 1000 ? "PASS" : "FAIL") . ": суммарное количество карточек в stash_data === 1000, получено $sum\n";
echo ($allValid ? "PASS" : "FAIL") . ": все ключи коллекция/позиция в валидном диапазоне 1-15/1-7\n";
foreach($granted as $g){
    if($g['col'] < 1 || $g['col'] > 15 || $g['pos'] < 1 || $g['pos'] > 7){ $allValid = false; break; }
}
echo ($allValid ? "PASS" : "FAIL") . ": все записи в возвращённом списке granted[] тоже в валидном диапазоне\n";
echo (!isset($user['stash_count']) ? "PASS" : "FAIL") . ": grantRandomCards() НЕ трогает stash_count (это ответственность вызывающего кода — иначе задвоился бы счётчик)\n";

echo "=== Test 2: isCollectionComplete() ===\n";
$full = ['5' => ['1'=>1,'2'=>3,'3'=>1,'4'=>1,'5'=>1,'6'=>1,'7'=>1]];
$missingOne = ['5' => ['1'=>1,'2'=>0,'3'=>1,'4'=>1,'5'=>1,'6'=>1,'7'=>1]];
echo (ZanachkiModel::isCollectionComplete($full, 5) === true ? "PASS" : "FAIL") . ": набор из 7/7 карточек — полный\n";
echo (ZanachkiModel::isCollectionComplete($missingOne, 5) === false ? "PASS" : "FAIL") . ": не хватает 1 позиции (count=0) — НЕ полный\n";
echo (ZanachkiModel::isCollectionComplete([], 5) === false ? "PASS" : "FAIL") . ": пустые данные — НЕ полный\n";

echo "=== Test 3: claimCollectionReward() — РАСХОДУЕМЫЙ клейм (27.10.2026, по прямому указанию) ===\n";
// 27.10.2026: клейм больше НЕ одноразовый на аккаунт — списывает по 1 карте с каждой из 7
// позиций и доступен ПОВТОРНО, пока после списания набор снова полон. stash_claims остался
// только как статистика "забирали хотя бы раз", не как блокировка повтора (код 89 "уже
// забрано" этой функцией больше не возвращается).
$user2 = ['stash_data' => json_encode(['3' => ['1'=>1,'2'=>1,'3'=>1,'4'=>1,'5'=>1,'6'=>1,'7'=>1]])];
$result = ZanachkiModel::claimCollectionReward($ops, $user2, 3);
echo ($result === true ? "PASS" : "FAIL") . ": клейм полной коллекции 3 (по 1 каждой) — успех\n";
echo ($ops->i($user2, 'cigarettes') === 50 ? "PASS" : "FAIL") . ": начислено +50 сухарей, получено " . $ops->i($user2, 'cigarettes') . "\n";
echo ($ops->i($user2, 'exp') === 50 ? "PASS" : "FAIL") . ": начислено +50 опыта, получено " . $ops->i($user2, 'exp') . "\n";
$claimedMap = ZanachkiModel::getClaimedMap($ops, $user2);
echo (!empty($claimedMap['3']) ? "PASS" : "FAIL") . ": коллекция 3 помечена забранной в stash_claims (статистика, не блокировка)\n";
$stashAfterClaim = ZanachkiModel::getStashData($ops, $user2);
$allZero = true;
foreach($stashAfterClaim['3'] as $count) if(intval($count) !== 0) $allZero = false;
echo ($allZero ? "PASS" : "FAIL") . ": после клейма все 7 карт коллекции 3 списаны до 0 (было по 1 каждой)\n";

$resultAgainEmpty = ZanachkiModel::claimCollectionReward($ops, $user2, 3);
echo ($resultAgainEmpty === 88 ? "PASS" : "FAIL") . ": повторный клейм СРАЗУ после первого (карт уже 0) — отклонён кодом 88 (набор неполон), НЕ кодом 89, получено " . json_encode($resultAgainEmpty) . "\n";
echo ($ops->i($user2, 'cigarettes') === 50 ? "PASS" : "FAIL") . ": неудачный повторный клейм НЕ начислил сухари ещё раз (остались 50)\n";

// Расходуемость: игрок добывает ещё по 1 карте каждой позиции (например dev-грант +100 или
// новый дроп) — клейм ДОЛЖЕН снова сработать, несмотря на stash_claims[3]=true с прошлого раза.
$stashReplenished = ZanachkiModel::getStashData($ops, $user2);
foreach($stashReplenished['3'] as $pos => $count) $stashReplenished['3'][$pos] = 1;
$user2['stash_data'] = json_encode($stashReplenished, JSON_UNESCAPED_UNICODE);
$resultSecondTime = ZanachkiModel::claimCollectionReward($ops, $user2, 3);
echo ($resultSecondTime === true ? "PASS" : "FAIL") . ": после пополнения карт — клейм коллекции 3 СНОВА успешен, несмотря на stash_claims[3]=true, получено " . json_encode($resultSecondTime) . "\n";
echo ($ops->i($user2, 'cigarettes') === 100 ? "PASS" : "FAIL") . ": сухари начислены ВТОРОЙ раз (50+50=100), получено " . $ops->i($user2, 'cigarettes') . "\n";

$user3 = ['stash_data' => json_encode(['4' => ['1'=>1,'2'=>0,'3'=>1,'4'=>1,'5'=>1,'6'=>1,'7'=>1]])];
$resultIncomplete = ZanachkiModel::claimCollectionReward($ops, $user3, 4);
echo ($resultIncomplete === 88 ? "PASS" : "FAIL") . ": клейм НЕПОЛНОЙ коллекции — отклонён кодом 88, получено " . json_encode($resultIncomplete) . "\n";

$resultInvalid = ZanachkiModel::claimCollectionReward($ops, $user3, 99);
echo ($resultInvalid === 87 ? "PASS" : "FAIL") . ": клейм несуществующей коллекции (99) — отклонён кодом 87\n";

echo "=== Test 4: requestCard()/cancelRequest() — лимит 7 одновременно, без суточного счётчика ===\n";
$user4 = [];
for($pos = 1; $pos <= 7; $pos++){
    $r = ZanachkiModel::requestCard($ops, $user4, 1, $pos);
    if($r !== true){ echo "FAIL: запрос #$pos должен был пройти, получено " . json_encode($r) . "\n"; }
}
echo (count(ZanachkiModel::getWishlist($ops, $user4)) === 7 ? "PASS" : "FAIL") . ": после 7 запросов в списке ровно 7 записей\n";

$r8 = ZanachkiModel::requestCard($ops, $user4, 2, 1);
echo ($r8 === 94 ? "PASS" : "FAIL") . ": 8-й ОДНОВРЕМЕННЫЙ запрос отклонён кодом 94 (максимум 7 активных), получено " . json_encode($r8) . "\n";

$rDup = ZanachkiModel::requestCard($ops, $user4, 1, 1);
echo ($rDup === 95 ? "PASS" : "FAIL") . ": повторный запрос УЖЕ запрошенной карточки отклонён кодом 95\n";

$rCancel = ZanachkiModel::cancelRequest($ops, $user4, 1, 1);
echo ($rCancel === true ? "PASS" : "FAIL") . ": отмена существующего запроса — успех\n";
echo (count(ZanachkiModel::getWishlist($ops, $user4)) === 6 ? "PASS" : "FAIL") . ": после отмены в списке 6 записей\n";

$rNewAfterCancel = ZanachkiModel::requestCard($ops, $user4, 2, 1);
echo ($rNewAfterCancel === true ? "PASS" : "FAIL") . ": после отмены сразу можно запросить ДРУГУЮ карточку (без суточного ограничения, по прямому указанию 26.10.2026)\n";

$rCancelMissing = ZanachkiModel::cancelRequest($ops, $user4, 9, 9);
echo ($rCancelMissing === 96 ? "PASS" : "FAIL") . ": отмена несуществующего запроса — код 96\n";

echo "=== Test 5: giveCard() — нельзя дать чего нет, нельзя дать непрошеное, успешный перевод ===\n";
// giver владеет ОБЕИМИ позициями (1 и 2) — так тест кода 98 ("target не просил") не путается
// с кодом 97 ("у giver'а нет копии"): единственная разница между подтестами — что реально есть
// в wishlist у target, не владение giver'а.
$giver = ['stash_data' => json_encode(['6' => ['1'=>2,'2'=>1]])];
$target = ['stash_wishlist' => json_encode([['col'=>6,'pos'=>1]])];

$rNoRequest = ZanachkiModel::giveCard($ops, $giver, $target, 6, 2); // target не просил позицию 2 (хотя giver ею владеет)
echo ($rNoRequest === 98 ? "PASS" : "FAIL") . ": дать карточку, которую target НЕ запрашивал — отклонено кодом 98\n";

$giverEmpty = ['stash_data' => json_encode(['6' => ['1'=>0]])];
$rNoCopy = ZanachkiModel::giveCard($ops, $giverEmpty, $target, 6, 1);
echo ($rNoCopy === 97 ? "PASS" : "FAIL") . ": дать карточку, которой у giver'а 0 копий — отклонено кодом 97\n";

$rGive = ZanachkiModel::giveCard($ops, $giver, $target, 6, 1);
echo ($rGive === true ? "PASS" : "FAIL") . ": успешная передача карточки — true, получено " . json_encode($rGive) . "\n";
$giverData = ZanachkiModel::getStashData($ops, $giver);
$targetData = ZanachkiModel::getStashData($ops, $target);
echo (intval($giverData['6']['1']) === 1 ? "PASS" : "FAIL") . ": у giver'а стало 1 копия (было 2), получено " . $giverData['6']['1'] . "\n";
echo (intval($targetData['6']['1']) === 1 ? "PASS" : "FAIL") . ": у target'а появилась 1 копия, получено " . $targetData['6']['1'] . "\n";
$targetWishlistAfter = ZanachkiModel::getWishlist($ops, $target);
echo (count($targetWishlistAfter) === 0 ? "PASS" : "FAIL") . ": запись убрана из wishlist target'а после передачи, осталось " . count($targetWishlistAfter) . "\n";

echo "=== Test 6: isValidCard() — границы диапазона ===\n";
echo (ZanachkiModel::isValidCard(1, 1) === true ? "PASS" : "FAIL") . ": col=1,pos=1 — валидно (нижняя граница)\n";
echo (ZanachkiModel::isValidCard(15, 7) === true ? "PASS" : "FAIL") . ": col=15,pos=7 — валидно (верхняя граница)\n";
echo (ZanachkiModel::isValidCard(0, 1) === false ? "PASS" : "FAIL") . ": col=0 — невалидно\n";
echo (ZanachkiModel::isValidCard(16, 1) === false ? "PASS" : "FAIL") . ": col=16 — невалидно\n";
echo (ZanachkiModel::isValidCard(1, 0) === false ? "PASS" : "FAIL") . ": pos=0 — невалидно\n";
echo (ZanachkiModel::isValidCard(1, 8) === false ? "PASS" : "FAIL") . ": pos=8 — невалидно\n";
