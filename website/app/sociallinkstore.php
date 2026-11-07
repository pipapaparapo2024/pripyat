<?php
/** Private, immutable dual-consent bindings. No game data or OAuth tokens. */
final class SocialLinkStore {
 public function __construct(private string $dir) {}
 private function locked(callable $fn): mixed {
  $f=fopen($this->dir.'/.lock','c');if(!$f||!flock($f,LOCK_EX))throw new RuntimeException('link_storage_unavailable');
  try{return $fn();}finally{flock($f,LOCK_UN);fclose($f);}
 }
 private function key(string $world,string $provider): string {if(!in_array($world,['vk','ok'],true)||!preg_match('/^[1-9][0-9]{0,19}$/D',$provider))throw new DomainException('invalid_identity');return hash('sha256',$world.':'.$provider);}
 public function binding(string $world,string $provider): ?array {
  $p=$this->dir.'/binding-'.$this->key($world,$provider).'.json';return is_file($p)?json_decode(file_get_contents($p),true,16,JSON_THROW_ON_ERROR):null;
 }
 public function start(array $identity,int $now): string {
  $this->key($identity['platform'],$identity['provider_id']);$code=bin2hex(random_bytes(16));
  $this->write('challenge-'.hash('sha256',$code),['world'=>$identity['platform'],'provider'=>$identity['provider_id'],'native_vk_id'=>$identity['native_vk_id']??null,'name'=>trim(($identity['profile']['first_name']??'').' '.($identity['profile']['last_name']??'')),'expires'=>$now+600]);return $code;
 }
 private function write(string $key,array $value): void {
  $tmp=tempnam($this->dir,'.new-');try{chmod($tmp,0600);if(file_put_contents($tmp,json_encode($value,JSON_THROW_ON_ERROR))===false||!rename($tmp,$this->dir.'/'.$key.'.json'))throw new RuntimeException('link_write_failed');}finally{if(is_file($tmp))unlink($tmp);}
 }
 private function challenge(string $code,int $now): array {
  if(!preg_match('/^[a-f0-9]{32}$/D',$code))throw new DomainException('invalid_link_code');
  $p=$this->dir.'/challenge-'.hash('sha256',$code).'.json';$c=is_file($p)?json_decode(file_get_contents($p),true,16,JSON_THROW_ON_ERROR):null;
  if(!$c||$c['expires']<=$now)throw new DomainException('expired_link_code');return $c;
 }
 public function preview(string $code,string $world,int $now): array {$c=$this->challenge($code,$now);if($c['world']!==$world||isset($c['consumed']))throw new DomainException('invalid_link_code');return ['name'=>$c['name'],'world'=>$c['world']];}
 public function approve(string $code,string $world,int $uid,string $external,int $now): void {
  $this->locked(function()use($code,$world,$uid,$external,$now){$c=$this->challenge($code,$now);if($c['world']!==$world||isset($c['consumed'])||$uid<1||!preg_match('/^[1-9][0-9]{0,19}$/D',$external))throw new DomainException('invalid_link_code');
   if($world==='vk'&&is_string($c['native_vk_id'])&&$c['native_vk_id']!==$external)throw new DomainException('native_identity_mismatch');
   if(isset($c['candidate'])&&$c['candidate']!==['uid'=>$uid,'external'=>$external])throw new DomainException('link_conflict');
   $c['candidate']=['uid'=>$uid,'external'=>$external];$this->write('challenge-'.hash('sha256',$code),$c);
  });
 }
 public function finish(string $code,array $identity,int $now): array {
  return $this->locked(function()use($code,$identity,$now){$c=$this->challenge($code,$now);
   if($c['world']!==$identity['platform']||$c['provider']!==$identity['provider_id']||!isset($c['candidate'])||isset($c['consumed'])||($identity['expires_at']??0)<=$now)throw new DomainException('link_not_approved');
   $b=$c['candidate'];$old=$this->binding($c['world'],$c['provider']);if($old&&($old['uid']!==$b['uid']||$old['external']!==$b['external']))throw new DomainException('link_conflict');
   foreach(glob($this->dir.'/binding-*.json') as $p){$other=json_decode(file_get_contents($p),true,16,JSON_THROW_ON_ERROR);if($other['world']===$c['world']&&$other['uid']===$b['uid']&&$other['provider']!==$c['provider'])throw new DomainException('character_already_linked');}
   $b+=['world'=>$c['world'],'provider'=>$c['provider'],'confirmed_at'=>$now];$this->write('binding-'.$this->key($c['world'],$c['provider']),$b);$c['consumed']=true;$this->write('challenge-'.hash('sha256',$code),$c);return $b;
  });
 }
}
