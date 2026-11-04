"""Signed synthetic TEST receipt against real HTTP/MySQL, no VK order or real spending."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('p',ROOT/'tools/provision-new-server.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
php=r'''<?php
$file='/etc/pripyat/vk-ok-native-test.json';$c=json_decode(file_get_contents($file),true);$uid='999000716';$marker='VK payment TEST fixture';$tid=(string)(time()*100000+716);$dbv=$c['databases']['stalker_test'];
$db=new PDO('mysql:host=127.0.0.1;dbname=stalker_test;charset=utf8mb4',$dbv['user'],$dbv['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$q=$db->prepare('SELECT COUNT(*) FROM users WHERE id=?');$q->execute([$uid]);if($q->fetchColumn()!=0)throw new RuntimeException('Fixture exists');
$q=$db->prepare('SELECT COUNT(*) FROM trans WHERE tid=?');$q->execute([$tid]);if($q->fetchColumn()!=0)throw new RuntimeException('Order exists');
function payTest($params,$secret){ksort($params);$text='';foreach($params as $k=>$v)$text.=$k.'='.$v;$params['sig']=md5($text.$secret);$ch=curl_init('https://test-pripyat-game.ru/server/universal_pay.php');curl_setopt_array($ch,[CURLOPT_RESOLVE=>['test-pripyat-game.ru:443:127.0.0.1'],CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($params),CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>10]);$out=curl_exec($ch);curl_close($ch);return json_decode($out,true);}
function checkPay($v,$m){if(!$v)throw new RuntimeException($m);}
try{
 $q=$db->prepare("INSERT INTO users(id,nick,coins,stew,exp,cigarettes,create_time,visit) VALUES (?, ?, 10, 0, 0, 1000, ?, ?)");$q->execute([$uid,$marker,time(),time()]);
 $c['access']['vk']['ids'][]=$uid;file_put_contents($file,json_encode($c));
 foreach(['get_item','get_item_test'] as $type){
  $catalog=payTest(['app_id'=>(string)$c['api_id'],'user_id'=>$uid,'notification_type'=>$type,'item'=>'item0'],$c['api_secret']);
  checkPay(($catalog['response']['price']??null)===1,'Catalog unavailable');
 }
 $a=['app_id'=>(string)$c['api_id'],'user_id'=>$uid,'receiver_id'=>$uid,'notification_type'=>'order_status_change_test','order_id'=>$tid,'item_id'=>'item0','item_price'=>'1','status'=>'chargeable'];
 $real=$a;$real['notification_type']='order_status_change';checkPay(isset(payTest($real,$c['api_secret'])['error']),'Real receipt accepted');
 $q=$db->prepare('SELECT COUNT(*) FROM trans WHERE tid=?');$q->execute([$tid]);checkPay((int)$q->fetchColumn()===0,'Catalog or real receipt wrote a transaction');
 $first=payTest($a,$c['api_secret']);checkPay(isset($first['response']['order_id']),'Receipt not accepted');
 for($i=0;$i<3;$i++){checkPay(isset(payTest($a,$c['api_secret'])['response']['order_id']),'Duplicate rejected instead of acknowledged');}
 $q=$db->prepare('SELECT stew,votes_spent FROM users WHERE id=?');$q->execute([$uid]);$user=$q->fetch(PDO::FETCH_ASSOC);checkPay((int)$user['stew']===4&&(int)$user['votes_spent']===1,'Duplicate credited');
 $wrong=$a;$wrong['order_id']=(string)((int)$tid+1);$wrong['item_price']='2';checkPay(isset(payTest($wrong,$c['api_secret'])['error']),'Wrong price accepted');
 $q=$db->prepare('SELECT COUNT(*) FROM trans WHERE tid=?');$q->execute([$wrong['order_id']]);checkPay($q->fetchColumn()==0,'Rejected receipt reserved');
 $missing=$a;$missing['order_id']=(string)((int)$tid+2);$missing['user_id']='999000717';$missing['receiver_id']='999000717';$c['access']['vk']['ids'][]='999000717';file_put_contents($file,json_encode($c));checkPay(isset(payTest($missing,$c['api_secret'])['error']),'Missing player accepted');
 $q->execute([$missing['order_id']]);checkPay($q->fetchColumn()==0,'Missing player reservation not rolled back');
 echo "VK TEST callback: signed receipt credited once, repeats acknowledged, price mismatch denied, missing-player transaction rolled back\n";
}finally{
 $current=json_decode(file_get_contents($file),true);$current['access']['vk']['ids']=array_values(array_filter($current['access']['vk']['ids'],fn($x)=>!in_array($x,[$uid,'999000717'],true)));file_put_contents($file,json_encode($current));
 $q=$db->prepare('DELETE FROM trans WHERE uid IN (?,?) AND tid IN (?,?,?)');$q->execute([$uid,'999000717',$tid,(string)((int)$tid+1),(string)((int)$tid+2)]);
 $q=$db->prepare('DELETE FROM users WHERE id=? AND nick=?');$q->execute([$uid,$marker]);echo "Payment fixtures removed; real accounts unchanged\n";
}
'''
p.remote('root',"import subprocess\nr=subprocess.run(['php'],input="+repr(php)+",capture_output=True,text=True,timeout=100)\nprint(r.stdout)\nif r.returncode:print(r.stderr[-1200:]);raise RuntimeError('VK TEST payment smoke failed')")
