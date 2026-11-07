<?php
require __DIR__.'/../../website/app/sitepayments.php';
foreach([0,7,8,15,16,23,100,107] as $id){$p=SitePayments::product($id);if($p['amount_minor']<700||$p['reward_count']<1)throw new RuntimeException('Invalid catalog');}
$o=['id'=>str_repeat('a',64),'amount_minor'=>700,'provider_payment_id'=>'sample-id'];
$p=['id'=>'sample-id','status'=>'succeeded','paid'=>true,'test'=>true,'amount'=>['currency'=>'RUB','value'=>'7.00'],'recipient'=>['account_id'=>'123'],'metadata'=>['site_order_id'=>$o['id']]];
SiteYooKassa::validatePaid($p,$o,'123');
foreach([['test'=>false],['paid'=>false],['status'=>'pending'],['amount'=>['currency'=>'USD','value'=>'7.00']],['recipient'=>['account_id'=>'456']],['metadata'=>['site_order_id'=>'different']],['id'=>'other-id']] as $bad){try{SiteYooKassa::validatePaid(array_replace($p,$bad),$o,'123');throw new LogicException('Invalid receipt accepted');}catch(DomainException $e){}}
if((new SiteYooKassa(['enabled'=>false]))->ready())throw new RuntimeException('Disabled adapter ready');
echo "Site payments: catalog, exact amount/currency, test/paid/status, recipient and order binding passed\n";
