<?php
/** Friendship in existing site users fields; invitations never grant test access. */
final class SiteFriends {
 public function __construct(private PDO $db,private string $secret) {if(strlen($secret)<32)throw new RuntimeException('invalid_invite_key');}
 private function q(string $sql,array $args=[]): PDOStatement {$q=$this->db->prepare($sql);$q->execute($args);return $q;}
 public function invite(int $uid): string {
  $payload='site-test-friend:'.$uid;
  return 'https://pripyat-game-site.ru/account/?friend='.$uid.'.'.hash_hmac('sha256',$payload,$this->secret);
 }
 public function accept(int $uid,string $code): bool {
  if(!preg_match('/^([1-9][0-9]{0,9})\.([a-f0-9]{64})$/D',$code,$m)||(int)$m[1]>2147483647||!hash_equals(hash_hmac('sha256','site-test-friend:'.$m[1],$this->secret),$m[2]))throw new DomainException('invalid_invite');
  return $this->change($uid,(int)$m[1],true);
 }
 public function remove(int $uid,int $other): bool {return $this->change($uid,$other,false);}
 public function add(int $uid,int $other): bool {return $this->change($uid,$other,true);}
 private function change(int $uid,int $other,bool $add): bool {
  if($other<1||$uid===$other)return false;
  $ids=[$uid,$other];sort($ids,SORT_NUMERIC);$this->db->beginTransaction();
  try{
   $rows=$this->q('SELECT id,friends,friends_since FROM users WHERE id IN (?,?) ORDER BY id FOR UPDATE',$ids)->fetchAll(PDO::FETCH_ASSOC);
   if(count($rows)!==2)throw new DomainException('player_missing');
   $since=(int)floor(microtime(true)*1000);
   foreach($rows as $r){$map=json_decode($r['friends_since']?:'{}',true);if(!is_array($map))$map=[];$partner=(int)$r['id']===$uid?$other:$uid;if(isset($map[(string)$partner]))$since=min($since,(int)$map[(string)$partner]);}
   foreach($rows as $r){
    $id=(int)$r['id'];$partner=$id===$uid?$other:$uid;
    $friends=array_values(array_unique(array_filter(array_map('intval',explode(',',(string)$r['friends'])),fn($v)=>$v>0&&$v!==$partner)));
    $friends[]=$id;if($add)$friends[]=$partner;$friends=array_values(array_unique($friends));sort($friends,SORT_NUMERIC);
    $map=json_decode($r['friends_since']?:'{}',true);if(!is_array($map))$map=[];
    if($add)$map[(string)$partner]=$since;else unset($map[(string)$partner]);
    $this->q('UPDATE users SET friends=?,friends_since=? WHERE id=?',[implode(',',$friends),json_encode($map,JSON_FORCE_OBJECT|JSON_THROW_ON_ERROR),$id]);
   }
   $this->db->commit();return true;
  }catch(Throwable $e){if($this->db->inTransaction())$this->db->rollBack();throw $e;}
 }
 public function list(int $uid): array {
  $ids=explode(',',(string)$this->q('SELECT friends FROM users WHERE id=?',[$uid])->fetchColumn());
  $ids=array_values(array_filter(array_unique(array_map('intval',$ids)),fn($id)=>$id>0&&$id!==$uid));
  if(!$ids)return ['players'=>[],'total'=>0];
  $marks=implode(',',array_fill(0,count($ids),'?'));
  $players=$this->q('SELECT id,nick FROM users WHERE id IN ('.$marks.') ORDER BY id',$ids)->fetchAll(PDO::FETCH_ASSOC);
  return ['players'=>$players,'total'=>count($players)];
 }
}
