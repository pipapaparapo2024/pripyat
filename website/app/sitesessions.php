<?php
$erasedModel=__DIR__.'/../server/core/models/erasedaccounts.php';if(!is_file($erasedModel))$erasedModel=__DIR__.'/../../server/core/models/erasedaccounts.php';require_once $erasedModel;
/** Одна активная сессия самостоятельного персонажа. Сериализует вход и API. */
final class SiteSessions {
 public static function requiresPhone(string $email): bool {return strtolower(trim($email))!=='killer_ik@mail.ru';}
 public function __construct(private PDO $db,private array $allowed) {}
 private function query(string $sql,array $args=[]): PDOStatement {$q=$this->db->prepare($sql);$q->execute($args);return $q;}
 public function lock(int $id): void {
  if($id<1||$id>2147483647)throw new InvalidArgumentException('invalid_player');
  if((string)$this->query('SELECT GET_LOCK(?,5)',['pripyat.site.test.player.'.$id])->fetchColumn()!=='1')throw new RuntimeException('player_busy');
 }
 public function unlock(int $id): void {$this->query('SELECT RELEASE_LOCK(?)',['pripyat.site.test.player.'.$id]);}
 private function account(int $id): array {
  ErasedAccounts::assertAllowed('site',$id);
  $a=$this->query('SELECT player_id,email,email_verified_at,auth_version,disabled_at FROM site_accounts WHERE player_id=?',[$id])->fetch(PDO::FETCH_ASSOC);
  if(!$a||$a['disabled_at']!==null||$a['email_verified_at']===null||(!in_array('*',$this->allowed,true)&&!in_array(strtolower($a['email']),$this->allowed,true)))throw new DomainException('access_denied');
  if(self::requiresPhone($a['email'])&&!$this->query('SELECT player_id FROM site_phone_identities WHERE player_id=?',[$id])->fetchColumn())throw new DomainException('phone_required');return $a;
 }
 public function issue(int $id,int $now,?int $expectedVersion=null): array {
  $this->lock($id);
  try{
   $this->db->beginTransaction();$a=$this->account($id);
   if($expectedVersion!==null&&(int)$a['auth_version']!==$expectedVersion)throw new DomainException('login_required');
   $this->query("INSERT INTO users(id,coins,cigarettes,create_time,visit,shmot) VALUES(?,10,1000,?,?,'[]') ON DUPLICATE KEY UPDATE id=id",[$id,$now,$now]);
   $token=bin2hex(random_bytes(32));$key=bin2hex(random_bytes(16));
   $this->query('DELETE FROM site_sessions WHERE player_id=?',[$id]);
   $this->query('INSERT INTO site_sessions(token_hash,player_id,request_key,auth_version,created_at,expires_at) VALUES(?,?,?,?,?,?)',[hash('sha256',$token),$id,$key,$a['auth_version'],$now,$now+3600]);
   $this->db->commit();return ['platform'=>'site','environment'=>'test','player_id'=>(string)$id,'token'=>$token,'req_key'=>$key,'expires_at'=>$now+3600,'roles'=>[]];
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}finally{$this->unlock($id);}
 }
 /** Успешный вызов оставляет блокировку вызывающему API до завершения всех записей. */
 public function authenticate(string $token,string $key,int $now): array {
  if(!preg_match('/^[a-f0-9]{64}$/D',$token)||!preg_match('/^[a-f0-9]{32}$/D',$key))throw new DomainException('invalid_session');
  $hash=hash('sha256',$token);$id=$this->query('SELECT player_id FROM site_sessions WHERE token_hash=?',[$hash])->fetchColumn();
  if($id===false)throw new DomainException('invalid_session');$id=(int)$id;$this->lock($id);
  try{
   $a=$this->account($id);
   $s=$this->query('SELECT request_key,expires_at,auth_version FROM site_sessions WHERE token_hash=? AND player_id=?',[$hash,$id])->fetch(PDO::FETCH_ASSOC);
   if(!$s||(int)$s['expires_at']<=$now||(int)$s['auth_version']!==(int)$a['auth_version']||!hash_equals($s['request_key'],$key))throw new DomainException('stale_session');
   $next=bin2hex(random_bytes(16));$q=$this->query('UPDATE site_sessions SET request_key=? WHERE token_hash=? AND request_key=?',[$next,$hash,$key]);
   if($q->rowCount()!==1)throw new DomainException('stale_session');return ['uid'=>$id,'req_key'=>$next];
  }catch(Throwable $e){$this->unlock($id);throw $e;}
 }
}
