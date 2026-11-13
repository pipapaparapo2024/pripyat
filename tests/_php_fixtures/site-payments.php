<?php
require __DIR__.'/../../website/app/sitepayments.php';
require __DIR__.'/../../website/app/telegramwebsitepayments.php';
foreach([0,7,8,15,16,23,100,107] as $id){$p=SitePayments::product($id);if($p['amount_minor']<700||$p['reward_count']<1)throw new RuntimeException('Invalid catalog');}
$o=['id'=>str_repeat('a',64),'amount_minor'=>700,'provider_payment_id'=>'sample-id'];
$p=['id'=>'sample-id','status'=>'succeeded','paid'=>true,'test'=>true,'amount'=>['currency'=>'RUB','value'=>'7.00'],'recipient'=>['account_id'=>'123'],'metadata'=>['site_order_id'=>$o['id']]];
SiteYooKassa::validatePaid($p,$o,'123');
foreach([['test'=>false],['paid'=>false],['status'=>'pending'],['amount'=>['currency'=>'USD','value'=>'7.00']],['recipient'=>['account_id'=>'456']],['metadata'=>['site_order_id'=>'different']],['id'=>'other-id']] as $bad){try{SiteYooKassa::validatePaid(array_replace($p,$bad),$o,'123');throw new LogicException('Invalid receipt accepted');}catch(DomainException $e){}}
if((new SiteYooKassa(['enabled'=>false]))->ready())throw new RuntimeException('Disabled adapter ready');
$unusedDb=new class extends PDO {public function __construct(){}};
$liveConfig=['enabled'=>true,'require_test_payment'=>false,'shop_id'=>'123','secret_key'=>'live_fixture','live_checkout_enabled'=>true,'receipt_mode'=>'npdcheck','receipt_automation_ready'=>true];
$live=new SiteYooKassa($liveConfig);
new SitePayments($unusedDb,$live,TelegramWebsitePayments::LIVE_TEST_WORLD);
if((new TelegramWebsitePayments($unusedDb,$liveConfig,'live_test_owner'))->mode()!=='live')throw new LogicException('Live TEST payment mode not selected');
try{new TelegramWebsitePayments($unusedDb,$liveConfig,'test');throw new LogicException('Live provider accepted in TEST mode');}catch(InvalidArgumentException $e){}
if(TelegramWebsitePayments::websiteTestMode(TelegramWebsitePayments::OWNER,true,true)!=='live_test_owner')throw new LogicException('Owner preview did not select live test mode');
foreach([['999999999',true,true],[TelegramWebsitePayments::OWNER,false,true],[TelegramWebsitePayments::OWNER,true,false]] as [$id,$preview,$enabled])if(TelegramWebsitePayments::websiteTestMode($id,$preview,$enabled)!=='test')throw new LogicException('Live test checkout escaped owner preview gate');
new SitePayments($unusedDb,new SiteYooKassa(['require_test_payment'=>true]),TelegramWebsitePayments::WORLD);
try{new TelegramWebsitePayments($unusedDb,$liveConfig);throw new LogicException('Telegram TEST accepted live configuration');}catch(InvalidArgumentException $e){}
$notification=['type'=>'notification','event'=>'payment.succeeded','object'=>['id'=>'sample-id','amount'=>['value'=>'1.00'],'status'=>'succeeded']];
if(TelegramWebsitePayments::notificationId($notification)!=='sample-id')throw new LogicException('Notification ID not extracted');
if(TelegramWebsitePayments::notificationId(array_replace($notification,['event'=>'refund.succeeded']))!==null)throw new LogicException('Unrelated notification accepted');
echo "Site payments: catalog, exact amount/currency, test/paid/status, recipient and order binding passed\n";
