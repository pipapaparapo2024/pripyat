"""Exercise PROD credit models against isolated TEST fixtures. No PROD writes or DDL."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
php=r'''<?php
require '/var/www/stalker-native-prod/server/core/models/vkprodpayments.php';
require '/var/www/stalker-native-prod/server/core/models/okprodpaymentcredit.php';
define('OK_PAY_CALLBACK_TEST_MODE',true);require '/var/www/stalker-native-prod/server/ok-pay-legacy-core.php';
$configs=json_decode(file_get_contents('/etc/pripyat/test-platform-databases.json'),true);$uid='999000718';$missing='999000719';$now=time();$base=(string)($now*10000+718);
$prices=json_decode(file_get_contents('/var/www/stalker-native-prod/server/json/donuts.json'),true);$catalog=VkProdPayments::catalog($prices);$okPrice=OkPayCallback::priceCatalog($prices)[0];
function dbPay($world){global $configs;$name=$world==='vk'?'stalker_test':'stalker_ok_test';$v=$configs[$name];return new PDO('mysql:host=127.0.0.1;dbname='.$name.';charset=utf8mb4',$v['user'],$v['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);}
function checkPayProd($v,$message){if(!$v)throw new RuntimeException($message);}
function rejectPayProd($fn){try{$fn();}catch(Throwable $e){return;}throw new RuntimeException('Expected rejection');}
function vkReceipt($tid){global $uid;return ['notification_type'=>'order_status_change','user_id'=>$uid,'receiver_id'=>$uid,'order_id'=>$tid,'status'=>'chargeable','item_price'=>'1'];}
function racePay($world,$callback){
 checkPayProd(function_exists('pcntl_fork'),'Concurrency test requires pcntl');$pids=[];
 for($i=0;$i<6;$i++){
  $pid=pcntl_fork();checkPayProd($pid!==-1,'fork failed');
  if($pid===0){try{$db=dbPay($world);$callback($db,$i);$db=null;exit(0);}catch(Throwable $e){fwrite(STDERR,'Payment worker failed: '.get_class($e).PHP_EOL);exit(1);}}
  $pids[]=$pid;
 }
 foreach($pids as $pid){pcntl_waitpid($pid,$status);checkPayProd(pcntl_wifexited($status)&&pcntl_wexitstatus($status)===0,'Concurrent worker failed');}
}
$vkTids=[$base,(string)((int)$base+1),(string)((int)$base+2)];for($i=0;$i<6;$i++)$vkTids[]=(string)((int)$base+10+$i);
$vkTids[]='-'.$base;$vkTids[]='-'.(string)((int)$base+2);
$okTids=['prod-fixture-'.$base,'prod-fixture-'.$base.'-energy','prod-fixture-'.$base.'-missing'];for($i=0;$i<6;$i++)$okTids[]='prod-fixture-'.$base.'-extra-'.$i;
foreach(['vk','ok'] as $world){
 $db=dbPay($world);$q=$db->prepare('SELECT COUNT(*) FROM users WHERE id IN (?,?)');$q->execute([$uid,$missing]);checkPayProd((int)$q->fetchColumn()===0,'Fixture collision');
 $tids=$world==='vk'?$vkTids:$okTids;$table=$world==='vk'?'trans':'ok_payment_transactions';$col=$world==='vk'?'tid':'transaction_id';
 $q=$db->prepare('SELECT COUNT(*) FROM '.$table.' WHERE '.$col.' IN ('.implode(',',array_fill(0,count($tids),'?')).')');$q->execute($tids);checkPayProd((int)$q->fetchColumn()===0,'Order collision');$q=null;$db=null;
}
try{
 foreach(['vk','ok'] as $world){$db=dbPay($world);$q=$db->prepare('INSERT INTO users(id,nick,coins,stew,exp,cigarettes,energy,energy_time,max_energy,create_time,visit) VALUES(?,?,0,0,0,0,20,?,50,?,?)');$q->execute([$uid,'PROD payment regression fixture',$now-600,$now,$now]);$q=null;$db=null;}
 racePay('vk',fn($db)=>VkProdPayments::credit($db,vkReceipt($base),$catalog[0],$now));
 racePay('ok',fn($db)=>OkProdPaymentCredit::credit($db,'123456789012345678',$okTids[0],0,$okPrice,'stew',4,fn()=>(int)$uid,$now));
 foreach(['vk','ok'] as $world){$db=dbPay($world);$q=$db->prepare('SELECT stew,votes_spent FROM users WHERE id=?');$q->execute([$uid]);$row=$q->fetch(PDO::FETCH_ASSOC);checkPayProd((int)$row['stew']===4,'Concurrent duplicate credited twice');checkPayProd((int)$row['votes_spent']===($world==='vk'?1:$okPrice),'Wrong paid counter');$q=null;$db=null;}
 $db=dbPay('vk');$energy=vkReceipt($vkTids[1]);$energy['item_price']='3';VkProdPayments::credit($db,$energy,$catalog[100],$now);
 $bad=vkReceipt($vkTids[2]);$bad['item_price']='99';rejectPayProd(fn()=>VkProdPayments::credit($db,$bad,$catalog[0],$now));
 $bad['item_price']='1';$bad['user_id']=$missing;$bad['receiver_id']=$missing;rejectPayProd(fn()=>VkProdPayments::credit($db,$bad,$catalog[0],$now));
 $q=$db->prepare('SELECT COUNT(*) FROM trans WHERE tid=?');$q->execute([$vkTids[2]]);checkPayProd((int)$q->fetchColumn()===0,'VK rollback failed');
 $test=vkReceipt($vkTids[2]);$test['notification_type']='order_status_change_test';rejectPayProd(fn()=>VkProdPayments::credit($db,$test,$catalog[0],$now));$q=null;$db=null;
 $db=dbPay('ok');OkProdPaymentCredit::credit($db,'123456789012345678',$okTids[1],100,20,'energy',50,fn()=>(int)$uid,$now);
 rejectPayProd(fn()=>OkProdPaymentCredit::credit($db,'123456789012345678',$okTids[2],0,$okPrice,'stew',4,fn()=>0,$now));
 rejectPayProd(fn()=>OkProdPaymentCredit::credit($db,'123456789012345678',$okTids[0],1,$okPrice,'stew',4,fn()=>(int)$uid,$now));
 $q=$db->prepare('SELECT COUNT(*) FROM ok_payment_transactions WHERE transaction_id=?');$q->execute([$okTids[2]]);checkPayProd((int)$q->fetchColumn()===0,'OK rollback failed');$q=null;$db=null;
 racePay('vk',fn($db,$i)=>VkProdPayments::credit($db,vkReceipt($vkTids[3+$i]),$catalog[0],$now));
 racePay('ok',fn($db,$i)=>OkProdPaymentCredit::credit($db,'123456789012345678',$okTids[3+$i],0,$okPrice,'stew',4,fn()=>(int)$uid,$now));
 foreach(['vk','ok'] as $world){
  $db=dbPay($world);$q=$db->prepare('SELECT stew,energy,energy_time,votes_spent FROM users WHERE id=?');$q->execute([$uid]);$row=$q->fetch(PDO::FETCH_ASSOC);
  checkPayProd((int)$row['stew']===28,'Concurrent distinct orders lost credit');checkPayProd((int)$row['energy']===72&&(int)$row['energy_time']===$now,'Energy regeneration/anchor incorrect');
  checkPayProd((int)$row['votes_spent']===($world==='vk'?10:7*$okPrice+20),'Paid counter not atomic');$q=null;$db=null;
 }
 $sandbox=vkReceipt($base);$sandbox['notification_type']='order_status_change_test';
 racePay('vk',fn($db)=>VkProdPayments::credit($db,$sandbox,$catalog[0],$now,true));
 $db=dbPay('vk');checkPayProd(VkProdPayments::credit($db,vkReceipt($base),$catalog[0],$now,true)==='duplicate','Real order replay after sandbox not idempotent');
 $q=$db->prepare('SELECT stew,votes_spent FROM users WHERE id=?');$q->execute([$uid]);$row=$q->fetch(PDO::FETCH_ASSOC);checkPayProd((int)$row['stew']===32&&(int)$row['votes_spent']===11,'Sandbox duplicate or namespace collision');
 $q=$db->prepare('SELECT COUNT(*) FROM trans WHERE tid IN (?,?)');$q->execute([$base,'-'.$base]);checkPayProd((int)$q->fetchColumn()===2,'Real/sandbox ledger not separated');
 $bad=vkReceipt($vkTids[2]);$bad['notification_type']='order_status_change_test';$bad['user_id']=$missing;$bad['receiver_id']=$missing;
 rejectPayProd(fn()=>VkProdPayments::credit($db,$bad,$catalog[0],$now,true));$q=$db->prepare('SELECT COUNT(*) FROM trans WHERE tid=?');$q->execute(['-'.$vkTids[2]]);checkPayProd((int)$q->fetchColumn()===0,'Sandbox rollback failed');$q=null;$db=null;
 echo "VK explicit sandbox: 6 concurrent retries credited once; same real order number isolated; real replay and missing-player rollback passed\n";
 echo "PROD payment models: VK/OK 6 concurrent retries credited once, 6 distinct concurrent orders preserved, energy/paid counter correct, rollback/conflict/test-receipt rejection passed\n";
}finally{
 foreach(['vk','ok'] as $world){$db=dbPay($world);$tids=$world==='vk'?$vkTids:$okTids;$table=$world==='vk'?'trans':'ok_payment_transactions';$col=$world==='vk'?'tid':'transaction_id';$q=$db->prepare('DELETE FROM '.$table.' WHERE '.$col.' IN ('.implode(',',array_fill(0,count($tids),'?')).')');$q->execute($tids);$q=$db->prepare('DELETE FROM users WHERE id=? AND nick=?');$q->execute([$uid,'PROD payment regression fixture']);$q=null;$db=null;}
 echo "Only TEST fixtures used and removed; no PROD records or schema changed\n";
}
'''
p.remote('root',"import subprocess\nr=subprocess.run(['php'],input="+repr(php)+",text=True,capture_output=True,timeout=100)\nprint(r.stdout)\nif r.returncode:print(r.stderr[-1400:]);raise RuntimeError('PROD payment fixture test failed')")
