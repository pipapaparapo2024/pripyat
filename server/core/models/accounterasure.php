<?php
/** Administrator-only operation. Uses existing schema; no cross-world SQL. */
final class AccountErasure {
 public const WORLDS=['site'=>'stalker_site_test','vk'=>'stalker','ok'=>'stalker_ok'];
 public function __construct(private PDO $db,private string $world) {if(!isset(self::WORLDS[$world]))throw new InvalidArgumentException('invalid_world');}
 private function q(string $sql,array $args=[]):PDOStatement{$q=$this->db->prepare($sql);$q->execute($args);return $q;}
 private function table(string $name):bool{return (bool)$this->q('SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?',[$name])->fetchColumn();}
 public function erase(int $uid): array {
  if($uid<1||$uid>2147483647)throw new InvalidArgumentException('invalid_player');
  $lock=$this->world==='site'?'pripyat.site.test.player.'.$uid:'pripyat.native.prod.'.self::WORLDS[$this->world].'.player.'.$uid;
  if((int)$this->q('SELECT GET_LOCK(?,10)',[$lock])->fetchColumn()!==1)throw new RuntimeException('player_busy');
  try{
   $this->db->beginTransaction();
   $this->q('SELECT id FROM users WHERE id=? FOR UPDATE',[$uid]);
   if($this->table('site_payment_orders')&&(int)$this->q("SELECT COUNT(*) FROM site_payment_orders WHERE player_id=? AND status IN ('created','pending')",[$uid])->fetchColumn()>0)throw new DomainException('unsettled_payments');
   $financial=0;foreach([['site_payment_orders','player_id'],['trans','uid'],['ok_payment_transactions','game_uid']] as [$t,$col])if($this->table($t))$financial+=(int)$this->q("SELECT COUNT(*) FROM `$t` WHERE `$col`=?",[$uid])->fetchColumn();
   // Remove only this player's contribution; other players' boss fight remains.
   foreach([['boss_damage_log','uid'],['boss_instance_claims','uid'],['boss_last_kill','user_id'],['zone_respect_leader','user_id'],['reward_link_claims','user_id'],['secure','id']] as [$t,$col])if($this->table($t))$this->q("DELETE FROM `$t` WHERE `$col`=?",[$uid]);
   if($this->table('boss_instances'))$this->q('UPDATE boss_instances SET owner_uid=0 WHERE owner_uid=?',[$uid]);
   if($this->table('roulette_state'))$this->q('UPDATE roulette_state SET keyring_owner_id=0 WHERE keyring_owner_id=?',[$uid]);
   if($this->table('game_friend_requests'))$this->q('DELETE FROM game_friend_requests WHERE sender_id=? OR recipient_id=?',[$uid,$uid]);
   $rows=$this->q("SELECT id,friends,friends_since FROM users WHERE FIND_IN_SET(?,friends)>0 OR JSON_CONTAINS_PATH(IF(JSON_VALID(friends_since),friends_since,'{}'),'one',?)",[(string)$uid,'$."'.$uid.'"'])->fetchAll(PDO::FETCH_ASSOC);
   foreach($rows as $row){if((int)$row['id']===$uid)continue;$friends=array_values(array_filter(explode(',',(string)$row['friends']),fn($v)=>(string)$v!==(string)$uid));$since=json_decode($row['friends_since']?:'{}',true);if(!is_array($since))$since=[];unset($since[(string)$uid]);$this->q('UPDATE users SET friends=?,friends_since=? WHERE id=?',[implode(',',$friends),json_encode($since,JSON_FORCE_OBJECT|JSON_THROW_ON_ERROR),$row['id']]);}
   $this->q("UPDATE users SET roulette_winner='' WHERE JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(roulette_winner),roulette_winner,'{}'),'$.id'))=?",[(string)$uid]);
   $this->q('DELETE FROM users WHERE id=?',[$uid]);
   if($this->world==='site'){
    $email=$this->q('SELECT email FROM site_accounts WHERE player_id=? FOR UPDATE',[$uid])->fetchColumn();
    foreach(['site_sessions','site_email_tokens','site_phone_identities'] as $t)$this->q("DELETE FROM `$t` WHERE player_id=?",[$uid]);
    $this->q('DELETE FROM site_phone_checks WHERE player_id=? OR email=?',[$uid,$email?:'']);
    if($this->table('site_test_invitations'))$this->q('DELETE FROM site_test_invitations WHERE consumed_by=? OR email=?',[$uid,$email?:'']);
    if($financial){$this->q("UPDATE site_accounts SET email=?,password_hash='!erased!',email_verified_at=NULL,disabled_at=?,auth_version=auth_version+1 WHERE player_id=?",['erased-'.$uid.'@deleted.invalid',time(),$uid]);}
    else $this->q('DELETE FROM site_accounts WHERE player_id=?',[$uid]);
   }
   $this->db->commit();return ['erased'=>true,'financial_records_retained'=>$financial>0];
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
  finally{$this->q('SELECT RELEASE_LOCK(?)',[$lock]);}
 }
}
