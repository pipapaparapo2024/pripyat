<?php
require __DIR__.'/../../server/core/models/vktestpayments.php';
function signPay($a){ksort($a);$text='';foreach($a as $k=>$v)$text.=$k.'='.$v;$a['sig']=md5($text.'fixture-secret');return $a;}
function rejectPay($f){try{$f();}catch(Throwable $e){return;}throw new RuntimeException('Ожидался отказ');}
$a=['app_id'=>'54679940','user_id'=>'42','notification_type'=>'get_item_test','item'=>'item0'];
$valid=VkTestPayments::verify(signPay($a),'fixture-secret','54679940',['42']);if($valid['item']!=='item0')throw new RuntimeException('Valid TEST rejected');
VkTestPayments::verify(signPay(array_replace($a,['notification_type'=>'get_item'])),'fixture-secret','54679940',['42']);
foreach([['app_id'=>'54574178'],['user_id'=>'43'],['notification_type'=>'order_status_change']] as $change)rejectPay(fn()=>VkTestPayments::verify(signPay(array_replace($a,$change)),'fixture-secret','54679940',['42']));
$bad=signPay($a);$bad['user_id']='43';rejectPay(fn()=>VkTestPayments::verify($bad,'fixture-secret','54679940',['43']));
$catalog=VkTestPayments::catalog(json_decode(file_get_contents(__DIR__.'/../../server/json/donuts.json'),true));
if(count($catalog)!==32||$catalog[0]['count']!==4||$catalog[0]['price']!==1||$catalog[100]['count']!==50||$catalog[100]['price']!==3)throw new RuntimeException('Catalog mismatch');
foreach(['item0','0','item107'] as $id)if(!isset($catalog[VkTestPayments::productId($id)]))throw new RuntimeException('Wrong item parser');
foreach(['item-1','item107garbage',[],null] as $id)rejectPay(fn()=>VkTestPayments::productId($id));
echo "VK TEST payments: подпись, app_id, тестировщики, запрет реальных notifications и каталог проверены\n";
