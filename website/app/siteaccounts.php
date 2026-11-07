<?php
/** Серверный доступ самостоятельных аккаунтов. Не выбирает БД по запросу клиента. */
final class SiteAccounts {
 public function __construct(private PDO $db,private array $allowed) {}
 public static function email(string $raw): string {
  $email=strtolower(trim($raw));
  if(strlen($email)>254||!filter_var($email,FILTER_VALIDATE_EMAIL)||preg_match('/[^\x20-\x7e]/',$email))throw new InvalidArgumentException('invalid_email');
  return $email;
 }
 public function allowed(string $email): bool {
  $email=self::email($email);return in_array('*',$this->allowed,true)||in_array($email,array_map(fn($e)=>strtolower(trim($e)),$this->allowed),true);
 }
 private function run(string $sql,array $args=[]): PDOStatement {$q=$this->db->prepare($sql);$q->execute($args);return $q;}
 private function gate(string $email): string {
  $email=self::email($email);if(!$this->allowed($email))throw new DomainException('registration_closed');return $email;
 }
 public function register(string $email,string $password,int $now): array {
  $email=$this->gate($email);
  if(strlen($password)<10||strlen($password)>256||str_contains($password,"\0"))throw new InvalidArgumentException('invalid_password');
  $hash=password_hash($password,PASSWORD_ARGON2ID);
  $this->db->beginTransaction();
  try{
   $existing=$this->run('SELECT player_id FROM site_accounts WHERE email=? FOR UPDATE',[$email])->fetchColumn();
   if($existing!==false)throw new DomainException('account_exists');
   $this->run('INSERT INTO site_accounts(email,password_hash,created_at) VALUES(?,?,?)',[$email,$hash,$now]);
   $id=(int)$this->db->lastInsertId();$this->db->commit();return ['player_id'=>$id,'email'=>$email];
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
 }
 public function verifyPassword(string $email,string $password): array {
  $email=$this->gate($email);
  if(strlen($password)>256||str_contains($password,"\0"))throw new DomainException('invalid_credentials');
  $a=$this->run('SELECT player_id,email,password_hash,email_verified_at,auth_version,disabled_at FROM site_accounts WHERE email=?',[$email])->fetch(PDO::FETCH_ASSOC);
  if(!$a||!password_verify($password,$a['password_hash'])||$a['disabled_at']!==null)throw new DomainException('invalid_credentials');
  unset($a['password_hash']);return $a;
 }
 public function recoveryAccount(string $email): ?array {
  $email=$this->gate($email);
  $a=$this->run('SELECT player_id,email FROM site_accounts WHERE email=? AND disabled_at IS NULL',[$email])->fetch(PDO::FETCH_ASSOC);
  return $a?:null;
 }
 public function verifiedAccount(int $id): array {
  $a=$this->run("SELECT player_id,email,email_verified_at,auth_version,disabled_at,(password_hash='!pending-email!') AS password_required FROM site_accounts WHERE player_id=?",[$id])->fetch(PDO::FETCH_ASSOC);
  if(!$a||$a['disabled_at']!==null||$a['email_verified_at']===null)throw new DomainException('invalid_account');
  $this->gate($a['email']);return $a;
 }
 public function beginRegistration(string $email,int $now): array {
  $email=$this->gate($email);
  $pending=$this->run("SELECT player_id,email FROM site_accounts WHERE email=? AND password_hash='!pending-email!' AND disabled_at IS NULL",[$email])->fetch(PDO::FETCH_ASSOC);
  if($pending)return $pending;
  $a=$this->register($email,bin2hex(random_bytes(32)),$now);
  $this->run("UPDATE site_accounts SET password_hash='!pending-email!' WHERE player_id=?",[$a['player_id']]);return $a;
 }
 public function completeRegistration(int $id,string $password): array {
  $a=$this->verifiedAccount($id);
  if(strlen($password)<10||strlen($password)>256||str_contains($password,"\0"))throw new InvalidArgumentException('invalid_password');
  $q=$this->run("UPDATE site_accounts SET password_hash=? WHERE player_id=? AND password_hash='!pending-email!'",[password_hash($password,PASSWORD_ARGON2ID),$id]);
  if($q->rowCount()!==1)throw new DomainException('registration_already_completed');return $a;
 }
 public function issueEmailToken(int $id,string $purpose,int $now): string {
  if(!in_array($purpose,['verify_email','reset_password'],true))throw new InvalidArgumentException('invalid_purpose');
  $token=bin2hex(random_bytes(32));
  $this->db->beginTransaction();
  try{
   $account=$this->run('SELECT email FROM site_accounts WHERE player_id=? AND disabled_at IS NULL FOR UPDATE',[$id])->fetchColumn();
   if($account===false)throw new DomainException('invalid_account');$this->gate($account);
   $this->run('UPDATE site_email_tokens SET consumed_at=? WHERE player_id=? AND purpose=? AND consumed_at IS NULL',[$now,$id,$purpose]);
   $this->run('INSERT INTO site_email_tokens(token_hash,player_id,purpose,expires_at,created_at) VALUES(?,?,?,?,?)',[hash('sha256',$token),$id,$purpose,$now+1800,$now]);
   $this->db->commit();return $token;
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
 }
 public function consumeEmailToken(string $token,string $purpose,int $now,?string $password=null): int {
  if(!preg_match('/^[a-f0-9]{64}$/D',$token)||!in_array($purpose,['verify_email','reset_password'],true))throw new DomainException('invalid_email_token');
  if($purpose==='reset_password'&&($password===null||strlen($password)<10||strlen($password)>256||str_contains($password,"\0")))throw new InvalidArgumentException('invalid_password');
  $this->db->beginTransaction();
  try{
   $hash=hash('sha256',$token);
   $t=$this->run('SELECT player_id FROM site_email_tokens WHERE token_hash=? AND purpose=? AND consumed_at IS NULL AND expires_at>? FOR UPDATE',[$hash,$purpose,$now])->fetchColumn();
   if($t===false)throw new DomainException('invalid_email_token');
   $a=$this->run('SELECT email FROM site_accounts WHERE player_id=? AND disabled_at IS NULL FOR UPDATE',[$t])->fetchColumn();
   if($a===false)throw new DomainException('invalid_account');$this->gate($a);
   $this->run('UPDATE site_email_tokens SET consumed_at=? WHERE token_hash=?',[$now,$hash]);
   if($purpose==='verify_email')$this->run('UPDATE site_accounts SET email_verified_at=COALESCE(email_verified_at,?) WHERE player_id=?',[$now,$t]);
   else{
    $this->run('UPDATE site_accounts SET password_hash=?,auth_version=auth_version+1 WHERE player_id=?',[password_hash($password,PASSWORD_ARGON2ID),$t]);
    $this->run('DELETE FROM site_sessions WHERE player_id=?',[$t]);
   }
   $this->db->commit();return (int)$t;
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
 }
}
