<?php
require __DIR__.'/../../website/app/sitepayments.php';
function check(bool $ok,string $message):void {if(!$ok)throw new LogicException($message);}
function reject(Closure $fn):void {try{$fn();}catch(DomainException $e){return;}throw new LogicException('Подмена принята');}
$test=['enabled'=>true,'require_test_payment'=>true,'shop_id'=>'123','secret_key'=>'test_fixture'];
$live=['enabled'=>true,'require_test_payment'=>false,'shop_id'=>'1517337','secret_key'=>'live_fixture'];
$t=new SiteYooKassa($test);$l=new SiteYooKassa($live);
check($t->checkoutReady()&&$l->ready()&&!$l->checkoutReady(),'Боевые покупки открылись без чеков');
foreach([['require_test_payment'=>null],['require_test_payment'=>'false'],['secret_key'=>'test_fixture']] as $patch)check(!(new SiteYooKassa(array_replace($live,$patch)))->ready(),'Неоднозначный режим принят');
check(!(new SiteYooKassa($live+['live_checkout_enabled'=>true]))->checkoutReady(),'Открытие без чеков');
check(!(new SiteYooKassa($live+['receipt_automation_ready'=>true]))->checkoutReady(),'Неявное открытие');
check((new SiteYooKassa($live+['receipt_automation_ready'=>true,'live_checkout_enabled'=>true]))->checkoutReady(),'Явное включение не работает');
check((new SiteYooKassa($live+['receipt_mode'=>'manual','manual_receipts_acknowledged'=>true,'live_checkout_enabled'=>true]))->checkoutReady(),'Согласованные ручные чеки не работают');
check(!(new SiteYooKassa($live+['receipt_mode'=>'manual','live_checkout_enabled'=>true]))->checkoutReady(),'Ручные чеки включились без подтверждения');
$intent=str_repeat('a',64);check($t->orderId($intent)===$intent&&$l->orderId($intent)!==$intent&&$l->orderId($intent)===$l->orderId($intent),'Пересечение заказов сред');
check((new SiteYooKassa(array_replace($live,['shop_id'=>'456'])))->orderId($intent)!==$l->orderId($intent),'Пересечение магазинов');
$order=['id'=>$l->orderId($intent),'amount_minor'=>700,'provider_payment_id'=>'payment-live'];
$p=['id'=>'payment-live','status'=>'succeeded','paid'=>true,'test'=>false,'amount'=>['value'=>'7.00','currency'=>'RUB'],'recipient'=>['account_id'=>'1517337'],'metadata'=>['site_order_id'=>$order['id'],'game_world'=>'site']];
SiteYooKassa::validatePaid($p,$order,'1517337',false);
reject(fn()=>SiteYooKassa::validatePaid($p,$order,'1517337',true));
foreach([['test'=>true],['test'=>null],['paid'=>false],['status'=>'pending'],['amount'=>['value'=>'7.01','currency'=>'RUB']],['recipient'=>['account_id'=>'123']],['id'=>'other'],['metadata'=>['site_order_id'=>$intent]]] as $patch)reject(fn()=>SiteYooKassa::validatePaid(array_replace($p,$patch),$order,'1517337',false));
$calls=[];$runtime=['payments'=>$live,'payments_previous'=>[$test]];
$factory=function($config)use(&$calls,$p){return new SiteYooKassa($config,function($path,$body,$key)use($config,&$calls,$p){$calls[]=$config['shop_id'];if($config['shop_id']==='1517337')throw new DomainException('payment_not_found');return array_replace($p,['test'=>true,'recipient'=>['account_id'=>'123']]);});};
[$old,$verified]=SiteYooKassa::lookup($runtime,'payment-old',$factory);
check($old->isTest()&&$calls===['1517337','123'],'Старый тестовый заказ не найден');
$calls=[];
try{SiteYooKassa::lookup($runtime,'payment-old',function($config)use(&$calls){return new SiteYooKassa($config,function()use(&$calls){$calls[]=1;throw new RuntimeException('payment_provider_unavailable');});});throw new LogicException('Сетевая ошибка подавлена');}catch(RuntimeException $e){check($e->getMessage()==='payment_provider_unavailable'&&count($calls)===1,'Сетевая ошибка вызвала переключение магазина');}
class LiveGatePDO extends PDO {public function __construct(){}public function prepare(string $q,array $options=[]):PDOStatement|false {throw new LogicException('Запрещённый запрос в БД');}}
try{(new SitePayments(new LiveGatePDO,$l))->create(1,0,$intent,time());throw new LogicException('Боевой заказ создан без чеков');}catch(RuntimeException $e){check($e->getMessage()==='site_payments_disabled','Неверная защита');}
echo "Боевой режим: строгая среда/магазин/сумма, отдельные намерения, старые тестовые платежи, запрет до чеков — успешно\n";
