<?php
require_once __DIR__.'/siteyookassa.php';
final class SiteDonations {
 private static function connect(array $d): PDO {
  if(!in_array($d['database']??'',['stalker','stalker_ok','stalker_site_test'],true))throw new RuntimeException('invalid_database');
  return new PDO('mysql:host=127.0.0.1;port=3306;dbname='.$d['database'].';charset=utf8mb4',$d['user'],$d['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
 }
 public static function readForRewardsAdmin(array $server, callable $loadConfig): array {
  if(($server['PRIPYAT_REWARDS_PURCHASES']??null)!=='1'
      || !is_string($server['REMOTE_USER']??null) || trim($server['REMOTE_USER'])===''){
   throw new DomainException('admin_login_required');
  }
  $config=$loadConfig();
  require_once __DIR__.'/siteroles.php';
  require_once __DIR__.'/socialidentity.php';
  $file='/var/lib/pripyat-site-test/donations-cache.json';if(is_file($file)&&filemtime($file)>time()-60){$data=json_decode(file_get_contents($file),true,32,JSON_THROW_ON_ERROR);if(is_array($data))return $data;}
  $rows=[];$excluded=0;$unverified=0;
  foreach(['site','vk','ok'] as $world){
   $db=self::connect($world==='site'?$config['database']:NativeProdBoundary::database($config['native'],$world));
   $orders=$db->query("SELECT o.*,u.nick FROM site_payment_orders o LEFT JOIN users u ON u.id=o.player_id WHERE o.status='succeeded' AND o.credited_at IS NOT NULL ORDER BY o.credited_at DESC LIMIT 1000")->fetchAll(PDO::FETCH_ASSOC);
   foreach($orders as $o){
    try{[$provider,$payment]=SiteYooKassa::lookup($config,$o['provider_payment_id']);if($provider->isTest()){$excluded++;continue;}SiteYooKassa::validatePaid($payment,$o,$provider->shopId(),false);}catch(Throwable $e){$unverified++;continue;}
    $id=(int)$o['player_id'];$developer=false;
    if($world==='site'){$q=$db->prepare('SELECT email FROM site_accounts WHERE player_id=?');$q->execute([$id]);$developer=in_array('developer',SiteRoles::forEmail((string)$q->fetchColumn(),$config),true);}
    elseif($world==='vk')$developer=in_array('developer',SocialIdentity::roles('vk',(string)$id),true);
    else{$q=$db->prepare("SELECT JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(vk_params),vk_params,'{}'),'$.vk_ok_user_id')) FROM secure WHERE id=?");$q->execute([$id]);$developer=in_array('developer',SocialIdentity::roles('ok',(string)$q->fetchColumn()),true);}
    $rows[]=['world'=>$world,'player_id'=>$id,'nick'=>$o['nick']?:'Сталкер','amount_minor'=>(int)$o['amount_minor'],'time'=>(int)$o['credited_at'],'developer'=>$developer];
   }
  }
  usort($rows,fn($a,$b)=>$b['time']<=>$a['time']);$data=['items'=>$rows,'test_excluded'=>$excluded,'unverified'=>$unverified,'updated_at'=>time(),'note'=>'Подтверждённые покупки через ЮKassa; до 1000 последних заказов каждого мира. Платежи голосами ВК и ОК сюда не входят.'];
  if($unverified===0){$tmp=$file.'.'.bin2hex(random_bytes(8));file_put_contents($tmp,json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),LOCK_EX);chmod($tmp,0600);rename($tmp,$file);}
  return $data;
 }
}
