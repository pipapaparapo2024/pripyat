<?php
require __DIR__.'/../../website/app/telegramwebsitepayments.php';
function check(bool $ok,string $message):void{if(!$ok)throw new LogicException($message);}
function rejects(Closure $fn,string $expected):void{try{$fn();}catch(Throwable $error){if($error->getMessage()===$expected)return;throw new LogicException('Неожиданная причина отказа: '.$error->getMessage());}throw new LogicException('Ожидался отказ '.$expected);}

class ProdBoundaryPDO extends PDO{public function __construct(){}}
$test=['enabled'=>true,'require_test_payment'=>true,'shop_id'=>'123','secret_key'=>'test_fixture'];
$live=['enabled'=>true,'require_test_payment'=>false,'shop_id'=>'1517337','secret_key'=>'live_fixture',
    'live_checkout_enabled'=>true,'receipt_mode'=>'npdcheck','receipt_automation_ready'=>true];

check(TelegramWebsitePayments::databaseForMode('prod')==='stalker_telegram','PROD ledger должен быть Telegram PROD');
check(TelegramWebsitePayments::databaseForMode('test')==='stalker_telegram_test','TEST ledger должен остаться TEST');
check(TelegramWebsitePayments::databaseForMode('live_test_owner')==='stalker_telegram_test','Owner live TEST не должен попадать в PROD');
rejects(fn()=>TelegramWebsitePayments::databaseForMode('production'),'invalid_telegram_payment_mode');

$prod=new TelegramWebsitePayments(new ProdBoundaryPDO(),$live,'prod');
check($prod->mode()==='live','Боевой PROD-магазин помечен как live');
rejects(fn()=>new TelegramWebsitePayments(new ProdBoundaryPDO(),$test,'prod'),'telegram_payment_mode_mismatch');
$testService=new TelegramWebsitePayments(new ProdBoundaryPDO(),$test,'test');
check($testService->mode()==='test','TEST-магазин и режим сохранились');
rejects(fn()=>new TelegramWebsitePayments(new ProdBoundaryPDO(),$live,'test'),'telegram_payment_mode_mismatch');

check(TelegramWebsitePayments::notificationId(['type'=>'notification','event'=>'payment.succeeded','object'=>['id'=>'pay-prod-1']])==='pay-prod-1','Webhook id считывается');
check(TelegramWebsitePayments::notificationId(['type'=>'notification','event'=>'refund.succeeded','object'=>['id'=>'r-1']])===null,'Чужое событие не запускает начисление');
rejects(fn()=>TelegramWebsitePayments::notificationId(['type'=>'notification','event'=>'payment.succeeded','object'=>['id'=>'../bad']]),'invalid_payment');

$handler=file_get_contents(__DIR__.'/../../website/app/telegramprodhttp.php');
check(str_contains($handler,"session_name('pripyat_website_telegram_prod')"),'PROD сессия должна быть изолирована от TEST');
check(str_contains($handler,"dbname=stalker_telegram;charset=utf8mb4"),'PROD handler должен подключать только Telegram PROD');
check(str_contains($handler,'new TelegramWebsitePayments($db,$game[\'website_rub_payments\']??[],\'prod\''),'PROD checkout должен использовать серверный live-конфиг');
check(!str_contains($handler,'stalker_telegram_test'),'PROD auth handler не должен обращаться к TEST базе');
$webhook=file_get_contents(__DIR__.'/../../server/site-payments-webhook.php');
check(str_contains($handler,"'/auth/telegram-prod/payment-notification'"),'Telegram PROD должен иметь отдельный webhook endpoint');
check(!str_contains($webhook,"'telegram'=>'stalker_telegram'"),'Общий webhook сайта не должен открывать доступ к приватному Telegram PROD config');
$receipts=file_get_contents(__DIR__.'/../../tools/site-npd-receipts.php');
check(str_contains($receipts,"'telegram' => 'stalker_telegram'"),'NPD Check worker должен читать Telegram PROD заказы');

echo "Telegram website PROD: разделение OIDC/session/DB, live checkout gate, webhook и НПД ledger — успешно\n";
