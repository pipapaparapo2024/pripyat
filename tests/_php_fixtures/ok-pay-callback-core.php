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

echo "=== Test 5: priceCatalog() — та же индексация productCode, что у itemCatalog(), но отдаёт ожидаемую цену (price/7) ===\n";
{
    $prices = [
        'stew'       => ['default' => [4, 12, 24, 80, 200, 400, 2000, 4000],
                          'price'   => [28, 84, 168, 560, 1400, 2800, 14000, 28000]],
        'coins'      => ['default' => [16, 36, 56, 100, 600, 2000, 10000, 20000],
                          'price'   => [35, 70, 105, 175, 700, 1750, 7000, 14000]],
        'cigarettes' => ['default' => [1600, 3600, 6000, 8000, 11000, 22000, 125000, 300000],
                          'price'   => [21, 35, 56, 70, 98, 196, 980, 2100]],
    ];
    $priceCatalog = OkPayCallback::priceCatalog($prices);

    assertEq($priceCatalog[0], 4, 'item0 — 28/7 = 4 ОК (та же пачка тушёнки, что item0 в itemCatalog())');
    assertEq($priceCatalog[8], 5, 'item8 — первая пачка монет (35/7), offset согласован с itemCatalog()');
    assertEq($priceCatalog[16], 3, 'item16 — первая пачка сигарет (21/7), offset согласован с itemCatalog()');
    assertEq($priceCatalog[100], 3, 'item100 — энергия 50, цена 3 ОК (тот же голос-прайс, что у universal_pay.php)');
    assertEq($priceCatalog[107], 120, 'item107 — энергия 3500, цена 120 ОК');
}

echo "=== Test 6: amountMatches() — допуск на округление, но не произвольное занижение суммы ===\n";
{
    assertTrue(OkPayCallback::amountMatches(4.0, '4'), 'точное совпадение проходит');
    assertTrue(OkPayCallback::amountMatches(4.0, 4), 'совпадение с числовым (не строковым) amount тоже проходит');
    assertTrue(OkPayCallback::amountMatches(4.0, '4.9'), 'допуск округления в большую сторону (≤1) проходит');
    assertTrue(!OkPayCallback::amountMatches(120.0, '1'), 'подделанная заниженная сумма (1 вместо 120) ОТКЛОНЯЕТСЯ');
    assertTrue(!OkPayCallback::amountMatches(4.0, 'abc'), 'нечисловой amount отклоняется, не падает с ошибкой');
    assertTrue(!OkPayCallback::amountMatches(4.0, null), 'отсутствующий amount отклоняется');
}
