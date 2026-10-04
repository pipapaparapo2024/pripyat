<?php
// 04.10.2026: регресс-тест на баг 28.09.2026 — users.php._sanitizeWeapons() отклоняло ЛЮБОЕ
// users.save с полем weapons для игрока, который ещё НИ РАЗУ не покупал/прокачивал оружие
// (current[0..2]['owned'] в БД реально лежит false, пока buy/upgrade его не выставят), хотя
// слоты 0-2 (нож/цепь/бита) — бесплатное оружие и ВСЕГДА owned=true и на клиенте
// (weapons.js._loadFromUdata()), и на сервере (weapons.php._loadWeapons()). Клиент каждый раз
// шлёт owned:true для этих слотов (честно отражая клиентский инвариант) — без фикса это читалось
// как "эскалация" (newOwned=true, curOwned=false) и отклонялось целиком, даже просто при
// переключении экипировки оружия в бою (qty consume). Найдено по логам uid=470613218 — десятки
// подряд отклонённых сохранений без единой попытки купить/прокачать оружие.
require __DIR__ . '/../../server/core/models/gameops.php';
require __DIR__ . '/../../server/core/controllers/users.php';

$users = new Users([]);

function slot($owned, $upg, $qty){ return ['owned' => $owned, 'equipped' => false, 'upg' => $upg, 'qty' => $qty]; }

echo "=== Test 1 (КОРЕНЬ бага 28.09.2026): свежий игрок, current=[] (ничего не куплено), клиент честно шлёт owned:true для слотов 0-2 ===\n";
$current = [];
$incoming = [slot(true, 0, 0), slot(true, 0, 0), slot(true, 0, 0), slot(false, 0, 0), slot(false, 0, 0), slot(false, 0, 0)];
$result = $users->_sanitizeWeapons($current, $incoming);
echo ($result !== null ? "PASS" : "FAIL") . ": сохранение НЕ отклонено (раньше здесь была эскалация owned false->true для слотов 0-2), получено " . var_export($result, true) . "\n";

echo "=== Test 2: та же ситуация, но current ЯВНО хранит owned:false для слотов 0-2 (старый формат в БД) ===\n";
$currentExplicitFalse = [slot(false, 0, 0), slot(false, 0, 0), slot(false, 0, 0), slot(false, 0, 0), slot(false, 0, 0), slot(false, 0, 0)];
$result2 = $users->_sanitizeWeapons($currentExplicitFalse, $incoming);
echo ($result2 !== null ? "PASS" : "FAIL") . ": тоже НЕ отклонено — инвариант слотов 0-2 не зависит от того, что реально лежит в current\n";

echo "=== Test 3 (РЕГРЕСС-ПРУФ безопасности): платное оружие (слот 3, мачете) — owned-эскалация ВСЁ ЕЩЁ отклоняется ===\n";
$currentPaid = [slot(true, 0, 0), slot(true, 0, 0), slot(true, 0, 0), slot(false, 0, 0), slot(false, 0, 0), slot(false, 0, 0)];
$incomingCheat = [slot(true, 0, 0), slot(true, 0, 0), slot(true, 0, 0), slot(true, 0, 0), slot(false, 0, 0), slot(false, 0, 0)]; // слот 3 "куплен" без оплаты
$result3 = $users->_sanitizeWeapons($currentPaid, $incomingCheat);
echo ($result3 === null ? "PASS" : "FAIL") . ": читерская попытка owned=true на НЕ купленном платном оружии (слот 3) отклонена целиком, получено " . var_export($result3, true) . "\n";

echo "=== Test 4 (РЕГРЕСС-ПРУФ безопасности): qty-эскалация на бесплатном слоте (0) всё ещё отклоняется — фикс owned не ослабил qty/upg ===\n";
$currentFreeQty = [slot(true, 0, 5), slot(true, 0, 0), slot(true, 0, 0), slot(false, 0, 0), slot(false, 0, 0), slot(false, 0, 0)];
$incomingQtyCheat = [slot(true, 0, 9999), slot(true, 0, 0), slot(true, 0, 0), slot(false, 0, 0), slot(false, 0, 0), slot(false, 0, 0)];
$result4 = $users->_sanitizeWeapons($currentFreeQty, $incomingQtyCheat);
echo ($result4 === null ? "PASS" : "FAIL") . ": попытка поднять qty слота 0 с 5 до 9999 отклонена, получено " . var_export($result4, true) . "\n";

echo "=== Test 5: легитимное снижение qty (расход патронов в бою) на уже купленном платном оружии — принимается ===\n";
$currentOwnedQty = [slot(true, 0, 0), slot(true, 0, 0), slot(true, 0, 0), slot(true, 0, 10), slot(false, 0, 0), slot(false, 0, 0)];
$incomingConsume = [slot(true, 0, 0), slot(true, 0, 0), slot(true, 0, 0), slot(true, 0, 7), slot(false, 0, 0), slot(false, 0, 0)];
$result5 = $users->_sanitizeWeapons($currentOwnedQty, $incomingConsume);
echo ($result5 !== null && $result5[3]['qty'] === 7 ? "PASS" : "FAIL") . ": снижение qty (10->7, расход патронов) принято, получено " . var_export($result5, true) . "\n";
