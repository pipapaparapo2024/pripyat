<?php
require_once __DIR__.'/sitephoneprovider.php';
final class SitePhoneActions {
 public function __construct(private PDO $db,private SitePhoneProvider $provider,private array $allowed,private string $hmacKey,private string $encryptionKey) {}
 private function query(string $sql,array $args=[]): PDOStatement {$q=$this->db->prepare($sql);$q->execute($args);return $q;}
 public function handle(string $action,array $input,int $now): array {
  $pending=$_SESSION['site_pending']??null;
  if(!is_array($pending)||($pending['expires_at']??0)<=$now)throw new DomainException('login_required');
  $id=(int)$pending['player_id'];
  $a=$this->query('SELECT email,email_verified_at,auth_version,disabled_at FROM site_accounts WHERE player_id=?',[$id])->fetch(PDO::FETCH_ASSOC);
  if(!$a||$a['disabled_at']!==null||$a['email_verified_at']===null||(!in_array('*',$this->allowed,true)&&!in_array(strtolower($a['email']),$this->allowed,true))||(int)$a['auth_version']!==(int)$pending['auth_version'])throw new DomainException('access_denied');
  $owner=hash('sha256',session_id());
  if($action==='phone-start'){
   $phone=SitePhoneIdentity::normalize($input['phone']??'');$fingerprint=SitePhoneIdentity::fingerprint($phone,$this->hmacKey);
   if($this->query('SELECT player_id FROM site_phone_identities WHERE phone_hmac=?',[$fingerprint])->fetchColumn()!==false)throw new DomainException('phone_in_use');
   if($this->query('SELECT player_id FROM site_phone_identities WHERE player_id=?',[$id])->fetchColumn()!==false)throw new DomainException('phone_already_bound');
   $count=$this->query('SELECT COUNT(*) FROM site_phone_checks WHERE (phone_hmac=? OR player_id=?) AND created_at>?',[$fingerprint,$id,$now-3600])->fetchColumn();
   if((int)$count>=3)throw new DomainException('rate_limited');
   // Persist the attempt before contacting the provider so failures cannot bypass limits.
   $check=bin2hex(random_bytes(32));
   $this->query("INSERT INTO site_phone_checks(id,owner_session_hash,email,phone_hmac,phone_encrypted,purpose,player_id,status,created_at,expires_at) VALUES(?,?,?,?,?,'register',?,'pending',?,?)",[$check,$owner,$a['email'],$fingerprint,SitePhoneIdentity::encrypt($phone,$this->encryptionKey),$id,$now,$now+600]);
   try{$r=$this->provider->start($phone);$this->query('UPDATE site_phone_checks SET provider_check_id=? WHERE id=?',[$r['provider_check_id'],$check]);}
   catch(Throwable $e){$this->query("UPDATE site_phone_checks SET status='failed' WHERE id=?",[$check]);throw $e;}
   return ['check_id'=>$check,'call_phone'=>$r['call_phone'],'text'=>'Позвоните с подтверждаемого телефона на указанный номер в течение 10 минут. Стоимость звонка зависит от вашего оператора; для иностранных номеров звонок может быть международным.'];
  }
  $check=$input['check_id']??'';if(!preg_match('/^[a-f0-9]{64}$/D',$check))throw new DomainException('invalid_check');
  $q=$this->query("SELECT * FROM site_phone_checks WHERE id=? AND owner_session_hash=? AND player_id=? AND status='pending' AND consumed_at IS NULL AND expires_at>?",[$check,$owner,$id,$now]);$row=$q->fetch(PDO::FETCH_ASSOC);
  if(!$row||!$row['provider_check_id'])throw new DomainException('invalid_check');
  $phone=SitePhoneIdentity::decrypt($row['phone_encrypted'],$this->encryptionKey);
  if(!$this->provider->check($row['provider_check_id'],$phone))return ['verified'=>false,'text'=>'Звонок пока не подтверждён. Повторите проверку через несколько секунд.'];
  $this->db->beginTransaction();
  try{
   $q=$this->query("UPDATE site_phone_checks SET status='consumed',consumed_at=? WHERE id=? AND status='pending' AND consumed_at IS NULL AND expires_at>?",[$now,$check,$now]);
   if($q->rowCount()!==1)throw new DomainException('invalid_check');
   $this->query('INSERT INTO site_phone_identities(player_id,phone_hmac,phone_encrypted,verified_at) VALUES(?,?,?,?)',[$id,$row['phone_hmac'],$row['phone_encrypted'],$now]);
   $this->db->commit();
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
  return ['verified'=>true,'text'=>'Телефон подтверждён.'];
 }
}
