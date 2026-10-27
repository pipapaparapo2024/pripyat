<?php
// Утилита для подготовки списка заданий "Разнарядки" на будущий месяц ЗАРАНЕЕ (23.10.2026, по
// прямому указанию — заказчик хочет публиковать список постом в группе ВК до начала месяца).
// Локальный dev-инструмент, НЕ деплоится на сервер.
//
// Использование:
//   php tools/gen_raznaryadka_month.php 2026-12
//
// Печатает человекочитаемый список (день — задание) для публикации и JSON-блок, который нужно
// вставить в server/json/raznaryadka_config.json -> "months"."<YYYY-MM>". Генерация детерминирована
// по месяцу (seed = crc32(monthKey)) — повторный запуск для того же месяца даёт тот же список,
// пока не меняется taskPool() в RaznaryadkaProgress.
if(php_sapi_name() !== 'cli'){ http_response_code(403); exit('CLI only'); }

$monthKey = $argv[1] ?? null;
if(!$monthKey || !preg_match('/^\d{4}-\d{2}$/', $monthKey)){
    fwrite(STDERR, "Использование: php tools/gen_raznaryadka_month.php YYYY-MM\n");
    exit(1);
}

require __DIR__ . '/../server/core/models/raznaryadkaprogress.php';

list($y, $m) = array_map('intval', explode('-', $monthKey));
$daysInMonth = intval(date('t', mktime(0, 0, 0, $m, 1, $y)));

$configPath = __DIR__ . '/../server/json/raznaryadka_config.json';
$config = json_decode(file_get_contents($configPath), true);

$seed = crc32($monthKey);
$monthData = RaznaryadkaProgress::generateMonth($daysInMonth, $seed);

$monthGenitive = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

echo "Список заданий на $monthKey ($daysInMonth дней):\n\n";
foreach($monthData['days'] as $day => $dayCfg){
    $label = RaznaryadkaProgress::taskLabel($config, $dayCfg);
    echo $day . ' ' . $monthGenitive[$m - 1] . ' — ' . $label . "\n";
}

echo "\n--- JSON (вставить/заменить в raznaryadka_config.json -> months.\"$monthKey\") ---\n";
echo json_encode([$monthKey => $monthData], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
