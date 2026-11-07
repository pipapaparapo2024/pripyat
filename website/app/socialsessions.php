<?php
$models=__DIR__.'/../server/core/models';if(!is_dir($models))$models=__DIR__.'/../../server/core/models';
require_once $models.'/nativeplayersessionlock.php';
require_once $models.'/nativeprodboundary.php';
/** Reuses native secure rows without copying characters or modifying signed launch evidence. */
final class SocialSessions {
 public function __construct(private PDO $db,private string $platform,private array $native,private array $access) {}
 private function q(string $sql,array $args=[]): PDOStatement {$q=$this->db->prepare($sql);$q->execute($args);return $q;}
 private function identity(int $uid,string $external,bool $requireCharacter=true): array {
  if(!in_array($this->platform,['vk','ok'],true)||($this->access['enabled']??false)!==true||!in_array($this->access[$this->platform]['mode']??'',['allowlist','open'],true)||(($this->access[$this->platform]['mode']??'')!=='open'&&!in_array($external,$this->access[$this->platform]['ids']??[],true)))throw new DomainException('closed_test_access_denied');
  $raw=$this->q('SELECT vk_params FROM secure WHERE id=?',[$uid])->fetchColumn();if(!is_string($raw))throw new DomainException('native_launch_required');
  $launch=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if(!is_array($launch))throw new DomainException('native_launch_required');
  NativeProdBoundary::resolve($launch,$this->platform,(string)$uid,$this->native,time(),false);
  $actual=$this->platform==='ok'?(string)($launch['vk_ok_user_id']??''):(string)$launch['vk_user_id'];
  if(!hash_equals($actual,$external))throw new DomainException('native_identity_mismatch');
  if($requireCharacter&&!$this->q('SELECT id FROM users WHERE id=?',[$uid])->fetchColumn())throw new DomainException('native_character_missing');return $launch;
 }
 public function validateCharacter(int $uid,string $external): void {$this->identity($uid,$external,true);}
 public function issue(int $uid,string $external,int $now): array {
  $database=NativeProdBoundary::WORLDS[$this->platform]??'';$lock=NativePlayerSessionLock::acquire($this->db,$database,$uid);
  try{
   $this->identity($uid,$external,true);$token=bin2hex(random_bytes(16));$key=bin2hex(random_bytes(16));
   $this->q('UPDATE secure SET token=?,req_key=?,time=?,lifetime=? WHERE id=?',[$token,$key,$now,3600,$uid]);
   return ['platform'=>$this->platform,'environment'=>'prod','player_id'=>(string)$uid,'token'=>$token,'req_key'=>$key,'expires_at'=>$now+3600];
  }finally{NativePlayerSessionLock::release($this->db,$lock);}
 }
 /** Successful authentication holds the lock through legacy controller writes. */
 public function authenticate(int $uid,string $external,string $token,string $key,int $now): array {
  if(!preg_match('/^[a-f0-9]{32}$/D',$token)||!preg_match('/^[a-f0-9]{32}$/D',$key))throw new DomainException('invalid_session');
  $lock=NativePlayerSessionLock::acquire($this->db,NativeProdBoundary::WORLDS[$this->platform]??'',$uid);
  try{
   $this->identity($uid,$external);$s=$this->q('SELECT token,req_key,time,lifetime FROM secure WHERE id=?',[$uid])->fetch(PDO::FETCH_ASSOC);
   if(!$s||(int)$s['time']+(int)$s['lifetime']<=$now||!hash_equals($s['token'],$token)||!hash_equals($s['req_key'],$key))throw new DomainException('stale_session');
   $next=bin2hex(random_bytes(16));$q=$this->q('UPDATE secure SET req_key=? WHERE id=? AND token=? AND req_key=?',[$next,$uid,$token,$key]);if($q->rowCount()!==1)throw new DomainException('stale_session');
   return ['uid'=>$uid,'req_key'=>$next,'lock'=>$lock];
  }catch(Throwable $e){NativePlayerSessionLock::release($this->db,$lock);throw $e;}
 }
}
