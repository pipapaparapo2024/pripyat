<?php
header('Cache-Control: no-store, private');
require_once dirname(__DIR__).'/app/rewardstotp-gate.php';
requireRewardsTotp();
header('Content-Type: text/html; charset=utf-8');
echo '<meta charset="utf-8"><h1>Google Authenticator привязан</h1><p>Подтверждение принято. Можно вернуться к завершению настройки защиты.</p>';
