<?php
define('OK_PAY_CALLBACK_TEST_MODE', true); // блокирует исполняемую нижнюю часть файла
require __DIR__ . '/../../server/ok_pay_callback.php';

function assertEq($actual, $expected, $msg){
    if($actual === $expected) echo "PASS: $msg\n";
    else echo "FAIL: $msg (ожидалось " . var_export($expected, true) . ", получили " . var_export($actual, true) . ")\n";
}
function assertTrue($cond, $msg){
    if($cond) echo "PASS: $msg\n";
    else echo "FAIL: $msg\n";
}

echo "=== Test 1: checkSig() — верная подпись проходит, неверная/отсутствующая — нет ===\n";
{
    $secret = 'test_secret_123';
    $get = ['uid' => '1000', 'transaction_id' => 'tx1', 'product_code' => '5', 'amount' => '20'];
    $sig = OkPayCallback::computeSig($get, $secret);
    $getWithSig = $get; $getWithSig['sig'] = $sig;
    assertTrue(OkPayCallback::checkSig($getWithSig, $secret), 'верная подпись (посчитанная тем же алгоритмом) проходит проверку');

    $getBadSig = $get; $getBadSig['sig'] = 'явно_неверная_подпись';
    assertTrue(!OkPayCallback::checkSig($getBadSig, $secret), 'неверная подпись отклоняется');

    $getNoSig = $get; // sig вообще отсутствует
    assertTrue(!OkPayCallback::checkSig($getNoSig, $secret), 'отсутствующая подпись отклоняется (не падает с ошибкой)');

    $getWithSig2 = $getWithSig;
    $getWithSig2['amount'] = '999'; // подделана сумма ПОСЛЕ подписи
    assertTrue(!OkPayCallback::checkSig($getWithSig2, $secret), 'подпись не проходит, если параметр подменили после подписания (порядок/значения учитываются)');
}

echo "=== Test 2: itemCatalog() — та же раскладка item->[поле,количество], что у VK (universal_pay.php) ===\n";
{
    $prices = [
        'stew'       => ['default' => [4, 12, 24, 80, 200, 400, 2000, 4000]],
        'coins'      => ['default' => [16, 36, 56, 100, 600, 2000, 10000, 20000]],
        'cigarettes' => ['default' => [1600, 3600, 6000, 8000, 11000, 22000, 125000, 300000]],
    ];
    $catalog = OkPayCallback::itemCatalog($prices);

    assertEq($catalog[0], ['stew', 4], 'item0 — первая пачка тушёнки (4 шт)');
    assertEq($catalog[7], ['stew', 4000], 'item7 — последняя пачка тушёнки (4000 шт)');
    assertEq($catalog[8], ['coins', 16], 'item8 — первая пачка монет (сразу после 8 позиций тушёнки)');
    assertEq($catalog[15], ['coins', 20000], 'item15 — последняя пачка монет');
    assertEq($catalog[16], ['cigarettes', 1600], 'item16 — первая пачка сигарет (сразу после 8 монет)');
    assertEq($catalog[23], ['cigarettes', 300000], 'item23 — последняя пачка сигарет');
    assertEq($catalog[100], ['energy', 50], 'item100 — первый пакет энергии (50)');
    assertEq($catalog[107], ['energy', 3500], 'item107 — последний пакет энергии (3500)');
    assertTrue(!isset($catalog[24]), 'item24 (зарики-поинты) НЕ входит в этот каталог — донат-валюта вне ОК-платежей пока');
    assertTrue(!isset($catalog[108]), 'item108 не существует (за пределами диапазона энергии)');
}

echo "=== Test 3: sanitizeTransactionId() — whitelist символов, не доверяем сырой строке в SQL ===\n";
{
    assertEq(OkPayCallback::sanitizeTransactionId('abc123_-XYZ'), 'abc123_-XYZ', 'безопасная строка проходит без изменений');
    assertEq(OkPayCallback::sanitizeTransactionId("abc' OR '1'='1"), 'abcOR11', 'SQL-инъекционные символы (кавычки/пробелы/=) вырезаны целиком');
    assertEq(OkPayCallback::sanitizeTransactionId(''), '', 'пустая строка остаётся пустой (вызывающий код должен её отклонить отдельно)');
}

echo "=== Test 4: transKey() — префикс ok_ отличает transaction_id ОК от числовых order_id VK в общей таблице trans ===\n";
{
    assertEq(OkPayCallback::transKey('abc123'), 'ok_abc123', 'transaction_id оборачивается префиксом ok_');
    assertTrue(OkPayCallback::transKey('555') !== '555', 'префиксованный ключ НЕ совпадает с голым числом — не столкнётся с VK order_id=555 в той же колонке tid');
}
