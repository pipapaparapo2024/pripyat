<?php
require_once __DIR__.'/socialsessions.php';
require_once __DIR__.'/sociallinkstore.php';
final class SocialIdentity {
 public static function roles(string $platform,string $external): array {
  $developers=['vk'=>['438953352','184138040','382448269'],'ok'=>['587256562321']];
  return in_array($external,$developers[$platform]??[],true)?['developer']:[];
 }
 public static function resolve(array $identity,array $config): array {
  if(($identity['expires_at']??0)<=time())throw new DomainException('social_login_required');
  $platform=$identity['platform']??'';$provider=(string)($identity['provider_id']??'');
  $binding=(new SocialLinkStore(__DIR__.'/../private/social-links'))->binding($platform,$provider);
  if($binding){$external=$binding['external'];}
  elseif($platform==='vk'){$external=(string)($identity['native_vk_id']??'');if(!preg_match('/^[1-9][0-9]{0,9}$/D',$external))throw new DomainException('native_identity_missing');}
  elseif($platform==='ok'){$external=(string)($config['social_links']['ok'][$provider]??'');if(!preg_match('/^[1-9][0-9]{0,19}$/D',$external))throw new DomainException('social_link_required');}
  else throw new DomainException('invalid_platform');
  $access=$config['access'];if(($access['enabled']??false)!==true||!in_array($access[$platform]['mode']??'',['allowlist','open'],true)||(($access[$platform]['mode']??'')!=='open'&&!in_array($external,$access[$platform]['ids']??[],true)))throw new DomainException('closed_test_access_denied');
  $native=$config['native'];$d=NativeProdBoundary::database($native,$platform);
  $db=new PDO('mysql:host=127.0.0.1;port=3306;dbname='.$d['database'].';charset=utf8mb4',$d['user'],$d['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
  if($binding)$uid=(int)$binding['uid'];
  elseif($platform==='vk')$uid=(int)$external;
  else{$q=$db->prepare("SELECT id FROM secure WHERE JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(vk_params),vk_params,'{}'),'$.vk_ok_user_id'))=?");$q->execute([$external]);$ids=$q->fetchAll(PDO::FETCH_COLUMN);if(count($ids)!==1)throw new DomainException('native_mapping_missing');$uid=(int)$ids[0];}
  $q=$db->prepare('SELECT id FROM users WHERE id=?');$q->execute([$uid]);if(!$q->fetchColumn())throw new DomainException('native_character_missing');
  return ['db'=>$db,'database'=>$d,'platform'=>$platform,'uid'=>$uid,'external'=>$external,'sessions'=>new SocialSessions($db,$platform,$native,$access)];
 }
}
