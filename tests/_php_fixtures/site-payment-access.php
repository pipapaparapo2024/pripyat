<?php
require __DIR__.'/../../website/app/sitepaymentaccess.php';
foreach([['site','fleeexim@gmail.com'],['site','mr.vladimirkhikaev@gmail.com'],['site','bedzanansergej5110@gmail.com'],['vk','382448269'],['vk','438953352'],['vk','184138040'],['ok','587256562321']] as [$w,$id])if(!SitePaymentAccess::allowed($w,$id))throw new RuntimeException('Owner denied');
foreach([['site','killer_ik@mail.ru'],['site','other@example.com'],['vk','1113977365'],['vk','42'],['ok','382448269'],['vk','587256562321'],['site','382448269']] as [$w,$id])if(SitePaymentAccess::allowed($w,$id))throw new RuntimeException('Unauthorized payer');
echo "Test payment access: owner allowed, other developers/moderation/foreign-world denied\n";
$live=['public_checkout'=>true,'require_test_payment'=>false,'receipt_mode'=>'npdcheck','receipt_automation_ready'=>true];
foreach([['site','ordinary@example.com'],['vk','42'],['ok','1113977365']] as [$world,$identity]){
 if(!SitePaymentAccess::allowed($world,$identity,$live))throw new RuntimeException('Public payer denied');
 foreach([['require_test_payment'=>true],['receipt_mode'=>'manual'],['receipt_automation_ready'=>false],['public_checkout'=>false]] as $override){
  if(SitePaymentAccess::allowed($world,$identity,array_replace($live,$override)))throw new RuntimeException('Public gate opened unexpectedly');
 }
}
if(SitePaymentAccess::allowed('telegram','42',$live)||SitePaymentAccess::allowed('site','',$live))throw new RuntimeException('Invalid public payer');
echo "Public live access: email, VK and OK allowed only with NPD automation\n";
