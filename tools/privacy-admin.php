<?php
// Installed outside webroot. Ownership is verified by the operator, never by a supplied ID alone.
if(PHP_SAPI!=='cli'||!function_exists('posix_geteuid')||posix_geteuid()!==0)exit(77);
require '/var/www/pripyat-site/server/core/models/accounterasure.php';
$o=getopt('',['world:','player:','verified-ticket:','apply','reapply']);
$world=$o['world']??'';$uid=filter_var($o['player']??'',FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>2147483647]]);
if(!isset(AccountErasure::WORLDS[$world])||!$uid){fwrite(STDERR,"Use --world=site|vk|ok --player=ID [--verified-ticket=REFERENCE --apply]\n");exit(2);}
$db=new PDO('mysql:unix_socket=/var/run/mysqld/mysqld.sock;dbname='.AccountErasure::WORLDS[$world],'root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
if(!isset($o['apply'])){echo json_encode(['dry_run'=>true,'world'=>$world,'requires_verified_ownership'=>true,'financial_history'=>'retained separately','creates_backup'=>false])."\n";exit;}
if(!preg_match('/^[a-zA-Z0-9_-]{8,80}$/D',$o['verified-ticket']??'')){fwrite(STDERR,"Verified support ticket reference required. Do not include email or phone.\n");exit(2);}
$root='/var/lib/pripyat-privacy';$mutex=fopen($root.'/.lock','c');if(!$mutex||!flock($mutex,LOCK_EX))exit(75);
function privacyAtomic(string $path,array $data,int $mode=0600):void{$tmp=tempnam(dirname($path),'.new-');try{file_put_contents($tmp,json_encode($data,JSON_THROW_ON_ERROR));chmod($tmp,$mode);if(!rename($tmp,$path))throw new RuntimeException('write_failed');}finally{if(is_file($tmp))unlink($tmp);}}
function privacyPublish(array $ledger):void{
 $entries=[];foreach($ledger['entries'] as $key=>$row)$entries[$key]=true;
 foreach(['/tmp/pripyat-privacy/erased-accounts.json','/var/www/pripyat-site/private/erased-accounts.json','/var/www/stalker-native-prod/private/erased-accounts.json'] as $path)privacyAtomic($path,['entries'=>$entries],0644);
}
try{
 $path=$root.'/deletions.json';$ledger=is_file($path)?json_decode(file_get_contents($path),true,32,JSON_THROW_ON_ERROR):['entries'=>[]];$key=hash('sha256',$world.':'.$uid);
 $ledger['entries'][$key]??=['world'=>$world,'uid'=>$uid,'requested_at'=>time(),'ticket_hash'=>hash('sha256',$o['verified-ticket']),'status'=>'blocked'];
 privacyAtomic($path,$ledger);privacyPublish($ledger); // Written before SQL; survives rollback/restore.
 $external=null;if($world!=='site'){$q=$db->prepare('SELECT vk_params FROM secure WHERE id=?');$q->execute([$uid]);$launch=json_decode($q->fetchColumn()?:'{}',true);$external=$world==='ok'?(string)($launch['vk_ok_user_id']??''):(string)$uid;}
 $result=(new AccountErasure($db,$world))->erase($uid);
 $providers=[];$base='/var/www/pripyat-site';$runtime=json_decode(file_get_contents($base.'/private/site-runtime.json'),true,32,JSON_THROW_ON_ERROR);
 if($world==='site'){$name=hash_hmac('sha256','site-avatar:'.$uid,$runtime['rate_secret']).'.jpg';$p=$base.'/public/assets/avatars/'.$name;if(is_file($p))unlink($p);}
 else{
  foreach([$base.'/private/social-profiles/'.$world.'-'.$uid.'.json','/tmp/pripyat-native-avatar-cache/'.$world.'/'.$uid.'.json'] as $p)if(is_file($p))unlink($p);
  // Provider mappings and pending challenges are retained only if unrelated.
  if($world==='ok')foreach(($runtime['social_links']['ok']??[]) as $provider=>$native)if((string)$native===$external)$providers[]=(string)$provider;
  foreach(glob($base.'/private/social-links/binding-*.json') as $p){$r=json_decode(file_get_contents($p),true);if(($r['world']??'')===$world&&(int)($r['uid']??0)===$uid){$providers[]=(string)$r['provider'];unlink($p);}}
  foreach(glob($base.'/private/social-links/challenge-*.json') as $p){$r=json_decode(file_get_contents($p),true);if(($r['world']??'')===$world&&((int)($r['candidate']['uid']??0)===$uid||in_array((string)($r['provider']??''),$providers,true)))unlink($p);}
 }
 foreach(glob($base.'/private/social-checks/*.json') as $p){$r=json_decode(file_get_contents($p),true);if(($r['platform']??'')===$world&&(($world==='vk'&&(string)($r['native_vk_id']??'')===(string)$uid)||in_array((string)($r['provider_id']??''),$providers,true)))unlink($p);}
 // Only this identity's website sessions. No values are logged or copied.
 foreach(glob('/var/lib/pripyat-site-test/sess_*') as $p)if(is_file($p)&&!is_link($p)){
  $f=fopen($p,'r+');if(!$f)continue;try{if(!flock($f,LOCK_EX))throw new RuntimeException('session_busy');$raw=stream_get_contents($f);$matched=false;
   if($world==='site')$matched=str_contains($raw,'player_id";i:'.$uid.';')&&!str_contains($raw,'social_verified|');
   elseif(str_contains($raw,'s:8:"platform";s:'.strlen($world).':"'.$world.'"')){
    if($world==='vk')$matched=str_contains($raw,'s:12:"native_vk_id";s:'.strlen((string)$uid).':"'.$uid.'"');
    foreach($providers as $provider)if(str_contains($raw,'s:11:"provider_id";s:'.strlen($provider).':"'.$provider.'"'))$matched=true;
   }
   if($matched)ftruncate($f,0);
  }finally{flock($f,LOCK_UN);fclose($f);}
 }
 $ledger['entries'][$key]['status']='completed';$ledger['entries'][$key]['completed_at']=time();$ledger['entries'][$key]['financial_records_retained']=$result['financial_records_retained'];privacyAtomic($path,$ledger);
 echo json_encode($result+['world'=>$world,'restoration_guard'=>true,'matching_website_sessions_revoked'=>true])."\n";
}catch(Throwable $e){fwrite(STDERR,'Erasure not completed; account remains blocked. Reason: '.$e->getMessage()."\n");exit(1);}
finally{flock($mutex,LOCK_UN);fclose($mutex);}
