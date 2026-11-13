<?php
require_once __DIR__.'/siteyookassa.php';
final class SiteDonations {
 public static function historyStatus(array $order, array $payment, string $verification): string {
  if (($order['credited_at'] ?? null) !== null) return 'credited';
  if ($verification !== 'verified') {
   return match ($order['order_status'] ?? '') {
    'canceled' => 'canceled',
    'pending' => 'pending',
    'created' => 'created',
    default => 'unverified',
   };
  }
  if (($payment['status'] ?? '') === 'succeeded' && ($payment['paid'] ?? false) === true) return 'paid_uncredited';
  if (($payment['status'] ?? '') === 'canceled') {
   return ($payment['cancellation_details']['reason'] ?? '') === 'expired_on_confirmation' ? 'expired' : 'canceled';
  }
  if (($payment['status'] ?? '') === 'pending') return 'pending';
  if (($order['order_status'] ?? '') === 'created') return 'created';
  return 'unverified';
 }

 public static function normalizeCachedReport(array $data): array {
  $items=$data['items']??[];
  foreach ($items as &$row) {
   if (!is_array($row) || isset($row['history_status'])) continue;
   $row['provider_cancellation_reason'] ??= null;
   $row['history_status'] = self::historyStatus([
    'order_status'=>$row['order_status'] ?? '',
    'credited_at'=>$row['credited_at'] ?? null,
   ],[
    'status'=>$row['provider_status'] ?? '',
    'paid'=>$row['provider_paid'] ?? false,
    'cancellation_details'=>['reason'=>$row['provider_cancellation_reason']],
   ],(string)($row['verification'] ?? 'not_checked'));
  }
  unset($row);
  $data['items']=$items;
  return $data;
 }

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
  $file='/var/lib/pripyat-site-test/donations-diagnostics-cache.json';if(is_file($file)&&filemtime($file)>time()-60){$data=json_decode(file_get_contents($file),true,32,JSON_THROW_ON_ERROR);if(is_array($data))return self::normalizeCachedReport($data);}
  $rows=[];$excluded=0;$unverified=0;
  foreach(['site','vk','ok'] as $world){
   $db=self::connect($world==='site'?$config['database']:NativeProdBoundary::database($config['native'],$world));
   $orders=$db->query("SELECT o.*,u.nick FROM site_payment_orders o LEFT JOIN users u ON u.id=o.player_id ORDER BY o.created_at DESC LIMIT 1000")->fetchAll(PDO::FETCH_ASSOC);
   foreach($orders as $o){
    $payment = [];
    $check = 'not_checked';
    if ($o['provider_payment_id']) {
     try {
      [$provider, $payment] = SiteYooKassa::lookup($config, $o['provider_payment_id']);
      if ($provider->isTest()) {$excluded++; continue;}
      SiteYooKassa::validateOrder($payment, $o, $provider->shopId(), false);
      $check = 'verified';
     } catch (Throwable $e) {
      $unverified++;
      $payment = [];
      $check = 'verification_failed';
     }
    }
    $id=(int)$o['player_id'];$developer=false;
    if($world==='site'){$q=$db->prepare('SELECT email FROM site_accounts WHERE player_id=?');$q->execute([$id]);$developer=in_array('developer',SiteRoles::forEmail((string)$q->fetchColumn(),$config),true);}
    elseif($world==='vk')$developer=in_array('developer',SocialIdentity::roles('vk',(string)$id),true);
    else{$q=$db->prepare("SELECT JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(vk_params),vk_params,'{}'),'$.vk_ok_user_id')) FROM secure WHERE id=?");$q->execute([$id]);$developer=in_array('developer',SocialIdentity::roles('ok',(string)$q->fetchColumn()),true);}
    $rows[]=['world'=>$world,'player_id'=>$id,'nick'=>$o['nick']?:'Сталкер','amount_minor'=>(int)$o['amount_minor'],'time'=>(int)($o['credited_at'] ?? $o['created_at']),'developer'=>$developer,
     'order_id'=>$o['id'], 'payment_id'=>$o['provider_payment_id'], 'product_id'=>$o['product_id'],
     'reward_field'=>$o['reward_field'], 'reward_count'=>$o['reward_count'], 'currency'=>$o['currency'],
     'order_status'=>$o['status'], 'created_at'=>(int)$o['created_at'], 'credited_at'=>$o['credited_at'],
     'provider_status'=>$payment['status']??null, 'provider_paid'=>$payment['paid']??null,
     'provider_created_at'=>$payment['created_at']??null, 'provider_captured_at'=>$payment['captured_at']??null,
     'provider_method'=>$payment['payment_method']['type']??null,
     'provider_cancellation_reason'=>$payment['cancellation_details']['reason']??null,
     'verification'=>$check,
     'history_status'=>self::historyStatus([
      'order_status'=>$o['status'],
      'credited_at'=>$o['credited_at'],
     ],$payment,$check)];
   }
  }
  usort($rows,fn($a,$b)=>$b['time']<=>$a['time']);$data=['items'=>$rows,'test_excluded'=>$excluded,'unverified'=>$unverified,'updated_at'=>time(),'note'=>'Покупками считаются только заказы с подтверждённым зачислением. Неоплаченные попытки и незавершённые оплаты показаны отдельно и не входят в сумму покупок. Платежи голосами ВК и ОК сюда не входят.'];
  if($unverified===0){$tmp=$file.'.'.bin2hex(random_bytes(8));file_put_contents($tmp,json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),LOCK_EX);chmod($tmp,0600);rename($tmp,$file);}
  return $data;
 }
}
